/**
 * Reports analytics over canonical facts, through TenantDb on the restricted
 * runtime role with FORCE RLS enforced. Facts are seeded by the migration owner.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { loadAbcParityRun } from "../../../lib/analytics/abc-parity.server";
import { loadCatalogVariants } from "../../../lib/analytics/catalog.server";
import { AnalyticsPrerequisiteError } from "../../../lib/analytics/errors";
import { aggregateVariantWindow } from "../../../lib/analytics/net-units";
import { loadSalesHistory } from "../../../lib/analytics/sales-history.server";
import { localRangeToUtc } from "../../../lib/analytics/shop-calendar";
import {
  loadAppliedInventoryChanges,
  loadCompletedStocktakeLines,
  loadTransferLines,
} from "../../../lib/analytics/stock-documents.server";
import { loadLastOrderedAt } from "../../../lib/analytics/stock-levels.server";
import { toCsv } from "../../../lib/csv.server";
import { findReport, loadReportContext } from "../../../lib/reports/registry.server";
import { issueTenantAuthority } from "../../authority.server";
import { readShopReportingProfile } from "../../bootstrap.server";
import { createTenantDb, type TenantDb } from "../../tenant-db.server";
import { resetAndEnforce, seedTwoShops, SHOP_A_DOMAIN, SHOP_B_DOMAIN } from "./helpers";

const TZ = "America/New_York";
const OBSERVED = new Date("2026-11-09T12:00:00Z");
const PRODUCT = "gid://shopify/Product/9001";
const VARIANT_OLD = "gid://shopify/ProductVariant/9101";
const VARIANT_MID = "gid://shopify/ProductVariant/9102";
const VARIANT_NEW = "gid://shopify/ProductVariant/9103";
const VARIANT_GONE = "gid://shopify/ProductVariant/9199";

const live = {
  existenceState: "LIVE",
  existenceKind: "LIVE_FULL_SYNC_PRESENT",
  existenceObservedAt: OBSERVED,
  sourceKind: "FULL_SYNC",
} as const;

type Seed = { prisma: PrismaClient; shopId: string };

async function seedCatalog({ prisma, shopId }: Seed) {
  await prisma.shopifyProductFact.create({
    data: {
      shopId,
      shopifyGid: PRODUCT,
      title: "Trail Shoe",
      handle: "trail-shoe",
      tags: [],
      status: "ACTIVE",
      vendor: "Northwind",
      ...live,
    },
  });
  const variants: Array<[string, string, string, string]> = [
    [VARIANT_OLD, "Size 9", "2025-01-10T12:00:00Z", "TS-9"],
    [VARIANT_MID, "Size 10", "2025-01-10T12:00:00Z", "TS-10"],
    [VARIANT_NEW, "Size 11", "2026-10-20T12:00:00Z", "TS-11"],
  ];
  for (const [gid, title, createdAt, sku] of variants) {
    await prisma.shopifyVariantFact.create({
      data: {
        shopId,
        shopifyGid: gid,
        shopifyProductGid: PRODUCT,
        title,
        sku,
        selectedOptions: [],
        priceAmount: "120.00",
        currencyCode: "USD",
        shopifyCreatedAt: new Date(createdAt),
        ...live,
      },
    });
    await prisma.shopifyInventoryItemFact.create({
      data: {
        shopId,
        shopifyGid: gid.replace("ProductVariant", "InventoryItem"),
        shopifyVariantGid: gid,
        sku,
        tracked: true,
        requiresShipping: true,
        unitCostAmount: "48.50",
        unitCostCurrencyCode: "USD",
        unitCostAccess: "PRESENT",
        ...live,
      },
    });
  }
}

const LOCATION_MAIN = "gid://shopify/Location/71";
const LOCATION_STORE = "gid://shopify/Location/72";

/** On-hand units per variant and location; `null` is a quantity Shopify has not reported. */
async function seedStock(
  { prisma, shopId }: Seed,
  levels: Array<[variant: string, location: string, onHand: number | null]>,
) {
  for (const [gid, name] of [
    [LOCATION_MAIN, "Main warehouse"],
    [LOCATION_STORE, "Downtown store"],
  ]) {
    await prisma.shopifyLocationFact.create({
      data: {
        shopId,
        shopifyGid: gid,
        name,
        isActive: true,
        fulfillsOnlineOrders: true,
        shipsInventory: true,
        isFulfillmentService: false,
        hasActiveInventory: true,
        ...live,
      },
    });
  }
  for (const [variant, location, onHand] of levels) {
    await prisma.shopifyInventoryLevelFact.create({
      data: {
        shopId,
        inventoryItemGid: variant.replace("ProductVariant", "InventoryItem"),
        locationGid: location,
        isActive: true,
        availableQuantity: onHand,
        onHandQuantity: onHand,
        committedQuantity: 0,
        incomingQuantity: 0,
        shopifyUpdatedAt: new Date("2026-11-08T15:00:00Z"),
        ...live,
      },
    });
  }
}

type SaleSpec = {
  agreement: string;
  reason: string;
  happenedAt: string;
  line: string;
  action: string;
  quantity: number;
  absent?: boolean;
};

type OrderSpec = {
  gid: string;
  processedAt: string;
  test?: boolean;
  cancelledAt?: string;
  absent?: boolean;
  lines: Array<{ gid: string; variant: string; quantity: number; price: string }>;
  sales: SaleSpec[];
};

const absent = {
  existenceState: "ABSENT",
  existenceKind: "ABSENT_CONFIRMED_QUERY",
  existenceObservedAt: OBSERVED,
  existenceRequestGen: 1n,
  existenceResponseGen: 2n,
  deletedAt: OBSERVED,
  deletionSource: "CONFIRMED_QUERY",
  sourceKind: "RECONCILE",
} as const;

async function seedOrder({ prisma, shopId }: Seed, order: OrderSpec) {
  const existence = order.absent ? absent : live;
  await prisma.shopifyOrderFact.create({
    data: {
      shopId,
      shopifyGid: order.gid,
      name: `#${order.gid.split("/").pop()}`,
      processedAt: new Date(order.processedAt),
      processedAtShopify: order.processedAt,
      shopifyUpdatedAt: new Date(order.processedAt),
      cancelledAt: order.cancelledAt ? new Date(order.cancelledAt) : null,
      closed: false,
      edited: false,
      test: order.test ?? false,
      confirmed: true,
      shopCurrencyCode: "USD",
      taxesIncluded: false,
      accessScopeSnapshot: ["read_orders"],
      ...existence,
    },
  });
  for (const line of order.lines) {
    await prisma.shopifyOrderLineFact.create({
      data: {
        shopId,
        shopifyGid: line.gid,
        shopifyOrderGid: order.gid,
        quantity: line.quantity,
        currentQuantity: line.quantity,
        refundableQuantity: line.quantity,
        isGiftCard: false,
        title: "Trail Shoe",
        variantGidAtSale: line.variant,
        productGidAtSale: PRODUCT,
        orderProcessedAt: new Date(order.processedAt),
        orderCancelledAt: order.cancelledAt ? new Date(order.cancelledAt) : null,
        orderTest: order.test ?? false,
        orderShopCurrencyCode: "USD",
        discountedUnitPriceAfterAllDiscountsShopAmount: line.price,
        discountedUnitPriceAfterAllDiscountsShopCurrencyCode: "USD",
        accessScopeSnapshot: ["read_orders"],
        ...live,
      },
    });
  }
  const agreements = new Map<string, SaleSpec>();
  for (const sale of order.sales) agreements.set(sale.agreement, sale);
  for (const [gid, sale] of agreements) {
    await prisma.shopifyOrderAgreementFact.create({
      data: {
        shopId,
        shopifyGid: gid,
        shopifyOrderGid: order.gid,
        happenedAt: new Date(sale.happenedAt),
        agreementTypename: `${sale.reason}Agreement`,
        reason: sale.reason,
        accessScopeSnapshot: ["read_orders"],
        ...live,
      },
    });
  }
  let n = 0;
  for (const sale of order.sales) {
    n += 1;
    await prisma.shopifyOrderAgreementSaleFact.create({
      data: {
        shopId,
        shopifyGid: `${sale.agreement}/sale/${n}`,
        shopifyAgreementGid: sale.agreement,
        shopifyOrderGid: order.gid,
        shopifyLineItemGid: sale.line,
        lineType: "PRODUCT",
        actionType: sale.action,
        saleTypename: "ProductSale",
        quantity: sale.quantity,
        happenedAt: new Date(sale.happenedAt),
        accessScopeSnapshot: ["read_orders"],
        ...(sale.absent ? absent : live),
      },
    });
  }
}

function simple(
  id: number,
  processedAt: string,
  variant: string,
  quantity: number,
  price: string,
  extra: Partial<OrderSpec> = {},
): OrderSpec {
  const gid = `gid://shopify/Order/${id}`;
  const line = `gid://shopify/LineItem/${id}01`;
  return {
    gid,
    processedAt,
    lines: [{ gid: line, variant, quantity, price }],
    sales: [
      {
        agreement: `gid://shopify/OrderAgreement/${id}`,
        reason: "ORDER",
        happenedAt: processedAt,
        line,
        action: "ORDER",
        quantity,
      },
    ],
    ...extra,
  };
}

describe("reports analytics over canonical facts (RLS enforced)", () => {
  let migrationPrisma: PrismaClient;
  let runtimePrisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;
  let dbA: TenantDb;
  let dbB: TenantDb;

  beforeAll(async () => {
    const ctx = await resetAndEnforce();
    migrationPrisma = ctx.migrationPrisma;
    runtimePrisma = ctx.runtimePrisma;
    const { shopA, shopB } = await seedTwoShops(migrationPrisma);
    shopAId = shopA.id;
    shopBId = shopB.id;
    await migrationPrisma.shop.update({
      where: { id: shopA.id },
      data: {
        ianaTimezone: TZ,
        currencyCode: "USD",
        createdAt: new Date("2026-08-01T00:00:00Z"),
      },
    });
    const a = { prisma: migrationPrisma, shopId: shopA.id };
    const b = { prisma: migrationPrisma, shopId: shopB.id };
    await seedCatalog(a);
    await seedCatalog(b);
    await seedStock(a, [
      [VARIANT_OLD, LOCATION_MAIN, 10],
      [VARIANT_OLD, LOCATION_STORE, 2],
      [VARIANT_MID, LOCATION_MAIN, 0],
      [VARIANT_NEW, LOCATION_STORE, 3],
    ]);
    await seedStock(b, [[VARIANT_OLD, LOCATION_MAIN, 999]]);

    // 2026-09-20 04:30Z is 2026-09-20 00:30 EDT; 03:30Z is still 09-19 locally.
    const first = simple(1, "2026-09-20T04:30:00Z", VARIANT_OLD, 4, "100.00");
    // A sale Shopify no longer reports must not count.
    first.sales.push({ ...first.sales[0], quantity: 7, absent: true });
    await seedOrder(a, first);
    await seedOrder(a, simple(2, "2026-09-20T03:30:00Z", VARIANT_OLD, 1, "100.00"));
    // Partial refund after the window: restated to the order date (T47).
    const refunded = simple(3, "2026-10-01T15:00:00Z", VARIANT_MID, 3, "50.00");
    refunded.sales.push({
      agreement: "gid://shopify/RefundAgreement/3",
      reason: "REFUND",
      happenedAt: "2026-11-15T15:00:00Z",
      line: "gid://shopify/LineItem/301",
      action: "RETURN",
      quantity: -1,
    });
    await seedOrder(a, refunded);
    // Ordered before the window; an edit inside it adds a unit.
    const edited = simple(4, "2026-09-01T15:00:00Z", VARIANT_MID, 1, "50.00");
    edited.sales.push({
      agreement: "gid://shopify/OrderEditAgreement/4",
      reason: "ORDER_EDIT",
      happenedAt: "2026-10-02T15:00:00Z",
      line: "gid://shopify/LineItem/401",
      action: "ORDER",
      quantity: 2,
    });
    await seedOrder(a, edited);
    await seedOrder(a, simple(5, "2026-10-03T15:00:00Z", VARIANT_NEW, 2, "60.00"));
    await seedOrder(a, simple(6, "2026-10-04T15:00:00Z", VARIANT_GONE, 1, "9.00"));
    await seedOrder(a, simple(7, "2026-10-05T15:00:00Z", VARIANT_OLD, 9, "100.00", { test: true }));
    await seedOrder(
      a,
      simple(8, "2026-10-05T15:00:00Z", VARIANT_OLD, 9, "100.00", {
        cancelledAt: "2026-10-06T15:00:00Z",
      }),
    );
    await seedOrder(a, simple(9, "2026-10-05T15:00:00Z", VARIANT_OLD, 9, "100.00", { absent: true }));
    // Shop B sells the same GIDs; none of it may reach shop A.
    await seedOrder(b, simple(1, "2026-09-25T15:00:00Z", VARIANT_OLD, 500, "100.00"));

    const authority = (shopId: string, domain: string) =>
      issueTenantAuthority({ shopId, myshopifyDomain: domain, source: "verified_admin_request" });
    dbA = createTenantDb(authority(shopA.id, SHOP_A_DOMAIN));
    dbB = createTenantDb(authority(shopB.id, SHOP_B_DOMAIN));
  });

  afterAll(async () => {
    await runtimePrisma?.$disconnect();
    await migrationPrisma?.$disconnect();
  });

  it("reads the shop reporting profile for the verified tenant only", async () => {
    const profile = await readShopReportingProfile(
      issueTenantAuthority({
        shopId: shopAId,
        myshopifyDomain: SHOP_A_DOMAIN,
        source: "verified_admin_request",
      }),
    );
    expect(profile).toEqual({
      ianaTimezone: TZ,
      currencyCode: "USD",
      installedAt: new Date("2026-08-01T00:00:00Z"),
    });
    await expect(
      readShopReportingProfile({
        shopId: shopAId,
        myshopifyDomain: SHOP_A_DOMAIN,
      } as never),
    ).rejects.toThrow();
  });

  it("derives dated net units and revenue with policy exclusions", async () => {
    const history = await loadSalesHistory(dbA, {
      startLocalDate: "2026-09-15",
      endLocalDate: "2026-11-09",
      timeZone: TZ,
      reportCurrency: "USD",
      installedAt: new Date("2026-08-01T00:00:00Z"),
      orderBatchSize: 2,
    });

    const windows = new Map(
      aggregateVariantWindow(history.events).map((row) => [row.variantGid, row]),
    );
    // Order 2 falls on 09-19 locally, order 1 on 09-20.
    expect(windows.get(VARIANT_OLD)).toMatchObject({
      netUnits: 5,
      distinctOrders: 2,
      firstSaleDate: "2026-09-19",
      lastSaleDate: "2026-09-20",
    });
    expect(windows.get(VARIANT_OLD)?.revenue.toFixed(2)).toBe("500.00");
    // 3 ordered - 1 refunded (restated) + 2 added by an in-window edit.
    expect(windows.get(VARIANT_MID)).toMatchObject({
      netUnits: 4,
      orderedUnits: 3,
      refundedUnits: 1,
      addedUnits: 2,
    });
    expect(windows.get(VARIANT_MID)?.revenue.toFixed(2)).toBe("200.00");
    expect(windows.get(VARIANT_GONE)?.netUnits).toBe(1);

    expect(history.diagnostics).toMatchObject({
      ordersEvaluated: 7,
      ordersExcludedTest: 1,
      ordersExcludedCancelled: 1,
      ordersExcludedSignInconsistent: 0,
      ordersWithoutLedger: 0,
    });
    expect(history.coverage).toMatchObject({
      earliestOrderLocalDate: "2026-09-01",
      historyStartLocalDate: "2026-06-01",
      startsBeforeCoverage: false,
      latestOrderChangeAt: new Date("2026-10-05T15:00:00Z"),
    });
    expect(history.daily.find((d) => d.localDate === "2026-10-02")).toMatchObject({
      variantGid: VARIANT_MID,
      addedUnits: 2,
    });
  });

  it("returns the same events whatever the page size", async () => {
    const load = (orderBatchSize: number) =>
      loadSalesHistory(dbA, {
        startLocalDate: "2026-09-15",
        endLocalDate: "2026-11-09",
        timeZone: TZ,
        reportCurrency: "USD",
        orderBatchSize,
      });
    const [single, paired, whole] = await Promise.all([load(1), load(2), load(500)]);
    expect(single.events).toEqual(whole.events);
    expect(paired.events).toEqual(whole.events);
    // Orders 7 and 8 share a processedAt; neither may be skipped or repeated.
    expect(single.diagnostics).toEqual(whole.diagnostics);
    expect(paired.diagnostics).toEqual(whole.diagnostics);
  });

  it("excludes the original units of an order processed before the range", async () => {
    const history = await loadSalesHistory(dbA, {
      startLocalDate: "2026-10-02",
      endLocalDate: "2026-10-02",
      timeZone: TZ,
      reportCurrency: "USD",
    });
    expect(history.events.map((e) => [e.variantGid, e.kind, e.units])).toEqual([
      [VARIANT_MID, "ADDED", 2],
    ]);
  });

  it("never returns another shop's facts", async () => {
    const historyA = await loadSalesHistory(dbA, {
      startLocalDate: "2026-09-25",
      endLocalDate: "2026-09-25",
      timeZone: TZ,
      reportCurrency: "USD",
    });
    expect(historyA.events).toEqual([]);

    const historyB = await loadSalesHistory(dbB, {
      startLocalDate: "2026-09-15",
      endLocalDate: "2026-11-09",
      timeZone: TZ,
      reportCurrency: "USD",
    });
    expect(historyB.events.map((e) => [e.orderGid, e.units])).toEqual([
      ["gid://shopify/Order/1", 500],
    ]);
  });

  it("scopes order child facts to the canonical shop", async () => {
    const foreignAgreement = await migrationPrisma.shopifyOrderAgreementFact.findFirstOrThrow({
      where: { shopId: shopBId },
      select: { id: true },
    });
    const foreignSale = await migrationPrisma.shopifyOrderAgreementSaleFact.findFirstOrThrow({
      where: { shopId: shopBId },
      select: { id: true },
    });

    const agreements: Array<{ shopId: string }> = await dbA.shopifyOrderAgreementFact.findMany({
      select: { shopId: true },
    });
    expect(agreements.length).toBe(11);
    expect(agreements.every((row) => row.shopId === shopAId)).toBe(true);
    // Shop A's own two sale facts on this GID (one absent); shop B's is unseen.
    expect(
      await dbA.shopifyOrderAgreementSaleFact.count({
        where: { shopifyOrderGid: "gid://shopify/Order/1" },
      }),
    ).toBe(2);
    expect(
      await dbA.shopifyOrderAgreementFact.findUnique({ where: { id: foreignAgreement.id } }),
    ).toBeNull();
    expect(
      await dbA.shopifyOrderAgreementSaleFact.findFirst({ where: { id: foreignSale.id } }),
    ).toBeNull();
    expect(await dbB.shopifyOrderAgreementSaleFact.count()).toBe(1);
    expect(await dbA.shopifyOrderRefundLineFact.count()).toBe(0);
  });

  it("fails closed without a shop time zone", async () => {
    await expect(
      loadSalesHistory(dbA, {
        startLocalDate: "2026-09-15",
        endLocalDate: "2026-11-09",
        timeZone: null,
        reportCurrency: "USD",
      }),
    ).rejects.toBeInstanceOf(AnalyticsPrerequisiteError);
  });

  it("loads current catalog variants with product and cost attributes", async () => {
    const variants = await loadCatalogVariants(dbA, { timeZone: TZ });
    expect(variants.map((v) => v.variantGid)).toEqual([VARIANT_OLD, VARIANT_MID, VARIANT_NEW]);
    expect(variants[0]).toMatchObject({
      productTitle: "Trail Shoe",
      variantTitle: "Size 9",
      vendor: "Northwind",
      sku: "TS-9",
      createdLocalDate: "2025-01-10",
      tracked: true,
      unitCostAccess: "PRESENT",
    });
    expect(variants[0].unitCost?.toFixed(2)).toBe("48.50");
    const subset = await loadCatalogVariants(dbA, {
      timeZone: TZ,
      variantGids: [VARIANT_NEW, VARIANT_GONE],
    });
    expect(subset.map((v) => v.variantGid)).toEqual([VARIANT_NEW]);
  });

  it("classifies the catalog with Stocky-parity ABC/U", async () => {
    const run = await loadAbcParityRun(dbA, {
      timeZone: TZ,
      currencyCode: "USD",
      installedAt: new Date("2026-08-01T00:00:00Z"),
      asOfLocalDate: "2026-11-09",
    });
    expect(run.windowStartLocalDate).toBe("2026-09-15");
    const byVariant = new Map(run.rows.map((row) => [row.variantGid, row]));
    expect(byVariant.get(VARIANT_OLD)).toMatchObject({ abcClass: "A", rank: 1 });
    // 500 of 700 precedes it (71%), so the variant crossing 80% stays in A.
    expect(byVariant.get(VARIANT_MID)).toMatchObject({ abcClass: "A", rank: 2 });
    expect(byVariant.get(VARIANT_NEW)).toMatchObject({
      abcClass: "U",
      unclassifiedReason: "variant_too_new",
    });
    expect(byVariant.has(VARIANT_GONE)).toBe(false);
    expect(run.revenueOutsideCatalog.toFixed(2)).toBe("9.00");
    expect(run.classifiedRevenue.toFixed(2)).toBe("700.00");
  });

  it("requires a shop currency for ABC", async () => {
    await expect(
      loadAbcParityRun(dbA, {
        timeZone: TZ,
        currencyCode: null,
        installedAt: null,
        asOfLocalDate: "2026-11-09",
      }),
    ).rejects.toBeInstanceOf(AnalyticsPrerequisiteError);
  });

  describe("reports", () => {
    const NOW = new Date("2026-11-10T17:00:00Z");
    const RANGE = "range=custom&start=2026-09-15&end=2026-11-09";

    const contextFor = (shopId: string, domain: string, db: TenantDb) =>
      loadReportContext({
        tenant: issueTenantAuthority({
          shopId,
          myshopifyDomain: domain,
          source: "verified_admin_request",
        }),
        db,
        now: NOW,
      });

    async function page(id: string, query = "") {
      const report = findReport(id);
      if (!report) throw new Error(`No report ${id}`);
      return report.page(await contextFor(shopAId, SHOP_A_DOMAIN, dbA), new URLSearchParams(query));
    }

    function table(result: Awaited<ReturnType<typeof page>>) {
      const keys = result.columns.map((column) => column.key);
      return result.table.rows.map((row) =>
        Object.fromEntries(row.cells.map((cell, index) => [keys[index], cell])),
      );
    }

    const tiles = (result: Awaited<ReturnType<typeof page>>) =>
      Object.fromEntries(result.table.tiles.map((tile) => [tile.label, tile.value]));

    it("resolves the shop's calendar and currency, and refuses to guess them", async () => {
      expect(await contextFor(shopAId, SHOP_A_DOMAIN, dbA)).toMatchObject({
        timeZone: TZ,
        currencyCode: "USD",
        today: "2026-11-10",
      });
      // Shop B has no time zone or currency recorded yet.
      await expect(contextFor(shopBId, SHOP_B_DOMAIN, dbB)).rejects.toBeInstanceOf(
        AnalyticsPrerequisiteError,
      );
    });

    it("reports sales by variant, naming a deleted variant from its order line", async () => {
      const result = await page("sales-by-variant", `${RANGE}&sort=revenue&dir=desc`);
      const rows = table(result);

      expect(rows.map((row) => [row.variant, row.netUnits, row.revenue])).toEqual([
        ["Size 9", "5", "$500.00"],
        ["Size 10", "4", "$200.00"],
        ["Size 11", "2", "$120.00"],
        ["—", "1", "$9.00"],
      ]);
      expect(rows[1]).toMatchObject({ orderedUnits: "3", addedUnits: "2", returnedUnits: "1" });
      expect(rows[3]).toMatchObject({ product: "Trail Shoe", sku: "—" });
      expect(tiles(result)).toMatchObject({ "Net revenue": "$829.00", "Net units": "12" });
      expect(result.dataAsOf).toBe("Oct 5, 2026, 11:00 AM EDT");
      expect(result.notices).toEqual([]);
    });

    it("totals a day and an order the same way as the variant report", async () => {
      const statistics = await page("sales-statistics", RANGE);
      expect(tiles(statistics)).toMatchObject({
        "Net revenue": "$829.00",
        Orders: "5",
        "Net units": "12",
      });
      const orders = await page("orders", RANGE);
      expect(tiles(orders)).toMatchObject({ Orders: "6", "Net product revenue": "$829.00" });
      const items = await page("sale-items", `${RANGE}&type=Refunded`);
      expect(table(items).map((row) => [row.order, row.units, row.revenue])).toEqual([
        ["#3", "-1", "-$50.00"],
      ]);
    });

    it("grades the catalog in the ABC report", async () => {
      const result = await page("abc-analysis");
      expect(table(result).map((row) => [row.variant, row.grade, row.rank])).toEqual([
        ["Size 9", "A", "1"],
        ["Size 10", "A", "2"],
        ["Size 11", "U", "—"],
      ]);
      expect(tiles(result)["Grade A"]).toBe("2 variants");
      expect(result.notices.map((notice) => notice.heading)).toEqual([
        "Some revenue came from variants that no longer exist",
      ]);
    });

    it("values stock on hand from this shop's levels only", async () => {
      const result = await page("stock-on-hand", "sort=onHand&dir=desc");
      expect(
        table(result).map((row) => [row.variant, row.location, row.onHand, row.costValue]),
      ).toEqual([
        ["Size 9", "Main warehouse", "10", "$485.00"],
        ["Size 11", "Downtown store", "3", "$145.50"],
        ["Size 9", "Downtown store", "2", "$97.00"],
      ]);
      expect(tiles(result)).toEqual({
        "Units on hand": "15",
        "Cost value": "$727.50",
        "Retail value": "$1,800.00",
        Variants: "2",
      });
      expect((await page("stock-on-hand", "stock=all")).table.totalRows).toBe(4);
    });

    it("ignores test, cancelled and deleted orders when dating the last order", async () => {
      const lastOrdered = await loadLastOrderedAt(dbA, [VARIANT_OLD, VARIANT_MID, VARIANT_NEW]);
      // Orders 7, 8 and 9 put Size 9 on an order on 10-05; none of them counts.
      expect(lastOrdered.get(VARIANT_OLD)).toEqual(new Date("2026-09-20T04:30:00Z"));
      expect(lastOrdered.get(VARIANT_MID)).toEqual(new Date("2026-10-01T15:00:00Z"));
      expect((await loadLastOrderedAt(dbB, [VARIANT_OLD])).get(VARIANT_OLD)).toEqual(
        new Date("2026-09-25T15:00:00Z"),
      );
    });

    it("lists dead stock by the chosen period", async () => {
      const result = await page("dead-stock", "days=30");
      // Size 11 was created on 10-20, inside the 30 days, and is left out.
      expect(
        table(result).map((row) => [row.variant, row.onHand, row.lastOrderedDate, row.costValue]),
      ).toEqual([["Size 9", "12", "2026-09-20", "$582.00"]]);
      expect((await page("dead-stock", "days=60")).table.totalRows).toBe(0);
    });

    it("exports the same rows as CSV", async () => {
      const report = findReport("sales-by-variant");
      const result = await report?.export(
        await contextFor(shopAId, SHOP_A_DOMAIN, dbA),
        new URLSearchParams(`${RANGE}&sort=revenue&dir=desc&q=size 9`),
      );
      expect(toCsv(result?.headers ?? [], result?.rows ?? [])).toBe(
        "Product,Variant,SKU,Vendor,Ordered,Added,Returned,Net units,Net revenue (USD)," +
          "Average price (USD),Orders,First sold,Last sold\r\n" +
          "Trail Shoe,Size 9,TS-9,Northwind,5,0,0,5,500.00,100.00,2,2026-09-19,2026-09-20\r\n",
      );
    });

    it("estimates gross profit from today's Shopify cost", async () => {
      const result = await page("gross-profit", `${RANGE}&q=size 9`);

      // 5 units at $100.00 against a $48.50 cost per item.
      expect(table(result)[0]).toMatchObject({
        netUnits: "5",
        revenue: "$500.00",
        unitCost: "$48.50",
        cost: "$242.50",
        profit: "$257.50",
        margin: "51.50%",
      });
    });

    describe("stock documents", () => {
      const documentRange = localRangeToUtc("2026-09-15", "2026-11-09", TZ);

      async function seedDocuments(
        shopId: string,
        domain: string,
        units: { transfer: number; counted: number; adjusted: number },
      ) {
        await migrationPrisma.transferOrder.create({
          data: {
            shop: domain,
            shopId,
            sourceLocationId: LOCATION_MAIN,
            destinationLocationId: LOCATION_STORE,
            status: "RECEIVED",
            createdAt: new Date("2026-10-10T15:00:00Z"),
            shippedAt: new Date("2026-10-11T15:00:00Z"),
            receivedAt: new Date("2026-10-12T15:00:00Z"),
            lineItems: {
              create: {
                shopId,
                shopifyVariantId: VARIANT_OLD,
                quantity: units.transfer + 1,
                pickedQty: units.transfer,
                receivedQty: units.transfer,
              },
            },
          },
        });
        await migrationPrisma.stocktake.create({
          data: {
            shop: domain,
            shopId,
            locationId: LOCATION_MAIN,
            status: "COMPLETED",
            name: "October count",
            completedAt: new Date("2026-10-20T15:00:00Z"),
            lineItems: {
              create: [
                { shopId, shopifyVariantId: VARIANT_OLD, expectedQty: 10, countedQty: units.counted },
                { shopId, shopifyVariantId: VARIANT_MID, expectedQty: 0, countedQty: 0 },
                { shopId, shopifyVariantId: VARIANT_NEW, expectedQty: 3, countedQty: null },
              ],
            },
          },
        });
        const operation = await migrationPrisma.inventoryOperation.create({
          data: {
            shopId,
            idempotencyKey: "adjustment-1",
            payloadDigest: "0".repeat(64),
            kind: "ADJUSTMENT",
            writeCapability: "adjustmentWrites",
            sourceType: "Adjustment",
            sourceId: "adjustment-1",
            reason: "shrinkage",
            quantityName: "available",
            actorDisplayName: "Dana Rivera",
            actorChannel: "ADMIN",
            status: "PARTIALLY_APPLIED",
            lineCount: 2,
            appliedLineCount: 1,
            failedLineCount: 1,
            completedAt: new Date("2026-10-21T15:00:05Z"),
            createdAt: new Date("2026-10-21T15:00:00Z"),
          },
        });
        const line = {
          shopId,
          operationId: operation.id,
          locationGid: LOCATION_MAIN,
        };
        await migrationPrisma.inventoryOperationLine.createMany({
          data: [
            {
              ...line,
              lineNumber: 1,
              inventoryItemGid: "gid://shopify/InventoryItem/9101",
              variantGid: VARIANT_OLD,
              delta: -units.adjusted,
              status: "APPLIED",
              appliedAt: new Date("2026-10-21T15:00:05Z"),
              quantityAfterChange: 8,
            },
            // Shopify refused this line, so it never changed any stock.
            {
              ...line,
              lineNumber: 2,
              inventoryItemGid: "gid://shopify/InventoryItem/9102",
              variantGid: VARIANT_MID,
              delta: -50,
              status: "FAILED",
              errorCode: "INVALID_QUANTITY",
            },
          ],
        });
      }

      beforeAll(async () => {
        await seedDocuments(shopAId, SHOP_A_DOMAIN, { transfer: 4, counted: 8, adjusted: 2 });
        await seedDocuments(shopBId, SHOP_B_DOMAIN, { transfer: 700, counted: 800, adjusted: 900 });
        // Outside the range, and a count that is still open.
        await migrationPrisma.transferOrder.create({
          data: {
            shop: SHOP_A_DOMAIN,
            shopId: shopAId,
            sourceLocationId: LOCATION_MAIN,
            destinationLocationId: LOCATION_STORE,
            status: "IN_TRANSIT",
            createdAt: new Date("2026-08-01T15:00:00Z"),
            lineItems: {
              create: { shopId: shopAId, shopifyVariantId: VARIANT_OLD, quantity: 60 },
            },
          },
        });
        await migrationPrisma.stocktake.create({
          data: {
            shop: SHOP_A_DOMAIN,
            shopId: shopAId,
            locationId: LOCATION_STORE,
            status: "IN_PROGRESS",
            name: "Open count",
            lineItems: {
              create: {
                shopId: shopAId,
                shopifyVariantId: VARIANT_OLD,
                expectedQty: 2,
                countedQty: 70,
              },
            },
          },
        });
      });

      it("lists the transfers created in the range", async () => {
        const result = await page("transfers", RANGE);

        expect(table(result)).toEqual([
          expect.objectContaining({
            created: "2026-10-10",
            from: "Main warehouse",
            to: "Downtown store",
            status: "Received",
            variant: "Size 9",
            requested: "5",
            shipped: "4",
            received: "4",
            inTransit: "0",
            receivedDate: "2026-10-12",
          }),
        ]);
        expect(tiles(result)).toMatchObject({ Transfers: "1", "Units received": "4" });
      });

      it("reports completed stocktakes and leaves uncounted lines out", async () => {
        const result = await page("stocktake-variances", RANGE);

        expect(table(result)).toEqual([
          expect.objectContaining({
            completed: "2026-10-20",
            stocktake: "October count",
            location: "Main warehouse",
            variant: "Size 9",
            expected: "10",
            counted: "8",
            variance: "-2",
            varianceValue: "-$97.00",
          }),
        ]);
        expect(result.notices.map((notice) => notice.heading)).toEqual([
          "1 line was never counted",
        ]);
        expect((await page("stocktake-variances", `${RANGE}&view=all`)).table.totalRows).toBe(2);
      });

      it("lists only the inventory changes Shopify accepted", async () => {
        const result = await page("inventory-adjustments", RANGE);

        expect(table(result)).toEqual([
          expect.objectContaining({
            date: "2026-10-21",
            type: "Adjustment",
            reason: "Theft or loss",
            location: "Main warehouse",
            variant: "Size 9",
            quantity: "Available",
            change: "-2",
            after: "8",
            value: "-$97.00",
            madeBy: "Dana Rivera",
          }),
        ]);
      });

      it("keeps each shop's documents to itself", async () => {
        const transfers = await loadTransferLines(dbB, documentRange);
        const stocktakes = await loadCompletedStocktakeLines(dbB, documentRange);
        const changes = await loadAppliedInventoryChanges(dbB, documentRange);

        expect(transfers.map((line) => line.pickedQty)).toEqual([700]);
        expect(stocktakes.map((line) => line.countedQty).sort()).toEqual([0, 800, null]);
        expect(changes.map((change) => change.delta)).toEqual([-900]);
      });
    });
  });
});
