/**
 * Issue #80: the refusal a merchant sees when warehouse receiving is off says
 * what happened to the scan, and names no switch or internal component.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";

const db = {
  shopifyVariantCache: { findFirst: vi.fn() },
  purchaseOrder: { findFirst: vi.fn() },
};
const receivePartialPO = vi.fn();

vi.mock("../tenant/require-admin-tenant.server", () => ({
  requireAdminTenant: vi.fn(async () => ({ db })),
}));
vi.mock("../services/landed-cost.server", () => ({
  receivePartialPO,
  recordLeadTimeSnapshot: vi.fn(),
}));

const { action } = await import("../routes/app.warehouse");

function scan(): ActionFunctionArgs {
  const body = new URLSearchParams({
    intent: "scan",
    poId: "po-1",
    barcode: "0001",
  });
  return {
    request: new Request("https://app.example/app/warehouse", {
      method: "POST",
      body,
    }),
    params: {},
    context: {},
  } as unknown as ActionFunctionArgs;
}

describe("warehouse scan with receiving switched off", () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.FEATURE_RECEIPT_WRITES;
    delete process.env.FEATURE_RECEIPT_WRITES;
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.FEATURE_RECEIPT_WRITES;
    else process.env.FEATURE_RECEIPT_WRITES = saved;
    vi.restoreAllMocks();
  });

  it("tells the merchant the scan was not recorded, in merchant words", async () => {
    const result = (await action(scan())) as { error: string };

    expect(result.error).toBe(
      "Adding received stock to Shopify inventory is not turned on for this store yet. The scan was not recorded and Shopify inventory is unchanged.",
    );
    expect(result.error).not.toMatch(/FEATURE_|ledger|write path|gated/i);
    expect(db.shopifyVariantCache.findFirst).not.toHaveBeenCalled();
    expect(receivePartialPO).not.toHaveBeenCalled();
  });
});
