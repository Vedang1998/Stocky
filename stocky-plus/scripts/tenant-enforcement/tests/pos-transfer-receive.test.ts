/**
 * Receiving a transfer at a POS location against PostgreSQL: the POS
 * endpoints' logic on the real transfer service and ledger, with the in-memory
 * Shopify double. Covers which transfers a location sees, counting units in,
 * posting, who may receive, the transfer switch, the plan gate and shop
 * isolation.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { PosApiError } from "../../../app/lib/pos/pos-api.server";
import { POS_NO_PLAN_MESSAGE } from "../../../app/lib/pos/pos-plan.server";
import {
  getTransferReceiveSheet,
  listReceivableTransfers,
  receiveTransferAtPos,
  type TransferReceivingDeps,
} from "../../../app/lib/pos/transfer-receiving-api.server";
import type { ExecuteInventoryOperationOptions } from "../../../app/services/inventory-writes/execute.server";
import type { InventoryActor } from "../../../app/services/inventory-writes/types";
import {
  addTransferLine,
  createTransfer,
  shipTransfer,
} from "../../../app/services/transfers/transfer.server";
import type { PosTenantContext } from "../../../app/tenant/require-pos-tenant.server";
import { resolveAuthorityAfterVerifiedAuth } from "../../../app/tenant/bootstrap.server";
import { createTenantDb, type TenantDb } from "../../../app/tenant/tenant-db.server";
import { FakeShopify, item, location } from "./fake-shopify-inventory";
import { resetSchemaAndApplyEnforcement } from "./helpers";
import { completeInventoryItemData, completeLocationData } from "./pr5-f3-test-helpers";

const SHOP_A = "pos-transfer-receive-a.myshopify.com";
const SHOP_B = "pos-transfer-receive-b.myshopify.com";

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
const ELSEWHERE = location(13);

const STAFF: InventoryActor = { shopifyUserId: "42", displayName: "Dana Picker", channel: "ADMIN" };

async function apiError(promise: Promise<unknown>): Promise<PosApiError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(PosApiError);
  return error as PosApiError;
}

describe("receiving a transfer at POS", () => {
  let prisma: PrismaClient;
  let dbA: TenantDb;
  let dbB: TenantDb;
  let shopify: FakeShopify;

  const enabled = (): ExecuteInventoryOperationOptions => ({
    sendBatch: shopify.send,
    isCapabilityEnabled: () => true,
  });
  const switchedOff = (): ExecuteInventoryOperationOptions => ({
    sendBatch: shopify.send,
    isCapabilityEnabled: () => false,
  });
  const deps = (stock: ExecuteInventoryOperationOptions = enabled()): TransferReceivingDeps => ({
    adminFor: async () => ({
      graphql: async () => {
        throw new Error("Shopify is reached through the test double only");
      },
    }),
    stock,
  });
  const contextFor = (db: TenantDb, shopifyUserId: string | null = "77"): PosTenantContext =>
    ({
      db,
      shop: { id: "unused", myshopifyDomain: db === dbB ? SHOP_B : SHOP_A },
      actor: { shopifyUserId, displayName: null, channel: "POS" },
    }) as unknown as PosTenantContext;
  const setPlan = (active: boolean) =>
    prisma.shopSettings.updateMany({
      where: { shop: SHOP_A },
      data: { subscriptionActive: active },
    });

  const receive = (
    transferId: string,
    body: unknown,
    options: { db?: TenantDb; staff?: string | null; at?: string; stock?: ExecuteInventoryOperationOptions } = {},
  ) =>
    receiveTransferAtPos(
      contextFor(options.db ?? dbA, options.staff === undefined ? "77" : options.staff),
      transferId,
      options.at ?? DESTINATION,
      body,
      deps(options.stock),
    );
  const scan = (transferId: string, code: string, quantity?: number) =>
    receive(transferId, { intent: "scan", code, quantity });

  const stockAt = (itemNumber: number, locationNumber: number) =>
    shopify.level(itemNumber, locationNumber);
  const load = (id: string) =>
    prisma.transferOrder.findUniqueOrThrow({
      where: { id },
      include: { lineItems: { orderBy: { id: "asc" } } },
    });
  const lineOf = async (id: string, shopifyVariantId: string) =>
    (await load(id)).lineItems.find((line) => line.shopifyVariantId === shopifyVariantId)!;

  async function draft(
    lines: Array<[variantId: string, quantity: number]> = [
      [RED, 4],
      [WHITE, 6],
    ],
    destination = DESTINATION,
  ) {
    const created = await createTransfer(dbA, {
      shop: SHOP_A,
      sourceLocationId: SOURCE,
      destinationLocationId: destination,
      notes: null,
      actor: STAFF,
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
  /** A transfer in transit to the POS location: 4 red and 6 white have left the source. */
  async function shipped(
    lines?: Array<[variantId: string, quantity: number]>,
    destination = DESTINATION,
  ) {
    const id = await draft(lines, destination);
    const result = await shipTransfer(dbA, null, STAFF, id, enabled());
    if (!result.ok) throw new Error(result.error);
    return id;
  }

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
        completeLocationData({ id: "13", shopId: shopA.id }),
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
          correlationId: "pos-transfer-receive-test",
          createIfMissing: false,
        })
      ).tenant;
    for (const shop of [shopA, shopB]) {
      await prisma.shopSettings.upsert({
        where: { shop: shop.myshopifyDomain },
        create: { shop: shop.myshopifyDomain, shopId: shop.id, subscriptionActive: true, subscriptionPlan: "test" },
        update: { subscriptionActive: true },
      });
    }
    dbA = createTenantDb(await authority(SHOP_A));
    dbB = createTenantDb(await authority(SHOP_B));
  }, 180_000);

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "InventoryOperationLine", "InventoryOperation",
         "TransferLineItem", "TransferOrder" CASCADE`,
    );
    await setPlan(true);
    shopify = new FakeShopify();
    shopify.setLevel(101, 10, 11);
    shopify.setLevel(102, 20, 11);
    shopify.setLevel(101, 0, 13);
    shopify.setLevel(102, 0, 13);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  describe("what the location sees", () => {
    it("lists only transfers in transit to this location, with their units", async () => {
      const here = await shipped();
      await draft();
      await shipped([[RED, 2]], ELSEWHERE);

      const list = await listReceivableTransfers(dbA, DESTINATION, { stock: enabled() });

      expect(list.receivingEnabled).toBe(true);
      expect(list.transfers).toEqual([
        expect.objectContaining({ id: here, shippedUnits: 10, outstandingUnits: 10, countedInUnits: 0 }),
      ]);
    });

    it("shows a transfer's open lines and never another shop's transfer", async () => {
      const id = await shipped();

      const sheet = await getTransferReceiveSheet(dbA, id, DESTINATION, { stock: enabled() });
      expect(sheet.transfer).toMatchObject({ shippedUnits: 10, receivedUnits: 0, outstandingUnits: 10 });
      expect(sheet.lines.map((line) => [line.name, line.shippedQty, line.outstandingQty])).toEqual(
        expect.arrayContaining([
          ["Red wine", 4, 4],
          ["White wine", 6, 6],
        ]),
      );

      expect((await apiError(getTransferReceiveSheet(dbB, id, DESTINATION))).status).toBe(404);
      expect((await listReceivableTransfers(dbB, DESTINATION)).transfers).toEqual([]);
    });

    it("refuses a transfer bound for another location and one that is not in transit", async () => {
      const elsewhere = await shipped([[RED, 2]], ELSEWHERE);
      const notShipped = await draft();

      expect((await apiError(getTransferReceiveSheet(dbA, elsewhere, DESTINATION))).status).toBe(409);
      expect((await apiError(getTransferReceiveSheet(dbA, notShipped, DESTINATION))).status).toBe(409);
      expect((await apiError(receive(elsewhere, { intent: "post" }))).status).toBe(409);
      expect(await prisma.inventoryOperation.count({ where: { sourceType: "TRANSFER_RECEIPT" } })).toBe(0);
    });
  });

  describe("counting units in", () => {
    it("counts a scan in without touching Shopify and returns the updated sheet", async () => {
      const id = await shipped();

      const result = await scan(id, "5010001", 3);

      expect(result).toMatchObject({
        ok: true,
        scanned: { title: "Red wine", countedIn: 3, outstanding: 1 },
      });
      if (result.ok) {
        expect(result.sheet?.lines.find((line) => line.name === "Red wine")).toMatchObject({
          countedInQty: 3,
          outstandingQty: 1,
        });
      }
      expect((await lineOf(id, RED)).pendingReceiveQty).toBe(3);
      expect(stockAt(101, 12)).toBe(0);
    });

    it("explains a scan the transfer refuses and changes nothing", async () => {
      const id = await shipped();

      for (const [code, quantity] of [
        ["nope-0000", 1],
        ["5010001", 5],
      ] as const) {
        const refused = await scan(id, code, quantity);
        expect(refused.ok).toBe(false);
        if (!refused.ok) expect(refused.message.length).toBeGreaterThan(0);
      }
      expect((await lineOf(id, RED)).pendingReceiveQty).toBe(0);
    });

    it("sets a line's count and refuses more than is still to be received", async () => {
      const id = await shipped();
      const red = await lineOf(id, RED);

      expect(await receive(id, { intent: "set", lineId: red.id, quantity: 2 })).toMatchObject({ ok: true });
      expect((await lineOf(id, RED)).pendingReceiveQty).toBe(2);

      const tooMany = await receive(id, { intent: "set", lineId: red.id, quantity: 5 });
      expect(tooMany.ok).toBe(false);
      expect((await lineOf(id, RED)).pendingReceiveQty).toBe(2);
    });

    it("cannot set a line of another transfer", async () => {
      const id = await shipped();
      const other = await shipped([[WHITE, 1]]);
      const foreign = await lineOf(other, WHITE);

      const refused = await receive(id, { intent: "set", lineId: foreign.id, quantity: 1 });

      expect(refused.ok).toBe(false);
      expect((await lineOf(other, WHITE)).pendingReceiveQty).toBe(0);
    });
  });

  describe("posting the receipt", () => {
    it("adds the counted-in units at the destination and finishes the transfer when all arrived", async () => {
      const id = await shipped();
      await scan(id, "5010001", 4);
      await scan(id, "5010002", 2);

      const partial = await receive(id, { intent: "post" });
      expect(partial).toMatchObject({ ok: true, posted: { receivedUnits: 6, completed: false, alreadyDone: false } });
      expect(stockAt(101, 12)).toBe(4);
      expect(stockAt(102, 12)).toBe(2);
      expect((await load(id)).status).toBe("IN_TRANSIT");

      await scan(id, "5010002", 4);
      const rest = await receive(id, { intent: "post" });
      expect(rest).toMatchObject({ ok: true, posted: { receivedUnits: 4, completed: true } });
      expect(stockAt(102, 12)).toBe(6);
      const done = await load(id);
      expect(done.status).toBe("RECEIVED");
      expect(done.receivedByUserId).toBe("77");

      const again = await receive(id, { intent: "post" }).catch((error: unknown) => error);
      expect(again).toBeInstanceOf(PosApiError);
      expect(stockAt(102, 12)).toBe(6);
    });

    it("says so when nothing is counted in, and sends nothing", async () => {
      const id = await shipped();

      const result = await receive(id, { intent: "post" });

      expect(result.ok).toBe(false);
      expect(stockAt(101, 12)).toBe(0);
    });

    it("keeps the counts and sends nothing while the transfer switch is off", async () => {
      const id = await shipped();
      await scan(id, "5010001", 2);

      for (const body of [{ intent: "post" }, { intent: "scan", code: "5010001" }]) {
        const result = await receive(id, body, { stock: switchedOff() });
        expect(result.ok).toBe(false);
      }
      expect(stockAt(101, 12)).toBe(0);
      expect((await lineOf(id, RED)).pendingReceiveQty).toBe(2);
      const sheet = await getTransferReceiveSheet(dbA, id, DESTINATION, { stock: switchedOff() });
      expect(sheet.receivingEnabled).toBe(false);
    });
  });

  describe("who may receive", () => {
    it("needs a signed-in staff member and changes nothing without one", async () => {
      const id = await shipped();

      const error = await apiError(receive(id, { intent: "scan", code: "5010001" }, { staff: null }));

      expect(error.status).toBe(403);
      expect((await lineOf(id, RED)).pendingReceiveQty).toBe(0);
    });

    it("needs an active plan for the list, the sheet and every write", async () => {
      const id = await shipped();
      await setPlan(false);

      for (const call of [
        () => listReceivableTransfers(dbA, DESTINATION),
        () => getTransferReceiveSheet(dbA, id, DESTINATION),
        () => receive(id, { intent: "scan", code: "5010001" }),
        () => receive(id, { intent: "post" }),
      ]) {
        const error = await apiError(call());
        expect(error).toMatchObject({ status: 403, message: POS_NO_PLAN_MESSAGE });
      }
      expect((await lineOf(id, RED)).pendingReceiveQty).toBe(0);
    });

    it("refuses another shop's transfer without changing it", async () => {
      const id = await shipped();

      const error = await apiError(receive(id, { intent: "scan", code: "5010001" }, { db: dbB }));

      expect(error.status).toBe(404);
      expect((await lineOf(id, RED)).pendingReceiveQty).toBe(0);
    });

    it("refuses malformed requests before touching the transfer", async () => {
      const id = await shipped();

      for (const body of [
        null,
        { intent: "scan", code: "" },
        { intent: "scan", code: "a\u0000b" },
        { intent: "set", lineId: "x", quantity: -1 },
        { intent: "bogus" },
      ]) {
        expect((await apiError(receive(id, body))).status).toBe(400);
      }
    });
  });
});
