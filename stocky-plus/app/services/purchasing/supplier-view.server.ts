/**
 * What the supplier pages show, as plain data: decimals are exact strings and
 * every label the page needs comes from here, so the route component never
 * imports a server module.
 */
import type { TenantDb } from "../../tenant/tenant-db.server";
import { decimalToWire } from "../../lib/decimal-wire.server";
import {
  getSupplierDetail,
  NO_CONTACT_METHOD,
  SUPPLIER_CONTACT_METHOD_LABELS,
  SUPPLIER_CONTACT_METHODS,
  type SupplierStatus,
} from "./suppliers.server";
import { variantDisplayName } from "./variants.server";

/** Form values of a supplier profile, as the profile form fields expect them. */
export type SupplierProfileValues = {
  name: string;
  accountNumber: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  preferredContactMethod: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  currency: string;
  paymentTerms: string;
  shippingTerms: string;
  defaultTaxRatePercent: string;
  defaultLeadTimeDays: string;
  defaultRestockDays: string;
  minimumOrderValue: string;
  vendorNotes: string;
};

export type SupplierPriceTierView = {
  id: string;
  minQty: number;
  maxQty: number | null;
  unitCost: string;
};

export type SupplierProductView = {
  id: string;
  variantGid: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  /** The product is no longer in the synced catalog. */
  missing: boolean;
  vendorSku: string | null;
  moq: number;
  packSize: number;
  supplierCost: string | null;
  leadTimeDaysOverride: number | null;
  orderUnit: string | null;
  isPreferred: boolean;
  priceTiers: SupplierPriceTierView[];
};

export type SupplierView = {
  id: string;
  name: string;
  status: SupplierStatus;
  currency: string;
  contactEmail: string | null;
  profile: SupplierProfileValues;
  defaultLeadTimeDays: number | null;
  /** Average of the measured lead times, in days. */
  measuredLeadTimeDays: number | null;
  leadTimeHistory: Array<{ id: string; days: number; recordedAt: Date }>;
  products: SupplierProductView[];
  productCount: number;
  productPage: number;
  hasNextProductPage: boolean;
  purchaseOrderCount: number;
};

export function contactMethodOptions(): Array<{
  value: string;
  label: string;
}> {
  return [
    { value: NO_CONTACT_METHOD, label: "Not set" },
    ...SUPPLIER_CONTACT_METHODS.map((value) => ({
      value,
      label: SUPPLIER_CONTACT_METHOD_LABELS[value],
    })),
  ];
}

/** Empty profile values for the new-supplier form. */
export function emptySupplierProfile(
  currency: string | null,
): SupplierProfileValues {
  return {
    name: "",
    accountNumber: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    preferredContactMethod: NO_CONTACT_METHOD,
    website: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    region: "",
    postalCode: "",
    countryCode: "",
    currency: currency ?? "",
    paymentTerms: "",
    shippingTerms: "",
    defaultTaxRatePercent: "",
    defaultLeadTimeDays: "",
    defaultRestockDays: "",
    minimumOrderValue: "",
    vendorNotes: "",
  };
}

const text = (value: string | null) => value ?? "";
const whole = (value: number | null) => (value === null ? "" : String(value));

export async function getSupplierView(
  db: TenantDb,
  supplierId: string,
  options: { productPage?: number } = {},
): Promise<SupplierView> {
  const detail = await getSupplierDetail(db, supplierId, options);
  const { supplier } = detail;

  const tiersByVariant = new Map<string, SupplierPriceTierView[]>();
  for (const tier of detail.priceTiers) {
    const tiers = tiersByVariant.get(tier.variantGid) ?? [];
    tiers.push({
      id: tier.id,
      minQty: tier.minQty,
      maxQty: tier.maxQty,
      unitCost: decimalToWire(tier.unitCost),
    });
    tiersByVariant.set(tier.variantGid, tiers);
  }

  return {
    id: supplier.id,
    name: supplier.name,
    status: supplier.status,
    currency: supplier.currency,
    contactEmail: supplier.contactEmail,
    profile: {
      name: supplier.name,
      accountNumber: text(supplier.accountNumber),
      contactName: text(supplier.contactName),
      contactEmail: text(supplier.contactEmail),
      contactPhone: text(supplier.contactPhone),
      preferredContactMethod:
        supplier.preferredContactMethod ?? NO_CONTACT_METHOD,
      website: text(supplier.website),
      addressLine1: text(supplier.addressLine1),
      addressLine2: text(supplier.addressLine2),
      city: text(supplier.city),
      region: text(supplier.region),
      postalCode: text(supplier.postalCode),
      countryCode: text(supplier.countryCode),
      currency: supplier.currency,
      paymentTerms: text(supplier.paymentTerms),
      shippingTerms: text(supplier.shippingTerms),
      defaultTaxRatePercent:
        supplier.defaultTaxRatePercent === null
          ? ""
          : decimalToWire(supplier.defaultTaxRatePercent),
      defaultLeadTimeDays: whole(supplier.defaultLeadTimeDays),
      defaultRestockDays: whole(supplier.defaultRestockDays),
      minimumOrderValue:
        supplier.minimumOrderValue === null
          ? ""
          : decimalToWire(supplier.minimumOrderValue),
      vendorNotes: text(supplier.vendorNotes),
    },
    defaultLeadTimeDays: supplier.defaultLeadTimeDays,
    measuredLeadTimeDays: supplier.leadTimeDays,
    leadTimeHistory: supplier.leadTimeSnapshots.map((snapshot) => ({
      id: snapshot.id,
      days: snapshot.leadTimeDays,
      recordedAt: snapshot.recordedAt,
    })),
    products: detail.products.map((product) => ({
      id: product.id,
      variantGid: product.variantGid,
      name: product.variant
        ? variantDisplayName(product.variant)
        : "Product no longer in Shopify",
      sku: product.variant?.sku ?? null,
      barcode: product.variant?.barcode ?? null,
      missing: product.variant === null,
      vendorSku: product.vendorSku,
      moq: product.moq,
      packSize: product.packSize,
      supplierCost:
        product.supplierCost === null
          ? null
          : decimalToWire(product.supplierCost),
      leadTimeDaysOverride: product.leadTimeDaysOverride,
      orderUnit: product.orderUnit,
      isPreferred: product.isPreferred,
      priceTiers: tiersByVariant.get(product.variantGid) ?? [],
    })),
    productCount: detail.productCount,
    productPage: detail.productPage,
    hasNextProductPage: detail.hasNextProductPage,
    purchaseOrderCount: detail.purchaseOrderCount,
  };
}

/** Which of these variants the supplier already sells. */
export async function linkedVariantGids(
  db: TenantDb,
  supplierId: string,
  variantGids: readonly string[],
): Promise<Set<string>> {
  if (variantGids.length === 0) return new Set();
  const rows: Array<{ shopifyVariantId: string }> =
    await db.supplierSkuMapping.findMany({
      where: { supplierId, shopifyVariantId: { in: [...variantGids] } },
      select: { shopifyVariantId: true },
    });
  return new Set(rows.map((row) => row.shopifyVariantId));
}
