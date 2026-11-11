/**
 * Purchasing services against PostgreSQL through the tenant database wrapper:
 * supplier terms, purchase-order creation, numbering, charges, lifecycle,
 * planning figures and cross-shop denial.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";
import { issueTenantAuthority } from "../../authority.server";
import { createTenantDb, type TenantDb } from "../../tenant-db.server";
import type { PurchasingActor } from "../../../services/purchasing/actor.server";
import { PurchasingError } from "../../../services/purchasing/errors";
import { listPurchasingEvents } from "../../../services/purchasing/events.server";
import {
  getIncomingQuantities,
  getSupplierTerms,
  listSupplierVariantGids,
} from "../../../services/purchasing/planning.server";
import { listPurchaseOrders } from "../../../services/purchasing/purchase-order-list.server";
import {
  loadPurchaseOrder,
  totalsFor,
} from "../../../services/purchasing/purchase-order-records.server";
import {
  addPurchaseOrderLines,
  createPurchaseOrderDraft,
  deletePurchaseOrderDraft,
  duplicatePurchaseOrder,
  removePurchaseOrderLine,
  replacePurchaseOrderCharges,
  setLineCancelledQuantity,
  transitionPurchaseOrder,
  updatePurchaseOrderHeader,
  updatePurchaseOrderLine,
  type HeaderInput,
} from "../../../services/purchasing/purchase-orders.server";
import {
  addPriceTier,
  createSupplier,
  saveSupplierProduct,
  setSupplierArchived,
  type SupplierProductInput,
  type SupplierProfileInput,
} from "../../../services/purchasing/suppliers.server";
import {
  completeInventoryItemData,
  completeLocationData,
  completeProductData,
  completeVariantData,
} from "../../../../scripts/tenant-enforcement/tests/pr5-f3-test-helpers";
import {
  requireRuntimeUrl,
  resetAndEnforce,
  seedTwoShops,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
} from "./helpers";

const requestTenant = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("../../require-admin-tenant.server", () => ({
  requireAdminTenant: async () => ({ db: requestTenant.db }),
}));

const STAFF: PurchasingActor = { type: "STAFF", id: "staff-1" };
const TODAY = "2026-11-10";

const WIDGET = "gid://shopify/ProductVariant/201";
const GADGET = "gid://shopify/ProductVariant/202";
const UNCOSTED = "gid://shopify/ProductVariant/203";
const UNKNOWN_VARIANT = "gid://shopify/ProductVariant/999";
const WAREHOUSE = "gid://shopify/Location/401";
const STORE = "gid://shopify/Location/402";
const CLOSED_LOCATION = "gid://shopify/Location/403";
const SHOP_B_LOCATION = "gid://shopify/Location/411";

const decimal = (value: string) => new Prisma.Decimal(value);

function supplierProfile(overrides: Partial<SupplierProfileInput> = {}): SupplierProfileInput {
  return {
    name: "Acme Supply",
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
    paymentTerms: "Net 30",
    shippingTerms: "FOB",
    defaultTaxRatePercent: null,
    defaultLeadTimeDays: 7,
    defaultRestockDays: null,
    minimumOrderValue: null,
    vendorNotes: null,
    ...overrides,
  };
}

function productTerms(overrides: Partial<SupplierProductInput> = {}): SupplierProductInput {
  return {
    variantGid: WIDGET,
    vendorSku: "ACME-W1",
    moq: 1,
    packSize: 1,
    supplierCost: decimal("3.50"),
    leadTimeDaysOverride: null,
    orderUnit: null,
    isPreferred: false,
    ...overrides,
  };
}

function headerInput(overrides: Partial<HeaderInput> = {}): HeaderInput {
  return {
    supplierOrderNumber: null,
    invoiceNumber: null,
    issuedOn: null,
    expectedOn: null,
    shipOn: null,
    cancelOn: null,
    invoiceOn: null,
    paymentDueOn: null,
    paymentTerms: null,
    shippingTerms: null,
    shipToAddress: null,
    billToAddress: null,
    buyerName: null,
    notes: null,
    supplierNotes: null,
    ...overrides,
  };
}

async function expectPurchasingError(
  promise: Promise<unknown>,
  code: PurchasingError["code"],
  message?: string | RegExp,
): Promise<void> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(PurchasingError);
  expect((error as PurchasingError).code).toBe(code);
  if (message !== undefined) expect((error as PurchasingError).message).toMatch(message);
}

describe("purchasing ledger", () => {
  let migrationPrisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;
  let dbA: TenantDb;
  let dbB: TenantDb;

  beforeAll(async () => {
    const ctx = await resetAndEnforce();
    migrationPrisma = ctx.migrationPrisma;
    await ctx.runtimePrisma.$disconnect();
    const shops = await seedTwoShops(migrationPrisma);
    shopAId = shops.shopA.id;
    shopBId = shops.shopB.id;

    await migrationPrisma.shopifyProductFact.create({
      data: { ...completeProductData({ id: "101", shopId: shopAId, title: "Widget" }), vendor: "Acme" },
    });
    await migrationPrisma.shopifyVariantFact.createMany({
      data: [
        {
          ...completeVariantData({ id: "201", shopId: shopAId, productId: "101" }),
          title: "Blue",
          sku: "W-BLUE",
          barcode: "0123456789012",
          priceAmount: "19.990000",
        },
        { ...completeVariantData({ id: "202", shopId: shopAId, productId: "101" }), title: "Red" },
        {
          ...completeVariantData({ id: "203", shopId: shopAId, productId: "101" }),
          title: "Default Title",
        },
      ],
    });
    await migrationPrisma.shopifyInventoryItemFact.createMany({
      data: [
        {
          ...completeInventoryItemData({ id: "301", shopId: shopAId, variantId: "201" }),
          weightValue: "0.5",
          weightUnit: "KILOGRAMS",
        },
        {
          ...completeInventoryItemData({ id: "302", shopId: shopAId, variantId: "202" }),
          unitCostAmount: "4.000000",
          unitCostCurrencyCode: "USD",
          unitCostAccess: "PRESENT",
        },
        completeInventoryItemData({ id: "303", shopId: shopAId, variantId: "203" }),
      ],
    });
    await migrationPrisma.shopifyLocationFact.createMany({
      data: [
        {
          ...completeLocationData({ id: "401", shopId: shopAId }),
          name: "Warehouse",
          address1: "1 Dock Road",
          city: "Buffalo",
          provinceCode: "NY",
          zip: "14201",
          countryCode: "US",
        },
        { ...completeLocationData({ id: "402", shopId: shopAId, requestGen: 9n }), name: "Store" },
        {
          ...completeLocationData({ id: "403", shopId: shopAId, requestGen: 11n }),
          name: "Old stockroom",
          isActive: false,
        },
        { ...completeLocationData({ id: "411", shopId: shopBId, requestGen: 13n }), name: "Shop B" },
      ],
    });

    requireRuntimeUrl();
    dbA = createTenantDb(
      issueTenantAuthority({
        shopId: shopAId,
        myshopifyDomain: SHOP_A_DOMAIN,
        source: "verified_admin_request",
      }),
    );
    dbB = createTenantDb(
      issueTenantAuthority({
        shopId: shopBId,
        myshopifyDomain: SHOP_B_DOMAIN,
        source: "verified_admin_request",
      }),
    );
  }, 180_000);

  beforeEach(async () => {
    await migrationPrisma.$transaction([
      migrationPrisma.purchasingEvent.deleteMany(),
      migrationPrisma.purchaseOrder.deleteMany(),
      migrationPrisma.supplier.deleteMany(),
    ]);
  });

  afterAll(async () => {
    await migrationPrisma?.$disconnect();
  });

  async function acme(overrides: Partial<SupplierProfileInput> = {}): Promise<string> {
    return (await createSupplier(dbA, STAFF, supplierProfile(overrides))).id;
  }

  async function shopBSupplier(): Promise<string> {
    return (await createSupplier(dbB, STAFF, supplierProfile({ name: "Shop B Supply" }))).id;
  }

  async function draft(
    supplierId: string,
    lines: Array<{ variantGid: string; quantity: number; unitCost?: Prisma.Decimal }>,
    extra: { creationKey?: string; source?: "manual" | "replenishment" } = {},
  ) {
    return createPurchaseOrderDraft(
      dbA,
      STAFF,
      { supplierId, locationGid: WAREHOUSE, lines, ...extra },
      { today: TODAY },
    );
  }

  async function versionOf(purchaseOrderId: string): Promise<number> {
    return (await loadPurchaseOrder(dbA, purchaseOrderId)).version;
  }

  async function receiveUnits(purchaseOrderId: string, variantGid: string, units: number, status: "PARTIAL" | "RECEIVED") {
    await migrationPrisma.pOLineItem.updateMany({
      where: { purchaseOrderId, shopifyVariantId: variantGid },
      data: { receivedQty: units },
    });
    await migrationPrisma.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status },
    });
  }

  describe("supplier products", () => {
    it("saves terms for the same supplier and product twice (issue #75)", async () => {
      const supplierId = await acme();

      const first = await saveSupplierProduct(dbA, STAFF, supplierId, productTerms());
      const second = await saveSupplierProduct(
        dbA,
        STAFF,
        supplierId,
        productTerms({ vendorSku: "ACME-W2", moq: 12, packSize: 6, supplierCost: decimal("3.25") }),
      );

      expect(first.created).toBe(true);
      expect(second).toEqual({ id: first.id, created: false });
      const rows = await migrationPrisma.supplierSkuMapping.findMany({ where: { supplierId } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        shopId: shopAId,
        shopifyVariantId: WIDGET,
        vendorSku: "ACME-W2",
        moq: 12,
        packSize: 6,
      });
      expect(rows[0]!.supplierCost!.toFixed(4)).toBe("3.2500");
    });

    it("saves terms twice from the supplier page (issue #75)", async () => {
      const { action } = await import("../../../routes/app.suppliers_.$id");
      const supplierId = await acme();
      requestTenant.db = dbA;
      const submit = (fields: Record<string, string>) =>
        action({
          request: new Request(`https://app.test/app/suppliers/${supplierId}`, {
            method: "POST",
            body: new URLSearchParams({ intent: "addMapping", variantId: WIDGET, ...fields }),
          }),
          params: { id: supplierId },
          context: {},
        } as unknown as Parameters<typeof action>[0]);

      await submit({ vendorSku: "ACME-W1", moq: "1", packSize: "1" });
      await submit({ vendorSku: "ACME-W2", moq: "12", packSize: "6" });

      const rows = await migrationPrisma.supplierSkuMapping.findMany({ where: { supplierId } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ shopId: shopAId, vendorSku: "ACME-W2", moq: 12, packSize: 6 });
    });

    it("never touches another shop's terms for the same product", async () => {
      const supplierB = await shopBSupplier();
      await migrationPrisma.supplierSkuMapping.create({
        data: {
          shopId: shopBId,
          supplierId: supplierB,
          shopifyVariantId: WIDGET,
          vendorSku: "B-ONLY",
          isPreferred: true,
        },
      });
      const supplierA = await acme();

      await saveSupplierProduct(dbA, STAFF, supplierA, productTerms({ isPreferred: true }));
      await expectPurchasingError(
        saveSupplierProduct(dbA, STAFF, supplierB, productTerms({ vendorSku: "HIJACK" })),
        "not_found",
      );

      const shopBRows = await migrationPrisma.supplierSkuMapping.findMany({
        where: { shopId: shopBId },
      });
      expect(shopBRows).toHaveLength(1);
      expect(shopBRows[0]).toMatchObject({ vendorSku: "B-ONLY", isPreferred: true });
    });

    it("keeps one preferred supplier per product", async () => {
      const first = await acme();
      const second = await acme({ name: "Bolt Brothers" });
      await saveSupplierProduct(dbA, STAFF, first, productTerms({ isPreferred: true }));
      await saveSupplierProduct(dbA, STAFF, second, productTerms({ isPreferred: true }));

      const preferred = await migrationPrisma.supplierSkuMapping.findMany({
        where: { shopifyVariantId: WIDGET, isPreferred: true },
      });
      expect(preferred.map((row) => row.supplierId)).toEqual([second]);
    });

    it("rejects a product Shopify does not have, and quantities below one", async () => {
      const supplierId = await acme();
      await expectPurchasingError(
        saveSupplierProduct(dbA, STAFF, supplierId, productTerms({ variantGid: UNKNOWN_VARIANT })),
        "invalid_input",
        "no longer available",
      );
      await expectPurchasingError(
        saveSupplierProduct(dbA, STAFF, supplierId, productTerms({ packSize: 0 })),
        "invalid_input",
        "Pack size",
      );
      await expectPurchasingError(
        saveSupplierProduct(dbA, STAFF, supplierId, productTerms({ moq: Number.NaN })),
        "invalid_input",
      );
      await expectPurchasingError(
        saveSupplierProduct(dbA, STAFF, supplierId, productTerms({ supplierCost: decimal("-1") })),
        "invalid_input",
      );
      expect(await migrationPrisma.supplierSkuMapping.count()).toBe(0);
    });

    it("rejects overlapping volume pricing", async () => {
      const supplierId = await acme();
      await saveSupplierProduct(dbA, STAFF, supplierId, productTerms());
      await addPriceTier(dbA, STAFF, supplierId, {
        variantGid: WIDGET,
        minQty: 10,
        maxQty: 49,
        unitCost: decimal("3.00"),
      });

      await expectPurchasingError(
        addPriceTier(dbA, STAFF, supplierId, {
          variantGid: WIDGET,
          minQty: 49,
          maxQty: null,
          unitCost: decimal("2.75"),
        }),
        "invalid_input",
      );
      await addPriceTier(dbA, STAFF, supplierId, {
        variantGid: WIDGET,
        minQty: 50,
        maxQty: null,
        unitCost: decimal("2.75"),
      });
      expect(await migrationPrisma.volumePriceTier.count({ where: { supplierId } })).toBe(2);
    });
  });

  describe("creating a purchase order", () => {
    it("numbers purchase orders per shop, starting at PO-1001", async () => {
      const supplierId = await acme();
      const first = await draft(supplierId, []);
      const second = await draft(supplierId, []);
      const shopB = await createPurchaseOrderDraft(dbB, STAFF, {
        supplierId: await shopBSupplier(),
        locationGid: SHOP_B_LOCATION,
      });

      expect([first.poNumber, second.poNumber, shopB.poNumber]).toEqual([
        "PO-1001",
        "PO-1002",
        "PO-1001",
      ]);
    });

    it("gives purchase orders created at the same moment different numbers", async () => {
      const supplierId = await acme();
      const created = await Promise.all(
        Array.from({ length: 8 }, () => draft(supplierId, [{ variantGid: WIDGET, quantity: 1 }])),
      );

      expect(created.map((po) => po.poNumber).sort()).toEqual(
        Array.from({ length: 8 }, (_, index) => `PO-${1001 + index}`),
      );
      expect(await migrationPrisma.purchaseOrder.count()).toBe(8);
    });

    it("returns the existing purchase order when the creation key repeats", async () => {
      const supplierId = await acme();
      const lines = [{ variantGid: WIDGET, quantity: 3 }];
      const first = await draft(supplierId, lines, { creationKey: "replenishment:run-1:acme" });
      const again = await draft(supplierId, lines, { creationKey: "replenishment:run-1:acme" });
      const racing = await Promise.all([
        draft(supplierId, lines, { creationKey: "replenishment:run-2:acme" }),
        draft(supplierId, lines, { creationKey: "replenishment:run-2:acme" }),
      ]);

      expect(again).toMatchObject({ id: first.id, created: false, lineCount: 1 });
      expect(racing[0]!.id).toBe(racing[1]!.id);
      expect(racing.filter((po) => po.created)).toHaveLength(1);
      expect(await migrationPrisma.purchaseOrder.count()).toBe(2);
    });

    it("prices lines from the volume tier, then supplier cost, then Shopify cost", async () => {
      const supplierId = await acme();
      await saveSupplierProduct(dbA, STAFF, supplierId, productTerms({ packSize: 6 }));
      await addPriceTier(dbA, STAFF, supplierId, {
        variantGid: WIDGET,
        minQty: 10,
        maxQty: null,
        unitCost: decimal("3.00"),
      });

      const small = await draft(supplierId, [
        { variantGid: WIDGET, quantity: 5 },
        { variantGid: GADGET, quantity: 2 },
        { variantGid: UNCOSTED, quantity: 1 },
      ]);
      const bulk = await draft(supplierId, [{ variantGid: WIDGET, quantity: 12 }]);
      const manual = await draft(supplierId, [
        { variantGid: WIDGET, quantity: 12, unitCost: decimal("2.10") },
      ]);

      const smallLines = (await loadPurchaseOrder(dbA, small.id)).lineItems;
      expect(smallLines.map((line) => [line.shopifyVariantId, line.unitCost.toFixed(4)])).toEqual([
        [WIDGET, "3.5000"],
        [GADGET, "4.0000"],
        [UNCOSTED, "0.0000"],
      ]);
      expect(small.missingCostVariantGids).toEqual([UNCOSTED]);
      expect((await loadPurchaseOrder(dbA, bulk.id)).lineItems[0]!.unitCost.toFixed(4)).toBe("3.0000");
      const manualLine = (await loadPurchaseOrder(dbA, manual.id)).lineItems[0]!;
      expect(manualLine.unitCost.toFixed(4)).toBe("2.1000");
      expect(manualLine.manualCostOverride).toBe(true);
      expect(manual.missingCostVariantGids).toEqual([]);
    });

    it("copies supplier terms, the destination and product details onto the order", async () => {
      const supplierId = await acme({ defaultTaxRatePercent: decimal("8.25") });
      await saveSupplierProduct(dbA, STAFF, supplierId, productTerms({ packSize: 6, orderUnit: "case" }));

      const { id } = await draft(supplierId, [{ variantGid: WIDGET, quantity: 6 }]);
      const po = await loadPurchaseOrder(dbA, id);

      expect(po).toMatchObject({
        status: "DRAFT",
        version: 1,
        locationId: WAREHOUSE,
        currency: "USD",
        paymentTerms: "Net 30",
        shippingTerms: "FOB",
        shipToAddress: "Warehouse\n1 Dock Road, Buffalo, NY 14201, US",
        createdByUserId: "staff-1",
      });
      expect(po.expectedOn?.toISOString().slice(0, 10)).toBe("2026-11-17");
      expect(po.lineItems[0]).toMatchObject({
        productTitle: "Widget",
        variantTitle: "Blue",
        sku: "W-BLUE",
        barcode: "0123456789012",
        inventoryItemGid: "gid://shopify/InventoryItem/301",
        vendorSku: "ACME-W1",
        packSize: 6,
        orderUnit: "case",
      });
      expect(po.lineItems[0]!.weight!.toFixed(4)).toBe("500.0000");
      expect(po.lineItems[0]!.retailPrice!.toFixed(2)).toBe("19.99");
      expect(po.lineItems[0]!.taxRatePercent!.toFixed(2)).toBe("8.25");
      const events = await listPurchasingEvents(dbA, { subjectType: "PURCHASE_ORDER", subjectId: id });
      expect(events.map((event) => event.action)).toEqual(["purchase_order.created"]);
      expect(events[0]).toMatchObject({ actorType: "STAFF", actorId: "staff-1" });
    });

    it("refuses quantities and costs that are not valid numbers", async () => {
      const supplierId = await acme();
      for (const quantity of [0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 1_000_001]) {
        await expectPurchasingError(
          draft(supplierId, [{ variantGid: WIDGET, quantity }]),
          "invalid_input",
          "Quantity",
        );
      }
      for (const unitCost of ["-0.01", "NaN", "Infinity", "1.00001", "1000000"]) {
        await expectPurchasingError(
          draft(supplierId, [{ variantGid: WIDGET, quantity: 1, unitCost: decimal(unitCost) }]),
          "invalid_input",
          "Unit cost",
        );
      }
      await expectPurchasingError(
        draft(supplierId, [{ variantGid: "gid://shopify/Product/101", quantity: 1 }]),
        "invalid_input",
      );
      expect(await migrationPrisma.purchaseOrder.count()).toBe(0);
    });

    it("refuses suppliers, locations and products the shop cannot order with", async () => {
      const supplierId = await acme();
      const archived = await acme({ name: "Gone Ltd" });
      await setSupplierArchived(dbA, STAFF, archived, true);
      const create = (supplier: string, locationGid: string, variantGid = WIDGET) =>
        createPurchaseOrderDraft(dbA, STAFF, {
          supplierId: supplier,
          locationGid,
          lines: [{ variantGid, quantity: 1 }],
        });

      await expectPurchasingError(create(await shopBSupplier(), WAREHOUSE), "not_found");
      await expectPurchasingError(create(archived, WAREHOUSE), "invalid_state", "archived");
      await expectPurchasingError(create(supplierId, SHOP_B_LOCATION), "invalid_input", "not part of this store");
      await expectPurchasingError(create(supplierId, CLOSED_LOCATION), "invalid_input", "deactivated");
      await expectPurchasingError(create(supplierId, "401"), "invalid_input", "destination");
      await expectPurchasingError(create(supplierId, WAREHOUSE, UNKNOWN_VARIANT), "invalid_input", "no longer available");
      expect(await migrationPrisma.purchaseOrder.count()).toBe(0);
    });
  });

  describe("charges and landed cost", () => {
    const charges = {
      landedCostMethod: "COST" as const,
      charges: [
        { kind: "SHIPPING" as const, description: "Freight", amount: decimal("30.00"), allocate: true },
        { kind: "DUTY" as const, description: null, amount: decimal("10.00"), allocate: true },
        { kind: "FEE" as const, description: "Bank fee", amount: decimal("5.00"), allocate: false },
      ],
    };
    const lines = [
      { variantGid: WIDGET, quantity: 10, unitCost: decimal("3.00") },
      { variantGid: GADGET, quantity: 10, unitCost: decimal("1.00") },
    ];

    async function allocations(purchaseOrderId: string) {
      const po = await loadPurchaseOrder(dbA, purchaseOrderId);
      return po.lineItems.map((line) => [
        line.shopifyVariantId,
        line.allocatedChargesTotal?.toFixed(2) ?? null,
        line.allocatedLandedCost?.toFixed(4) ?? null,
      ]);
    }

    it("allocates freight and duty the same way however the order was created", async () => {
      const supplierId = await acme();
      const manual = await draft(supplierId, lines, { source: "manual" });
      const suggested = await draft(supplierId, lines, {
        source: "replenishment",
        creationKey: "replenishment:run-7:acme",
      });
      for (const po of [manual, suggested]) {
        await replacePurchaseOrderCharges(dbA, STAFF, po.id, 1, charges);
      }
      const copy = await duplicatePurchaseOrder(dbA, STAFF, suggested.id);

      const expected = [
        [WIDGET, "30.00", "3.0000"],
        [GADGET, "10.00", "1.0000"],
      ];
      expect(await allocations(manual.id)).toEqual(expected);
      expect(await allocations(suggested.id)).toEqual(expected);
      expect(await allocations(copy.id)).toEqual(expected);
      const totals = totalsFor(await loadPurchaseOrder(dbA, copy.id));
      expect(totals.merchandiseAmount.toFixed(2)).toBe("40.00");
      expect(totals.chargesAmount.toFixed(2)).toBe("45.00");
      expect(totals.totalAmount.toFixed(2)).toBe("85.00");
    });

    it("reads legacy freight and customs amounts as charges and converts them on edit", async () => {
      const supplierId = await acme();
      const { id } = await draft(supplierId, lines);
      await migrationPrisma.purchaseOrder.update({
        where: { id },
        data: { freightCost: "30.00", customsCost: "10.00" },
      });

      const legacyTotals = totalsFor(await loadPurchaseOrder(dbA, id));
      expect(legacyTotals.chargesAmount.toFixed(2)).toBe("40.00");
      expect(legacyTotals.lines.map((line) => line.allocatedCharges.toFixed(2))).toEqual(["30.00", "10.00"]);

      await replacePurchaseOrderCharges(dbA, STAFF, id, 1, {
        landedCostMethod: "QUANTITY",
        charges: charges.charges.slice(0, 2),
      });
      const po = await loadPurchaseOrder(dbA, id);
      expect(po.freightCost).toBeNull();
      expect(po.customsCost).toBeNull();
      expect(po.charges.map((charge) => [charge.kind, charge.amount.toFixed(2)])).toEqual([
        ["SHIPPING", "30.00"],
        ["DUTY", "10.00"],
      ]);
      expect(await allocations(id)).toEqual([
        [WIDGET, "20.00", "2.0000"],
        [GADGET, "20.00", "2.0000"],
      ]);
      expect(po.version).toBe(2);
    });

    it("refuses invalid charge amounts and edits after receiving has started", async () => {
      const supplierId = await acme();
      const { id } = await draft(supplierId, lines);
      for (const amount of ["-1", "NaN", "0.001", "10000000000"]) {
        await expectPurchasingError(
          replacePurchaseOrderCharges(dbA, STAFF, id, 1, {
            landedCostMethod: "COST",
            charges: [{ kind: "SHIPPING", description: null, amount: decimal(amount), allocate: true }],
          }),
          "invalid_input",
        );
      }
      await transitionPurchaseOrder(dbA, STAFF, id, 1, "markOrdered", { today: TODAY });
      await receiveUnits(id, WIDGET, 4, "PARTIAL");

      await expectPurchasingError(
        replacePurchaseOrderCharges(dbA, STAFF, id, await versionOf(id), charges),
        "invalid_state",
        "fixed once stock has been received",
      );
      expect(await migrationPrisma.purchaseOrderCharge.count()).toBe(0);
    });
  });

  describe("lifecycle", () => {
    async function orderedPo(): Promise<string> {
      const { id } = await draft(await acme(), [{ variantGid: WIDGET, quantity: 10 }]);
      await transitionPurchaseOrder(dbA, STAFF, id, 1, "markOrdered", { today: TODAY });
      return id;
    }

    it("records when an order is sent and at which version", async () => {
      const { id } = await draft(await acme(), [{ variantGid: WIDGET, quantity: 10 }]);
      await transitionPurchaseOrder(dbA, STAFF, id, 1, "markSent", { today: TODAY });

      const po = await loadPurchaseOrder(dbA, id);
      expect(po).toMatchObject({ status: "SENT", sentVersion: 1 });
      expect(po.sentAt).toBeInstanceOf(Date);
      expect(po.issuedOn?.toISOString().slice(0, 10)).toBe(TODAY);
    });

    it("does not send or order a purchase order with no products", async () => {
      const { id } = await draft(await acme(), []);
      await expectPurchasingError(
        transitionPurchaseOrder(dbA, STAFF, id, 1, "markOrdered"),
        "invalid_state",
        "Add at least one product",
      );
      expect((await loadPurchaseOrder(dbA, id)).status).toBe("DRAFT");
    });

    it("does not send a draft whose destination has been deactivated", async () => {
      const { id } = await createPurchaseOrderDraft(dbA, STAFF, {
        supplierId: await acme(),
        locationGid: STORE,
        lines: [{ variantGid: WIDGET, quantity: 1 }],
      });
      await migrationPrisma.shopifyLocationFact.updateMany({
        where: { shopId: shopAId, shopifyGid: STORE },
        data: { isActive: false },
      });
      try {
        await expectPurchasingError(
          transitionPurchaseOrder(dbA, STAFF, id, 1, "markSent"),
          "invalid_input",
          "Store is deactivated in Shopify",
        );
        expect((await loadPurchaseOrder(dbA, id)).status).toBe("DRAFT");
      } finally {
        await migrationPrisma.shopifyLocationFact.updateMany({
          where: { shopId: shopAId, shopifyGid: STORE },
          data: { isActive: true },
        });
      }
    });

    it("does not reopen a cancelled purchase order", async () => {
      const id = await orderedPo();
      await transitionPurchaseOrder(dbA, STAFF, id, await versionOf(id), "cancel");

      for (const action of ["markOrdered", "markSent", "close"] as const) {
        await expectPurchasingError(
          transitionPurchaseOrder(dbA, STAFF, id, await versionOf(id), action),
          "invalid_state",
        );
      }
      const po = await loadPurchaseOrder(dbA, id);
      expect(po.status).toBe("CANCELLED");
      expect(po.cancelledAt).toBeInstanceOf(Date);
    });

    it("does not cancel a purchase order that has received stock", async () => {
      const partial = await orderedPo();
      await receiveUnits(partial, WIDGET, 4, "PARTIAL");
      const received = (await draft(await acme({ name: "Second" }), [{ variantGid: WIDGET, quantity: 2 }])).id;
      await receiveUnits(received, WIDGET, 2, "RECEIVED");

      for (const id of [partial, received]) {
        await expectPurchasingError(
          transitionPurchaseOrder(dbA, STAFF, id, await versionOf(id), "cancel"),
          "invalid_state",
          "Close it instead",
        );
      }
      expect((await loadPurchaseOrder(dbA, partial)).status).toBe("PARTIAL");
      expect((await loadPurchaseOrder(dbA, received)).status).toBe("RECEIVED");

      await transitionPurchaseOrder(dbA, STAFF, partial, await versionOf(partial), "close");
      const closed = await loadPurchaseOrder(dbA, partial);
      expect(closed.status).toBe("CLOSED");
      const [closeEvent] = await listPurchasingEvents(dbA, {
        subjectType: "PURCHASE_ORDER",
        subjectId: partial,
      });
      expect(closeEvent).toMatchObject({
        action: "purchase_order.closed",
        details: { fromStatus: "PARTIAL", toStatus: "CLOSED", unreceivedUnits: 6 },
      });
    });

    it("rejects a change made against an older version", async () => {
      const { id } = await draft(await acme(), [{ variantGid: WIDGET, quantity: 10 }]);
      await updatePurchaseOrderHeader(dbA, STAFF, id, 1, headerInput({ supplierNotes: "Deliver to dock 2" }));
      expect(await versionOf(id)).toBe(2);

      await expectPurchasingError(
        transitionPurchaseOrder(dbA, STAFF, id, 1, "markOrdered"),
        "conflict",
        "changed by someone else",
      );
      expect((await loadPurchaseOrder(dbA, id)).status).toBe("DRAFT");
    });

    it("deletes drafts only, and keeps their history", async () => {
      const ordered = await orderedPo();
      await expectPurchasingError(
        deletePurchaseOrderDraft(dbA, STAFF, ordered, await versionOf(ordered)),
        "invalid_state",
        "Only draft purchase orders can be deleted",
      );

      const { id } = await draft(await acme({ name: "Second" }), [{ variantGid: WIDGET, quantity: 1 }]);
      await deletePurchaseOrderDraft(dbA, STAFF, id, 1);

      expect(await migrationPrisma.purchaseOrder.count({ where: { id } })).toBe(0);
      expect(await migrationPrisma.pOLineItem.count({ where: { purchaseOrderId: id } })).toBe(0);
      const events = await listPurchasingEvents(dbA, { subjectType: "PURCHASE_ORDER", subjectId: id });
      expect(events.map((event) => event.action)).toEqual([
        "purchase_order.deleted",
        "purchase_order.created",
      ]);
    });

    it("makes an archived purchase order read-only until it is unarchived", async () => {
      const id = await orderedPo();
      await transitionPurchaseOrder(dbA, STAFF, id, await versionOf(id), "cancel");
      await transitionPurchaseOrder(dbA, STAFF, id, await versionOf(id), "archive");

      await expectPurchasingError(
        updatePurchaseOrderHeader(dbA, STAFF, id, await versionOf(id), headerInput({ notes: "late note" })),
        "invalid_state",
      );
      await transitionPurchaseOrder(dbA, STAFF, id, await versionOf(id), "unarchive");
      expect((await loadPurchaseOrder(dbA, id)).archivedAt).toBeNull();
    });

    it("fixes the destination once stock has been received", async () => {
      const id = await orderedPo();
      await updatePurchaseOrderHeader(dbA, STAFF, id, await versionOf(id), headerInput({ locationGid: STORE }));
      expect((await loadPurchaseOrder(dbA, id)).locationId).toBe(STORE);
      await expectPurchasingError(
        updatePurchaseOrderHeader(dbA, STAFF, id, await versionOf(id), headerInput({ locationGid: SHOP_B_LOCATION })),
        "invalid_input",
        "not part of this store",
      );

      await receiveUnits(id, WIDGET, 1, "PARTIAL");
      await expectPurchasingError(
        updatePurchaseOrderHeader(dbA, STAFF, id, await versionOf(id), headerInput({ locationGid: WAREHOUSE })),
        "invalid_state",
        "fixed once stock has been received",
      );
      expect((await loadPurchaseOrder(dbA, id)).locationId).toBe(STORE);
    });
  });

  describe("lines", () => {
    it("adds to the existing line and reprices it by volume", async () => {
      const supplierId = await acme();
      await saveSupplierProduct(dbA, STAFF, supplierId, productTerms());
      await addPriceTier(dbA, STAFF, supplierId, {
        variantGid: WIDGET,
        minQty: 10,
        maxQty: null,
        unitCost: decimal("3.00"),
      });
      const { id } = await draft(supplierId, [{ variantGid: WIDGET, quantity: 6 }]);

      const result = await addPurchaseOrderLines(dbA, STAFF, id, 1, [
        { variantGid: WIDGET, quantity: 6 },
        { variantGid: GADGET, quantity: 1 },
      ]);

      expect(result).toEqual({ added: 1, merged: 1, missingCostVariantGids: [] });
      const po = await loadPurchaseOrder(dbA, id);
      expect(po.version).toBe(2);
      expect(po.lineItems.map((line) => [line.shopifyVariantId, line.orderedQty, line.unitCost.toFixed(4)])).toEqual([
        [WIDGET, 12, "3.0000"],
        [GADGET, 1, "4.0000"],
      ]);
    });

    it("keeps quantity at or above what was received or cancelled, and locks received costs", async () => {
      const { id } = await draft(await acme(), [{ variantGid: WIDGET, quantity: 10, unitCost: decimal("3.00") }]);
      await transitionPurchaseOrder(dbA, STAFF, id, 1, "markOrdered");
      await receiveUnits(id, WIDGET, 4, "PARTIAL");
      const lineId = (await loadPurchaseOrder(dbA, id)).lineItems[0]!.id;
      const edit = (quantity: number, unitCost: string) =>
        updatePurchaseOrderLine(dbA, STAFF, id, 1, lineId, {
          quantity,
          unitCost: decimal(unitCost),
          discountPercent: null,
          taxRatePercent: null,
          note: null,
        });

      await expectPurchasingError(edit(3, "3.00"), "invalid_input");
      await expectPurchasingError(edit(10, "2.00"), "invalid_input", "fixed on a line once stock has been received");
      await edit(8, "3.00");

      const line = (await loadPurchaseOrder(dbA, id)).lineItems[0]!;
      expect([line.orderedQty, line.unitCost.toFixed(2)]).toEqual([8, "3.00"]);
    });

    it("keeps supplier pricing when the posted cost is the automatic one", async () => {
      const supplierId = await acme();
      await saveSupplierProduct(dbA, STAFF, supplierId, productTerms());
      await addPriceTier(dbA, STAFF, supplierId, {
        variantGid: WIDGET,
        minQty: 10,
        maxQty: null,
        unitCost: decimal("3.00"),
      });
      const { id } = await draft(supplierId, [{ variantGid: WIDGET, quantity: 5 }]);
      const lineId = (await loadPurchaseOrder(dbA, id)).lineItems[0]!.id;
      const edit = async (quantity: number, unitCost: string | null) => {
        await updatePurchaseOrderLine(dbA, STAFF, id, await versionOf(id), lineId, {
          quantity,
          unitCost: unitCost === null ? null : decimal(unitCost),
          discountPercent: null,
          taxRatePercent: null,
          note: null,
        });
        const line = (await loadPurchaseOrder(dbA, id)).lineItems[0]!;
        return [line.unitCost.toFixed(2), line.manualCostOverride];
      };

      expect(await edit(12, "3.50")).toEqual(["3.00", false]);
      expect(await edit(12, "2.80")).toEqual(["2.80", true]);
      expect(await edit(5, "2.80")).toEqual(["2.80", true]);
      expect(await edit(5, null)).toEqual(["3.50", false]);
    });

    it("changes the version for document changes but not for an internal line note", async () => {
      const { id } = await draft(await acme(), [{ variantGid: WIDGET, quantity: 10, unitCost: decimal("3.00") }]);
      const lineId = (await loadPurchaseOrder(dbA, id)).lineItems[0]!.id;
      const line = { quantity: 10, unitCost: decimal("3.00"), discountPercent: null, taxRatePercent: null };

      await updatePurchaseOrderLine(dbA, STAFF, id, 1, lineId, { ...line, note: "check carton" });
      expect(await versionOf(id)).toBe(1);
      await updatePurchaseOrderLine(dbA, STAFF, id, 1, lineId, {
        ...line,
        discountPercent: decimal("10"),
        note: "check carton",
      });
      expect(await versionOf(id)).toBe(2);
    });

    it("removes lines from drafts and cancels the remainder on later orders", async () => {
      const { id } = await draft(await acme(), [
        { variantGid: WIDGET, quantity: 10, unitCost: decimal("3.00") },
        { variantGid: GADGET, quantity: 5, unitCost: decimal("1.00") },
      ]);
      const [widgetLine, gadgetLine] = (await loadPurchaseOrder(dbA, id)).lineItems;

      await removePurchaseOrderLine(dbA, STAFF, id, 1, gadgetLine!.id);
      await transitionPurchaseOrder(dbA, STAFF, id, await versionOf(id), "markOrdered");
      await expectPurchasingError(
        removePurchaseOrderLine(dbA, STAFF, id, await versionOf(id), widgetLine!.id),
        "invalid_state",
        "Cancel the remaining quantity",
      );
      await expectPurchasingError(
        setLineCancelledQuantity(dbA, STAFF, id, await versionOf(id), widgetLine!.id, 11),
        "invalid_input",
      );
      await setLineCancelledQuantity(dbA, STAFF, id, await versionOf(id), widgetLine!.id, 4);

      const po = await loadPurchaseOrder(dbA, id);
      expect(po.lineItems.map((line) => [line.orderedQty, line.cancelledQty])).toEqual([[10, 4]]);
      expect(totalsFor(po).merchandiseAmount.toFixed(2)).toBe("18.00");
      expect((await getIncomingQuantities(dbA)).get(WIDGET)).toBe(6);
    });
  });

  describe("planning figures", () => {
    it("counts incoming stock from sent, ordered and partly received orders only", async () => {
      const supplierId = await acme();
      const lines = [{ variantGid: WIDGET, quantity: 10 }];
      await draft(supplierId, lines);
      const sent = await draft(supplierId, lines);
      await transitionPurchaseOrder(dbA, STAFF, sent.id, 1, "markSent");
      const partial = await draft(supplierId, [...lines, { variantGid: GADGET, quantity: 3 }]);
      await transitionPurchaseOrder(dbA, STAFF, partial.id, 1, "markOrdered");
      await receiveUnits(partial.id, WIDGET, 4, "PARTIAL");
      const cancelled = await draft(supplierId, lines);
      await transitionPurchaseOrder(dbA, STAFF, cancelled.id, 1, "cancel");
      const atStore = await createPurchaseOrderDraft(dbA, STAFF, {
        supplierId,
        locationGid: STORE,
        lines: [{ variantGid: WIDGET, quantity: 2 }],
      });
      await transitionPurchaseOrder(dbA, STAFF, atStore.id, 1, "markOrdered");

      expect([...(await getIncomingQuantities(dbA)).entries()].sort()).toEqual([
        [WIDGET, 18],
        [GADGET, 3],
      ]);
      expect((await getIncomingQuantities(dbA, { locationGid: STORE })).get(WIDGET)).toBe(2);
      expect([...(await getIncomingQuantities(dbA, { variantGids: [GADGET] })).entries()]).toEqual([
        [GADGET, 3],
      ]);
      expect((await getIncomingQuantities(dbB)).size).toBe(0);
    });

    it("reports supplier terms with the preferred supplier and the lead time in use", async () => {
      const acmeId = await acme({ defaultLeadTimeDays: 7 });
      const boltId = await acme({ name: "Bolt Brothers", defaultLeadTimeDays: null });
      const goneId = await acme({ name: "Gone Ltd" });
      await saveSupplierProduct(dbA, STAFF, acmeId, productTerms({ moq: 12, packSize: 6 }));
      await saveSupplierProduct(
        dbA,
        STAFF,
        boltId,
        productTerms({ supplierCost: null, leadTimeDaysOverride: 3, isPreferred: true }),
      );
      await saveSupplierProduct(dbA, STAFF, goneId, productTerms());
      await saveSupplierProduct(dbA, STAFF, boltId, productTerms({ variantGid: GADGET, leadTimeDaysOverride: null }));
      await migrationPrisma.supplier.update({ where: { id: boltId }, data: { leadTimeDays: 9.2 } });
      await setSupplierArchived(dbA, STAFF, goneId, true);

      const terms = await getSupplierTerms(dbA, { variantGids: [WIDGET, GADGET, UNCOSTED] });

      expect([...terms.keys()].sort()).toEqual([WIDGET, GADGET].sort());
      const widget = terms.get(WIDGET)!;
      expect(widget.all.map((entry) => entry.supplierName)).toEqual(["Bolt Brothers", "Acme Supply"]);
      expect(widget.preferred).toMatchObject({
        supplierId: boltId,
        supplierCost: null,
        leadTimeDays: 3,
        leadTimeSource: "variant_override",
      });
      expect(widget.all[1]).toMatchObject({
        supplierId: acmeId,
        currency: "USD",
        vendorSku: "ACME-W1",
        moq: 12,
        packSize: 6,
        supplierCost: "3.5",
        isPreferred: false,
        leadTimeDays: 7,
        leadTimeSource: "supplier_default",
      });
      expect(terms.get(GADGET)!.preferred).toMatchObject({
        supplierId: boltId,
        isPreferred: false,
        leadTimeDays: 10,
        leadTimeSource: "measured",
      });
      expect((await getSupplierTerms(dbB, { variantGids: [WIDGET] })).size).toBe(0);
      expect(await listSupplierVariantGids(dbA, boltId)).toEqual([WIDGET, GADGET]);
      expect(await listSupplierVariantGids(dbA, goneId)).toEqual([]);
      expect(await listSupplierVariantGids(dbB, boltId)).toEqual([]);
    });
  });

  describe("purchase order list", () => {
    it("groups orders into views and flags overdue ones by the merchant's date", async () => {
      const acmeId = await acme();
      const boltId = await acme({ name: "Bolt Brothers" });
      const lines = [{ variantGid: WIDGET, quantity: 10, unitCost: decimal("3.00") }];
      const draftPo = await draft(acmeId, lines);
      const late = await draft(boltId, lines);
      await updatePurchaseOrderHeader(dbA, STAFF, late.id, 1, headerInput({ expectedOn: new Date("2026-11-09T00:00:00Z") }));
      await transitionPurchaseOrder(dbA, STAFF, late.id, await versionOf(late.id), "markOrdered");
      const dueToday = await draft(acmeId, lines);
      await updatePurchaseOrderHeader(dbA, STAFF, dueToday.id, 1, headerInput({ expectedOn: new Date("2026-11-10T00:00:00Z") }));
      await transitionPurchaseOrder(dbA, STAFF, dueToday.id, await versionOf(dueToday.id), "markSent");
      const archived = await draft(acmeId, lines);
      await transitionPurchaseOrder(dbA, STAFF, archived.id, 1, "cancel");
      await transitionPurchaseOrder(dbA, STAFF, archived.id, await versionOf(archived.id), "archive");

      const open = await listPurchaseOrders(dbA, { today: TODAY });
      expect(open.counts).toEqual({
        open: 3,
        draft: 1,
        incoming: 2,
        overdue: 1,
        received: 0,
        cancelled: 0,
        archived: 1,
        all: 4,
      });
      expect(open.items.map((item) => item.id).sort()).toEqual([draftPo.id, late.id, dueToday.id].sort());
      const overdue = await listPurchaseOrders(dbA, { view: "overdue", today: TODAY });
      expect(overdue.items).toHaveLength(1);
      expect(overdue.items[0]).toMatchObject({
        id: late.id,
        supplierName: "Bolt Brothers",
        status: "ORDERED",
        overdue: true,
        expectedOn: "2026-11-09",
        total: "30.00",
        orderedUnits: 10,
        receivedUnits: 0,
        remainingUnits: 10,
      });
      expect((await listPurchaseOrders(dbA, { view: "overdue" })).items).toEqual([]);
      const bySupplier = await listPurchaseOrders(dbA, { view: "all", search: "bolt", today: TODAY });
      expect(bySupplier.items.map((item) => item.id)).toEqual([late.id]);
      const byNumber = await listPurchaseOrders(dbA, { view: "all", search: archived.poNumber });
      expect(byNumber.items.map((item) => [item.id, item.archived])).toEqual([[archived.id, true]]);
      expect((await listPurchaseOrders(dbB, { view: "all", today: TODAY })).items).toEqual([]);
    });
  });

  describe("another shop", () => {
    it("cannot read, change or delete this shop's purchase orders", async () => {
      const { id } = await draft(await acme(), [{ variantGid: WIDGET, quantity: 10 }]);

      await expectPurchasingError(loadPurchaseOrder(dbB, id), "not_found");
      await expectPurchasingError(transitionPurchaseOrder(dbB, STAFF, id, 1, "markOrdered"), "not_found");
      await expectPurchasingError(deletePurchaseOrderDraft(dbB, STAFF, id, 1), "not_found");
      await expectPurchasingError(duplicatePurchaseOrder(dbB, STAFF, id), "not_found");
      await expectPurchasingError(
        addPurchaseOrderLines(dbB, STAFF, id, 1, [{ variantGid: WIDGET, quantity: 1 }]),
        "invalid_input",
        "no longer available",
      );
      expect(
        await listPurchasingEvents(dbB, { subjectType: "PURCHASE_ORDER", subjectId: id }),
      ).toEqual([]);
      expect((await loadPurchaseOrder(dbA, id)).status).toBe("DRAFT");
    });
  });
});
