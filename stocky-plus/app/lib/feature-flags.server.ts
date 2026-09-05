/**
 * Kill switches for unsafe inventory / cost writes (Phase 0).
 *
 * Defaults are OFF unless explicitly enabled for development testing.
 * Release gates in docs/product/06_ROADMAP_AND_RELEASE_GATES.md must pass
 * before enabling outside controlled test shops.
 */

function envFlag(name: string, defaultEnabled = false): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultEnabled;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export const featureFlags = {
  /** Stocktake completion may call inventoryAdjustQuantities */
  stocktakeInventoryWrites: () => envFlag("FEATURE_STOCKTAKE_INVENTORY_WRITES"),
  /** Manual adjustment mutations (future module; gate now) */
  adjustmentWrites: () => envFlag("FEATURE_ADJUSTMENT_WRITES"),
  /** PO receive may call inventoryAdjustQuantities */
  receiptWrites: () => envFlag("FEATURE_RECEIPT_WRITES"),
  /** Sync average/landed cost into Shopify InventoryItem.cost */
  costSync: () => envFlag("FEATURE_COST_SYNC"),
  /** Transfer create/ship/complete mutations against Shopify */
  transferWrites: () => envFlag("FEATURE_TRANSFER_WRITES"),
  /**
   * PR5 absence confirmation may tombstone terminal canonical identities.
   * This destructive read-model transition is separately authorized and
   * remains DEFAULT OFF through F3.
   */
  pr5AbsenceTombstone: () => envFlag("FEATURE_PR5_ABSENCE_TOMBSTONE"),
} as const;

export type InventoryWriteCapability =
  | "stocktakeInventoryWrites"
  | "adjustmentWrites"
  | "receiptWrites"
  | "costSync"
  | "transferWrites";

export function assertInventoryWriteEnabled(
  capability: InventoryWriteCapability,
): void {
  if (!featureFlags[capability]()) {
    const envName: Record<InventoryWriteCapability, string> = {
      stocktakeInventoryWrites: "FEATURE_STOCKTAKE_INVENTORY_WRITES",
      adjustmentWrites: "FEATURE_ADJUSTMENT_WRITES",
      receiptWrites: "FEATURE_RECEIPT_WRITES",
      costSync: "FEATURE_COST_SYNC",
      transferWrites: "FEATURE_TRANSFER_WRITES",
    };
    throw new Error(
      `Inventory write capability "${capability}" is disabled. ` +
        `Enable ${envName[capability]}=true only in approved test environments after release gates pass.`,
    );
  }
}

export function isInventoryWriteEnabled(
  capability: InventoryWriteCapability,
): boolean {
  return featureFlags[capability]();
}
