/**
 * Replenishment worksheets under full enforcement: generation reads only the
 * shop's own facts, a saved worksheet is complete and stays inside its shop,
 * views run in the database, and a final quantity is the only editable value.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";
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
import {
  createDraftOrders,
  getOrderGroups,
  type DraftOrder,
  type DraftOrderPort,
  type DraftOrderRequest,
} from "../../../lib/replenishment/worksheet/orders.server";
import { previewLineSuggestion } from "../../../lib/replenishment/worksheet/preview.server";
import {
  draftOrderPort,
  purchasingSources,
} from "../../../lib/replenishment/worksheet/purchasing.server";
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
import type { PurchasingActor } from "../../../services/purchasing/actor.server";
import { loadPurchaseOrder } from "../../../services/purchasing/purchase-order-records.server";
import {
  createSupplier,
  saveSupplierProduct,
} from "../../../services/purchasing/suppliers.server";
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

/**
 * Purchasing as the worksheet sees it. Like the real module, it returns the
 * order it already made when a creation key is repeated.
 */
function recordingPort(
  options: {
    maxLinesPerOrder?: number;
    afterCreate?: (request: DraftOrderRequest) => Promise<void>;
  } = {},
) {
  const orders = new Map<string, DraftOrder>();
  const requests: DraftOrderRequest[] = [];
  const port: DraftOrderPort = {
    maxLinesPerOrder: options.maxLinesPerOrder ?? 1000,
    async create(request) {
      requests.push(request);
      const existing = orders.get(request.creationKey);
      if (existing) return { ...existing, created: false };
      const order = {
        id: `po_${orders.size + 1}`,
        poNumber: `PO-${1001 + orders.size}`,
        created: true,
      };
      orders.set(request.creationKey, order);
      await options.afterCreate?.(request);
      return order;
    },
  };
  return { port, requests };
}

const STAFF: PurchasingActor = { type: "STAFF", id: "staff-1" };

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

  describe("trying another period on a row", () => {
    it("recalculates one variant from the row's saved stock without changing the worksheet", async () => {
      const { id } = await generateWorksheet(dbA(), fakeSources(), input());
      const worksheet = (await getWorksheet(dbA(), id))!;
      const line = bySku(await linesOf(dbA(), id), "MER-750");
      const preview = (params: WorksheetSettings["params"]) =>
        previewLineSuggestion(dbA(), {
          worksheet: {
            asOfLocalDate: worksheet.asOfLocalDate,
            timeZone: worksheet.timeZone,
            settings: worksheet.settings!,
            currencyCode: "USD",
          },
          line,
          params,
          installedAt: new Date("2026-08-01T00:00:00Z"),
        });

      // The same 30 sold in 30 days, now to cover 60: 60 less 10 available and 3 incoming.
      const longer = await preview({ method: "LAST_X_DAYS", sampleDays: 30, suggestDays: 60 });
      expect(longer).toMatchObject({ parityQuantity: 47, suggestedQuantity: 47 });

      // Only the 12 sold on Nov 2 fall in the last 14 days: 12 ÷ 14 × 14 less 13.
      const shorter = await preview({ method: "LAST_X_DAYS", sampleDays: 14, suggestDays: 14 });
      expect(shorter).toMatchObject({ parityQuantity: 0, suggestedQuantity: 0 });

      const target = await preview({ method: "TARGET_STOCK_LEVEL", targetQuantity: 40 });
      expect(target).toMatchObject({ parityQuantity: 27, suggestedQuantity: 27 });

      // A period before the stored history gives no number rather than zero.
      const tooEarly = await preview({
        method: "CUSTOM_RANGE",
        startDate: "2025-01-01",
        endDate: "2025-01-31",
        suggestDays: 30,
      });
      expect(tooEarly.suggestedQuantity).toBeNull();
      expect(tooEarly.warnings.map((warning) => warning.code)).toContain("HISTORY_UNAVAILABLE");

      expect(bySku(await linesOf(dbA(), id), "MER-750")).toEqual(line);
    });

    it("reads the previewed variant's sales from its own shop", async () => {
      const { id } = await generateWorksheet(dbB(), fakeSources(), input());
      const worksheet = (await getWorksheet(dbB(), id))!;
      const line = bySku(await linesOf(dbB(), id), "MER-750");
      const preview = await previewLineSuggestion(dbB(), {
        worksheet: {
          asOfLocalDate: worksheet.asOfLocalDate,
          timeZone: worksheet.timeZone,
          settings: worksheet.settings!,
          currencyCode: "USD",
        },
        line,
        params: { method: "LAST_X_DAYS", sampleDays: 30, suggestDays: 30 },
        installedAt: new Date("2026-08-01T00:00:00Z"),
      });
      // Shop B sold 500; shop A's 30 are not part of it.
      expect(preview.parityQuantity).toBe(487);
    });
  });

  describe("draft purchase orders", () => {
    // Merlot 750 ml keeps its suggestion of 17; the 1.5 L is set to 5 with the
    // same supplier, and the stout to 4 with no supplier at all.
    async function worksheetToOrder(settings: Partial<WorksheetSettings> = {}) {
      const { id } = await generateWorksheet(dbA(), fakeSources(), input(settings));
      const lines = await linesOf(dbA(), id);
      await setFinalQuantity(dbA(), {
        worksheetId: id,
        lineId: bySku(lines, "MER-1500").id,
        quantity: 5,
      });
      await setFinalQuantity(dbA(), {
        worksheetId: id,
        lineId: bySku(lines, "STOUT-CAN").id,
        quantity: 4,
      });
      return { id, scopeKey: "SHOP" };
    }
    const acmeOrder = (worksheet: { id: string; scopeKey: string }, locationGid: string | null) => ({
      worksheet,
      supplierIds: ["sup_acme"],
      locationGid,
    });

    it("groups the rows to order by supplier with an estimated cost", async () => {
      const worksheet = await worksheetToOrder();
      expect(await getOrderGroups(dbA(), worksheet.id)).toEqual({
        groups: [
          {
            supplierId: "sup_acme",
            supplierName: "Acme Wines",
            lines: 2,
            units: 22,
            costByCurrency: [{ currencyCode: "USD", amount: "187.00" }],
            linesWithoutCost: 0,
          },
        ],
        linesWithoutSupplier: 1,
      });
      expect(await getOrderGroups(dbB(), worksheet.id)).toEqual({
        groups: [],
        linesWithoutSupplier: 0,
      });
    });

    it("sends the worksheet's quantities to purchasing and locks the ordered rows", async () => {
      const worksheet = await worksheetToOrder();
      const { port, requests } = recordingPort();

      const created = await createDraftOrders(dbA(), port, acmeOrder(worksheet, WAREHOUSE));
      expect(created).toEqual([
        {
          supplierId: "sup_acme",
          supplierName: "Acme Wines",
          purchaseOrderId: "po_1",
          purchaseOrderNumber: "PO-1001",
          lines: 2,
          changedLines: 0,
          created: true,
        },
      ]);
      expect(requests).toEqual([
        {
          supplierId: "sup_acme",
          locationGid: WAREHOUSE,
          lines: [
            { variantGid: MERLOT_1500, quantity: 5 },
            { variantGid: MERLOT_750, quantity: 17 },
          ],
          creationKey: expect.stringMatching(
            new RegExp(`^replenishment:${worksheet.id}:sup_acme:[0-9a-f]{32}$`),
          ),
          source: "replenishment",
        },
      ]);

      const lines = await linesOf(dbA(), worksheet.id);
      expect(bySku(lines, "MER-750")).toMatchObject({
        purchaseOrderId: "po_1",
        purchaseOrderNumber: "PO-1001",
        orderQuantity: 17,
      });
      expect(bySku(lines, "MER-1500").purchaseOrderId).toBe("po_1");
      expect(bySku(lines, "STOUT-CAN").purchaseOrderId).toBeNull();
      expect(await getWorksheetTotals(dbA(), worksheet.id)).toMatchObject({
        toOrder: 1,
        unitsToOrder: 4,
        ordered: 2,
      });
      await expect(
        setFinalQuantity(dbA(), {
          worksheetId: worksheet.id,
          lineId: bySku(lines, "MER-750").id,
          quantity: 1,
        }),
      ).rejects.toMatchObject({ code: "already_ordered" });

      // Nothing is left for this supplier, so asking again creates nothing.
      expect(await createDraftOrders(dbA(), port, acmeOrder(worksheet, WAREHOUSE))).toEqual([]);
      expect(requests).toHaveLength(1);
    });

    it("finishes the same order when a request failed before its rows were linked", async () => {
      const worksheet = await worksheetToOrder();
      let failures = 1;
      const { port, requests } = recordingPort({
        afterCreate: async () => {
          if (failures-- > 0) throw new Error("connection lost");
        },
      });

      await expect(
        createDraftOrders(dbA(), port, acmeOrder(worksheet, WAREHOUSE)),
      ).rejects.toThrow("connection lost");
      expect(await getWorksheetTotals(dbA(), worksheet.id)).toMatchObject({ ordered: 0 });

      const retried = await createDraftOrders(dbA(), port, acmeOrder(worksheet, WAREHOUSE));
      expect(retried).toMatchObject([
        { purchaseOrderId: "po_1", lines: 2, changedLines: 0, created: false },
      ]);
      expect(requests[1].creationKey).toBe(requests[0].creationKey);
      expect(await getWorksheetTotals(dbA(), worksheet.id)).toMatchObject({ ordered: 2 });
    });

    it("never reuses an order for different quantities or another destination", async () => {
      const worksheet = await worksheetToOrder();
      const { port, requests } = recordingPort({
        afterCreate: async () => {
          throw new Error("connection lost");
        },
      });
      const attempt = (locationGid: string) =>
        createDraftOrders(dbA(), port, acmeOrder(worksheet, locationGid)).catch(() => undefined);

      await attempt(WAREHOUSE);
      await attempt(MAIN);
      const lines = await linesOf(dbA(), worksheet.id);
      await setFinalQuantity(dbA(), {
        worksheetId: worksheet.id,
        lineId: bySku(lines, "MER-750").id,
        quantity: 18,
      });
      await attempt(WAREHOUSE);

      expect(new Set(requests.map((request) => request.creationKey)).size).toBe(3);
    });

    it("splits a supplier's rows across orders when one order cannot hold them", async () => {
      const worksheet = await worksheetToOrder();
      const { port, requests } = recordingPort({ maxLinesPerOrder: 1 });

      const created = await createDraftOrders(dbA(), port, acmeOrder(worksheet, WAREHOUSE));
      expect(created.map((order) => [order.purchaseOrderNumber, order.lines])).toEqual([
        ["PO-1001", 1],
        ["PO-1002", 1],
      ]);
      expect(requests.map((request) => request.lines)).toEqual([
        [{ variantGid: MERLOT_1500, quantity: 5 }],
        [{ variantGid: MERLOT_750, quantity: 17 }],
      ]);
      const lines = await linesOf(dbA(), worksheet.id);
      expect(bySku(lines, "MER-1500").purchaseOrderNumber).toBe("PO-1001");
      expect(bySku(lines, "MER-750").purchaseOrderNumber).toBe("PO-1002");
    });

    it("leaves a row open when its quantity changed while the order was being created", async () => {
      const worksheet = await worksheetToOrder();
      const before = await linesOf(dbA(), worksheet.id);
      const { port } = recordingPort({
        afterCreate: async () => {
          await setFinalQuantity(dbA(), {
            worksheetId: worksheet.id,
            lineId: bySku(before, "MER-750").id,
            quantity: 30,
          });
        },
      });

      const created = await createDraftOrders(dbA(), port, acmeOrder(worksheet, WAREHOUSE));
      expect(created).toMatchObject([{ lines: 1, changedLines: 1 }]);
      const lines = await linesOf(dbA(), worksheet.id);
      expect(bySku(lines, "MER-1500").purchaseOrderId).toBe("po_1");
      expect(bySku(lines, "MER-750")).toMatchObject({ purchaseOrderId: null, orderQuantity: 30 });
    });

    it("delivers a shop-wide worksheet only to an active location the merchant chose", async () => {
      const worksheet = await worksheetToOrder();
      const { port, requests } = recordingPort();
      const to = (locationGid: string | null) =>
        createDraftOrders(dbA(), port, acmeOrder(worksheet, locationGid));

      await expect(to(null)).rejects.toMatchObject({
        code: "location_not_found",
        message: "Choose the location the stock will be delivered to.",
      });
      await expect(to("gid://shopify/Product/301")).rejects.toMatchObject({
        code: "location_not_found",
      });
      await expect(to(CLOSED)).rejects.toMatchObject({
        code: "location_not_found",
        message: "That location is not active in your store. Choose another delivery location.",
      });
      await expect(to("gid://shopify/Location/999")).rejects.toMatchObject({
        code: "location_not_found",
      });
      expect(requests).toEqual([]);
      expect(await getWorksheetTotals(dbA(), worksheet.id)).toMatchObject({ ordered: 0 });
    });

    it("delivers a one-location worksheet to that location whatever is asked for", async () => {
      const { id } = await generateWorksheet(dbA(), fakeSources(), input({ scopeKey: MAIN }));
      const { port, requests } = recordingPort();

      await createDraftOrders(dbA(), port, acmeOrder({ id, scopeKey: MAIN }, WAREHOUSE));
      // 30 sold less 4 available and 3 incoming at the main store.
      expect(requests).toMatchObject([
        { locationGid: MAIN, lines: [{ variantGid: MERLOT_750, quantity: 23 }] },
      ]);
    });

    it("creates nothing from another shop's worksheet", async () => {
      const worksheet = await worksheetToOrder();
      const { port, requests } = recordingPort();

      expect(await createDraftOrders(dbB(), port, acmeOrder(worksheet, WAREHOUSE))).toEqual([]);
      expect(requests).toEqual([]);
      expect(await getWorksheetTotals(dbA(), worksheet.id)).toMatchObject({ ordered: 0 });
    });

    it("plans from the purchasing module's supplier terms and creates a real draft", async () => {
      try {
        const supplier = await createSupplier(dbA(), STAFF, {
          name: "Vintage Imports",
          accountNumber: null,
          contactName: null,
          contactEmail: null,
          contactPhone: null,
          preferredContactMethod: null,
          website: null,
          addressLine1: null,
          addressLine2: null,
          city: null,
          region: null,
          postalCode: null,
          countryCode: null,
          currency: "USD",
          paymentTerms: null,
          shippingTerms: null,
          defaultTaxRatePercent: null,
          defaultLeadTimeDays: 9,
          defaultRestockDays: null,
          minimumOrderValue: null,
          vendorNotes: null,
        });
        await saveSupplierProduct(dbA(), STAFF, supplier.id, {
          variantGid: MERLOT_750,
          vendorSku: "VI-MER-750",
          moq: 24,
          packSize: 12,
          supplierCost: new Prisma.Decimal("7.25"),
          leadTimeDaysOverride: null,
          orderUnit: null,
          isPreferred: true,
        });

        const { id } = await generateWorksheet(
          dbA(),
          purchasingSources,
          input({
            incomingSource: "APP_PURCHASE_ORDERS",
            rounding: { applyMinimumOrderQuantity: true, roundUpToPackSize: true },
            selection: { ...LAST_30.selection, supplierId: supplier.id },
          }),
        );
        const [line] = await linesOf(dbA(), id);
        // 30 sold less 10 available and nothing on order is 20, raised to the
        // supplier's minimum of 24, which is already two full packs.
        expect(line).toMatchObject({
          sku: "MER-750",
          supplierId: supplier.id,
          supplierName: "Vintage Imports",
          vendorSku: "VI-MER-750",
          minimumOrderQuantity: 24,
          packSize: 12,
          supplierCostAmount: "7.25",
          supplierCostCurrencyCode: "USD",
          leadTimeDays: 9,
          leadTimeSource: "SUPPLIER_DEFAULT",
          incomingQuantity: 0,
          parityQuantity: 20,
          suggestedQuantity: 24,
        });

        const port = draftOrderPort(dbA(), { actor: STAFF, today: "2026-11-10" });
        const order = { worksheet: { id, scopeKey: "SHOP" }, supplierIds: [supplier.id], locationGid: WAREHOUSE };
        const [created] = await createDraftOrders(dbA(), port, order);
        expect(created).toMatchObject({
          supplierName: "Vintage Imports",
          purchaseOrderNumber: "PO-1001",
          lines: 1,
          changedLines: 0,
          created: true,
        });

        const purchaseOrder = await loadPurchaseOrder(dbA(), created.purchaseOrderId);
        expect(purchaseOrder).toMatchObject({
          status: "DRAFT",
          supplierId: supplier.id,
          locationId: WAREHOUSE,
          poNumber: "PO-1001",
        });
        expect(purchaseOrder.lineItems).toHaveLength(1);
        expect(purchaseOrder.lineItems[0]).toMatchObject({
          shopifyVariantId: MERLOT_750,
          orderedQty: 24,
          vendorSku: "VI-MER-750",
        });
        expect(purchaseOrder.lineItems[0].unitCost.toFixed(2)).toBe("7.25");
        expect((await getWorksheetLine(dbA(), id, line.id))?.purchaseOrderNumber).toBe("PO-1001");

        expect(await createDraftOrders(dbA(), port, order)).toEqual([]);
        expect(await migrationPrisma.purchaseOrder.count({ where: { shopId: shopAId } })).toBe(1);

        // A draft is not stock on order, so the next plan still counts nothing incoming.
        const next = await generateWorksheet(
          dbA(),
          purchasingSources,
          input({ incomingSource: "APP_PURCHASE_ORDERS" }),
        );
        expect(bySku(await linesOf(dbA(), next.id), "MER-750").incomingQuantity).toBe(0);
      } finally {
        await migrationPrisma.$transaction([
          migrationPrisma.purchasingEvent.deleteMany(),
          migrationPrisma.purchaseOrder.deleteMany(),
          migrationPrisma.supplier.deleteMany(),
        ]);
      }
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
