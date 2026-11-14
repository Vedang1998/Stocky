/**
 * The purchase-order pages against PostgreSQL through the tenant database
 * wrapper: what their forms accept and refuse, what another shop can reach,
 * and what the pages show from real loader data.
 */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { RECEIVING_OFF_MESSAGE } from "../../../lib/po-display";
import { STAFF_REQUIRED_MESSAGE } from "../../../services/inventory-writes/actor.server";
import type { ExecuteInventoryOperationOptions } from "../../../services/inventory-writes/execute.server";
import type { InventoryActor } from "../../../services/inventory-writes/types";
import {
  STALE_PAGE_MESSAGE,
  type PurchasingActionResult,
} from "../../../services/purchasing/action-result.server";
import type { PurchasingActor } from "../../../services/purchasing/actor.server";
import {
  receiveDelivery,
  runPurchaseOrderIntent,
} from "../../../services/purchasing/purchase-order-actions.server";
import {
  loadPurchaseOrder,
  STALE_VERSION_MESSAGE,
} from "../../../services/purchasing/purchase-order-records.server";
import { getPurchaseOrderView } from "../../../services/purchasing/purchase-order-view.server";
import {
  createPurchaseOrderDraft,
  transitionPurchaseOrder,
} from "../../../services/purchasing/purchase-orders.server";
import { createSupplier } from "../../../services/purchasing/suppliers.server";
import { searchVariants } from "../../../services/purchasing/variants.server";
import { renderRoute, unsafeWirePaths } from "../../../test-utils/render-route";
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

const { requireAdminTenant, requirePurchasingContext } = vi.hoisted(() => ({
  requireAdminTenant: vi.fn(),
  requirePurchasingContext: vi.fn(),
}));

vi.mock("../../require-admin-tenant.server", () => ({ requireAdminTenant }));
vi.mock("../../../services/purchasing/actor.server", async (original) => ({
  ...(await original<
    typeof import("../../../services/purchasing/actor.server")
  >()),
  requirePurchasingContext,
}));

const BUYER: PurchasingActor = { type: "STAFF", id: "42" };
const RECEIVER: InventoryActor = {
  shopifyUserId: "42",
  displayName: null,
  channel: "ADMIN",
};
const TODAY = "2026-11-10";

const BLUE = "gid://shopify/ProductVariant/201";
const RED = "gid://shopify/ProductVariant/202";
const BLUE_ITEM = 301;
const WAREHOUSE = "gid://shopify/Location/401";
const WAREHOUSE_NUMBER = 401;
const SHOP_B_VARIANT = "gid://shopify/ProductVariant/901";

const supplierProfile = (name: string) => ({
  name,
  accountNumber: null,
  contactName: null,
  contactEmail: "orders@acme.example",
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

/** Shopify answering the shop-profile query the pages ask for dates and currency. */
const admin = {
  graphql: async () =>
    new Response(
      JSON.stringify({
        data: {
          shop: { currencyCode: "USD", ianaTimezone: "America/New_York" },
        },
      }),
    ),
} as never;

function formData(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
}

function failed(result: PurchasingActionResult | Response) {
  if (result instanceof Response || result.ok) {
    throw new Error("Expected the action to be refused");
  }
  return result;
}

function succeeded(result: PurchasingActionResult | Response) {
  if (result instanceof Response || !result.ok) {
    throw new Error(
      `Expected the action to succeed: ${result instanceof Response ? result.status : result.error}`,
    );
  }
  return result;
}

describe("purchase-order pages", () => {
  let prisma: PrismaClient;
  let dbA: TenantDb;
  let dbB: TenantDb;
  let shopify: FakeShopify;

  const shopA = () => ({
    admin,
    db: dbA,
    actor: BUYER,
    inventoryActor: RECEIVER,
  });
  const shopB = () => ({
    admin,
    db: dbB,
    actor: BUYER,
    inventoryActor: RECEIVER,
  });
  const stockOn = (): ExecuteInventoryOperationOptions => ({
    sendBatch: shopify.send,
    isCapabilityEnabled: () => true,
  });

  beforeAll(async () => {
    const ctx = await resetAndEnforce();
    prisma = ctx.migrationPrisma;
    await ctx.runtimePrisma.$disconnect();
    const shops = await seedTwoShops(prisma);

    await prisma.shopifyProductFact.createMany({
      data: [
        completeProductData({
          id: "101",
          shopId: shops.shopA.id,
          title: "Widget",
        }),
        completeProductData({
          id: "109",
          shopId: shops.shopB.id,
          title: "Widget of shop B",
        }),
      ],
    });
    await prisma.shopifyVariantFact.createMany({
      data: [
        {
          ...completeVariantData({
            id: "201",
            shopId: shops.shopA.id,
            productId: "101",
          }),
          title: "Blue",
          sku: "W-BLUE",
          barcode: "0123456789012",
          priceAmount: "9.990000",
        },
        {
          ...completeVariantData({
            id: "202",
            shopId: shops.shopA.id,
            productId: "101",
          }),
          title: "Red",
          sku: "W-RED",
        },
        {
          ...completeVariantData({
            id: "901",
            shopId: shops.shopB.id,
            productId: "109",
          }),
          sku: "W-BLUE",
        },
      ],
    });
    await prisma.shopifyInventoryItemFact.createMany({
      data: [
        completeInventoryItemData({
          id: "301",
          shopId: shops.shopA.id,
          variantId: "201",
        }),
        completeInventoryItemData({
          id: "302",
          shopId: shops.shopA.id,
          variantId: "202",
        }),
        completeInventoryItemData({
          id: "391",
          shopId: shops.shopB.id,
          variantId: "901",
        }),
      ],
    });
    await prisma.shopifyLocationFact.createMany({
      data: [
        {
          ...completeLocationData({ id: "401", shopId: shops.shopA.id }),
          name: "Warehouse",
        },
        {
          ...completeLocationData({
            id: "411",
            shopId: shops.shopB.id,
            requestGen: 13n,
          }),
          name: "Shop B",
        },
      ],
    });

    requireRuntimeUrl();
    dbA = createTenantDb(
      issueTenantAuthority({
        shopId: shops.shopA.id,
        myshopifyDomain: SHOP_A_DOMAIN,
        source: "verified_admin_request",
      }),
    );
    dbB = createTenantDb(
      issueTenantAuthority({
        shopId: shops.shopB.id,
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
    shopify = new FakeShopify();
    shopify.setLevel(BLUE_ITEM, 4, WAREHOUSE_NUMBER);
    vi.clearAllMocks();
    requireAdminTenant.mockResolvedValue({ admin, db: dbA });
    requirePurchasingContext.mockResolvedValue(shopA());
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  /** A draft for 10 Blue at 2.50, optionally marked as ordered. */
  async function purchaseOrder(options: { ordered?: boolean } = {}) {
    const supplier = await createSupplier(
      dbA,
      BUYER,
      supplierProfile("Acme Supply"),
    );
    const draft = await createPurchaseOrderDraft(
      dbA,
      BUYER,
      {
        supplierId: supplier.id,
        locationGid: WAREHOUSE,
        lines: [
          {
            variantGid: BLUE,
            quantity: 10,
            unitCost: new Prisma.Decimal("2.50"),
          },
        ],
      },
      { today: TODAY },
    );
    if (options.ordered) {
      await transitionPurchaseOrder(dbA, BUYER, draft.id, 1, "markOrdered", {
        today: TODAY,
      });
    }
    return current(draft.id);
  }

  async function current(id: string) {
    const po = await loadPurchaseOrder(dbA, id);
    return {
      id: po.id,
      version: String(po.version),
      status: po.status,
      lines: po.lineItems,
      blueLineId: po.lineItems.find((l) => l.shopifyVariantId === BLUE)!.id,
    };
  }

  const submit = (
    id: string,
    fields: Record<string, string>,
    context = shopA(),
  ) => runPurchaseOrderIntent(context, id, formData(fields), stockOn());

  const receive = (
    id: string,
    fields: Record<string, string>,
    stock: ExecuteInventoryOperationOptions = stockOn(),
    context:
      | ReturnType<typeof shopA>
      | (Omit<ReturnType<typeof shopA>, "inventoryActor"> & {
          inventoryActor: null;
        }) = shopA(),
  ) => receiveDelivery(context, id, formData(fields), stock);

  describe("order page forms", () => {
    it.each([
      ["a negative quantity", { quantity: "-5" }],
      ["zero", { quantity: "0" }],
      ["a fraction", { quantity: "1.5" }],
      ["exponent notation", { quantity: "1e3" }],
      ["text", { quantity: "NaN" }],
      ["a negative cost", { quantity: "1", unitCost: "-1" }],
      ["a cost that is not a number", { quantity: "1", unitCost: "Infinity" }],
      ["a cost with five decimals", { quantity: "1", unitCost: "1.00001" }],
    ])("does not add a product with %s", async (_name, fields) => {
      const po = await purchaseOrder();

      const result = failed(
        await submit(po.id, {
          intent: "addLine",
          version: po.version,
          variantGid: RED,
          ...fields,
        }),
      );

      expect(result.error).toMatch(/^(Quantity|Unit cost) /);
      expect((await current(po.id)).lines).toHaveLength(1);
    });

    it.each([
      ["a negative quantity", { quantity: "-1", unitCost: "2.50" }, "quantity"],
      ["a quantity that is not a number", { quantity: "abc" }, "quantity"],
      ["a negative cost", { quantity: "10", unitCost: "-0.01" }, "unitCost"],
      [
        "a discount above 100%",
        { quantity: "10", discountPercent: "100.5" },
        "discountPercent",
      ],
      [
        "a negative tax rate",
        { quantity: "10", taxRatePercent: "-5" },
        "taxRatePercent",
      ],
    ])("does not save a line with %s", async (_name, fields, field) => {
      const po = await purchaseOrder();

      const result = failed(
        await submit(po.id, {
          intent: "saveLine",
          version: po.version,
          lineId: po.blueLineId,
          ...fields,
        }),
      );

      expect(Object.keys(result.fieldErrors)).toEqual([field]);
      const [line] = (await current(po.id)).lines;
      expect(line).toMatchObject({ orderedQty: 10 });
      expect(line!.unitCost.toFixed(2)).toBe("2.50");
    });

    it("does not save charges with a negative or malformed amount", async () => {
      const po = await purchaseOrder();
      const charge = (amount: string) => ({
        intent: "saveCharges",
        version: po.version,
        chargeCount: "1",
        landedCostMethod: "COST",
        "charge-kind-0": "SHIPPING",
        "charge-amount-0": amount,
        "charge-allocate-0": "on",
      });

      for (const amount of ["-10", "1e2", "12.345", ""]) {
        const result = failed(await submit(po.id, charge(amount)));
        expect(Object.keys(result.fieldErrors)).toEqual(["charge-amount-0"]);
      }
      expect(await prisma.purchaseOrderCharge.count()).toBe(0);

      succeeded(await submit(po.id, charge("12.50")));
      const view = await getPurchaseOrderView(dbA, po.id);
      expect(view.totals).toMatchObject({
        merchandiseAmount: "25.00",
        chargesAmount: "12.50",
        totalAmount: "37.50",
      });
      expect(view.lines[0]).toMatchObject({ landedUnitCost: "3.7500" });
    });

    it("refuses lifecycle steps the order's status does not allow", async () => {
      const po = await purchaseOrder();
      succeeded(await submit(po.id, { intent: "cancel", version: po.version }));
      const cancelled = await current(po.id);
      expect(cancelled.status).toBe("CANCELLED");

      for (const intent of ["markOrdered", "markSent", "close", "delete"]) {
        const result = failed(
          await submit(po.id, { intent, version: cancelled.version }),
        );
        expect(result.error).toMatch(/cancelled purchase order|Only /i);
      }
      const line = failed(
        await submit(po.id, {
          intent: "addLine",
          version: cancelled.version,
          variantGid: RED,
          quantity: "1",
        }),
      );
      expect(line.error).toMatch(/can no longer be/);
      expect(await current(po.id)).toMatchObject({
        status: "CANCELLED",
        version: cancelled.version,
      });
    });

    it("does not cancel an order that has received stock", async () => {
      const po = await purchaseOrder({ ordered: true });
      const receipt = await receive(po.id, {
        idempotencyKey: "screens-received-1",
        [`accepted-${po.blueLineId}`]: "10",
      });
      expect(receipt).toMatchObject({ ok: true, warning: null });
      const received = await current(po.id);
      expect(received.status).toBe("RECEIVED");

      const result = failed(
        await submit(po.id, { intent: "cancel", version: received.version }),
      );

      expect(result.error).toBe(
        "Stock has already been received on this purchase order. Close it instead of cancelling.",
      );
      expect((await current(po.id)).status).toBe("RECEIVED");
    });

    it("refuses a form from an older version of the page, or with no version", async () => {
      const po = await purchaseOrder();
      succeeded(
        await submit(po.id, {
          intent: "addLine",
          version: po.version,
          variantGid: RED,
          quantity: "2",
        }),
      );

      const stale = failed(
        await submit(po.id, { intent: "markOrdered", version: po.version }),
      );
      const missing = failed(await submit(po.id, { intent: "markOrdered" }));
      const malformed = failed(
        await submit(po.id, { intent: "markOrdered", version: "1 OR 1=1" }),
      );

      expect(stale.error).toBe(STALE_VERSION_MESSAGE);
      expect(missing.error).toBe(STALE_PAGE_MESSAGE);
      expect(malformed.error).toBe(STALE_PAGE_MESSAGE);
      expect((await current(po.id)).status).toBe("DRAFT");
    });

    it("refuses an intent the page does not have", async () => {
      const po = await purchaseOrder();

      const result = failed(
        await submit(po.id, { intent: "receive", version: po.version }),
      );

      expect(result.error).toBe("That action is not available.");
    });

    it("takes an order from draft to received and back through the page's forms", async () => {
      const po = await purchaseOrder();
      const added = succeeded(
        await submit(po.id, {
          intent: "addLine",
          version: po.version,
          variantGid: RED,
          quantity: "3",
        }),
      );
      expect(added.notice).toBe(
        "Product added. No cost is on file for it; enter the unit cost on the line.",
      );
      let now = await current(po.id);
      const redLineId = now.lines.find((l) => l.shopifyVariantId === RED)!.id;
      succeeded(
        await submit(po.id, {
          intent: "saveLine",
          version: now.version,
          lineId: redLineId,
          quantity: "3",
          unitCost: "4.00",
        }),
      );
      now = await current(po.id);
      succeeded(
        await submit(po.id, {
          intent: "saveDetails",
          version: now.version,
          expectedOn: "2026-11-20",
          supplierNotes: "Deliver before noon",
        }),
      );
      now = await current(po.id);
      succeeded(
        await submit(po.id, { intent: "markOrdered", version: now.version }),
      );

      const receipt = await receive(po.id, {
        idempotencyKey: "screens-roundtrip-1",
        [`accepted-${po.blueLineId}`]: "6",
        [`rejected-${po.blueLineId}`]: "1",
        [`reason-${po.blueLineId}`]: "Crushed box",
        supplierReference: "PS-881",
      });
      expect(receipt).toEqual({
        ok: true,
        notice: "Receipt 1: 6 units received and 1 unit rejected.",
        warning: null,
        received: [{ variantGid: BLUE, units: 6 }],
      });
      expect(shopify.level(BLUE_ITEM, WAREHOUSE_NUMBER)).toBe(10);
      expect((await current(po.id)).status).toBe("PARTIAL");

      const [recorded] = await prisma.purchaseOrderReceipt.findMany();
      const reversed = succeeded(
        await submit(po.id, {
          intent: "reverseReceipt",
          receiptId: recorded!.id,
          note: "Counted the wrong pallet",
        }),
      );
      expect(reversed.notice).toBe(
        "Receipt 1 was reversed and 6 units taken back out of stock.",
      );
      expect(shopify.level(BLUE_ITEM, WAREHOUSE_NUMBER)).toBe(4);
      expect((await current(po.id)).status).toBe("ORDERED");
    });

    it("deletes a draft and duplicates an order by redirecting", async () => {
      const po = await purchaseOrder();

      const copy = await submit(po.id, { intent: "duplicate" });
      expect(copy).toBeInstanceOf(Response);
      const copyLocation = (copy as Response).headers.get("Location")!;
      expect(copyLocation).toMatch(/^\/app\/purchase-orders\/[a-z0-9]+$/);
      expect(copyLocation).not.toContain(po.id);

      const deleted = await submit(po.id, {
        intent: "delete",
        version: po.version,
      });
      expect(deleted).toBeInstanceOf(Response);
      expect((deleted as Response).headers.get("Location")).toBe(
        "/app/purchase-orders?view=draft",
      );
      expect(await prisma.purchaseOrder.count({ where: { id: po.id } })).toBe(
        0,
      );
      expect(await prisma.purchaseOrder.count()).toBe(1);
    });
  });

  describe("receiving page form", () => {
    it.each([
      ["a negative quantity", "-1"],
      ["a fraction", "2.5"],
      ["text", "ten"],
      ["exponent notation", "1e1"],
    ])("records nothing for %s", async (_name, quantity) => {
      const po = await purchaseOrder({ ordered: true });

      const result = await receive(po.id, {
        idempotencyKey: "screens-invalid-1",
        [`accepted-${po.blueLineId}`]: quantity,
      });

      expect(result).toMatchObject({
        ok: false,
        idempotencyKey: "screens-invalid-1",
        fieldErrors: { [`accepted-${po.blueLineId}`]: expect.any(String) },
      });
      expect(await prisma.purchaseOrderReceipt.count()).toBe(0);
      expect(shopify.requests).toHaveLength(0);
    });

    it("points an over-receipt at the line's field and accepts it once allowed", async () => {
      const po = await purchaseOrder({ ordered: true });
      const fields = {
        idempotencyKey: "screens-over-1",
        [`accepted-${po.blueLineId}`]: "11",
      };

      const refused = await receive(po.id, fields);
      expect(refused).toMatchObject({
        ok: false,
        fieldErrors: { [`accepted-${po.blueLineId}`]: expect.any(String) },
      });
      expect(await prisma.purchaseOrderReceipt.count()).toBe(0);

      const allowed = await receive(po.id, {
        ...fields,
        allowOverReceipt: "on",
      });
      expect(allowed).toMatchObject({
        ok: true,
        received: [{ variantGid: BLUE, units: 11 }],
      });
    });

    it("records one receipt when the same form is submitted twice", async () => {
      const po = await purchaseOrder({ ordered: true });
      const fields = {
        idempotencyKey: "screens-double-1",
        [`accepted-${po.blueLineId}`]: "4",
      };

      const first = await receive(po.id, fields);
      const second = await receive(po.id, fields);

      expect(first).toEqual({
        ok: true,
        notice: "Receipt 1: 4 units received.",
        warning: null,
        received: [{ variantGid: BLUE, units: 4 }],
      });
      expect(second).toEqual(first);
      expect(await prisma.purchaseOrderReceipt.count()).toBe(1);
      expect(shopify.level(BLUE_ITEM, WAREHOUSE_NUMBER)).toBe(8);
    });

    it("moves stock once when two submissions of one form race", async () => {
      const po = await purchaseOrder({ ordered: true });
      const fields = {
        idempotencyKey: "screens-double-2",
        [`accepted-${po.blueLineId}`]: "4",
      };

      const results = await Promise.all([
        receive(po.id, fields),
        receive(po.id, fields),
      ]);

      // The request that lost the race may report the receipt as unconfirmed.
      expect(results.every((result) => result.ok)).toBe(true);
      expect(await prisma.purchaseOrderReceipt.count()).toBe(1);
      expect(shopify.level(BLUE_ITEM, WAREHOUSE_NUMBER)).toBe(8);
      expect(await receive(po.id, fields)).toMatchObject({
        ok: true,
        warning: null,
        received: [{ variantGid: BLUE, units: 4 }],
      });
    });

    it("needs a form key and at least one quantity", async () => {
      const po = await purchaseOrder({ ordered: true });

      const noKey = await receive(po.id, {
        [`accepted-${po.blueLineId}`]: "1",
      });
      const nothing = await receive(po.id, {
        idempotencyKey: "screens-empty-1",
      });

      expect(noKey).toMatchObject({ ok: false, error: STALE_PAGE_MESSAGE });
      expect(nothing).toMatchObject({
        ok: false,
        error: "Enter a quantity for at least one line.",
      });
      expect(await prisma.purchaseOrderReceipt.count()).toBe(0);
    });

    it("records nothing while receiving is switched off, or without a staff member", async () => {
      const po = await purchaseOrder({ ordered: true });
      const fields = (key: string) => ({
        idempotencyKey: key,
        [`accepted-${po.blueLineId}`]: "4",
      });

      const off = await receive(po.id, fields("screens-off-1"), {
        sendBatch: shopify.send,
        isCapabilityEnabled: () => false,
      });
      const anonymous = await receive(
        po.id,
        fields("screens-anon-1"),
        stockOn(),
        { ...shopA(), inventoryActor: null },
      );

      expect(off).toMatchObject({ ok: false, error: RECEIVING_OFF_MESSAGE });
      expect(anonymous).toMatchObject({
        ok: false,
        error: STAFF_REQUIRED_MESSAGE,
      });
      expect(await prisma.purchaseOrderReceipt.count()).toBe(0);
      expect(shopify.requests).toHaveLength(0);
    });
  });

  describe("another shop", () => {
    it("cannot change, receive or reverse this shop's purchase order", async () => {
      const po = await purchaseOrder({ ordered: true });
      await receive(po.id, {
        idempotencyKey: "screens-tenant-1",
        [`accepted-${po.blueLineId}`]: "2",
      });
      const before = await current(po.id);
      const [receipt] = await prisma.purchaseOrderReceipt.findMany();

      const results = [
        await submit(
          po.id,
          { intent: "cancel", version: before.version },
          shopB(),
        ),
        await submit(
          po.id,
          {
            intent: "saveLine",
            version: before.version,
            lineId: po.blueLineId,
            quantity: "1",
          },
          shopB(),
        ),
        await submit(po.id, { intent: "duplicate" }, shopB()),
        await submit(
          po.id,
          { intent: "reverseReceipt", receiptId: receipt!.id },
          shopB(),
        ),
      ];
      const received = await receive(
        po.id,
        {
          idempotencyKey: "screens-tenant-2",
          [`accepted-${po.blueLineId}`]: "1",
        },
        stockOn(),
        shopB(),
      );

      for (const result of results) {
        expect(failed(result).error).toMatch(/was not found\.$/);
      }
      expect(received).toMatchObject({
        ok: false,
        error: "Purchase order was not found.",
      });
      expect(await current(po.id)).toEqual(before);
      expect(await prisma.purchaseOrderReceipt.count()).toBe(1);
      expect(await prisma.purchaseOrder.count()).toBe(1);
      expect(shopify.level(BLUE_ITEM, WAREHOUSE_NUMBER)).toBe(6);
    });

    it("cannot reverse a receipt through a different purchase order's page", async () => {
      const first = await purchaseOrder({ ordered: true });
      await receive(first.id, {
        idempotencyKey: "screens-other-po-1",
        [`accepted-${first.blueLineId}`]: "2",
      });
      const [receipt] = await prisma.purchaseOrderReceipt.findMany();
      const second = await createPurchaseOrderDraft(dbA, BUYER, {
        supplierId: (await prisma.supplier.findFirstOrThrow()).id,
        locationGid: WAREHOUSE,
      });

      const result = failed(
        await submit(second.id, {
          intent: "reverseReceipt",
          receiptId: receipt!.id,
        }),
      );

      expect(result.error).toBe("Receipt was not found.");
      expect(shopify.level(BLUE_ITEM, WAREHOUSE_NUMBER)).toBe(6);
    });

    it("is not offered this shop's products when searching", async () => {
      const mine = await searchVariants(dbA, "w-blue");
      const theirs = await searchVariants(dbB, "w-blue");

      expect(mine.variants.map((v) => v.variantGid)).toEqual([BLUE]);
      expect(theirs.variants.map((v) => v.variantGid)).toEqual([
        SHOP_B_VARIANT,
      ]);
    });
  });

  describe("product search", () => {
    it("finds products by name, SKU and barcode, exact codes first", async () => {
      const byName = await searchVariants(dbA, "widget");
      const byBarcode = await searchVariants(dbA, "0123456789012");
      const bySkuPart = await searchVariants(dbA, "W-");
      const limited = await searchVariants(dbA, "widget", 1);

      expect(byName.variants.map((v) => v.variantGid)).toEqual([BLUE, RED]);
      expect(byBarcode.variants.map((v) => v.variantGid)).toEqual([BLUE]);
      expect(bySkuPart.variants.map((v) => v.variantGid)).toEqual([BLUE, RED]);
      expect(limited).toMatchObject({ hasMore: true });
      expect(limited.variants).toHaveLength(1);
      expect(await searchVariants(dbA, "   ")).toEqual({
        variants: [],
        hasMore: false,
      });
      expect((await searchVariants(dbA, "100%")).variants).toEqual([]);
    });
  });

  describe("pages", () => {
    const loaderArgs = (path: string, params: Record<string, string> = {}) =>
      ({
        request: new Request(`https://app.example.test${path}`),
        params,
        context: {},
      }) as unknown as LoaderFunctionArgs;

    const actionArgs = (
      path: string,
      params: Record<string, string>,
      fields: Record<string, string>,
    ) =>
      ({
        request: new Request(`https://app.example.test${path}`, {
          method: "POST",
          body: new URLSearchParams(fields),
        }),
        params,
        context: {},
      }) as unknown as ActionFunctionArgs;

    it("lists purchase orders with totals, and says so when nothing matches", async () => {
      const po = await purchaseOrder({ ordered: true });
      const route = await import("../../../routes/app.purchase-orders");

      const data = await route.loader(loaderArgs("/app/purchase-orders"));
      const html = await renderRoute(route.default, data);
      const empty = await renderRoute(
        route.default,
        await route.loader(loaderArgs("/app/purchase-orders?q=nothing-here")),
      );

      expect(unsafeWirePaths(data)).toEqual([]);
      expect(html).toContain("PO-1001");
      expect(html).toContain(`href="/app/purchase-orders/${po.id}"`);
      expect(html).toContain("Acme Supply");
      expect(html).toContain("Warehouse");
      expect(html).toContain("$25.00");
      expect(html).toContain("0 of 10");
      expect(html).toContain("Open (1)");
      expect(empty).toContain("No open purchase orders match “nothing-here”.");
      expect(html + empty).not.toMatch(/NaN|\[object Object\]|undefined/);
    });

    it("shows an order with exact money, its history and the actions its status allows", async () => {
      const po = await purchaseOrder();
      succeeded(
        await submit(po.id, {
          intent: "saveCharges",
          version: po.version,
          chargeCount: "1",
          landedCostMethod: "COST",
          "charge-kind-0": "SHIPPING",
          "charge-amount-0": "10.05",
          "charge-allocate-0": "on",
        }),
      );
      const route = await import("../../../routes/app.purchase-orders_.$id");

      const data = await route.loader(
        loaderArgs(`/app/purchase-orders/${po.id}?find=widget`, { id: po.id }),
      );
      const html = await renderRoute(route.default, data);

      expect(unsafeWirePaths(data)).toEqual([]);
      expect(html).toContain("Purchase order PO-1001");
      expect(html).toContain("Widget - Blue");
      expect(html).toContain("$2.50");
      // 2.50 + 10.05 / 10 = 3.505: shown to four places, never as a float.
      expect(html).toContain("$3.505");
      expect(html).toContain("$35.05");
      expect(html).toContain("Draft created with 1 line.");
      expect(html).toContain("Charges changed.");
      expect(html).toContain("Mark as ordered");
      expect(html).toContain(
        `href="/app/purchase-orders/${po.id}?confirm=delete"`,
      );
      expect(html).not.toContain("Receive delivery");
      expect(html).toContain("Widget - Red");
      expect(html).toContain("On this order");
      expect(html).not.toMatch(/NaN|\[object Object\]|undefined/);
    });

    it("asks before cancelling, and shows a refused action in a critical banner", async () => {
      const po = await purchaseOrder();
      const route = await import("../../../routes/app.purchase-orders_.$id");
      const path = `/app/purchase-orders/${po.id}`;

      const confirming = await renderRoute(
        route.default,
        await route.loader(loaderArgs(`${path}?confirm=cancel`, { id: po.id })),
      );
      const refused = await route.action(
        actionArgs(
          path,
          { id: po.id },
          { intent: "close", version: po.version },
        ),
      );
      const withError = await renderRoute(
        route.default,
        await route.loader(loaderArgs(path, { id: po.id })),
        refused,
      );

      expect(confirming).toContain("Cancel this purchase order?");
      expect(confirming).toMatch(
        /<input type="hidden" name="intent" value="cancel"\/>/,
      );
      expect(withError).toMatch(
        /<s-banner tone="critical" heading="Purchase order not updated">.*Only partially or fully received purchase orders can be closed\..*<\/s-banner>/s,
      );
      expect(withError).not.toContain("Cancel this purchase order?");
    });

    it("answers 404 for a purchase order of another shop", async () => {
      const po = await purchaseOrder();
      requireAdminTenant.mockResolvedValue({ admin, db: dbB });
      const detail = await import("../../../routes/app.purchase-orders_.$id");
      const receiving =
        await import("../../../routes/app.purchase-orders_.$id_.receive");
      const args = loaderArgs(`/app/purchase-orders/${po.id}`, { id: po.id });

      for (const loader of [detail.loader, receiving.loader]) {
        const response = await loader(args).then(
          () => null,
          (thrown: unknown) => thrown,
        );
        expect(response).toBeInstanceOf(Response);
        expect((response as Response).status).toBe(404);
      }
    });

    it("receiving page lists what is still expected and refuses while receiving is off", async () => {
      const po = await purchaseOrder({ ordered: true });
      const route =
        await import("../../../routes/app.purchase-orders_.$id_.receive");
      const path = `/app/purchase-orders/${po.id}/receive`;

      const data = await route.loader(
        loaderArgs(`${path}?fill=all`, { id: po.id }),
      );
      const html = await renderRoute(route.default, data);
      const result = await route.action(
        actionArgs(
          path,
          { id: po.id },
          {
            idempotencyKey: data.idempotencyKey,
            [`accepted-${po.blueLineId}`]: "10",
          },
        ),
      );
      const refused = await renderRoute(route.default, data, result);

      expect(unsafeWirePaths(data)).toEqual([]);
      expect(html).toContain("Receive PO-1001");
      expect(html).toContain("Widget - Blue");
      expect(html).toContain("Barcode 0123456789012");
      expect(html).toContain(`name="accepted-${po.blueLineId}" value="10"`);
      expect(html).toContain("Receiving is turned off for this store");
      expect(result).toMatchObject({ ok: false, error: RECEIVING_OFF_MESSAGE });
      expect(refused).toMatch(
        /<s-banner tone="critical" heading="Nothing was received">/,
      );
      expect(await prisma.purchaseOrderReceipt.count()).toBe(0);
    });

    it("receiving page explains why a draft cannot be received", async () => {
      const po = await purchaseOrder();
      const route =
        await import("../../../routes/app.purchase-orders_.$id_.receive");

      const html = await renderRoute(
        route.default,
        await route.loader(
          loaderArgs(`/app/purchase-orders/${po.id}/receive`, { id: po.id }),
        ),
      );

      expect(html).toContain(
        "Send this purchase order or mark it as ordered before receiving it.",
      );
      expect(html).not.toContain('name="idempotencyKey"');
    });

    it("warehouse lists only orders with units to receive, each linked to its receiving page", async () => {
      const po = await purchaseOrder({ ordered: true });
      const { supplierId } = await loadPurchaseOrder(dbA, po.id);
      await createPurchaseOrderDraft(
        dbA,
        BUYER,
        {
          supplierId,
          locationGid: WAREHOUSE,
          lines: [
            { variantGid: RED, quantity: 3, unitCost: new Prisma.Decimal("1") },
          ],
        },
        { today: TODAY },
      );
      const route = await import("../../../routes/app.warehouse");
      const page = async (path: string) => {
        const data = await route.loader(loaderArgs(path));
        expect(unsafeWirePaths(data)).toEqual([]);
        return { data, html: await renderRoute(route.default, data) };
      };

      const { data, html } = await page("/app/warehouse");
      const atWarehouse = await page(
        `/app/warehouse?location=${encodeURIComponent(WAREHOUSE)}&q=acme`,
      );
      // Another shop's location is not a filter this shop can use.
      const foreignLocation = await page(
        "/app/warehouse?location=gid%3A%2F%2Fshopify%2FLocation%2F411",
      );
      const noMatch = await page("/app/warehouse?q=nothing-here");

      expect(data.orders.map((order) => order.id)).toEqual([po.id]);
      expect(html).toContain("PO-1001");
      expect(html).not.toContain("PO-1002");
      expect(html).toContain(`href="/app/purchase-orders/${po.id}/receive"`);
      expect(html).toContain("10 units (0 of 10 received)");
      expect(html).toContain("Warehouse");
      expect(html).toContain("Receiving is turned off for this store");
      expect(atWarehouse.data.location).toBe(WAREHOUSE);
      expect(atWarehouse.data.orders).toHaveLength(1);
      expect(foreignLocation.data.location).toBe("");
      expect(foreignLocation.data.orders).toHaveLength(1);
      expect(noMatch.html).toContain("No incoming purchase orders match.");
      expect(html + noMatch.html).not.toMatch(/NaN|\[object Object\]|undefined/);

      requireAdminTenant.mockResolvedValue({ admin, db: dbB });
      const otherShop = await page("/app/warehouse");
      expect(otherShop.data.orders).toEqual([]);
      expect(otherShop.html).toContain(
        "Nothing to receive. Purchase orders appear here once they are sent to the supplier.",
      );
    });

    it("warehouse drops an order once everything on it is received", async () => {
      const po = await purchaseOrder({ ordered: true });
      const received = await receive(po.id, {
        idempotencyKey: "warehouse-full-receipt",
        [`accepted-${po.blueLineId}`]: "10",
      });
      const route = await import("../../../routes/app.warehouse");

      const data = await route.loader(loaderArgs("/app/warehouse"));

      expect(received).toMatchObject({ ok: true });
      expect((await current(po.id)).status).toBe("RECEIVED");
      expect(data.orders).toEqual([]);
    });

    it("creates a draft from the new-order form and refuses a malformed one", async () => {
      const supplier = await createSupplier(
        dbA,
        BUYER,
        supplierProfile("Acme Supply"),
      );
      const route = await import("../../../routes/app.purchase-orders_.new");
      const path = "/app/purchase-orders/new";

      const page = await renderRoute(
        route.default,
        await route.loader(loaderArgs(path)),
      );
      const fields = {
        supplierId: supplier.id,
        locationGid: WAREHOUSE,
        creationKey: "screens-new-1",
      };
      const invalid = await route.action(
        actionArgs(path, {}, { ...fields, exchangeRate: "-1" }),
      );
      const created = await route.action(actionArgs(path, {}, fields));
      const again = await route.action(actionArgs(path, {}, fields));

      expect(page).toContain("Acme Supply (USD)");
      expect(page).toContain("Warehouse");
      expect(invalid).toMatchObject({
        ok: false,
        fieldErrors: { exchangeRate: expect.any(String) },
      });
      expect(created).toBeInstanceOf(Response);
      expect((again as Response).headers.get("Location")).toBe(
        (created as Response).headers.get("Location"),
      );
      expect(await prisma.purchaseOrder.count()).toBe(1);
    });
  });
});
