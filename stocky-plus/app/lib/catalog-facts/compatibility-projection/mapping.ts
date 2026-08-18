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

function inventoryLevelIdentity(level: CanonicalInventoryLevelRead) {
  return {
    kind: "InventoryLevel" as const,
    inventoryItemGid: level.inventoryItemGid,
    locationGid: level.locationGid,
  };
}

function failUnknownLiveInventory(
  level: CanonicalInventoryLevelRead,
  code: string,
  message: string,
): never {
  throw new CompatibilityProjectionError(code, message, {
    retryable: true,
    identity: inventoryLevelIdentity(level),
  });
}

function hasExplicitNonLiveEvidence(
  level: CanonicalInventoryLevelRead,
): boolean {
  return (
    level.existenceState === "ABSENT" ||
    level.inventoryItem?.existenceState === "ABSENT" ||
    level.location?.existenceState === "ABSENT" ||
    level.variantExistenceState === "ABSENT"
  );
}

/**
 * Today's InventorySnapshot.quantityAvailable is copied from canonical
 * `availableQuantity` only when the LIVE inventory graph is fully known.
 *
 * Explicit ABSENT (level / item / location / variant) may project zero.
 * Null/unknown canonical available is not Shopify zero and must fail closed.
 * Canonical 0 and negative integers are copied exactly; they are not clamped.
 */
function resolveSnapshotQuantity(level: CanonicalInventoryLevelRead): number {
  if (hasExplicitNonLiveEvidence(level)) {
    return 0;
  }

  if (level.location == null || level.location.existenceState !== "LIVE") {
    failUnknownLiveInventory(
      level,
      "canonical_location_state_missing",
      "Canonical InventoryLevel is LIVE but Location existence is unknown rather than explicitly ABSENT; F2C will not fabricate Shopify zero",
    );
  }

  if (
    level.variantExistenceState == null ||
    level.variantExistenceState !== "LIVE"
  ) {
    failUnknownLiveInventory(
      level,
      "canonical_variant_state_missing",
      "Canonical InventoryLevel is LIVE but ProductVariant existence is unknown rather than explicitly ABSENT; F2C will not fabricate Shopify zero",
    );
  }

  const availableQuantity = level.availableQuantity;
  if (
    typeof availableQuantity !== "number" ||
    !Number.isInteger(availableQuantity)
  ) {
    failUnknownLiveInventory(
      level,
      "canonical_available_quantity_missing",
      "Canonical InventoryLevel is LIVE but availableQuantity is unknown; null is not Shopify zero and F2C will not fabricate a quantity",
    );
  }

  return availableQuantity;
}

function requireKnownVariantGid(level: CanonicalInventoryLevelRead): string {
  const variantGid = level.inventoryItem?.shopifyVariantGid;
  if (variantGid == null || variantGid.length === 0) {
    throw new CompatibilityProjectionError(
      "canonical_variant_link_missing",
      "Canonical InventoryItem has no known shopifyVariantGid; F2C cannot invent a variant relationship from SKU, barcode, title, or legacy cache",
      {
        retryable: true,
        identity: inventoryLevelIdentity(level),
      },
    );
  }
  return variantGid;
}

export function mapInventoryLevelToLegacySnapshot(
  level: CanonicalInventoryLevelRead,
  now: Date,
): SnapshotProjectionPlan {
  const variantGid = requireKnownVariantGid(level);
  const quantityAvailable = resolveSnapshotQuantity(level);
  const fields: LegacySnapshotFields = {
    shopifyVariantId: variantGid,
    locationId: level.locationGid,
    snapshotDate: legacySnapshotDate(now),
    quantityAvailable,
  };
  return { action: "upsert", fields };
}
