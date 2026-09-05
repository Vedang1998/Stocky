import type {
  InventoryItemRead,
  InventoryLevelRead,
  LocationRead,
  ProductRead,
  ProductVariantRead,
  UnitCostAccess,
} from "../admin-read";
import type {
  CanonicalFactIdentity,
  DirectCanonicalObservation,
  QuantityName,
} from "../apply/types";
import type { DirectObservationHandle } from "./direct-observation";

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

type DirectMapperBase = {
  handle: DirectObservationHandle;
  responseGeneration: bigint;
  observedAt: Date;
  sourceKind:
    | "INCREMENTAL_REFETCH"
    | "DELETE_WEBHOOK"
    | "DISCONNECT_WEBHOOK"
    | "RECONCILE";
  durableJobId: string;
  signalReceivedAt?: Date | null;
  signalTopic?: string | null;
  signalDeliveryId?: string | null;
  signalTriggeredAt?: Date | null;
};

function base(
  input: DirectMapperBase,
  existenceKind: "LIVE_REFETCH" | "ABSENT_CONFIRMED_QUERY",
) {
  return {
    observationKind: "direct" as const,
    identity: input.handle.identity,
    observationToken: input.handle.token,
    observationRequestGen: input.handle.requestGeneration,
    observationResponseGen: input.responseGeneration,
    existenceKind,
    existenceObservedAt: input.observedAt,
    sourceKind: input.sourceKind,
    lastDurableJobId: input.durableJobId,
    signalReceivedAt: input.signalReceivedAt ?? null,
    lastSignalTopic: input.signalTopic ?? null,
    lastSignalDeliveryId: input.signalDeliveryId ?? null,
    lastSignalTriggeredAt: input.signalTriggeredAt ?? null,
  };
}

export function mapDirectProduct(
  input: DirectMapperBase & { value: ProductRead | null },
): DirectCanonicalObservation {
  if (!input.value) {
    return base(input, "ABSENT_CONFIRMED_QUERY");
  }
  return {
    ...base(input, "LIVE_REFETCH"),
    shopifyCreatedAt: new Date(input.value.shopifyCreatedAt),
    shopifyUpdatedAt: new Date(input.value.shopifyUpdatedAt),
    shopifyLegacyResourceId: input.value.legacyResourceId,
    attributes: {
      title: input.value.title,
      handle: input.value.handle,
      vendor: input.value.vendor,
      productType: input.value.productType,
      tags: input.value.tags,
      status: input.value.status as
        "ACTIVE" | "ARCHIVED" | "DRAFT" | "UNLISTED",
      featuredMediaUrl: input.value.featuredMediaUrl,
    },
  };
}

export function mapDirectVariant(
  input: DirectMapperBase & {
    value: ProductVariantRead | null;
    currencyCode: string;
  },
): DirectCanonicalObservation {
  if (!input.value) {
    return base(input, "ABSENT_CONFIRMED_QUERY");
  }
  return {
    ...base(input, "LIVE_REFETCH"),
    shopifyCreatedAt: new Date(input.value.shopifyCreatedAt),
    shopifyUpdatedAt: new Date(input.value.shopifyUpdatedAt),
    shopifyLegacyResourceId: input.value.legacyResourceId,
    attributes: {
      shopifyProductGid: input.value.productGid,
      title: input.value.title,
      displayName: input.value.displayName,
      selectedOptions: input.value.selectedOptions,
      sku: input.value.sku,
      barcode: input.value.barcode,
      priceAmount: input.value.priceAmount,
      compareAtPriceAmount: input.value.compareAtPriceAmount,
      currencyCode: input.currencyCode,
      position: input.value.position,
    },
  };
}

export function mapDirectInventoryItem(
  input: DirectMapperBase & {
    value: InventoryItemRead | null;
    unitCostAccess: UnitCostAccess;
  },
): DirectCanonicalObservation {
  if (!input.value) {
    return base(input, "ABSENT_CONFIRMED_QUERY");
  }
  return {
    ...base(input, "LIVE_REFETCH"),
    shopifyCreatedAt: new Date(input.value.shopifyCreatedAt),
    shopifyUpdatedAt: new Date(input.value.shopifyUpdatedAt),
    shopifyLegacyResourceId: input.value.legacyResourceId,
    attributes: {
      shopifyVariantGid: input.value.variantGid,
      sku: input.value.sku,
      tracked: input.value.tracked,
      requiresShipping: input.value.requiresShipping,
      weightValue:
        input.value.weightValue == null
          ? null
          : String(input.value.weightValue),
      weightUnit: input.value.weightUnit,
      unitCostAmount: input.value.unitCostAmount,
      unitCostCurrencyCode: input.value.unitCostCurrencyCode,
      unitCostAccess: input.value.unitCostSelected
        ? input.value.unitCostAmount == null
          ? "NULL"
          : "PRESENT"
        : input.unitCostAccess,
    },
  };
}

export function mapDirectLocation(
  input: DirectMapperBase & { value: LocationRead | null },
): DirectCanonicalObservation {
  if (!input.value) {
    return base(input, "ABSENT_CONFIRMED_QUERY");
  }
  return {
    ...base(input, "LIVE_REFETCH"),
    shopifyCreatedAt: new Date(input.value.shopifyCreatedAt),
    shopifyUpdatedAt: new Date(input.value.shopifyUpdatedAt),
    shopifyLegacyResourceId: input.value.legacyResourceId,
    attributes: {
      name: input.value.name,
      isActive: input.value.isActive,
      deactivatedAt:
        input.value.deactivatedAt == null
          ? null
          : new Date(input.value.deactivatedAt),
      fulfillsOnlineOrders: input.value.fulfillsOnlineOrders,
      shipsInventory: input.value.shipsInventory,
      isFulfillmentService: input.value.isFulfillmentService,
      hasActiveInventory: input.value.hasActiveInventory,
      address1: input.value.address1,
      city: input.value.city,
      provinceCode: input.value.provinceCode,
      countryCode: input.value.countryCode,
      zip: input.value.zip,
    },
  };
}

export function mapDirectInventoryLevel(
  input: DirectMapperBase & { value: InventoryLevelRead | null },
): DirectCanonicalObservation {
  if (!input.value) {
    return base(input, "ABSENT_CONFIRMED_QUERY");
  }
  const quantities = input.value.quantities;
  if (
    quantities.malformedRows.length > 0 ||
    quantities.malformedQuantityNames.length > 0 ||
    quantities.missingApprovedNames.length > 0
  ) {
    throw new Error("inventory_level_quantity_vector_incomplete");
  }
  return {
    ...base(input, "LIVE_REFETCH"),
    shopifyCreatedAt:
      input.value.shopifyCreatedAt == null
        ? null
        : new Date(input.value.shopifyCreatedAt),
    shopifyUpdatedAt:
      input.value.shopifyUpdatedAt == null
        ? null
        : new Date(input.value.shopifyUpdatedAt),
    attributes: {
      shopifyInventoryLevelGid: input.value.shopifyLevelGid,
      isActive: input.value.isActive ?? false,
      quantities: Object.entries(quantities.byName).map(([name, quantity]) => {
        const mappedName = QUANTITY_NAME_MAP[name];
        if (!mappedName || !quantity) {
          throw new Error(`inventory_quantity_name_unmapped:${name}`);
        }
        return {
          name: mappedName,
          quantity: quantity.quantity,
          shopifyUpdatedAt:
            quantity.updatedAt == null ? null : new Date(quantity.updatedAt),
        };
      }),
    },
  };
}

export function canonicalIdentityKeyForReceipt(
  identity: CanonicalFactIdentity,
): string {
  return identity.resourceKind === "InventoryLevel"
    ? `InventoryLevel:${identity.inventoryItemGid}:${identity.locationGid}`
    : `${identity.resourceKind}:${identity.shopifyGid}`;
}
