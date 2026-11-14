/**
 * The supplier pages against PostgreSQL through the tenant database wrapper:
 * what their forms accept and refuse, what another shop can reach, and what
 * the pages show from real loader data.
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
import type { PurchasingActionResult } from "../../../services/purchasing/action-result.server";
import type { PurchasingActor } from "../../../services/purchasing/actor.server";
import { createPurchaseOrderDraft } from "../../../services/purchasing/purchase-orders.server";
import {
  createSupplierFromForm,
  runSupplierIntent,
} from "../../../services/purchasing/supplier-actions.server";
import {
  addPriceTier,
  addSupplierProducts,
  createSupplier,
  saveSupplierProduct,
} from "../../../services/purchasing/suppliers.server";
import { renderRoute, unsafeWirePaths } from "../../../test-utils/render-route";
import {
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
const TODAY = "2026-11-10";

const BLUE = "gid://shopify/ProductVariant/201";
const RED = "gid://shopify/ProductVariant/202";
const SHOP_B_VARIANT = "gid://shopify/ProductVariant/901";
const WAREHOUSE = "gid://shopify/Location/401";

/** Shopify answering the shop-profile query; it knows no variants. */
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

const PROFILE_FIELDS = {
  name: "Acme Supply",
  currency: "USD",
  contactEmail: "orders@acme.example",
};

function profileInput(name: string) {
  return {
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
  };
}

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

function redirectedTo(result: PurchasingActionResult | Response): string {
  if (!(result instanceof Response)) {
    throw new Error(
      `Expected a redirect: ${result.ok ? result.notice : result.error}`,
    );
  }
  return result.headers.get("Location") ?? "";
}

describe("supplier pages", () => {
  let prisma: PrismaClient;
  let dbA: TenantDb;
  let dbB: TenantDb;

  const shopA = () => ({ admin, db: dbA, actor: BUYER });
  const shopB = () => ({ admin, db: dbB, actor: BUYER });

  beforeAll(async () => {
    const ctx = await resetAndEnforce();
    prisma = ctx.migrationPrisma;
    await ctx.runtimePrisma.$disconnect();
    const shops = await seedTwoShops(prisma);

    await prisma.shopifyProductFact.createMany({
      data: [
        {
          ...completeProductData({ id: "101", shopId: shops.shopA.id }),
          title: "Widget",
          vendor: "Acme Goods",
        },
        {
          ...completeProductData({ id: "109", shopId: shops.shopB.id }),
          title: "Gadget",
          vendor: "Shop B Goods",
        },
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
          sku: "G-1",
        },
      ],
    });
    await prisma.shopifyLocationFact.create({
      data: {
        ...completeLocationData({ id: "401", shopId: shops.shopA.id }),
        name: "Warehouse",
      },
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
      `TRUNCATE TABLE "PurchasingEvent", "PurchaseOrderCharge", "POLineItem",
         "PurchaseOrder", "VolumePriceTier", "SupplierSkuMapping",
         "LeadTimeSnapshot", "Supplier" CASCADE`,
    );
    vi.clearAllMocks();
    requireAdminTenant.mockResolvedValue({ admin, db: dbA });
    requirePurchasingContext.mockResolvedValue(shopA());
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  const submit = (
    supplierId: string,
    fields: Record<string, string>,
    context = shopA(),
  ) => runSupplierIntent(context, supplierId, formData(fields));

  async function supplier(name = "Acme Supply") {
    return (await createSupplier(dbA, BUYER, profileInput(name))).id;
  }

  async function mappings(supplierId: string) {
    return prisma.supplierSkuMapping.findMany({
      where: { supplierId },
      orderBy: { shopifyVariantId: "asc" },
    });
  }

  describe("new-supplier form", () => {
    it("creates the supplier and opens its page", async () => {
      const result = await createSupplierFromForm(
        shopA(),
        formData({ intent: "create", ...PROFILE_FIELDS, currency: "eur" }),
      );

      const [created] = await prisma.supplier.findMany();
      expect(redirectedTo(result)).toBe(`/app/suppliers/${created!.id}`);
      expect(created).toMatchObject({
        name: "Acme Supply",
        currency: "EUR",
        status: "ACTIVE",
      });
    });

    it("saves no preferred contact method from the form's Not set option", async () => {
      const result = await createSupplierFromForm(
        shopA(),
        formData({
          intent: "create",
          ...PROFILE_FIELDS,
          preferredContactMethod: "NONE",
        }),
      );
      const [created] = await prisma.supplier.findMany();
      const set = await submit(created!.id, {
        intent: "saveProfile",
        ...PROFILE_FIELDS,
        preferredContactMethod: "PORTAL",
      });
      const cleared = await submit(created!.id, {
        intent: "saveProfile",
        ...PROFILE_FIELDS,
        preferredContactMethod: "NONE",
      });

      expect(redirectedTo(result)).toBe(`/app/suppliers/${created!.id}`);
      expect(created!.preferredContactMethod).toBeNull();
      expect(set).toMatchObject({ ok: true });
      expect(cleared).toMatchObject({ ok: true });
      expect(
        (await prisma.supplier.findUniqueOrThrow({ where: { id: created!.id } }))
          .preferredContactMethod,
      ).toBeNull();
    });

    it.each([
      ["no name", { name: "" }, "name"],
      ["a currency that is not 3 letters", { currency: "US" }, "currency"],
      [
        "an email without a domain",
        { contactEmail: "orders@" },
        "contactEmail",
      ],
      [
        "a website that is not http",
        { website: "ftp://acme.example" },
        "website",
      ],
      ["a 3-letter country", { countryCode: "USA" }, "countryCode"],
      [
        "a negative lead time",
        { defaultLeadTimeDays: "-1" },
        "defaultLeadTimeDays",
      ],
      [
        "a fractional lead time",
        { defaultLeadTimeDays: "2.5" },
        "defaultLeadTimeDays",
      ],
      [
        "a tax rate above 100%",
        { defaultTaxRatePercent: "101" },
        "defaultTaxRatePercent",
      ],
      [
        "a minimum order with fractions of a cent",
        { minimumOrderValue: "10.001" },
        "minimumOrderValue",
      ],
      [
        "a contact method that does not exist",
        { preferredContactMethod: "FAX" },
        "preferredContactMethod",
      ],
    ])("refuses %s", async (_name, fields, field) => {
      const result = failed(
        await createSupplierFromForm(
          shopA(),
          formData({ intent: "create", ...PROFILE_FIELDS, ...fields }),
        ),
      );

      expect(result.fieldErrors[field]).toEqual(expect.any(String));
      expect(await prisma.supplier.count()).toBe(0);
    });

    it("refuses a second active supplier with the same name", async () => {
      await supplier("Acme Supply");

      const result = failed(
        await createSupplierFromForm(
          shopA(),
          formData({ ...PROFILE_FIELDS, name: "ACME supply" }),
        ),
      );

      expect(result.fieldErrors.name).toBe(
        'A supplier named "ACME supply" already exists.',
      );
      expect(await prisma.supplier.count()).toBe(1);
    });

    it("allows a name another shop already uses", async () => {
      await createSupplier(dbB, BUYER, profileInput("Acme Supply"));

      const result = await createSupplierFromForm(
        shopA(),
        formData(PROFILE_FIELDS),
      );

      expect(redirectedTo(result)).toMatch(/^\/app\/suppliers\/[a-z0-9]+$/);
      expect(await prisma.supplier.count()).toBe(2);
    });
  });

  describe("supplier page forms", () => {
    it("saves the profile and records which fields changed", async () => {
      const id = await supplier();

      const saved = succeeded(
        await submit(id, {
          intent: "saveProfile",
          ...PROFILE_FIELDS,
          defaultLeadTimeDays: "14",
          minimumOrderValue: "250.00",
        }),
      );

      expect(saved.notice).toBe("Supplier saved.");
      expect(
        await prisma.supplier.findUniqueOrThrow({ where: { id } }),
      ).toMatchObject({
        contactEmail: "orders@acme.example",
        defaultLeadTimeDays: 14,
        minimumOrderValue: new Prisma.Decimal("250"),
      });
      const events = await prisma.purchasingEvent.findMany({
        where: { subjectId: id, action: "supplier.updated" },
      });
      expect(events).toHaveLength(1);
      expect(events[0]!.details).toEqual({
        fields: ["contactEmail", "defaultLeadTimeDays", "minimumOrderValue"],
      });
    });

    it("refuses an invalid profile without saving any of it", async () => {
      const id = await supplier();

      const result = failed(
        await submit(id, {
          intent: "saveProfile",
          ...PROFILE_FIELDS,
          contactName: "New Name",
          defaultRestockDays: "731",
        }),
      );

      expect(result.intent).toBe("saveProfile");
      expect(result.fieldErrors.defaultRestockDays).toEqual(expect.any(String));
      expect(
        (await prisma.supplier.findUniqueOrThrow({ where: { id } }))
          .contactName,
      ).toBeNull();
    });

    it("adds a product once and reports products it cannot add", async () => {
      const id = await supplier();

      const first = succeeded(
        await submit(id, { intent: "addProduct", variantGid: BLUE }),
      );
      const again = succeeded(
        await submit(id, { intent: "addProduct", variantGid: BLUE }),
      );
      const otherShops = succeeded(
        await submit(id, { intent: "addProduct", variantGid: SHOP_B_VARIANT }),
      );
      const malformed = failed(
        await submit(id, { intent: "addProduct", variantGid: "201" }),
      );

      expect(first.notice).toBe("1 product added.");
      expect(again.notice).toBe(
        "No products added; 1 was already on this supplier.",
      );
      expect(otherShops.notice).toBe(
        "No products added; 1 is no longer in Shopify.",
      );
      expect(malformed.error).toEqual(expect.any(String));
      expect((await mappings(id)).map((m) => m.shopifyVariantId)).toEqual([
        BLUE,
      ]);
    });

    it("adds every product of a Shopify vendor, and only this shop's", async () => {
      const id = await supplier();

      const added = succeeded(
        await submit(id, { intent: "addVendor", vendor: "Acme Goods" }),
      );
      const otherShops = failed(
        await submit(id, { intent: "addVendor", vendor: "Shop B Goods" }),
      );

      expect(added.notice).toBe("2 products added.");
      expect(otherShops.error).toBe(
        'No products with the vendor "Shop B Goods" are in the synced catalog.',
      );
      expect((await mappings(id)).map((m) => m.shopifyVariantId)).toEqual([
        BLUE,
        RED,
      ]);
    });

    it.each([
      ["a minimum order quantity of zero", { moq: "0" }, "moq"],
      ["a negative pack size", { packSize: "-2" }, "packSize"],
      ["a fractional pack size", { packSize: "1.5" }, "packSize"],
      [
        "a cost with five decimals",
        { supplierCost: "1.23456" },
        "supplierCost",
      ],
      ["a negative cost", { supplierCost: "-1" }, "supplierCost"],
      [
        "a lead time over two years",
        { leadTimeDaysOverride: "731" },
        "leadTimeDaysOverride",
      ],
    ])("does not save product terms with %s", async (_name, fields, field) => {
      const id = await supplier();
      await addSupplierProducts(dbA, BUYER, id, [BLUE]);

      const result = failed(
        await submit(id, {
          intent: "saveProduct",
          variantGid: BLUE,
          moq: "6",
          packSize: "2",
          ...fields,
        }),
      );

      expect(result.fieldErrors[field]).toEqual(expect.any(String));
      expect(await mappings(id)).toMatchObject([{ moq: 1, packSize: 1 }]);
    });

    it("saves product terms and moves the preferred mark from another supplier", async () => {
      const other = await supplier("Other Supply");
      const id = await supplier();
      await saveSupplierProduct(dbA, BUYER, other, {
        variantGid: BLUE,
        vendorSku: null,
        moq: 1,
        packSize: 1,
        supplierCost: null,
        leadTimeDaysOverride: null,
        orderUnit: null,
        isPreferred: true,
      });

      const saved = succeeded(
        await submit(id, {
          intent: "saveProduct",
          variantGid: BLUE,
          vendorSku: "ACME-BLUE",
          moq: "6",
          packSize: "2",
          supplierCost: "7.2500",
          orderUnit: "case",
          isPreferred: "on",
        }),
      );

      expect(saved.notice).toBe("Product added.");
      expect(await mappings(id)).toMatchObject([
        {
          vendorSku: "ACME-BLUE",
          moq: 6,
          packSize: 2,
          supplierCost: new Prisma.Decimal("7.25"),
          orderUnit: "case",
          isPreferred: true,
        },
      ]);
      expect(await mappings(other)).toMatchObject([{ isPreferred: false }]);
    });

    it("adds price tiers without overlaps and removes them", async () => {
      const id = await supplier();
      await addSupplierProducts(dbA, BUYER, id, [BLUE]);

      succeeded(
        await submit(id, {
          intent: "addTier",
          variantGid: BLUE,
          minQty: "10",
          maxQty: "49",
          unitCost: "7.25",
        }),
      );
      const overlapping = failed(
        await submit(id, {
          intent: "addTier",
          variantGid: BLUE,
          minQty: "40",
          unitCost: "6.80",
        }),
      );
      const inverted = failed(
        await submit(id, {
          intent: "addTier",
          variantGid: BLUE,
          minQty: "60",
          maxQty: "50",
          unitCost: "6.80",
        }),
      );
      const notSold = failed(
        await submit(id, {
          intent: "addTier",
          variantGid: RED,
          minQty: "1",
          unitCost: "1",
        }),
      );

      expect(overlapping.fieldErrors.minQty).toBe(
        "This range overlaps the existing 10-49 tier.",
      );
      expect(inverted.fieldErrors.maxQty).toBe(
        "To quantity cannot be less than the from quantity.",
      );
      expect(notSold.error).toBe(
        "Add the product to this supplier before pricing it.",
      );
      const [tier] = await prisma.volumePriceTier.findMany();
      expect(tier).toMatchObject({ minQty: 10, maxQty: 49 });

      succeeded(await submit(id, { intent: "removeTier", tierId: tier!.id }));
      expect(await prisma.volumePriceTier.count()).toBe(0);
    });

    it("removes a product together with its price tiers", async () => {
      const id = await supplier();
      await addSupplierProducts(dbA, BUYER, id, [BLUE, RED]);
      await addPriceTier(dbA, BUYER, id, {
        variantGid: BLUE,
        minQty: 10,
        maxQty: null,
        unitCost: new Prisma.Decimal("7"),
      });
      const blue = (await mappings(id)).find(
        (m) => m.shopifyVariantId === BLUE,
      )!;

      const result = await submit(id, {
        intent: "removeProduct",
        mappingId: blue.id,
      });

      expect(redirectedTo(result)).toBe(`/app/suppliers/${id}`);
      expect((await mappings(id)).map((m) => m.shopifyVariantId)).toEqual([
        RED,
      ]);
      expect(await prisma.volumePriceTier.count()).toBe(0);
    });

    it("keeps an archived supplier read-only until it is restored", async () => {
      const id = await supplier();

      succeeded(await submit(id, { intent: "archive" }));
      const refused = failed(
        await submit(id, { intent: "addProduct", variantGid: BLUE }),
      );
      expect(refused.error).toBe(
        "This supplier is archived. Restore it before making changes.",
      );

      await supplier("Acme Supply");
      const clash = failed(await submit(id, { intent: "restore" }));
      expect(clash.fieldErrors.name).toBe(
        'A supplier named "Acme Supply" already exists.',
      );
    });

    it("deletes only a supplier that has no purchase orders", async () => {
      const unused = await supplier("Unused Supply");
      const used = await supplier("Used Supply");
      await addSupplierProducts(dbA, BUYER, used, [BLUE]);
      await createPurchaseOrderDraft(
        dbA,
        BUYER,
        {
          supplierId: used,
          locationGid: WAREHOUSE,
          lines: [
            {
              variantGid: BLUE,
              quantity: 1,
              unitCost: new Prisma.Decimal("1"),
            },
          ],
        },
        { today: TODAY },
      );

      expect(redirectedTo(await submit(unused, { intent: "delete" }))).toBe(
        "/app/suppliers",
      );
      expect(failed(await submit(used, { intent: "delete" })).error).toBe(
        "This supplier has purchase orders and cannot be deleted. Archive it instead.",
      );
      expect((await prisma.supplier.findMany()).map((s) => s.name)).toEqual([
        "Used Supply",
      ]);
    });

    it("refuses an intent the page does not have", async () => {
      const id = await supplier();

      expect(failed(await submit(id, { intent: "merge" })).error).toBe(
        "That action is not available.",
      );
    });
  });

  describe("another shop", () => {
    it("cannot change, archive, delete or stock this shop's supplier", async () => {
      const id = await supplier();
      await addSupplierProducts(dbA, BUYER, id, [BLUE]);
      await addPriceTier(dbA, BUYER, id, {
        variantGid: BLUE,
        minQty: 1,
        maxQty: null,
        unitCost: new Prisma.Decimal("5"),
      });
      const [mapping] = await mappings(id);
      const [tier] = await prisma.volumePriceTier.findMany();
      const before = await prisma.supplier.findUniqueOrThrow({ where: { id } });

      const attempts: Array<Record<string, string>> = [
        { intent: "saveProfile", ...PROFILE_FIELDS, name: "Taken over" },
        { intent: "archive" },
        { intent: "delete" },
        { intent: "addProduct", variantGid: SHOP_B_VARIANT },
        { intent: "addVendor", vendor: "Shop B Goods" },
        {
          intent: "saveProduct",
          variantGid: BLUE,
          moq: "99",
          packSize: "1",
        },
        { intent: "removeProduct", mappingId: mapping!.id },
        {
          intent: "addTier",
          variantGid: BLUE,
          minQty: "500",
          unitCost: "0.01",
        },
        { intent: "removeTier", tierId: tier!.id },
      ];
      for (const fields of attempts) {
        const result = failed(await submit(id, fields, shopB()));
        expect(result.error).toBe("Supplier was not found.");
      }

      expect(
        await prisma.supplier.findUniqueOrThrow({ where: { id } }),
      ).toEqual(before);
      expect(await mappings(id)).toMatchObject([{ moq: 1 }]);
      expect(await prisma.volumePriceTier.count()).toBe(1);
    });

    it("cannot reach this shop's products or tiers through its own supplier", async () => {
      const id = await supplier();
      await addSupplierProducts(dbA, BUYER, id, [BLUE]);
      await addPriceTier(dbA, BUYER, id, {
        variantGid: BLUE,
        minQty: 1,
        maxQty: null,
        unitCost: new Prisma.Decimal("5"),
      });
      const [mapping] = await mappings(id);
      const [tier] = await prisma.volumePriceTier.findMany();
      const own = (await createSupplier(dbB, BUYER, profileInput("Own Supply")))
        .id;

      const removeProduct = failed(
        await submit(
          own,
          { intent: "removeProduct", mappingId: mapping!.id },
          shopB(),
        ),
      );
      const removeTier = failed(
        await submit(own, { intent: "removeTier", tierId: tier!.id }, shopB()),
      );
      const addProduct = succeeded(
        await submit(own, { intent: "addProduct", variantGid: BLUE }, shopB()),
      );

      expect(removeProduct.error).toBe("Supplier product was not found.");
      expect(removeTier.error).toBe("Price tier was not found.");
      expect(addProduct.notice).toBe(
        "No products added; 1 is no longer in Shopify.",
      );
      expect(await prisma.supplierSkuMapping.count()).toBe(1);
      expect(await prisma.volumePriceTier.count()).toBe(1);
    });
  });

  describe("pages", () => {
    const loaderArgs = (path: string, params: Record<string, string> = {}) =>
      ({
        request: new Request(`https://app.example.test${path}`),
        params,
        context: {},
      }) as unknown as LoaderFunctionArgs;

    const actionArgs = (path: string, fields: Record<string, string>) =>
      ({
        request: new Request(`https://app.example.test${path}`, {
          method: "POST",
          body: new URLSearchParams(fields),
        }),
        params: {},
        context: {},
      }) as unknown as ActionFunctionArgs;

    it("lists active and archived suppliers, and says so when nothing matches", async () => {
      const id = await supplier();
      await addSupplierProducts(dbA, BUYER, id, [BLUE, RED]);
      const archived = await supplier("Old Supply");
      await submit(archived, { intent: "archive" });
      await createSupplier(dbB, BUYER, profileInput("Shop B Supply"));
      const route = await import("../../../routes/app.suppliers");

      const data = await route.loader(loaderArgs("/app/suppliers"));
      const active = await renderRoute(route.default, data);
      const archivedList = await renderRoute(
        route.default,
        await route.loader(loaderArgs("/app/suppliers?status=archived")),
      );
      const none = await renderRoute(
        route.default,
        await route.loader(loaderArgs("/app/suppliers?q=nothing-here")),
      );

      expect(unsafeWirePaths(data)).toEqual([]);
      expect(active).toContain("Acme Supply");
      expect(active).toContain("<s-table-cell>2</s-table-cell>");
      expect(active).not.toContain("Old Supply");
      expect(active).not.toContain("Shop B Supply");
      expect(archivedList).toContain("Old Supply");
      expect(archivedList).not.toContain("Acme Supply");
      expect(none).toContain("No active suppliers match “nothing-here”.");
    });

    it("shows a supplier's products, terms, tiers and history", async () => {
      const id = await supplier();
      await saveSupplierProduct(dbA, BUYER, id, {
        variantGid: BLUE,
        vendorSku: "ACME-BLUE",
        moq: 6,
        packSize: 2,
        supplierCost: new Prisma.Decimal("7.2500"),
        leadTimeDaysOverride: null,
        orderUnit: null,
        isPreferred: true,
      });
      await addPriceTier(dbA, BUYER, id, {
        variantGid: BLUE,
        minQty: 10,
        maxQty: 49,
        unitCost: new Prisma.Decimal("6.8125"),
      });
      const [mapping] = await mappings(id);
      const route = await import("../../../routes/app.suppliers_.$id");

      const data = await route.loader(
        loaderArgs(`/app/suppliers/${id}?edit=${mapping!.id}&find=widget`, {
          id,
        }),
      );
      const html = await renderRoute(route.default, data);

      expect(unsafeWirePaths(data)).toEqual([]);
      expect(html).toContain("Widget - Blue");
      expect(html).toContain("ACME-BLUE");
      expect(html).toContain("$7.25");
      expect(html).toContain("$6.8125");
      expect(html).toContain("10 to 49");
      expect(html).toContain("Preferred supplier");
      expect(html).toContain("Edit Widget - Blue");
      expect(html).toContain("Already added");
      expect(html).toContain("Widget - Red");
      expect(html).toContain("Acme Goods");
      expect(html).toContain("Supplier created.");
      expect(html).not.toMatch(/NaN|\[object Object\]|undefined/);
    });

    it("asks before deleting and shows a refused action in a critical banner", async () => {
      const id = await supplier();
      const route = await import("../../../routes/app.suppliers_.$id");
      const path = `/app/suppliers/${id}`;

      const confirming = await renderRoute(
        route.default,
        await route.loader(loaderArgs(`${path}?confirm=delete`, { id })),
      );
      const refusal = failed(
        await submit(id, { intent: "saveProfile", name: "" }),
      );
      const refused = await renderRoute(
        route.default,
        await route.loader(loaderArgs(path, { id })),
        refusal,
      );

      expect(confirming).toContain('heading="Delete this supplier?"');
      expect(refused).toMatch(
        /<s-banner tone="critical" heading="Supplier not updated">.*Fix the highlighted fields and try again\..*<\/s-banner>/s,
      );
    });

    it("hides the forms of an archived supplier", async () => {
      const id = await supplier();
      await submit(id, { intent: "archive" });
      const route = await import("../../../routes/app.suppliers_.$id");

      const html = await renderRoute(
        route.default,
        await route.loader(loaderArgs(`/app/suppliers/${id}`, { id })),
      );

      expect(html).toContain("This supplier is archived");
      expect(html).toContain("Restore supplier");
      expect(html).not.toContain('value="saveProfile"');
      expect(html).not.toContain("Add products");
    });

    it("answers 404 for a supplier of another shop", async () => {
      const other = (
        await createSupplier(dbB, BUYER, profileInput("Shop B Supply"))
      ).id;
      const route = await import("../../../routes/app.suppliers_.$id");

      const thrown = await route
        .loader(loaderArgs(`/app/suppliers/${other}`, { id: other }))
        .then(
          () => null,
          (error: unknown) => error,
        );

      expect(thrown).toBeInstanceOf(Response);
      expect((thrown as Response).status).toBe(404);
    });

    it("offers the shop's currency on the new-supplier page and creates from it", async () => {
      const route = await import("../../../routes/app.suppliers_.new");

      const html = await renderRoute(
        route.default,
        await route.loader(loaderArgs("/app/suppliers/new")),
      );
      const created = await route.action(
        actionArgs("/app/suppliers/new", {
          intent: "create",
          ...PROFILE_FIELDS,
        }),
      );

      expect(html).toContain('name="currency" value="USD"');
      expect(html).toContain("Supplier portal");
      // An option with an empty value would submit its label instead.
      expect(html).toMatch(/name="preferredContactMethod" value="NONE"/);
      expect(html).toContain('<s-option value="NONE">Not set</s-option>');
      expect(html).not.toContain('<s-option value="">');
      expect(redirectedTo(created)).toMatch(/^\/app\/suppliers\/[a-z0-9]+$/);
    });
  });
});
