/**
 * Stock conservation under concurrent requests (risk R-186).
 *
 * Many completes race count changes on one stocktake, and ships, receives and
 * cancels race on one transfer, against a Shopify double that answers slowly
 * so the requests overlap. Whatever order they land in, Shopify must end with
 * exactly the stock the closed document stands for, and must never pass
 * through a quantity that no state of the document stands for (the same
 * movement applied twice and corrected afterwards). The timing is random; the
 * assertions hold for every interleaving, so a failure here is a defect, not
 * a flake.
 *
 * The last group sends a transfer's lines one request each and has Shopify
 * refuse or lose some of them, so a shipment, a put-back or a receipt lands
 * only in part. The document must stay where it was, and the next attempt
 * must move only what is still missing.
 *
 * Disposable PostgreSQL 16 with RLS applied, as in stocktake-transfer-ledger.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { ReadLevelQuantities } from "../../../app/services/inventory-writes/shopify-levels.server";
import type { InventoryActor } from "../../../app/services/inventory-writes/types";
import {
  completeStocktake,
  createStocktake,
  saveStocktakeCount,
  type CompleteStocktakeOptions,
} from "../../../app/services/stocktakes/stocktake.server";
import {
  addTransferLine,
  cancelTransfer,
  createTransfer,
  setTransferLineQuantity,
  shipTransfer,
} from "../../../app/services/transfers/transfer.server";
import { receiveTransfer } from "../../../app/services/transfers/transfer-receiving.server";
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

const SHOP_A = "stock-race-a.myshopify.com";
const RED = "gid://shopify/ProductVariant/1";
const WHITE = "gid://shopify/ProductVariant/2";
const SOURCE = location(11);
const DESTINATION = location(12);
const STAFF: InventoryActor = {
  shopifyUserId: "42",
  displayName: null,
  channel: "ADMIN",
};
const ROUNDS = 6;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("stock conservation", () => {
  let prisma: PrismaClient;
  let dbA: TenantDb;
  let shopify: FakeShopify;
  /** Shopify's quantities after each request it answered. */
  let observed: Array<
    Record<"red" | "white" | "redDest" | "whiteDest", number>
  >;

  /** The count reads its starting and current quantities from the same Shopify double. */
  const readQuantities: ReadLevelQuantities = async (
    locationId,
    inventoryItemIds,
  ) => {
    await sleep(Math.random() * 10);
    const locationNumber = Number(locationId.split("/").pop());
    return new Map(
      inventoryItemIds.map((id) => [
        id,
        shopify.level(Number(id.split("/").pop()), locationNumber),
      ]),
    );
  };

  const enabled = (): CompleteStocktakeOptions => ({
    readQuantities,
    sendBatch: async (request) => {
      await sleep(Math.random() * 40);
      const outcome = await shopify.send(request);
      observed.push({
        red: shopify.level(101, 11),
        white: shopify.level(102, 11),
        redDest: shopify.level(101, 12),
        whiteDest: shopify.level(102, 12),
      });
      await sleep(Math.random() * 40);
      return outcome;
    },
    isCapabilityEnabled: () => true,
  });

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
    const shopA = await prisma.shop.create({
      data: { myshopifyDomain: SHOP_A, processingEnabled: true },
    });
    await prisma.shopifyLocationFact.createMany({
      data: [
        completeLocationData({ id: "11", shopId: shopA.id }),
        completeLocationData({ id: "12", shopId: shopA.id }),
      ],
    });
    await prisma.shopifyInventoryItemFact.createMany({
      data: [101, 102].map((n) => ({
        ...completeInventoryItemData({ id: String(n), shopId: shopA.id }),
        shopifyVariantGid: null,
      })),
    });
    await prisma.shopifyVariantCache.createMany({
      data: [
        { id: RED, title: "Red wine", inventoryItemId: item(101) },
        { id: WHITE, title: "White wine", inventoryItemId: item(102) },
      ].map((v) => ({
        shop: SHOP_A,
        shopId: shopA.id,
        shopifyVariantId: v.id,
        title: v.title,
        inventoryItemId: v.inventoryItemId,
      })),
    });
    // A count sheet lists the items the sync knows at the location.
    await prisma.shopifyInventoryLevelFact.createMany({
      data: [
        { itemId: "101", onHand: 10 },
        { itemId: "102", onHand: 20 },
      ].map(({ itemId, onHand }) => ({
        ...completeInventoryLevelData({
          id: `level-${itemId}-11`,
          shopId: shopA.id,
          itemId,
          locationId: "11",
          available: onHand,
        }),
        onHandQuantity: onHand,
      })),
    });
    const snapshotDate = new Date("2026-11-01T00:00:00Z");
    await prisma.inventorySnapshot.createMany({
      data: [
        { shopifyVariantId: RED, locationId: SOURCE, quantityAvailable: 10 },
        { shopifyVariantId: WHITE, locationId: SOURCE, quantityAvailable: 20 },
      ].map((s) => ({ ...s, shop: SHOP_A, shopId: shopA.id, snapshotDate })),
    });
    dbA = createTenantDb(
      (
        await resolveAuthorityAfterVerifiedAuth({
          verifiedDomain: SHOP_A,
          source: "verified_admin_request",
          correlationId: "stock-race-test",
          createIfMissing: false,
        })
      ).tenant,
    );
  }, 180_000);

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "InventoryOperationLine", "InventoryOperation",
         "StocktakeLineItem", "Stocktake", "TransferLineItem", "TransferOrder" CASCADE`,
    );
    shopify = new FakeShopify();
    observed = [];
    shopify.setLevel(101, 10, 11);
    shopify.setLevel(102, 20, 11);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it.each(Array.from({ length: ROUNDS }, (_, i) => i))(
    "stocktake: 8 completes racing 6 count changes, round %i",
    async () => {
      const started = await createStocktake(
        dbA,
        null,
        { shop: SHOP_A, locationId: SOURCE, name: "race", actor: STAFF },
        { readQuantities },
      );
      expect(started).toMatchObject({ ok: true, lineCount: 2 });
      const stocktake = await prisma.stocktake.findFirstOrThrow({
        include: { lineItems: true },
      });
      const red = stocktake.lineItems.find(
        (l) => l.shopifyVariantId === RED,
      )!.id;
      const white = stocktake.lineItems.find(
        (l) => l.shopifyVariantId === WHITE,
      )!.id;
      const count = (lineId: string, countedQty: number) =>
        saveStocktakeCount(
          dbA,
          null,
          { lineId, countedQty, actor: STAFF },
          { readQuantities },
        );
      await count(red, 7);
      await count(white, 25);

      const outcomes = await Promise.allSettled([
        ...Array.from({ length: 8 }, async () => {
          await sleep(Math.random() * 30);
          return completeStocktake(dbA, null, STAFF, stocktake.id, enabled());
        }),
        ...[5, 9, 3, 12, 0, 6].map(async (qty) => {
          await sleep(Math.random() * 80);
          return count(red, qty);
        }),
      ]);
      const thrown = outcomes.filter((o) => o.status === "rejected");
      expect(
        thrown.map((o) => String((o as PromiseRejectedResult).reason)),
      ).toEqual([]);

      // Red starts at 10 and is only ever counted as one of these; white is
      // counted once as 25. Any other quantity is a variance applied twice.
      const redCounts = new Set([10, 7, 5, 9, 3, 12, 0, 6]);
      const strayStocktake = () =>
        observed.filter(
          (seen) => !redCounts.has(seen.red) || ![20, 25].includes(seen.white),
        );
      expect(strayStocktake()).toEqual([]);

      // Settle: press complete until the count closes.
      for (let i = 0; i < 6; i += 1) {
        const now = await prisma.stocktake.findUniqueOrThrow({
          where: { id: stocktake.id },
        });
        if (now.status === "COMPLETED") break;
        await completeStocktake(dbA, null, STAFF, stocktake.id, enabled());
      }
      const closed = await prisma.stocktake.findUniqueOrThrow({
        where: { id: stocktake.id },
        include: { lineItems: true },
      });
      expect(closed.status).toBe("COMPLETED");
      expect(strayStocktake()).toEqual([]);
      const counted = (id: string) =>
        closed.lineItems.find((l) => l.id === id)!.countedQty;
      // No sales happened, so Shopify must end at exactly the closing counts.
      expect({
        red: shopify.level(101),
        white: shopify.level(102),
      }).toEqual({ red: counted(red), white: counted(white) });

      const applied = await prisma.inventoryOperationLine.findMany({
        where: { status: "APPLIED" },
      });
      const sum = (gid: string) =>
        applied
          .filter((l) => l.inventoryItemGid === gid)
          .reduce((total, l) => total + l.delta, 0);
      expect({ red: 10 + sum(item(101)), white: 20 + sum(item(102)) }).toEqual({
        red: shopify.level(101),
        white: shopify.level(102),
      });
    },
    60_000,
  );

  it.each(Array.from({ length: ROUNDS }, (_, i) => i))(
    "transfer: ships, receives and cancels racing, round %i",
    async () => {
      await createTransfer(dbA, {
        shop: SHOP_A,
        sourceLocationId: SOURCE,
        destinationLocationId: DESTINATION,
        notes: null,
      });
      const transfer = await prisma.transferOrder.findFirstOrThrow();
      await addTransferLine(dbA, {
        transferId: transfer.id,
        shopifyVariantId: RED,
        quantity: 4,
      });
      await addTransferLine(dbA, {
        transferId: transfer.id,
        shopifyVariantId: WHITE,
        quantity: 6,
      });

      const jitter = async <T>(fn: () => Promise<T>, max: number) => {
        await sleep(Math.random() * max);
        return fn();
      };
      const outcomes = await Promise.allSettled([
        ...Array.from({ length: 5 }, () =>
          jitter(
            () => shipTransfer(dbA, null, STAFF, transfer.id, enabled()),
            30,
          ),
        ),
        ...Array.from({ length: 3 }, () =>
          jitter(
            () => cancelTransfer(dbA, null, STAFF, transfer.id, enabled()),
            90,
          ),
        ),
        ...Array.from({ length: 4 }, () =>
          jitter(
            () => receiveTransfer(dbA, null, STAFF, transfer.id, enabled()),
            140,
          ),
        ),
      ]);
      const thrown = outcomes.filter((o) => o.status === "rejected");
      expect(
        thrown.map((o) => String((o as PromiseRejectedResult).reason)),
      ).toEqual([]);

      // Settle anything left half done: a draft is cancelled, a transit is left.
      const strayTransfer = () =>
        observed.filter(
          (seen) =>
            ![10, 6].includes(seen.red) ||
            ![20, 14].includes(seen.white) ||
            ![0, 4].includes(seen.redDest) ||
            ![0, 6].includes(seen.whiteDest),
        );
      expect(strayTransfer()).toEqual([]);
      for (let i = 0; i < 6; i += 1) {
        const now = await prisma.transferOrder.findUniqueOrThrow({
          where: { id: transfer.id },
        });
        if (now.status !== "DRAFT") break;
        await cancelTransfer(dbA, null, STAFF, transfer.id, enabled());
      }
      const final = await prisma.transferOrder.findUniqueOrThrow({
        where: { id: transfer.id },
      });
      expect(strayTransfer()).toEqual([]);
      const levels = {
        redSource: shopify.level(101, 11),
        whiteSource: shopify.level(102, 11),
        redDestination: shopify.level(101, 12),
        whiteDestination: shopify.level(102, 12),
      };
      const expected: Record<string, typeof levels> = {
        CANCELLED: {
          redSource: 10,
          whiteSource: 20,
          redDestination: 0,
          whiteDestination: 0,
        },
        IN_TRANSIT: {
          redSource: 6,
          whiteSource: 14,
          redDestination: 0,
          whiteDestination: 0,
        },
        RECEIVED: {
          redSource: 6,
          whiteSource: 14,
          redDestination: 4,
          whiteDestination: 6,
        },
      };
      expect({ status: final.status, levels }).toEqual({
        status: final.status,
        levels: expected[final.status],
      });
    },
    60_000,
  );

  describe("transfer: Shopify accepts only part of a movement", () => {
    /** One request per line, so Shopify can accept one line and not another. */
    const lineByLine = () => ({ ...enabled(), batchSize: 1 });
    const accept = () => shopify.next(() => null);
    const refuse = () =>
      shopify.next(() => ({
        kind: "rejected",
        errors: [
          {
            code: "INTERNAL_SERVER_ERROR",
            message: "Shopify refused this change",
            changeIndex: null,
          },
        ],
      }));
    const stock = () => ({
      redSource: shopify.level(101, 11),
      whiteSource: shopify.level(102, 11),
      redDestination: shopify.level(101, 12),
      whiteDestination: shopify.level(102, 12),
    });
    const UNTOUCHED = {
      redSource: 10,
      whiteSource: 20,
      redDestination: 0,
      whiteDestination: 0,
    };
    const statusOf = async (id: string) =>
      (await prisma.transferOrder.findUniqueOrThrow({ where: { id } })).status;

    /** A draft of 4 red and 6 white from the source to the destination. */
    async function draft() {
      await createTransfer(dbA, {
        shop: SHOP_A,
        sourceLocationId: SOURCE,
        destinationLocationId: DESTINATION,
        notes: null,
      });
      const { id } = await prisma.transferOrder.findFirstOrThrow();
      for (const [shopifyVariantId, quantity] of [
        [RED, 4],
        [WHITE, 6],
      ] as const) {
        await addTransferLine(dbA, {
          transferId: id,
          shopifyVariantId,
          quantity,
        });
      }
      const lines = await prisma.transferLineItem.findMany({
        where: { transferOrderId: id },
      });
      const lineOf = (variant: string) =>
        lines.find((line) => line.shopifyVariantId === variant)!.id;
      return { id, redLine: lineOf(RED), whiteLine: lineOf(WHITE) };
    }

    /** Red leaves the source; Shopify refuses white. */
    async function halfShipped() {
      const transfer = await draft();
      accept();
      refuse();
      const shipped = await shipTransfer(
        dbA,
        null,
        STAFF,
        transfer.id,
        lineByLine(),
      );
      expect(shipped).toMatchObject({ ok: false });
      expect(await statusOf(transfer.id)).toBe("DRAFT");
      expect(stock()).toEqual({ ...UNTOUCHED, redSource: 6 });
      return transfer;
    }

    it("a half-accepted shipment stays a draft, and shipping again sends only the rest", async () => {
      const { id } = await halfShipped();

      expect(
        await shipTransfer(dbA, null, STAFF, id, lineByLine()),
      ).toMatchObject({ ok: true, alreadyDone: false });

      expect(await statusOf(id)).toBe("IN_TRANSIT");
      expect(stock()).toEqual({ ...UNTOUCHED, redSource: 6, whiteSource: 14 });
    }, 60_000);

    it("cancelling a half-accepted shipment puts back only what left", async () => {
      const { id } = await halfShipped();

      expect(
        await cancelTransfer(dbA, null, STAFF, id, lineByLine()),
      ).toMatchObject({ ok: true, alreadyDone: false });
      expect(
        await cancelTransfer(dbA, null, STAFF, id, lineByLine()),
      ).toMatchObject({ ok: true, alreadyDone: true });

      expect(await statusOf(id)).toBe("CANCELLED");
      expect(stock()).toEqual(UNTOUCHED);
    }, 60_000);

    it("lines changed after a half-accepted shipment move only the difference", async () => {
      const { id, redLine, whiteLine } = await halfShipped();
      await setTransferLineQuantity(dbA, {
        transferId: id,
        lineId: redLine,
        quantity: 2,
      });
      await setTransferLineQuantity(dbA, {
        transferId: id,
        lineId: whiteLine,
        quantity: 1,
      });

      expect(
        await shipTransfer(dbA, null, STAFF, id, lineByLine()),
      ).toMatchObject({ ok: true });

      // Two of the four red units that left go back; one white unit leaves.
      expect(await statusOf(id)).toBe("IN_TRANSIT");
      expect(stock()).toEqual({ ...UNTOUCHED, redSource: 8, whiteSource: 19 });
    }, 60_000);

    it("a lost answer and a refused put-back neither lose stock nor return it twice", async () => {
      const { id } = await draft();
      accept();
      shopify.loseNextResponse();
      expect(
        await shipTransfer(dbA, null, STAFF, id, lineByLine()),
      ).toMatchObject({ ok: false });
      // Shopify moved both lines; the app knows about one.
      expect(await statusOf(id)).toBe("DRAFT");
      expect(stock()).toEqual({ ...UNTOUCHED, redSource: 6, whiteSource: 14 });

      // The cancel first learns the white line did land, then Shopify
      // refuses to take red back.
      accept();
      refuse();
      expect(
        await cancelTransfer(dbA, null, STAFF, id, lineByLine()),
      ).toMatchObject({ ok: false });
      expect(await statusOf(id)).toBe("DRAFT");
      expect(stock()).toEqual({ ...UNTOUCHED, redSource: 6 });

      expect(
        await cancelTransfer(dbA, null, STAFF, id, lineByLine()),
      ).toMatchObject({ ok: true, alreadyDone: false });
      expect(await statusOf(id)).toBe("CANCELLED");
      expect(stock()).toEqual(UNTOUCHED);
    }, 60_000);

    it("a half-accepted receipt stays in transit and closed to changes, and receiving again adds only the rest", async () => {
      const { id, redLine } = await draft();
      await shipTransfer(dbA, null, STAFF, id, lineByLine());
      const shipped = { ...UNTOUCHED, redSource: 6, whiteSource: 14 };
      accept();
      refuse();

      expect(
        await receiveTransfer(dbA, null, STAFF, id, lineByLine()),
      ).toMatchObject({ ok: false });
      expect(await statusOf(id)).toBe("IN_TRANSIT");
      expect(stock()).toEqual({ ...shipped, redDestination: 4 });

      expect(
        await cancelTransfer(dbA, null, STAFF, id, lineByLine()),
      ).toMatchObject({ ok: false });
      expect(
        await setTransferLineQuantity(dbA, {
          transferId: id,
          lineId: redLine,
          quantity: 1,
        }),
      ).toMatchObject({ ok: false });
      expect(stock()).toEqual({ ...shipped, redDestination: 4 });

      expect(
        await receiveTransfer(dbA, null, STAFF, id, lineByLine()),
      ).toMatchObject({ ok: true, alreadyDone: false, completed: true });
      expect(
        await receiveTransfer(dbA, null, STAFF, id, lineByLine()),
      ).toMatchObject({ ok: true, alreadyDone: true });

      expect(await statusOf(id)).toBe("RECEIVED");
      expect(stock()).toEqual({
        ...shipped,
        redDestination: 4,
        whiteDestination: 6,
      });
    }, 60_000);
  });
});
