import { describe, expect, it, vi } from "vitest";
import type { AdminGraphQLClient } from "../shopify-gql.server";
import {
  buildAdjustVariables,
  changeIndexFromField,
  classifyAdjustResponse,
  classifyThrownAdjustError,
  createShopifyAdjustSender,
  INVENTORY_ADJUST_MUTATION,
  type AdjustBatchRequest,
} from "./shopify-adjust.server";

const ITEM_A = "gid://shopify/InventoryItem/101";
const ITEM_B = "gid://shopify/InventoryItem/102";
const LOCATION = "gid://shopify/Location/11";

function request(
  overrides: Partial<AdjustBatchRequest> = {},
): AdjustBatchRequest {
  return {
    idempotencyKey: "propo-inv:op1:1",
    reason: "correction",
    quantityName: "available",
    referenceDocumentUri: null,
    ledgerDocumentUri: null,
    changes: [
      {
        inventoryItemId: ITEM_A,
        locationId: LOCATION,
        delta: 5,
        changeFromQuantity: 10,
      },
      {
        inventoryItemId: ITEM_B,
        locationId: LOCATION,
        delta: -2,
        changeFromQuantity: null,
      },
    ],
    ...overrides,
  };
}

function userErrors(
  ...errors: Array<{
    code?: string | null;
    field?: string[] | null;
    message?: string;
  }>
) {
  return {
    data: {
      inventoryAdjustQuantities: {
        inventoryAdjustmentGroup: null,
        userErrors: errors,
      },
    },
  };
}

describe("buildAdjustVariables", () => {
  it("sends the idempotency key and an explicit changeFromQuantity for every change", () => {
    expect(buildAdjustVariables(request())).toEqual({
      idempotencyKey: "propo-inv:op1:1",
      quantityNames: ["available"],
      input: {
        name: "available",
        reason: "correction",
        changes: [
          {
            inventoryItemId: ITEM_A,
            locationId: LOCATION,
            delta: 5,
            changeFromQuantity: 10,
          },
          {
            inventoryItemId: ITEM_B,
            locationId: LOCATION,
            delta: -2,
            changeFromQuantity: null,
          },
        ],
      },
    });
  });

  it("attaches the reference document and one ledger document per change when given", () => {
    const variables = buildAdjustVariables(
      request({
        quantityName: "damaged",
        referenceDocumentUri: "gid://propo/Stocktake/st1",
        ledgerDocumentUri: "gid://propo/InventoryOperation/op1",
      }),
    );
    expect(variables.input.name).toBe("damaged");
    expect(variables.input).toHaveProperty(
      "referenceDocumentUri",
      "gid://propo/Stocktake/st1",
    );
    expect(variables.input.changes.map((c) => c.ledgerDocumentUri)).toEqual([
      "gid://propo/InventoryOperation/op1",
      "gid://propo/InventoryOperation/op1",
    ]);
  });
});

describe("changeIndexFromField", () => {
  it("reads the change index out of a userError field path", () => {
    expect(changeIndexFromField(["input", "changes", "1", "delta"], 2)).toBe(1);
    expect(changeIndexFromField(["input", "changes", "0"], 2)).toBe(0);
  });

  it("returns null when the path names no change of this request", () => {
    expect(changeIndexFromField(null, 2)).toBeNull();
    expect(changeIndexFromField(["input", "reason"], 2)).toBeNull();
    expect(changeIndexFromField(["input", "changes"], 2)).toBeNull();
    expect(changeIndexFromField(["input", "changes", "x"], 2)).toBeNull();
    expect(
      changeIndexFromField(["input", "changes", "2", "delta"], 2),
    ).toBeNull();
  });
});

describe("classifyAdjustResponse", () => {
  it("reports the batch applied with the resulting quantity of the adjusted name only", () => {
    const outcome = classifyAdjustResponse(request(), {
      data: {
        inventoryAdjustQuantities: {
          inventoryAdjustmentGroup: {
            id: "gid://shopify/InventoryAdjustmentGroup/9",
            changes: [
              {
                name: "available",
                delta: 5,
                quantityAfterChange: 15,
                item: { id: ITEM_A },
                location: { id: LOCATION },
              },
              {
                name: "on_hand",
                delta: 5,
                quantityAfterChange: 18,
                item: { id: ITEM_A },
                location: { id: LOCATION },
              },
              {
                name: "available",
                delta: -2,
                quantityAfterChange: null,
                item: { id: ITEM_B },
                location: { id: LOCATION },
              },
            ],
          },
          userErrors: [],
        },
      },
    });
    expect(outcome).toEqual({
      kind: "applied",
      adjustmentGroupId: "gid://shopify/InventoryAdjustmentGroup/9",
      changes: [
        {
          inventoryItemId: ITEM_A,
          locationId: LOCATION,
          delta: 5,
          quantityAfterChange: 15,
        },
        {
          inventoryItemId: ITEM_B,
          locationId: LOCATION,
          delta: -2,
          quantityAfterChange: null,
        },
      ],
    });
  });

  it("attributes a stale compare-and-swap rejection to its change", () => {
    const outcome = classifyAdjustResponse(
      request(),
      userErrors({
        code: "CHANGE_FROM_QUANTITY_STALE",
        field: ["input", "changes", "0", "changeFromQuantity"],
        message:
          "The changeFromQuantity argument no longer matches the persisted quantity.",
      }),
    );
    expect(outcome).toEqual({
      kind: "rejected",
      errors: [
        {
          code: "CHANGE_FROM_QUANTITY_STALE",
          message:
            "The changeFromQuantity argument no longer matches the persisted quantity.",
          changeIndex: 0,
        },
      ],
    });
  });

  it("keeps request-level rejections unattributed", () => {
    const outcome = classifyAdjustResponse(
      request(),
      userErrors({
        code: "INVALID_REASON",
        field: ["input", "reason"],
        message: "The specified reason is invalid.",
      }),
    );
    expect(outcome).toEqual({
      kind: "rejected",
      errors: [
        {
          code: "INVALID_REASON",
          message: "The specified reason is invalid.",
          changeIndex: null,
        },
      ],
    });
  });

  it.each([
    "IDEMPOTENCY_CONCURRENT_REQUEST",
    "SERVICE_UNAVAILABLE",
    "ADJUST_QUANTITIES_FAILED",
  ])("asks for a same-key resend on %s", (code) => {
    const outcome = classifyAdjustResponse(
      request(),
      userErrors({ code, field: null, message: "try again" }),
    );
    expect(outcome).toEqual({ kind: "retry", code, message: "try again" });
  });

  it("does not turn a key Shopify recorded as failed into a blind resend", () => {
    const outcome = classifyAdjustResponse(
      request(),
      userErrors({
        code: "IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED",
        field: null,
        message: "A previous request with this idempotency key failed.",
      }),
    );
    expect(outcome.kind).toBe("rejected");
  });

  it("treats throttling and server errors as retryable", () => {
    for (const code of [
      "THROTTLED",
      "INTERNAL_SERVER_ERROR",
      "SERVICE_UNAVAILABLE",
      "TIMEOUT",
    ]) {
      expect(
        classifyAdjustResponse(request(), {
          errors: [{ message: "nope", extensions: { code } }],
        }),
      ).toEqual({ kind: "retry", code, message: "nope" });
    }
    expect(
      classifyAdjustResponse(request(), { errors: [{ message: "Throttled" }] }),
    ).toEqual({ kind: "retry", code: "THROTTLED", message: "Throttled" });
  });

  it("treats access and validation errors as a definitive rejection", () => {
    expect(
      classifyAdjustResponse(request(), {
        errors: [
          {
            message: "Access denied for inventoryAdjustQuantities field.",
            extensions: { code: "ACCESS_DENIED" },
          },
        ],
      }),
    ).toEqual({
      kind: "rejected",
      errors: [
        {
          code: "ACCESS_DENIED",
          message: "Access denied for inventoryAdjustQuantities field.",
          changeIndex: null,
        },
      ],
    });
  });

  it("never reports success or failure for a response it cannot read", () => {
    for (const body of [
      null,
      {},
      { data: null },
      { data: { inventoryAdjustQuantities: null } },
      {
        data: {
          inventoryAdjustQuantities: {
            inventoryAdjustmentGroup: null,
            userErrors: [],
          },
        },
      },
    ]) {
      expect(classifyAdjustResponse(request(), body)).toMatchObject({
        kind: "retry",
        code: "EMPTY_RESPONSE",
      });
    }
  });

  it("bounds the stored error message", () => {
    const outcome = classifyAdjustResponse(
      request(),
      userErrors({
        code: "INVALID_LOCATION",
        field: null,
        message: "x".repeat(5000),
      }),
    );
    expect(outcome.kind).toBe("rejected");
    if (outcome.kind === "rejected") {
      expect(outcome.errors[0].message).toHaveLength(1000);
    }
  });
});

describe("classifyThrownAdjustError", () => {
  it("reads GraphQL errors the Shopify client throws", () => {
    const err = Object.assign(new Error("Throttled"), {
      body: {
        errors: {
          graphQLErrors: [
            { message: "Throttled", extensions: { code: "THROTTLED" } },
          ],
        },
      },
    });
    expect(classifyThrownAdjustError(request(), err)).toEqual({
      kind: "retry",
      code: "THROTTLED",
      message: "Throttled",
    });
  });

  it("rejects when Shopify refused the request before executing it", () => {
    for (const status of [400, 403, 404]) {
      const err = Object.assign(new Error("Refused"), {
        response: { code: status },
      });
      expect(classifyThrownAdjustError(request(), err)).toEqual({
        kind: "rejected",
        errors: [
          { code: `HTTP_${status}`, message: "Refused", changeIndex: null },
        ],
      });
    }
  });

  it("keeps recoverable shop states and server failures retryable", () => {
    for (const status of [401, 402, 423, 429, 500, 502, 503, 504]) {
      const err = Object.assign(new Error("Unavailable"), {
        response: { code: status },
      });
      expect(classifyThrownAdjustError(request(), err)).toEqual({
        kind: "retry",
        code: `HTTP_${status}`,
        message: "Unavailable",
      });
    }
  });

  it("treats a dropped connection as unknown outcome, never as failure", () => {
    expect(
      classifyThrownAdjustError(request(), new Error("socket hang up")),
    ).toEqual({
      kind: "retry",
      code: "TRANSPORT_ERROR",
      message: "socket hang up",
    });
    expect(classifyThrownAdjustError(request(), undefined)).toEqual({
      kind: "retry",
      code: "TRANSPORT_ERROR",
      message: "Request to Shopify failed",
    });
  });
});

describe("createShopifyAdjustSender", () => {
  it("sends the mutation with the built variables and classifies the body", async () => {
    const graphql = vi.fn(async () => ({
      json: async () => ({
        data: {
          inventoryAdjustQuantities: {
            inventoryAdjustmentGroup: {
              id: "gid://shopify/InventoryAdjustmentGroup/9",
              changes: [],
            },
            userErrors: [],
          },
        },
      }),
    }));
    const send = createShopifyAdjustSender({
      graphql,
    } as unknown as AdminGraphQLClient);

    const outcome = await send(request());

    expect(graphql).toHaveBeenCalledTimes(1);
    expect(graphql).toHaveBeenCalledWith(INVENTORY_ADJUST_MUTATION, {
      variables: buildAdjustVariables(request()),
    });
    expect(outcome).toEqual({
      kind: "applied",
      adjustmentGroupId: "gid://shopify/InventoryAdjustmentGroup/9",
      changes: [],
    });
  });

  it("returns retry when the call throws without telling us what happened", async () => {
    const graphql = vi.fn(async () => {
      throw new Error("fetch failed");
    });
    const send = createShopifyAdjustSender({
      graphql,
    } as unknown as AdminGraphQLClient);
    await expect(send(request())).resolves.toEqual({
      kind: "retry",
      code: "TRANSPORT_ERROR",
      message: "fetch failed",
    });
  });

  it("returns retry when the response body is not JSON", async () => {
    const graphql = vi.fn(async () => ({
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    }));
    const send = createShopifyAdjustSender({
      graphql,
    } as unknown as AdminGraphQLClient);
    await expect(send(request())).resolves.toMatchObject({
      kind: "retry",
      code: "TRANSPORT_ERROR",
    });
  });
});
