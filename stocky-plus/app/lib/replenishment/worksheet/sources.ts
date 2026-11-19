/**
 * What the worksheet needs from purchasing: open purchase-order quantities,
 * each variant's supplier terms, and the supplier list. The worksheet takes
 * these as functions so the purchasing module stays the only place that
 * reads supplier and purchase-order tables.
 */
import type { TenantDb } from "../../../tenant/tenant-db.server";

export type SupplierLeadTimeSource =
  | "variant_override"
  | "supplier_default"
  | "measured";

export type SupplierTerms = {
  supplierId: string;
  supplierName: string;
  currency: string | null;
  vendorSku: string | null;
  moq: number | null;
  packSize: number | null;
  /** Decimal string in the supplier's currency. */
  supplierCost: string | null;
  isPreferred: boolean;
  leadTimeDays: number | null;
  leadTimeSource: SupplierLeadTimeSource | null;
};

export type VariantSuppliers = {
  preferred: SupplierTerms | null;
  all: SupplierTerms[];
};

export type WorksheetSources = {
  /** Units on open purchase orders in this app, by variant. */
  getIncomingQuantities(
    db: TenantDb,
    input: { variantGids: readonly string[]; locationGid?: string },
  ): Promise<Map<string, number>>;
  getSupplierTerms(
    db: TenantDb,
    input: { variantGids: readonly string[] },
  ): Promise<Map<string, VariantSuppliers>>;
  listSuppliers(db: TenantDb): Promise<Array<{ id: string; name: string }>>;
  /** Every variant the supplier has terms for. */
  getSupplierVariantGids(db: TenantDb, supplierId: string): Promise<string[]>;
};
