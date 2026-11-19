/**
 * Purchase-order receiving against PostgreSQL through the tenant database
 * wrapper, with the in-memory Shopify double from the inventory ledger suite:
 * what is counted as received, when, and what happens when Shopify refuses,
 * goes quiet or is switched off.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";
import { RECEIVING_OFF_MESSAGE } from "../../../lib/po-display";
import { STAFF_REQUIRED_MESSAGE } from "../../../services/inventory-writes/actor.server";
import type { ExecuteInventoryOperationOptions } from "../../../services/inventory-writes/execute.server";
import type { InventoryActor } from "../../../services/inventory-writes/types";
import type { PurchasingActor } from "../../../services/purchasing/actor.server";
import { PurchasingError } from "../../../services/purchasing/errors";
import { listPurchasingEvents } from "../../../services/purchasing/events.server";
import { getIncomingQuantities } from "../../../services/purchasing/planning.server";
import {
  loadPurchaseOrder,
  RECEIPT_IN_FLIGHT_MESSAGE,
} from "../../../services/purchasing/purchase-order-records.server";
import {
  createPurchaseOrderDraft,
  setLineCancelledQuantity,
  transitionPurchaseOrder,
  updatePurchaseOrderLine,
} from "../../../services/purchasing/purchase-orders.server";
import {
  getReceivingWorksheet,
  listPurchaseOrderReceipts,
  postPurchaseOrderReceipt,
  resumePurchaseOrderReceipt,
  reversePurchaseOrderReceipt,
  type ReceiptLineInput,
  type ReceivingResult,
} from "../../../services/purchasing/receiving.server";
import { createSupplier } from "../../../services/purchasing/suppliers.server";
import { FakeShopify } from "../../../../scripts/tenant-enforcement/tests/fake-shopify-inventory";
import {
  completeInventoryItemData,
  completeLocationData,
  completeProductData,
  completeVariantData,
} from "../../../../scripts/tenant-enforcement/tests/pr5-f3-test-helpers";
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
const RECEIVER: InventoryActor = {
  shopifyUserId: "42",
  displayName: null,
  channel: "ADMIN",
};
const TODAY = "2026-11-10";

const BLUE = "gid://shopify/ProductVariant/201";
const RED = "gid://shopify/ProductVariant/202";
const UNTRACKED = "gid://shopify/ProductVariant/203";
const BLUE_ITEM = 301;
const RED_ITEM = 302;
const WAREHOUSE = "gid://shopify/Location/401";
const WAREHOUSE_NUMBER = 401;
const SHOP_B_LOCATION = "gid://shopify/Location/411";
const SHOP_B_VARIANT = "gid://shopify/ProductVariant/901";

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

async function purchasingError(promise: Promise<unknown>): Promise<PurchasingError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(PurchasingError);
  return error as PurchasingError;
}

describe("purchase-order receiving", () => {
  let prisma: PrismaClient;
  let dbA: TenantDb;
  let dbB: TenantDb;
  let shopify: FakeShopify;
  let submissions = 0;

  const enabled = (): ExecuteInventoryOperationOptions => ({
    sendBatch: shopify.send,
    isCapabilityEnabled: () => true,
  });
  const switchedOff = (): ExecuteInventoryOperationOptions => ({
    sendBatch: shopify.send,
    isCapabilityEnabled: () => false,
  });
  const nextKey = () => `receiving-test-${++submissions}`;
  const stock = (itemNumber: number) => shopify.level(itemNumber, WAREHOUSE_NUMBER);

  beforeAll(async () => {
    const ctx = await resetAndEnforce();
    prisma = ctx.migrationPrisma;
    await ctx.runtimePrisma.$disconnect();
    const { shopA, shopB } = await seedTwoShops(prisma);

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
    lines: Array<{ variantGid: string; quantity: number }> = [
      { variantGid: BLUE, quantity: 10 },
      { variantGid: RED, quantity: 6 },
    ],
  ) {
    const supplier = await createSupplier(dbA, BUYER, supplierProfile("Acme Supply"));
    const created = await createPurchaseOrderDraft(
      dbA,
      BUYER,
      {
        supplierId: supplier.id,
        locationGid: WAREHOUSE,
        lines: lines.map((line) => ({ ...line, unitCost: new Prisma.Decimal("2.50") })),
      },
      { today: TODAY },
    );
    await transitionPurchaseOrder(dbA, BUYER, created.id, 1, "markOrdered", { today: TODAY });
    const po = await loadPurchaseOrder(dbA, created.id);
    const lineId = (variantGid: string) =>
      po.lineItems.find((line) => line.shopifyVariantId === variantGid)!.id;
    return { id: po.id, supplierId: supplier.id, lineId };
  }

  function receive(
    purchaseOrderId: string,
    lines: ReceiptLineInput[],
    extra: { key?: string; allowOverReceipt?: boolean; actor?: InventoryActor } = {},
    options: ExecuteInventoryOperationOptions = enabled(),
  ): Promise<ReceivingResult> {
    return postPurchaseOrderReceipt(
      dbA,
      null,
      extra.actor ?? RECEIVER,
      {
        purchaseOrderId,
        idempotencyKey: extra.key ?? nextKey(),
        lines,
        allowOverReceipt: extra.allowOverReceipt,
      },
      options,
    );
  }

  async function received(purchaseOrderId: string) {
    const po = await loadPurchaseOrder(dbA, purchaseOrderId);
    return {
      status: po.status,
      fullyReceivedAt: po.fullyReceivedAt,
      byVariant: Object.fromEntries(
        po.lineItems.map((line) => [line.shopifyVariantId, line.receivedQty]),
      ),
    };
  }

  const receiptRows = () => prisma.purchaseOrderReceipt.count();
  const ledgerRows = () => prisma.inventoryOperation.count();

  /** Shopify refuses the change at `index` of the next request and applies nothing. */
  function refuseNextChangeAt(index: number) {
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

  describe("receiving a delivery", () => {
    it("adds the accepted units to Shopify and counts them on the order", async () => {
      const po = await orderedPo();

      const result = await receive(po.id, [{ lineItemId: po.lineId(BLUE), acceptedQty: 4 }]);

      expect(result.complete).toBe(true);
      expect(result.message).toBe("Receipt 1: 4 units received.");
      expect(result.receipt).toMatchObject({
        receiptNumber: 1,
        status: "POSTED",
        locationGid: WAREHOUSE,
        actorChannel: "ADMIN",
        actorUserId: "42",
      });
      expect(result.receipt!.lines).toMatchObject([{ acceptedQty: 4, postedQty: 4 }]);
      expect(stock(BLUE_ITEM)).toBe(8);
      expect(await received(po.id)).toMatchObject({
        status: "PARTIAL",
        fullyReceivedAt: null,
        byVariant: { [BLUE]: 4, [RED]: 0 },
      });

      const [operation] = await prisma.inventoryOperation.findMany({ include: { lines: true } });
      expect(operation).toMatchObject({
        kind: "RECEIPT",
        status: "APPLIED",
        idempotencyKey: `po-receipt:${result.receipt!.id}`,
        sourceType: "PurchaseOrderReceipt",
        sourceId: result.receipt!.id,
        reason: "received",
        quantityName: "available",
        actorShopifyUserId: "42",
      });
      expect(operation.lines).toMatchObject([
        {
          inventoryItemGid: "gid://shopify/InventoryItem/301",
          locationGid: WAREHOUSE,
          delta: 4,
          changeFromQuantity: null,
        },
      ]);

      const [event] = await listPurchasingEvents(dbA, {
        subjectType: "PURCHASE_ORDER",
        subjectId: po.id,
      });
      expect(event).toMatchObject({
        action: "purchase_order.received",
        actorType: "STAFF",
        actorId: "42",
        details: {
          receiptNumber: 1,
          postedUnits: 4,
          fromStatus: "ORDERED",
          toStatus: "PARTIAL",
        },
      });
    });

    it("marks the order received once the last delivery is in, and measures the lead time", async () => {
      const po = await orderedPo();
      await prisma.purchaseOrder.update({
        where: { id: po.id },
        data: { orderedAt: new Date(Date.now() - 3 * 86_400_000) },
      });

      await receive(po.id, [
        { lineItemId: po.lineId(BLUE), acceptedQty: 10 },
        { lineItemId: po.lineId(RED), acceptedQty: 2 },
      ]);
      expect((await received(po.id)).status).toBe("PARTIAL");
      expect((await getIncomingQuantities(dbA)).get(RED)).toBe(4);

      const second = await receive(po.id, [{ lineItemId: po.lineId(RED), acceptedQty: 4 }]);

      expect(second.receipt).toMatchObject({ receiptNumber: 2, status: "POSTED" });
      const after = await received(po.id);
      expect(after.status).toBe("RECEIVED");
      expect(after.fullyReceivedAt).toBeInstanceOf(Date);
      expect(stock(BLUE_ITEM)).toBe(14);
      expect(stock(RED_ITEM)).toBe(6);
      expect((await getIncomingQuantities(dbA)).size).toBe(0);

      const snapshot = await prisma.leadTimeSnapshot.findFirstOrThrow({
        where: { purchaseOrderId: po.id },
      });
      expect(snapshot.leadTimeDays).toBeCloseTo(3, 1);
      const supplier = await prisma.supplier.findUniqueOrThrow({ where: { id: po.supplierId } });
      expect(supplier.leadTimeDays).toBeCloseTo(3, 1);

      const denied = await purchasingError(
        receive(po.id, [{ lineItemId: po.lineId(RED), acceptedQty: 1 }]),
      );
      expect(denied.message).toBe("A received purchase order cannot be received.");
    });

    it("records rejected units without stocking them or reducing what is still expected", async () => {
      const po = await orderedPo();

      const result = await receive(po.id, [
        { lineItemId: po.lineId(BLUE), acceptedQty: 3, rejectedQty: 2, rejectReason: " Crushed carton " },
      ]);

      expect(result.message).toBe("Receipt 1: 3 units received and 2 units rejected.");
      expect(result.receipt!.lines).toMatchObject([
        { acceptedQty: 3, rejectedQty: 2, rejectReason: "Crushed carton", postedQty: 3 },
      ]);
      expect(stock(BLUE_ITEM)).toBe(7);
      const worksheet = await getReceivingWorksheet(dbA, po.id);
      expect(worksheet.denial).toBeNull();
      expect(worksheet.lines.find((line) => line.shopifyVariantId === BLUE)).toMatchObject({
        name: "Widget - Blue",
        orderedQty: 10,
        receivedQty: 3,
        rejectedQty: 2,
        pendingQty: 0,
        openQty: 7,
      });
    });

    it("records a delivery that was rejected in full without touching Shopify", async () => {
      const po = await orderedPo();

      const result = await receive(po.id, [{ lineItemId: po.lineId(RED), acceptedQty: 0, rejectedQty: 6 }]);

      expect(result.complete).toBe(true);
      expect(result.message).toBe("Receipt 1: 6 units rejected. No stock changed.");
      expect(shopify.requests).toHaveLength(0);
      expect(await ledgerRows()).toBe(0);
      expect(await received(po.id)).toMatchObject({ status: "ORDERED", byVariant: { [RED]: 0 } });
    });

    it("sends one stock change for two lines of the same product", async () => {
      const po = await orderedPo([{ variantGid: BLUE, quantity: 10 }]);
      const first = await prisma.pOLineItem.findFirstOrThrow({ where: { purchaseOrderId: po.id } });
      const second = await prisma.pOLineItem.create({
        data: {
          shopId: first.shopId,
          purchaseOrderId: po.id,
          shopifyVariantId: BLUE,
          inventoryItemGid: first.inventoryItemGid,
          orderedQty: 5,
          unitCost: "2.0000",
          position: 1,
        },
      });

      const result = await receive(po.id, [
        { lineItemId: first.id, acceptedQty: 10 },
        { lineItemId: second.id, acceptedQty: 5 },
      ]);

      expect(result.complete).toBe(true);
      expect(shopify.requests).toHaveLength(1);
      expect(shopify.requests[0].changes).toMatchObject([{ delta: 15 }]);
      expect(stock(BLUE_ITEM)).toBe(19);
      const lines = await prisma.pOLineItem.findMany({
        where: { purchaseOrderId: po.id },
        orderBy: { position: "asc" },
      });
      expect(lines.map((line) => line.receivedQty)).toEqual([10, 5]);
      expect((await received(po.id)).status).toBe("RECEIVED");
    });
  });

  describe("retries and concurrent submissions", () => {
    it("returns the same receipt when the same submission is sent again", async () => {
      const po = await orderedPo();
      const lines = [{ lineItemId: po.lineId(BLUE), acceptedQty: 4 }];

      const first = await receive(po.id, lines, { key: "receiving-retry-0001" });
      const again = await receive(po.id, lines, { key: "receiving-retry-0001" });

      expect(again.receipt!.id).toBe(first.receipt!.id);
      expect(again.complete).toBe(true);
      expect(await receiptRows()).toBe(1);
      expect(shopify.requests).toHaveLength(1);
      expect(stock(BLUE_ITEM)).toBe(8);
      expect((await received(po.id)).byVariant[BLUE]).toBe(4);
    });

    it("refuses a reused key that carries different quantities", async () => {
      const po = await orderedPo();
      await receive(po.id, [{ lineItemId: po.lineId(BLUE), acceptedQty: 4 }], {
        key: "receiving-reuse-0001",
      });

      const error = await purchasingError(
        receive(po.id, [{ lineItemId: po.lineId(BLUE), acceptedQty: 5 }], {
          key: "receiving-reuse-0001",
        }),
      );

      expect(error.code).toBe("conflict");
      expect(stock(BLUE_ITEM)).toBe(8);
      expect((await received(po.id)).byVariant[BLUE]).toBe(4);
    });

    it("receives once when the same submission arrives twice at the same moment", async () => {
      const po = await orderedPo();
      const lines = [{ lineItemId: po.lineId(BLUE), acceptedQty: 10 }];

      const results = await Promise.all([
        receive(po.id, lines, { key: "receiving-double-0001" }),
        receive(po.id, lines, { key: "receiving-double-0001" }),
      ]);

      expect(new Set(results.map((result) => result.receipt!.id)).size).toBe(1);
      expect(await receiptRows()).toBe(1);
      expect(stock(BLUE_ITEM)).toBe(14);
      // Whichever request settled, the other may still report the receipt as
      // unfinished; asking again shows it posted and counted once.
      const settled = await resumePurchaseOrderReceipt(dbA, null, results[0].receipt!.id, enabled());
      expect(settled.receipt!.status).toBe("POSTED");
      expect((await received(po.id)).byVariant[BLUE]).toBe(10);
    });

    it("lets only one of two different deliveries claim the same open units", async () => {
      const po = await orderedPo();
      const lines = [{ lineItemId: po.lineId(BLUE), acceptedQty: 10 }];

      const outcomes = await Promise.allSettled([receive(po.id, lines), receive(po.id, lines)]);

      const accepted = outcomes.filter((outcome) => outcome.status === "fulfilled");
      const refused = outcomes.filter((outcome) => outcome.status === "rejected");
      expect(accepted).toHaveLength(1);
      expect(refused).toHaveLength(1);
      expect((refused[0] as PromiseRejectedResult).reason).toBeInstanceOf(PurchasingError);
      expect(await receiptRows()).toBe(1);
      expect(stock(BLUE_ITEM)).toBe(14);
      expect((await received(po.id)).byVariant[BLUE]).toBe(10);
    });
  });

  describe("input and state rules", () => {
    it("refuses more than the line still expects unless the extra units are confirmed", async () => {
      const po = await orderedPo();
      const line = po.lineId(RED);

      const error = await purchasingError(receive(po.id, [{ lineItemId: line, acceptedQty: 7 }]));
      expect(error.code).toBe("invalid_input");
      expect(error.fieldErrors[`line:${line}`]).toMatch(/^Only 6 units more expected\./);
      expect(await receiptRows()).toBe(0);
      expect(shopify.requests).toHaveLength(0);

      const confirmed = await receive(
        po.id,
        [
          { lineItemId: line, acceptedQty: 7 },
          { lineItemId: po.lineId(BLUE), acceptedQty: 10 },
        ],
        { allowOverReceipt: true },
      );
      expect(confirmed.complete).toBe(true);
      expect(stock(RED_ITEM)).toBe(7);
      expect(await received(po.id)).toMatchObject({ status: "RECEIVED", byVariant: { [RED]: 7 } });
    });

    it("rejects quantities that are not whole numbers in range", async () => {
      const po = await orderedPo();
      const line = po.lineId(BLUE);

      for (const acceptedQty of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 1_000_001]) {
        const error = await purchasingError(receive(po.id, [{ lineItemId: line, acceptedQty }]));
        expect(error.code).toBe("invalid_input");
        expect(error.fieldErrors[`line:${line}`]).toMatch(/whole numbers/);
      }
      const rejected = await purchasingError(
        receive(po.id, [{ lineItemId: line, acceptedQty: 1, rejectedQty: -2 }]),
      );
      expect(rejected.fieldErrors[`line:${line}`]).toMatch(/whole numbers/);
      const asText = await purchasingError(
        receive(po.id, [{ lineItemId: line, acceptedQty: "3" as unknown as number }]),
      );
      expect(asText.code).toBe("invalid_input");

      expect(await receiptRows()).toBe(0);
      expect(shopify.requests).toHaveLength(0);
    });

    it("rejects an empty receipt, a repeated line, an unknown line and a malformed key", async () => {
      const po = await orderedPo();
      const line = po.lineId(BLUE);

      expect((await purchasingError(receive(po.id, []))).message).toBe(
        "Enter a quantity for at least one line.",
      );
      expect(
        (await purchasingError(receive(po.id, [{ lineItemId: line, acceptedQty: 0 }]))).message,
      ).toBe("Enter a quantity for at least one line.");
      expect(
        (
          await purchasingError(
            receive(po.id, [
              { lineItemId: line, acceptedQty: 1 },
              { lineItemId: line, acceptedQty: 1 },
            ]),
          )
        ).fieldErrors[`line:${line}`],
      ).toBe("This line appears twice on the receipt.");
      expect(
        (await purchasingError(receive(po.id, [{ lineItemId: "not-a-line", acceptedQty: 1 }]))).code,
      ).toBe("invalid_input");
      for (const key of ["", "short", "has spaces in it", "x".repeat(129)]) {
        const error = await purchasingError(
          receive(po.id, [{ lineItemId: line, acceptedQty: 1 }], { key }),
        );
        expect(error.code).toBe("invalid_input");
      }

      expect(await receiptRows()).toBe(0);
    });

    it("receives only against sent, ordered and partially received orders", async () => {
      const supplier = await createSupplier(dbA, BUYER, supplierProfile("Draft Supply"));
      const draft = await createPurchaseOrderDraft(
        dbA,
        BUYER,
        {
          supplierId: supplier.id,
          locationGid: WAREHOUSE,
          lines: [{ variantGid: BLUE, quantity: 5, unitCost: new Prisma.Decimal("1") }],
        },
        { today: TODAY },
      );
      const draftLine = (await loadPurchaseOrder(dbA, draft.id)).lineItems[0].id;
      const lines = [{ lineItemId: draftLine, acceptedQty: 1 }];

      expect((await purchasingError(receive(draft.id, lines))).message).toBe(
        "Send this purchase order or mark it as ordered before receiving it.",
      );

      await transitionPurchaseOrder(dbA, BUYER, draft.id, 1, "markSent", { today: TODAY });
      expect((await receive(draft.id, lines)).complete).toBe(true);

      const version = (await loadPurchaseOrder(dbA, draft.id)).version;
      await transitionPurchaseOrder(dbA, BUYER, draft.id, version, "close");
      expect((await purchasingError(receive(draft.id, lines))).message).toBe(
        "A closed purchase order cannot be received.",
      );
      await transitionPurchaseOrder(dbA, BUYER, draft.id, version, "archive");
      expect((await purchasingError(receive(draft.id, lines))).message).toBe(
        "Archived purchase orders are read-only. Unarchive it first.",
      );

      const cancelled = await orderedPo();
      await transitionPurchaseOrder(dbA, BUYER, cancelled.id, 1, "cancel");
      const denied = await purchasingError(
        receive(cancelled.id, [{ lineItemId: cancelled.lineId(BLUE), acceptedQty: 1 }]),
      );
      expect(denied.code).toBe("invalid_state");
      expect(denied.message).toBe("A cancelled purchase order cannot be received.");
      expect(stock(BLUE_ITEM)).toBe(5);
    });

    it("needs a signed-in staff member", async () => {
      const po = await orderedPo();

      const error = await purchasingError(
        receive(po.id, [{ lineItemId: po.lineId(BLUE), acceptedQty: 1 }], {
          actor: { shopifyUserId: null, displayName: null, channel: "POS" },
        }),
      );

      expect(error.message).toBe(STAFF_REQUIRED_MESSAGE);
      expect(await receiptRows()).toBe(0);
    });

    it("refuses a product Shopify has no inventory item for", async () => {
      const po = await orderedPo([
        { variantGid: BLUE, quantity: 2 },
        { variantGid: UNTRACKED, quantity: 2 },
      ]);
      const line = po.lineId(UNTRACKED);

      const error = await purchasingError(
        receive(po.id, [
          { lineItemId: po.lineId(BLUE), acceptedQty: 2 },
          { lineItemId: line, acceptedQty: 2 },
        ]),
      );

      expect(error.fieldErrors[`line:${line}`]).toMatch(/does not track stock/);
      expect(await receiptRows()).toBe(0);
      expect(stock(BLUE_ITEM)).toBe(4);
    });

    it("refuses to put stock away at a location Shopify has deactivated", async () => {
      const po = await orderedPo();
      await prisma.shopifyLocationFact.updateMany({
        where: { shopifyGid: WAREHOUSE },
        data: { isActive: false },
      });

      const error = await purchasingError(
        receive(po.id, [{ lineItemId: po.lineId(BLUE), acceptedQty: 1 }]),
      );

      expect(error.code).toBe("invalid_state");
      expect(error.message).toMatch(/^Warehouse is deactivated in Shopify/);
      expect(await receiptRows()).toBe(0);
    });
  });

  describe("when Shopify does not confirm", () => {
    it("records nothing while receiving is switched off", async () => {
      const po = await orderedPo();

      const result = await receive(
        po.id,
        [{ lineItemId: po.lineId(BLUE), acceptedQty: 4 }],
        {},
        switchedOff(),
      );

      expect(result).toEqual({ complete: false, message: RECEIVING_OFF_MESSAGE, receipt: null });
      expect(await receiptRows()).toBe(0);
      expect(await ledgerRows()).toBe(0);
      expect(shopify.requests).toHaveLength(0);
      expect(await received(po.id)).toMatchObject({ status: "ORDERED", byVariant: { [BLUE]: 0 } });
    });

    it("keeps a delivery pending when the answer is lost, then counts it exactly once", async () => {
      const po = await orderedPo();
      const line = po.lineId(BLUE);
      shopify.loseNextResponse();

      const result = await receive(po.id, [{ lineItemId: line, acceptedQty: 10 }]);

      expect(result.complete).toBe(false);
      expect(result.receipt!.status).toBe("PENDING");
      expect(result.message).toMatch(/Shopify has not confirmed the stock change yet/);
      expect(await received(po.id)).toMatchObject({ status: "ORDERED", byVariant: { [BLUE]: 0 } });
      expect((await getReceivingWorksheet(dbA, po.id)).lines[0]).toMatchObject({
        pendingQty: 10,
        openQty: 0,
      });

      // The unconfirmed units are held: they cannot be received again, and the
      // order cannot be cancelled, closed or shrunk underneath them.
      const again = await purchasingError(receive(po.id, [{ lineItemId: line, acceptedQty: 1 }]));
      expect(again.fieldErrors[`line:${line}`]).toMatch(/^Nothing more is expected/);
      expect(
        (await purchasingError(transitionPurchaseOrder(dbA, BUYER, po.id, 1, "cancel"))).message,
      ).toBe(RECEIPT_IN_FLIGHT_MESSAGE);
      expect(
        (await purchasingError(setLineCancelledQuantity(dbA, BUYER, po.id, 1, line, 3))).message,
      ).toBe(RECEIPT_IN_FLIGHT_MESSAGE);
      expect(
        (
          await purchasingError(
            updatePurchaseOrderLine(dbA, BUYER, po.id, 1, line, {
              quantity: 5,
              unitCost: null,
              discountPercent: null,
              taxRatePercent: null,
              note: null,
            }),
          )
        ).message,
      ).toBe(RECEIPT_IN_FLIGHT_MESSAGE);

      const resumed = await resumePurchaseOrderReceipt(dbA, null, result.receipt!.id, enabled());

      expect(resumed.complete).toBe(true);
      expect(resumed.receipt!.status).toBe("POSTED");
      expect(shopify.keys()).toHaveLength(2);
      expect(new Set(shopify.keys()).size).toBe(1);
      expect(stock(BLUE_ITEM)).toBe(14);
      expect(await received(po.id)).toMatchObject({ status: "PARTIAL", byVariant: { [BLUE]: 10 } });

      const onceMore = await resumePurchaseOrderReceipt(dbA, null, result.receipt!.id, enabled());
      expect(onceMore.complete).toBe(true);
      expect(shopify.requests).toHaveLength(2);
      expect((await received(po.id)).byVariant[BLUE]).toBe(10);
    });

    it("holds a pending delivery while receiving is switched off and posts it once it is back on", async () => {
      const po = await orderedPo();
      await receive(po.id, [{ lineItemId: po.lineId(BLUE), acceptedQty: 1 }]);
      shopify.loseNextResponse();
      const pending = await receive(po.id, [{ lineItemId: po.lineId(RED), acceptedQty: 6 }]);

      const held = await resumePurchaseOrderReceipt(dbA, null, pending.receipt!.id, switchedOff());

      expect(held.complete).toBe(false);
      expect(held.receipt!.status).toBe("PENDING");
      expect(held.message).toMatch(/receiving is turned off for this store/);
      expect(shopify.requests).toHaveLength(2);
      expect((await received(po.id)).byVariant[RED]).toBe(0);
      expect(
        (await purchasingError(transitionPurchaseOrder(dbA, BUYER, po.id, 1, "close"))).message,
      ).toBe(RECEIPT_IN_FLIGHT_MESSAGE);

      const posted = await resumePurchaseOrderReceipt(dbA, null, pending.receipt!.id, enabled());
      expect(posted.complete).toBe(true);
      expect(stock(RED_ITEM)).toBe(6);
      expect((await received(po.id)).byVariant[RED]).toBe(6);
    });

    it("counts only the lines Shopify accepted and leaves the rest to be received again", async () => {
      const po = await orderedPo();
      refuseNextChangeAt(1);

      const result = await receive(po.id, [
        { lineItemId: po.lineId(BLUE), acceptedQty: 10 },
        { lineItemId: po.lineId(RED), acceptedQty: 6 },
      ]);

      expect(result.complete).toBe(false);
      expect(result.receipt!.status).toBe("PARTIALLY_POSTED");
      expect(result.message).toBe(
        "Receipt 1: 10 units received. Shopify refused the other lines, so they are not counted as received. The item is not stocked at the location.",
      );
      expect(result.receipt!.lines).toMatchObject([
        { shopifyVariantId: BLUE, postedQty: 10, errorMessage: null },
        {
          shopifyVariantId: RED,
          postedQty: 0,
          errorMessage: "The item is not stocked at the location.",
        },
      ]);
      expect(stock(BLUE_ITEM)).toBe(14);
      expect(stock(RED_ITEM)).toBe(0);
      expect(await received(po.id)).toMatchObject({
        status: "PARTIAL",
        byVariant: { [BLUE]: 10, [RED]: 0 },
      });

      const retry = await receive(po.id, [{ lineItemId: po.lineId(RED), acceptedQty: 6 }]);
      expect(retry.receipt).toMatchObject({ receiptNumber: 2, status: "POSTED" });
      expect((await received(po.id)).status).toBe("RECEIVED");
    });

    it("counts nothing when Shopify refuses the whole delivery", async () => {
      const po = await orderedPo();
      shopify.next(() => ({
        kind: "rejected",
        errors: [
          {
            code: "INVALID_LOCATION",
            message: "The location could not be found.",
            changeIndex: null,
          },
        ],
      }));

      const result = await receive(po.id, [{ lineItemId: po.lineId(BLUE), acceptedQty: 10 }]);

      expect(result.complete).toBe(false);
      expect(result.receipt!.status).toBe("FAILED");
      expect(result.message).toBe(
        "Receipt 1: nothing was received and no stock changed. The location could not be found.",
      );
      expect(stock(BLUE_ITEM)).toBe(4);
      expect(await received(po.id)).toMatchObject({ status: "ORDERED", byVariant: { [BLUE]: 0 } });
      const [event] = await listPurchasingEvents(dbA, {
        subjectType: "PURCHASE_ORDER",
        subjectId: po.id,
      });
      expect(event.action).toBe("purchase_order.receipt_failed");

      // A failed receipt holds nothing back.
      expect((await getReceivingWorksheet(dbA, po.id)).lines[0].openQty).toBe(10);
      await transitionPurchaseOrder(dbA, BUYER, po.id, 1, "cancel");
    });
  });

  describe("reversing a receipt", () => {
    it("takes the stock back out and reopens the order", async () => {
      const po = await orderedPo();
      const first = await receive(po.id, [
        { lineItemId: po.lineId(BLUE), acceptedQty: 10 },
        { lineItemId: po.lineId(RED), acceptedQty: 6 },
      ]);
      expect((await received(po.id)).status).toBe("RECEIVED");
      expect(await prisma.leadTimeSnapshot.count()).toBe(1);

      const reversed = await reversePurchaseOrderReceipt(
        dbA,
        null,
        RECEIVER,
        { receiptId: first.receipt!.id, note: "Wrong pallet" },
        enabled(),
      );

      expect(reversed.complete).toBe(true);
      expect(reversed.message).toBe("Receipt 1 was reversed and 16 units taken back out of stock.");
      expect(reversed.receipt!.status).toBe("REVERSED");
      expect(reversed.receipt!.lines.map((line) => line.reversedQty)).toEqual([10, 6]);
      expect(stock(BLUE_ITEM)).toBe(4);
      expect(stock(RED_ITEM)).toBe(0);
      expect(await received(po.id)).toMatchObject({
        status: "ORDERED",
        fullyReceivedAt: null,
        byVariant: { [BLUE]: 0, [RED]: 0 },
      });
      expect(await prisma.leadTimeSnapshot.count()).toBe(0);
      expect((await getIncomingQuantities(dbA)).get(BLUE)).toBe(10);

      const operations = await prisma.inventoryOperation.findMany({ orderBy: { createdAt: "asc" } });
      expect(operations.map((operation) => operation.kind)).toEqual(["RECEIPT", "REVERSAL"]);
      expect(operations[1].reversesOperationId).toBe(operations[0].id);

      const [event] = await listPurchasingEvents(dbA, {
        subjectType: "PURCHASE_ORDER",
        subjectId: po.id,
      });
      expect(event).toMatchObject({
        action: "purchase_order.receipt_reversed",
        details: { reversedUnits: 16, fromStatus: "RECEIVED", toStatus: "ORDERED" },
      });

      const again = await reversePurchaseOrderReceipt(
        dbA,
        null,
        RECEIVER,
        { receiptId: first.receipt!.id },
        enabled(),
      );
      expect(again.complete).toBe(true);
      expect(shopify.requests).toHaveLength(2);
      expect(stock(BLUE_ITEM)).toBe(4);

      // The units are expected again and can be received on a new receipt.
      const redo = await receive(po.id, [{ lineItemId: po.lineId(BLUE), acceptedQty: 10 }]);
      expect(redo.receipt).toMatchObject({ receiptNumber: 2, status: "POSTED" });
    });

    it("keeps the other deliveries when one of several is reversed", async () => {
      const po = await orderedPo();
      const first = await receive(po.id, [{ lineItemId: po.lineId(BLUE), acceptedQty: 4 }]);
      await receive(po.id, [
        { lineItemId: po.lineId(BLUE), acceptedQty: 6 },
        { lineItemId: po.lineId(RED), acceptedQty: 6 },
      ]);

      await reversePurchaseOrderReceipt(dbA, null, RECEIVER, { receiptId: first.receipt!.id }, enabled());

      expect(await received(po.id)).toMatchObject({
        status: "PARTIAL",
        byVariant: { [BLUE]: 6, [RED]: 6 },
      });
      expect(stock(BLUE_ITEM)).toBe(10);
    });

    it("stays unfinished when the answer is lost, then reverses exactly once", async () => {
      const po = await orderedPo();
      const first = await receive(po.id, [{ lineItemId: po.lineId(BLUE), acceptedQty: 10 }]);
      shopify.loseNextResponse();

      const unfinished = await reversePurchaseOrderReceipt(
        dbA,
        null,
        RECEIVER,
        { receiptId: first.receipt!.id },
        enabled(),
      );

      expect(unfinished.complete).toBe(false);
      expect(unfinished.receipt!.status).toBe("REVERSING");
      expect((await received(po.id)).byVariant[BLUE]).toBe(10);

      const finished = await resumePurchaseOrderReceipt(dbA, null, first.receipt!.id, enabled());
      expect(finished.complete).toBe(true);
      expect(finished.receipt!.status).toBe("REVERSED");
      expect(stock(BLUE_ITEM)).toBe(4);
      expect((await received(po.id)).byVariant[BLUE]).toBe(0);
    });

    it("keeps counting the lines Shopify would not take back", async () => {
      const po = await orderedPo();
      const first = await receive(po.id, [
        { lineItemId: po.lineId(BLUE), acceptedQty: 10 },
        { lineItemId: po.lineId(RED), acceptedQty: 6 },
      ]);
      refuseNextChangeAt(0);

      const result = await reversePurchaseOrderReceipt(
        dbA,
        null,
        RECEIVER,
        { receiptId: first.receipt!.id },
        enabled(),
      );

      expect(result.complete).toBe(false);
      expect(result.receipt!.status).toBe("PARTIALLY_REVERSED");
      expect(await received(po.id)).toMatchObject({
        status: "PARTIAL",
        byVariant: { [BLUE]: 10, [RED]: 0 },
      });
      expect(stock(BLUE_ITEM)).toBe(14);
      expect(stock(RED_ITEM)).toBe(0);
    });

    it("refuses while switched off, on a closed order, and for receipts with nothing to reverse", async () => {
      const po = await orderedPo();
      const posted = await receive(po.id, [{ lineItemId: po.lineId(BLUE), acceptedQty: 4 }]);

      const off = await reversePurchaseOrderReceipt(
        dbA,
        null,
        RECEIVER,
        { receiptId: posted.receipt!.id },
        switchedOff(),
      );
      expect(off.complete).toBe(false);
      expect(off.receipt!.status).toBe("POSTED");
      expect(off.message).toMatch(/was not reversed and no stock changed/);

      shopify.loseNextResponse();
      const pending = await receive(po.id, [{ lineItemId: po.lineId(RED), acceptedQty: 1 }]);
      expect(
        (
          await purchasingError(
            reversePurchaseOrderReceipt(dbA, null, RECEIVER, { receiptId: pending.receipt!.id }, enabled()),
          )
        ).message,
      ).toMatch(/still waiting for Shopify/);
      await resumePurchaseOrderReceipt(dbA, null, pending.receipt!.id, enabled());

      await transitionPurchaseOrder(dbA, BUYER, po.id, 1, "close");
      const closed = await purchasingError(
        reversePurchaseOrderReceipt(dbA, null, RECEIVER, { receiptId: posted.receipt!.id }, enabled()),
      );
      expect(closed.message).toBe("Receipts on a closed purchase order cannot be reversed.");
      expect(stock(BLUE_ITEM)).toBe(8);
      expect((await received(po.id)).byVariant[BLUE]).toBe(4);
    });
  });

  describe("tenant isolation and constraints", () => {
    it("hides one shop's purchase orders and receipts from another", async () => {
      const po = await orderedPo();
      const line = po.lineId(BLUE);
      const posted = await receive(po.id, [{ lineItemId: line, acceptedQty: 4 }]);
      const lines = [{ lineItemId: line, acceptedQty: 1 }];
      const asShopB = (purchaseOrderId: string) =>
        postPurchaseOrderReceipt(
          dbB,
          null,
          RECEIVER,
          { purchaseOrderId, idempotencyKey: nextKey(), lines },
          enabled(),
        );

      expect((await purchasingError(asShopB(po.id))).code).toBe("not_found");
      // One at a time: a rejection created before it is awaited is unhandled.
      for (const attempt of [
        () => resumePurchaseOrderReceipt(dbB, null, posted.receipt!.id, enabled()),
        () =>
          reversePurchaseOrderReceipt(dbB, null, RECEIVER, { receiptId: posted.receipt!.id }, enabled()),
        () => getReceivingWorksheet(dbB, po.id),
      ]) {
        expect((await purchasingError(attempt())).code).toBe("not_found");
      }
      expect(await listPurchaseOrderReceipts(dbB, po.id)).toEqual([]);
      expect(await dbB.purchaseOrderReceipt.count({})).toBe(0);
      expect(await dbB.purchaseOrderReceiptLine.count({})).toBe(0);

      // Shop B's own order cannot be received with shop A's line.
      const supplierB = await createSupplier(dbB, BUYER, supplierProfile("Shop B Supply"));
      const poB = await createPurchaseOrderDraft(
        dbB,
        BUYER,
        {
          supplierId: supplierB.id,
          locationGid: SHOP_B_LOCATION,
          lines: [{ variantGid: SHOP_B_VARIANT, quantity: 3, unitCost: new Prisma.Decimal("1") }],
        },
        { today: TODAY },
      );
      await transitionPurchaseOrder(dbB, BUYER, poB.id, 1, "markOrdered", { today: TODAY });
      expect((await purchasingError(asShopB(poB.id))).code).toBe("invalid_input");
      expect(await dbB.purchaseOrderReceipt.count({})).toBe(0);

      expect(stock(BLUE_ITEM)).toBe(8);
      expect((await received(po.id)).byVariant[BLUE]).toBe(4);
      expect((await listPurchaseOrderReceipts(dbA, po.id)).map((receipt) => receipt.status)).toEqual([
        "POSTED",
      ]);
    });

    it("cannot store a receipt line that posts more than it accepted", async () => {
      const po = await orderedPo();
      const posted = await receive(po.id, [{ lineItemId: po.lineId(BLUE), acceptedQty: 4 }]);
      const lineId = posted.receipt!.lines[0].id;

      await expect(
        prisma.purchaseOrderReceiptLine.update({ where: { id: lineId }, data: { postedQty: 5 } }),
      ).rejects.toThrow(/PurchaseOrderReceiptLine_postedQty_check/);
      await expect(
        prisma.purchaseOrderReceiptLine.update({ where: { id: lineId }, data: { reversedQty: 5 } }),
      ).rejects.toThrow(/PurchaseOrderReceiptLine_reversedQty_check/);
      await expect(
        prisma.purchaseOrder.delete({ where: { id: po.id } }),
      ).rejects.toThrow();
    });
  });
});
