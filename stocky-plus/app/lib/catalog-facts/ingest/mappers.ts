import {
  mapInventoryItemNode,
  mapInventoryLevelNode,
  mapProductNode,
  mapProductVariantNode,
} from "../admin-read/resources";
import type { UnitCostAccess } from "../admin-read/types";
import type {
  CanonicalObservation,
  FullSyncCanonicalObservation,
  QuantityName,
} from "../apply/types";
import type {
  JsonlBulkDomain,
  MappedJsonlLine,
  ParsedJsonlLine,
} from "./types";

const QUANTITY_NAME_MAP: Record<string, QuantityName> = {
  available: "available",
  on_hand: "onHand",
  incoming: "incoming",
  committed: "committed",
  reserved: "reserved",
  damaged: "damaged",
  safety_stock: "safetyStock",
  quality_control: "qualityControl",
};

function date(value: string | null | undefined): Date | null {
  return value == null ? null : new Date(value);
}

function fullSyncBase(input: MapperInput) {
  return {
    observationKind: "full_sync" as const,
    existenceKind: "LIVE_FULL_SYNC_PRESENT" as const,
    existenceObservedAt: input.observedAt,
    sourceKind: "FULL_SYNC" as const,
    fenceGeneration: input.fenceGeneration,
    epochId: input.epochId,
    ingestBatchId: input.ingestBatchId,
    lastSyncRunId: input.syncRunId,
    lastDurableJobId: input.durableJobId,
  };
}

export type MapperInput = {
  shopId: string;
  domain: JsonlBulkDomain;
  line: ParsedJsonlLine;
  fenceGeneration: bigint;
  epochId: string;
  syncRunId: string;
  durableJobId: string;
  ingestBatchId: string;
  observedAt: Date;
  currencyCode: string;
  unitCostAccess: UnitCostAccess;
  unitCostSelected: boolean;
};

function mapProduct(input: MapperInput): FullSyncCanonicalObservation {
  const product = mapProductNode(input.line.value);
  return {
    ...fullSyncBase(input),
    identity: {
      shopId: input.shopId,
      resourceKind: "Product",
      shopifyGid: product.id,
    },
    shopifyCreatedAt: date(product.shopifyCreatedAt),
    shopifyUpdatedAt: date(product.shopifyUpdatedAt),
    shopifyLegacyResourceId: product.legacyResourceId,
    attributes: {
      title: product.title,
      handle: product.handle,
      vendor: product.vendor,
      productType: product.productType,
      tags: product.tags,
      status: product.status as "ACTIVE" | "ARCHIVED" | "DRAFT" | "UNLISTED",
      featuredMediaUrl: product.featuredMediaUrl,
    },
  };
}

function mapVariantAndItem(input: MapperInput): CanonicalObservation[] {
  const parentId = input.line.value.__parentId;
  const productGid =
    typeof parentId === "string" &&
    parentId.startsWith("gid://shopify/Product/")
      ? parentId
      : null;
  if (!productGid) {
    throw new Error("catalog_variant_parent_gid_missing");
  }
  const variant = mapProductVariantNode({
    ...input.line.value,
    product: { id: productGid },
  });
  const variantObservation: FullSyncCanonicalObservation = {
    ...fullSyncBase(input),
    identity: {
      shopId: input.shopId,
      resourceKind: "ProductVariant",
      shopifyGid: variant.id,
    },
    shopifyCreatedAt: date(variant.shopifyCreatedAt),
    shopifyUpdatedAt: date(variant.shopifyUpdatedAt),
    shopifyLegacyResourceId: variant.legacyResourceId,
    attributes: {
      shopifyProductGid: productGid,
      title: variant.title,
      displayName: variant.displayName,
      selectedOptions: variant.selectedOptions,
      sku: variant.sku,
      barcode: variant.barcode,
      priceAmount: variant.priceAmount,
      compareAtPriceAmount: variant.compareAtPriceAmount,
      currencyCode: input.currencyCode,
      position: variant.position,
    },
  };

  const nested = input.line.value.inventoryItem;
  if (typeof nested !== "object" || nested === null || Array.isArray(nested)) {
    return [variantObservation];
  }
  const item = mapInventoryItemNode(
    {
      ...(nested as Record<string, unknown>),
      variants: { nodes: [{ id: variant.id }] },
    },
    input.unitCostSelected,
  );
  const itemObservation: FullSyncCanonicalObservation = {
    ...fullSyncBase(input),
    identity: {
      shopId: input.shopId,
      resourceKind: "InventoryItem",
      shopifyGid: item.id,
    },
    shopifyCreatedAt: date(item.shopifyCreatedAt),
    shopifyUpdatedAt: date(item.shopifyUpdatedAt),
    shopifyLegacyResourceId: item.legacyResourceId,
    attributes: {
      shopifyVariantGid: variant.id,
      sku: item.sku,
      tracked: item.tracked,
      requiresShipping: item.requiresShipping,
      weightValue: item.weightValue == null ? null : String(item.weightValue),
      weightUnit: item.weightUnit,
      unitCostAmount: item.unitCostAmount,
      unitCostCurrencyCode: item.unitCostCurrencyCode,
      unitCostAccess: item.unitCostSelected
        ? item.unitCostAmount == null
          ? "NULL"
          : "PRESENT"
        : input.unitCostAccess,
    },
  };
  return [variantObservation, itemObservation];
}

function mapInventoryLevel(input: MapperInput): FullSyncCanonicalObservation {
  const level = mapInventoryLevelNode(input.line.value);
  if (
    level.quantities.malformedRows.length > 0 ||
    level.quantities.malformedQuantityNames.length > 0 ||
    level.quantities.missingApprovedNames.length > 0
  ) {
    throw new Error("inventory_level_quantity_vector_incomplete");
  }
  const quantities = Object.entries(level.quantities.byName).map(
    ([name, quantity]) => {
      if (!quantity || !QUANTITY_NAME_MAP[name]) {
        throw new Error(`inventory_quantity_name_unmapped:${name}`);
      }
      return {
        name: QUANTITY_NAME_MAP[name],
        quantity: quantity.quantity,
        shopifyUpdatedAt: date(quantity.updatedAt),
      };
    },
  );
  return {
    ...fullSyncBase(input),
    identity: {
      shopId: input.shopId,
      resourceKind: "InventoryLevel",
      inventoryItemGid: level.identity.inventoryItemGid,
      locationGid: level.identity.locationGid,
    },
    shopifyCreatedAt: date(level.shopifyCreatedAt),
    shopifyUpdatedAt: date(level.shopifyUpdatedAt),
    attributes: {
      shopifyInventoryLevelGid: level.shopifyLevelGid,
      isActive: level.isActive ?? false,
      quantities,
    },
  };
}

export function mapJsonlLineToCanonical(input: MapperInput): MappedJsonlLine {
  const { resourceKind, value } = input.line;
  if (input.domain === "catalog") {
    if (resourceKind === "Product") {
      return { observations: [mapProduct(input)] };
    }
    if (resourceKind === "ProductVariant") {
      return { observations: mapVariantAndItem(input) };
    }
    if (resourceKind === "InventoryItem") {
      const item = mapInventoryItemNode(value, input.unitCostSelected);
      return {
        observations: [
          {
            ...fullSyncBase(input),
            identity: {
              shopId: input.shopId,
              resourceKind: "InventoryItem",
              shopifyGid: item.id,
            },
            shopifyCreatedAt: date(item.shopifyCreatedAt),
            shopifyUpdatedAt: date(item.shopifyUpdatedAt),
            shopifyLegacyResourceId: item.legacyResourceId,
            attributes: {
              shopifyVariantGid: item.variantGid,
              sku: item.sku,
              tracked: item.tracked,
              requiresShipping: item.requiresShipping,
              weightValue:
                item.weightValue == null ? null : String(item.weightValue),
              weightUnit: item.weightUnit,
              unitCostAmount: item.unitCostAmount,
              unitCostCurrencyCode: item.unitCostCurrencyCode,
              unitCostAccess: item.unitCostSelected
                ? item.unitCostAmount == null
                  ? "NULL"
                  : "PRESENT"
                : input.unitCostAccess,
            },
          },
        ],
      };
    }
    if (resourceKind === "Collection") {
      const parent = value.__parentId;
      if (
        typeof parent !== "string" ||
        !parent.startsWith("gid://shopify/Product/") ||
        typeof value.id !== "string" ||
        typeof value.title !== "string"
      ) {
        throw new Error("catalog_collection_identity_incomplete");
      }
      return {
        observations: [],
        collectionMembership: {
          productGid: parent,
          collectionGid: value.id,
          title: value.title,
        },
      };
    }
    throw new Error(`catalog_jsonl_kind_not_owned:${resourceKind}`);
  }

  if (resourceKind === "InventoryItem") {
    // Parent-link only. The catalog domain is the sole InventoryItem presence
    // authority and this line must not emit a canonical observation.
    return { observations: [] };
  }
  if (resourceKind === "InventoryLevel") {
    return { observations: [mapInventoryLevel(input)] };
  }
  throw new Error(`inventory_levels_jsonl_kind_not_owned:${resourceKind}`);
}
