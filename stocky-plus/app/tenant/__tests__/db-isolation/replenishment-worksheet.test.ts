/**
 * Replenishment worksheets under full enforcement: generation reads only the
 * shop's own facts, a saved worksheet is complete and stays inside its shop,
 * views run in the database, and a final quantity is the only editable value.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../../authority.server";
import { TENANT_DB_CONTEXT_VERSION } from "../../db-context.server";
import { createTenantDb, type TenantDb } from "../../tenant-db.server";
import { saveVariantRule } from "../../../lib/replenishment/rules.server";
import {
  generateWorksheet,
  MAX_WORKSHEET_VARIANTS,
  WORKSHEETS_KEPT,
  WorksheetError,
  type GenerateWorksheetInput,
} from "../../../lib/replenishment/worksheet/generate.server";
import type { WorksheetSettings } from "../../../lib/replenishment/worksheet/settings";
import type {
  SupplierTerms,
  VariantSuppliers,
  WorksheetSources,
} from "../../../lib/replenishment/worksheet/sources";
import {
  deleteWorksheet,
  getWorksheet,
  getWorksheetLine,
  getWorksheetTotals,
  listWorksheets,
  loadWorksheetPage,
  setFinalQuantity,
  streamWorksheetLines,
  WorksheetEditError,
  type WorksheetLine,
} from "../../../lib/replenishment/worksheet/store.server";
import type { WorksheetView } from "../../../lib/replenishment/worksheet/view";
import {
  requireRuntimeUrl,
  resetAndEnforce,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
  withRuntimePg,
} from "./helpers";

const TZ = "America/New_York";
const NOW = new Date("2026-11-10T15:00:00Z");
const OBSERVED = new Date("2026-11-09T12:00:00Z");

const MERLOT = "gid://shopify/Product/101";
const STOUT = "gid://shopify/Product/102";
const RETIRED = "gid://shopify/Product/103";
const MERLOT_750 = "gid://shopify/ProductVariant/201";
const MERLOT_1500 = "gid://shopify/ProductVariant/202";
const STOUT_CAN = "gid://shopify/ProductVariant/203";
const RETIRED_VARIANT = "gid://shopify/ProductVariant/204";
const MAIN = "gid://shopify/Location/301";
const WAREHOUSE = "gid://shopify/Location/302";
const CLOSED = "gid://shopify/Location/303";

const live = {
  existenceState: "LIVE",
  existenceKind: "LIVE_FULL_SYNC_PRESENT",
  existenceObservedAt: OBSERVED,
  sourceKind: "FULL_SYNC",
} as const;

const itemGid = (variantGid: string) => variantGid.replace("ProductVariant", "InventoryItem");

async function seedCatalog(prisma: PrismaClient, shopId: string) {
  const products = [
    { gid: MERLOT, title: "Merlot", vendor: "Acme", productType: "Wine", status: "ACTIVE" },
    { gid: STOUT, title: "Stout", vendor: "Brewco", productType: "Beer", status: "DRAFT" },
    { gid: RETIRED, title: "Retired Rosé", vendor: "Acme", productType: "Wine", status: "ARCHIVED" },
  ] as const;
  for (const product of products) {
    await prisma.shopifyProductFact.create({
      data: {
        shopId,
        shopifyGid: product.gid,
        title: product.title,
        handle: product.title.toLowerCase().replace(/\W+/g, "-"),
        tags: [],
        status: product.status,
        vendor: product.vendor,
        productType: product.productType,
        featuredMediaUrl:
          product.gid === MERLOT ? "https://cdn.shopify.com/s/files/merlot.png" : null,
        ...live,
      },
    });
  }
  const variants = [
    { gid: MERLOT_750, product: MERLOT, title: "750 ml", sku: "MER-750", price: "20.00" },
    { gid: MERLOT_1500, product: MERLOT, title: "1.5 L", sku: "MER-1500", price: "38.00" },
    { gid: STOUT_CAN, product: STOUT, title: "Default Title", sku: "STOUT-CAN", price: "4.00" },
    { gid: RETIRED_VARIANT, product: RETIRED, title: "750 ml", sku: "ROSE-750", price: "15.00" },
  ];
  for (const variant of variants) {
    await prisma.shopifyVariantFact.create({
      data: {
        shopId,
        shopifyGid: variant.gid,
        shopifyProductGid: variant.product,
        title: variant.title,
        sku: variant.sku,
        barcode: `00${variant.gid.split("/").pop()}`,
        selectedOptions: [],
        priceAmount: variant.price,
        currencyCode: "USD",
        ...live,
      },
    });
    await prisma.shopifyInventoryItemFact.create({
      data: {
        shopId,
        shopifyGid: itemGid(variant.gid),
        shopifyVariantGid: variant.gid,
        sku: variant.sku,
        tracked: true,
        requiresShipping: true,
        unitCostAmount: "9.25",
        unitCostCurrencyCode: "USD",
        unitCostAccess: "PRESENT",
        ...live,
      },
    });
  }
  const locations = [
    { gid: MAIN, name: "Main store", isActive: true },
    { gid: WAREHOUSE, name: "Warehouse", isActive: true },
    { gid: CLOSED, name: "Old kiosk", isActive: false },
  ];
  for (const location of locations) {
    await prisma.shopifyLocationFact.create({
      data: {
        shopId,
        shopifyGid: location.gid,
        name: location.name,
        isActive: location.isActive,
        fulfillsOnlineOrders: true,
        shipsInventory: true,
        isFulfillmentService: false,
        hasActiveInventory: location.isActive,
        ...live,
      },
    });
  }
  // The warehouse has not reported the 1.5 L bottle's available quantity yet,
  // and the stout's incoming quantity is unknown.
  const levels: Array<[string, string, number | null, number | null, number | null, number | null]> = [
    [MERLOT_750, MAIN, 4, 6, 2, 3],
    [MERLOT_750, WAREHOUSE, 6, 6, 0, 0],
    [MERLOT_1500, MAIN, 0, 0, 0, 0],
    [MERLOT_1500, WAREHOUSE, null, null, null, null],
    [STOUT_CAN, WAREHOUSE, 20, 20, 0, null],
  ];
  for (const [variantGid, locationGid, available, onHand, committed, incoming] of levels) {
    await prisma.shopifyInventoryLevelFact.create({
      data: {
        shopId,
        inventoryItemGid: itemGid(variantGid),
        locationGid,
        availableQuantity: available,
        onHandQuantity: onHand,
        committedQuantity: committed,
        incomingQuantity: incoming,
        ...live,
      },
    });
  }
}

async function seedOrder(
  prisma: PrismaClient,
  shopId: string,
  order: { id: number; processedAt: string; variant: string; quantity: number; price: string },
) {
  const gid = `gid://shopify/Order/${order.id}`;
  const line = `gid://shopify/LineItem/${order.id}01`;
  const agreement = `gid://shopify/OrderAgreement/${order.id}`;
  const processedAt = new Date(order.processedAt);
  await prisma.shopifyOrderFact.create({
    data: {
      shopId,
      shopifyGid: gid,
      name: `#${order.id}`,
      processedAt,
      processedAtShopify: order.processedAt,
      shopifyUpdatedAt: processedAt,
      closed: false,
      edited: false,
      test: false,
      confirmed: true,
      shopCurrencyCode: "USD",
      taxesIncluded: false,
      accessScopeSnapshot: ["read_orders"],
      ...live,
    },
  });
  await prisma.shopifyOrderLineFact.create({
    data: {
      shopId,
      shopifyGid: line,
      shopifyOrderGid: gid,
      quantity: order.quantity,
      currentQuantity: order.quantity,
      refundableQuantity: order.quantity,
      isGiftCard: false,
      title: "Line",
      variantGidAtSale: order.variant,
      orderProcessedAt: processedAt,
      orderTest: false,
      orderShopCurrencyCode: "USD",
      discountedUnitPriceAfterAllDiscountsShopAmount: order.price,
      discountedUnitPriceAfterAllDiscountsShopCurrencyCode: "USD",
      accessScopeSnapshot: ["read_orders"],
      ...live,
    },
  });
  await prisma.shopifyOrderAgreementFact.create({
    data: {
      shopId,
      shopifyGid: agreement,
      shopifyOrderGid: gid,
      happenedAt: processedAt,
      agreementTypename: "OrderAgreement",
      reason: "ORDER",
      accessScopeSnapshot: ["read_orders"],
      ...live,
    },
  });
  await prisma.shopifyOrderAgreementSaleFact.create({
    data: {
      shopId,
      shopifyGid: `${agreement}/sale/1`,
      shopifyAgreementGid: agreement,
      shopifyOrderGid: gid,
      shopifyLineItemGid: line,
      lineType: "PRODUCT",
      actionType: "ORDER",
      saleTypename: "ProductSale",
      quantity: order.quantity,
      happenedAt: processedAt,
      accessScopeSnapshot: ["read_orders"],
      ...live,
    },
  });
}

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
const BACKUP: SupplierTerms = {
  ...ACME,
  supplierId: "sup_backup",
  supplierName: "Backup Cellars",
  vendorSku: "BK-MER",
  moq: 6,
  packSize: 6,
  supplierCost: "9.10",
  isPreferred: false,
  leadTimeDays: 14,
};

const TERMS = new Map<string, VariantSuppliers>([
  [MERLOT_750, { preferred: ACME, all: [ACME, BACKUP] }],
  [MERLOT_1500, { preferred: null, all: [{ ...ACME, vendorSku: "ACME-MER-1500" }] }],
]);

type IncomingCall = { variantGids: readonly string[]; locationGid?: string };

function fakeSources(incomingCalls: IncomingCall[] = []): WorksheetSources {
  return {
    async getIncomingQuantities(_db, input) {
      incomingCalls.push(input);
      return new Map([[MERLOT_750, 8]]);
    },
    async getSupplierTerms(_db, { variantGids }) {
      return new Map(
        variantGids.flatMap((gid) => {
          const terms = TERMS.get(gid);
          return terms ? [[gid, terms] as const] : [];
        }),
      );
    },
    async listSuppliers() {
      return [
        { id: "sup_acme", name: "Acme Wines" },
        { id: "sup_backup", name: "Backup Cellars" },
      ];
    },
    async getSupplierVariantGids(_db, supplierId) {
      return [...TERMS].flatMap(([gid, terms]) =>
        terms.all.some((entry) => entry.supplierId === supplierId) ? [gid] : [],
      );
    },
  };
}

const LAST_30: WorksheetSettings = {
  params: { method: "LAST_X_DAYS", sampleDays: 30, suggestDays: 30 },
  scopeKey: "SHOP",
  incomingSource: "SHOPIFY_INCOMING",
  rounding: { applyMinimumOrderQuantity: false, roundUpToPackSize: false },
  selection: { vendor: null, productType: null, supplierId: null },
};

function input(settings: Partial<WorksheetSettings> = {}): GenerateWorksheetInput {
  return {
    settings: { ...LAST_30, ...settings },
    shop: {
      timeZone: TZ,
      currencyCode: "USD",
      installedAt: new Date("2026-08-01T00:00:00Z"),
    },
    defaults: { sampleDays: 30, defaultLeadTimeDays: null },
    now: NOW,
  };
}

const ALL_ROWS: WorksheetView = {
  show: "ALL",
  query: "",
  sort: { key: "product", direction: "asc" },
  page: 1,
  pageSize: 50,
};

describe("replenishment worksheets", () => {
  let migrationPrisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;

  function tenantDb(shopId: string, myshopifyDomain: string): TenantDb {
    requireRuntimeUrl();
    return createTenantDb(
      issueTenantAuthority({ shopId, myshopifyDomain, source: "verified_admin_request" }),
    );
  }
  const dbA = () => tenantDb(shopAId, SHOP_A_DOMAIN);
  const dbB = () => tenantDb(shopBId, SHOP_B_DOMAIN);

  async function linesOf(db: TenantDb, worksheetId: string, view: Partial<WorksheetView> = {}) {
    return (await loadWorksheetPage(db, worksheetId, { ...ALL_ROWS, ...view })).lines;
  }
  const bySku = (lines: WorksheetLine[], sku: string) =>
    lines.find((line) => line.sku === sku) as WorksheetLine;

  beforeAll(async () => {
    const ctx = await resetAndEnforce();
    migrationPrisma = ctx.migrationPrisma;
    await ctx.runtimePrisma.$disconnect();
    const shops = await seedTwoShops(migrationPrisma);
    shopAId = shops.shopA.id;
    shopBId = shops.shopB.id;
    // Both shops sync the same Shopify ids, as two real shops can.
    await seedCatalog(migrationPrisma, shopAId);
    await seedCatalog(migrationPrisma, shopBId);

    // Shop A sold 30 Merlot 750 ml and 6 stout in the last 30 days, plus one
    // sale today that the window leaves out. Shop B sold far more.
    const sales = [
      { id: 1, processedAt: "2026-10-15T16:00:00Z", variant: MERLOT_750, quantity: 18, price: "20.00" },
      { id: 2, processedAt: "2026-11-02T16:00:00Z", variant: MERLOT_750, quantity: 12, price: "20.00" },
      { id: 3, processedAt: "2026-11-05T16:00:00Z", variant: STOUT_CAN, quantity: 6, price: "4.00" },
      { id: 4, processedAt: "2026-11-10T14:00:00Z", variant: MERLOT_750, quantity: 40, price: "20.00" },
    ];
    for (const sale of sales) await seedOrder(migrationPrisma, shopAId, sale);
    await seedOrder(migrationPrisma, shopBId, {
      id: 1,
      processedAt: "2026-10-20T16:00:00Z",
      variant: MERLOT_750,
      quantity: 500,
      price: "20.00",
    });
  }, 180_000);

  afterAll(async () => {
    await migrationPrisma?.$disconnect();
  });

  describe("generation", () => {
    it("stores a complete shop-wide worksheet from the shop's own facts", async () => {
      const generated = await generateWorksheet(dbA(), fakeSources(), input());
      expect(generated.lineCount).toBe(3);

      const worksheet = await getWorksheet(dbA(), generated.id);
      expect(worksheet).toMatchObject({
        method: "LAST_X_DAYS",
        scopeKey: "SHOP",
        scopeName: null,
        settings: LAST_30,
        asOfLocalDate: "2026-11-10",
        timeZone: TZ,
        lineCount: 3,
        generatedAt: NOW,
        summary: {
          currencyCode: "USD",
          salesWindow: { start: "2026-10-11", end: "2026-11-09", days: 30 },
          coverage: { kind: "FULL" },
          notStockedAtLocation: 0,
        },
      });

      const lines = await linesOf(dbA(), generated.id);
      // The archived product is not planned.
      expect(lines.map((line) => line.sku)).toEqual(["MER-1500", "MER-750", "STOUT-CAN"]);

      // 30 sold ÷ 30 days × 30 days = 30, less 10 available and 3 incoming.
      expect(bySku(lines, "MER-750")).toMatchObject({
        variantGid: MERLOT_750,
        productTitle: "Merlot",
        variantTitle: "750 ml",
        vendor: "Acme",
        imageUrl: "https://cdn.shopify.com/s/files/merlot.png",
        priceAmount: "20",
        unitCostAmount: "9.25",
        supplierId: "sup_acme",
        supplierName: "Acme Wines",
        supplierCostAmount: "8.5",
        supplierCount: 2,
        minimumOrderQuantity: 24,
        packSize: 12,
        availableQuantity: 10,
        onHandQuantity: 12,
        committedQuantity: 2,
        incomingQuantity: 3,
        netUnits: 30,
        distinctOrders: 2,
        revenueAmount: "600",
        unitsPerDay: "1.00",
        forecastDemand: "30.00",
        daysOfStock: "10.0",
        depletionDate: "2026-11-20",
        leadTimeDays: 7,
        leadTimeSource: "SUPPLIER_DEFAULT",
        reorderPoint: 7,
        parityQuantity: 17,
        suggestedQuantity: 17,
        finalQuantity: null,
        orderQuantity: 17,
        stockStatus: "OK",
        warningCodes: [],
        purchaseOrderId: null,
      });

      // One location has not reported, so the shop total is unknown.
      expect(bySku(lines, "MER-1500")).toMatchObject({
        availableQuantity: null,
        suggestedQuantity: null,
        orderQuantity: 0,
        stockStatus: "UNKNOWN",
        warningCodes: ["INVENTORY_UNKNOWN"],
        supplierId: "sup_acme",
      });

      expect(bySku(lines, "STOUT-CAN")).toMatchObject({
        productTitle: "Stout",
        availableQuantity: 20,
        incomingQuantity: null,
        netUnits: 6,
        parityQuantity: 0,
        orderQuantity: 0,
        supplierId: null,
        supplierCount: 0,
        warningCodes: ["INCOMING_UNKNOWN"],
      });
    });

    it("plans one location from that location's stock only", async () => {
      const calls: IncomingCall[] = [];
      const generated = await generateWorksheet(
        dbA(),
        fakeSources(calls),
        input({ scopeKey: MAIN, incomingSource: "APP_PURCHASE_ORDERS" }),
      );
      const worksheet = await getWorksheet(dbA(), generated.id);
      expect(worksheet).toMatchObject({ scopeKey: MAIN, scopeName: "Main store" });
      // The stout is only in the warehouse.
      expect(worksheet?.summary?.notStockedAtLocation).toBe(1);

      const lines = await linesOf(dbA(), generated.id);
      expect(lines.map((line) => line.sku)).toEqual(["MER-1500", "MER-750"]);
      // Demand is shop-wide: 30 forecast − 4 available here − 8 on open purchase orders.
      expect(bySku(lines, "MER-750")).toMatchObject({
        availableQuantity: 4,
        incomingQuantity: 8,
        parityQuantity: 18,
      });
      expect(bySku(lines, "MER-1500")).toMatchObject({
        availableQuantity: 0,
        incomingQuantity: 0,
        stockStatus: "OUT_OF_STOCK",
        parityQuantity: 0,
      });
      expect(calls).toEqual([
        { variantGids: [MERLOT_750, MERLOT_1500], locationGid: MAIN },
      ]);
    });

    it("uses the planning levels saved for the scope", async () => {
      await saveVariantRule(dbA(), {
        variantGid: MERLOT_750,
        scopeKey: "SHOP",
        values: {
          minimumQuantity: 15,
          shelfLimitQuantity: 60,
          reorderPointQuantity: null,
          safetyStockQuantity: 5,
          leadTimeDays: 3,
        },
      });
      const generated = await generateWorksheet(
        dbA(),
        fakeSources(),
        input({ params: { method: "FILL_SHELVES_IF_BELOW_MIN" } }),
      );
      const line = bySku(await linesOf(dbA(), generated.id), "MER-750");
      // 13 in stock is below the minimum 15, so fill to 60. The sales rate
      // still comes from the shop's default 30 days: 1 × 3 + 5 = 8.
      expect(line).toMatchObject({
        parityQuantity: 47,
        forecastDemand: null,
        unitsPerDay: "1.00",
        leadTimeDays: 3,
        leadTimeSource: "VARIANT_RULE",
        reorderPoint: 8,
      });
      expect(line.detail.levels).toMatchObject({ minimumQuantity: 15, shelfLimitQuantity: 60 });

      // Quantities set for the whole shop do not apply to one location.
      const atMain = await generateWorksheet(
        dbA(),
        fakeSources(),
        input({ params: { method: "FILL_SHELVES_IF_BELOW_MIN" }, scopeKey: MAIN }),
      );
      expect(bySku(await linesOf(dbA(), atMain.id), "MER-750")).toMatchObject({
        suggestedQuantity: null,
        leadTimeDays: 3,
        warningCodes: ["SHELF_LIMIT_MISSING", "MINIMUM_MISSING"],
      });
      await saveVariantRule(dbA(), {
        variantGid: MERLOT_750,
        scopeKey: "SHOP",
        values: {
          minimumQuantity: null,
          shelfLimitQuantity: null,
          reorderPointQuantity: null,
          safetyStockQuantity: null,
          leadTimeDays: null,
        },
      });
    });

    it("applies supplier rounding only when the run turns it on", async () => {
      const generated = await generateWorksheet(
        dbA(),
        fakeSources(),
        input({ rounding: { applyMinimumOrderQuantity: true, roundUpToPackSize: true } }),
      );
      const line = bySku(await linesOf(dbA(), generated.id), "MER-750");
      expect(line).toMatchObject({ parityQuantity: 17, suggestedQuantity: 24, orderQuantity: 24 });
      expect(line.detail.adjustments).toEqual([
        { rule: "MINIMUM_ORDER_QUANTITY", before: 17, after: 24 },
      ]);
    });

    it("narrows the selection by vendor, product type and supplier", async () => {
      const skus = async (selection: Partial<WorksheetSettings["selection"]>) => {
        const generated = await generateWorksheet(
          dbA(),
          fakeSources(),
          input({ selection: { ...LAST_30.selection, ...selection } }),
        );
        return (await linesOf(dbA(), generated.id)).map((line) => line.sku);
      };
      expect(await skus({ vendor: "Brewco" })).toEqual(["STOUT-CAN"]);
      expect(await skus({ productType: "Wine" })).toEqual(["MER-1500", "MER-750"]);
      expect(await skus({ supplierId: "sup_backup" })).toEqual(["MER-750"]);
      expect(await skus({ supplierId: "sup_acme", vendor: "Acme" })).toEqual([
        "MER-1500",
        "MER-750",
      ]);
    });

    it("orders from the chosen supplier rather than the preferred one", async () => {
      const generated = await generateWorksheet(
        dbA(),
        fakeSources(),
        input({
          selection: { ...LAST_30.selection, supplierId: "sup_backup" },
          rounding: { applyMinimumOrderQuantity: false, roundUpToPackSize: true },
        }),
      );
      const [line] = await linesOf(dbA(), generated.id);
      expect(line).toMatchObject({
        supplierId: "sup_backup",
        vendorSku: "BK-MER",
        packSize: 6,
        leadTimeDays: 14,
        parityQuantity: 17,
        suggestedQuantity: 18,
      });
    });

    it("explains what the merchant can change when a run cannot be generated", async () => {
      const failure = async (settings: Partial<WorksheetSettings>) => {
        try {
          await generateWorksheet(dbA(), fakeSources(), input(settings));
        } catch (error) {
          if (error instanceof WorksheetError) return [error.code, error.message];
          throw error;
        }
        throw new Error("expected generation to fail");
      };
      const before = await migrationPrisma.replenishmentWorksheet.count();

      expect(await failure({ scopeKey: "gid://shopify/Location/999" })).toEqual([
        "location_not_found",
        "That location is no longer in your store. Choose another location.",
      ]);
      expect(await failure({ scopeKey: CLOSED })).toEqual([
        "location_not_found",
        "Old kiosk is deactivated in Shopify. Choose an active location.",
      ]);
      expect(
        await failure({ selection: { ...LAST_30.selection, vendor: "Nobody" } }),
      ).toEqual(["no_variants", "No products match this selection."]);
      expect(
        await failure({
          scopeKey: MAIN,
          selection: { ...LAST_30.selection, vendor: "Brewco" },
        }),
      ).toEqual(["no_variants", "None of the selected products are stocked at Main store."]);
      expect(
        await failure({ selection: { ...LAST_30.selection, supplierId: "sup_gone" } }),
      ).toEqual(["supplier_not_found", "That supplier no longer exists. Choose another supplier."]);
      expect(
        await failure({
          params: {
            method: "CUSTOM_RANGE",
            startDate: "2026-11-01",
            endDate: "2026-11-30",
            suggestDays: 30,
          },
        }),
      ).toEqual(["invalid_settings", "End date cannot be in the future."]);

      expect(await migrationPrisma.replenishmentWorksheet.count()).toBe(before);
    });

    it("withholds suggestions when the sales window is before stored history", async () => {
      const generated = await generateWorksheet(
        dbA(),
        fakeSources(),
        input({ params: { method: "SAME_PERIOD_LAST_YEAR", suggestDays: 30 } }),
      );
      const worksheet = await getWorksheet(dbA(), generated.id);
      expect(worksheet?.summary).toMatchObject({
        salesWindow: { start: "2025-11-10", end: "2025-12-09", days: 30 },
        coverage: { kind: "NONE" },
      });
      expect(bySku(await linesOf(dbA(), generated.id), "MER-750")).toMatchObject({
        netUnits: null,
        suggestedQuantity: null,
        warningCodes: ["HISTORY_UNAVAILABLE"],
      });
    });
  });

  describe("tenant isolation", () => {
    let worksheetA: string;
    let lineA: string;

    beforeAll(async () => {
      worksheetA = (await generateWorksheet(dbA(), fakeSources(), input())).id;
      lineA = bySku(await linesOf(dbA(), worksheetA), "MER-750").id;
    });

    it("computes each shop from its own sales", async () => {
      const generated = await generateWorksheet(dbB(), fakeSources(), {
        ...input(),
        shop: { timeZone: TZ, currencyCode: "USD", installedAt: null },
      });
      const line = bySku(await linesOf(dbB(), generated.id), "MER-750");
      expect(line).toMatchObject({ netUnits: 500, parityQuantity: 487 });
      expect(bySku(await linesOf(dbA(), worksheetA), "MER-750").netUnits).toBe(30);
    });

    it("hides a worksheet and its rows from another shop", async () => {
      expect(await getWorksheet(dbB(), worksheetA)).toBeNull();
      expect((await listWorksheets(dbB())).map((row) => row.id)).not.toContain(worksheetA);
      expect(await loadWorksheetPage(dbB(), worksheetA, ALL_ROWS)).toMatchObject({
        lines: [],
        matching: 0,
      });
      expect(await getWorksheetLine(dbB(), worksheetA, lineA)).toBeNull();
      expect(await getWorksheetTotals(dbB(), worksheetA)).toMatchObject({ variants: 0 });
    });

    it("refuses another shop's edits and deletes", async () => {
      await expect(
        setFinalQuantity(dbB(), { worksheetId: worksheetA, lineId: lineA, quantity: 1 }),
      ).rejects.toMatchObject({ code: "line_not_found" });
      expect(await deleteWorksheet(dbB(), worksheetA)).toBe(false);
      expect(await getWorksheetLine(dbA(), worksheetA, lineA)).toMatchObject({
        finalQuantity: null,
        orderQuantity: 17,
      });
    });

    it("rejects a row written into another shop or onto another shop's worksheet", async () => {
      const insertLine = (contextShopId: string, rowShopId: string, worksheetId: string) =>
        withRuntimePg(async (client) => {
          await client.query("BEGIN");
          try {
            await client.query(`SELECT set_config('stocky.current_shop_id', $1, true)`, [
              contextShopId,
            ]);
            await client.query(`SELECT set_config('stocky.tenant_context_version', $1, true)`, [
              TENANT_DB_CONTEXT_VERSION,
            ]);
            return await client.query(
              `INSERT INTO "ReplenishmentWorksheetLine"
                 ("id", "shopId", "worksheetId", "variantGid", "productGid", "productTitle",
                  "variantTitle", "tracked", "stockStatus", "warningCodes", "detail", "updatedAt")
               VALUES ('line-foreign', $1, $2, $3, $4, 'x', 'x', true, 'OK', '{}', '{}', now())`,
              [rowShopId, worksheetId, RETIRED_VARIANT, RETIRED],
            );
          } finally {
            await client.query("ROLLBACK");
          }
        });

      await expect(insertLine(shopAId, shopBId, worksheetA)).rejects.toThrow(/row-level security/);
      await expect(insertLine(shopBId, shopBId, worksheetA)).rejects.toThrow(
        "ReplenishmentWorksheetLine_shopId_worksheetId_fkey",
      );
    });
  });

  describe("views", () => {
    let worksheetId: string;

    beforeAll(async () => {
      worksheetId = (await generateWorksheet(dbA(), fakeSources(), input())).id;
    });

    const skus = async (view: Partial<WorksheetView>) =>
      (await linesOf(dbA(), worksheetId, view)).map((line) => line.sku);

    it("filters rows", async () => {
      expect(await skus({ show: "TO_ORDER" })).toEqual(["MER-750"]);
      expect(await skus({ show: "WARNINGS" })).toEqual(["MER-1500", "STOUT-CAN"]);
      expect(await skus({ show: "LOW_STOCK" })).toEqual([]);
      expect(await skus({ show: "EDITED" })).toEqual([]);
    });

    it("searches titles, SKUs, barcodes and supplier SKUs without regard to case", async () => {
      expect(await skus({ query: "merlot" })).toEqual(["MER-1500", "MER-750"]);
      expect(await skus({ query: "stout-c" })).toEqual(["STOUT-CAN"]);
      expect(await skus({ query: "00203" })).toEqual(["STOUT-CAN"]);
      expect(await skus({ query: "acme-mer-1500" })).toEqual(["MER-1500"]);
      expect(await skus({ query: "1.5 l" })).toEqual(["MER-1500"]);
      // Search text is matched literally, never as a pattern.
      expect(await skus({ query: "%" })).toEqual([]);
      expect(await skus({ query: "MER_750" })).toEqual([]);
      expect(await skus({ query: "00_03" })).toEqual([]);
    });

    it("sorts in the database with unknown values last in both directions", async () => {
      expect(await skus({ sort: { key: "available", direction: "asc" } })).toEqual([
        "MER-750",
        "STOUT-CAN",
        "MER-1500",
      ]);
      expect(await skus({ sort: { key: "available", direction: "desc" } })).toEqual([
        "STOUT-CAN",
        "MER-750",
        "MER-1500",
      ]);
      expect(await skus({ sort: { key: "order", direction: "desc" } })).toEqual([
        "MER-750",
        "MER-1500",
        "STOUT-CAN",
      ]);
      expect(await skus({ sort: { key: "sku", direction: "desc" } })).toEqual([
        "STOUT-CAN",
        "MER-750",
        "MER-1500",
      ]);
    });

    it("pages, and shows the last page when asked for one past the end", async () => {
      const first = await loadWorksheetPage(dbA(), worksheetId, { ...ALL_ROWS, pageSize: 2 });
      expect(first).toMatchObject({ matching: 3, page: 1, pageCount: 2 });
      expect(first.lines.map((line) => line.sku)).toEqual(["MER-1500", "MER-750"]);

      const beyond = await loadWorksheetPage(dbA(), worksheetId, {
        ...ALL_ROWS,
        pageSize: 2,
        page: 40,
      });
      expect(beyond).toMatchObject({ matching: 3, page: 2, pageCount: 2 });
      expect(beyond.lines.map((line) => line.sku)).toEqual(["STOUT-CAN"]);
    });

    it("streams every matching row in view order for export", async () => {
      const exported: Array<string | null> = [];
      for await (const batch of streamWorksheetLines(dbA(), worksheetId, {
        show: "ALL",
        query: "mer",
        sort: { key: "sku", direction: "desc" },
      })) {
        exported.push(...batch.map((line) => line.sku));
      }
      expect(exported).toEqual(["MER-750", "MER-1500"]);
    });

    it("counts what is left to order", async () => {
      expect(await getWorksheetTotals(dbA(), worksheetId)).toEqual({
        variants: 3,
        toOrder: 1,
        unitsToOrder: 17,
        lowStock: 0,
        withWarnings: 2,
        edited: 0,
        ordered: 0,
      });
    });
  });

  describe("final quantities", () => {
    let worksheetId: string;
    let merlot: string;
    let stout: string;

    beforeAll(async () => {
      worksheetId = (await generateWorksheet(dbA(), fakeSources(), input())).id;
      const lines = await linesOf(dbA(), worksheetId);
      merlot = bySku(lines, "MER-750").id;
      stout = bySku(lines, "STOUT-CAN").id;
    });

    it("saves an edit, keeps it through sorting and filtering, and clears it", async () => {
      expect(
        await setFinalQuantity(dbA(), { worksheetId, lineId: merlot, quantity: 36 }),
      ).toEqual({ finalQuantity: 36, orderQuantity: 36 });
      expect(
        await setFinalQuantity(dbA(), { worksheetId, lineId: stout, quantity: 12 }),
      ).toEqual({ finalQuantity: 12, orderQuantity: 12 });

      const edited = await linesOf(dbA(), worksheetId, {
        show: "EDITED",
        sort: { key: "order", direction: "desc" },
      });
      expect(edited.map((line) => [line.sku, line.suggestedQuantity, line.orderQuantity])).toEqual([
        ["MER-750", 17, 36],
        ["STOUT-CAN", 0, 12],
      ]);
      expect(await getWorksheetTotals(dbA(), worksheetId)).toMatchObject({
        toOrder: 2,
        unitsToOrder: 48,
        edited: 2,
      });

      // Zero is a decision not to order, and is kept as an edit.
      expect(
        await setFinalQuantity(dbA(), { worksheetId, lineId: merlot, quantity: 0 }),
      ).toEqual({ finalQuantity: 0, orderQuantity: 0 });
      expect(
        await setFinalQuantity(dbA(), { worksheetId, lineId: merlot, quantity: null }),
      ).toEqual({ finalQuantity: null, orderQuantity: 17 });
      expect(
        await setFinalQuantity(dbA(), { worksheetId, lineId: stout, quantity: null }),
      ).toEqual({ finalQuantity: null, orderQuantity: 0 });
    });

    it.each([-1, 1.5, 10_000_001, Number.NaN])("rejects a quantity of %s", async (quantity) => {
      await expect(
        setFinalQuantity(dbA(), { worksheetId, lineId: merlot, quantity }),
      ).rejects.toMatchObject({ code: "invalid_quantity" });
    });

    it("does not edit a row through a different worksheet", async () => {
      const other = (await generateWorksheet(dbA(), fakeSources(), input())).id;
      await expect(
        setFinalQuantity(dbA(), { worksheetId: other, lineId: merlot, quantity: 5 }),
      ).rejects.toBeInstanceOf(WorksheetEditError);
      expect(await getWorksheetLine(dbA(), worksheetId, merlot)).toMatchObject({
        finalQuantity: null,
      });
    });

    it("locks a row once it is on a purchase order", async () => {
      await migrationPrisma.replenishmentWorksheetLine.update({
        where: { id: stout },
        data: { purchaseOrderId: "po_1", purchaseOrderNumber: "PO-1001" },
      });
      await expect(
        setFinalQuantity(dbA(), { worksheetId, lineId: stout, quantity: 3 }),
      ).rejects.toMatchObject({ code: "already_ordered" });
      expect(await getWorksheetTotals(dbA(), worksheetId)).toMatchObject({ ordered: 1 });
    });

    it("cannot store an order quantity that disagrees with the final quantity", async () => {
      await expect(
        migrationPrisma.replenishmentWorksheetLine.update({
          where: { id: merlot },
          data: { orderQuantity: 99 },
        }),
      ).rejects.toThrow("ReplenishmentWorksheetLine_order_quantity_check");
      await expect(
        migrationPrisma.replenishmentWorksheetLine.update({
          where: { id: merlot },
          data: { finalQuantity: -1, orderQuantity: -1 },
        }),
      ).rejects.toThrow("ReplenishmentWorksheetLine_quantities_check");
    });
  });

  describe("retention and limits", () => {
    it("deletes a worksheet with its rows", async () => {
      const generated = await generateWorksheet(dbA(), fakeSources(), input());
      expect(await deleteWorksheet(dbA(), generated.id)).toBe(true);
      expect(await getWorksheet(dbA(), generated.id)).toBeNull();
      expect(
        await migrationPrisma.replenishmentWorksheetLine.count({
          where: { worksheetId: generated.id },
        }),
      ).toBe(0);
    });

    it("keeps the newest worksheets and removes older ones with their rows", async () => {
      const shopBBefore = await migrationPrisma.replenishmentWorksheet.count({
        where: { shopId: shopBId },
      });
      const oldest = (await listWorksheets(dbA())).at(-1)?.id as string;
      let newest = "";
      for (let i = 0; i < WORKSHEETS_KEPT; i += 1) {
        newest = (await generateWorksheet(dbA(), fakeSources(), input())).id;
      }
      const kept = await listWorksheets(dbA());
      expect(kept).toHaveLength(WORKSHEETS_KEPT);
      expect(kept[0].id).toBe(newest);
      expect(await migrationPrisma.replenishmentWorksheet.count({ where: { shopId: shopAId } })).toBe(
        WORKSHEETS_KEPT,
      );
      expect(
        await migrationPrisma.replenishmentWorksheetLine.count({ where: { worksheetId: oldest } }),
      ).toBe(0);
      expect(
        await migrationPrisma.replenishmentWorksheetLine.count({ where: { shopId: shopAId } }),
      ).toBe(WORKSHEETS_KEPT * 3);
      // Another shop's worksheets are not counted or removed.
      expect(await migrationPrisma.replenishmentWorksheet.count({ where: { shopId: shopBId } })).toBe(
        shopBBefore,
      );
    });

    it("asks for a narrower selection instead of building an oversized worksheet", async () => {
      const bulkProduct = "gid://shopify/Product/900";
      await migrationPrisma.shopifyProductFact.create({
        data: {
          shopId: shopBId,
          shopifyGid: bulkProduct,
          title: "Bulk",
          handle: "bulk",
          tags: [],
          status: "ACTIVE",
          vendor: "Bulk Co",
          ...live,
        },
      });
      await migrationPrisma.shopifyVariantFact.createMany({
        data: Array.from({ length: MAX_WORKSHEET_VARIANTS + 1 }, (_, i) => ({
          shopId: shopBId,
          shopifyGid: `gid://shopify/ProductVariant/${900_000 + i}`,
          shopifyProductGid: bulkProduct,
          title: `Size ${i}`,
          selectedOptions: [],
          priceAmount: "1.00",
          currencyCode: "USD",
          ...live,
        })),
      });
      const before = await migrationPrisma.replenishmentWorksheet.count({
        where: { shopId: shopBId },
      });
      await expect(
        generateWorksheet(dbB(), fakeSources(), input({ selection: { ...LAST_30.selection, vendor: "Bulk Co" } })),
      ).rejects.toMatchObject({
        code: "too_many_variants",
        message:
          "This selection has more than 5,000 variants. Choose a vendor, product type or supplier to plan a smaller group.",
      });
      expect(
        await migrationPrisma.replenishmentWorksheet.count({ where: { shopId: shopBId } }),
      ).toBe(before);

      // A selection inside the limit still works for the same shop.
      const generated = await generateWorksheet(
        dbB(),
        fakeSources(),
        input({ selection: { ...LAST_30.selection, vendor: "Brewco" } }),
      );
      expect(generated.lineCount).toBe(1);
    });
  });
});
