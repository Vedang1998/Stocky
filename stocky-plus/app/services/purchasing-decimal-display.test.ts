/**
 * Regression tests for issue #77 (Decimals rendered as NaN / [object Object])
 * on the supplier page, and for the warehouse scan's refusal while receiving
 * is off. The purchase-order pages are covered against the database in
 * app/tenant/__tests__/db-isolation/purchasing-screens.test.ts.
 *
 * Loader data must contain nothing the single-fetch encoder can flatten into a
 * shapeless object, and the route components must render money from it.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderRoute, unsafeWirePaths } from "../test-utils/render-route";

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

const VARIANT_GID = "gid://shopify/ProductVariant/101";

// Merchant copy: no flag or environment-variable names.
const RECEIVING_OFF_COPY =
  "Receiving is turned off for this store, so nothing was received and no stock changed.";

const decimal = (value: string) => new Prisma.Decimal(value);

function purchaseOrderRow() {
  return {
    id: "po_0000000000000000000001",
    poNumber: null,
    status: "ORDERED",
    currency: "USD",
    exchangeRate: decimal("1.085000"),
    freightCost: decimal("25.00"),
    customsCost: decimal("10.00"),
    landedCostMethod: "COST",
    createdAt: new Date("2026-11-10T12:00:00.000Z"),
    supplier: { id: "sup_1", name: "Acme Wholesale" },
    lineItems: [
      {
        id: "line_1",
        shopifyVariantId: VARIANT_GID,
        vendorSku: "ACME-101",
        orderedQty: 12,
        receivedQty: 0,
        unitCost: decimal("7.2500"),
        allocatedLandedCost: decimal("2.9167"),
        manualCostOverride: false,
      },
      {
        id: "line_2",
        shopifyVariantId: VARIANT_GID,
        vendorSku: null,
        orderedQty: 3,
        receivedQty: 0,
        unitCost: decimal("1.0050"),
        allocatedLandedCost: null,
        manualCostOverride: true,
      },
    ],
  };
}

function supplierRow() {
  return {
    id: "sup_1",
    name: "Acme Wholesale",
    currency: "USD",
    accountNumber: null,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    vendorNotes: null,
    leadTimeDays: null,
    skuMappings: [],
    leadTimeSnapshots: [],
    volumeTiers: [
      {
        id: "tier_1",
        variantId: VARIANT_GID,
        minQty: 10,
        maxQty: 49,
        unitCost: decimal("7.2500"),
      },
      {
        id: "tier_2",
        variantId: VARIANT_GID,
        minQty: 50,
        maxQty: null,
        unitCost: decimal("6.8125"),
      },
    ],
  };
}

const variantRows = [
  { shopifyVariantId: VARIANT_GID, title: "Cabernet 750ml", weight: decimal("1.2500") },
];

function tenantDb() {
  return {
    purchaseOrder: {
      findMany: vi.fn(async () => [purchaseOrderRow()]),
      findFirst: vi.fn(),
    },
    supplier: {
      findMany: vi.fn(async () => [supplierRow()]),
      findFirst: vi.fn(async () => supplierRow()),
    },
    shopifyVariantCache: {
      findMany: vi.fn(async () => variantRows),
      findFirst: vi.fn(),
    },
  };
}

function loaderArgs(params: Record<string, string> = {}): LoaderFunctionArgs {
  return {
    request: new Request("https://app.example.test/app"),
    params,
    context: {},
  } as unknown as LoaderFunctionArgs;
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

describe("supplier money display and warehouse receiving refusal", () => {
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

  it("supplier loader and page show volume tier costs", async () => {
    const route = await import("../routes/app.suppliers_.$id");
    const data = await route.loader(loaderArgs({ id: "sup_1" }));

    expect(unsafeWirePaths(data)).toEqual([]);
    expect(data.supplier.volumeTiers[0].unitCost).toBe("7.25");

    const html = await renderRoute(route.default, data);

    expect(html).toContain("$7.25");
    expect(html).toContain("$6.8125");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("[object Object]");
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
