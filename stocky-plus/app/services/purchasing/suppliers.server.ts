/**
 * Supplier records, the products each supplier sells, and volume pricing.
 *
 * Every write runs in one tenant transaction together with its history event.
 * Minimum order quantity and pack size are stored as guidance for buyers; no
 * function here rounds an order quantity to them.
 */
import { Prisma } from "@prisma/client";
import type { Supplier, SupplierSkuMapping, VolumePriceTier } from "@prisma/client";
import type { TenantDb } from "../../tenant/tenant-db.server";
import type { FormReader } from "../../lib/purchasing/form-input";
import { INCOMING_STATUSES } from "../../lib/purchasing/status";
import type { AdminGraphQLClient } from "../shopify-gql.server";
import type { PurchasingActor } from "./actor.server";
import { invalidInput, notFound, PurchasingError } from "./errors";
import { recordPurchasingEvent } from "./events.server";
import {
  assertVariantGids,
  isVariantGid,
  resolveVariants,
  type VariantSnapshot,
} from "./variants.server";

export const SUPPLIER_CONTACT_METHODS = ["EMAIL", "PHONE", "PORTAL", "OTHER"] as const;
export type SupplierContactMethod = (typeof SUPPLIER_CONTACT_METHODS)[number];

export const SUPPLIER_CONTACT_METHOD_LABELS: Record<SupplierContactMethod, string> = {
  EMAIL: "Email",
  PHONE: "Phone",
  PORTAL: "Supplier portal",
  OTHER: "Other",
};

export type SupplierStatus = "ACTIVE" | "ARCHIVED";

const MAX_LEAD_TIME_DAYS = 730;
const MAX_QUANTITY = 1_000_000;
const MAX_UNIT_COST = 999_999;
const MAX_ORDER_VALUE = 9_999_999_999;
const SUPPLIER_PAGE_SIZE = 50;
const PRODUCT_PAGE_SIZE = 100;
const MAX_PRODUCTS_PER_ADD = 5000;
const CREATE_CHUNK = 500;

export type SupplierProfileInput = {
  name: string;
  accountNumber: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  preferredContactMethod: SupplierContactMethod | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string | null;
  currency: string;
  paymentTerms: string | null;
  shippingTerms: string | null;
  defaultTaxRatePercent: Prisma.Decimal | null;
  defaultLeadTimeDays: number | null;
  defaultRestockDays: number | null;
  minimumOrderValue: Prisma.Decimal | null;
  vendorNotes: string | null;
};

export type SupplierProductInput = {
  variantGid: string;
  vendorSku: string | null;
  moq: number;
  packSize: number;
  supplierCost: Prisma.Decimal | null;
  leadTimeDaysOverride: number | null;
  orderUnit: string | null;
  isPreferred: boolean;
};

export type PriceTierInput = {
  variantGid: string;
  minQty: number;
  maxQty: number | null;
  unitCost: Prisma.Decimal;
};

export function parseSupplierProfileForm(
  form: FormReader,
): SupplierProfileInput | null {
  const input = {
    name: form.text("name", { required: true, maxLength: 255, label: "Supplier name" }),
    accountNumber: form.text("accountNumber", { maxLength: 128, label: "Account number" }),
    contactName: form.text("contactName", { maxLength: 255, label: "Contact name" }),
    contactEmail: form.email("contactEmail", { label: "Contact email" }),
    contactPhone: form.text("contactPhone", { maxLength: 64, label: "Contact phone" }),
    preferredContactMethod: form.choice(
      "preferredContactMethod",
      SUPPLIER_CONTACT_METHODS,
      { label: "Preferred contact method" },
    ),
    website: form.url("website", { label: "Website" }),
    addressLine1: form.text("addressLine1", { maxLength: 255, label: "Address" }),
    addressLine2: form.text("addressLine2", { maxLength: 255, label: "Address line 2" }),
    city: form.text("city", { maxLength: 128, label: "City" }),
    region: form.text("region", { maxLength: 128, label: "State or province" }),
    postalCode: form.text("postalCode", { maxLength: 32, label: "Postal code" }),
    countryCode: form.country("countryCode", { label: "Country" }),
    currency: form.currency("currency", { required: true, label: "Currency" }),
    paymentTerms: form.text("paymentTerms", { maxLength: 255, label: "Payment terms" }),
    shippingTerms: form.text("shippingTerms", { maxLength: 255, label: "Shipping terms" }),
    defaultTaxRatePercent: form.percent("defaultTaxRatePercent", { label: "Tax rate" }),
    defaultLeadTimeDays: form.integer("defaultLeadTimeDays", {
      min: 0,
      max: MAX_LEAD_TIME_DAYS,
      label: "Lead time",
    }),
    defaultRestockDays: form.integer("defaultRestockDays", {
      min: 0,
      max: MAX_LEAD_TIME_DAYS,
      label: "Days between orders",
    }),
    minimumOrderValue: form.decimal("minimumOrderValue", {
      scale: 2,
      min: 0,
      max: MAX_ORDER_VALUE,
      label: "Minimum order value",
    }),
    vendorNotes: form.text("vendorNotes", { maxLength: 4000, label: "Notes" }),
  };
  if (!form.ok || input.name === null || input.currency === null) return null;
  return { ...input, name: input.name, currency: input.currency };
}

export function parseSupplierProductForm(
  form: FormReader,
): SupplierProductInput | null {
  const variantGid = form.text("variantGid", { required: true, maxLength: 256, label: "Product" });
  const moq = form.integer("moq", { min: 1, max: MAX_QUANTITY, label: "Minimum order quantity" });
  const packSize = form.integer("packSize", { min: 1, max: MAX_QUANTITY, label: "Pack size" });
  const input = {
    vendorSku: form.text("vendorSku", { maxLength: 255, label: "Supplier SKU" }),
    supplierCost: form.decimal("supplierCost", {
      scale: 4,
      min: 0,
      max: MAX_UNIT_COST,
      label: "Supplier cost",
    }),
    leadTimeDaysOverride: form.integer("leadTimeDaysOverride", {
      min: 0,
      max: MAX_LEAD_TIME_DAYS,
      label: "Lead time",
    }),
    orderUnit: form.text("orderUnit", { maxLength: 64, label: "Order unit" }),
    isPreferred: form.checkbox("isPreferred"),
  };
  if (!form.ok || variantGid === null) return null;
  return { ...input, variantGid, moq: moq ?? 1, packSize: packSize ?? 1 };
}

export function parsePriceTierForm(form: FormReader): PriceTierInput | null {
  const variantGid = form.text("variantGid", { required: true, maxLength: 256, label: "Product" });
  const minQty = form.integer("minQty", {
    required: true,
    min: 1,
    max: MAX_QUANTITY,
    label: "From quantity",
  });
  const maxQty = form.integer("maxQty", { min: 1, max: MAX_QUANTITY, label: "To quantity" });
  const unitCost = form.decimal("unitCost", {
    required: true,
    scale: 4,
    min: 0,
    max: MAX_UNIT_COST,
    label: "Unit cost",
  });
  if (minQty !== null && maxQty !== null && maxQty < minQty) {
    form.fail("maxQty", "To quantity cannot be less than the from quantity.");
  }
  if (!form.ok || variantGid === null || minQty === null || unitCost === null) {
    return null;
  }
  return { variantGid, minQty, maxQty, unitCost };
}

function assertWholeNumber(value: number, min: number, max: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw invalidInput(`${label} must be a whole number between ${min} and ${max}.`);
  }
}

function assertCost(value: Prisma.Decimal, label: string): void {
  if (!value.isFinite() || value.isNegative() || value.gt(MAX_UNIT_COST) || value.decimalPlaces() > 4) {
    throw invalidInput(`${label} must be between 0 and ${MAX_UNIT_COST} with at most 4 decimal places.`);
  }
}

function assertSupplierProduct(input: SupplierProductInput): void {
  assertVariantGids([input.variantGid]);
  assertWholeNumber(input.moq, 1, MAX_QUANTITY, "Minimum order quantity");
  assertWholeNumber(input.packSize, 1, MAX_QUANTITY, "Pack size");
  if (input.supplierCost !== null) assertCost(input.supplierCost, "Supplier cost");
  if (input.leadTimeDaysOverride !== null) {
    assertWholeNumber(input.leadTimeDaysOverride, 0, MAX_LEAD_TIME_DAYS, "Lead time");
  }
}

function assertPriceTier(input: PriceTierInput): void {
  assertVariantGids([input.variantGid]);
  assertWholeNumber(input.minQty, 1, MAX_QUANTITY, "From quantity");
  if (input.maxQty !== null) {
    assertWholeNumber(input.maxQty, input.minQty, MAX_QUANTITY, "To quantity");
  }
  assertCost(input.unitCost, "Unit cost");
}

async function requireSupplier(db: TenantDb, supplierId: string): Promise<Supplier> {
  const supplier: Supplier | null = await db.supplier.findFirst({
    where: { id: supplierId },
  });
  if (!supplier) throw notFound("Supplier");
  return supplier;
}

async function requireActiveSupplier(db: TenantDb, supplierId: string): Promise<Supplier> {
  const supplier = await requireSupplier(db, supplierId);
  if (supplier.status !== "ACTIVE") {
    throw new PurchasingError(
      "invalid_state",
      "This supplier is archived. Restore it before making changes.",
    );
  }
  return supplier;
}

async function assertNameAvailable(
  db: TenantDb,
  name: string,
  exceptSupplierId?: string,
): Promise<void> {
  const clash = await db.supplier.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      status: "ACTIVE",
      ...(exceptSupplierId ? { id: { not: exceptSupplierId } } : {}),
    },
    select: { id: true },
  });
  if (clash) {
    throw invalidInput("Fix the highlighted field.", {
      name: `A supplier named "${name}" already exists.`,
    });
  }
}

type SupplierWithProductCount = Prisma.SupplierGetPayload<{
  include: { _count: { select: { skuMappings: true } } };
}>;

type SupplierWithHistory = Prisma.SupplierGetPayload<{
  include: {
    leadTimeSnapshots: true;
    _count: { select: { skuMappings: true; purchaseOrders: true } };
  };
}>;

export type SupplierListItem = {
  id: string;
  name: string;
  status: SupplierStatus;
  currency: string;
  contactName: string | null;
  contactEmail: string | null;
  defaultLeadTimeDays: number | null;
  measuredLeadTimeDays: number | null;
  productCount: number;
  openOrderCount: number;
};

export async function listSuppliers(
  db: TenantDb,
  options: { status: SupplierStatus; search?: string | null; page?: number },
): Promise<{ suppliers: SupplierListItem[]; page: number; hasNextPage: boolean }> {
  const page = Math.max(1, options.page ?? 1);
  const search = options.search?.trim();
  const rows: SupplierWithProductCount[] = await db.supplier.findMany({
    where: {
      status: options.status,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { accountNumber: { contains: search, mode: "insensitive" } },
              { contactName: { contains: search, mode: "insensitive" } },
              { contactEmail: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (page - 1) * SUPPLIER_PAGE_SIZE,
    take: SUPPLIER_PAGE_SIZE + 1,
    include: { _count: { select: { skuMappings: true } } },
  });
  const pageRows = rows.slice(0, SUPPLIER_PAGE_SIZE);
  const openOrders: Array<{ supplierId: string; _count: { _all: number } }> =
    pageRows.length === 0
      ? []
      : await db.purchaseOrder.groupBy({
          by: ["supplierId"],
          where: {
            supplierId: { in: pageRows.map((s) => s.id) },
            status: { in: [...INCOMING_STATUSES] },
            archivedAt: null,
          },
          _count: { _all: true },
        });
  const openBySupplier = new Map(openOrders.map((o) => [o.supplierId, o._count._all]));
  return {
    page,
    hasNextPage: rows.length > SUPPLIER_PAGE_SIZE,
    suppliers: pageRows.map((s): SupplierListItem => ({
      id: s.id,
      name: s.name,
      status: s.status,
      currency: s.currency,
      contactName: s.contactName,
      contactEmail: s.contactEmail,
      defaultLeadTimeDays: s.defaultLeadTimeDays,
      measuredLeadTimeDays: s.leadTimeDays,
      productCount: s._count.skuMappings,
      openOrderCount: openBySupplier.get(s.id) ?? 0,
    })),
  };
}

/** Active suppliers for pickers, in name order. */
export async function listSupplierOptions(
  db: TenantDb,
): Promise<Array<{ id: string; name: string; currency: string }>> {
  return db.supplier.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true, currency: true },
  });
}

export type SupplierProductRow = {
  id: string;
  variantGid: string;
  vendorSku: string | null;
  moq: number;
  packSize: number;
  supplierCost: Prisma.Decimal | null;
  leadTimeDaysOverride: number | null;
  orderUnit: string | null;
  isPreferred: boolean;
  /** Null when the variant is no longer in the synced catalog. */
  variant: VariantSnapshot | null;
};

export type PriceTierRow = {
  id: string;
  variantGid: string;
  minQty: number;
  maxQty: number | null;
  unitCost: Prisma.Decimal;
};

export async function getSupplierDetail(
  db: TenantDb,
  supplierId: string,
  options: { productPage?: number } = {},
) {
  const supplier: SupplierWithHistory | null = await db.supplier.findFirst({
    where: { id: supplierId },
    include: {
      leadTimeSnapshots: { orderBy: { recordedAt: "desc" }, take: 10 },
      _count: { select: { skuMappings: true, purchaseOrders: true } },
    },
  });
  if (!supplier) throw notFound("Supplier");

  const productPage = Math.max(1, options.productPage ?? 1);
  const mappings: SupplierSkuMapping[] = await db.supplierSkuMapping.findMany({
    where: { supplierId },
    orderBy: [{ id: "asc" }],
    skip: (productPage - 1) * PRODUCT_PAGE_SIZE,
    take: PRODUCT_PAGE_SIZE + 1,
  });
  const pageMappings = mappings.slice(0, PRODUCT_PAGE_SIZE);
  const variantGids = pageMappings.map((m) => m.shopifyVariantId);
  const variants = await resolveVariants(db, variantGids.filter(isVariantGid));
  const tiers: VolumePriceTier[] =
    variantGids.length === 0
      ? []
      : await db.volumePriceTier.findMany({
          where: { supplierId, variantId: { in: variantGids } },
          orderBy: [{ variantId: "asc" }, { minQty: "asc" }],
        });

  const products: SupplierProductRow[] = pageMappings.map((m) => ({
    id: m.id,
    variantGid: m.shopifyVariantId,
    vendorSku: m.vendorSku,
    moq: m.moq,
    packSize: m.packSize,
    supplierCost: m.supplierCost,
    leadTimeDaysOverride: m.leadTimeDaysOverride,
    orderUnit: m.orderUnit,
    isPreferred: m.isPreferred,
    variant: variants.get(m.shopifyVariantId) ?? null,
  }));
  const priceTiers: PriceTierRow[] = tiers.map((t) => ({
    id: t.id,
    variantGid: t.variantId,
    minQty: t.minQty,
    maxQty: t.maxQty,
    unitCost: t.unitCost,
  }));

  return {
    supplier,
    products,
    priceTiers,
    productPage,
    hasNextProductPage: mappings.length > PRODUCT_PAGE_SIZE,
    productCount: supplier._count.skuMappings,
    purchaseOrderCount: supplier._count.purchaseOrders,
  };
}

function comparable(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (Prisma.Decimal.isDecimal(value)) return value.toFixed();
  return value as string | number | boolean;
}

function changedFields(before: Supplier, after: SupplierProfileInput): string[] {
  return (Object.keys(after) as Array<keyof SupplierProfileInput>).filter(
    (key) => comparable(before[key]) !== comparable(after[key]),
  );
}

export async function createSupplier(
  db: TenantDb,
  actor: PurchasingActor,
  input: SupplierProfileInput,
): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    await assertNameAvailable(tx, input.name);
    const supplier: Supplier = await tx.supplier.create({ data: input });
    await recordPurchasingEvent(tx, {
      subjectType: "SUPPLIER",
      subjectId: supplier.id,
      action: "supplier.created",
      actor,
      details: { name: supplier.name },
    });
    return { id: supplier.id };
  });
}

export async function updateSupplier(
  db: TenantDb,
  actor: PurchasingActor,
  supplierId: string,
  input: SupplierProfileInput,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const supplier = await requireActiveSupplier(tx, supplierId);
    const fields = changedFields(supplier, input);
    if (fields.length === 0) return;
    if (fields.includes("name")) {
      await assertNameAvailable(tx, input.name, supplierId);
    }
    await tx.supplier.update({ where: { id: supplierId }, data: input });
    await recordPurchasingEvent(tx, {
      subjectType: "SUPPLIER",
      subjectId: supplierId,
      action: "supplier.updated",
      actor,
      details: { fields },
    });
  });
}

export async function setSupplierArchived(
  db: TenantDb,
  actor: PurchasingActor,
  supplierId: string,
  archived: boolean,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const supplier = await requireSupplier(tx, supplierId);
    const target: SupplierStatus = archived ? "ARCHIVED" : "ACTIVE";
    if (supplier.status === target) return;
    if (!archived) await assertNameAvailable(tx, supplier.name, supplierId);
    await tx.supplier.update({
      where: { id: supplierId },
      data: { status: target, archivedAt: archived ? new Date() : null },
    });
    await recordPurchasingEvent(tx, {
      subjectType: "SUPPLIER",
      subjectId: supplierId,
      action: archived ? "supplier.archived" : "supplier.restored",
      actor,
    });
  });
}

/** Deletes a supplier that has never had a purchase order. */
export async function deleteSupplier(
  db: TenantDb,
  actor: PurchasingActor,
  supplierId: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const supplier = await requireSupplier(tx, supplierId);
    const orders: number = await tx.purchaseOrder.count({ where: { supplierId } });
    if (orders > 0) {
      throw new PurchasingError(
        "invalid_state",
        "This supplier has purchase orders and cannot be deleted. Archive it instead.",
      );
    }
    await tx.supplier.delete({ where: { id: supplierId } });
    await recordPurchasingEvent(tx, {
      subjectType: "SUPPLIER",
      subjectId: supplierId,
      action: "supplier.deleted",
      actor,
      details: { name: supplier.name },
    });
  });
}

/**
 * Link variants to a supplier with default terms. Variants already linked are
 * left untouched; variants unknown to both the catalog and Shopify are reported.
 */
export async function addSupplierProducts(
  db: TenantDb,
  actor: PurchasingActor,
  supplierId: string,
  variantGids: readonly string[],
  options: { admin?: AdminGraphQLClient } = {},
): Promise<{ added: number; alreadyLinked: number; unavailable: number }> {
  const requested = [...new Set(variantGids)];
  if (requested.length === 0) return { added: 0, alreadyLinked: 0, unavailable: 0 };
  if (requested.length > MAX_PRODUCTS_PER_ADD) {
    throw invalidInput(`Add at most ${MAX_PRODUCTS_PER_ADD} products at a time.`);
  }
  assertVariantGids(requested);
  const variants = await resolveVariants(db, requested, options);
  const available = requested.filter((gid) => variants.has(gid));

  return db.$transaction(async (tx) => {
    await requireActiveSupplier(tx, supplierId);
    const existing: Array<{ shopifyVariantId: string }> =
      available.length === 0
        ? []
        : await tx.supplierSkuMapping.findMany({
            where: { supplierId, shopifyVariantId: { in: available } },
            select: { shopifyVariantId: true },
          });
    const linked = new Set(existing.map((m) => m.shopifyVariantId));
    const toCreate = available.filter((gid) => !linked.has(gid));
    let added = 0;
    for (let i = 0; i < toCreate.length; i += CREATE_CHUNK) {
      const result: { count: number } = await tx.supplierSkuMapping.createMany({
        data: toCreate.slice(i, i + CREATE_CHUNK).map((gid) => ({
          supplierId,
          shopifyVariantId: gid,
        })),
        // A concurrent add of the same product must not fail this one.
        skipDuplicates: true,
      });
      added += result.count;
    }
    if (added > 0) {
      await recordPurchasingEvent(tx, {
        subjectType: "SUPPLIER",
        subjectId: supplierId,
        action: "supplier.products_added",
        actor,
        details: { count: added },
      });
    }
    return {
      added,
      alreadyLinked: available.length - added,
      unavailable: requested.length - available.length,
    };
  });
}

/** Shopify product vendors in the synced catalog, for the vendor import picker. */
export async function listCatalogVendors(db: TenantDb): Promise<string[]> {
  const rows: Array<{ vendor: string | null }> = await db.shopifyProductFact.groupBy({
    by: ["vendor"],
    where: { existenceState: "LIVE", vendor: { not: null } },
    orderBy: { vendor: "asc" },
  });
  return rows
    .map((row) => row.vendor?.trim() ?? "")
    .filter((vendor) => vendor.length > 0);
}

/** Link every live variant of a Shopify vendor's products to the supplier. */
export async function addSupplierProductsByVendor(
  db: TenantDb,
  actor: PurchasingActor,
  supplierId: string,
  vendor: string,
): Promise<{ added: number; alreadyLinked: number; unavailable: number }> {
  const name = vendor.trim();
  if (!name) throw invalidInput("Choose a vendor.");
  const products: Array<{ shopifyGid: string }> = await db.shopifyProductFact.findMany({
    where: { vendor: name, existenceState: "LIVE" },
    select: { shopifyGid: true },
  });
  if (products.length === 0) {
    throw invalidInput(`No products with the vendor "${name}" are in the synced catalog.`);
  }
  const variantGids: string[] = [];
  for (let i = 0; i < products.length; i += CREATE_CHUNK) {
    const rows: Array<{ shopifyGid: string }> = await db.shopifyVariantFact.findMany({
      where: {
        shopifyProductGid: { in: products.slice(i, i + CREATE_CHUNK).map((p) => p.shopifyGid) },
        existenceState: "LIVE",
      },
      select: { shopifyGid: true },
      orderBy: { shopifyGid: "asc" },
    });
    variantGids.push(...rows.map((row) => row.shopifyGid));
    if (variantGids.length > MAX_PRODUCTS_PER_ADD) {
      throw invalidInput(
        `"${name}" has more than ${MAX_PRODUCTS_PER_ADD} variants. Add its products in smaller groups.`,
      );
    }
  }
  return addSupplierProducts(db, actor, supplierId, variantGids);
}

/**
 * Create or update the terms for one product of a supplier. Marking it
 * preferred clears the flag on the variant's other suppliers.
 */
export async function saveSupplierProduct(
  db: TenantDb,
  actor: PurchasingActor,
  supplierId: string,
  input: SupplierProductInput,
  options: { admin?: AdminGraphQLClient } = {},
): Promise<{ id: string; created: boolean }> {
  assertSupplierProduct(input);
  const terms = {
    vendorSku: input.vendorSku,
    moq: input.moq,
    packSize: input.packSize,
    supplierCost: input.supplierCost,
    leadTimeDaysOverride: input.leadTimeDaysOverride,
    orderUnit: input.orderUnit,
    isPreferred: input.isPreferred,
  };

  // An unknown or archived supplier is reported before the product lookup.
  await requireActiveSupplier(db, supplierId);
  const existing: { id: string } | null = await db.supplierSkuMapping.findFirst({
    where: { supplierId, shopifyVariantId: input.variantGid },
    select: { id: true },
  });
  if (!existing) {
    const variants = await resolveVariants(db, [input.variantGid], options);
    if (!variants.has(input.variantGid)) {
      throw invalidInput("That product is no longer available in Shopify.");
    }
  }

  return db.$transaction(async (tx) => {
    await requireActiveSupplier(tx, supplierId);
    const mapping: SupplierSkuMapping = await tx.supplierSkuMapping.upsert({
      where: {
        shopId_supplierId_shopifyVariantId: {
          shopId: tx.authority.shopId,
          supplierId,
          shopifyVariantId: input.variantGid,
        },
      },
      create: { supplierId, shopifyVariantId: input.variantGid, ...terms },
      update: terms,
    });
    if (input.isPreferred) {
      await tx.supplierSkuMapping.updateMany({
        where: {
          shopifyVariantId: input.variantGid,
          isPreferred: true,
          id: { not: mapping.id },
        },
        data: { isPreferred: false },
      });
    }
    await recordPurchasingEvent(tx, {
      subjectType: "SUPPLIER",
      subjectId: supplierId,
      action: existing ? "supplier.product_updated" : "supplier.product_added",
      actor,
      details: { variantGid: input.variantGid },
    });
    return { id: mapping.id, created: !existing };
  });
}

/** Unlink a product from a supplier, together with its volume pricing. */
export async function removeSupplierProduct(
  db: TenantDb,
  actor: PurchasingActor,
  supplierId: string,
  mappingId: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    await requireActiveSupplier(tx, supplierId);
    const mapping: SupplierSkuMapping | null = await tx.supplierSkuMapping.findFirst({
      where: { id: mappingId, supplierId },
    });
    if (!mapping) throw notFound("Supplier product");
    await tx.volumePriceTier.deleteMany({
      where: { supplierId, variantId: mapping.shopifyVariantId },
    });
    await tx.supplierSkuMapping.deleteMany({ where: { id: mappingId, supplierId } });
    await recordPurchasingEvent(tx, {
      subjectType: "SUPPLIER",
      subjectId: supplierId,
      action: "supplier.product_removed",
      actor,
      details: { variantGid: mapping.shopifyVariantId },
    });
  });
}

function tiersOverlap(
  a: { minQty: number; maxQty: number | null },
  b: { minQty: number; maxQty: number | null },
): boolean {
  const aMax = a.maxQty ?? Number.POSITIVE_INFINITY;
  const bMax = b.maxQty ?? Number.POSITIVE_INFINITY;
  return a.minQty <= bMax && b.minQty <= aMax;
}

export async function addPriceTier(
  db: TenantDb,
  actor: PurchasingActor,
  supplierId: string,
  input: PriceTierInput,
): Promise<{ id: string }> {
  assertPriceTier(input);
  try {
    return await db.$transaction(
      async (tx) => {
        await requireActiveSupplier(tx, supplierId);
        const mapping: { id: string } | null = await tx.supplierSkuMapping.findFirst({
          where: { supplierId, shopifyVariantId: input.variantGid },
          select: { id: true },
        });
        if (!mapping) {
          throw invalidInput("Add the product to this supplier before pricing it.");
        }
        const tiers: Array<{ minQty: number; maxQty: number | null }> =
          await tx.volumePriceTier.findMany({
            where: { supplierId, variantId: input.variantGid },
            select: { minQty: true, maxQty: true },
          });
        const clash = tiers.find((tier) => tiersOverlap(tier, input));
        if (clash) {
          const range = clash.maxQty === null ? `${clash.minQty}+` : `${clash.minQty}-${clash.maxQty}`;
          throw invalidInput("Fix the highlighted field.", {
            minQty: `This range overlaps the existing ${range} tier.`,
          });
        }
        const tier: VolumePriceTier = await tx.volumePriceTier.create({
          data: {
            supplierId,
            variantId: input.variantGid,
            minQty: input.minQty,
            maxQty: input.maxQty,
            unitCost: input.unitCost,
          },
        });
        await recordPurchasingEvent(tx, {
          subjectType: "SUPPLIER",
          subjectId: supplierId,
          action: "supplier.price_tier_added",
          actor,
          details: { variantGid: input.variantGid, minQty: input.minQty, maxQty: input.maxQty },
        });
        return { id: tier.id };
      },
      // Two overlapping tiers added at once must not both pass the overlap check.
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if ((error as { code?: unknown }).code === "P2034") {
      throw new PurchasingError(
        "conflict",
        "Pricing for this product was changed at the same time. Try again.",
      );
    }
    throw error;
  }
}

export async function removePriceTier(
  db: TenantDb,
  actor: PurchasingActor,
  supplierId: string,
  tierId: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    await requireActiveSupplier(tx, supplierId);
    const tier: VolumePriceTier | null = await tx.volumePriceTier.findFirst({
      where: { id: tierId, supplierId },
    });
    if (!tier) throw notFound("Price tier");
    await tx.volumePriceTier.deleteMany({ where: { id: tierId, supplierId } });
    await recordPurchasingEvent(tx, {
      subjectType: "SUPPLIER",
      subjectId: supplierId,
      action: "supplier.price_tier_removed",
      actor,
      details: { variantGid: tier.variantId, minQty: tier.minQty, maxQty: tier.maxQty },
    });
  });
}
