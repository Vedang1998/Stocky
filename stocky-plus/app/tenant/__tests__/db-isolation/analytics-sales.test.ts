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
});
