/**
 * Purchasing figures other modules plan against: stock on order and the terms
 * each supplier offers for a product. Read-only.
 */
import type { Supplier, SupplierSkuMapping } from "@prisma/client";
import type { TenantDb } from "../../tenant/tenant-db.server";
import { INCOMING_STATUSES } from "../../lib/purchasing/status";
import { isLocationGid } from "./locations.server";
import { remainingQuantity } from "./purchase-order-records.server";
import { assertVariantGids } from "./variants.server";

/** Above this many variants the filter runs in memory instead of in SQL. */
const VARIANT_FILTER_LIMIT = 1000;
const TERMS_CHUNK = 1000;

export type LeadTimeSource = "variant_override" | "supplier_default" | "measured";

export type SupplierTerms = {
  supplierId: string;
  supplierName: string;
  /** Currency `supplierCost` is quoted in. */
  currency: string;
  vendorSku: string | null;
  /** Minimum order quantity in units; 1 means none. */
  moq: number;
  /** Units per pack; 1 means sold singly. */
  packSize: number;
  /** Decimal string in the supplier's currency; null when no cost is on file. */
  supplierCost: string | null;
  orderUnit: string | null;
  isPreferred: boolean;
  /** Whole days; a measured average is rounded up. */
  leadTimeDays: number | null;
  leadTimeSource: LeadTimeSource | null;
};

export type VariantSupplierTerms = {
  /** The supplier flagged as preferred, or the only one; otherwise null. */
  preferred: SupplierTerms | null;
  /** Preferred first, then by supplier name. */
  all: SupplierTerms[];
};

type IncomingLine = {
  shopifyVariantId: string;
  orderedQty: number;
  receivedQty: number;
  cancelledQty: number;
};

/**
 * Units on order and not yet received, per variant: the open remainder of
 * every line on sent, ordered and partially received purchase orders that are
 * not archived. Drafts, cancelled and closed orders count for nothing. Variants
 * with nothing incoming are absent from the map.
 */
export async function getIncomingQuantities(
  db: TenantDb,
  options: { variantGids?: readonly string[]; locationGid?: string } = {},
): Promise<Map<string, number>> {
  const incoming = new Map<string, number>();
  const wanted = options.variantGids ? new Set(options.variantGids) : null;
  if (wanted) {
    assertVariantGids([...wanted]);
    if (wanted.size === 0) return incoming;
  }
  if (options.locationGid !== undefined && !isLocationGid(options.locationGid)) {
    return incoming;
  }

  const filterInQuery = wanted !== null && wanted.size <= VARIANT_FILTER_LIMIT;
  const orders: Array<{ lineItems: IncomingLine[] }> = await db.purchaseOrder.findMany({
    where: {
      status: { in: [...INCOMING_STATUSES] },
      archivedAt: null,
      ...(options.locationGid ? { locationId: options.locationGid } : {}),
    },
    select: {
      lineItems: {
        ...(filterInQuery ? { where: { shopifyVariantId: { in: [...wanted] } } } : {}),
        select: {
          shopifyVariantId: true,
          orderedQty: true,
          receivedQty: true,
          cancelledQty: true,
        },
      },
    },
  });

  for (const order of orders) {
    for (const line of order.lineItems) {
      if (wanted && !wanted.has(line.shopifyVariantId)) continue;
      const remaining = remainingQuantity(line);
      if (remaining === 0) continue;
      incoming.set(
        line.shopifyVariantId,
        (incoming.get(line.shopifyVariantId) ?? 0) + remaining,
      );
    }
  }
  return incoming;
}

function leadTimeFor(
  mapping: SupplierSkuMapping,
  supplier: Supplier,
): Pick<SupplierTerms, "leadTimeDays" | "leadTimeSource"> {
  if (mapping.leadTimeDaysOverride !== null) {
    return { leadTimeDays: mapping.leadTimeDaysOverride, leadTimeSource: "variant_override" };
  }
  if (supplier.defaultLeadTimeDays !== null) {
    return { leadTimeDays: supplier.defaultLeadTimeDays, leadTimeSource: "supplier_default" };
  }
  if (supplier.leadTimeDays !== null && Number.isFinite(supplier.leadTimeDays)) {
    return {
      leadTimeDays: Math.max(0, Math.ceil(supplier.leadTimeDays)),
      leadTimeSource: "measured",
    };
  }
  return { leadTimeDays: null, leadTimeSource: null };
}

function toTerms(mapping: SupplierSkuMapping, supplier: Supplier): SupplierTerms {
  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
    currency: supplier.currency,
    vendorSku: mapping.vendorSku,
    moq: mapping.moq,
    packSize: mapping.packSize,
    supplierCost: mapping.supplierCost?.toFixed() ?? null,
    orderUnit: mapping.orderUnit,
    isPreferred: mapping.isPreferred,
    ...leadTimeFor(mapping, supplier),
  };
}

/**
 * Supplier terms for each variant, from active suppliers only. A variant no
 * active supplier carries is absent from the map.
 */
export async function getSupplierTerms(
  db: TenantDb,
  options: { variantGids: readonly string[] },
): Promise<Map<string, VariantSupplierTerms>> {
  const variantGids = [...new Set(options.variantGids)];
  assertVariantGids(variantGids);
  const result = new Map<string, VariantSupplierTerms>();
  if (variantGids.length === 0) return result;

  const mappings: SupplierSkuMapping[] = [];
  for (let start = 0; start < variantGids.length; start += TERMS_CHUNK) {
    const rows: SupplierSkuMapping[] = await db.supplierSkuMapping.findMany({
      where: { shopifyVariantId: { in: variantGids.slice(start, start + TERMS_CHUNK) } },
    });
    mappings.push(...rows);
  }
  if (mappings.length === 0) return result;

  const suppliers: Supplier[] = await db.supplier.findMany({
    where: {
      id: { in: [...new Set(mappings.map((mapping) => mapping.supplierId))] },
      status: "ACTIVE",
    },
  });
  const suppliersById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));

  for (const mapping of mappings) {
    const supplier = suppliersById.get(mapping.supplierId);
    if (!supplier) continue;
    const entry = result.get(mapping.shopifyVariantId) ?? { preferred: null, all: [] };
    entry.all.push(toTerms(mapping, supplier));
    result.set(mapping.shopifyVariantId, entry);
  }
  for (const entry of result.values()) {
    entry.all.sort(
      (a, b) =>
        Number(b.isPreferred) - Number(a.isPreferred) ||
        a.supplierName.localeCompare(b.supplierName) ||
        a.supplierId.localeCompare(b.supplierId),
    );
    entry.preferred =
      entry.all.find((terms) => terms.isPreferred) ??
      (entry.all.length === 1 ? entry.all[0]! : null);
  }
  return result;
}

/**
 * Variant GIDs the supplier has terms for, in a stable order. Empty when the
 * supplier is archived or belongs to another shop.
 */
export async function listSupplierVariantGids(
  db: TenantDb,
  supplierId: string,
): Promise<string[]> {
  const supplier: { id: string } | null = await db.supplier.findFirst({
    where: { id: supplierId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!supplier) return [];
  const mappings: Array<{ shopifyVariantId: string }> = await db.supplierSkuMapping.findMany({
    where: { supplierId },
    select: { shopifyVariantId: true },
    orderBy: { shopifyVariantId: "asc" },
  });
  return mappings.map((mapping) => mapping.shopifyVariantId);
}
