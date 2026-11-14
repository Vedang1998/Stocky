/**
 * Regression test for issue #78 on the warehouse scan: with receiving off it
 * answers with a merchant-readable error. The purchase-order and supplier
 * pages (issue #77) are covered against the database in
 * app/tenant/__tests__/db-isolation/purchasing-screens.test.ts and
 * purchasing-supplier-screens.test.ts.
 */
import type { ActionFunctionArgs } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdminTenant, receivePartialPO } = vi.hoisted(() => ({
  requireAdminTenant: vi.fn(),
  receivePartialPO: vi.fn(),
}));

vi.mock("../tenant/require-admin-tenant.server", () => ({ requireAdminTenant }));

vi.mock("./shopify-gql.server", () => ({
  fetchLocations: vi.fn(async () => [
    { id: "gid://shopify/Location/1", name: "Main warehouse" },
  ]),
}));

vi.mock("./landed-cost.server", () => ({
  applyLandedCostsToPO: vi.fn(),
  receivePartialPO,
  recalculatePOLineCost: vi.fn(),
  recordLeadTimeSnapshot: vi.fn(),
  resolveTieredUnitCost: vi.fn(),
}));

// Merchant copy: no flag or environment-variable names.
const RECEIVING_OFF_COPY =
  "Receiving is turned off for this store, so nothing was received and no stock changed.";

function tenantDb() {
  return {
    shopifyVariantCache: {
      findFirst: vi.fn(),
    },
  };
}

function actionArgs(fields: Record<string, string>): ActionFunctionArgs {
  const body = new URLSearchParams(fields);
  return {
    request: new Request("https://app.example.test/app/purchase-orders", {
      method: "POST",
      body,
    }),
    params: {},
    context: {},
  } as unknown as ActionFunctionArgs;
}

describe("warehouse receiving refusal", () => {
  let db: ReturnType<typeof tenantDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    db = tenantDb();
    requireAdminTenant.mockResolvedValue({
      admin: {},
      db,
      tenant: { myshopifyDomain: "stocky-test-store.myshopify.com" },
    });
  });

  it("warehouse scan with receipt writes off returns a merchant-readable error", async () => {
    vi.stubEnv("FEATURE_RECEIPT_WRITES", "");
    const { action } = await import("../routes/app.warehouse");

    const result = await action(
      actionArgs({
        intent: "scan",
        poId: "po_0000000000000000000001",
        barcode: "0123456789012",
      }),
    );

    expect(result).toEqual({ error: RECEIVING_OFF_COPY });
    expect(db.shopifyVariantCache.findFirst).not.toHaveBeenCalled();
    expect(receivePartialPO).not.toHaveBeenCalled();
  });
});
