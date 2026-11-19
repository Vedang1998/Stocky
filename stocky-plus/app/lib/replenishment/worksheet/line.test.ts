import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildWorksheetLine, type LineContext, type LineFacts } from "./line";
import type { SupplierTerms } from "./sources";

const CONTEXT: LineContext = {
  params: { method: "LAST_X_DAYS", sampleDays: 30, suggestDays: 30 },
  salesWindow: { start: "2026-10-11", end: "2026-11-09", days: 30 },
  coverage: { kind: "FULL" },
  asOf: "2026-11-10",
  incomingSource: "SHOPIFY_INCOMING",
  rounding: { applyMinimumOrderQuantity: false, roundUpToPackSize: false },
  shopLeadTimeDays: null,
};

const ACME: SupplierTerms = {
  supplierId: "sup_acme",
  supplierName: "Acme Wines",
  currency: "USD",
  vendorSku: "ACME-MER-750",
  moq: 24,
  packSize: 12,
  supplierCost: "8.50",
  isPreferred: true,
  leadTimeDays: 7,
  leadTimeSource: "supplier_default",
};

function facts(overrides: Partial<LineFacts> = {}): LineFacts {
  return {
    variant: {
      variantGid: "gid://shopify/ProductVariant/1",
      productGid: "gid://shopify/Product/1",
      productTitle: "Merlot",
      variantTitle: "750 ml",
      sku: "MER-750",
      barcode: "0001",
      vendor: "Acme",
      productType: "Wine",
      priceAmount: new Prisma.Decimal("19.99"),
      priceCurrencyCode: "USD",
      unitCost: new Prisma.Decimal("9.25"),
      unitCostCurrencyCode: "USD",
      tracked: true,
    },
    imageUrl: "https://cdn.shopify.com/merlot.png",
    stock: { available: 10, onHand: 14, committed: 4, incoming: 5 },
    appIncoming: null,
    sales: { netUnits: 60, distinctOrders: 41, revenue: new Prisma.Decimal("1199.40") },
    abcClass: "A",
    rule: null,
    supplier: null,
    suppliers: [],
    ...overrides,
  };
}

describe("buildWorksheetLine", () => {
  it("computes the parity quantity from sales, stock and Shopify incoming", () => {
    const line = buildWorksheetLine(CONTEXT, facts());
    // 60 ÷ 30 × 30 = 60 forecast − (10 available + 5 incoming) = 45
    expect(line).toMatchObject({
      netUnits: 60,
      distinctOrders: 41,
      unitsPerDay: "2.0000",
      forecastDemand: "60.0000",
      availableQuantity: 10,
      onHandQuantity: 14,
      committedQuantity: 4,
      incomingQuantity: 5,
      parityQuantity: 45,
      suggestedQuantity: 45,
      finalQuantity: null,
      orderQuantity: 45,
      daysOfStock: "5.0",
      depletionDate: "2026-11-15",
      stockStatus: "OK",
      warningCodes: [],
    });
    expect(line.revenueAmount?.toString()).toBe("1199.4");
    expect(line.detail.trace.map((step) => step.key)).toContain("suggest.parity");
  });

  it("carries the shop's ABC/U class, and none when the variant is not in the run", () => {
    expect(buildWorksheetLine(CONTEXT, facts()).abcClass).toBe("A");
    expect(buildWorksheetLine(CONTEXT, facts({ abcClass: "U" })).abcClass).toBe("U");
    expect(buildWorksheetLine(CONTEXT, facts({ abcClass: null })).abcClass).toBeNull();
  });

  it("leaves supplier rules off until the run asks for them", () => {
    const off = buildWorksheetLine(CONTEXT, facts({ supplier: ACME, suppliers: [ACME] }));
    expect(off).toMatchObject({
      parityQuantity: 45,
      suggestedQuantity: 45,
      minimumOrderQuantity: 24,
      packSize: 12,
    });
    expect(off.detail.adjustments).toEqual([]);

    const on = buildWorksheetLine(
      { ...CONTEXT, rounding: { applyMinimumOrderQuantity: true, roundUpToPackSize: true } },
      facts({ supplier: ACME, suppliers: [ACME] }),
    );
    expect(on).toMatchObject({ parityQuantity: 45, suggestedQuantity: 48, orderQuantity: 48 });
    expect(on.detail.adjustments).toEqual([{ rule: "PACK_SIZE", before: 45, after: 48 }]);
  });

  it("records the supplier the row would be ordered from", () => {
    const line = buildWorksheetLine(CONTEXT, facts({ supplier: ACME, suppliers: [ACME] }));
    expect(line).toMatchObject({
      supplierId: "sup_acme",
      supplierName: "Acme Wines",
      vendorSku: "ACME-MER-750",
      supplierCostAmount: "8.50",
      supplierCostCurrencyCode: "USD",
      supplierCount: 1,
      leadTimeDays: 7,
      leadTimeSource: "SUPPLIER_DEFAULT",
    });
  });

  it("counts open purchase orders in this app when that source is chosen", () => {
    const context: LineContext = { ...CONTEXT, incomingSource: "APP_PURCHASE_ORDERS" };
    expect(buildWorksheetLine(context, facts({ appIncoming: 20 }))).toMatchObject({
      incomingQuantity: 20,
      parityQuantity: 30,
    });
    // On no open purchase order: a known zero, with no "incoming unknown" warning.
    expect(buildWorksheetLine(context, facts({ appIncoming: null }))).toMatchObject({
      incomingQuantity: 0,
      parityQuantity: 50,
      warningCodes: [],
    });
  });

  it("never adds the two incoming sources together", () => {
    const line = buildWorksheetLine(CONTEXT, facts({ appIncoming: 20 }));
    expect(line.incomingQuantity).toBe(5);
  });

  it("leaves incoming out when the run does not count it", () => {
    const line = buildWorksheetLine({ ...CONTEXT, incomingSource: "NONE" }, facts());
    expect(line).toMatchObject({ incomingQuantity: null, parityQuantity: 50, warningCodes: [] });
  });

  it("treats a variant with no sales in covered history as zero sales", () => {
    const line = buildWorksheetLine(CONTEXT, facts({ sales: null }));
    expect(line).toMatchObject({
      netUnits: 0,
      distinctOrders: 0,
      unitsPerDay: "0.0000",
      parityQuantity: 0,
      suggestedQuantity: 0,
      orderQuantity: 0,
      daysOfStock: null,
    });
    expect(line.revenueAmount?.toString()).toBe("0");
  });

  it("gives no suggestion and no sales figures when there is no order history", () => {
    const line = buildWorksheetLine(
      { ...CONTEXT, coverage: { kind: "NONE" } },
      facts({ sales: null }),
    );
    expect(line).toMatchObject({
      netUnits: null,
      distinctOrders: null,
      revenueAmount: null,
      unitsPerDay: null,
      parityQuantity: null,
      suggestedQuantity: null,
      orderQuantity: 0,
      warningCodes: ["HISTORY_UNAVAILABLE"],
    });
  });

  it("warns when history covers only part of the window", () => {
    const line = buildWorksheetLine(
      { ...CONTEXT, coverage: { kind: "PARTIAL", coveredDays: 12 } },
      facts(),
    );
    expect(line.warningCodes).toEqual(["HISTORY_PARTIAL"]);
    expect(line.parityQuantity).toBe(45);
  });

  it("gives no suggestion when stock has not been synced", () => {
    const line = buildWorksheetLine(
      CONTEXT,
      facts({ stock: { available: null, onHand: null, committed: null, incoming: null } }),
    );
    expect(line).toMatchObject({
      suggestedQuantity: null,
      orderQuantity: 0,
      stockStatus: "UNKNOWN",
      warningCodes: ["INVENTORY_UNKNOWN"],
    });
  });

  it("marks an untracked variant and suggests nothing for it", () => {
    const base = facts();
    const line = buildWorksheetLine(
      CONTEXT,
      facts({ variant: { ...base.variant, tracked: false } }),
    );
    expect(line).toMatchObject({
      tracked: false,
      suggestedQuantity: null,
      stockStatus: "UNKNOWN",
      warningCodes: ["NOT_TRACKED"],
    });
  });

  it("treats a variant with no inventory item as unknown stock, not untracked", () => {
    const base = facts();
    const line = buildWorksheetLine(
      CONTEXT,
      facts({
        variant: { ...base.variant, tracked: null },
        stock: { available: null, onHand: null, committed: null, incoming: null },
      }),
    );
    expect(line).toMatchObject({ tracked: true, warningCodes: ["INVENTORY_UNKNOWN"] });
  });

  it("uses the variant's levels for fill-shelves and reports them", () => {
    const line = buildWorksheetLine(
      { ...CONTEXT, params: { method: "FILL_SHELVES" } },
      facts({
        rule: {
          minimumQuantity: 12,
          shelfLimitQuantity: 40,
          reorderPointQuantity: null,
          safetyStockQuantity: null,
          leadTimeDays: null,
          leadTimeFromShopScope: false,
        },
      }),
    );
    // 40 shelf limit − 15 in stock = 25. Sales still feed the sales rate.
    expect(line).toMatchObject({
      parityQuantity: 25,
      forecastDemand: null,
      unitsPerDay: "2.0000",
      daysOfStock: "5.0",
    });
    expect(line.detail.levels).toEqual({
      minimumQuantity: 12,
      shelfLimitQuantity: 40,
      safetyStockQuantity: null,
      reorderPointQuantity: null,
    });
  });

  it("says which level is missing for a stock-level method", () => {
    const line = buildWorksheetLine({ ...CONTEXT, params: { method: "FILL_SHELVES" } }, facts());
    expect(line).toMatchObject({
      suggestedQuantity: null,
      warningCodes: ["SHELF_LIMIT_MISSING"],
    });
  });

  it("prefers the variant's lead time, then the supplier's, then the shop's", () => {
    const rule = {
      minimumQuantity: null,
      shelfLimitQuantity: null,
      reorderPointQuantity: null,
      safetyStockQuantity: 3,
      leadTimeDays: 4,
      leadTimeFromShopScope: false,
    };
    const context = { ...CONTEXT, shopLeadTimeDays: 21 };

    const fromRule = buildWorksheetLine(context, facts({ rule, supplier: ACME, suppliers: [ACME] }));
    // 2 per day × 4 days + 3 safety stock = 11
    expect(fromRule).toMatchObject({
      leadTimeDays: 4,
      leadTimeSource: "VARIANT_RULE",
      reorderPoint: 11,
      reorderPointSource: "AUTOMATIC",
    });

    const fromSupplier = buildWorksheetLine(context, facts({ supplier: ACME, suppliers: [ACME] }));
    expect(fromSupplier).toMatchObject({ leadTimeDays: 7, leadTimeSource: "SUPPLIER_DEFAULT" });

    const fromShop = buildWorksheetLine(context, facts());
    expect(fromShop).toMatchObject({ leadTimeDays: 21, leadTimeSource: "SHOP_DEFAULT" });
  });

  it("rounds a measured supplier lead time up to whole days", () => {
    const measured: SupplierTerms = {
      ...ACME,
      leadTimeDays: 6.2,
      leadTimeSource: "measured",
    };
    const line = buildWorksheetLine(CONTEXT, facts({ supplier: measured, suppliers: [measured] }));
    expect(line).toMatchObject({ leadTimeDays: 7, leadTimeSource: "SUPPLIER_MEASURED" });
  });

  it("flags low stock against the reorder point", () => {
    const line = buildWorksheetLine(
      { ...CONTEXT, shopLeadTimeDays: 10 },
      facts({ stock: { available: 10, onHand: 10, committed: 0, incoming: 5 } }),
    );
    // Reorder point 2 × 10 = 20; stock position 15 is at or below it.
    expect(line).toMatchObject({ reorderPoint: 20, stockStatus: "LOW" });
    expect(line.detail.lowStockReasons).toEqual([
      "Stock 15 is at or below the reorder point 20.",
    ]);
  });

  it("explains a missing lead time in the detail without a row warning", () => {
    const line = buildWorksheetLine(CONTEXT, facts());
    expect(line.warningCodes).toEqual([]);
    expect(line.reorderPoint).toBeNull();
    expect(line.detail.healthTrace.map((step) => step.text)).toContain(
      "No lead time is set, so there is no automatic reorder point.",
    );
  });

  it("stores supplier terms of zero as not set", () => {
    const loose: SupplierTerms = { ...ACME, moq: 0, packSize: 0, supplierCost: null };
    const line = buildWorksheetLine(
      { ...CONTEXT, rounding: { applyMinimumOrderQuantity: true, roundUpToPackSize: true } },
      facts({ supplier: loose, suppliers: [loose] }),
    );
    expect(line).toMatchObject({
      minimumOrderQuantity: null,
      packSize: null,
      supplierCostAmount: null,
      supplierCostCurrencyCode: null,
      suggestedQuantity: 45,
    });
    expect(line.warningCodes).toEqual(["MOQ_MISSING", "PACK_SIZE_MISSING"]);
  });

  it("lists every supplier in the detail even when none is chosen", () => {
    const other: SupplierTerms = { ...ACME, supplierId: "sup_b", supplierName: "B", isPreferred: false };
    const line = buildWorksheetLine(
      CONTEXT,
      facts({ supplier: null, suppliers: [{ ...ACME, isPreferred: false }, other] }),
    );
    expect(line).toMatchObject({ supplierId: null, supplierCount: 2, leadTimeDays: null });
    expect(line.detail.suppliers.map((terms) => terms.supplierId)).toEqual(["sup_acme", "sup_b"]);
  });
});
