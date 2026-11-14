/**
 * Stocktake completion and transfer ship/receive/cancel against the inventory
 * ledger — disposable PostgreSQL 16 with RLS applied, and the in-memory
 * Shopify double from the ledger suite.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { STAFF_REQUIRED_MESSAGE } from "../../../app/services/inventory-writes/actor.server";
import { InventoryDocumentClosedError } from "../../../app/services/inventory-writes/errors";
import type { ExecuteInventoryOperationOptions } from "../../../app/services/inventory-writes/execute.server";
import { settleInventoryDocument } from "../../../app/services/inventory-writes/settle.server";
import type { InventoryActor } from "../../../app/services/inventory-writes/types";
import {
  addStocktakeLine,
  completeStocktake,
  createStocktake,
  saveStocktakeCount,
} from "../../../app/services/stocktakes/stocktake.server";
import {
  addTransferLine,
  cancelTransfer,
  createTransfer,
  receiveTransfer,
  setTransferPickedQuantity,
  shipTransfer,
} from "../../../app/services/transfers/transfer.server";
import { resolveAuthorityAfterVerifiedAuth } from "../../../app/tenant/bootstrap.server";
import {
  createTenantDb,
  type TenantDb,
} from "../../../app/tenant/tenant-db.server";
import { FakeShopify, item, location } from "./fake-shopify-inventory";
import { resetSchemaAndApplyEnforcement } from "./helpers";
import {
  completeInventoryItemData,
  completeLocationData,
} from "./pr5-f3-test-helpers";

const SHOP_A = "stock-documents-a.myshopify.com";
const SHOP_B = "stock-documents-b.myshopify.com";

const variant = (n: number) => `gid://shopify/ProductVariant/${n}`;
const RED = variant(1);
const WHITE = variant(2);
const ROSE = variant(3);
const UNLINKED = variant(4);
const OTHER_SHOPS = variant(9);

const SOURCE = location(11);
const DESTINATION = location(12);
const INACTIVE = location(13);
const OTHER_SHOPS_LOCATION = location(21);

const STAFF: InventoryActor = {
  shopifyUserId: "42",
  displayName: null,
  channel: "ADMIN",
};

describe("stocktakes and transfers on the inventory ledger", () => {
  let prisma: PrismaClient;
  let dbA: TenantDb;
  let dbB: TenantDb;
  let shopify: FakeShopify;

  const enabled = (
    extra: Partial<ExecuteInventoryOperationOptions> = {},
  ): ExecuteInventoryOperationOptions => ({
    sendBatch: shopify.send,
    isCapabilityEnabled: () => true,
    ...extra,
  });
  const switchedOff = (): ExecuteInventoryOperationOptions => ({
    sendBatch: shopify.send,
    isCapabilityEnabled: () => false,
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

  const operations = (sourceType: string, sourceId: string) =>
    prisma.inventoryOperation.findMany({
      where: { sourceType, sourceId },
      orderBy: { createdAt: "asc" },
      include: { lines: { orderBy: { lineNumber: "asc" } } },
    });

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

    await prisma.shopifyLocationFact.createMany({
      data: [
        completeLocationData({ id: "11", shopId: shopA.id }),
        completeLocationData({ id: "12", shopId: shopA.id }),
        {
          ...completeLocationData({ id: "13", shopId: shopA.id }),
          isActive: false,
        },
        completeLocationData({ id: "21", shopId: shopB.id }),
      ],
    });
    await prisma.shopifyInventoryItemFact.createMany({
      data: [
        ...[101, 102, 103].map((n) => ({
          ...completeInventoryItemData({ id: String(n), shopId: shopA.id }),
          shopifyVariantGid: null,
        })),
        {
          ...completeInventoryItemData({ id: "201", shopId: shopB.id }),
          shopifyVariantGid: null,
        },
      ],
    });
    await prisma.shopifyVariantCache.createMany({
      data: [
        { id: RED, title: "Red wine", inventoryItemId: item(101) },
        { id: WHITE, title: "White wine", inventoryItemId: item(102) },
        { id: ROSE, title: "Rosé", inventoryItemId: item(103) },
        { id: UNLINKED, title: "Unlinked gin", inventoryItemId: null },
      ].map((v) => ({
        shop: SHOP_A,
        shopId: shopA.id,
        shopifyVariantId: v.id,
        title: v.title,
        inventoryItemId: v.inventoryItemId,
      })),
    });
    await prisma.shopifyVariantCache.create({
      data: {
        shop: SHOP_B,
        shopId: shopB.id,
        shopifyVariantId: OTHER_SHOPS,
        title: "Other shop's whisky",
        inventoryItemId: item(201),
      },
    });
    const snapshotDate = new Date("2026-11-01T00:00:00Z");
    await prisma.inventorySnapshot.createMany({
      data: [
        { shopifyVariantId: RED, locationId: SOURCE, quantityAvailable: 10 },
        { shopifyVariantId: WHITE, locationId: SOURCE, quantityAvailable: 20 },
        {
          shopifyVariantId: RED,
          locationId: DESTINATION,
          quantityAvailable: 99,
        },
      ].map((s) => ({ ...s, shop: SHOP_A, shopId: shopA.id, snapshotDate })),
    });

    const authority = async (domain: string) =>
      (
        await resolveAuthorityAfterVerifiedAuth({
          verifiedDomain: domain,
          source: "verified_admin_request",
          correlationId: "stock-documents-test",
          createIfMissing: false,
        })
      ).tenant;
    dbA = createTenantDb(await authority(SHOP_A));
    dbB = createTenantDb(await authority(SHOP_B));
  }, 180_000);

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "InventoryOperationLine", "InventoryOperation",
         "StocktakeLineItem", "Stocktake", "TransferLineItem", "TransferOrder" CASCADE`,
    );
    shopify = new FakeShopify();
    shopify.setLevel(101, 10, 11);
    shopify.setLevel(102, 20, 11);
    shopify.setLevel(103, 5, 11);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  describe("stocktakes", () => {
    async function startCount() {
      expect(
        await createStocktake(dbA, {
          shop: SHOP_A,
          locationId: SOURCE,
          name: "Cellar",
        }),
      ).toEqual({ ok: true });
      const stocktake = await prisma.stocktake.findFirstOrThrow({
        include: { lineItems: true },
      });
      const lineFor = (shopifyVariantId: string) =>
        stocktake.lineItems.find(
          (l) => l.shopifyVariantId === shopifyVariantId,
        )!.id;
      return { id: stocktake.id, lineFor, lineItems: stocktake.lineItems };
    }

    async function count(lineId: string, countedQty: number) {
      expect(await saveStocktakeCount(dbA, { lineId, countedQty })).toEqual({
        ok: true,
      });
    }

    const status = async (id: string) =>
      (await prisma.stocktake.findUniqueOrThrow({ where: { id } })).status;

    it("freezes expected quantities from the snapshots of the counted location only", async () => {
      const { lineItems } = await startCount();
      expect(
        lineItems
          .map((l) => [l.shopifyVariantId, l.expectedQty, l.countedQty])
          .sort(),
      ).toEqual([
        [RED, 10, null],
        [WHITE, 20, null],
      ]);
    });

    it.each([
      ["a deactivated location", INACTIVE],
      ["another shop's location", OTHER_SHOPS_LOCATION],
      ["no location", null],
    ])("does not start a count at %s", async (_label, locationId) => {
      const result = await createStocktake(dbA, {
        shop: SHOP_A,
        locationId,
        name: null,
      });
      expect(result.ok).toBe(false);
      expect(await prisma.stocktake.count()).toBe(0);
    });

    it("adds a catalog variant once, with the expected quantity of the counted location", async () => {
      const { id } = await startCount();

      for (let i = 0; i < 2; i += 1) {
        expect(
          await addStocktakeLine(dbA, {
            stocktakeId: id,
            shopifyVariantId: ROSE,
          }),
        ).toEqual({ ok: true });
      }
      expect(
        await addStocktakeLine(dbA, {
          stocktakeId: id,
          shopifyVariantId: OTHER_SHOPS,
        }),
      ).toEqual({
        ok: false,
        error: "That variant is not in this shop's catalog.",
      });

      const lines = await prisma.stocktakeLineItem.findMany({
        where: { stocktakeId: id, shopifyVariantId: ROSE },
      });
      expect(lines).toHaveLength(1);
      expect(lines[0].expectedQty).toBe(0);
    });

    it("applies each variance once, closes the count and records who did it", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      await count(lineFor(WHITE), 20);

      const result = await completeStocktake(dbA, null, STAFF, id, enabled());

      expect(result).toEqual({ ok: true, alreadyCompleted: false });
      expect(shopify.level(101)).toBe(7);
      expect(shopify.level(102)).toBe(20);
      const closed = await prisma.stocktake.findUniqueOrThrow({
        where: { id },
      });
      expect(closed.status).toBe("COMPLETED");
      expect(closed.completedAt).toBeInstanceOf(Date);

      const [operation, ...rest] = await operations("Stocktake", id);
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
      ).toEqual([[item(101), RED, SOURCE, -3, "APPLIED"]]);
    });

    it("keeps sales made during the count: the variance is relative", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 12);
      shopify.setLevel(101, 6, 11);

      await completeStocktake(dbA, null, STAFF, id, enabled());

      expect(shopify.level(101)).toBe(8);
    });

    it("sends nothing when a completed count is completed again", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      await completeStocktake(dbA, null, STAFF, id, enabled());
      const sent = shopify.requests.length;

      const again = await completeStocktake(dbA, null, STAFF, id, enabled());

      expect(again).toEqual({ ok: true, alreadyCompleted: true });
      expect(shopify.requests).toHaveLength(sent);
      expect(shopify.level(101)).toBe(7);
      expect(await operations("Stocktake", id)).toHaveLength(1);
    });

    it("applies the variance once when complete is pressed twice at the same time", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);

      const results = await Promise.all([
        completeStocktake(dbA, null, STAFF, id, enabled()),
        completeStocktake(dbA, null, STAFF, id, enabled()),
      ]);

      expect(results.some((r) => r.ok)).toBe(true);
      expect(shopify.requests).toHaveLength(1);
      expect(shopify.level(101)).toBe(7);
      expect(await status(id)).toBe("COMPLETED");
      expect(await operations("Stocktake", id)).toHaveLength(1);
      expect(await completeStocktake(dbA, null, STAFF, id, enabled())).toEqual({
        ok: true,
        alreadyCompleted: true,
      });
    });

    it("stays open after a partial failure and the retry sends only the refused line", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      await count(lineFor(WHITE), 25);
      rejectNextChangeAt(1);

      const failed = await completeStocktake(dbA, null, STAFF, id, enabled());

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
      });
      expect(await status(id)).toBe("IN_PROGRESS");
      expect({ red: shopify.level(101), white: shopify.level(102) }).toEqual({
        red: 7,
        white: 20,
      });

      const before = shopify.requests.length;
      const retried = await completeStocktake(dbA, null, STAFF, id, enabled());

      expect(retried).toEqual({ ok: true, alreadyCompleted: false });
      expect(shopify.requests).toHaveLength(before + 1);
      expect(shopify.requests.at(-1)!.changes).toEqual([
        expect.objectContaining({ inventoryItemId: item(102), delta: 5 }),
      ]);
      expect({ red: shopify.level(101), white: shopify.level(102) }).toEqual({
        red: 7,
        white: 25,
      });
      const recorded = await operations("Stocktake", id);
      expect(recorded.map((o) => o.status)).toEqual([
        "PARTIALLY_APPLIED",
        "APPLIED",
      ]);
      expect(recorded[1].idempotencyKey).toBe(`Stocktake:${id}:2`);
    });

    it("resends the same request after a lost response instead of adjusting twice", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      shopify.loseNextResponse();

      const unknown = await completeStocktake(dbA, null, STAFF, id, enabled());

      expect(unknown.ok).toBe(false);
      expect(await status(id)).toBe("IN_PROGRESS");
      expect(shopify.level(101)).toBe(7);

      const retried = await completeStocktake(dbA, null, STAFF, id, enabled());

      expect(retried).toEqual({ ok: true, alreadyCompleted: false });
      expect(shopify.level(101)).toBe(7);
      expect(new Set(shopify.keys()).size).toBe(1);
      expect(await operations("Stocktake", id)).toHaveLength(1);
    });

    it("puts an applied variance back when the count is corrected after a partial failure", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      await count(lineFor(WHITE), 25);
      rejectNextChangeAt(1);
      await completeStocktake(dbA, null, STAFF, id, enabled());
      expect(shopify.level(101)).toBe(7);

      // Both lines are recounted and match the expected quantity after all.
      await count(lineFor(RED), 10);
      await count(lineFor(WHITE), 20);

      const result = await completeStocktake(dbA, null, STAFF, id, enabled());

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
      let interfered = false;

      const first = await completeStocktake(
        dbA,
        null,
        STAFF,
        id,
        enabled({
          sendBatch: async (request) => {
            if (!interfered) {
              interfered = true;
              await count(lineFor(WHITE), 18);
            }
            return shopify.send(request);
          },
        }),
      );

      expect(first).toEqual({
        ok: false,
        error:
          "A count was saved while this stocktake was being completed. Complete it again to apply the latest counts.",
        problems: [],
      });
      expect(await status(id)).toBe("IN_PROGRESS");
      expect({ red: shopify.level(101), white: shopify.level(102) }).toEqual({
        red: 7,
        white: 20,
      });

      expect(await completeStocktake(dbA, null, STAFF, id, enabled())).toEqual({
        ok: true,
        alreadyCompleted: false,
      });
      expect({ red: shopify.level(101), white: shopify.level(102) }).toEqual({
        red: 7,
        white: 18,
      });
    });

    it("rejects count and line changes once the count is closed", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);
      await completeStocktake(dbA, null, STAFF, id, enabled());

      const closedMessage =
        "This count is closed. Its lines can no longer be changed.";
      expect(
        await saveStocktakeCount(dbA, { lineId: lineFor(RED), countedQty: 1 }),
      ).toEqual({ ok: false, error: closedMessage });
      expect(
        await addStocktakeLine(dbA, {
          stocktakeId: id,
          shopifyVariantId: ROSE,
        }),
      ).toEqual({ ok: false, error: closedMessage });
      const red = await prisma.stocktakeLineItem.findUniqueOrThrow({
        where: { id: lineFor(RED) },
      });
      expect(red.countedQty).toBe(7);
    });

    it("records and sends nothing while the kill switch is off", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);

      const result = await completeStocktake(
        dbA,
        null,
        STAFF,
        id,
        switchedOff(),
      );

      expect(result).toEqual({
        ok: false,
        error:
          "Stocktake inventory changes are switched off for this app. Nothing was sent to Shopify and the count stays open.",
        problems: [],
      });
      expect(shopify.requests).toHaveLength(0);
      expect(await prisma.inventoryOperation.count()).toBe(0);
      expect(await status(id)).toBe("IN_PROGRESS");
    });

    it("refuses to complete with no counts, an unlinked item, or a variant counted on two lines", async () => {
      const { id, lineFor } = await startCount();
      expect(
        await completeStocktake(dbA, null, STAFF, id, enabled()),
      ).toMatchObject({
        ok: false,
        error: "Enter at least one count before completing.",
      });

      await addStocktakeLine(dbA, {
        stocktakeId: id,
        shopifyVariantId: UNLINKED,
      });
      const unlinked = await prisma.stocktakeLineItem.findFirstOrThrow({
        where: { stocktakeId: id, shopifyVariantId: UNLINKED },
      });
      await count(unlinked.id, 3);
      expect(
        await completeStocktake(dbA, null, STAFF, id, enabled()),
      ).toMatchObject({
        ok: false,
        error: expect.stringContaining(
          "Shopify inventory is not linked yet for: Unlinked gin.",
        ),
      });
      await count(unlinked.id, 0);

      // Legacy data can hold the same variant twice; the app no longer adds it.
      const duplicate = await prisma.stocktakeLineItem.create({
        data: {
          stocktakeId: id,
          shopId: (await prisma.stocktake.findUniqueOrThrow({ where: { id } }))
            .shopId,
          shopifyVariantId: RED,
          expectedQty: 10,
          countedQty: 4,
        },
      });
      await count(lineFor(RED), 7);
      expect(
        await completeStocktake(dbA, null, STAFF, id, enabled()),
      ).toMatchObject({
        ok: false,
        error: expect.stringContaining("on the count more than once"),
      });
      expect(duplicate.countedQty).toBe(4);

      expect(shopify.requests).toHaveLength(0);
      expect(await prisma.inventoryOperation.count()).toBe(0);
      expect(await status(id)).toBe("IN_PROGRESS");
    });

    it("gives another shop no way to count or complete it", async () => {
      const { id, lineFor } = await startCount();
      await count(lineFor(RED), 7);

      expect(
        await saveStocktakeCount(dbB, { lineId: lineFor(RED), countedQty: 0 }),
      ).toEqual({ ok: false, error: "Stocktake line not found" });
      expect(
        await addStocktakeLine(dbB, {
          stocktakeId: id,
          shopifyVariantId: OTHER_SHOPS,
        }),
      ).toEqual({ ok: false, error: "Stocktake not found" });
      expect(await completeStocktake(dbB, null, STAFF, id, enabled())).toEqual({
        ok: false,
        error: "Stocktake not found",
        problems: [],
      });

      expect(shopify.requests).toHaveLength(0);
      expect(await status(id)).toBe("IN_PROGRESS");
      const red = await prisma.stocktakeLineItem.findUniqueOrThrow({
        where: { id: lineFor(RED) },
      });
      expect(red.countedQty).toBe(7);
    });
  });

  describe("transfers", () => {
    async function draftTransfer(
      lines: Array<[variantId: string, quantity: number]> = [
        [RED, 4],
        [WHITE, 6],
      ],
    ) {
      expect(
        await createTransfer(dbA, {
          shop: SHOP_A,
          sourceLocationId: SOURCE,
          destinationLocationId: DESTINATION,
          notes: "  Restock the shop floor  ",
        }),
      ).toEqual({ ok: true });
      const transfer = await prisma.transferOrder.findFirstOrThrow();
      for (const [shopifyVariantId, quantity] of lines) {
        expect(
          await addTransferLine(dbA, {
            transferId: transfer.id,
            shopifyVariantId,
            quantity,
          }),
        ).toEqual({ ok: true });
      }
      return transfer.id;
    }

    const load = (id: string) =>
      prisma.transferOrder.findUniqueOrThrow({
        where: { id },
        include: { lineItems: { orderBy: { id: "asc" } } },
      });

    const levels = () => ({
      redSource: shopify.level(101, 11),
      whiteSource: shopify.level(102, 11),
      redDestination: shopify.level(101, 12),
      whiteDestination: shopify.level(102, 12),
    });

    it("creates a draft only between two different active locations of the shop", async () => {
      const attempts = [
        [SOURCE, SOURCE],
        [SOURCE, INACTIVE],
        [OTHER_SHOPS_LOCATION, DESTINATION],
        ["", DESTINATION],
      ];
      for (const [sourceLocationId, destinationLocationId] of attempts) {
        const result = await createTransfer(dbA, {
          shop: SHOP_A,
          sourceLocationId,
          destinationLocationId,
          notes: null,
        });
        expect(result.ok).toBe(false);
      }
      expect(await prisma.transferOrder.count()).toBe(0);

      const id = await draftTransfer([]);
      expect(await load(id)).toMatchObject({
        status: "DRAFT",
        notes: "Restock the shop floor",
        shopifyTransferId: null,
      });
    });

    it("merges a variant added twice and bounds the picked quantity", async () => {
      const id = await draftTransfer([
        [RED, 4],
        [RED, 3],
      ]);
      const [line, ...rest] = (await load(id)).lineItems;
      expect(rest).toEqual([]);
      expect(line.quantity).toBe(7);

      expect(
        await addTransferLine(dbA, {
          transferId: id,
          shopifyVariantId: OTHER_SHOPS,
          quantity: 1,
        }),
      ).toEqual({
        ok: false,
        error: "That variant is not in this shop's catalog.",
      });
      expect(
        await setTransferPickedQuantity(dbA, { lineId: line.id, pickedQty: 8 }),
      ).toEqual({
        ok: false,
        error: "Picked quantity cannot be more than the 7 requested.",
      });
      expect(
        await setTransferPickedQuantity(dbA, { lineId: line.id, pickedQty: 5 }),
      ).toEqual({ ok: true });
      expect((await load(id)).lineItems[0].pickedQty).toBe(5);
    });

    it("ships once: stock leaves the source, the transfer is in transit and the shipped units are frozen", async () => {
      const id = await draftTransfer();
      const white = (await load(id)).lineItems.find(
        (l) => l.shopifyVariantId === WHITE,
      )!;
      await setTransferPickedQuantity(dbA, { lineId: white.id, pickedQty: 5 });

      const result = await shipTransfer(dbA, null, STAFF, id, enabled());

      expect(result).toEqual({ ok: true, alreadyDone: false });
      expect(levels()).toEqual({
        redSource: 6,
        whiteSource: 15,
        redDestination: 0,
        whiteDestination: 0,
      });
      const shipped = await load(id);
      expect(shipped.status).toBe("IN_TRANSIT");
      expect(shipped.shippedAt).toBeInstanceOf(Date);
      expect(
        shipped.lineItems.map((l) => [l.shopifyVariantId, l.pickedQty]).sort(),
      ).toEqual([
        [RED, 4],
        [WHITE, 5],
      ]);

      const [operation, ...rest] = await operations("TransferShipment", id);
      expect(rest).toEqual([]);
      expect(operation).toMatchObject({
        kind: "TRANSFER",
        status: "APPLIED",
        reason: "movement_created",
        actorShopifyUserId: "42",
        referenceDocumentUri: `gid://propo/TransferOrder/${id}`,
      });
      expect(
        operation.lines.map((l) => [
          l.inventoryItemGid,
          l.locationGid,
          l.delta,
        ]),
      ).toEqual([
        [item(101), SOURCE, -4],
        [item(102), SOURCE, -5],
      ]);

      const sent = shopify.requests.length;
      expect(await shipTransfer(dbA, null, STAFF, id, enabled())).toEqual({
        ok: true,
        alreadyDone: true,
      });
      expect(shopify.requests).toHaveLength(sent);
    });

    it("ships once when ship is pressed twice at the same time", async () => {
      const id = await draftTransfer();

      const results = await Promise.all([
        shipTransfer(dbA, null, STAFF, id, enabled()),
        shipTransfer(dbA, null, STAFF, id, enabled()),
      ]);

      expect(results.some((r) => r.ok)).toBe(true);
      expect(shopify.requests).toHaveLength(1);
      expect(levels()).toMatchObject({ redSource: 6, whiteSource: 14 });
      expect((await load(id)).status).toBe("IN_TRANSIT");
    });

    it("stays a draft after a partial failure; the retry sends only what is missing", async () => {
      const id = await draftTransfer();
      rejectNextChangeAt(1);

      const failed = await shipTransfer(dbA, null, STAFF, id, enabled());

      expect(failed).toMatchObject({
        ok: false,
        error: expect.stringContaining("The transfer stays a draft."),
        problems: [
          {
            shopifyVariantId: WHITE,
            title: "White wine",
            message: "The item is not stocked at the location.",
          },
        ],
      });
      expect((await load(id)).status).toBe("DRAFT");
      expect(levels()).toMatchObject({ redSource: 6, whiteSource: 20 });

      const retried = await shipTransfer(dbA, null, STAFF, id, enabled());

      expect(retried).toEqual({ ok: true, alreadyDone: false });
      expect(shopify.requests.at(-1)!.changes).toEqual([
        expect.objectContaining({ inventoryItemId: item(102), delta: -6 }),
      ]);
      expect(levels()).toMatchObject({ redSource: 6, whiteSource: 14 });
    });

    it("sends only the difference when a line changes after a partial ship", async () => {
      const id = await draftTransfer();
      rejectNextChangeAt(1);
      await shipTransfer(dbA, null, STAFF, id, enabled());
      const red = (await load(id)).lineItems.find(
        (l) => l.shopifyVariantId === RED,
      )!;
      await setTransferPickedQuantity(dbA, { lineId: red.id, pickedQty: 1 });

      const result = await shipTransfer(dbA, null, STAFF, id, enabled());

      expect(result).toEqual({ ok: true, alreadyDone: false });
      expect(levels()).toMatchObject({ redSource: 9, whiteSource: 14 });
    });

    it("cancels a plain draft without touching Shopify or needing a staff identity", async () => {
      const id = await draftTransfer();

      expect(await cancelTransfer(dbA, null, null, id, enabled())).toEqual({
        ok: true,
        alreadyDone: false,
      });

      expect((await load(id)).status).toBe("CANCELLED");
      expect(shopify.requests).toHaveLength(0);
      expect(await cancelTransfer(dbA, null, null, id, enabled())).toEqual({
        ok: true,
        alreadyDone: true,
      });
      expect(await shipTransfer(dbA, null, STAFF, id, enabled())).toMatchObject(
        { ok: false, error: "A cancelled transfer cannot be shipped." },
      );
      const [line] = (await load(id)).lineItems;
      expect(
        await setTransferPickedQuantity(dbA, { lineId: line.id, pickedQty: 1 }),
      ).toMatchObject({ ok: false });
    });

    it("puts stock back at the source when a partly shipped draft is cancelled", async () => {
      const id = await draftTransfer();
      rejectNextChangeAt(1);
      await shipTransfer(dbA, null, STAFF, id, enabled());
      expect(levels()).toMatchObject({ redSource: 6, whiteSource: 20 });

      expect(await cancelTransfer(dbA, null, null, id, enabled())).toEqual({
        ok: false,
        error: STAFF_REQUIRED_MESSAGE,
        problems: [],
      });
      expect((await load(id)).status).toBe("DRAFT");

      expect(await cancelTransfer(dbA, null, STAFF, id, enabled())).toEqual({
        ok: true,
        alreadyDone: false,
      });

      expect((await load(id)).status).toBe("CANCELLED");
      expect(levels()).toMatchObject({ redSource: 10, whiteSource: 20 });
      const recorded = await operations("TransferShipment", id);
      expect(recorded.at(-1)).toMatchObject({
        status: "APPLIED",
        reason: "movement_canceled",
      });
      expect(recorded.at(-1)!.lines.map((l) => l.delta)).toEqual([4]);
    });

    it("does not cancel a transfer that is being shipped or has shipped", async () => {
      const id = await draftTransfer();
      let cancelDuringShip: unknown;

      const shipped = await shipTransfer(
        dbA,
        null,
        STAFF,
        id,
        enabled({
          sendBatch: async (request) => {
            cancelDuringShip ??= await cancelTransfer(
              dbA,
              null,
              STAFF,
              id,
              enabled(),
            );
            return shopify.send(request);
          },
        }),
      );

      expect(cancelDuringShip).toMatchObject({ ok: false });
      expect(shipped).toEqual({ ok: true, alreadyDone: false });
      expect((await load(id)).status).toBe("IN_TRANSIT");
      expect(await cancelTransfer(dbA, null, STAFF, id, enabled())).toEqual({
        ok: false,
        error:
          "Only a draft transfer can be cancelled. This one has already shipped.",
        problems: [],
      });
      expect(levels()).toMatchObject({ redSource: 6, whiteSource: 14 });
    });

    it("receives once: the shipped units arrive at the destination", async () => {
      const id = await draftTransfer();
      const white = (await load(id)).lineItems.find(
        (l) => l.shopifyVariantId === WHITE,
      )!;
      await setTransferPickedQuantity(dbA, { lineId: white.id, pickedQty: 5 });
      await shipTransfer(dbA, null, STAFF, id, enabled());

      const results = await Promise.all([
        receiveTransfer(dbA, null, STAFF, id, enabled()),
        receiveTransfer(dbA, null, STAFF, id, enabled()),
      ]);

      expect(results.some((r) => r.ok)).toBe(true);
      expect(levels()).toEqual({
        redSource: 6,
        whiteSource: 15,
        redDestination: 4,
        whiteDestination: 5,
      });
      const received = await load(id);
      expect(received.status).toBe("RECEIVED");
      expect(received.receivedAt).toBeInstanceOf(Date);
      expect(
        received.lineItems
          .map((l) => [l.shopifyVariantId, l.receivedQty])
          .sort(),
      ).toEqual([
        [RED, 4],
        [WHITE, 5],
      ]);
      const [operation, ...rest] = await operations("TransferReceipt", id);
      expect(rest).toEqual([]);
      expect(operation).toMatchObject({
        status: "APPLIED",
        reason: "movement_received",
      });

      const sent = shopify.requests.length;
      expect(await receiveTransfer(dbA, null, STAFF, id, enabled())).toEqual({
        ok: true,
        alreadyDone: true,
      });
      expect(shopify.requests).toHaveLength(sent);
    });

    it("stays in transit after a partial receipt failure; the retry adds only what is missing", async () => {
      const id = await draftTransfer();
      await shipTransfer(dbA, null, STAFF, id, enabled());
      rejectNextChangeAt(0);

      const failed = await receiveTransfer(dbA, null, STAFF, id, enabled());

      expect(failed).toMatchObject({
        ok: false,
        error: expect.stringContaining("The transfer stays in transit."),
        problems: [{ shopifyVariantId: RED, title: "Red wine" }],
      });
      expect((await load(id)).status).toBe("IN_TRANSIT");
      expect(levels()).toMatchObject({
        redDestination: 0,
        whiteDestination: 6,
      });

      expect(await receiveTransfer(dbA, null, STAFF, id, enabled())).toEqual({
        ok: true,
        alreadyDone: false,
      });
      expect(levels()).toMatchObject({
        redDestination: 4,
        whiteDestination: 6,
      });
    });

    it("does not receive what it did not ship", async () => {
      const draft = await draftTransfer();
      expect(
        await receiveTransfer(dbA, null, STAFF, draft, enabled()),
      ).toMatchObject({
        ok: false,
        error: "Only a transfer that is in transit can be received.",
      });

      // In transit with no shipment in the ledger, e.g. edited outside the app.
      await prisma.transferOrder.update({
        where: { id: draft },
        data: { status: "IN_TRANSIT" },
      });
      expect(
        await receiveTransfer(dbA, null, STAFF, draft, enabled()),
      ).toMatchObject({
        ok: false,
        error: expect.stringContaining(
          "no complete record of this transfer leaving the source",
        ),
      });

      await prisma.transferOrder.update({
        where: { id: draft },
        data: { shopifyTransferId: "gid://shopify/InventoryTransfer/1" },
      });
      expect(
        await receiveTransfer(dbA, null, STAFF, draft, enabled()),
      ).toMatchObject({
        ok: false,
        error: expect.stringContaining("Receive it in Shopify admin"),
      });

      expect(shopify.requests).toHaveLength(0);
      expect(await prisma.inventoryOperation.count()).toBe(0);
      expect((await load(draft)).status).toBe("IN_TRANSIT");
      expect((await load(draft)).lineItems.map((l) => l.receivedQty)).toEqual([
        0, 0,
      ]);
    });

    it("records and sends nothing while the kill switch is off", async () => {
      const id = await draftTransfer();

      expect(await shipTransfer(dbA, null, STAFF, id, switchedOff())).toEqual({
        ok: false,
        error:
          "Transfer inventory changes are switched off for this app. Nothing was sent to Shopify and the transfer was not changed.",
        problems: [],
      });
      expect((await load(id)).status).toBe("DRAFT");

      await shipTransfer(dbA, null, STAFF, id, enabled());
      const sent = shopify.requests.length;
      expect(
        await receiveTransfer(dbA, null, STAFF, id, switchedOff()),
      ).toMatchObject({ ok: false });
      expect(shopify.requests).toHaveLength(sent);
      expect(await operations("TransferReceipt", id)).toEqual([]);
      expect((await load(id)).status).toBe("IN_TRANSIT");
    });

    it("refuses to ship an empty transfer or one with an unlinked item", async () => {
      const id = await draftTransfer([]);
      expect(await shipTransfer(dbA, null, STAFF, id, enabled())).toMatchObject(
        { ok: false, error: "Transfer has no line items" },
      );

      await addTransferLine(dbA, {
        transferId: id,
        shopifyVariantId: UNLINKED,
        quantity: 2,
      });
      expect(await shipTransfer(dbA, null, STAFF, id, enabled())).toMatchObject(
        {
          ok: false,
          error: expect.stringContaining(
            "Shopify inventory is not linked yet for: Unlinked gin.",
          ),
        },
      );
      expect(shopify.requests).toHaveLength(0);
      expect(await prisma.inventoryOperation.count()).toBe(0);
    });

    it("gives another shop no way to change, ship, receive or cancel it", async () => {
      const id = await draftTransfer();
      const [line] = (await load(id)).lineItems;

      expect(
        await addTransferLine(dbB, {
          transferId: id,
          shopifyVariantId: OTHER_SHOPS,
          quantity: 1,
        }),
      ).toEqual({ ok: false, error: "Transfer not found" });
      expect(
        await setTransferPickedQuantity(dbB, { lineId: line.id, pickedQty: 1 }),
      ).toEqual({ ok: false, error: "Transfer line not found" });
      for (const act of [shipTransfer, receiveTransfer, cancelTransfer]) {
        expect(await act(dbB, null, STAFF, id, enabled())).toEqual({
          ok: false,
          error: "Transfer not found",
          problems: [],
        });
      }

      expect(shopify.requests).toHaveLength(0);
      expect(await load(id)).toMatchObject({ status: "DRAFT" });
      expect((await load(id)).lineItems.map((l) => l.pickedQty)).toEqual([
        0, 0,
      ]);
    });
  });

  describe("document guard", () => {
    it("records nothing for a document that closed before the operation was recorded", async () => {
      const attempt = settleInventoryDocument(
        dbA,
        null,
        {
          kind: "TRANSFER",
          source: { type: "TransferShipment", id: "closed-transfer" },
          reason: "movement_created",
          quantityName: "available",
          referenceDocumentUri: null,
          desired: [
            {
              inventoryItemId: item(101),
              variantId: RED,
              locationId: SOURCE,
              delta: -1,
              changeFromQuantity: null,
            },
          ],
          actor: STAFF,
          note: null,
          holdOpen: async () => false,
        },
        enabled(),
      );

      await expect(attempt).rejects.toBeInstanceOf(
        InventoryDocumentClosedError,
      );
      expect(await prisma.inventoryOperation.count()).toBe(0);
      expect(shopify.requests).toHaveLength(0);
    });
  });
});
