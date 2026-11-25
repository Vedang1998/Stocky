/**
 * Receiving at a POS location against PostgreSQL: the POS endpoints' logic on
 * the real purchasing service, with the in-memory Shopify double. Covers who
 * may receive, which location, retries, the receiving switch and shop
 * isolation.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";
import { PosApiError } from "../../../lib/pos/pos-api.server";
import { POS_NO_PLAN_MESSAGE } from "../../../lib/pos/pos-plan.server";
import {
  getReceivingSheet,
  listReceivableOrders,
  receiveAtPos,
  type ReceivingDeps,
} from "../../../lib/pos/receiving-api.server";
import { RECEIVING_OFF_MESSAGE } from "../../../lib/po-display";
import type { ExecuteInventoryOperationOptions } from "../../../services/inventory-writes/execute.server";
import type { PurchasingActor } from "../../../services/purchasing/actor.server";
import { loadPurchaseOrder } from "../../../services/purchasing/purchase-order-records.server";
import {
  createPurchaseOrderDraft,
  transitionPurchaseOrder,
} from "../../../services/purchasing/purchase-orders.server";
import { createSupplier } from "../../../services/purchasing/suppliers.server";
import { FakeShopify } from "../../../../scripts/tenant-enforcement/tests/fake-shopify-inventory";
import {
  completeInventoryItemData,
  completeLocationData,
  completeProductData,
  completeVariantData,
} from "../../../../scripts/tenant-enforcement/tests/pr5-f3-test-helpers";
import type { PosTenantContext } from "../../require-pos-tenant.server";
import { issueTenantAuthority } from "../../authority.server";
import { createTenantDb, type TenantDb } from "../../tenant-db.server";
import {
  requireRuntimeUrl,
  resetAndEnforce,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
} from "./helpers";

const BUYER: PurchasingActor = { type: "STAFF", id: "42" };
const TODAY = "2026-11-10";

const BLUE = "gid://shopify/ProductVariant/201";
const RED = "gid://shopify/ProductVariant/202";
const BLUE_ITEM = 301;
const RED_ITEM = 302;
const WAREHOUSE = "gid://shopify/Location/401";
const WAREHOUSE_NUMBER = 401;
const OTHER_LOCATION = "gid://shopify/Location/402";
const SHOP_B_LOCATION = "gid://shopify/Location/411";

const supplierProfile = (name: string) => ({
  name,
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
  defaultLeadTimeDays: null,
  defaultRestockDays: null,
  minimumOrderValue: null,
  vendorNotes: null,
});


async function apiError(promise: Promise<unknown>): Promise<PosApiError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(PosApiError);
  return error as PosApiError;
}

describe("receiving at POS", () => {
  let prisma: PrismaClient;
  let dbA: TenantDb;
  let dbB: TenantDb;
  let shopify: FakeShopify;
  let submissions = 0;

  const deps = (
    stock: ExecuteInventoryOperationOptions,
    receivingEnabled = true,
  ): ReceivingDeps => ({
    adminFor: async () => ({
      graphql: async () => {
        throw new Error("Shopify is reached through the test double only");
      },
    }),
    stock,
    receivingEnabled: () => receivingEnabled,
  });
  const enabled = (): ExecuteInventoryOperationOptions => ({
    sendBatch: shopify.send,
    isCapabilityEnabled: () => true,
  });
  const switchedOff = (): ExecuteInventoryOperationOptions => ({
    sendBatch: shopify.send,
    isCapabilityEnabled: () => false,
  });
  const setPlan = async (active: boolean, shopAId?: string, shopBId?: string) => {
    const shops = [
      [SHOP_A_DOMAIN, shopAId],
      [SHOP_B_DOMAIN, shopBId],
    ] as const;
    for (const [shop, shopId] of shops) {
      if (shop === SHOP_B_DOMAIN && shopBId === undefined) continue;
      if (shop === SHOP_A_DOMAIN && shopAId === undefined) {
        await prisma.shopSettings.updateMany({
          where: { shop },
          data: { subscriptionActive: active },
        });
        continue;
      }
      await prisma.shopSettings.upsert({
        where: { shop },
        create: { shop, shopId, subscriptionActive: active, subscriptionPlan: "test" },
        update: { subscriptionActive: active },
      });
    }
  };
  const nextKey = () => `pos-receiving-test-${++submissions}`;
  const stock = (itemNumber: number) => shopify.level(itemNumber, WAREHOUSE_NUMBER);

  const contextFor = (
    db: TenantDb,
    shopifyUserId: string | null = "77",
  ): PosTenantContext =>
    ({
      db,
      shop: { id: "unused", myshopifyDomain: SHOP_A_DOMAIN },
      actor: { shopifyUserId, displayName: null, channel: "POS" },
    }) as unknown as PosTenantContext;

  beforeAll(async () => {
    const ctx = await resetAndEnforce();
    prisma = ctx.migrationPrisma;
    await ctx.runtimePrisma.$disconnect();
    const { shopA, shopB } = await seedTwoShops(prisma);
    await setPlan(true, shopA.id, shopB.id);

    await prisma.shopifyProductFact.createMany({
      data: [
        completeProductData({ id: "101", shopId: shopA.id, title: "Widget" }),
        completeProductData({ id: "109", shopId: shopB.id, title: "Shop B widget" }),
      ],
    });
    await prisma.shopifyVariantFact.createMany({
      data: [
        { ...completeVariantData({ id: "201", shopId: shopA.id, productId: "101" }), title: "Blue" },
        { ...completeVariantData({ id: "202", shopId: shopA.id, productId: "101" }), title: "Red" },
        { ...completeVariantData({ id: "203", shopId: shopA.id, productId: "101" }), title: "Green" },
        completeVariantData({ id: "901", shopId: shopB.id, productId: "109" }),
      ],
    });
    await prisma.shopifyInventoryItemFact.createMany({
      data: [
        completeInventoryItemData({ id: "301", shopId: shopA.id, variantId: "201" }),
        completeInventoryItemData({ id: "302", shopId: shopA.id, variantId: "202" }),
        completeInventoryItemData({ id: "391", shopId: shopB.id, variantId: "901" }),
      ],
    });
    await prisma.shopifyLocationFact.createMany({
      data: [
        { ...completeLocationData({ id: "401", shopId: shopA.id }), name: "Warehouse" },
        { ...completeLocationData({ id: "402", shopId: shopA.id, requestGen: 12n }), name: "Storefront" },
        { ...completeLocationData({ id: "411", shopId: shopB.id, requestGen: 13n }), name: "Shop B" },
      ],
    });

    requireRuntimeUrl();
    dbA = createTenantDb(
      issueTenantAuthority({
        shopId: shopA.id,
        myshopifyDomain: SHOP_A_DOMAIN,
        source: "verified_admin_request",
      }),
    );
    dbB = createTenantDb(
      issueTenantAuthority({
        shopId: shopB.id,
        myshopifyDomain: SHOP_B_DOMAIN,
        source: "verified_admin_request",
      }),
    );
  }, 180_000);

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "InventoryOperationLine", "InventoryOperation",
         "PurchaseOrderReceiptLine", "PurchaseOrderReceipt", "LeadTimeSnapshot",
         "PurchasingEvent", "PurchaseOrderCharge", "POLineItem", "PurchaseOrder",
         "Supplier" CASCADE`,
    );
    await prisma.shopifyLocationFact.updateMany({
      where: { shopifyGid: WAREHOUSE },
      data: { isActive: true },
    });
    shopify = new FakeShopify();
    shopify.setLevel(BLUE_ITEM, 4, WAREHOUSE_NUMBER);
    shopify.setLevel(RED_ITEM, 0, WAREHOUSE_NUMBER);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  /** An ordered purchase order for 10 Blue and 6 Red, with its line ids. */
  async function orderedPo(
    locationGid = WAREHOUSE,
    lines: Array<{ variantGid: string; quantity: number }> = [
      { variantGid: BLUE, quantity: 10 },
      { variantGid: RED, quantity: 6 },
    ],
    supplierName = "Acme Supply",
  ) {
    const supplier = await createSupplier(dbA, BUYER, supplierProfile(supplierName));
    const created = await createPurchaseOrderDraft(
      dbA,
      BUYER,
      {
        supplierId: supplier.id,
        locationGid,
        lines: lines.map((line) => ({ ...line, unitCost: new Prisma.Decimal("2.50") })),
      },
      { today: TODAY },
    );
    await transitionPurchaseOrder(dbA, BUYER, created.id, 1, "markOrdered", { today: TODAY });
    const po = await loadPurchaseOrder(dbA, created.id);
    const lineId = (variantGid: string) =>
      po.lineItems.find((line) => line.shopifyVariantId === variantGid)!.id;
    return { id: po.id, lineId };
  }

  const body = (lines: Array<{ lineItemId: string; acceptedQty?: number; rejectedQty?: number }>, key = nextKey()) => ({
    idempotencyKey: key,
    lines,
  });

  describe("receiving a delivery", () => {
    it("adds the units to Shopify as the POS staff member and returns the updated sheet", async () => {
      const po = await orderedPo();

      const result = await receiveAtPos(
        contextFor(dbA),
        po.id,
        WAREHOUSE,
        body([{ lineItemId: po.lineId(BLUE), acceptedQty: 4 }]),
        deps(enabled()),
      );

      expect(result).toMatchObject({ complete: true, receiptNumber: 1, outcome: "posted" });
      expect(stock(BLUE_ITEM)).toBe(8);
      const [receipt] = await prisma.purchaseOrderReceipt.findMany();
      expect(receipt).toMatchObject({ actorChannel: "POS", actorUserId: "77", locationGid: WAREHOUSE });
      expect(result.sheet?.lines.find((line) => line.variantGid === BLUE)).toMatchObject({
        orderedQty: 10,
        receivedQty: 4,
        openQty: 6,
      });
    });

    it("records a retry with the same key once", async () => {
      const po = await orderedPo();
      const key = nextKey();
      const send = () =>
        receiveAtPos(
          contextFor(dbA),
          po.id,
          WAREHOUSE,
          body([{ lineItemId: po.lineId(BLUE), acceptedQty: 3 }], key),
          deps(enabled()),
        );

      const first = await send();
      const second = await send();

      expect(second.receiptNumber).toBe(first.receiptNumber);
      expect(await prisma.purchaseOrderReceipt.count()).toBe(1);
      expect(stock(BLUE_ITEM)).toBe(7);
    });

    it("refuses a POS user with no staff identity before recording anything", async () => {
      const po = await orderedPo();

      const error = await apiError(
        receiveAtPos(
          contextFor(dbA, null),
          po.id,
          WAREHOUSE,
          body([{ lineItemId: po.lineId(BLUE), acceptedQty: 1 }]),
          deps(enabled()),
        ),
      );

      expect(error.status).toBe(403);
      expect(await prisma.purchaseOrderReceipt.count()).toBe(0);
      expect(stock(BLUE_ITEM)).toBe(4);
    });

    it("refuses an order that is delivered to another location", async () => {
      const po = await orderedPo(OTHER_LOCATION);

      const error = await apiError(
        receiveAtPos(
          contextFor(dbA),
          po.id,
          WAREHOUSE,
          body([{ lineItemId: po.lineId(BLUE), acceptedQty: 1 }]),
          deps(enabled()),
        ),
      );

      expect(error.status).toBe(409);
      expect(error.message).toContain("different location");
      expect(await prisma.purchaseOrderReceipt.count()).toBe(0);
    });

    it("reports receiving switched off and records nothing", async () => {
      const po = await orderedPo();

      const result = await receiveAtPos(
        contextFor(dbA),
        po.id,
        WAREHOUSE,
        body([{ lineItemId: po.lineId(BLUE), acceptedQty: 2 }]),
        deps(switchedOff(), false),
      );

      expect(result).toMatchObject({
        complete: false,
        message: RECEIVING_OFF_MESSAGE,
        receiptNumber: null,
        outcome: "not_recorded",
      });
      expect(result.sheet?.receivingEnabled).toBe(false);
      expect(await prisma.purchaseOrderReceipt.count()).toBe(0);
      expect(stock(BLUE_ITEM)).toBe(4);
    });

    it("keeps an unconfirmed receipt pending, and repeating the same request finishes it once", async () => {
      const po = await orderedPo();
      const request = body([{ lineItemId: po.lineId(BLUE), acceptedQty: 4 }]);
      shopify.loseNextResponse();

      const first = await receiveAtPos(contextFor(dbA), po.id, WAREHOUSE, request, deps(enabled()));
      const again = await receiveAtPos(contextFor(dbA), po.id, WAREHOUSE, request, deps(enabled()));

      expect(first).toMatchObject({ complete: false, outcome: "pending", receiptNumber: 1 });
      expect(again).toMatchObject({ complete: true, outcome: "posted", receiptNumber: 1 });
      expect(await prisma.purchaseOrderReceipt.count()).toBe(1);
      expect(stock(BLUE_ITEM)).toBe(8);
    });

    it("answers a reused key with other quantities as different_counts and records nothing more", async () => {
      const po = await orderedPo();
      const key = nextKey();
      await receiveAtPos(
        contextFor(dbA),
        po.id,
        WAREHOUSE,
        body([{ lineItemId: po.lineId(BLUE), acceptedQty: 4 }], key),
        deps(enabled()),
      );

      const error = await apiError(
        receiveAtPos(
          contextFor(dbA),
          po.id,
          WAREHOUSE,
          body([{ lineItemId: po.lineId(BLUE), acceptedQty: 5 }], key),
          deps(enabled()),
        ),
      );

      expect(error).toMatchObject({ status: 409, code: "different_counts" });
      expect(await prisma.purchaseOrderReceipt.count()).toBe(1);
      expect(stock(BLUE_ITEM)).toBe(8);
    });

    it("answers an order that is closed as a plain conflict, not as different counts", async () => {
      const po = await orderedPo();
      await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: "CANCELLED" } });

      const error = await apiError(
        receiveAtPos(
          contextFor(dbA),
          po.id,
          WAREHOUSE,
          body([{ lineItemId: po.lineId(BLUE), acceptedQty: 1 }]),
          deps(enabled()),
        ),
      );

      expect(error).toMatchObject({ status: 409, code: "conflict" });
      expect(await prisma.purchaseOrderReceipt.count()).toBe(0);
    });

    it("still reports a recorded receipt when the order cannot be read back afterwards", async () => {
      const po = await orderedPo();
      // Only the read-back after the receipt consults this switch.
      const flaky: ReceivingDeps = {
        ...deps(enabled()),
        receivingEnabled: () => {
          throw new Error("read-back failed");
        },
      };

      const result = await receiveAtPos(
        contextFor(dbA),
        po.id,
        WAREHOUSE,
        body([{ lineItemId: po.lineId(BLUE), acceptedQty: 4 }]),
        flaky,
      );

      expect(result).toMatchObject({ complete: true, outcome: "posted", receiptNumber: 1, sheet: null });
      expect(stock(BLUE_ITEM)).toBe(8);
    });

    it("refuses more units than the line expects unless the over-receipt is confirmed", async () => {
      const po = await orderedPo();
      const lineItemId = po.lineId(RED);

      const error = await apiError(
        receiveAtPos(
          contextFor(dbA),
          po.id,
          WAREHOUSE,
          body([{ lineItemId, acceptedQty: 7 }]),
          deps(enabled()),
        ),
      );

      expect(error.status).toBe(400);
      expect(Object.keys(error.fieldErrors ?? {})).toEqual([`line:${lineItemId}`]);
      expect(await prisma.purchaseOrderReceipt.count()).toBe(0);
    });

    it("answers 404 for an order that belongs to another shop", async () => {
      const po = await orderedPo();

      const error = await apiError(
        receiveAtPos(
          contextFor(dbB),
          po.id,
          SHOP_B_LOCATION,
          body([{ lineItemId: po.lineId(BLUE), acceptedQty: 1 }]),
          deps(enabled()),
        ),
      );

      expect(error.status).toBe(404);
      expect(await prisma.purchaseOrderReceipt.count()).toBe(0);
    });
  });

  describe("finding orders to receive", () => {
    it("lists only incoming orders for the POS location", async () => {
      const here = await orderedPo();
      await orderedPo(OTHER_LOCATION, undefined, "Elsewhere Ltd");
      const supplier = await createSupplier(dbA, BUYER, supplierProfile("Draft Co"));
      await createPurchaseOrderDraft(
        dbA,
        BUYER,
        {
          supplierId: supplier.id,
          locationGid: WAREHOUSE,
          lines: [{ variantGid: BLUE, quantity: 1, unitCost: new Prisma.Decimal("1.00") }],
        },
        { today: TODAY },
      );

      const list = await listReceivableOrders(dbA, WAREHOUSE, null, {
        receivingEnabled: () => true,
      });

      expect(list.orders.map((order) => order.id)).toEqual([here.id]);
      expect(list.orders[0]).toMatchObject({
        supplierName: "Acme Supply",
        status: "ORDERED",
        orderedUnits: 16,
        receivedUnits: 0,
        remainingUnits: 16,
      });
      expect(list.hasMore).toBe(false);
    });

    it("shows the lines of an order and why a closed one cannot be received", async () => {
      const po = await orderedPo();

      const sheet = await getReceivingSheet(dbA, po.id, WAREHOUSE, {
        receivingEnabled: () => true,
      });
      expect(sheet.denial).toBeNull();
      expect(sheet.order.supplierName).toBe("Acme Supply");
      expect(sheet.lines.map((line) => line.variantGid).sort()).toEqual([BLUE, RED].sort());

      const wrong = await apiError(
        getReceivingSheet(dbA, po.id, OTHER_LOCATION, { receivingEnabled: () => true }),
      );
      expect(wrong.status).toBe(409);
    });

    it("keeps another shop's orders out of the list", async () => {
      await orderedPo();

      const list = await listReceivableOrders(dbB, SHOP_B_LOCATION, null, {
        receivingEnabled: () => true,
      });

      expect(list.orders).toEqual([]);
    });
  });

  describe("the plan gate", () => {
    afterEach(async () => {
      await setPlan(true);
    });

    it("refuses every receiving call for a shop without an active plan, and writes nothing", async () => {
      const po = await orderedPo();
      await setPlan(false);

      for (const call of [
        () => listReceivableOrders(dbA, WAREHOUSE, null, { receivingEnabled: () => true }),
        () => getReceivingSheet(dbA, po.id, WAREHOUSE, { receivingEnabled: () => true }),
        () =>
          receiveAtPos(
            contextFor(dbA),
            po.id,
            WAREHOUSE,
            body([{ lineItemId: po.lineId(BLUE), acceptedQty: 4 }]),
            deps(enabled()),
          ),
      ]) {
        const error = await apiError(call());
        expect(error).toMatchObject({ status: 403, code: "forbidden", message: POS_NO_PLAN_MESSAGE });
      }

      expect(stock(BLUE_ITEM)).toBe(4);
      expect(await prisma.purchaseOrderReceipt.count()).toBe(0);
    });

    it("works again once the plan is active", async () => {
      const po = await orderedPo();
      await setPlan(false);
      await apiError(getReceivingSheet(dbA, po.id, WAREHOUSE, { receivingEnabled: () => true }));
      await setPlan(true);

      const sheet = await getReceivingSheet(dbA, po.id, WAREHOUSE, { receivingEnabled: () => true });

      expect(sheet.order.id).toBe(po.id);
    });
  });
});
