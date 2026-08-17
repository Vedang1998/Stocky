import { Prisma } from "@prisma/client";
import {
  LEGACY_VARIANT_TITLE_SEPARATOR,
  LEGACY_WEIGHT_MAX_ABS,
} from "./constants";
import { CompatibilityProjectionError } from "./errors";
import { legacySnapshotDate } from "./snapshot-date";
import type {
  CanonicalInventoryItemRead,
  CanonicalInventoryLevelRead,
  CanonicalProductRead,
  CanonicalVariantRead,
  LegacySnapshotFields,
  LegacyVariantCacheFields,
  SnapshotProjectionPlan,
  VariantProjectionPlan,
} from "./types";

export function mapLegacyVariantTitle(
  variantTitle: string,
  product: CanonicalProductRead | null,
): string {
  if (product?.existenceState === "LIVE" && product.title.length > 0) {
    return `${product.title}${LEGACY_VARIANT_TITLE_SEPARATOR}${variantTitle}`;
  }
  return variantTitle;
}

export function selectLiveInventoryItem(
  items: CanonicalInventoryItemRead[],
): CanonicalInventoryItemRead | null {
  const live = items
    .filter((item) => item.existenceState === "LIVE")
    .sort((a, b) => a.shopifyGid.localeCompare(b.shopifyGid));
  return live[0] ?? null;
}

export function mapLegacyWeight(
  value: Prisma.Decimal | null,
): Prisma.Decimal | null {
  if (value == null) return null;
  const quantized = new Prisma.Decimal(value).toDecimalPlaces(4);
  if (quantized.abs().gte(LEGACY_WEIGHT_MAX_ABS)) {
    throw new CompatibilityProjectionError(
      "legacy_weight_overflow",
      `Canonical weight ${value.toString()} exceeds ShopifyVariantCache DECIMAL(10, 4)`,
      { retryable: false },
    );
  }
  return quantized;
}

export function mapVariantToLegacyCache(
  variant: CanonicalVariantRead,
  now: Date,
): VariantProjectionPlan {
  if (variant.existenceState !== "LIVE") {
    return {
      action: "tombstone",
      shopifyVariantId: variant.shopifyGid,
      snapshotDate: legacySnapshotDate(now),
    };
  }

  const liveItem = selectLiveInventoryItem(variant.inventoryItems);
  const product =
    variant.product?.existenceState === "LIVE" ? variant.product : null;

  const fields: LegacyVariantCacheFields = {
    shopifyVariantId: variant.shopifyGid,
    shopifyProductId: variant.shopifyProductGid,
    title: mapLegacyVariantTitle(variant.title, product),
    sku: variant.sku,
    barcode: variant.barcode,
    imageUrl: product?.featuredMediaUrl ?? null,
    inventoryItemId: liveItem?.shopifyGid ?? null,
    weight: mapLegacyWeight(liveItem?.weightValue ?? null),
    weightUnit: liveItem?.weightUnit ?? null,
  };

  return { action: "upsert", fields };
}

function liveAvailableQuantity(
  level: CanonicalInventoryLevelRead,
): number | null {
  if (level.existenceState !== "LIVE") return null;
  if (level.location?.existenceState !== "LIVE") return null;
  if (level.inventoryItem?.existenceState !== "LIVE") return null;
  if (level.variantExistenceState !== "LIVE") return null;
  const variantGid = level.inventoryItem.shopifyVariantGid;
  if (!variantGid) return null;
  return level.availableQuantity ?? 0;
}

export function mapInventoryLevelToLegacySnapshot(
  level: CanonicalInventoryLevelRead,
  now: Date,
): SnapshotProjectionPlan | null {
  const variantGid = level.inventoryItem?.shopifyVariantGid;
  if (!variantGid) {
    return null;
  }

  const liveQty = liveAvailableQuantity(level);
  const fields: LegacySnapshotFields = {
    shopifyVariantId: variantGid,
    locationId: level.locationGid,
    snapshotDate: legacySnapshotDate(now),
    quantityAvailable: liveQty ?? 0,
  };
  return { action: "upsert", fields };
}
