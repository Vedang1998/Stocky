/**
 * Daily stock snapshots under full enforcement: a shop's day is captured once,
 * on its own calendar, with the rows the stock on hand report lists; the
 * history stays inside its shop, cannot be changed and is pruned after the
 * retention period.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../../authority.server";
import { readShopReportingProfile } from "../../bootstrap.server";
import { TENANT_DB_CONTEXT_VERSION } from "../../db-context.server";
import { createTenantDb, type TenantDb } from "../../tenant-db.server";
import { captureStockSnapshot } from "../../../lib/stock-history/capture.server";
import {
  captureDueStockSnapshot,
  runDailyStockSnapshots,
  type SnapshotDeps,
} from "../../../lib/stock-history/daily-run.server";
import {
  oldestRetainedDate,
  snapshotDayDue,
} from "../../../lib/stock-history/snapshot-day";
import { addLocalDays } from "../../../lib/analytics/shop-calendar";
import {
  requireRuntimeUrl,
  resetAndEnforce,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
  withRuntimePg,
} from "./helpers";

const NEW_YORK = "America/New_York";
const AUCKLAND = "Pacific/Auckland";

/** 00:10 on 20 Nov in New York; 18:10 on 20 Nov in Auckland. */
const NEW_YORK_MIDNIGHT = new Date("2026-11-20T05:10:00Z");
/** 00:20 on 21 Nov in Auckland; 06:20 on 20 Nov in New York. */
const AUCKLAND_MIDNIGHT = new Date("2026-11-20T11:20:00Z");

const OBSERVED = new Date("2026-11-18T12:00:00Z");
const live = {
  existenceState: "LIVE",
  existenceKind: "LIVE_FULL_SYNC_PRESENT",
  existenceObservedAt: OBSERVED,
  sourceKind: "FULL_SYNC",
} as const;
const absent = {
  ...live,
  existenceState: "ABSENT",
  existenceKind: "ABSENT_CONFIRMED_QUERY",
  existenceRequestGen: 50n,
  existenceResponseGen: 51n,
  deletedAt: OBSERVED,
  deletionSource: "CONFIRMED_QUERY",
} as const;

const WINE = "gid://shopify/Product/101";
const DISCONTINUED = "gid://shopify/Product/102";
const variantGid = (n: number) => `gid://shopify/ProductVariant/${n}`;
const itemGid = (n: number) => `gid://shopify/InventoryItem/${n}`;
const MERLOT = variantGid(201);
const MAGNUM = variantGid(202);
const GIFT_WRAP = variantGid(203);
const DELETED_VARIANT = variantGid(204);
const DISCONTINUED_VARIANT = variantGid(205);
const RELINKED = variantGid(206);
const MAIN = "gid://shopify/Location/301";
const WAREHOUSE = "gid://shopify/Location/302";
const CLOSED_FOR_GOOD = "gid://shopify/Location/303";
const POP_UP = "gid://shopify/Location/304";

type Quantities = { available: number | null; onHand: number | null };

/**
 * A catalog with every kind of row a snapshot has to leave out. Both shops
 * get the same Shopify ids; `scale` makes their quantities differ.
 */
async function seedCatalog(prisma: PrismaClient, shopId: string, scale: number) {
  for (const [gid, state] of [
    [WINE, live],
    [DISCONTINUED, absent],
  ] as const) {
    await prisma.shopifyProductFact.create({
      data: {
        shopId,
        shopifyGid: gid,
        title: gid === WINE ? "Merlot" : "Discontinued",
        handle: gid === WINE ? "merlot" : "discontinued",
        tags: [],
        status: "ACTIVE",
        ...state,
      },
    });
  }

  const variants = [
    { gid: MERLOT, product: WINE, price: "20.00", state: live },
    { gid: MAGNUM, product: WINE, price: "38.50", state: live },
    { gid: GIFT_WRAP, product: WINE, price: "3.00", state: live },
    { gid: DELETED_VARIANT, product: WINE, price: "9.00", state: absent },
    { gid: DISCONTINUED_VARIANT, product: DISCONTINUED, price: "9.00", state: live },
    { gid: RELINKED, product: WINE, price: "12.00", state: live },
  ];
  for (const variant of variants) {
    await prisma.shopifyVariantFact.create({
      data: {
        shopId,
        shopifyGid: variant.gid,
        shopifyProductGid: variant.product,
        title: "Variant",
        selectedOptions: [],
        priceAmount: variant.price,
        currencyCode: "USD",
        ...variant.state,
      },
    });
  }

  const items = [
    { n: 201, variant: MERLOT, tracked: true, cost: "9.25", currency: "USD" },
    // No cost saved in Shopify.
    { n: 202, variant: MAGNUM, tracked: true, cost: null, currency: null },
    { n: 203, variant: GIFT_WRAP, tracked: false, cost: "0.10", currency: "USD" },
    { n: 204, variant: DELETED_VARIANT, tracked: true, cost: "1.00", currency: "USD" },
    { n: 205, variant: DISCONTINUED_VARIANT, tracked: true, cost: "1.00", currency: "USD" },
    // Two live items for one variant; the facts do not forbid it.
    { n: 206, variant: RELINKED, tracked: true, cost: "5.00", currency: "USD" },
    { n: 207, variant: RELINKED, tracked: true, cost: "6.00", currency: "USD" },
  ];
  for (const item of items) {
    await prisma.shopifyInventoryItemFact.create({
      data: {
        shopId,
        shopifyGid: itemGid(item.n),
        shopifyVariantGid: item.variant,
        tracked: item.tracked,
        requiresShipping: true,
        unitCostAmount: item.cost,
        unitCostCurrencyCode: item.currency,
        unitCostAccess: item.cost ? "PRESENT" : "NULL",
        ...live,
      },
    });
  }

  for (const [gid, state] of [
    [MAIN, live],
    [WAREHOUSE, live],
    [CLOSED_FOR_GOOD, absent],
    [POP_UP, live],
  ] as const) {
    await prisma.shopifyLocationFact.create({
      data: {
        shopId,
        shopifyGid: gid,
        name: gid,
        isActive: true,
        fulfillsOnlineOrders: true,
        shipsInventory: true,
        isFulfillmentService: false,
        hasActiveInventory: true,
        ...state,
      },
    });
  }

  const levels: Array<{
    item: number;
    location: string;
    quantities: Quantities;
    isActive?: boolean;
    state?: typeof live | typeof absent;
  }> = [
    { item: 201, location: MAIN, quantities: { available: 4 * scale, onHand: 6 * scale } },
    { item: 201, location: WAREHOUSE, quantities: { available: -2, onHand: 0 } },
    { item: 202, location: MAIN, quantities: { available: 0, onHand: 0 } },
    // Shopify has not reported these quantities.
    { item: 202, location: WAREHOUSE, quantities: { available: null, onHand: null } },
    { item: 206, location: MAIN, quantities: { available: 1, onHand: 1 } },
    { item: 207, location: MAIN, quantities: { available: 2, onHand: 2 } },
    // Left out: deleted location, variant no longer stocked at the pop-up,
    // level Shopify no longer reports, untracked item, deleted variant,
    // variant of a deleted product.
    { item: 201, location: CLOSED_FOR_GOOD, quantities: { available: 7, onHand: 7 } },
    { item: 201, location: POP_UP, quantities: { available: 8, onHand: 8 }, isActive: false },
    { item: 202, location: POP_UP, quantities: { available: 9, onHand: 9 }, state: absent },
    { item: 203, location: MAIN, quantities: { available: 50, onHand: 50 } },
    { item: 204, location: MAIN, quantities: { available: 11, onHand: 11 } },
    { item: 205, location: MAIN, quantities: { available: 12, onHand: 12 } },
  ];
  for (const level of levels) {
    await prisma.shopifyInventoryLevelFact.create({
      data: {
        shopId,
        inventoryItemGid: itemGid(level.item),
        locationGid: level.location,
        isActive: level.isActive ?? true,
        availableQuantity: level.quantities.available,
        onHandQuantity: level.quantities.onHand,
        ...(level.state ?? live),
      },
    });
  }
}

type LevelRow = {
  variantGid: string;
  locationGid: string;
  availableQuantity: number | null;
  onHandQuantity: number | null;
  unitCostAmount: { toString(): string } | null;
  unitCostCurrencyCode: string | null;
  priceAmount: { toString(): string };
  priceCurrencyCode: string;
};

function expectedLevels(scale: number) {
  return [
    [MERLOT, MAIN, 4 * scale, 6 * scale, "9.25", "USD", "20"],
    [MERLOT, WAREHOUSE, -2, 0, "9.25", "USD", "20"],
    [MAGNUM, MAIN, 0, 0, null, null, "38.5"],
    [MAGNUM, WAREHOUSE, null, null, null, null, "38.5"],
    [RELINKED, MAIN, 1, 1, "5", "USD", "12"],
  ];
}

describe("daily stock snapshots", () => {
  let migrationPrisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;
  let catalogReady = true;

  const deps: SnapshotDeps = {
    readTimeZone: async (tenant) =>
      (await readShopReportingProfile(tenant)).ianaTimezone,
    isCatalogReady: async () => catalogReady,
  };

  function authority(shopId: string, myshopifyDomain: string) {
    requireRuntimeUrl();
    return issueTenantAuthority({
      shopId,
      myshopifyDomain,
      source: "verified_scheduler",
    });
  }
  const tenantA = () => authority(shopAId, SHOP_A_DOMAIN);
  const tenantB = () => authority(shopBId, SHOP_B_DOMAIN);
  const dbA = (): TenantDb => createTenantDb(tenantA());
  const dbB = (): TenantDb => createTenantDb(tenantB());

  async function levelsOf(db: TenantDb, localDate: string) {
    const rows: LevelRow[] = await db.dailyStockLevel.findMany({
      where: { localDate },
      orderBy: [{ variantGid: "asc" }, { locationGid: "asc" }],
    });
    return rows.map((row) => [
      row.variantGid,
      row.locationGid,
      row.availableQuantity,
      row.onHandQuantity,
      row.unitCostAmount?.toString() ?? null,
      row.unitCostCurrencyCode,
      row.priceAmount.toString(),
    ]);
  }

  async function setTimeZone(shopId: string, ianaTimezone: string | null) {
    await migrationPrisma.shop.update({
      where: { id: shopId },
      data: { ianaTimezone },
    });
  }

  /** Runs `sql` as the app's database role inside `contextShopId`'s tenant context. */
  const asRuntime = (contextShopId: string, sql: string, params: unknown[] = []) =>
    withRuntimePg(async (client) => {
      await client.query("BEGIN");
      try {
        await client.query(`SELECT set_config('stocky.current_shop_id', $1, true)`, [
          contextShopId,
        ]);
        await client.query(`SELECT set_config('stocky.tenant_context_version', $1, true)`, [
          TENANT_DB_CONTEXT_VERSION,
        ]);
        return await client.query(sql, params);
      } finally {
        await client.query("ROLLBACK");
      }
    });

  beforeAll(async () => {
    const ctx = await resetAndEnforce();
    migrationPrisma = ctx.migrationPrisma;
    await ctx.runtimePrisma.$disconnect();
    const shops = await seedTwoShops(migrationPrisma);
    shopAId = shops.shopA.id;
    shopBId = shops.shopB.id;
    await setTimeZone(shopAId, NEW_YORK);
    await setTimeZone(shopBId, AUCKLAND);
    await seedCatalog(migrationPrisma, shopAId, 1);
    await seedCatalog(migrationPrisma, shopBId, 10);
  }, 180_000);

  afterEach(() => {
    catalogReady = true;
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await migrationPrisma?.$disconnect();
  });

  it("captures the day that just ended in the shop's time zone", async () => {
    const outcome = await captureDueStockSnapshot(tenantA(), NEW_YORK_MIDNIGHT, deps);

    expect(outcome).toEqual({
      status: "captured",
      localDate: "2026-11-19",
      levelCount: 5,
      prunedDays: 0,
    });
    const snapshots = await dbA().dailyStockSnapshot.findMany({});
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      shopId: shopAId,
      localDate: "2026-11-19",
      timeZone: NEW_YORK,
      dayEndedAt: new Date("2026-11-20T05:00:00Z"),
      capturedAt: NEW_YORK_MIDNIGHT,
      levelCount: 5,
    });
  });

  it("lists tracked variants at their active locations, with unknown quantities left unknown", async () => {
    expect(await levelsOf(dbA(), "2026-11-19")).toEqual(expectedLevels(1));
  });

  it("leaves a shop alone while its own day is still running", async () => {
    expect(await captureDueStockSnapshot(tenantB(), NEW_YORK_MIDNIGHT, deps)).toEqual({
      status: "not_due",
    });
    expect(await dbB().dailyStockSnapshot.count({})).toBe(0);
    expect(await dbB().dailyStockLevel.count({})).toBe(0);
  });

  it("captures each shop on its own calendar", async () => {
    expect(await captureDueStockSnapshot(tenantB(), AUCKLAND_MIDNIGHT, deps)).toEqual({
      status: "captured",
      localDate: "2026-11-20",
      levelCount: 5,
      prunedDays: 0,
    });
    // New York's 19 Nov ended six hours and twenty minutes ago.
    expect(await captureDueStockSnapshot(tenantA(), AUCKLAND_MIDNIGHT, deps)).toEqual({
      status: "not_due",
    });
  });

  it("keeps two shops with the same Shopify ids apart", async () => {
    expect(await levelsOf(dbB(), "2026-11-20")).toEqual(expectedLevels(10));
    expect(await levelsOf(dbB(), "2026-11-19")).toEqual([]);
    expect(await levelsOf(dbA(), "2026-11-20")).toEqual([]);
    expect(
      await dbA().dailyStockSnapshot.findFirst({ where: { shopId: shopBId } }),
    ).toBeNull();

    // Without a tenant context the app's database role sees no history at all.
    const unscoped = await withRuntimePg((client) =>
      client.query(`SELECT count(*)::int AS n FROM "DailyStockLevel"`),
    );
    expect(unscoped.rows[0].n).toBe(0);
    const scoped = await asRuntime(
      shopAId,
      `SELECT DISTINCT "shopId" FROM "DailyStockLevel"`,
    );
    expect(scoped.rows).toEqual([{ shopId: shopAId }]);
  });

  it("refuses rows written for another shop", async () => {
    const insertLevel = (contextShopId: string, rowShopId: string, localDate: string) =>
      asRuntime(
        contextShopId,
        `INSERT INTO "DailyStockLevel"
           ("id", "shopId", "localDate", "variantGid", "locationGid", "priceAmount", "priceCurrencyCode")
         VALUES ('foreign-level', $1, $2, $3, $4, 1, 'USD')`,
        [rowShopId, localDate, variantGid(999), MAIN],
      );

    await expect(insertLevel(shopAId, shopBId, "2026-11-20")).rejects.toThrow(
      /row-level security/,
    );
    // Shop A has no snapshot of 20 Nov; shop B's does not count.
    await expect(insertLevel(shopAId, shopAId, "2026-11-20")).rejects.toThrow(
      /DailyStockLevel_shopId_localDate_fkey/,
    );
    await expect(
      asRuntime(
        shopAId,
        `INSERT INTO "DailyStockSnapshot"
           ("id", "shopId", "localDate", "timeZone", "dayEndedAt", "capturedAt")
         VALUES ('foreign-day', $1, '2026-11-18', 'UTC', now(), now())`,
        [shopBId],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("writes nothing when the day was already captured", async () => {
    const later = new Date(NEW_YORK_MIDNIGHT.getTime() + 20 * 60_000);

    expect(await captureDueStockSnapshot(tenantA(), later, deps)).toEqual({
      status: "already_captured",
      localDate: "2026-11-19",
    });
    const snapshots = await dbA().dailyStockSnapshot.findMany({});
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].capturedAt).toEqual(NEW_YORK_MIDNIGHT);
    expect(await dbA().dailyStockLevel.count({})).toBe(5);
  });

  it("keeps a captured day as it was when stock, cost and price change", async () => {
    await migrationPrisma.shopifyInventoryLevelFact.updateMany({
      where: { shopId: shopAId, inventoryItemGid: itemGid(201), locationGid: MAIN },
      data: { availableQuantity: 400, onHandQuantity: 600 },
    });
    await migrationPrisma.shopifyInventoryItemFact.updateMany({
      where: { shopId: shopAId, shopifyGid: itemGid(201) },
      data: { unitCostAmount: "11.00" },
    });
    await migrationPrisma.shopifyVariantFact.updateMany({
      where: { shopId: shopAId, shopifyGid: MERLOT },
      data: { priceAmount: "25.00" },
    });
    const day = snapshotDayDue(NEW_YORK_MIDNIGHT, NEW_YORK);
    if (!day) throw new Error("expected a due day");

    expect(
      await captureStockSnapshot(dbA(), {
        day,
        timeZone: NEW_YORK,
        capturedAt: new Date(NEW_YORK_MIDNIGHT.getTime() + 60 * 60_000),
      }),
    ).toEqual({ captured: false });
    expect(await levelsOf(dbA(), "2026-11-19")).toEqual(expectedLevels(1));
  });

  it("refuses every change to a captured day", async () => {
    await expect(
      asRuntime(shopAId, `UPDATE "DailyStockLevel" SET "onHandQuantity" = 0`),
    ).rejects.toThrow(/daily_stock_history_immutable/);
    await expect(
      asRuntime(shopAId, `UPDATE "DailyStockSnapshot" SET "levelCount" = 0`),
    ).rejects.toThrow(/daily_stock_history_immutable/);
    await expect(
      dbA().dailyStockLevel.updateMany({ data: { onHandQuantity: 0 } }),
    ).rejects.toThrow(/daily_stock_history_immutable/);
    // The migration owner is refused as well.
    await expect(
      migrationPrisma.dailyStockSnapshot.updateMany({ data: { levelCount: 0 } }),
    ).rejects.toThrow(/daily_stock_history_immutable/);
    expect(await levelsOf(dbA(), "2026-11-19")).toEqual(expectedLevels(1));
    expect(
      await dbA().dailyStockSnapshot.findFirst({
        where: { localDate: "2026-11-19" },
        select: { levelCount: true },
      }),
    ).toMatchObject({ levelCount: 5 });
  });

  it("writes a day once when two workers capture it at the same moment", async () => {
    // 00:10 on 21 Nov in New York.
    const now = new Date("2026-11-21T05:10:00Z");
    const day = snapshotDayDue(now, NEW_YORK);
    if (!day) throw new Error("expected a due day");

    const results = await Promise.all(
      [dbA(), dbA(), dbA(), dbA()].map((db) =>
        captureStockSnapshot(db, { day, timeZone: NEW_YORK, capturedAt: now }),
      ),
    );

    expect(results.filter((result) => result.captured)).toEqual([
      { captured: true, levelCount: 5 },
    ]);
    expect(results.filter((result) => !result.captured)).toHaveLength(3);
    expect(await dbA().dailyStockSnapshot.count({ where: { localDate: "2026-11-20" } })).toBe(1);
    expect(await dbA().dailyStockLevel.count({ where: { localDate: "2026-11-20" } })).toBe(5);
    // The second day has the stock, cost and price as they are now.
    expect((await levelsOf(dbA(), "2026-11-20"))[0]).toEqual([
      MERLOT,
      MAIN,
      400,
      600,
      "11",
      "USD",
      "25",
    ]);
  });

  it("does not capture while the shop's time zone is unknown or not a real zone", async () => {
    // 00:10 on 22 Nov in New York.
    const now = new Date("2026-11-22T05:10:00Z");

    for (const zone of [null, "  ", "Mars/Olympus_Mons"]) {
      await setTimeZone(shopAId, zone);
      expect(await captureDueStockSnapshot(tenantA(), now, deps)).toEqual({
        status: "time_zone_unknown",
      });
    }
    await setTimeZone(shopAId, NEW_YORK);
    expect(await dbA().dailyStockSnapshot.count({ where: { localDate: "2026-11-21" } })).toBe(0);
  });

  it("waits for the first import to finish, then captures inside the window", async () => {
    const now = new Date("2026-11-22T05:10:00Z");
    catalogReady = false;

    expect(await captureDueStockSnapshot(tenantA(), now, deps)).toEqual({
      status: "catalog_not_ready",
      localDate: "2026-11-21",
    });
    expect(await dbA().dailyStockSnapshot.count({ where: { localDate: "2026-11-21" } })).toBe(0);
    expect(await dbA().dailyStockLevel.count({ where: { localDate: "2026-11-21" } })).toBe(0);

    catalogReady = true;
    const tenMinutesLater = new Date(now.getTime() + 10 * 60_000);
    expect(await captureDueStockSnapshot(tenantA(), tenMinutesLater, deps)).toMatchObject({
      status: "captured",
      localDate: "2026-11-21",
    });
  });

  it("captures a day with no stock as an empty day, not a missing one", async () => {
    await migrationPrisma.shopifyInventoryLevelFact.updateMany({
      where: { shopId: shopBId },
      data: { isActive: false },
    });
    // 00:20 on 22 Nov in Auckland.
    const now = new Date("2026-11-21T11:20:00Z");

    expect(await captureDueStockSnapshot(tenantB(), now, deps)).toEqual({
      status: "captured",
      localDate: "2026-11-21",
      levelCount: 0,
      prunedDays: 0,
    });
    expect(
      await dbB().dailyStockSnapshot.findFirst({
        where: { localDate: "2026-11-21" },
        select: { levelCount: true },
      }),
    ).toMatchObject({ levelCount: 0 });
    await migrationPrisma.shopifyInventoryLevelFact.updateMany({
      where: { shopId: shopBId, locationGid: { in: [MAIN, WAREHOUSE] } },
      data: { isActive: true },
    });
  });

  it("drops days older than 400 days, with their levels, for that shop only", async () => {
    // 00:10 on 23 Nov in New York: the newest day becomes 22 Nov.
    const now = new Date("2026-11-23T05:10:00Z");
    const oldestKept = oldestRetainedDate("2026-11-22");
    const expired = addLocalDays(oldestKept, -1);
    const longExpired = addLocalDays(oldestKept, -30);
    expect(oldestKept).toBe("2025-10-19");

    for (const shopId of [shopAId, shopBId]) {
      for (const localDate of [oldestKept, expired, longExpired]) {
        const at = new Date(`${localDate}T12:00:00Z`);
        await migrationPrisma.dailyStockSnapshot.create({
          data: {
            shopId,
            localDate,
            timeZone: "UTC",
            dayEndedAt: at,
            capturedAt: at,
            levelCount: 1,
          },
        });
        await migrationPrisma.dailyStockLevel.create({
          data: {
            shopId,
            localDate,
            variantGid: MERLOT,
            locationGid: MAIN,
            onHandQuantity: 3,
            priceAmount: "20.00",
            priceCurrencyCode: "USD",
          },
        });
      }
    }

    expect(await captureDueStockSnapshot(tenantA(), now, deps)).toEqual({
      status: "captured",
      localDate: "2026-11-22",
      levelCount: 5,
      prunedDays: 2,
    });

    const datesOf = async (db: TenantDb) =>
      (
        (await db.dailyStockSnapshot.findMany({
          select: { localDate: true },
          orderBy: { localDate: "asc" },
        })) as Array<{ localDate: string }>
      ).map((row) => row.localDate);
    expect(await datesOf(dbA())).toEqual([
      oldestKept,
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]);
    expect(await dbA().dailyStockLevel.count({ where: { localDate: { lt: oldestKept } } })).toBe(0);
    expect(await dbA().dailyStockLevel.count({ where: { localDate: oldestKept } })).toBe(1);
    // Shop B captured nothing new, so nothing of its history was pruned.
    expect(await datesOf(dbB())).toEqual([
      longExpired,
      expired,
      oldestKept,
      "2026-11-20",
      "2026-11-21",
    ]);
    expect(await dbB().dailyStockLevel.count({ where: { localDate: { lt: oldestKept } } })).toBe(2);
  });

  it("goes over every shop and carries on when one fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    // 00:20 on 23 Nov in Auckland; New York is in the middle of 22 Nov.
    const now = new Date("2026-11-22T11:20:00Z");
    const failingForA: SnapshotDeps = {
      ...deps,
      readTimeZone: async (tenant) => {
        if (tenant.shopId === shopAId) throw new Error("shop row unreadable");
        return deps.readTimeZone(tenant);
      },
    };

    expect(await runDailyStockSnapshots({ now, deps: failingForA })).toEqual({
      shops: 2,
      captured: 1,
      levels: 5,
      waiting: 0,
      failed: 1,
    });
    expect(error).toHaveBeenCalledWith(
      `Daily stock snapshot failed for ${SHOP_A_DOMAIN}:`,
      "shop row unreadable",
    );
    expect(await levelsOf(dbB(), "2026-11-22")).toEqual(expectedLevels(10));

    // The next pass finds nothing left to do.
    expect(await runDailyStockSnapshots({ now, deps })).toEqual({
      shops: 2,
      captured: 0,
      levels: 0,
      waiting: 0,
      failed: 0,
    });
  });

  it("skips shops that are no longer being processed", async () => {
    await migrationPrisma.shop.update({
      where: { id: shopBId },
      data: {
        processingEnabled: false,
        processingDisabledReason: "UNINSTALLED",
        processingDisabledAt: new Date("2026-11-23T00:00:00Z"),
        uninstalledAt: new Date("2026-11-23T00:00:00Z"),
      },
    });
    // 00:20 on 24 Nov in Auckland.
    const now = new Date("2026-11-23T11:20:00Z");

    expect(await runDailyStockSnapshots({ now, deps })).toMatchObject({
      shops: 1,
      captured: 0,
    });
    expect(await dbB().dailyStockSnapshot.count({ where: { localDate: "2026-11-23" } })).toBe(0);
  });
});
