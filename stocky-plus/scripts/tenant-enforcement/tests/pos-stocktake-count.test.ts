/**
 * Counting a stocktake from POS against PostgreSQL with RLS applied: which
 * counts a POS location can see and count, who is named on a count, what is
 * withheld, and shop isolation. Counting itself is covered by the stocktake
 * workflow suite.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { PosApiError } from "../../../app/lib/pos/pos-api.server";
import {
  countAtPos,
  getCountSheet,
  listCountableStocktakes,
  type CountDeps,
} from "../../../app/lib/pos/stocktake-api.server";
import type { ReadLevelQuantities } from "../../../app/services/inventory-writes/shopify-levels.server";
import type { InventoryActor } from "../../../app/services/inventory-writes/types";
import {
  cancelStocktake,
  createStocktake,
} from "../../../app/services/stocktakes/stocktake.server";
import { resolveAuthorityAfterVerifiedAuth } from "../../../app/tenant/bootstrap.server";
import type { PosTenantContext } from "../../../app/tenant/require-pos-tenant.server";
import { createTenantDb, type TenantDb } from "../../../app/tenant/tenant-db.server";
import { item, location } from "./fake-shopify-inventory";
import { resetSchemaAndApplyEnforcement } from "./helpers";
import {
  completeInventoryItemData,
  completeInventoryLevelData,
  completeLocationData,
} from "./pr5-f3-test-helpers";

const SHOP_A = "pos-stocktake-a.myshopify.com";
const SHOP_B = "pos-stocktake-b.myshopify.com";
const RED = "gid://shopify/ProductVariant/1";
const WHITE = "gid://shopify/ProductVariant/2";
const CELLAR = location(11);
const SHOPFRONT = location(12);
const STAFF: InventoryActor = { shopifyUserId: "42", displayName: null, channel: "ADMIN" };

describe("counting a stocktake from POS", () => {
  let prisma: PrismaClient;
  let dbA: TenantDb;
  let dbB: TenantDb;

  // Putting an item on a count reads its quantity from Shopify; the double answers from memory.
  const readQuantities: ReadLevelQuantities = async (_location, ids) =>
    new Map(ids.map((id) => [id, 10]));
  const deps: CountDeps = {
    adminFor: async () => ({
      graphql: async () => {
        throw new Error("Shopify is reached through the test double only");
      },
    }),
    stocktake: { readQuantities },
  };

  const contextFor = (db: TenantDb, shopifyUserId: string | null = "77"): PosTenantContext =>
    ({
      db,
      shop: { id: "unused", myshopifyDomain: SHOP_A },
      actor: { shopifyUserId, displayName: null, channel: "POS" },
    }) as unknown as PosTenantContext;

  async function startCount(
    db: TenantDb,
    shop: string,
    locationId: string,
    extra: { blind?: boolean; name?: string } = {},
  ) {
    const created = await createStocktake(
      db,
      null,
      { shop, locationId, name: extra.name ?? "Cellar", blind: extra.blind, actor: STAFF },
      { readQuantities },
    );
    if (!created.ok) throw new Error(created.error);
    return created.stocktakeId;
  }

  async function apiError(promise: Promise<unknown>): Promise<PosApiError> {
    const error = await promise.then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(PosApiError);
    return error as PosApiError;
  }

  const scan = (db: TenantDb, id: string, code: string, locationGid = CELLAR, quantity = 1) =>
    countAtPos(contextFor(db), id, locationGid, { intent: "scan", code, quantity }, deps);

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
    const [shopA, shopB] = await Promise.all([
      prisma.shop.create({ data: { myshopifyDomain: SHOP_A, processingEnabled: true } }),
      prisma.shop.create({ data: { myshopifyDomain: SHOP_B, processingEnabled: true } }),
    ]);
    await prisma.shopifyLocationFact.createMany({
      data: [
        completeLocationData({ id: "11", shopId: shopA.id }),
        completeLocationData({ id: "12", shopId: shopA.id }),
        completeLocationData({ id: "21", shopId: shopB.id }),
      ],
    });
    await prisma.shopifyInventoryItemFact.createMany({
      data: [101, 102, 201].map((n) => ({
        ...completeInventoryItemData({ id: String(n), shopId: n === 201 ? shopB.id : shopA.id }),
        shopifyVariantGid: null,
        tracked: true,
      })),
    });
    await prisma.shopifyVariantCache.createMany({
      data: [
        { shop: SHOP_A, shopId: shopA.id, shopifyVariantId: RED, title: "Red wine", sku: "RED-750", barcode: "1111", inventoryItemId: item(101) },
        { shop: SHOP_A, shopId: shopA.id, shopifyVariantId: WHITE, title: "White wine", sku: "WHT-750", barcode: "2222", inventoryItemId: item(102) },
      ],
    });
    await prisma.shopifyInventoryLevelFact.createMany({
      data: [
        [101, 11, shopA.id],
        [102, 11, shopA.id],
        [101, 12, shopA.id],
        [201, 21, shopB.id],
      ].map(([itemNumber, locationNumber, shopId]) => ({
        ...completeInventoryLevelData({
          id: `level-${itemNumber}-${locationNumber}`,
          shopId: String(shopId),
          itemId: String(itemNumber),
          locationId: String(locationNumber),
          available: 10,
        }),
        onHandQuantity: 10,
      })),
    });

    const authority = async (domain: string) =>
      (
        await resolveAuthorityAfterVerifiedAuth({
          verifiedDomain: domain,
          source: "verified_admin_request",
          correlationId: "pos-stocktake-test",
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
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  describe("choosing a count", () => {
    it("lists only counts being counted at the POS location", async () => {
      const here = await startCount(dbA, SHOP_A, CELLAR, { name: "Cellar" });
      await startCount(dbA, SHOP_A, SHOPFRONT, { name: "Shopfront" });
      const cancelled = await startCount(dbA, SHOP_A, CELLAR, { name: "Old" });
      await cancelStocktake(dbA, { stocktakeId: cancelled, actor: STAFF });

      const list = await listCountableStocktakes(dbA, CELLAR);

      expect(list.stocktakes.map((entry) => entry.id)).toEqual([here]);
      expect(list.stocktakes[0]).toMatchObject({ name: "Cellar", lineCount: 2, countedCount: 0, blind: false });
    });

    it("keeps another shop's counts out of the list", async () => {
      await startCount(dbA, SHOP_A, CELLAR);

      expect((await listCountableStocktakes(dbB, location(21))).stocktakes).toEqual([]);
    });
  });

  describe("counting", () => {
    it("adds scans to an item's count, names the POS staff member and reports progress", async () => {
      const id = await startCount(dbA, SHOP_A, CELLAR);

      const first = await scan(dbA, id, "1111");
      const second = await scan(dbA, id, "1111", CELLAR, 3);

      expect(first).toMatchObject({ ok: true, line: { title: "Red wine", countedQty: 1 }, progress: { lineCount: 2, countedCount: 1 } });
      expect(second).toMatchObject({ ok: true, line: { countedQty: 4 } });
      const line = await prisma.stocktakeLineItem.findFirstOrThrow({ where: { stocktakeId: id, shopifyVariantId: RED } });
      expect(line).toMatchObject({ countedQty: 4, countedByUserId: "77", countSource: "SCAN" });
    });

    it("answers a code that matches nothing with the reason, not an error", async () => {
      const id = await startCount(dbA, SHOP_A, CELLAR);

      const result = await scan(dbA, id, "no-such-code");

      expect(result).toMatchObject({ ok: false, progress: { countedCount: 0 } });
      expect((result as { message: string }).message).toContain("no-such-code");
    });

    it("sets and clears one item's count", async () => {
      const id = await startCount(dbA, SHOP_A, CELLAR);
      const { line } = (await scan(dbA, id, "2222")) as { line: { lineId: string } };

      const set = await countAtPos(contextFor(dbA), id, CELLAR, { intent: "count", lineId: line.lineId, countedQty: 9 }, deps);
      const cleared = await countAtPos(contextFor(dbA), id, CELLAR, { intent: "count", lineId: line.lineId, countedQty: null }, deps);

      expect(set).toMatchObject({ ok: true, line: { countedQty: 9 }, progress: { countedCount: 1 } });
      expect(cleared).toMatchObject({ ok: true, progress: { countedCount: 0 } });
    });

    it("refuses a count that belongs to another count", async () => {
      const id = await startCount(dbA, SHOP_A, CELLAR);
      const other = await startCount(dbA, SHOP_A, CELLAR, { name: "Second" });
      const { line } = (await scan(dbA, other, "1111")) as { line: { lineId: string } };

      const result = await countAtPos(contextFor(dbA), id, CELLAR, { intent: "count", lineId: line.lineId, countedQty: 5 }, deps);

      expect(result).toMatchObject({ ok: false });
      expect(
        (await prisma.stocktakeLineItem.findUniqueOrThrow({ where: { id: line.lineId } })).countedQty,
      ).toBe(1);
    });
  });

  describe("who may count what", () => {
    it("refuses a POS user with no staff identity before counting anything", async () => {
      const id = await startCount(dbA, SHOP_A, CELLAR);

      const error = await apiError(
        countAtPos(contextFor(dbA, null), id, CELLAR, { intent: "scan", code: "1111" }, deps),
      );

      expect(error.status).toBe(403);
      expect(await prisma.stocktakeLineItem.count({ where: { countedQty: { not: null } } })).toBe(0);
    });

    it("refuses a count at another location", async () => {
      const id = await startCount(dbA, SHOP_A, CELLAR);

      expect((await apiError(scan(dbA, id, "1111", SHOPFRONT))).status).toBe(409);
      expect((await apiError(getCountSheet(dbA, id, SHOPFRONT))).status).toBe(409);
    });

    it("refuses a count that is closed", async () => {
      const id = await startCount(dbA, SHOP_A, CELLAR);
      await cancelStocktake(dbA, { stocktakeId: id, actor: STAFF });

      const error = await apiError(scan(dbA, id, "1111"));

      expect(error.status).toBe(409);
      expect(error.message).toContain("isn’t being counted");
    });

    it("answers 404 for another shop's count", async () => {
      const id = await startCount(dbA, SHOP_A, CELLAR);

      expect((await apiError(scan(dbB, id, "1111", location(21)))).status).toBe(404);
      expect((await apiError(getCountSheet(dbB, id, location(21)))).status).toBe(404);
    });
  });

  describe("what the screen can read", () => {
    it("shows progress and the counted items, and never an expected quantity", async () => {
      const id = await startCount(dbA, SHOP_A, CELLAR, { blind: true });
      await scan(dbA, id, "1111", CELLAR, 2);

      const sheet = await getCountSheet(dbA, id, CELLAR);

      expect(sheet).toMatchObject({
        stocktake: { id, name: "Cellar", blind: true, lineCount: 2, countedCount: 1 },
        counted: [{ variantGid: RED, title: "Red wine", countedQty: 2 }],
        hasMoreCounted: false,
      });
      expect(JSON.stringify(sheet).toLowerCase()).not.toContain("expected");
    });
  });
});
