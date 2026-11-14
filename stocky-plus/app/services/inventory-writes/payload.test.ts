import { describe, expect, it } from "vitest";
import { InventoryOperationValidationError } from "./errors";
import {
  inventoryOperationPayloadDigest,
  MAX_ABS_QUANTITY,
  MAX_OPERATION_LINES,
  normalizeInventoryOperationDraft,
} from "./payload";
import type { InventoryOperationDraft } from "./types";

const ITEM = "gid://shopify/InventoryItem/101";
const ITEM_2 = "gid://shopify/InventoryItem/102";
const LOCATION = "gid://shopify/Location/11";

function draft(
  overrides: Partial<InventoryOperationDraft> = {},
): InventoryOperationDraft {
  return {
    kind: "ADJUSTMENT",
    idempotencyKey: "adjustment:abc123",
    source: { type: "InventoryAdjustment", id: "abc123" },
    reason: "correction",
    quantityName: "available",
    referenceDocumentUri: null,
    actor: { shopifyUserId: "42", displayName: null, channel: "ADMIN" },
    note: null,
    lines: [
      {
        inventoryItemId: ITEM,
        variantId: "gid://shopify/ProductVariant/201",
        locationId: LOCATION,
        delta: 5,
        changeFromQuantity: 10,
      },
    ],
    ...overrides,
  };
}

function issuesOf(input: InventoryOperationDraft): readonly string[] {
  try {
    normalizeInventoryOperationDraft(input);
  } catch (err) {
    if (err instanceof InventoryOperationValidationError) return err.issues;
    throw err;
  }
  return [];
}

describe("normalizeInventoryOperationDraft", () => {
  it("derives the kill-switch capability from the kind", () => {
    const capabilities = (
      ["ADJUSTMENT", "STOCKTAKE", "RECEIPT", "TRANSFER"] as const
    ).map(
      (kind) => normalizeInventoryOperationDraft(draft({ kind })).capability,
    );
    expect(capabilities).toEqual([
      "adjustmentWrites",
      "stocktakeInventoryWrites",
      "receiptWrites",
      "transferWrites",
    ]);
  });

  it("trims optional text and stores blank text as null", () => {
    const normalized = normalizeInventoryOperationDraft(
      draft({
        note: "  recount after delivery  ",
        referenceDocumentUri: "   ",
        actor: {
          shopifyUserId: "42",
          displayName: "  Sam  ",
          channel: "ADMIN",
        },
      }),
    );
    expect(normalized.note).toBe("recount after delivery");
    expect(normalized.referenceDocumentUri).toBeNull();
    expect(normalized.actor.displayName).toBe("Sam");
    expect(normalized.reversesOperationId).toBeNull();
  });

  it("marks a draft built for a reversal as REVERSAL gated by the original kind", () => {
    const normalized = normalizeInventoryOperationDraft(
      draft({ kind: "STOCKTAKE" }),
      "op_original",
    );
    expect(normalized.kind).toBe("REVERSAL");
    expect(normalized.capability).toBe("stocktakeInventoryWrites");
    expect(normalized.reversesOperationId).toBe("op_original");
  });

  it("reports every problem at once", () => {
    const issues = issuesOf(
      draft({
        kind: "RESTOCK" as never,
        idempotencyKey: "has spaces",
        source: { type: "9bad", id: "" },
        reason: "because" as never,
        quantityName: "on_hand" as never,
        referenceDocumentUri: "not a uri",
        lines: [
          {
            inventoryItemId: "gid://shopify/Product/1",
            variantId: "201",
            locationId: "11",
            delta: 0,
            changeFromQuantity: 1.5,
          },
        ],
      }),
    );
    expect(issues).toEqual([
      "Unsupported operation kind: RESTOCK",
      "idempotencyKey must be 1-200 characters of letters, digits and : . _ - /",
      "source.type must be an identifier of at most 64 characters",
      "source.id must be 1-191 characters",
      "Unsupported Shopify inventory reason: because",
      "Unsupported quantity name: on_hand",
      "referenceDocumentUri must be a URI",
      "Line 1: inventoryItemId must be a Shopify InventoryItem GID",
      "Line 1: locationId must be a Shopify Location GID",
      "Line 1: variantId must be a Shopify ProductVariant GID or null",
      "Line 1: delta must be a non-zero whole number",
      "Line 1: changeFromQuantity must be a whole number or null",
    ]);
  });

  it("rejects fractional, non-finite and out-of-range deltas", () => {
    for (const delta of [
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      MAX_ABS_QUANTITY + 1,
      "5",
    ]) {
      const issues = issuesOf(
        draft({
          lines: [
            {
              inventoryItemId: ITEM,
              variantId: null,
              locationId: LOCATION,
              delta: delta as number,
              changeFromQuantity: null,
            },
          ],
        }),
      );
      expect(issues).toEqual(["Line 1: delta must be a non-zero whole number"]);
    }
  });

  it("rejects two lines for the same item and location", () => {
    const line = {
      inventoryItemId: ITEM,
      variantId: null,
      locationId: LOCATION,
      delta: 1,
      changeFromQuantity: null,
    };
    expect(issuesOf(draft({ lines: [line, { ...line, delta: 2 }] }))).toEqual([
      "Line 2: duplicates another line for the same item and location",
    ]);
  });

  it("requires at least one line and caps the line count", () => {
    expect(issuesOf(draft({ lines: [] }))).toEqual([
      "At least one line is required",
    ]);

    const tooMany = Array.from({ length: MAX_OPERATION_LINES + 1 }, (_, i) => ({
      inventoryItemId: `gid://shopify/InventoryItem/${i + 1}`,
      variantId: null,
      locationId: LOCATION,
      delta: 1,
      changeFromQuantity: null,
    }));
    expect(issuesOf(draft({ lines: tooMany }))).toEqual([
      `At most ${MAX_OPERATION_LINES} lines are allowed per operation`,
    ]);
  });

  it("requires a verified staff user for admin and POS writes but not system writes", () => {
    expect(
      issuesOf(
        draft({
          actor: { shopifyUserId: null, displayName: null, channel: "ADMIN" },
        }),
      ),
    ).toEqual(["Staff writes require a verified Shopify user"]);
    expect(
      issuesOf(
        draft({
          actor: { shopifyUserId: null, displayName: null, channel: "POS" },
        }),
      ),
    ).toEqual(["Staff writes require a verified Shopify user"]);
    expect(
      issuesOf(
        draft({
          actor: { shopifyUserId: null, displayName: null, channel: "SYSTEM" },
        }),
      ),
    ).toEqual([]);
    expect(
      issuesOf(
        draft({
          actor: {
            shopifyUserId: "user@example.com",
            displayName: null,
            channel: "ADMIN",
          },
        }),
      ),
    ).toEqual(["actor.shopifyUserId must be a numeric Shopify user ID"]);
  });
});

describe("inventoryOperationPayloadDigest", () => {
  const base = () => normalizeInventoryOperationDraft(draft());

  it("is stable for the same change", () => {
    expect(inventoryOperationPayloadDigest(base())).toBe(
      inventoryOperationPayloadDigest(base()),
    );
    expect(inventoryOperationPayloadDigest(base())).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ignores who submitted it and the free-text note", () => {
    const resubmitted = normalizeInventoryOperationDraft(
      draft({
        actor: { shopifyUserId: "77", displayName: "Other", channel: "POS" },
        note: "second try",
      }),
    );
    expect(inventoryOperationPayloadDigest(resubmitted)).toBe(
      inventoryOperationPayloadDigest(base()),
    );
  });

  it("changes when anything Shopify would apply differently changes", () => {
    const line = draft().lines[0];
    const variants: InventoryOperationDraft[] = [
      draft({ lines: [{ ...line, delta: 6 }] }),
      draft({ lines: [{ ...line, changeFromQuantity: null }] }),
      draft({ lines: [{ ...line, changeFromQuantity: 0 }] }),
      draft({ lines: [{ ...line, inventoryItemId: ITEM_2 }] }),
      draft({ lines: [{ ...line, locationId: "gid://shopify/Location/12" }] }),
      draft({ reason: "damaged" }),
      draft({ quantityName: "damaged" }),
      draft({ kind: "STOCKTAKE" }),
      draft({ source: { type: "InventoryAdjustment", id: "other" } }),
      draft({ referenceDocumentUri: "gid://propo/InventoryAdjustment/abc123" }),
    ];
    const digests = variants.map((v) =>
      inventoryOperationPayloadDigest(normalizeInventoryOperationDraft(v)),
    );
    const original = inventoryOperationPayloadDigest(base());
    expect(digests).not.toContain(original);
    expect(new Set(digests).size).toBe(variants.length);
  });

  it("distinguishes a reversal from the forward change it mirrors", () => {
    const forward = normalizeInventoryOperationDraft(draft());
    const reversal = normalizeInventoryOperationDraft(draft(), "op_original");
    expect(inventoryOperationPayloadDigest(reversal)).not.toBe(
      inventoryOperationPayloadDigest(forward),
    );
  });
});
