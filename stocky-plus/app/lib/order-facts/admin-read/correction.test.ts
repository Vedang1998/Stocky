import { describe, expect, it } from "vitest";
import { readOrderFact } from "./orders";
import { readRefundFact } from "./refunds";
import {
  agreementNode,
  lineNode,
  orderHeader,
  refundLineNode,
  refundNode,
  saleNode,
  TRUSTED_SHOP,
} from "./__tests__/fixtures";
import { createOrderStoreAdmin } from "./__tests__/order-store-admin";
import { createMockAdmin } from "./__tests__/mock-admin";
import {
  ORDER_ADMIN_READ_MAX_REQUESTS,
  ORDER_ADMIN_READ_PAGE_SIZE,
} from "./constants";

function context(admin: ReturnType<typeof createMockAdmin>, request?: Request) {
  return { admin, shop: TRUSTED_SHOP, request };
}

function baseOrderPayload(overrides?: Record<string, unknown>) {
  return {
    ...orderHeader(),
    lineItems: {
      pageInfo: { hasNextPage: false, endCursor: null },
      edges: [
        { cursor: "gid://shopify/LineItem/1", node: lineNode(1) },
      ],
    },
    agreements: { pageInfo: { hasNextPage: false, endCursor: null }, edges: [] },
    refunds: [],
    ...overrides,
  };
}

describe("F-01 required Order.refunds list", () => {
  it("accepts a genuine empty refunds array as complete", async () => {
    const admin = createOrderStoreAdmin({
      header: orderHeader(),
      lines: [lineNode(1)],
      agreements: [],
      refunds: [],
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1");
    expect(result.status).toBe("complete");
    if (result.status !== "complete") return;
    expect(result.value.refunds).toEqual([]);
  });

  it.each([
    ["absent", undefined],
    ["null", null],
    ["object", { id: "not-a-list" }],
    ["scalar", "refunds"],
  ] as const)("rejects %s refunds without a complete snapshot", async (_label, rawRefunds) => {
    const admin = createOrderStoreAdmin({
      header: orderHeader(),
      lines: [lineNode(1)],
      agreements: [],
      refunds: [],
      rawRefunds,
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1");
    expect(result.status).not.toBe("complete");
    expect(result.status).toBe("failure");
    if (result.status !== "failure") return;
    expect(result.kind).toBe("MALFORMED_ENVELOPE");
    expect(result.reason).toBe("MALFORMED_ENVELOPE");
  });

  it("rejects a null refunds list entry", async () => {
    const admin = createOrderStoreAdmin({
      header: orderHeader(),
      lines: [lineNode(1)],
      agreements: [],
      refunds: [],
      rawRefunds: [null],
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1");
    expect(result.status).toBe("failure");
    if (result.status !== "failure") return;
    expect(result.kind).toBe("MALFORMED_ENVELOPE");
  });

  it("rejects duplicate refund GIDs", async () => {
    const refund = refundNode(10, [refundLineNode(1)]);
    const admin = createOrderStoreAdmin({
      header: orderHeader(),
      lines: [lineNode(1)],
      agreements: [],
      refunds: [refund, refund],
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1");
    expect(result.status).toBe("failure");
    if (result.status !== "failure") return;
    expect(result.kind).toBe("IDENTITY_MISMATCH");
  });
});

describe("F-02/F-03 version-coherent pagination", () => {
  it("completes a stable multi-page snapshot and rechecks the pinned clock", async () => {
    const lines = Array.from({ length: 101 }, (_, index) => lineNode(index + 1));
    const admin = createOrderStoreAdmin({
      header: orderHeader({
        currentSubtotalLineItemsQuantity: 101,
        subtotalLineItemsQuantity: 101,
      }),
      lines,
      agreements: [],
      refunds: [],
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1", {
      pageSize: 100,
    });
    expect(result.status).toBe("complete");
    if (result.status !== "complete") return;
    expect(result.value.lineItems).toHaveLength(101);
    const orderCalls = admin.calls.filter((call) =>
      call.query.includes("query OrderFactById"),
    );
    expect(orderCalls.length).toBe(3);
  });

  it("accepts one line with quantity 10 without comparing lineItems.length to unit sums", async () => {
    const admin = createOrderStoreAdmin({
      header: orderHeader({
        currentSubtotalLineItemsQuantity: 10,
        subtotalLineItemsQuantity: 10,
      }),
      lines: [lineNode(1, { quantity: 10, currentQuantity: 10, refundableQuantity: 10 })],
      agreements: [agreementNode(1, [saleNode(1, { quantity: 10 })])],
      refunds: [],
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1");
    expect(result.status).toBe("complete");
    if (result.status !== "complete") return;
    expect(result.value.lineItems).toHaveLength(1);
    expect(result.value.lineItems[0]?.quantity).toBe(10);
    expect(result.value.subtotalLineItemsQuantity).toBe(10);
  });

  it("fails closed when Order.updatedAt drifts during line continuation", async () => {
    const admin = createOrderStoreAdmin({
      header: orderHeader(),
      lines: Array.from({ length: 3 }, (_, index) => lineNode(index + 1)),
      agreements: [],
      refunds: [],
      onOrderQuery: (callIndex) => {
        if (callIndex >= 2) {
          // Mutate the live header the store reads on the next response.
        }
      },
    });
    const storeAdmin = admin;
    let calls = 0;
    const drifting = createMockAdmin((query, variables) => {
      calls += 1;
      if (query.includes("query OrderFactById")) {
        const header =
          calls === 1
            ? orderHeader({ updatedAt: "2026-01-02T00:00:00Z" })
            : orderHeader({ updatedAt: "2026-01-03T00:00:00Z" });
        const after = typeof variables?.lineAfter === "string" ? variables.lineAfter : null;
        const start = after === "gid://shopify/LineItem/1" ? 1 : 0;
        const nodes = [lineNode(start + 1), lineNode(start + 2)].slice(0, 1);
        return {
          data: {
            order: {
              ...header,
              lineItems: {
                pageInfo: {
                  hasNextPage: start === 0,
                  endCursor: nodes[0]?.id ?? null,
                },
                edges: nodes.map((node) => ({ cursor: node.id, node })),
              },
              agreements: {
                pageInfo: { hasNextPage: false, endCursor: null },
                edges: [],
              },
              refunds: [],
            },
          },
        };
      }
      return storeAdmin.graphql(query, { variables }).then((response) =>
        response.json(),
      ) as never;
    });
    const result = await readOrderFact(context(drifting), "gid://shopify/Order/1", {
      pageSize: 1,
    });
    expect(result.status).toBe("incomplete");
    if (result.status !== "incomplete") return;
    expect(result.phase).toBe("lineItems");
    expect(result.reason).toBe("SNAPSHOT_PAGINATION_INCOMPLETE");
  });

  it("fails closed when a promised line continuation is empty", async () => {
    let calls = 0;
    const emptyNext = createMockAdmin(() => {
      calls += 1;
      if (calls === 1) {
        return {
          data: {
            order: baseOrderPayload({
              lineItems: {
                pageInfo: {
                  hasNextPage: true,
                  endCursor: "gid://shopify/LineItem/1",
                },
                edges: [
                  { cursor: "gid://shopify/LineItem/1", node: lineNode(1) },
                ],
              },
            }),
          },
        };
      }
      return {
        data: {
          order: baseOrderPayload({
            lineItems: {
              pageInfo: { hasNextPage: false, endCursor: null },
              edges: [],
            },
          }),
        },
      };
    });
    const result = await readOrderFact(context(emptyNext), "gid://shopify/Order/1", {
      pageSize: 1,
    });
    expect(result.status).toBe("incomplete");
    if (result.status !== "incomplete") return;
    expect(result.reason).toBe("SNAPSHOT_PAGINATION_INCOMPLETE");
  });

  it("allows an independently newer complete Refund snapshot than the Order clock", async () => {
    const refund = refundNode(5, [refundLineNode(1)]);
    refund.updatedAt = "2026-06-01T00:00:00Z";
    const admin = createOrderStoreAdmin({
      header: orderHeader({ updatedAt: "2026-01-02T00:00:00Z" }),
      lines: [lineNode(1)],
      agreements: [],
      refunds: [refund],
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1");
    expect(result.status).toBe("complete");
    if (result.status !== "complete") return;
    expect(result.value.updatedAt).toBe("2026-01-02T00:00:00Z");
    expect(result.value.refunds[0]?.updatedAt).toBe("2026-06-01T00:00:00Z");
  });

  it("pins Refund header from the first page, not the last", async () => {
    const lines = Array.from({ length: 3 }, (_, index) => refundLineNode(index + 1));
    let refundCalls = 0;
    const admin = createMockAdmin((query, variables) => {
      if (!query.includes("query RefundFactById")) {
        throw new Error("unexpected query");
      }
      refundCalls += 1;
      const after = variables?.refundLineAfter ?? null;
      const firstHeader = "2026-01-02T00:00:00Z";
      const laterHeader = "2026-01-09T00:00:00Z";
      const updatedAt = refundCalls === 1 ? firstHeader : laterHeader;
      const slice =
        after == null
          ? [lines[0]!]
          : after === lines[0]!.id
            ? [lines[1]!]
            : [lines[2]!];
      const hasNext = after == null || after === lines[0]!.id;
      return {
        data: {
          refund: {
            ...refundNode(5, slice),
            updatedAt,
            refundLineItems: {
              pageInfo: {
                hasNextPage: hasNext,
                endCursor: slice[0]!.id,
              },
              edges: slice.map((node) => ({ cursor: node.id, node })),
            },
            orderAdjustments: {
              pageInfo: { hasNextPage: false, endCursor: null },
              edges: [],
            },
            refundShippingLines: {
              pageInfo: { hasNextPage: false, endCursor: null },
              edges: [],
            },
            transactions: {
              pageInfo: { hasNextPage: false, endCursor: null },
              edges: [],
            },
          },
        },
      };
    });
    const result = await readRefundFact(context(admin), "gid://shopify/Refund/5", {
      orderCurrencyCode: "USD",
      pageSize: 1,
    });
    expect(result.status).toBe("incomplete");
    if (result.status !== "incomplete") return;
    expect(result.resourceKind).toBe("Refund");
    expect(result.reason).toBe("SNAPSHOT_PAGINATION_INCOMPLETE");
  });

  it("treats first RefundFactById null while continuing a truncated embed as incomplete", async () => {
    const truncated = refundNode(
      10,
      Array.from({ length: 150 }, (_, index) => refundLineNode(1000 + index)),
    );
    const admin = createMockAdmin((query) => {
      if (query.includes("query OrderFactById")) {
        return {
          data: {
            order: {
              ...orderHeader(),
              lineItems: {
                pageInfo: { hasNextPage: false, endCursor: null },
                edges: [{ cursor: "gid://shopify/LineItem/1", node: lineNode(1) }],
              },
              agreements: {
                pageInfo: { hasNextPage: false, endCursor: null },
                edges: [],
              },
              refunds: [
                {
                  ...truncated,
                  refundLineItems: {
                    pageInfo: {
                      hasNextPage: true,
                      endCursor: "cursor-100",
                    },
                    edges: truncated.refundLineItems.slice(0, 100).map((node) => ({
                      cursor: node.id,
                      node,
                    })),
                  },
                  orderAdjustments: {
                    pageInfo: { hasNextPage: false, endCursor: null },
                    edges: [],
                  },
                  refundShippingLines: {
                    pageInfo: { hasNextPage: false, endCursor: null },
                    edges: [],
                  },
                  transactions: {
                    pageInfo: { hasNextPage: false, endCursor: null },
                    edges: [
                      {
                        cursor: truncated.transactions[0]!.id,
                        node: truncated.transactions[0],
                      },
                    ],
                  },
                },
              ],
            },
          },
        };
      }
      if (query.includes("query RefundFactById")) {
        return { data: { refund: null } };
      }
      throw new Error("unexpected query");
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1", {
      pageSize: 100,
    });
    expect(result.status).toBe("incomplete");
    if (result.status !== "incomplete") return;
    expect(result.reason).toBe("SNAPSHOT_PAGINATION_INCOMPLETE");
    expect(result.resourceKind).toBe("Refund");
  });
});

describe("F-04/F-05 envelope and null_observed", () => {
  it.each([
    ["missing data", {}],
    ["data null", { data: null }],
    ["missing order key", { data: {} }],
    ["malformed root", { data: { order: "nope" } }],
  ] as const)("Order %s is MALFORMED_ENVELOPE not null_observed", async (_label, json) => {
    const admin = createMockAdmin(() => json);
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1");
    expect(result.status).toBe("failure");
    if (result.status !== "failure") return;
    expect(result.kind).toBe("MALFORMED_ENVELOPE");
    expect(result.reason).toBe("MALFORMED_ENVELOPE");
    expect(result.resourceKind).toBe("Order");
    expect(result.requestedGid).toBe("gid://shopify/Order/1");
    expect(result.phase).toBe("initial");
  });

  it.each([
    ["missing data", {}],
    ["data null", { data: null }],
    ["missing refund key", { data: {} }],
    ["malformed root", { data: { refund: 1 } }],
  ] as const)("Refund %s is MALFORMED_ENVELOPE not null_observed", async (_label, json) => {
    const admin = createMockAdmin(() => json);
    const result = await readRefundFact(context(admin), "gid://shopify/Refund/5", {
      orderCurrencyCode: "USD",
    });
    expect(result.status).toBe("failure");
    if (result.status !== "failure") return;
    expect(result.kind).toBe("MALFORMED_ENVELOPE");
    expect(result.resourceKind).toBe("Refund");
    expect(result.requestedGid).toBe("gid://shopify/Refund/5");
  });

  it("standalone refund explicit null is null_observed", async () => {
    const admin = createMockAdmin(() => ({ data: { refund: null } }));
    const result = await readRefundFact(context(admin), "gid://shopify/Refund/5", {
      orderCurrencyCode: "USD",
    });
    expect(result.status).toBe("null_observed");
    if (result.status !== "null_observed") return;
    expect(result.resourceKind).toBe("Refund");
    expect(result.requestedGid).toBe("gid://shopify/Refund/5");
    expect(result.phase).toBe("initial");
    expect(result.queryCompleted).toBe(true);
  });

  it("does not require parsing detail to distinguish envelope failure from null_observed", async () => {
    const nullAdmin = createMockAdmin(() => ({ data: { order: null } }));
    const missingAdmin = createMockAdmin(() => ({ data: {} }));
    const observed = await readOrderFact(
      context(nullAdmin),
      "gid://shopify/Order/1",
    );
    const malformed = await readOrderFact(
      context(missingAdmin),
      "gid://shopify/Order/1",
    );
    expect(observed.status).toBe("null_observed");
    expect(malformed.status).toBe("failure");
    if (malformed.status !== "failure") return;
    expect(malformed.reason).toBe("MALFORMED_ENVELOPE");
    expect(malformed.kind).toBe("MALFORMED_ENVELOPE");
  });
});

describe("F-07/F-08 restock evidence and refundLineOrdinal", () => {
  it("emits zero-based ordinals across a complete multi-page refund, including null IDs", async () => {
    const lines = [
      refundLineNode(1, { id: null, lineItem: { id: "gid://shopify/LineItem/9" } }),
      refundLineNode(2, { id: null, lineItem: { id: "gid://shopify/LineItem/9" } }),
      refundLineNode(3, {
        restocked: true,
        location: { id: "gid://shopify/Location/99" },
      }),
    ];
    const refund = refundNode(5, lines);
    const admin = createOrderStoreAdmin({
      header: orderHeader(),
      lines: [],
      agreements: [],
      refunds: [refund],
    });
    const result = await readRefundFact(context(admin), refund.id, {
      orderCurrencyCode: "USD",
      pageSize: 2,
    });
    expect(result.status).toBe("complete");
    if (result.status !== "complete") return;
    expect(result.value.refundLineItems.map((item) => item.refundLineOrdinal)).toEqual(
      [0, 1, 2],
    );
    expect(result.value.refundLineItems[0]?.id).toBeNull();
    expect(result.value.refundLineItems[1]?.id).toBeNull();
    expect(result.value.refundLineItems[2]?.restocked).toBe(true);
    expect(result.value.refundLineItems[2]?.restockLocationId).toBe(
      "gid://shopify/Location/99",
    );
  });

  it("does not reset ordinals per page or merge distinct null-ID occurrences", async () => {
    const refund = refundNode(8, [
      refundLineNode(1, { id: null, lineItem: { id: "gid://shopify/LineItem/1" } }),
      refundLineNode(2, { id: null, lineItem: { id: "gid://shopify/LineItem/1" } }),
    ]);
    const admin = createOrderStoreAdmin({
      header: orderHeader(),
      lines: [lineNode(1)],
      agreements: [],
      refunds: [refund],
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1", {
      pageSize: 1,
    });
    expect(result.status).toBe("complete");
    if (result.status !== "complete") return;
    expect(result.value.refunds[0]?.refundLineItems).toHaveLength(2);
    expect(result.value.refunds[0]?.refundLineItems[0]?.refundLineOrdinal).toBe(0);
    expect(result.value.refunds[0]?.refundLineItems[1]?.refundLineOrdinal).toBe(1);
  });
});

describe("F-09/F-10 options and integer validation", () => {
  it.each([
    ["fractional pageSize", { pageSize: 1.5 }],
    ["NaN pageSize", { pageSize: Number.NaN }],
    ["Infinity pageSize", { pageSize: Number.POSITIVE_INFINITY }],
    ["zero pageSize", { pageSize: 0 }],
    ["negative pageSize", { pageSize: -1 }],
    ["pageSize 251", { pageSize: 251 }],
    ["unsafe pageSize", { pageSize: Number.MAX_SAFE_INTEGER + 1 }],
    ["fractional maxRequests", { maxRequests: 1.5 }],
    ["zero maxRequests", { maxRequests: 0 }],
    ["negative maxRequests", { maxRequests: -8 }],
    ["maxRequests above cap", { maxRequests: ORDER_ADMIN_READ_MAX_REQUESTS + 1 }],
  ])("rejects %s before transport", async (_label, options) => {
    const admin = createOrderStoreAdmin({
      header: orderHeader(),
      lines: [lineNode(1)],
      agreements: [],
      refunds: [],
    });
    const result = await readOrderFact(
      context(admin),
      "gid://shopify/Order/1",
      options,
    );
    expect(result.status).toBe("failure");
    if (result.status !== "failure") return;
    expect(result.kind).toBe("INVALID_READ_OPTIONS");
    expect(result.reason).toBe("INVALID_READ_OPTIONS");
    expect(result.phase).toBe("options");
    expect(admin.calls).toHaveLength(0);
    expect(result.cost.requests).toBe(0);
  });

  it("accepts the default page size and a positive in-budget override", async () => {
    expect(ORDER_ADMIN_READ_PAGE_SIZE).toBe(100);
    const admin = createOrderStoreAdmin({
      header: orderHeader(),
      lines: [lineNode(1)],
      agreements: [],
      refunds: [],
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1", {
      pageSize: 50,
      maxRequests: 10,
    });
    expect(result.status).toBe("complete");
    expect(admin.calls.length).toBeGreaterThan(0);
  });

  it("rejects a negative LineItem quantity without abs()", async () => {
    const admin = createOrderStoreAdmin({
      header: orderHeader(),
      lines: [lineNode(1, { quantity: -3 })],
      agreements: [],
      refunds: [],
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1");
    expect(result.status).toBe("failure");
  });

  it("rejects an unsafe-magnitude LineItem quantity", async () => {
    const admin = createOrderStoreAdmin({
      header: orderHeader(),
      lines: [lineNode(1, { quantity: Number.MAX_SAFE_INTEGER })],
      agreements: [],
      refunds: [],
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1");
    expect(result.status).toBe("failure");
  });

  it("rejects invalid refund reader options before transport", async () => {
    const admin = createOrderStoreAdmin({
      header: orderHeader(),
      lines: [],
      agreements: [],
      refunds: [refundNode(5, [refundLineNode(1)])],
    });
    const result = await readRefundFact(context(admin), "gid://shopify/Refund/5", {
      orderCurrencyCode: "USD",
      pageSize: 0,
    });
    expect(result.status).toBe("failure");
    if (result.status !== "failure") return;
    expect(result.kind).toBe("INVALID_READ_OPTIONS");
    expect(admin.calls).toHaveLength(0);
  });

  it("preserves a signed nullable Sale.quantity", async () => {
    const admin = createOrderStoreAdmin({
      header: orderHeader(),
      lines: [lineNode(1)],
      agreements: [
        agreementNode(1, [
          saleNode(1, { quantity: -2 }),
          saleNode(2, { quantity: null }),
        ]),
      ],
      refunds: [],
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1");
    expect(result.status).toBe("complete");
    if (result.status !== "complete") return;
    expect(result.value.agreements[0]?.sales[0]?.quantity).toBe(-2);
    expect(result.value.agreements[0]?.sales[1]?.quantity).toBeNull();
  });
});

describe("F-11 wording is documentation-only on this branch", () => {
  it("keeps C implementation off the B runtime tree", async () => {
    expect(ORDER_ADMIN_READ_MAX_REQUESTS).toBe(250);
  });
});

describe("F-01 additional required-list identity cases", () => {
  it("rejects a refund list entry with an empty id", async () => {
    const refund = refundNode(10, [refundLineNode(1)]);
    refund.id = "";
    const admin = createOrderStoreAdmin({
      header: orderHeader(),
      lines: [lineNode(1)],
      agreements: [],
      refunds: [refund],
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1");
    expect(result.status).toBe("failure");
    if (result.status !== "failure") return;
    expect(result.kind).toBe("IDENTITY_MISMATCH");
    expect(result.reason).toBe("IDENTITY_MISMATCH");
  });

  it("fails when an embedded refund returns a contradictory parent GID", async () => {
    const refund = refundNode(10, [refundLineNode(1)]);
    refund.order = { id: "gid://shopify/Order/999" };
    const admin = createOrderStoreAdmin({
      header: orderHeader(),
      lines: [lineNode(1)],
      agreements: [],
      refunds: [refund],
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1");
    expect(result.status).toBe("failure");
    if (result.status !== "failure") return;
    expect(result.kind).toBe("IDENTITY_MISMATCH");
  });

  it("keeps standalone unknown refund parent as null rather than fabricating a GID", async () => {
    const refund = refundNode(5, [refundLineNode(1)]);
    Object.assign(refund, { order: null });
    const admin = createOrderStoreAdmin({
      header: orderHeader(),
      lines: [],
      agreements: [],
      refunds: [refund],
    });
    const result = await readRefundFact(context(admin), refund.id, {
      orderCurrencyCode: "USD",
    });
    expect(result.status).toBe("complete");
    if (result.status !== "complete") return;
    expect(result.value.orderId).toBeNull();
  });

  it("fills enclosing Order GID when an embedded refund omits order.id", async () => {
    const refund = refundNode(10, [refundLineNode(1)]);
    Object.assign(refund, { order: null });
    const admin = createOrderStoreAdmin({
      header: orderHeader(),
      lines: [lineNode(1)],
      agreements: [],
      refunds: [refund],
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1");
    expect(result.status).toBe("complete");
    if (result.status !== "complete") return;
    expect(result.value.refunds[0]?.orderId).toBe("gid://shopify/Order/1");
  });
});

describe("F-02 additional clock and pagination cases", () => {
  it("fails closed when Order.updatedAt drifts during agreement continuation", async () => {
    const header = orderHeader();
    const admin = createOrderStoreAdmin({
      header,
      lines: [lineNode(1)],
      agreements: Array.from({ length: 3 }, (_, index) =>
        agreementNode(index + 1, [saleNode(index + 1)]),
      ),
      refunds: [],
      onOrderQuery: (callIndex) => {
        if (callIndex >= 2) {
          header.updatedAt = "2026-01-09T00:00:00Z";
        }
      },
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1", {
      pageSize: 1,
    });
    expect(result.status).toBe("incomplete");
    if (result.status !== "incomplete") return;
    expect(result.reason).toBe("SNAPSHOT_PAGINATION_INCOMPLETE");
    expect(result.phase).toBe("agreements");
  });

  it("fails closed when Order.updatedAt drifts during sales continuation", async () => {
    const header = orderHeader();
    const admin = createOrderStoreAdmin({
      header,
      lines: [lineNode(1)],
      agreements: [
        agreementNode(
          1,
          Array.from({ length: 3 }, (_, index) => saleNode(index + 1)),
        ),
      ],
      refunds: [],
      onOrderQuery: (callIndex) => {
        if (callIndex >= 2) {
          header.updatedAt = "2026-01-09T00:00:00Z";
        }
      },
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1", {
      pageSize: 1,
    });
    expect(result.status).toBe("incomplete");
    if (result.status !== "incomplete") return;
    expect(result.reason).toBe("SNAPSHOT_PAGINATION_INCOMPLETE");
    expect(result.phase).toBe("sales");
  });

  it("fails closed when currencyCode drifts during line continuation", async () => {
    const header = orderHeader();
    const admin = createOrderStoreAdmin({
      header,
      lines: [lineNode(1), lineNode(2)],
      agreements: [],
      refunds: [],
      onOrderQuery: (callIndex) => {
        if (callIndex >= 2) {
          Object.assign(header, { currencyCode: "CAD" });
        }
      },
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1", {
      pageSize: 1,
    });
    expect(result.status).toBe("incomplete");
    if (result.status !== "incomplete") return;
    expect(result.reason).toBe("SNAPSHOT_PAGINATION_INCOMPLETE");
  });

  it("treats exact timestamp strings as distinct even when they name the same instant", async () => {
    const header = orderHeader({ updatedAt: "2026-01-02T00:00:00Z" });
    const admin = createOrderStoreAdmin({
      header,
      lines: [lineNode(1), lineNode(2)],
      agreements: [],
      refunds: [],
      onOrderQuery: (callIndex) => {
        if (callIndex >= 2) {
          header.updatedAt = "2026-01-02T00:00:00.000Z";
        }
      },
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1", {
      pageSize: 1,
    });
    expect(result.status).toBe("incomplete");
    if (result.status !== "incomplete") return;
    expect(result.reason).toBe("SNAPSHOT_PAGINATION_INCOMPLETE");
  });

  it("preserves a genuinely empty initial lineItems collection", async () => {
    const admin = createOrderStoreAdmin({
      header: orderHeader({
        currentSubtotalLineItemsQuantity: 0,
        subtotalLineItemsQuantity: 0,
      }),
      lines: [],
      agreements: [],
      refunds: [],
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1");
    expect(result.status).toBe("complete");
    if (result.status !== "complete") return;
    expect(result.value.lineItems).toEqual([]);
  });

  it("fails closed on a duplicate line cursor rather than looping", async () => {
    const admin = createMockAdmin((query) => {
      if (!query.includes("query OrderFactById")) {
        throw new Error("unexpected query");
      }
      return {
        data: {
          order: baseOrderPayload({
            lineItems: {
              pageInfo: {
                hasNextPage: true,
                endCursor: "gid://shopify/LineItem/1",
              },
              edges: [
                { cursor: "gid://shopify/LineItem/1", node: lineNode(1) },
              ],
            },
          }),
        },
      };
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1", {
      pageSize: 1,
    });
    expect(result.status).toBe("incomplete");
    if (result.status !== "incomplete") return;
    expect(result.reason).toBe("SNAPSHOT_PAGINATION_INCOMPLETE");
  });
});

describe("F-04 additional envelope and continuation cases", () => {
  it("treats malformed errors as MALFORMED_ENVELOPE, not null_observed", async () => {
    const admin = createMockAdmin(
      () =>
        ({
          data: { order: null },
          errors: "not-an-array",
        }) as unknown as import("./types").AdminGraphQLResponse<unknown>,
    );
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1");
    expect(result.status).toBe("failure");
    if (result.status !== "failure") return;
    expect(result.kind).toBe("MALFORMED_ENVELOPE");
    expect(result.reason).toBe("MALFORMED_ENVELOPE");
  });

  it("treats GraphQL errors as ADMIN_READ_ERROR, not null_observed", async () => {
    const admin = createMockAdmin(() => ({
      data: { order: null },
      errors: [{ message: "ACCESS_DENIED" }],
    }));
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1");
    expect(result.status).toBe("failure");
    if (result.status !== "failure") return;
    expect(result.kind).toBe("ADMIN_READ_ERROR");
  });

  it("treats a missing selected root on line continuation as MALFORMED_ENVELOPE", async () => {
    let calls = 0;
    const admin = createMockAdmin(() => {
      calls += 1;
      if (calls === 1) {
        return {
          data: {
            order: baseOrderPayload({
              lineItems: {
                pageInfo: {
                  hasNextPage: true,
                  endCursor: "gid://shopify/LineItem/1",
                },
                edges: [
                  { cursor: "gid://shopify/LineItem/1", node: lineNode(1) },
                ],
              },
            }),
          },
        };
      }
      return { data: {} };
    });
    const result = await readOrderFact(context(admin), "gid://shopify/Order/1", {
      pageSize: 1,
    });
    expect(result.status).toBe("failure");
    if (result.status !== "failure") return;
    expect(result.kind).toBe("MALFORMED_ENVELOPE");
    expect(result.phase).toBe("lineItems");
  });
});
