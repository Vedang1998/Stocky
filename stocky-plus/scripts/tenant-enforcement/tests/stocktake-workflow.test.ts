/**
 * The stocktake workflow against the inventory ledger: starting full and
 * partial counts, counting by hand and by scan, missed items, movement
 * review, completion, cancellation and the read side — disposable
 * PostgreSQL 16 with RLS applied, and the in-memory Shopify double from the
 * ledger suite.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { MAX_OPERATION_LINES } from "../../../app/services/inventory-writes/payload";
import type { ReadLevelQuantities } from "../../../app/services/inventory-writes/shopify-levels.server";
import type { InventoryActor } from "../../../app/services/inventory-writes/types";
import {
  getStocktake,
  getStocktakeLines,
  getStocktakeProgress,
  listStocktakeLinesForExport,
  listStocktakes,
  STOCKTAKE_LINE_PAGE_SIZE,
} from "../../../app/services/stocktakes/stocktake-read.server";
import {
  addStocktakeItems,
  cancelStocktake,
  clearZeroFill,
  completeStocktake,
  createStocktake,
  MAX_ADDED_ITEMS,
  MAX_COUNTED_QUANTITY,
  recordStocktakeScan,
  resolveStocktakeMovement,
  saveStocktakeCount,
  zeroFillUncounted,
  type CompleteStocktakeOptions,
} from "../../../app/services/stocktakes/stocktake.server";
import { resolveAuthorityAfterVerifiedAuth } from "../../../app/tenant/bootstrap.server";
import {
  createTenantDb,
  type TenantDb,
} from "../../../app/tenant/tenant-db.server";
import { FakeShopify, item, location } from "./fake-shopify-inventory";
import { resetSchemaAndApplyEnforcement } from "./helpers";
import {
  completeInventoryItemData,
  completeInventoryLevelData,
  completeLocationData,
} from "./pr5-f3-test-helpers";

const SHOP_A = "stocktake-workflow-a.myshopify.com";
const SHOP_B = "stocktake-workflow-b.myshopify.com";

const variant = (n: number) => `gid://shopify/ProductVariant/${n}`;
const RED = variant(1);
const WHITE = variant(2);
const ROSE = variant(3);
const CIDER = variant(4);
const PORT = variant(6);
const GIN = variant(7);
const TWIN_A = variant(8);
const TWIN_B = variant(9);
const OTHER_SHOPS = variant(99);

const CELLAR = location(11);
const SHOPFRONT = location(12);
const INACTIVE = location(13);
const EMPTY_ROOM = location(14);
const WAREHOUSE = location(15);
const OTHER_SHOPS_LOCATION = location(21);

const STAFF: InventoryActor = {
  shopifyUserId: "42",
  displayName: null,
  channel: "ADMIN",
};
const COUNTER: InventoryActor = { ...STAFF, shopifyUserId: "77" };
const NOW = new Date("2026-11-12T09:00:00.000Z");
const fixedClock = { now: () => NOW };

const CLOSED_MESSAGE =
  "This count is closed. Its lines can no longer be changed.";

/** Synced quantities at the start of every test: [item, location, on hand, available]. */
const SYNCED_LEVELS: Array<[number, number, number | null, number | null]> = [
  [101, 11, 10, 8],
  [102, 11, 20, 20],
  // Rosé is stocked in the cellar but its quantities have not synced yet.
  [103, 11, null, null],
  // Cider is not tracked for inventory.
  [104, 11, 3, 3],
  // Item 105 has no catalog variant.
  [105, 11, 4, 4],
  [101, 12, 99, 99],
  // Port is stocked at the shopfront only.
  [106, 12, 7, 7],
];

describe("stocktake workflow", () => {
  let prisma: PrismaClient;
  let dbA: TenantDb;
  let dbB: TenantDb;
  let shopAId: string;
  let shopify: FakeShopify;
  /** Items Shopify stocks in the cellar, for the live quantity read. */
  let stockedInShopify: Set<number>;
  /** `item@location` pairs Shopify does not stock outside the cellar. */
  let unstockedElsewhere: Set<string>;

  const readQuantities: ReadLevelQuantities = async (
    locationId,
    inventoryItemIds,
  ) =>
    new Map(
      inventoryItemIds.map((id) => {
        const itemNumber = Number(id.split("/").pop());
        const locationNumber = Number(locationId.split("/").pop());
        return [
          id,
          (
            locationNumber === 11
              ? stockedInShopify.has(itemNumber)
              : !unstockedElsewhere.has(`${itemNumber}@${locationNumber}`)
          )
            ? shopify.level(itemNumber, locationNumber)
            : null,
        ];
      }),
    );

  // Putting items on a sheet reads their expected quantity from the fake Shopify.
  const start = (
    db: TenantDb,
    input: Parameters<typeof createStocktake>[2],
    options: Parameters<typeof createStocktake>[3] = {},
  ) => createStocktake(db, null, input, { readQuantities, ...options });
  const scan = (
    db: TenantDb,
    input: Parameters<typeof recordStocktakeScan>[2],
    options: Parameters<typeof recordStocktakeScan>[3] = {},
  ) => recordStocktakeScan(db, null, input, { readQuantities, ...options });
  const saveCount = (
    db: TenantDb,
    input: Parameters<typeof saveStocktakeCount>[2],
    options: Parameters<typeof saveStocktakeCount>[3] = {},
  ) => saveStocktakeCount(db, null, input, { readQuantities, ...options });
  const addItems = (
    db: TenantDb,
    input: Parameters<typeof addStocktakeItems>[2],
  ) => addStocktakeItems(db, null, input, { readQuantities });

  const enabled = (
    extra: Partial<CompleteStocktakeOptions> = {},
  ): CompleteStocktakeOptions => ({
    sendBatch: shopify.send,
    isCapabilityEnabled: () => true,
    readQuantities,
    ...extra,
  });

  /** Shopify refuses the change at `index` of the next request and applies nothing. */
  function rejectNextChangeAt(index: number) {
    shopify.next(() => ({
      kind: "rejected",
      errors: [
        {
          code: "ITEM_NOT_STOCKED_AT_LOCATION",
          message: "The item is not stocked at the location.",
          changeIndex: index,
        },
      ],
    }));
  }

  const operations = (id: string) =>
    prisma.inventoryOperation.findMany({
      where: { sourceType: "Stocktake", sourceId: id },
      orderBy: { createdAt: "asc" },
      include: { lines: { orderBy: { lineNumber: "asc" } } },
    });

  const status = async (id: string) =>
    (await prisma.stocktake.findUniqueOrThrow({ where: { id } })).status;

  const lineOf = (stocktakeId: string, shopifyVariantId: string) =>
    prisma.stocktakeLineItem.findFirstOrThrow({
      where: { stocktakeId, shopifyVariantId },
    });

  async function setSynced(
    itemNumber: number,
    quantities: { onHand?: number | null; available?: number | null },
    locationNumber = 11,
  ) {
    await prisma.shopifyInventoryLevelFact.updateMany({
      where: {
        shopId: shopAId,
        inventoryItemGid: item(itemNumber),
        locationGid: location(locationNumber),
      },
      data: {
        ...(quantities.onHand !== undefined
          ? { onHandQuantity: quantities.onHand }
          : {}),
        ...(quantities.available !== undefined
          ? { availableQuantity: quantities.available }
          : {}),
      },
    });
  }

  /** A full count of the cellar: Red wine (10 expected) and White wine (20 expected). */
  async function startCount(
    extra: { blind?: boolean; name?: string | null } = {},
  ) {
    const created = await start(
      dbA,
      {
        shop: SHOP_A,
        locationId: CELLAR,
        name: extra.name ?? "Cellar",
        blind: extra.blind,
        actor: STAFF,
      },
      fixedClock,
    );
    if (!created.ok) throw new Error(created.error);
    const lines = await prisma.stocktakeLineItem.findMany({
      where: { stocktakeId: created.stocktakeId },
    });
    const lineFor = (shopifyVariantId: string) =>
      lines.find((l) => l.shopifyVariantId === shopifyVariantId)!.id;
    return { id: created.stocktakeId, lineFor, created };
  }

  async function startPartialCount() {
    const created = await start(dbA, {
      shop: SHOP_A,
      locationId: CELLAR,
      name: "Spot check",
      scope: "PARTIAL",
      actor: STAFF,
    });
    if (!created.ok) throw new Error(created.error);
    return created.stocktakeId;
  }

  async function count(lineId: string, countedQty: number | null) {
    expect(await saveCount(dbA, { lineId, countedQty })).toEqual({
      ok: true,
    });
  }

  const complete = (id: string, extra: Parameters<typeof enabled>[0] = {}) =>
    completeStocktake(dbA, null, STAFF, id, enabled(extra));

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
    const [shopA, shopB] = await Promise.all([
      prisma.shop.create({
        data: { myshopifyDomain: SHOP_A, processingEnabled: true },
      }),
      prisma.shop.create({
        data: { myshopifyDomain: SHOP_B, processingEnabled: true },
      }),
    ]);
    shopAId = shopA.id;

    await prisma.shopifyLocationFact.createMany({
      data: [
        ...["11", "12", "14", "15"].map((id) =>
          completeLocationData({ id, shopId: shopA.id }),
        ),
        {
          ...completeLocationData({ id: "13", shopId: shopA.id }),
          isActive: false,
        },
        completeLocationData({ id: "21", shopId: shopB.id }),
      ],
    });
    await prisma.shopifyInventoryItemFact.createMany({
      data: [
        ...[101, 102, 103, 104, 105, 106].map((n) => ({
          ...completeInventoryItemData({ id: String(n), shopId: shopA.id }),
          shopifyVariantGid: null,
          tracked: n !== 104,
        })),
        {
          ...completeInventoryItemData({ id: "201", shopId: shopB.id }),
          shopifyVariantGid: null,
        },
      ],
    });
    await prisma.shopifyVariantCache.createMany({
      data: [
        { id: RED, title: "Red wine", sku: "RED-750", barcode: "1111", n: 101 },
        {
          id: WHITE,
          title: "White wine",
          sku: "WHT-750",
          barcode: "2222",
          n: 102,
        },
        { id: ROSE, title: "Rosé", sku: "ROS-750", barcode: "3333", n: 103 },
        { id: CIDER, title: "Cider", sku: "CID-330", barcode: "4444", n: 104 },
        { id: PORT, title: "Port", sku: "PRT-500", barcode: "6666", n: 106 },
        {
          id: GIN,
          title: "Unlinked gin",
          sku: "GIN-700",
          barcode: "7777",
          n: null,
        },
        { id: TWIN_A, title: "Twin A", sku: "TWN-A", barcode: "8888", n: null },
        { id: TWIN_B, title: "Twin B", sku: "TWN-B", barcode: "8888", n: null },
      ].map((v) => ({
        shop: SHOP_A,
        shopId: shopA.id,
        shopifyVariantId: v.id,
        title: v.title,
        sku: v.sku,
        barcode: v.barcode,
        inventoryItemId: v.n === null ? null : item(v.n),
      })),
    });
    await prisma.shopifyVariantCache.create({
      data: {
        shop: SHOP_B,
        shopId: shopB.id,
        shopifyVariantId: OTHER_SHOPS,
        title: "Other shop's whisky",
        sku: "RED-750",
        barcode: "1111",
        inventoryItemId: item(201),
      },
    });
    await prisma.shopifyInventoryLevelFact.create({
      data: {
        ...completeInventoryLevelData({
          id: "level-b",
          shopId: shopB.id,
          itemId: "201",
          locationId: "21",
        }),
        onHandQuantity: 50,
      },
    });

    const authority = async (domain: string) =>
      (
        await resolveAuthorityAfterVerifiedAuth({
          verifiedDomain: domain,
          source: "verified_admin_request",
          correlationId: "stocktake-workflow-test",
          createIfMissing: false,
        })
      ).tenant;
    dbA = createTenantDb(await authority(SHOP_A));
    dbB = createTenantDb(await authority(SHOP_B));
  }, 180_000);

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "InventoryOperationLine", "InventoryOperation",
         "StocktakeLineItem", "Stocktake" CASCADE`,
    );
    await prisma.shopifyInventoryLevelFact.deleteMany({
      where: { shopId: shopAId, locationGid: { not: WAREHOUSE } },
    });
    await prisma.shopifyInventoryLevelFact.createMany({
      data: SYNCED_LEVELS.map(
        ([itemNumber, locationNumber, onHand, available]) => ({
          ...completeInventoryLevelData({
            id: `level-${itemNumber}-${locationNumber}`,
            shopId: shopAId,
            itemId: String(itemNumber),
            locationId: String(locationNumber),
            available,
          }),
          onHandQuantity: onHand,
        }),
      ),
    });
    shopify = new FakeShopify();
    shopify.setLevel(101, 10, 11);
    shopify.setLevel(102, 20, 11);
    shopify.setLevel(103, 5, 11);
    // Rosé has a synced level in the cellar, but Shopify no longer stocks it there.
    stockedInShopify = new Set([101, 102]);
    unstockedElsewhere = new Set();
    shopify.setLevel(101, 99, 12);
    shopify.setLevel(106, 7, 12);
    shopify.setLevel(201, 50, 21);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  describe("starting a count", () => {
    it("lists every tracked, synced item stocked at the location with its on-hand quantity", async () => {
      const { id, created } = await startCount();

      expect(created).toEqual({
        ok: true,
        stocktakeId: id,
        lineCount: 2,
        expectedSource: "LIVE",
        skippedUnsynced: 1,
        skippedUnlinked: 1,
      });
      const lines = await prisma.stocktakeLineItem.findMany({
        where: { stocktakeId: id },
        orderBy: { shopifyVariantId: "asc" },
      });
      expect(
        lines.map((l) => [
          l.shopifyVariantId,
          l.expectedQty,
          l.countedQty,
          l.expectedReadAt,
        ]),
      ).toEqual([
        [RED, 10, null, NOW],
        [WHITE, 20, null, NOW],
      ]);
      expect(
        await prisma.stocktake.findUniqueOrThrow({ where: { id } }),
      ).toMatchObject({
        name: "Cellar",
        locationId: CELLAR,
        status: "IN_PROGRESS",
        scope: "FULL",
        quantityBasis: "ON_HAND",
        expectedSource: "LIVE",
        blind: false,
        startedAt: NOW,
        startedByUserId: "42",
      });
    });

    it("names an unnamed count after the day it started and remembers a blind count", async () => {
      const created = await start(
        dbA,
        { shop: SHOP_A, locationId: CELLAR, name: "  ", blind: true },
        fixedClock,
      );

      expect(created.ok).toBe(true);
      expect(await prisma.stocktake.findFirstOrThrow()).toMatchObject({
        name: "Count 2026-11-12",
        blind: true,
        startedByUserId: null,
      });
    });

    it("starts a partial count with an empty sheet", async () => {
      const id = await startPartialCount();

      expect(
        await prisma.stocktake.findUniqueOrThrow({ where: { id } }),
      ).toMatchObject({ scope: "PARTIAL", quantityBasis: "ON_HAND" });
      expect(await prisma.stocktakeLineItem.count()).toBe(0);
    });

    it.each([
      ["a deactivated location", { locationId: INACTIVE }],
      ["another shop's location", { locationId: OTHER_SHOPS_LOCATION }],
      ["no location", { locationId: null }],
      ["an unknown kind of count", { locationId: CELLAR, scope: "EVERYTHING" }],
      [
        "a name that is too long",
        { locationId: CELLAR, name: "x".repeat(121) },
      ],
    ])("does not start a count with %s", async (_label, input) => {
      const result = await start(dbA, {
        shop: SHOP_A,
        name: null,
        ...input,
      });

      expect(result.ok).toBe(false);
      expect(await prisma.stocktake.count()).toBe(0);
    });

    it("does not start a full count where nothing can be counted, and says why", async () => {
      expect(
        await start(dbA, {
          shop: SHOP_A,
          locationId: EMPTY_ROOM,
          name: null,
        }),
      ).toEqual({
        ok: false,
        error:
          "No tracked items are stocked at this location in Shopify, so there is nothing to count. To count specific items, start a partial count.",
      });

      unstockedElsewhere.add("101@12").add("106@12");
      expect(
        await start(dbA, {
          shop: SHOP_A,
          locationId: SHOPFRONT,
          name: null,
        }),
      ).toEqual({
        ok: false,
        error:
          "Shopify has no on-hand quantity for the items synced at this location. Run a sync from the dashboard, then start the count again.",
      });
      expect(await prisma.stocktake.count()).toBe(0);
    });
  });

  describe("expected quantities", () => {
    const unreadable: ReadLevelQuantities = async () => {
      throw new Error("Throttled");
    };

    /** A full count of the cellar started without a live read, as a location too large to read is. */
    async function startFromSync() {
      const created = await createStocktake(
        dbA,
        null,
        { shop: SHOP_A, locationId: CELLAR, name: "Cellar", actor: STAFF },
        fixedClock,
      );
      if (!created.ok) throw new Error(created.error);
      expect(created.expectedSource).toBe("SYNC");
      return created.stocktakeId;
    }

    // Issue #119: one red was sold a moment ago. Shopify has 9; the sync still says 10.
    it("starts from Shopify's quantity when the synced quantity is behind, so Shopify ends at what was counted", async () => {
      shopify.setLevel(101, 9, 11);
      const { id, lineFor } = await startCount();
      expect((await lineOf(id, RED)).expectedQty).toBe(9);

      await count(lineFor(RED), 10);
      await count(lineFor(WHITE), 20);
      expect(await complete(id)).toEqual({ ok: true, alreadyCompleted: false });

      expect(shopify.level(101)).toBe(10);
      const [operation] = await operations(id);
      expect(operation.lines.map((l) => [l.inventoryItemGid, l.delta])).toEqual(
        [[item(101), 1]],
      );
    });

    it("does not start a count when Shopify cannot be read", async () => {
      expect(
        await start(
          dbA,
          { shop: SHOP_A, locationId: CELLAR, name: null },
          { readQuantities: unreadable },
        ),
      ).toEqual({
        ok: false,
        error:
          "Shopify's current quantities could not be read, so the count was not started. Try again in a moment.",
      });
      expect(await prisma.stocktake.count()).toBe(0);
    });

    it("reads a scanned or added item's quantity from Shopify, not from the sync", async () => {
      const id = await startPartialCount();
      await setSynced(101, { onHand: 10 });
      shopify.setLevel(101, 9, 11);
      shopify.setLevel(102, 18, 11);

      await scan(dbA, { stocktakeId: id, code: "1111" }, fixedClock);
      await addItems(dbA, { stocktakeId: id, codesText: "WHT-750" });

      expect(await lineOf(id, RED)).toMatchObject({
        expectedQty: 9,
        expectedReadAt: NOW,
      });
      expect((await lineOf(id, WHITE)).expectedQty).toBe(18);
      expect((await lineOf(id, WHITE)).expectedReadAt).not.toBeNull();
    });

    it("adds nothing to the sheet when Shopify cannot be read", async () => {
      const id = await startPartialCount();
      const error =
        "Shopify's current quantities could not be read. Nothing was changed. Try again in a moment.";

      expect(
        await recordStocktakeScan(
          dbA,
          null,
          { stocktakeId: id, code: "1111" },
          { readQuantities: unreadable },
        ),
      ).toEqual({ ok: false, error });
      expect(
        await addStocktakeItems(
          dbA,
          null,
          { stocktakeId: id, codesText: "1111" },
          { readQuantities: unreadable },
        ),
      ).toEqual({ ok: false, error, details: [] });
      expect(await prisma.stocktakeLineItem.count()).toBe(0);
    });

    it("keeps synced quantities unread until each item is counted, then measures from Shopify", async () => {
      const id = await startFromSync();
      expect(await lineOf(id, RED)).toMatchObject({
        expectedQty: 10,
        expectedReadAt: null,
      });
      // The sync is one red and two whites behind Shopify.
      shopify.setLevel(101, 9, 11);
      shopify.setLevel(102, 18, 11);

      await saveCount(
        dbA,
        { lineId: (await lineOf(id, RED)).id, countedQty: 10 },
        fixedClock,
      );
      await scan(dbA, { stocktakeId: id, code: "2222", quantity: 18 });

      expect(await lineOf(id, RED)).toMatchObject({
        expectedQty: 9,
        expectedReadAt: NOW,
        countedQty: 10,
      });
      expect(await lineOf(id, WHITE)).toMatchObject({
        expectedQty: 18,
        countedQty: 18,
      });
      expect(await complete(id)).toEqual({ ok: true, alreadyCompleted: false });
      expect([shopify.level(101), shopify.level(102)]).toEqual([10, 18]);
    });

    it("reads an item once: a later count does not move its expected quantity", async () => {
      const id = await startFromSync();
      const red = (await lineOf(id, RED)).id;
      shopify.setLevel(101, 9, 11);
      await count(red, 10);
      // Two reds are sold after the item was counted.
      shopify.setLevel(101, 7, 11);

      await count(red, 11);
      await scan(dbA, { stocktakeId: id, code: "1111" });

      expect(await lineOf(id, RED)).toMatchObject({
        expectedQty: 9,
        countedQty: 12,
      });
      expect(await complete(id, { acceptUncounted: true })).toMatchObject({
        blocker: "MOVEMENT",
      });
      expect((await lineOf(id, RED)).movementDetectedQty).toBe(7);
    });

    it("saves a count while Shopify cannot be read, and reads the item when the count is completed", async () => {
      const id = await startFromSync();
      const red = (await lineOf(id, RED)).id;
      shopify.setLevel(101, 9, 11);

      expect(
        await saveStocktakeCount(
          dbA,
          null,
          { lineId: red, countedQty: 10 },
          { readQuantities: unreadable },
        ),
      ).toEqual({ ok: true });
      expect(await lineOf(id, RED)).toMatchObject({
        expectedQty: 10,
        expectedReadAt: null,
        countedQty: 10,
      });

      expect(await complete(id, { acceptUncounted: true })).toEqual({
        ok: true,
        alreadyCompleted: false,
      });
      expect((await lineOf(id, RED)).expectedQty).toBe(9);
      expect(shopify.level(101)).toBe(10);
    });

    it("takes items marked as zero to zero from Shopify's quantity, not the synced one", async () => {
      const id = await startFromSync();
      shopify.setLevel(101, 9, 11);
      shopify.setLevel(102, 23, 11);
      await zeroFillUncounted(dbA, { stocktakeId: id });

      expect(await complete(id)).toEqual({ ok: true, alreadyCompleted: false });

      expect([shopify.level(101), shopify.level(102)]).toEqual([0, 0]);
      const [operation] = await operations(id);
      expect(operation.lines.map((l) => l.delta).sort()).toEqual([-23, -9]);
    });

    it("does not keep asking for an item Shopify no longer stocks at the location", async () => {
      const id = await startFromSync();
      stockedInShopify.delete(101);
      await saveCount(dbA, {
        lineId: (await lineOf(id, RED)).id,
        countedQty: 10,
      });
      expect((await lineOf(id, RED)).expectedReadAt).toBeNull();

      expect(await complete(id, { acceptUncounted: true })).toEqual({
        ok: true,
        alreadyCompleted: false,
      });
      expect(await lineOf(id, RED)).toMatchObject({ expectedQty: 10 });
      expect((await lineOf(id, RED)).expectedReadAt).not.toBeNull();
      expect(shopify.requests).toHaveLength(0);
    });

    it("sends nothing while unread quantities cannot be read from Shopify", async () => {
      const id = await startFromSync();
      await zeroFillUncounted(dbA, { stocktakeId: id });

      const error =
        "Shopify's current quantities could not be read, so the count was not completed. Nothing was sent to Shopify. Try again in a moment.";
      expect(await complete(id, { readQuantities: unreadable })).toEqual({
        ok: false,
        error,
        problems: [],
        blocker: null,
      });
      // With no way to read Shopify at all, synced quantities are not trusted either.
      expect(
        await completeStocktake(dbA, null, STAFF, id, {
          sendBatch: shopify.send,
          isCapabilityEnabled: () => true,
        }),
      ).toMatchObject({ ok: false, error });

      expect(shopify.requests).toHaveLength(0);
      expect(await status(id)).toBe("IN_PROGRESS");
    });

    it("stops a count whose quantities were read when Shopify cannot be read at completion", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      await count(lineFor(WHITE), 20);

      expect(await complete(id, { readQuantities: unreadable })).toMatchObject({
        ok: false,
        error: expect.stringContaining("could not be read"),
      });
      expect(shopify.requests).toHaveLength(0);
      expect(await complete(id)).toEqual({ ok: true, alreadyCompleted: false });
      expect(shopify.level(101)).toBe(7);
    });
  });

  describe("counting", () => {
    it("saves a count with who counted and when, and clears it again", async () => {
      const { id, lineFor } = await startCount();

      expect(
        await saveCount(
          dbA,
          {
            lineId: lineFor(RED),
            countedQty: 7,
            stocktakeId: id,
            actor: COUNTER,
          },
          fixedClock,
        ),
      ).toEqual({ ok: true });
      expect(await lineOf(id, RED)).toMatchObject({
        countedQty: 7,
        countSource: "MANUAL",
        countedAt: NOW,
        countedByUserId: "77",
      });

      await count(lineFor(RED), null);
      expect(await lineOf(id, RED)).toMatchObject({
        countedQty: null,
        countSource: null,
        countedAt: null,
        countedByUserId: null,
      });
    });

    it.each([-1, 1.5, MAX_COUNTED_QUANTITY + 1, Number.NaN])(
      "does not save %s as a count",
      async (countedQty) => {
        const { id, lineFor } = await startCount();

        const result = await saveCount(dbA, {
          lineId: lineFor(RED),
          countedQty,
        });

        expect(result).toEqual({
          ok: false,
          error:
            "Enter the counted quantity as a whole number from 0 to 1,000,000.",
        });
        expect((await lineOf(id, RED)).countedQty).toBeNull();
      },
    );

    it("does not save a count through another stocktake's page", async () => {
      const first = await startCount();
      const second = await startCount();

      expect(
        await saveCount(dbA, {
          lineId: first.lineFor(RED),
          countedQty: 3,
          stocktakeId: second.id,
        }),
      ).toEqual({ ok: false, error: "Stocktake line not found" });
      expect((await lineOf(first.id, RED)).countedQty).toBeNull();
    });

    it("adds each scan to the item's count, by barcode, SKU or variant ID", async () => {
      const { id, lineFor } = await startCount();

      expect(
        await scan(
          dbA,
          { stocktakeId: id, code: " 1111 ", actor: COUNTER },
          fixedClock,
        ),
      ).toEqual({
        ok: true,
        lineId: lineFor(RED),
        title: "Red wine",
        countedQty: 1,
        added: false,
      });
      await scan(dbA, {
        stocktakeId: id,
        code: "RED-750",
        quantity: 5,
      });
      const third = await scan(dbA, {
        stocktakeId: id,
        code: RED,
      });

      expect(third).toMatchObject({ ok: true, countedQty: 7 });
      expect(await lineOf(id, RED)).toMatchObject({
        countedQty: 7,
        countSource: "SCAN",
      });
      expect((await lineOf(id, WHITE)).countedQty).toBeNull();
    });

    it("puts a scanned item on a partial count with its on-hand quantity", async () => {
      const id = await startPartialCount();

      const scanned = await scan(
        dbA,
        { stocktakeId: id, code: "2222", quantity: 3, actor: COUNTER },
        fixedClock,
      );

      expect(scanned).toMatchObject({
        ok: true,
        title: "White wine",
        countedQty: 3,
        added: true,
      });
      expect(await prisma.stocktakeLineItem.findMany()).toEqual([
        expect.objectContaining({
          stocktakeId: id,
          shopifyVariantId: WHITE,
          expectedQty: 20,
          countedQty: 3,
          countSource: "SCAN",
          countedAt: NOW,
          countedByUserId: "77",
        }),
      ]);
    });

    it("keeps one line and every unit when the same item is scanned at once", async () => {
      const id = await startPartialCount();

      const scans = await Promise.all(
        Array.from({ length: 6 }, () =>
          scan(dbA, { stocktakeId: id, code: "1111" }),
        ),
      );

      expect(scans.every((scan) => scan.ok)).toBe(true);
      const lines = await prisma.stocktakeLineItem.findMany();
      expect(lines).toHaveLength(1);
      expect(lines[0].countedQty).toBe(6);
    });

    it.each([
      ["0000", "No item in this shop's catalog has the barcode or SKU 0000."],
      [
        "8888",
        "8888 matches 2 items (Twin A, Twin B). Use a barcode or SKU that only one item has.",
      ],
      [
        "GIN-700",
        "Shopify inventory is not linked yet for Unlinked gin. Run a catalog sync from the dashboard.",
      ],
      [
        "CID-330",
        "Cider is not tracked for inventory in Shopify, so it cannot be counted.",
      ],
      [
        "PRT-500",
        "Port is not stocked at this location in Shopify. Stock it at the location in Shopify first.",
      ],
      [
        "ROS-750",
        "Rosé is not stocked at this location in Shopify. Stock it at the location in Shopify first.",
      ],
      ["", "Scan or type a barcode or SKU."],
      ["x".repeat(192), "Scan or type a barcode or SKU."],
    ])("does not count a scan of %s", async (code, error) => {
      const { id } = await startCount();

      expect(await scan(dbA, { stocktakeId: id, code })).toEqual({
        ok: false,
        error,
      });
      expect(await prisma.stocktakeLineItem.count()).toBe(2);
      expect(
        await prisma.stocktakeLineItem.count({
          where: { countedQty: { not: null } },
        }),
      ).toBe(0);
    });

    it.each([0, -2, 1.5, MAX_COUNTED_QUANTITY + 1])(
      "does not count a scan of %s units",
      async (quantity) => {
        const { id } = await startCount();

        const scanned = await scan(dbA, {
          stocktakeId: id,
          code: "1111",
          quantity,
        });

        expect(scanned).toEqual({
          ok: false,
          error:
            "Enter the scanned quantity as a whole number from 1 to 1,000,000.",
        });
        expect((await lineOf(id, RED)).countedQty).toBeNull();
      },
    );

    it("does not let scans take a count above the limit", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), MAX_COUNTED_QUANTITY);

      expect(await scan(dbA, { stocktakeId: id, code: "1111" })).toEqual({
        ok: false,
        error: "Red wine would be counted above 1,000,000. Check its count.",
      });
      expect((await lineOf(id, RED)).countedQty).toBe(MAX_COUNTED_QUANTITY);
    });

    it("adds a pasted list of items once each, uncounted, with their on-hand quantities", async () => {
      const id = await startPartialCount();
      stockedInShopify.add(103);

      expect(
        await addItems(dbA, {
          stocktakeId: id,
          codesText: "RED-750\n\n  3333  \r\n1111\n",
        }),
      ).toEqual({ ok: true, added: 2, alreadyOnCount: 0 });
      expect(
        await addItems(dbA, {
          stocktakeId: id,
          codesText: `WHT-750\n${RED}`,
        }),
      ).toEqual({ ok: true, added: 1, alreadyOnCount: 1 });

      const lines = await prisma.stocktakeLineItem.findMany({
        orderBy: { shopifyVariantId: "asc" },
      });
      expect(
        lines.map((l) => [l.shopifyVariantId, l.expectedQty, l.countedQty]),
      ).toEqual([
        [RED, 10, null],
        [WHITE, 20, null],
        [ROSE, 5, null],
      ]);
    });

    it("adds nothing from a list with a line it cannot use, and names each one", async () => {
      const id = await startPartialCount();

      const result = await addItems(dbA, {
        stocktakeId: id,
        codesText: ["RED-750", "0000", "8888", "PRT-500", "GIN-700"].join("\n"),
      });

      expect(result).toEqual({
        ok: false,
        error: "Some lines could not be added. Nothing was added to the count.",
        details: [
          "Line 2: no item has the barcode or SKU 0000.",
          "Line 3: 8888 matches 2 items (Twin A, Twin B). Use a barcode or SKU that only one item has.",
          "Line 4: Port is not stocked at this location in Shopify. Stock it at the location in Shopify first.",
          "Line 5: Shopify inventory is not linked yet for Unlinked gin. Run a catalog sync from the dashboard.",
        ],
      });
      expect(await prisma.stocktakeLineItem.count()).toBe(0);
    });

    it("bounds a pasted list", async () => {
      const id = await startPartialCount();

      expect(
        await addItems(dbA, { stocktakeId: id, codesText: " \n " }),
      ).toMatchObject({
        ok: false,
        error: "Enter at least one barcode or SKU.",
      });
      expect(
        await addItems(dbA, {
          stocktakeId: id,
          codesText: Array.from(
            { length: MAX_ADDED_ITEMS + 1 },
            () => "RED-750",
          ).join("\n"),
        }),
      ).toMatchObject({
        ok: false,
        error: "Add at most 500 items at a time. This list has 501.",
      });
      expect(
        await addItems(dbA, { stocktakeId: id, codesText: 12 }),
      ).toMatchObject({ ok: false });
      expect(await prisma.stocktakeLineItem.count()).toBe(0);
    });

    it("marks uncounted items as zero and takes only those zeros back", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 0);

      expect(
        await zeroFillUncounted(
          dbA,
          { stocktakeId: id, actor: COUNTER },
          fixedClock,
        ),
      ).toEqual({ ok: true, lines: 1 });
      expect(await lineOf(id, WHITE)).toMatchObject({
        countedQty: 0,
        countSource: "ZERO_FILL",
        countedAt: NOW,
        countedByUserId: "77",
      });
      expect(await lineOf(id, RED)).toMatchObject({
        countedQty: 0,
        countSource: "MANUAL",
      });

      expect(await clearZeroFill(dbA, { stocktakeId: id })).toEqual({
        ok: true,
        lines: 1,
      });
      expect(await lineOf(id, WHITE)).toMatchObject({
        countedQty: null,
        countSource: null,
        countedAt: null,
        countedByUserId: null,
      });
      expect((await lineOf(id, RED)).countedQty).toBe(0);
    });

    it("keeps a zero-filled item that was then found and counted", async () => {
      const { id, lineFor } = await startCount();
      await zeroFillUncounted(dbA, { stocktakeId: id });
      await count(lineFor(WHITE), 19);

      expect(await clearZeroFill(dbA, { stocktakeId: id })).toEqual({
        ok: true,
        lines: 1,
      });
      expect((await lineOf(id, WHITE)).countedQty).toBe(19);
      expect((await lineOf(id, RED)).countedQty).toBeNull();
    });
  });

  describe("completing a count", () => {
    it("applies each variance once, closes the count and records who did it", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      await count(lineFor(WHITE), 20);

      const result = await complete(id, fixedClock);

      expect(result).toEqual({ ok: true, alreadyCompleted: false });
      expect(shopify.level(101)).toBe(7);
      expect(shopify.level(102)).toBe(20);
      expect(
        await prisma.stocktake.findUniqueOrThrow({ where: { id } }),
      ).toMatchObject({
        status: "COMPLETED",
        completedAt: NOW,
        completedByUserId: "42",
      });

      const [operation, ...rest] = await operations(id);
      expect(rest).toEqual([]);
      expect(operation).toMatchObject({
        kind: "STOCKTAKE",
        status: "APPLIED",
        reason: "cycle_count_available",
        quantityName: "available",
        actorShopifyUserId: "42",
        actorChannel: "ADMIN",
        idempotencyKey: `Stocktake:${id}:1`,
        referenceDocumentUri: `gid://propo/Stocktake/${id}`,
      });
      expect(
        operation.lines.map((l) => [
          l.inventoryItemGid,
          l.variantGid,
          l.locationGid,
          l.delta,
          l.status,
        ]),
      ).toEqual([[item(101), RED, CELLAR, -3, "APPLIED"]]);
    });

    it("does not complete while items have no count, unless they are left unchanged on purpose", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);

      expect(await complete(id)).toEqual({
        ok: false,
        error:
          "1 item on this count has no count. Count it, mark it as zero, or complete the count leaving it unchanged.",
        problems: [],
        blocker: "UNCOUNTED",
      });
      expect(shopify.requests).toHaveLength(0);
      expect(await prisma.inventoryOperation.count()).toBe(0);
      expect(await status(id)).toBe("IN_PROGRESS");

      expect(await complete(id, { acceptUncounted: true })).toEqual({
        ok: true,
        alreadyCompleted: false,
      });
      expect({ red: shopify.level(101), white: shopify.level(102) }).toEqual({
        red: 7,
        white: 20,
      });
    });

    it("takes zero-filled items out of stock", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 10);
      await zeroFillUncounted(dbA, { stocktakeId: id });

      expect(await complete(id)).toEqual({ ok: true, alreadyCompleted: false });

      expect({ red: shopify.level(101), white: shopify.level(102) }).toEqual({
        red: 10,
        white: 0,
      });
    });

    it("stops for review when stock moved during the count, and sends nothing", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 12);
      await count(lineFor(WHITE), 20);
      // Four bottles of red were fulfilled while the count was open.
      shopify.setLevel(101, 6, 11);

      const result = await complete(id);

      expect(result).toEqual({
        ok: false,
        error:
          "Stock moved in Shopify for 1 item while this count was open. Review it, then complete the count again. Nothing was sent to Shopify.",
        problems: [],
        blocker: "MOVEMENT",
      });
      expect(shopify.requests).toHaveLength(0);
      expect(await prisma.inventoryOperation.count()).toBe(0);
      expect(await status(id)).toBe("IN_PROGRESS");
      expect(await lineOf(id, RED)).toMatchObject({
        movementDetectedQty: 6,
        movementBaselineQty: null,
        movementReviewedAt: null,
      });
      expect((await lineOf(id, WHITE)).movementDetectedQty).toBeNull();

      // Pressing complete again changes nothing until the line is reviewed.
      expect(await complete(id)).toMatchObject({ blocker: "MOVEMENT" });
      expect(shopify.requests).toHaveLength(0);
    });

    it("measures from the starting quantity when the item was counted before the stock moved", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 12);
      await count(lineFor(WHITE), 20);
      shopify.setLevel(101, 6, 11);
      await complete(id);

      expect(
        await resolveStocktakeMovement(
          dbA,
          {
            stocktakeId: id,
            lineIds: [lineFor(RED)],
            resolution: "COUNTED_BEFORE",
          },
          fixedClock,
        ),
      ).toEqual({ ok: true, resolved: 1, remaining: 0 });
      expect(await lineOf(id, RED)).toMatchObject({
        movementDetectedQty: 6,
        movementBaselineQty: null,
        movementReviewedAt: NOW,
      });

      expect(await complete(id)).toEqual({ ok: true, alreadyCompleted: false });
      // 12 counted against 10 expected is two extra; the four sold stay sold.
      expect(shopify.level(101)).toBe(8);
    });

    it("measures from the moved quantity when the item was counted after the stock moved", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 12);
      await count(lineFor(WHITE), 20);
      shopify.setLevel(101, 6, 11);
      await complete(id);

      expect(
        await resolveStocktakeMovement(dbA, {
          stocktakeId: id,
          lineIds: null,
          resolution: "COUNTED_AFTER",
        }),
      ).toEqual({ ok: true, resolved: 1, remaining: 0 });
      expect(await lineOf(id, RED)).toMatchObject({
        movementDetectedQty: 6,
        movementBaselineQty: 6,
      });

      expect(await complete(id)).toEqual({ ok: true, alreadyCompleted: false });
      // The shelf held 12 when Shopify said 6.
      expect(shopify.level(101)).toBe(12);
      const [operation] = await operations(id);
      expect(operation.lines.map((l) => l.delta)).toEqual([6]);
    });

    it("finds movement on an item whose count matched", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 10);
      await count(lineFor(WHITE), 20);
      // A delivery of five whites was received; the sync has not caught up.
      shopify.setLevel(102, 25, 11);

      expect(await complete(id)).toMatchObject({ blocker: "MOVEMENT" });
      expect(await lineOf(id, WHITE)).toMatchObject({
        movementDetectedQty: 25,
      });

      await resolveStocktakeMovement(dbA, {
        stocktakeId: id,
        lineIds: null,
        resolution: "COUNTED_AFTER",
      });
      expect(await complete(id)).toEqual({ ok: true, alreadyCompleted: false });
      // Counted 20 after the delivery took Shopify to 25: five are missing.
      expect(shopify.level(102)).toBe(20);
    });

    it("asks again when a reviewed line is recounted to a different quantity, not when the same count is saved", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 12);
      await count(lineFor(WHITE), 20);
      shopify.setLevel(101, 6, 11);
      await complete(id);
      await resolveStocktakeMovement(dbA, {
        stocktakeId: id,
        lineIds: null,
        resolution: "COUNTED_AFTER",
      });

      await count(lineFor(RED), 12);
      expect(await lineOf(id, RED)).toMatchObject({ movementBaselineQty: 6 });

      await count(lineFor(RED), 11);
      expect(await lineOf(id, RED)).toMatchObject({
        movementDetectedQty: null,
        movementBaselineQty: null,
        movementReviewedAt: null,
      });
      expect(await complete(id)).toMatchObject({ blocker: "MOVEMENT" });
      expect(shopify.requests).toHaveLength(0);
    });

    it("drops the flag when Shopify's quantity is back where the count started", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 12);
      await count(lineFor(WHITE), 20);
      shopify.setLevel(101, 6, 11);
      await complete(id);
      // The fulfilment was cancelled and the bottles restocked.
      shopify.setLevel(101, 10, 11);

      expect(await complete(id)).toEqual({ ok: true, alreadyCompleted: false });
      expect(shopify.level(101)).toBe(12);
      expect((await lineOf(id, RED)).movementDetectedQty).toBeNull();
    });

    it("does not read an item Shopify no longer stocks as movement", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      await count(lineFor(WHITE), 20);
      stockedInShopify.delete(101);

      expect(await complete(id)).toEqual({ ok: true, alreadyCompleted: false });
      expect((await lineOf(id, RED)).movementDetectedQty).toBeNull();
    });

    it("reviews only lines that wait for review, and only with a known answer", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 12);
      await count(lineFor(WHITE), 20);
      shopify.setLevel(101, 6, 11);
      await complete(id);

      expect(
        await resolveStocktakeMovement(dbA, {
          stocktakeId: id,
          lineIds: null,
          resolution: "IGNORE",
        }),
      ).toEqual({
        ok: false,
        error:
          "Choose whether the item was counted before or after the stock moved.",
      });
      expect(
        await resolveStocktakeMovement(dbA, {
          stocktakeId: id,
          lineIds: [],
          resolution: "COUNTED_AFTER",
        }),
      ).toEqual({ ok: false, error: "Choose the lines to review." });
      expect(
        await resolveStocktakeMovement(dbA, {
          stocktakeId: id,
          lineIds: [lineFor(WHITE)],
          resolution: "COUNTED_AFTER",
        }),
      ).toEqual({ ok: true, resolved: 0, remaining: 1 });
      expect(
        await resolveStocktakeMovement(dbB, {
          stocktakeId: id,
          lineIds: null,
          resolution: "COUNTED_AFTER",
        }),
      ).toEqual({ ok: false, error: "Stocktake not found" });

      expect(await lineOf(id, WHITE)).toMatchObject({
        movementBaselineQty: null,
        movementReviewedAt: null,
      });
      expect(await lineOf(id, RED)).toMatchObject({
        movementBaselineQty: null,
        movementReviewedAt: null,
      });
    });

    it("sends nothing when a completed count is completed again", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      await count(lineFor(WHITE), 20);
      await complete(id);
      const sent = shopify.requests.length;

      const again = await complete(id);

      expect(again).toEqual({ ok: true, alreadyCompleted: true });
      expect(shopify.requests).toHaveLength(sent);
      expect(shopify.level(101)).toBe(7);
      expect(await operations(id)).toHaveLength(1);
    });

    it("applies the variance once when complete is pressed twice at the same time", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      await count(lineFor(WHITE), 20);

      const results = await Promise.all([complete(id), complete(id)]);

      expect(results.some((r) => r.ok)).toBe(true);
      expect(shopify.requests).toHaveLength(1);
      expect(shopify.level(101)).toBe(7);
      expect(await status(id)).toBe("COMPLETED");
      expect(await operations(id)).toHaveLength(1);
      expect(await complete(id)).toEqual({ ok: true, alreadyCompleted: true });
    });

    it("tells a second press that the first is still sending, not that the count stays open", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      await count(lineFor(WHITE), 20);
      let release!: () => void;
      const held = new Promise<void>((resolve) => (release = resolve));
      let reached!: () => void;
      const sending = new Promise<void>((resolve) => (reached = resolve));

      const first = complete(id, {
        sendBatch: async (request) => {
          reached();
          await held;
          return shopify.send(request);
        },
      });
      await sending;
      const second = await complete(id);
      release();

      expect(second).toEqual({
        ok: false,
        error:
          "These changes are being sent to Shopify right now, possibly by another request. Changes Shopify has confirmed are not sent twice. Reload the page in a moment to see the result, and try again if anything is left.",
        problems: [],
        blocker: null,
      });
      expect(await first).toEqual({ ok: true, alreadyCompleted: false });
      expect(shopify.requests).toHaveLength(1);
      expect(await status(id)).toBe("COMPLETED");
    });

    it("stays open after a partial failure and the retry sends only the refused line", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      await count(lineFor(WHITE), 25);
      rejectNextChangeAt(1);

      const failed = await complete(id);

      expect(failed).toEqual({
        ok: false,
        error:
          "Shopify did not accept 1 of 2 changes. Lines it accepted are recorded and will not be sent again. The count stays open.",
        problems: [
          {
            shopifyVariantId: WHITE,
            title: "White wine",
            message: "The item is not stocked at the location.",
          },
        ],
        blocker: null,
      });
      expect(await status(id)).toBe("IN_PROGRESS");
      expect({ red: shopify.level(101), white: shopify.level(102) }).toEqual({
        red: 7,
        white: 20,
      });

      // Red is now 7 in Shopify because of this count; that is not movement.
      const before = shopify.requests.length;
      const retried = await complete(id);

      expect(retried).toEqual({ ok: true, alreadyCompleted: false });
      expect((await lineOf(id, RED)).movementDetectedQty).toBeNull();
      expect(shopify.requests).toHaveLength(before + 1);
      expect(shopify.requests.at(-1)!.changes).toEqual([
        expect.objectContaining({ inventoryItemId: item(102), delta: 5 }),
      ]);
      expect({ red: shopify.level(101), white: shopify.level(102) }).toEqual({
        red: 7,
        white: 25,
      });
      const recorded = await operations(id);
      expect(recorded.map((o) => o.status)).toEqual([
        "PARTIALLY_APPLIED",
        "APPLIED",
      ]);
      expect(recorded[1].idempotencyKey).toBe(`Stocktake:${id}:2`);
    });

    it("resends the same request after a lost response instead of adjusting twice", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      await count(lineFor(WHITE), 20);
      shopify.loseNextResponse();

      const unknown = await complete(id);

      expect(unknown.ok).toBe(false);
      expect(await status(id)).toBe("IN_PROGRESS");
      expect(shopify.level(101)).toBe(7);

      const retried = await complete(id);

      expect(retried).toEqual({ ok: true, alreadyCompleted: false });
      expect(shopify.level(101)).toBe(7);
      expect(new Set(shopify.keys()).size).toBe(1);
      expect(await operations(id)).toHaveLength(1);
    });

    it("puts an applied variance back when the count is corrected after a partial failure", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      await count(lineFor(WHITE), 25);
      rejectNextChangeAt(1);
      await complete(id);
      expect(shopify.level(101)).toBe(7);

      // Both lines are recounted and match the expected quantity after all.
      await count(lineFor(RED), 10);
      await count(lineFor(WHITE), 20);

      const result = await complete(id);

      expect(result).toEqual({ ok: true, alreadyCompleted: false });
      expect({ red: shopify.level(101), white: shopify.level(102) }).toEqual({
        red: 10,
        white: 20,
      });
      expect(await status(id)).toBe("COMPLETED");
    });

    it("stays open when a count is saved mid-completion, then applies it on the next attempt", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      await count(lineFor(WHITE), 20);
      let interfered = false;

      const first = await complete(id, {
        sendBatch: async (request) => {
          if (!interfered) {
            interfered = true;
            await count(lineFor(WHITE), 18);
          }
          return shopify.send(request);
        },
      });

      expect(first).toEqual({
        ok: false,
        error:
          "A count was saved while this stocktake was being completed. Complete it again to apply the latest counts.",
        problems: [],
        blocker: null,
      });
      expect(await status(id)).toBe("IN_PROGRESS");
      expect({ red: shopify.level(101), white: shopify.level(102) }).toEqual({
        red: 7,
        white: 20,
      });

      expect(await complete(id)).toEqual({ ok: true, alreadyCompleted: false });
      expect({ red: shopify.level(101), white: shopify.level(102) }).toEqual({
        red: 7,
        white: 18,
      });
    });

    it("stays open when an item is added mid-completion and uncounted items were not accepted", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      await count(lineFor(WHITE), 20);
      stockedInShopify.add(103);
      let interfered = false;

      const first = await complete(id, {
        sendBatch: async (request) => {
          if (!interfered) {
            interfered = true;
            await addItems(dbA, {
              stocktakeId: id,
              codesText: "ROS-750",
            });
          }
          return shopify.send(request);
        },
      });

      expect(first).toMatchObject({ ok: false, blocker: null });
      expect(await status(id)).toBe("IN_PROGRESS");
      expect(await complete(id)).toMatchObject({ blocker: "UNCOUNTED" });
    });

    it("rejects every change once the count is closed", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      await count(lineFor(WHITE), 20);
      await complete(id);

      expect(
        await saveCount(dbA, { lineId: lineFor(RED), countedQty: 1 }),
      ).toEqual({ ok: false, error: CLOSED_MESSAGE });
      expect(await scan(dbA, { stocktakeId: id, code: "1111" })).toEqual({
        ok: false,
        error: CLOSED_MESSAGE,
      });
      expect(
        await addItems(dbA, { stocktakeId: id, codesText: "1111" }),
      ).toEqual({ ok: false, error: CLOSED_MESSAGE, details: [] });
      expect(await zeroFillUncounted(dbA, { stocktakeId: id })).toEqual({
        ok: false,
        error: CLOSED_MESSAGE,
      });
      expect(await clearZeroFill(dbA, { stocktakeId: id })).toEqual({
        ok: false,
        error: CLOSED_MESSAGE,
      });
      expect(
        await resolveStocktakeMovement(dbA, {
          stocktakeId: id,
          lineIds: null,
          resolution: "COUNTED_AFTER",
        }),
      ).toEqual({ ok: false, error: CLOSED_MESSAGE });
      expect(await cancelStocktake(dbA, { stocktakeId: id })).toEqual({
        ok: false,
        error: "Only a count that is in progress can be cancelled.",
      });
      expect((await lineOf(id, RED)).countedQty).toBe(7);
      expect(await status(id)).toBe("COMPLETED");
    });

    it("records and sends nothing while the kill switch is off", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      await count(lineFor(WHITE), 20);
      shopify.setLevel(101, 6, 11);

      const result = await complete(id, { isCapabilityEnabled: () => false });

      expect(result).toEqual({
        ok: false,
        error:
          "Stocktake inventory changes are switched off for this app. Nothing was sent to Shopify and the count stays open.",
        problems: [],
        blocker: null,
      });
      expect(shopify.requests).toHaveLength(0);
      expect(await prisma.inventoryOperation.count()).toBe(0);
      expect(await status(id)).toBe("IN_PROGRESS");
      expect((await lineOf(id, RED)).movementDetectedQty).toBeNull();
    });

    it("refuses to complete with no counts, an unlinked item, or a variant counted on two lines", async () => {
      const { id, lineFor } = await startCount();
      expect(await complete(id)).toMatchObject({
        ok: false,
        error: "Enter at least one count before completing.",
        blocker: null,
      });

      const shopId = (
        await prisma.stocktake.findUniqueOrThrow({ where: { id } })
      ).shopId;
      // Legacy sheets can hold an item that has lost its inventory link.
      const unlinked = await prisma.stocktakeLineItem.create({
        data: {
          stocktakeId: id,
          shopId,
          shopifyVariantId: GIN,
          expectedQty: 0,
          countedQty: 3,
        },
      });
      await count(lineFor(RED), 7);
      await count(lineFor(WHITE), 20);
      expect(await complete(id)).toMatchObject({
        ok: false,
        error: expect.stringContaining(
          "Shopify inventory is not linked yet for: Unlinked gin.",
        ),
      });
      await count(unlinked.id, 0);

      // Legacy data can hold the same variant twice; the app no longer adds it.
      await prisma.stocktakeLineItem.create({
        data: {
          stocktakeId: id,
          shopId,
          shopifyVariantId: RED,
          expectedQty: 10,
          countedQty: 4,
        },
      });
      expect(await complete(id)).toMatchObject({
        ok: false,
        error: expect.stringContaining("on the count more than once"),
      });

      expect(shopify.requests).toHaveLength(0);
      expect(await prisma.inventoryOperation.count()).toBe(0);
      expect(await status(id)).toBe("IN_PROGRESS");
    });

    it("sends a count with more variances than one operation holds in several operations", async () => {
      const total = MAX_OPERATION_LINES + 1;
      const numbers = Array.from({ length: total }, (_, i) => 100_000 + i);
      await prisma.shopifyInventoryItemFact.createMany({
        data: numbers.map((n) => ({
          ...completeInventoryItemData({ id: String(n), shopId: shopAId }),
          shopifyVariantGid: null,
        })),
      });
      await prisma.shopifyVariantCache.createMany({
        data: numbers.map((n) => ({
          shop: SHOP_A,
          shopId: shopAId,
          shopifyVariantId: variant(n),
          title: `Bulk ${n}`,
          inventoryItemId: item(n),
        })),
      });
      await prisma.shopifyInventoryLevelFact.createMany({
        data: numbers.map((n) => ({
          ...completeInventoryLevelData({
            id: `level-${n}-15`,
            shopId: shopAId,
            itemId: String(n),
            locationId: "15",
            available: 1,
          }),
          onHandQuantity: 1,
        })),
      });
      for (const n of numbers) shopify.setLevel(n, 1, 15);

      const created = await start(dbA, {
        shop: SHOP_A,
        locationId: WAREHOUSE,
        name: "Warehouse",
      });
      if (!created.ok) throw new Error(created.error);
      expect(created.lineCount).toBe(total);
      await zeroFillUncounted(dbA, { stocktakeId: created.stocktakeId });

      // A sheet this long starts from synced quantities; Shopify is read for
      // 2,000 items per attempt before anything is sent.
      expect(created.expectedSource).toBe("SYNC");
      expect(await complete(created.stocktakeId)).toEqual({
        ok: false,
        error:
          "Shopify's current quantities still have to be read for 3,001 items on this count. Complete the count again to continue. Nothing was sent to Shopify.",
        problems: [],
        blocker: null,
      });
      expect(await complete(created.stocktakeId)).toMatchObject({
        ok: false,
        error: expect.stringContaining("read for 1,001 items"),
      });
      expect(shopify.requests).toHaveLength(0);

      const result = await complete(created.stocktakeId, {
        deadlineMs: 120_000,
      });

      expect(result).toEqual({ ok: true, alreadyCompleted: false });
      const recorded = await prisma.inventoryOperation.findMany({
        where: { sourceId: created.stocktakeId },
        orderBy: { createdAt: "asc" },
      });
      expect(recorded.map((o) => [o.status, o.lineCount])).toEqual([
        ["APPLIED", MAX_OPERATION_LINES],
        ["APPLIED", 1],
      ]);
      expect(numbers.every((n) => shopify.level(n, 15) === 0)).toBe(true);
    }, 240_000);
  });

  describe("cancelling a count", () => {
    it("cancels an open count without touching Shopify and records who did it", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);

      expect(
        await cancelStocktake(
          dbA,
          { stocktakeId: id, actor: STAFF },
          fixedClock,
        ),
      ).toEqual({ ok: true, alreadyCancelled: false });

      expect(
        await prisma.stocktake.findUniqueOrThrow({ where: { id } }),
      ).toMatchObject({
        status: "CANCELLED",
        cancelledAt: NOW,
        cancelledByUserId: "42",
        completedAt: null,
      });
      expect(shopify.requests).toHaveLength(0);
      expect(await cancelStocktake(dbA, { stocktakeId: id })).toEqual({
        ok: true,
        alreadyCancelled: true,
      });
    });

    it("leaves a cancelled count closed to counting and completion", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      await count(lineFor(WHITE), 20);
      await cancelStocktake(dbA, { stocktakeId: id });

      expect(
        await saveCount(dbA, { lineId: lineFor(RED), countedQty: 1 }),
      ).toEqual({ ok: false, error: CLOSED_MESSAGE });
      expect(await complete(id)).toEqual({
        ok: false,
        error: "Only a count that is in progress can be completed.",
        problems: [],
        blocker: null,
      });
      expect(shopify.requests).toHaveLength(0);
      expect(shopify.level(101)).toBe(10);
    });

    it("does not cancel a count that has already changed stock in Shopify", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      await count(lineFor(WHITE), 25);
      rejectNextChangeAt(1);
      await complete(id);

      expect(await cancelStocktake(dbA, { stocktakeId: id })).toEqual({
        ok: false,
        error:
          "This count has already changed 1 item in Shopify, so it cannot be cancelled. Complete it, or set those counts back to their expected quantities and complete it to put the stock back.",
      });
      expect(await status(id)).toBe("IN_PROGRESS");
    });

    it("does not cancel while Shopify has not answered the last attempt", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      await count(lineFor(WHITE), 20);
      shopify.loseNextResponse();
      await complete(id);

      expect(await cancelStocktake(dbA, { stocktakeId: id })).toEqual({
        ok: false,
        error:
          "Shopify has not finished answering for this count's last attempt. Complete the count again first; it cannot be cancelled until then.",
      });
      expect(await status(id)).toBe("IN_PROGRESS");
    });

    it("sends nothing for a count cancelled while completion was being prepared", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      await count(lineFor(WHITE), 20);

      const result = await complete(id, {
        readQuantities: async (locationId, ids) => {
          await cancelStocktake(dbA, { stocktakeId: id });
          return readQuantities(locationId, ids);
        },
      });

      expect(result).toEqual({
        ok: false,
        error: "Only a count that is in progress can be completed.",
        problems: [],
        blocker: null,
      });
      expect(shopify.requests).toHaveLength(0);
      expect(await prisma.inventoryOperation.count()).toBe(0);
      expect(await status(id)).toBe("CANCELLED");
    });
  });

  describe("another shop", () => {
    it("has no way to see, count, complete or cancel the count", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      await count(lineFor(WHITE), 20);
      const notFound = { ok: false, error: "Stocktake not found" };

      expect(
        await saveCount(dbB, { lineId: lineFor(RED), countedQty: 0 }),
      ).toEqual({ ok: false, error: "Stocktake line not found" });
      expect(await scan(dbB, { stocktakeId: id, code: "1111" })).toEqual(
        notFound,
      );
      expect(
        await addItems(dbB, { stocktakeId: id, codesText: "1111" }),
      ).toEqual({ ...notFound, details: [] });
      expect(await zeroFillUncounted(dbB, { stocktakeId: id })).toEqual(
        notFound,
      );
      expect(await clearZeroFill(dbB, { stocktakeId: id })).toEqual(notFound);
      expect(await cancelStocktake(dbB, { stocktakeId: id })).toEqual(notFound);
      expect(await completeStocktake(dbB, null, STAFF, id, enabled())).toEqual({
        ...notFound,
        problems: [],
        blocker: null,
      });
      expect(await getStocktake(dbB, id)).toBeNull();
      expect(
        (await listStocktakes(dbB, { view: "open", page: 1 })).stocktakes,
      ).toEqual([]);
      expect(
        (
          await getStocktakeLines(dbB, {
            stocktakeId: id,
            filter: "all",
            search: "",
            page: 1,
          })
        ).lines,
      ).toEqual([]);
      expect(await listStocktakeLinesForExport(dbB, id)).toEqual([]);
      expect((await getStocktakeProgress(dbB, id)).lineCount).toBe(0);

      expect(shopify.requests).toHaveLength(0);
      expect(await status(id)).toBe("IN_PROGRESS");
      expect((await lineOf(id, RED)).countedQty).toBe(7);
    });

    it("counts its own item when both shops use the same barcode", async () => {
      const created = await start(dbB, {
        shop: SHOP_B,
        locationId: OTHER_SHOPS_LOCATION,
        name: null,
        scope: "PARTIAL",
      });
      if (!created.ok) throw new Error(created.error);

      expect(
        await scan(dbB, {
          stocktakeId: created.stocktakeId,
          code: "1111",
        }),
      ).toMatchObject({ ok: true, title: "Other shop's whisky", added: true });
      const line = await prisma.stocktakeLineItem.findFirstOrThrow({
        where: { stocktakeId: created.stocktakeId },
      });
      expect([line.shopifyVariantId, line.expectedQty]).toEqual([
        OTHER_SHOPS,
        50,
      ]);
    });
  });

  describe("reading counts", () => {
    it("lists open and closed counts with their progress, newest first", async () => {
      const first = await startCount({ name: "First" });
      await count(first.lineFor(RED), 7);
      const second = await startCount({ name: "Second" });
      await cancelStocktake(dbA, { stocktakeId: second.id });
      await prisma.stocktake.update({
        where: { id: first.id },
        data: { createdAt: new Date("2026-11-01T00:00:00Z") },
      });

      const open = await listStocktakes(dbA, { view: "open", page: 1 });
      const closed = await listStocktakes(dbA, { view: "closed", page: 1 });

      expect(open.hasMore).toBe(false);
      expect(open.stocktakes).toEqual([
        expect.objectContaining({
          id: first.id,
          name: "First",
          status: "IN_PROGRESS",
          lineCount: 2,
          countedCount: 1,
        }),
      ]);
      expect(closed.stocktakes.map((s) => [s.id, s.status])).toEqual([
        [second.id, "CANCELLED"],
      ]);
      expect(
        (await listStocktakes(dbA, { view: "open", page: 2 })).stocktakes,
      ).toEqual([]);
    });

    it("pages the list of counts", async () => {
      const shopId = shopAId;
      await prisma.stocktake.createMany({
        data: Array.from({ length: 21 }, (_, i) => ({
          shop: SHOP_A,
          shopId,
          locationId: CELLAR,
          name: `Count ${String(i).padStart(2, "0")}`,
          status: "IN_PROGRESS" as const,
          createdAt: new Date(Date.UTC(2026, 10, 1, 0, i)),
        })),
      });

      const first = await listStocktakes(dbA, { view: "open", page: 1 });
      const second = await listStocktakes(dbA, { view: "open", page: 2 });

      expect(first.hasMore).toBe(true);
      expect(first.stocktakes).toHaveLength(20);
      expect(first.stocktakes[0].name).toBe("Count 20");
      expect(second.hasMore).toBe(false);
      expect(second.stocktakes.map((s) => s.name)).toEqual(["Count 00"]);
    });

    it("reports progress and filters lines by state", async () => {
      const { id, lineFor } = await startCount();
      stockedInShopify.add(103);
      await addItems(dbA, { stocktakeId: id, codesText: "ROS-750" });
      await count(lineFor(RED), 12);
      await count(lineFor(WHITE), 20);
      shopify.setLevel(101, 6, 11);
      await complete(id, { acceptUncounted: true });

      expect(await getStocktakeProgress(dbA, id)).toEqual({
        lineCount: 3,
        countedCount: 2,
        uncountedCount: 1,
        zeroFilledCount: 0,
        differenceCount: 1,
        unitsOver: 2,
        unitsShort: 0,
        movementReviewCount: 1,
      });

      const titles = async (
        filter: Parameters<typeof getStocktakeLines>[1]["filter"],
        search = "",
      ) =>
        (
          await getStocktakeLines(dbA, {
            stocktakeId: id,
            filter,
            search,
            page: 1,
          })
        ).lines
          .map((l) => l.title)
          .sort();
      expect(await titles("all")).toEqual(["Red wine", "Rosé", "White wine"]);
      expect(await titles("uncounted")).toEqual(["Rosé"]);
      expect(await titles("counted")).toEqual(["Red wine", "White wine"]);
      expect(await titles("differences")).toEqual(["Red wine"]);
      expect(await titles("movement")).toEqual(["Red wine"]);
      expect(await titles("all", "wine")).toEqual(["Red wine", "White wine"]);
      expect(await titles("all", "wht-750")).toEqual(["White wine"]);
      expect(await titles("all", "3333")).toEqual(["Rosé"]);
      expect(await titles("differences", "white")).toEqual([]);
      expect(await titles("all", "no such item")).toEqual([]);

      const [red] = (
        await getStocktakeLines(dbA, {
          stocktakeId: id,
          filter: "movement",
          search: "",
          page: 1,
        })
      ).lines;
      expect(red).toMatchObject({
        shopifyVariantId: RED,
        sku: "RED-750",
        barcode: "1111",
        expectedQty: 10,
        countedQty: 12,
        delta: 2,
        countSource: "MANUAL",
        movementDetectedQty: 6,
        movementBaselineQty: null,
      });

      await resolveStocktakeMovement(dbA, {
        stocktakeId: id,
        lineIds: null,
        resolution: "COUNTED_AFTER",
      });
      expect(await getStocktakeProgress(dbA, id)).toMatchObject({
        differenceCount: 1,
        unitsOver: 6,
        movementReviewCount: 0,
      });
    });

    it("pages lines and keeps a page number within range", async () => {
      const id = await startPartialCount();
      const shopId = shopAId;
      await prisma.stocktakeLineItem.createMany({
        data: Array.from({ length: STOCKTAKE_LINE_PAGE_SIZE + 5 }, (_, i) => ({
          id: `line-${String(i).padStart(3, "0")}`,
          stocktakeId: id,
          shopId,
          shopifyVariantId: variant(5_000 + i),
          expectedQty: 1,
          countedQty: i % 2 === 0 ? 2 : 1,
        })),
      });
      const read = (
        filter: Parameters<typeof getStocktakeLines>[1]["filter"],
        page: number,
      ) =>
        getStocktakeLines(dbA, { stocktakeId: id, filter, search: "", page });

      const first = await read("all", 1);
      const last = await read("all", 99);
      const differences = await read("differences", 1);

      expect([first.total, first.page, first.pageCount]).toEqual([55, 1, 2]);
      expect(first.lines).toHaveLength(STOCKTAKE_LINE_PAGE_SIZE);
      expect(first.lines[0].id).toBe("line-000");
      // An item the catalog no longer knows is shown by its variant ID.
      expect(first.lines[0].title).toBe(variant(5_000));
      expect([last.page, last.lines.length]).toEqual([2, 5]);
      expect(last.lines[0].id).toBe("line-050");
      expect([differences.total, differences.pageCount]).toEqual([28, 1]);
      expect(differences.lines.every((l) => l.delta === 1)).toBe(true);
    });

    it("exports every line with its catalog details", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);

      const lines = await listStocktakeLinesForExport(dbA, id);

      expect(
        lines
          .map((l) => [l.title, l.sku, l.expectedQty, l.countedQty, l.delta])
          .sort(),
      ).toEqual([
        ["Red wine", "RED-750", 10, 7, -3],
        ["White wine", "WHT-750", 20, null, null],
      ]);
    });
  });
});
