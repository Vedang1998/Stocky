import { describe, expect, it } from "vitest";
import { describeUnsettled, type SettleResult } from "./settle.server";
import type {
  InventoryOperationResult,
  InventoryOperationStatus,
} from "./types";

function unsettled(
  status: InventoryOperationStatus,
  extra: Partial<InventoryOperationResult> = {},
  outstanding = 0,
): SettleResult {
  return {
    settled: false,
    operation: {
      operationId: "op-1",
      idempotencyKey: "Stocktake:st-1:1",
      kind: "STOCKTAKE",
      status,
      lineCount: 5,
      appliedLineCount: 0,
      failedLineCount: 0,
      conflictLineCount: 0,
      lastErrorCode: null,
      lastErrorMessage: null,
      completedAt: null,
      lines: [],
      ...extra,
    },
    outstanding: Array.from({ length: outstanding }, (_, index) => ({
      inventoryItemId: `gid://shopify/InventoryItem/${index}`,
      variantId: null,
      locationId: "gid://shopify/Location/11",
      delta: 1,
      changeFromQuantity: null,
    })),
  };
}

const STANDING = "The count stays open.";

describe("describeUnsettled", () => {
  it("does not say where the document stands while another request may be settling it", () => {
    const message = describeUnsettled(unsettled("APPLYING"), STANDING);

    expect(message).toBe(
      "These changes are being sent to Shopify right now, possibly by another request. Changes Shopify has confirmed are not sent twice. Reload the page in a moment to see the result, and try again if anything is left.",
    );
    expect(message).not.toContain(STANDING);
  });

  it.each([
    [
      "an attempt that will be retried",
      unsettled("RETRY_PENDING"),
      "Shopify has not confirmed every change yet. Lines already confirmed are recorded and will not be sent again. Try again in a moment.",
    ],
    [
      "an attempt stopped by the kill switch",
      unsettled("RETRY_PENDING", {
        lastErrorCode: "WRITE_CAPABILITY_DISABLED",
      }),
      "Inventory changes were switched off part-way through. Lines already confirmed by Shopify are recorded; try again once changes are enabled.",
    ],
    [
      "changes that were never sent because writes are off",
      unsettled("BLOCKED"),
      "Inventory changes are switched off for this app, so nothing was sent to Shopify.",
    ],
    [
      "changes Shopify refused",
      unsettled("PARTIALLY_APPLIED", {
        appliedLineCount: 3,
        failedLineCount: 1,
        conflictLineCount: 1,
      }),
      "Shopify did not accept 2 of 5 changes. Lines it accepted are recorded and will not be sent again.",
    ],
    [
      "a document larger than one operation",
      unsettled("APPLIED", { appliedLineCount: 5 }, 3),
      "Shopify confirmed these changes, but 3 more remain to be sent. Try again to send the rest; confirmed changes are not sent twice.",
    ],
    [
      "a call that executed nothing",
      { settled: false, operation: null, outstanding: [] } as SettleResult,
      "Shopify has not confirmed every change yet. Try again.",
    ],
  ])(
    "explains %s and says where the document stands",
    (_label, result, text) => {
      expect(describeUnsettled(result, STANDING)).toBe(`${text} ${STANDING}`);
      expect(describeUnsettled(result)).toBe(text);
    },
  );
});
