/**
 * The transfer workflow end to end against the inventory ledger: building a
 * draft from scanned or pasted codes, the stock check before shipping,
 * receiving in parts by scan, rejected units, closing a transfer short, and
 * what the pages read back. Disposable PostgreSQL 16 with RLS applied, and the
 * in-memory Shopify double from the ledger suite. Plain ship, receive and
 * cancel are covered in stocktake-transfer-ledger.test.ts.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { ExecuteInventoryOperationOptions } from "../../../app/services/inventory-writes/execute.server";
import type { ReadLevelQuantities } from "../../../app/services/inventory-writes/shopify-levels.server";
import type { InventoryActor } from "../../../app/services/inventory-writes/types";
import { transferStatusBadge } from "../../../app/services/transfers/transfer-display";
import {
  getTransfer,
  getTransferHistory,
  getTransferLines,
  listTransferLinesForExport,
  listTransfers,
} from "../../../app/services/transfers/transfer-read.server";
import {
  closeTransfer,
  countInOutstandingUnits,
  postTransferReceipt,
  receiveTransfer,
  recordTransferReceiptScan,
  setTransferReceiveQuantity,
  setTransferRejectedQuantity,
} from "../../../app/services/transfers/transfer-receiving.server";
import {
  addTransferItems,
  addTransferLine,
  cancelTransfer,
  createTransfer,
  removeTransferLine,
  setTransferLineQuantity,
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

const SHOP_A = "transfer-workflow-a.myshopify.com";
const SHOP_B = "transfer-workflow-b.myshopify.com";

const variant = (n: number) => `gid://shopify/ProductVariant/${n}`;
const RED = variant(1);
const WHITE = variant(2);
const ROSE = variant(3);
const TWIN_A = variant(4);
const TWIN_B = variant(5);
const UNLINKED = variant(6);
const UNTRACKED = variant(7);
const OTHER_SHOPS = variant(9);

const SOURCE = location(11);
const DESTINATION = location(12);
const OTHER_SHOPS_LOCATION = location(21);

const STAFF: InventoryActor = {
  shopifyUserId: "42",
  displayName: "Dana Picker",
  channel: "ADMIN",
};
const RECEIVER: InventoryActor = {
  shopifyUserId: "77",
  displayName: "Sam Receiver",
  channel: "ADMIN",
};

const NOT_IN_TRANSIT = "Only a transfer that is in transit can be received.";
const NOT_DRAFT =
  "This transfer has already been shipped or cancelled. Its lines can no longer be changed.";
const SWITCHED_OFF =
  "Transfer inventory changes are switched off for this app. Nothing was sent to Shopify and the transfer was not changed.";

describe("transfer workflow", () => {
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

  /**
   * Shopify's available quantities as the stock check reads them: the fake's
   * own levels, except where `overrides` names an `item|location` pair.
   */
  const reader =
    (overrides: Record<string, number | null> = {}): ReadLevelQuantities =>
    async (locationId, inventoryItemIds) =>
      new Map(
        inventoryItemIds.map((id) => {
          const key = `${id}|${locationId}`;
          const live = shopify.level(
            Number(id.split("/").pop()),
            Number(locationId.split("/").pop()),
          );
          return [id, key in overrides ? overrides[key] : live];
        }),
      );

  const operations = (sourceType: string, sourceId: string) =>
    prisma.inventoryOperation.findMany({
      where: { sourceType, sourceId },
      orderBy: { createdAt: "asc" },
      include: { lines: { orderBy: { lineNumber: "asc" } } },
    });

  const load = (id: string) =>
    prisma.transferOrder.findUniqueOrThrow({
      where: { id },
      include: { lineItems: { orderBy: { id: "asc" } } },
    });

  const lineOf = async (id: string, shopifyVariantId: string) =>
    (await load(id)).lineItems.find(
      (line) => line.shopifyVariantId === shopifyVariantId,
    )!;

  const levels = () => ({
    redSource: shopify.level(101, 11),
    whiteSource: shopify.level(102, 11),
    redDestination: shopify.level(101, 12),
    whiteDestination: shopify.level(102, 12),
  });

  async function draftTransfer(
    lines: Array<[variantId: string, quantity: number]> = [
      [RED, 4],
      [WHITE, 6],
    ],
    actor: InventoryActor | null = STAFF,
  ) {
    const created = await createTransfer(dbA, {
      shop: SHOP_A,
      sourceLocationId: SOURCE,
      destinationLocationId: DESTINATION,
      notes: null,
      actor,
    });
    if (!created.ok) throw new Error(created.error);
    for (const [shopifyVariantId, quantity] of lines) {
      const added = await addTransferLine(dbA, {
        transferId: created.transferId,
        shopifyVariantId,
        quantity,
      });
      if (!added.ok) throw new Error(added.error);
    }
    return created.transferId;
  }

  /** A transfer in transit: 4 red and 6 white have left the source. */
  async function shippedTransfer(
    lines?: Array<[variantId: string, quantity: number]>,
  ) {
    const id = await draftTransfer(lines);
    const shipped = await shipTransfer(dbA, null, STAFF, id, enabled());
    if (!shipped.ok) throw new Error(shipped.error);
    return id;
  }

  const scan = (transferId: string, code: string, quantity?: number) =>
    recordTransferReceiptScan(dbA, { transferId, code, quantity });

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
        completeLocationData({ id: "21", shopId: shopB.id }),
      ],
    });
    await prisma.shopifyInventoryItemFact.createMany({
      data: [
        ...[101, 102, 103, 104, 105].map((n) => ({
          ...completeInventoryItemData({ id: String(n), shopId: shopA.id }),
          shopifyVariantGid: null,
        })),
        {
          ...completeInventoryItemData({ id: "107", shopId: shopA.id }),
          shopifyVariantGid: null,
          tracked: false,
        },
        {
          ...completeInventoryItemData({ id: "201", shopId: shopB.id }),
          shopifyVariantGid: null,
        },
      ],
    });
    await prisma.shopifyVariantCache.createMany({
      data: [
        {
          id: RED,
          title: "Red wine",
          sku: "RED-750",
          barcode: "5010001",
          inventoryItemId: item(101),
        },
        {
          id: WHITE,
          title: "White wine",
          sku: "WHT-750",
          barcode: "5010002",
          inventoryItemId: item(102),
        },
        {
          id: ROSE,
          title: "Rosé",
          sku: "ROSE-750",
          barcode: "5010003",
          inventoryItemId: item(103),
        },
        {
          id: TWIN_A,
          title: "Twin A",
          sku: "TWIN-A",
          barcode: "5019999",
          inventoryItemId: item(104),
        },
        {
          id: TWIN_B,
          title: "Twin B",
          sku: "TWIN-B",
          barcode: "5019999",
          inventoryItemId: item(105),
        },
        {
          id: UNLINKED,
          title: "Unlinked gin",
          sku: "GIN-UNLINKED",
          barcode: null,
          inventoryItemId: null,
        },
        {
          id: UNTRACKED,
          title: "Gift card",
          sku: "GIFT-CARD",
          barcode: null,
          inventoryItemId: item(107),
        },
      ].map((v) => ({
        shop: SHOP_A,
        shopId: shopA.id,
        shopifyVariantId: v.id,
        title: v.title,
        sku: v.sku,
        barcode: v.barcode,
        inventoryItemId: v.inventoryItemId,
      })),
    });
    // The other shop sells an item under the same SKU; it must never match here.
    await prisma.shopifyVariantCache.create({
      data: {
        shop: SHOP_B,
        shopId: shopB.id,
        shopifyVariantId: OTHER_SHOPS,
        title: "Other shop's whisky",
        sku: "RED-750",
        barcode: "5010001",
        inventoryItemId: item(201),
      },
    });

    const authority = async (domain: string) =>
      (
        await resolveAuthorityAfterVerifiedAuth({
          verifiedDomain: domain,
          source: "verified_admin_request",
          correlationId: "transfer-workflow-test",
          createIfMissing: false,
        })
      ).tenant;
    dbA = createTenantDb(await authority(SHOP_A));
    dbB = createTenantDb(await authority(SHOP_B));
  }, 180_000);

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "InventoryOperationLine", "InventoryOperation",
         "TransferLineItem", "TransferOrder" CASCADE`,
    );
    shopify = new FakeShopify();
    shopify.setLevel(101, 10, 11);
    shopify.setLevel(102, 20, 11);
    shopify.setLevel(103, 5, 11);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  describe("building a draft", () => {
    it("adds pasted items by SKU or barcode, with a SKU and a barcode of one item on one line", async () => {
      const id = await draftTransfer([]);

      const first = await addTransferItems(dbA, {
        transferId: id,
        itemsText: "RED-750\t3\n5010001\n\nWHT-750, 2\n",
      });

      expect(first).toEqual({
        ok: true,
        added: 2,
        updated: 0,
        items: [
          { title: "Red wine", quantity: 4 },
          { title: "White wine", quantity: 2 },
        ],
      });
      expect(
        (await load(id)).lineItems.map((l) => [l.shopifyVariantId, l.quantity]),
      ).toEqual([
        [RED, 4],
        [WHITE, 2],
      ]);

      expect(
        await addTransferItems(dbA, { transferId: id, itemsText: "RED-750;6" }),
      ).toEqual({
        ok: true,
        added: 0,
        updated: 1,
        items: [{ title: "Red wine", quantity: 10 }],
      });
      expect((await lineOf(id, RED)).quantity).toBe(10);
      expect((await load(id)).lineItems).toHaveLength(2);
    });

    it("adds nothing when any pasted line cannot be added, and says why for each", async () => {
      const id = await draftTransfer([]);

      const result = await addTransferItems(dbA, {
        transferId: id,
        itemsText: [
          "RED-750,2",
          "NOPE",
          "5019999",
          "GIN-UNLINKED",
          "GIFT-CARD,1",
        ].join("\n"),
      });

      expect(result).toEqual({
        ok: false,
        error:
          "Some lines could not be added. Nothing was added to the transfer.",
        details: [
          "Line 2: no item has the barcode or SKU NOPE.",
          expect.stringMatching(/^Line 3: 5019999 matches 2 items \(/),
          "Line 4: Shopify inventory is not linked yet for Unlinked gin. Run a catalog sync from the dashboard.",
          "Line 5: Gift card is not tracked for inventory in Shopify, so it cannot be transferred.",
        ],
      });
      expect((await load(id)).lineItems).toEqual([]);

      expect(
        await addTransferItems(dbA, { transferId: id, itemsText: "RED-750,0" }),
      ).toMatchObject({
        ok: false,
        details: [expect.stringContaining('Line 1: "0" is not a whole number')],
      });
      expect(
        await addTransferItems(dbA, { transferId: id, itemsText: "  \n" }),
      ).toEqual({
        ok: false,
        error: "Enter at least one SKU or barcode.",
        details: [],
      });
      expect((await load(id)).lineItems).toEqual([]);
    });

    it("changes and removes lines only while the transfer is a draft", async () => {
      const id = await draftTransfer();
      const other = await draftTransfer([[ROSE, 1]]);
      const red = await lineOf(id, RED);
      await setTransferPickedQuantity(dbA, { lineId: red.id, pickedQty: 3 });

      expect(
        await setTransferLineQuantity(dbA, {
          lineId: red.id,
          quantity: 2,
          transferId: id,
        }),
      ).toEqual({ ok: true });
      expect(await lineOf(id, RED)).toMatchObject({
        quantity: 2,
        pickedQty: 2,
      });

      expect(
        await setTransferLineQuantity(dbA, { lineId: red.id, quantity: 0 }),
      ).toMatchObject({ ok: false });
      // A line is changed only through the transfer it belongs to.
      expect(
        await setTransferLineQuantity(dbA, {
          lineId: red.id,
          quantity: 9,
          transferId: other,
        }),
      ).toEqual({ ok: false, error: "Transfer line not found" });
      expect(
        await removeTransferLine(dbA, { lineId: red.id, transferId: other }),
      ).toEqual({ ok: false, error: "Transfer line not found" });
      expect((await lineOf(id, RED)).quantity).toBe(2);

      expect(
        await removeTransferLine(dbA, { lineId: red.id, transferId: id }),
      ).toEqual({ ok: true });
      expect((await load(id)).lineItems.map((l) => l.shopifyVariantId)).toEqual(
        [WHITE],
      );

      await shipTransfer(dbA, null, STAFF, id, enabled());
      const white = await lineOf(id, WHITE);
      expect(
        await setTransferLineQuantity(dbA, { lineId: white.id, quantity: 1 }),
      ).toEqual({ ok: false, error: NOT_DRAFT });
      expect(await removeTransferLine(dbA, { lineId: white.id })).toEqual({
        ok: false,
        error: NOT_DRAFT,
      });
      expect(
        await addTransferItems(dbA, { transferId: id, itemsText: "RED-750" }),
      ).toEqual({ ok: false, error: NOT_DRAFT, details: [] });
      expect(await lineOf(id, WHITE)).toMatchObject({ quantity: 6 });
    });

    it("records who created, shipped and cancelled a transfer", async () => {
      const id = await draftTransfer();
      expect((await load(id)).createdByUserId).toBe("42");

      const shippedAt = new Date("2026-11-14T09:00:00Z");
      await shipTransfer(dbA, null, RECEIVER, id, {
        ...enabled(),
        now: () => shippedAt,
      });
      expect(await load(id)).toMatchObject({
        status: "IN_TRANSIT",
        shippedAt,
        shippedByUserId: "77",
      });

      const draft = await draftTransfer([[ROSE, 1]], null);
      expect((await load(draft)).createdByUserId).toBeNull();
      const cancelledAt = new Date("2026-11-14T10:00:00Z");
      await cancelTransfer(dbA, null, RECEIVER, draft, {
        ...enabled(),
        now: () => cancelledAt,
      });
      expect(await load(draft)).toMatchObject({
        status: "CANCELLED",
        cancelledAt,
        cancelledByUserId: "77",
      });
    });
  });

  describe("the stock check before shipping", () => {
    it("stops when the source has fewer units than the transfer takes, until that is confirmed", async () => {
      const id = await draftTransfer();
      const short = reader({ [`${item(101)}|${SOURCE}`]: 3 });

      const stopped = await shipTransfer(dbA, null, STAFF, id, {
        ...enabled(),
        readQuantities: short,
      });

      expect(stopped).toEqual({
        ok: false,
        error: expect.stringContaining(
          "The source location does not have enough stock for every item. Nothing was sent to Shopify.",
        ),
        problems: [
          {
            shopifyVariantId: RED,
            title: "Red wine",
            message:
              "Shopify shows 3 available at the source; the transfer takes 4 units.",
          },
        ],
        blocker: "SOURCE_SHORT",
      });
      expect(shopify.requests).toHaveLength(0);
      expect(await prisma.inventoryOperation.count()).toBe(0);
      expect((await load(id)).status).toBe("DRAFT");

      const confirmed = await shipTransfer(dbA, null, STAFF, id, {
        ...enabled(),
        readQuantities: short,
        allowShortSource: true,
      });

      expect(confirmed).toEqual({ ok: true, alreadyDone: false });
      expect((await load(id)).status).toBe("IN_TRANSIT");
      expect(levels()).toMatchObject({ redSource: 6, whiteSource: 14 });
    });

    it("refuses an item Shopify does not stock at the source or the destination, confirmed or not", async () => {
      const id = await draftTransfer();

      const noDestination = await shipTransfer(dbA, null, STAFF, id, {
        ...enabled(),
        readQuantities: reader({ [`${item(102)}|${DESTINATION}`]: null }),
        allowShortSource: true,
      });
      expect(noDestination).toMatchObject({
        ok: false,
        error: expect.stringContaining(
          "Some items cannot be transferred between these locations yet.",
        ),
        problems: [
          {
            shopifyVariantId: WHITE,
            message: expect.stringContaining(
              "Shopify does not stock this item at the destination",
            ),
          },
        ],
        blocker: null,
      });

      const noSource = await shipTransfer(dbA, null, STAFF, id, {
        ...enabled(),
        readQuantities: reader({ [`${item(101)}|${SOURCE}`]: null }),
        allowShortSource: true,
      });
      expect(noSource).toMatchObject({
        ok: false,
        problems: [
          {
            shopifyVariantId: RED,
            message: "Shopify does not stock this item at the source location.",
          },
        ],
        blocker: null,
      });

      expect(shopify.requests).toHaveLength(0);
      expect((await load(id)).status).toBe("DRAFT");
    });

    it("sends nothing when Shopify's quantities cannot be read", async () => {
      const id = await draftTransfer();

      const result = await shipTransfer(dbA, null, STAFF, id, {
        ...enabled(),
        readQuantities: async () => {
          throw new Error("Shopify is throttling");
        },
      });

      expect(result).toEqual({
        ok: false,
        error:
          "Shopify's current quantities could not be read. Nothing was sent to Shopify. Try again in a moment.",
        problems: [],
        blocker: null,
      });
      expect(shopify.requests).toHaveLength(0);
      expect((await load(id)).status).toBe("DRAFT");
    });

    it("checks only the units that have not left yet when a partly sent shipment is retried", async () => {
      const id = await draftTransfer();
      rejectNextChangeAt(1);
      await shipTransfer(dbA, null, STAFF, id, {
        ...enabled(),
        readQuantities: reader(),
      });
      expect(levels()).toMatchObject({ redSource: 6, whiteSource: 20 });

      // The red units are already out of the source; had they been checked
      // again, 0 available would have stopped the retry.
      const retried = await shipTransfer(dbA, null, STAFF, id, {
        ...enabled(),
        readQuantities: reader({ [`${item(101)}|${SOURCE}`]: 0 }),
      });

      expect(retried).toEqual({ ok: true, alreadyDone: false });
      expect(levels()).toMatchObject({ redSource: 6, whiteSource: 14 });
    });
  });

  describe("receiving", () => {
    it("counts scanned units in without touching Shopify, then posts them as a partial receipt", async () => {
      const id = await shippedTransfer();
      const sent = shopify.requests.length;

      expect(await scan(id, "RED-750")).toEqual({
        ok: true,
        title: "Red wine",
        countedIn: 1,
        outstanding: 3,
      });
      expect(await scan(id, " 5010001 ", 2)).toEqual({
        ok: true,
        title: "Red wine",
        countedIn: 3,
        outstanding: 1,
      });
      expect(shopify.requests).toHaveLength(sent);
      expect(await lineOf(id, RED)).toMatchObject({
        pendingReceiveQty: 3,
        receivedQty: 0,
      });

      const posted = await postTransferReceipt(
        dbA,
        null,
        RECEIVER,
        id,
        enabled(),
      );

      expect(posted).toEqual({
        ok: true,
        alreadyDone: false,
        receivedUnits: 3,
        completed: false,
      });
      expect(levels()).toEqual({
        redSource: 6,
        whiteSource: 14,
        redDestination: 3,
        whiteDestination: 0,
      });
      const partly = await load(id);
      expect(partly).toMatchObject({
        status: "IN_TRANSIT",
        receivedAt: null,
        receivedByUserId: null,
      });
      expect(await lineOf(id, RED)).toMatchObject({
        pendingReceiveQty: 0,
        receivedQty: 3,
      });
      const [receipt, ...rest] = await operations("TransferReceipt", id);
      expect(rest).toEqual([]);
      expect(receipt).toMatchObject({
        kind: "TRANSFER",
        status: "APPLIED",
        reason: "movement_received",
        actorShopifyUserId: "77",
      });
      expect(
        receipt.lines.map((l) => [l.inventoryItemGid, l.locationGid, l.delta]),
      ).toEqual([[item(101), DESTINATION, 3]]);

      const receivedAt = new Date("2026-11-14T12:00:00Z");
      const finished = await receiveTransfer(dbA, null, RECEIVER, id, {
        ...enabled(),
        now: () => receivedAt,
      });

      expect(finished).toEqual({
        ok: true,
        alreadyDone: false,
        receivedUnits: 7,
        completed: true,
      });
      // The second receipt sends only what the first one did not.
      expect(
        shopify.requests
          .at(-1)!
          .changes.map((c) => [c.inventoryItemId, c.locationId, c.delta]),
      ).toEqual([
        [item(101), DESTINATION, 1],
        [item(102), DESTINATION, 6],
      ]);
      expect(levels()).toMatchObject({
        redDestination: 4,
        whiteDestination: 6,
      });
      expect(await load(id)).toMatchObject({
        status: "RECEIVED",
        receivedAt,
        receivedByUserId: "77",
        shortResolution: null,
      });
    });

    it("refuses a scan of an unknown item, an item not on the transfer, or more units than were shipped", async () => {
      const id = await shippedTransfer();

      expect(await scan(id, "NOPE")).toEqual({
        ok: false,
        error: "No item in this shop's catalog has the barcode or SKU NOPE.",
      });
      expect(await scan(id, "ROSE-750")).toEqual({
        ok: false,
        error: "Rosé is not on this transfer.",
      });
      expect(await scan(id, "5019999")).toMatchObject({
        ok: false,
        error: expect.stringContaining("5019999 matches 2 items"),
      });
      expect(await scan(id, "   ")).toEqual({
        ok: false,
        error: "Scan or type a barcode or SKU.",
      });
      expect(await scan(id, "RED-750", 0)).toMatchObject({ ok: false });
      expect(await scan(id, "RED-750", 5)).toEqual({
        ok: false,
        error:
          "Only 4 units of Red wine are still to be received on this transfer.",
      });
      expect((await lineOf(id, RED)).pendingReceiveQty).toBe(0);

      expect(await scan(id, "RED-750", 4)).toMatchObject({
        ok: true,
        outstanding: 0,
      });
      expect(await scan(id, "RED-750")).toEqual({
        ok: false,
        error:
          "Every unit of Red wine shipped on this transfer is already accounted for.",
      });
      expect((await lineOf(id, RED)).pendingReceiveQty).toBe(4);

      const draft = await draftTransfer([[ROSE, 1]]);
      expect(await scan(draft, "ROSE-750")).toEqual({
        ok: false,
        error: NOT_IN_TRANSIT,
      });
    });

    it("takes a barcode two catalog items share as the one that is on the transfer", async () => {
      shopify.setLevel(104, 3, 11);
      const id = await shippedTransfer([[TWIN_A, 2]]);

      expect(await scan(id, "5019999")).toEqual({
        ok: true,
        title: "Twin A",
        countedIn: 1,
        outstanding: 1,
      });
    });

    it("bounds the typed units of a line by what is still to be received", async () => {
      const id = await shippedTransfer();
      const red = await lineOf(id, RED);
      const set = (quantity: number) =>
        setTransferReceiveQuantity(dbA, {
          lineId: red.id,
          quantity,
          transferId: id,
        });

      expect(await set(3)).toEqual({ ok: true });
      expect((await lineOf(id, RED)).pendingReceiveQty).toBe(3);
      expect(await set(5)).toEqual({
        ok: false,
        error: "Only 4 units of this item are still to be received.",
      });
      expect(await set(-1)).toMatchObject({ ok: false });
      expect(await set(0)).toEqual({ ok: true });
      expect((await lineOf(id, RED)).pendingReceiveQty).toBe(0);

      await set(3);
      await postTransferReceipt(dbA, null, RECEIVER, id, enabled());
      expect(await set(2)).toEqual({
        ok: false,
        error: "Only 1 unit of this item is still to be received.",
      });
      expect(await set(1)).toEqual({ ok: true });

      expect(await countInOutstandingUnits(dbA, { transferId: id })).toEqual({
        ok: true,
        units: 6,
      });
      expect(
        (await load(id)).lineItems.map((l) => [
          l.shopifyVariantId,
          l.pendingReceiveQty,
        ]),
      ).toEqual([
        [RED, 1],
        [WHITE, 6],
      ]);
    });

    it("posts nothing when no units are counted in", async () => {
      const id = await shippedTransfer();
      const sent = shopify.requests.length;

      expect(
        await postTransferReceipt(dbA, null, RECEIVER, id, enabled()),
      ).toMatchObject({
        ok: false,
        error:
          "No units are counted in. Scan or enter the units that arrived, then post the receipt.",
      });
      expect(shopify.requests).toHaveLength(sent);
      expect(await operations("TransferReceipt", id)).toEqual([]);
    });

    it("adds stock once when a receipt is posted twice at the same time", async () => {
      const id = await shippedTransfer();
      await countInOutstandingUnits(dbA, { transferId: id });
      const sent = shopify.requests.length;

      const results = await Promise.all([
        postTransferReceipt(dbA, null, RECEIVER, id, enabled()),
        postTransferReceipt(dbA, null, RECEIVER, id, enabled()),
      ]);

      expect(results.some((r) => r.ok)).toBe(true);
      expect(shopify.requests).toHaveLength(sent + 1);
      expect(levels()).toMatchObject({
        redDestination: 4,
        whiteDestination: 6,
      });
      expect((await load(id)).status).toBe("RECEIVED");
      expect(
        (await load(id)).lineItems.map((l) => [
          l.receivedQty,
          l.pendingReceiveQty,
        ]),
      ).toEqual([
        [4, 0],
        [6, 0],
      ]);
    });

    it("keeps units counted in while a receipt was posting for the next post", async () => {
      const id = await shippedTransfer();
      await scan(id, "RED-750", 2);
      let lateScan: unknown;

      const posted = await postTransferReceipt(
        dbA,
        null,
        RECEIVER,
        id,
        enabled({
          sendBatch: async (request) => {
            lateScan ??= await scan(id, "RED-750");
            return shopify.send(request);
          },
        }),
      );

      expect(lateScan).toMatchObject({ ok: true, countedIn: 3 });
      expect(posted).toMatchObject({
        ok: false,
        error: expect.stringContaining(
          "Units were counted in or changed while this receipt was being posted.",
        ),
      });
      expect(levels().redDestination).toBe(2);
      expect(await lineOf(id, RED)).toMatchObject({
        pendingReceiveQty: 3,
        receivedQty: 0,
      });

      expect(
        await postTransferReceipt(dbA, null, RECEIVER, id, enabled()),
      ).toEqual({
        ok: true,
        alreadyDone: false,
        receivedUnits: 3,
        completed: false,
      });
      expect(shopify.requests.at(-1)!.changes).toEqual([
        expect.objectContaining({ inventoryItemId: item(101), delta: 1 }),
      ]);
      expect(levels().redDestination).toBe(3);
    });

    it("keeps rejected units out of stock at both locations and finishes when the rest is received", async () => {
      const id = await shippedTransfer();
      const white = await lineOf(id, WHITE);
      const reject = (rejectedQty: number, note: string | null) =>
        setTransferRejectedQuantity(dbA, {
          lineId: white.id,
          rejectedQty,
          note,
          transferId: id,
        });

      expect(await reject(2, "  Broken in transit  ")).toEqual({ ok: true });
      expect(await lineOf(id, WHITE)).toMatchObject({
        rejectedQty: 2,
        rejectNote: "Broken in transit",
      });
      expect(await reject(7, null)).toEqual({
        ok: false,
        error:
          "At most 6 units of this item can be rejected: the rest is already received or counted in.",
      });
      expect(await reject(1, "x".repeat(201))).toEqual({
        ok: false,
        error: "The reason can be at most 200 characters.",
      });
      expect(await scan(id, "WHT-750", 5)).toEqual({
        ok: false,
        error:
          "Only 4 units of White wine are still to be received on this transfer.",
      });
      const sent = shopify.requests.length;

      const finished = await receiveTransfer(
        dbA,
        null,
        RECEIVER,
        id,
        enabled(),
      );

      expect(finished).toEqual({
        ok: true,
        alreadyDone: false,
        receivedUnits: 8,
        completed: true,
      });
      expect(shopify.requests).toHaveLength(sent + 1);
      expect(levels()).toEqual({
        redSource: 6,
        whiteSource: 14,
        redDestination: 4,
        whiteDestination: 4,
      });
      const header = (await getTransfer(dbA, id))!;
      const { totals } = await getTransferLines(dbA, {
        transfer: header,
        filter: "all",
        page: 1,
      });
      expect(totals).toMatchObject({
        shipUnits: 10,
        receivedUnits: 8,
        rejectedUnits: 2,
        writtenOffUnits: 0,
        returnedUnits: 0,
        outstandingUnits: 0,
      });
      expect(transferStatusBadge(header.status, totals).label).toBe(
        "Received with rejects",
      );
      // Finished: rejects can no longer be changed.
      expect(await reject(0, null)).toEqual({
        ok: false,
        error: NOT_IN_TRANSIT,
      });
    });

    it("clears the reason when rejected units are set back to zero", async () => {
      const id = await shippedTransfer();
      const red = await lineOf(id, RED);
      await setTransferRejectedQuantity(dbA, {
        lineId: red.id,
        rejectedQty: 1,
        note: "Cork damage",
      });

      await setTransferRejectedQuantity(dbA, {
        lineId: red.id,
        rejectedQty: 0,
        note: "Cork damage",
      });

      expect(await lineOf(id, RED)).toMatchObject({
        rejectedQty: 0,
        rejectNote: null,
      });
    });

    it("sends nothing and keeps the counted units while the kill switch is off", async () => {
      const id = await shippedTransfer();
      await scan(id, "RED-750", 2);
      const sent = shopify.requests.length;

      expect(
        await postTransferReceipt(dbA, null, RECEIVER, id, switchedOff()),
      ).toEqual({
        ok: false,
        error: SWITCHED_OFF,
        problems: [],
        blocker: null,
      });
      expect(
        await receiveTransfer(dbA, null, RECEIVER, id, switchedOff()),
      ).toMatchObject({ ok: false, error: SWITCHED_OFF });

      expect(shopify.requests).toHaveLength(sent);
      expect(await operations("TransferReceipt", id)).toEqual([]);
      expect(await load(id)).toMatchObject({ status: "IN_TRANSIT" });
      expect(
        (await load(id)).lineItems.map((l) => l.pendingReceiveQty),
      ).toEqual([2, 0]);
    });
  });

  describe("closing a transfer short", () => {
    /** In transit with 3 of 4 red received: 1 red and 6 white are missing. */
    async function partlyReceived() {
      const id = await shippedTransfer();
      await scan(id, "RED-750", 3);
      const posted = await postTransferReceipt(
        dbA,
        null,
        RECEIVER,
        id,
        enabled(),
      );
      if (!posted.ok) throw new Error(posted.error);
      return id;
    }

    const close = (
      id: string,
      resolution: unknown,
      options: ExecuteInventoryOperationOptions = enabled(),
    ) => closeTransfer(dbA, null, RECEIVER, id, { resolution }, options);

    it("asks what to do with missing units before it closes", async () => {
      const id = await partlyReceived();
      const sent = shopify.requests.length;

      for (const resolution of [undefined, "", "LOST"]) {
        expect(await close(id, resolution)).toMatchObject({
          ok: false,
          error: expect.stringContaining(
            "7 units shipped on this transfer did not arrive.",
          ),
        });
      }
      expect(shopify.requests).toHaveLength(sent);
      expect((await load(id)).status).toBe("IN_TRANSIT");
    });

    it("puts missing units back into stock at the source", async () => {
      const id = await partlyReceived();
      const closedAt = new Date("2026-11-14T15:00:00Z");

      const closed = await closeTransfer(
        dbA,
        null,
        RECEIVER,
        id,
        { resolution: "RETURNED" },
        { ...enabled(), now: () => closedAt },
      );

      expect(closed).toEqual({
        ok: true,
        alreadyDone: false,
        missingUnits: 7,
        resolution: "RETURNED",
      });
      expect(levels()).toEqual({
        redSource: 7,
        whiteSource: 20,
        redDestination: 3,
        whiteDestination: 0,
      });
      expect(await load(id)).toMatchObject({
        status: "RECEIVED",
        receivedAt: closedAt,
        receivedByUserId: "77",
        shortResolution: "RETURNED",
      });
      expect(
        (await load(id)).lineItems.map((l) => [
          l.shopifyVariantId,
          l.receivedQty,
          l.returnedQty,
        ]),
      ).toEqual([
        [RED, 3, 1],
        [WHITE, 0, 6],
      ]);
      const shipment = await operations("TransferShipment", id);
      expect(shipment).toHaveLength(2);
      expect(shipment[1]).toMatchObject({
        status: "APPLIED",
        reason: "movement_canceled",
        actorShopifyUserId: "77",
      });
      expect(
        shipment[1].lines.map((l) => [
          l.inventoryItemGid,
          l.locationGid,
          l.delta,
        ]),
      ).toEqual([
        [item(101), SOURCE, 1],
        [item(102), SOURCE, 6],
      ]);

      const sent = shopify.requests.length;
      expect(await close(id, "RETURNED")).toEqual({
        ok: true,
        alreadyDone: true,
        missingUnits: 0,
        resolution: null,
      });
      expect(await scan(id, "WHT-750")).toEqual({
        ok: false,
        error: NOT_IN_TRANSIT,
      });
      expect(
        await postTransferReceipt(dbA, null, RECEIVER, id, enabled()),
      ).toMatchObject({ ok: true, alreadyDone: true });
      expect(shopify.requests).toHaveLength(sent);

      const header = (await getTransfer(dbA, id))!;
      const { totals } = await getTransferLines(dbA, {
        transfer: header,
        filter: "all",
        page: 1,
      });
      expect(totals).toMatchObject({
        shipUnits: 10,
        receivedUnits: 3,
        returnedUnits: 7,
        writtenOffUnits: 0,
        outstandingUnits: 0,
      });
      expect(transferStatusBadge(header.status, totals).label).toBe(
        "Closed short",
      );
    });

    it("writes missing units off without sending anything to Shopify", async () => {
      const id = await partlyReceived();
      const sent = shopify.requests.length;

      expect(await close(id, "WRITTEN_OFF")).toEqual({
        ok: true,
        alreadyDone: false,
        missingUnits: 7,
        resolution: "WRITTEN_OFF",
      });

      expect(shopify.requests).toHaveLength(sent);
      expect(levels()).toEqual({
        redSource: 6,
        whiteSource: 14,
        redDestination: 3,
        whiteDestination: 0,
      });
      expect(await load(id)).toMatchObject({
        status: "RECEIVED",
        shortResolution: "WRITTEN_OFF",
      });
      expect((await load(id)).lineItems.map((l) => l.returnedQty)).toEqual([
        0, 0,
      ]);
      const header = (await getTransfer(dbA, id))!;
      const view = await getTransferLines(dbA, {
        transfer: header,
        filter: "all",
        page: 1,
      });
      expect(view.totals).toMatchObject({
        receivedUnits: 3,
        returnedUnits: 0,
        writtenOffUnits: 7,
      });
      expect(view.lines.map((l) => [l.title, l.writtenOffQty])).toEqual([
        ["Red wine", 1],
        ["White wine", 6],
      ]);
    });

    it("finishes a transfer whose remaining units were all rejected, with nothing to decide", async () => {
      const id = await shippedTransfer([[RED, 4]]);
      const red = await lineOf(id, RED);
      await setTransferRejectedQuantity(dbA, {
        lineId: red.id,
        rejectedQty: 4,
        note: "Wrong vintage",
      });
      const sent = shopify.requests.length;

      expect(await close(id, undefined)).toEqual({
        ok: true,
        alreadyDone: false,
        missingUnits: 0,
        resolution: null,
      });

      expect(shopify.requests).toHaveLength(sent);
      expect(await load(id)).toMatchObject({
        status: "RECEIVED",
        shortResolution: null,
      });
      expect(levels()).toMatchObject({ redSource: 6, redDestination: 0 });
    });

    it("does not close a draft, a Shopify-managed transfer, or one with units counted in and not posted", async () => {
      const draft = await draftTransfer();
      expect(await close(draft, "RETURNED")).toMatchObject({
        ok: false,
        error: "Only a transfer that is in transit can be closed.",
      });

      const id = await partlyReceived();
      await scan(id, "WHT-750", 2);
      expect(await close(id, "RETURNED")).toMatchObject({
        ok: false,
        error: expect.stringContaining(
          "Units are counted in and not posted yet.",
        ),
      });

      const white = await lineOf(id, WHITE);
      await setTransferReceiveQuantity(dbA, { lineId: white.id, quantity: 0 });
      await prisma.transferOrder.update({
        where: { id },
        data: { shopifyTransferId: "gid://shopify/InventoryTransfer/1" },
      });
      expect(await close(id, "RETURNED")).toMatchObject({
        ok: false,
        error: expect.stringContaining("Receive it in Shopify admin"),
      });

      expect((await load(id)).status).toBe("IN_TRANSIT");
      expect(levels()).toMatchObject({ redSource: 6, whiteSource: 14 });
    });

    it("stays in transit when part of the return fails, takes no receipt meanwhile, and finishes on the next close", async () => {
      const id = await shippedTransfer();
      rejectNextChangeAt(1);

      const failed = await close(id, "RETURNED");

      expect(failed).toMatchObject({
        ok: false,
        error: expect.stringContaining("The transfer stays in transit."),
        problems: [{ shopifyVariantId: WHITE, title: "White wine" }],
      });
      expect((await load(id)).status).toBe("IN_TRANSIT");
      expect(levels()).toMatchObject({ redSource: 10, whiteSource: 14 });
      expect((await load(id)).lineItems.map((l) => l.returnedQty)).toEqual([
        0, 0,
      ]);

      // Part of the stock is back at the source, so none of it may also be
      // received at the destination.
      const sent = shopify.requests.length;
      expect(
        await receiveTransfer(dbA, null, RECEIVER, id, enabled()),
      ).toMatchObject({
        ok: false,
        error: expect.stringContaining(
          "Closing this transfer was started and part of its stock is already back at the source",
        ),
      });
      expect(shopify.requests).toHaveLength(sent);
      expect(
        (await load(id)).lineItems.map((l) => l.pendingReceiveQty),
      ).toEqual([0, 0]);

      expect(await close(id, "RETURNED")).toEqual({
        ok: true,
        alreadyDone: false,
        missingUnits: 10,
        resolution: "RETURNED",
      });
      expect(shopify.requests.at(-1)!.changes).toEqual([
        expect.objectContaining({ inventoryItemId: item(102), delta: 6 }),
      ]);
      expect(levels()).toEqual({
        redSource: 10,
        whiteSource: 20,
        redDestination: 0,
        whiteDestination: 0,
      });
      expect(await load(id)).toMatchObject({
        status: "RECEIVED",
        shortResolution: "RETURNED",
      });
    });

    it("returns nothing to the source while the kill switch is off", async () => {
      const id = await partlyReceived();
      const sent = shopify.requests.length;

      expect(await close(id, "RETURNED", switchedOff())).toEqual({
        ok: false,
        error: SWITCHED_OFF,
        problems: [],
        blocker: null,
      });

      expect(shopify.requests).toHaveLength(sent);
      expect(await operations("TransferShipment", id)).toHaveLength(1);
      expect((await load(id)).status).toBe("IN_TRANSIT");
    });
  });

  describe("what the pages read", () => {
    it("lists open and closed transfers newest first, with where their units stand", async () => {
      const draft = await draftTransfer([[ROSE, 2]]);
      const inTransit = await shippedTransfer();
      await scan(inTransit, "RED-750", 3);
      await postTransferReceipt(dbA, null, RECEIVER, inTransit, enabled());
      await scan(inTransit, "WHT-750", 2);
      const cancelled = await draftTransfer([[RED, 1]]);
      await cancelTransfer(dbA, null, STAFF, cancelled, enabled());

      const open = await listTransfers(dbA, { view: "open", page: 1 });
      expect(open.hasMore).toBe(false);
      expect(open.transfers.map((t) => [t.id, t.status])).toEqual([
        [inTransit, "IN_TRANSIT"],
        [draft, "DRAFT"],
      ]);
      expect(open.transfers[0].totals).toEqual({
        lineCount: 2,
        requestedUnits: 10,
        shipUnits: 10,
        receivedUnits: 3,
        countedInUnits: 2,
        rejectedUnits: 0,
        returnedUnits: 0,
        writtenOffUnits: 0,
        outstandingUnits: 5,
      });
      expect(
        transferStatusBadge("IN_TRANSIT", open.transfers[0].totals).label,
      ).toBe("Partly received");
      expect(open.transfers[1].totals).toMatchObject({
        lineCount: 1,
        shipUnits: 2,
        outstandingUnits: 0,
      });

      const closed = await listTransfers(dbA, { view: "closed", page: 1 });
      expect(closed.transfers.map((t) => [t.id, t.status])).toEqual([
        [cancelled, "CANCELLED"],
      ]);
      // A cancelled transfer never left the source.
      expect(closed.transfers[0].totals).toMatchObject({
        requestedUnits: 1,
        shipUnits: 0,
      });
    });

    it("pages the list", async () => {
      for (let n = 0; n < 21; n += 1) await draftTransfer([]);

      const first = await listTransfers(dbA, { view: "open", page: 1 });
      const second = await listTransfers(dbA, { view: "open", page: 2 });

      expect(first.transfers).toHaveLength(20);
      expect(first.hasMore).toBe(true);
      expect(second.transfers).toHaveLength(1);
      expect(second.hasMore).toBe(false);
      expect(
        new Set([...first.transfers, ...second.transfers].map((t) => t.id))
          .size,
      ).toBe(21);
    });

    it("describes the lines of a transfer and narrows them to the ones still open", async () => {
      const id = await shippedTransfer();
      await scan(id, "RED-750", 4);
      await postTransferReceipt(dbA, null, RECEIVER, id, enabled());
      const white = await lineOf(id, WHITE);
      await setTransferRejectedQuantity(dbA, {
        lineId: white.id,
        rejectedQty: 1,
        note: "Leaking",
      });
      const header = (await getTransfer(dbA, id))!;

      const all = await getTransferLines(dbA, {
        transfer: header,
        filter: "all",
        page: 1,
      });
      expect(all).toMatchObject({ total: 2, page: 1, pageCount: 1 });
      expect(all.lines).toEqual([
        expect.objectContaining({
          shopifyVariantId: RED,
          title: "Red wine",
          sku: "RED-750",
          barcode: "5010001",
          shipQty: 4,
          receivedQty: 4,
          outstandingQty: 0,
        }),
        expect.objectContaining({
          shopifyVariantId: WHITE,
          title: "White wine",
          shipQty: 6,
          receivedQty: 0,
          rejectedQty: 1,
          rejectNote: "Leaking",
          outstandingQty: 5,
          writtenOffQty: 0,
        }),
      ]);

      const open = await getTransferLines(dbA, {
        transfer: header,
        filter: "open",
        page: 7,
      });
      expect(open).toMatchObject({ total: 1, page: 1, pageCount: 1 });
      expect(open.lines.map((l) => l.shopifyVariantId)).toEqual([WHITE]);
      expect(open.totals.lineCount).toBe(2);

      expect(
        (await listTransferLinesForExport(dbA, header)).map((l) => l.title),
      ).toEqual(["Red wine", "White wine"]);
    });

    it("reads a transfer's history from the ledger: what left, arrived and went back, and who did it", async () => {
      const id = await shippedTransfer();
      await scan(id, "RED-750", 3);
      await postTransferReceipt(dbA, null, RECEIVER, id, enabled());
      await closeTransfer(
        dbA,
        null,
        RECEIVER,
        id,
        { resolution: "RETURNED" },
        enabled(),
      );

      const history = await getTransferHistory(dbA, id);

      expect(
        history.map((event) => [
          event.leg,
          event.netUnits,
          event.staffUserId,
          event.staffName,
          event.status,
          event.unfinished,
          event.refusedChangeCount,
        ]),
      ).toEqual([
        ["shipment", -10, "42", "Dana Picker", "APPLIED", false, 0],
        ["receipt", 3, "77", "Sam Receiver", "APPLIED", false, 0],
        ["shipment", 7, "77", "Sam Receiver", "APPLIED", false, 0],
      ]);
    });

    it("shows a refused change in the history", async () => {
      const id = await draftTransfer();
      rejectNextChangeAt(1);
      await shipTransfer(dbA, null, STAFF, id, enabled());

      const [event, ...rest] = await getTransferHistory(dbA, id);

      expect(rest).toEqual([]);
      expect(event).toMatchObject({
        leg: "shipment",
        netUnits: -4,
        status: "PARTIALLY_APPLIED",
        refusedChangeCount: 1,
      });
    });
  });

  it("gives another shop no way to read, count in, receive or close a transfer", async () => {
    const id = await shippedTransfer();
    const red = await lineOf(id, RED);
    const sent = shopify.requests.length;
    const notFound = {
      ok: false,
      error: "Transfer not found",
      problems: [],
      blocker: null,
    };

    expect(await getTransfer(dbB, id)).toBeNull();
    expect(await getTransferHistory(dbB, id)).toEqual([]);
    expect(
      (await listTransfers(dbB, { view: "open", page: 1 })).transfers,
    ).toEqual([]);
    expect(
      await getTransferLines(dbB, {
        transfer: { id, status: "IN_TRANSIT" },
        filter: "all",
        page: 1,
      }),
    ).toMatchObject({ lines: [], total: 0 });

    expect(
      await recordTransferReceiptScan(dbB, { transferId: id, code: "RED-750" }),
    ).toEqual({ ok: false, error: "Transfer not found" });
    expect(
      await setTransferReceiveQuantity(dbB, { lineId: red.id, quantity: 1 }),
    ).toEqual({ ok: false, error: "Transfer line not found" });
    expect(
      await setTransferRejectedQuantity(dbB, {
        lineId: red.id,
        rejectedQty: 1,
        note: null,
      }),
    ).toEqual({ ok: false, error: "Transfer line not found" });
    expect(await countInOutstandingUnits(dbB, { transferId: id })).toEqual({
      ok: false,
      error: "Transfer not found",
    });
    expect(
      await postTransferReceipt(dbB, null, RECEIVER, id, enabled()),
    ).toEqual(notFound);
    expect(await receiveTransfer(dbB, null, RECEIVER, id, enabled())).toEqual(
      notFound,
    );
    expect(
      await closeTransfer(
        dbB,
        null,
        RECEIVER,
        id,
        { resolution: "RETURNED" },
        enabled(),
      ),
    ).toEqual(notFound);
    expect(
      await addTransferItems(dbB, { transferId: id, itemsText: "RED-750" }),
    ).toEqual({ ok: false, error: "Transfer not found", details: [] });

    expect(shopify.requests).toHaveLength(sent);
    expect(await load(id)).toMatchObject({ status: "IN_TRANSIT" });
    expect(
      (await load(id)).lineItems.map((l) => [
        l.pendingReceiveQty,
        l.rejectedQty,
        l.returnedQty,
      ]),
    ).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ]);
    // The other shop's own location is no part of this shop's transfers either.
    expect(
      await createTransfer(dbA, {
        shop: SHOP_A,
        sourceLocationId: OTHER_SHOPS_LOCATION,
        destinationLocationId: DESTINATION,
        notes: null,
      }),
    ).toMatchObject({ ok: false });
  });
});
