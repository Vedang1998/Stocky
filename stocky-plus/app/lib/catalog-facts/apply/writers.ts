/**
 * Canonical fact writers. INSERT and UPDATE only — never DELETE/deleteMany.
 */
import type { GenerationInterval } from "./clocks";
import {
  CanonicalApplyIncompleteFirstLiveError,
  CanonicalApplyQuantityDomainError,
} from "./errors";
import { isCanonicalInt32, validateFirstLiveAttributes } from "./first-live";
import {
  assertFrozenNumericColumn,
  exactNumericEqual,
  frozenNumericTextOrNull,
} from "./money";
import {
  asBigIntOrNull,
  asBool,
  asDate,
  asInt,
  asString,
  newFactId,
  queryRows,
  throwIfUniqueViolation,
  type CanonicalApplyDb,
} from "./sql";
import type {
  ApprovedExistenceKind,
  CanonicalFactIdentity,
  CanonicalObservation,
  InventoryItemAttributes,
  InventoryLevelAttributes,
  LocationAttributes,
  ProductAttributes,
  QuantityName,
  VariantAttributes,
} from "./types";
import { QUANTITY_COLUMN_SPECS } from "./types";

export type FactSnapshot = {
  id: string;
  existenceState: "LIVE" | "ABSENT";
  existenceKind: string;
  existenceRequestGen: bigint | null;
  existenceResponseGen: bigint | null;
  existenceDiagnosticState: string | null;
  shopifyCreatedAt: Date | null;
  shopifyUpdatedAt: Date | null;
  attributeRequestGen: bigint | null;
  attributeResponseGen: bigint | null;
  attributeFreshnessState: string;
  lastSeenFullSyncRunId: string | null;
  title?: string | null;
  handle?: string | null;
  vendor?: string | null;
  productType?: string | null;
  tags?: string[] | null;
  status?: string | null;
  featuredMediaUrl?: string | null;
  shopifyProductGid?: string | null;
  shopifyVariantGid?: string | null;
  displayName?: string | null;
  selectedOptions?: unknown;
  sku?: string | null;
  barcode?: string | null;
  priceAmount?: string | null;
  compareAtPriceAmount?: string | null;
  currencyCode?: string | null;
  position?: number | null;
  tracked?: boolean | null;
  requiresShipping?: boolean | null;
  weightValue?: string | null;
  weightUnit?: string | null;
  unitCostAmount?: string | null;
  unitCostCurrencyCode?: string | null;
  unitCostAccess?: string | null;
  name?: string | null;
  isActive?: boolean | null;
  deactivatedAt?: Date | null;
  fulfillsOnlineOrders?: boolean | null;
  shipsInventory?: boolean | null;
  isFulfillmentService?: boolean | null;
  hasActiveInventory?: boolean | null;
  address1?: string | null;
  city?: string | null;
  provinceCode?: string | null;
  countryCode?: string | null;
  zip?: string | null;
  shopifyInventoryLevelGid?: string | null;
  quantities: Partial<
    Record<
      QuantityName,
      {
        value: number | null;
        updatedAt: Date | null;
        requestGen: bigint | null;
        responseGen: bigint | null;
      }
    >
  >;
};

function moneyCol(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "number") {
    throw new Error("money column arrived as Number");
  }
  return String(value);
}

function tagsFrom(value: unknown): string[] | null {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map((item) => String(item));
  return null;
}

function mapSnapshot(row: Record<string, unknown>): FactSnapshot {
  const quantities: FactSnapshot["quantities"] = {};
  for (const spec of QUANTITY_COLUMN_SPECS) {
    quantities[spec.name] = {
      value: asInt(row[spec.value]),
      updatedAt: asDate(row[spec.updatedAt]),
      requestGen: asBigIntOrNull(row[spec.requestGen], spec.requestGen),
      responseGen: asBigIntOrNull(row[spec.responseGen], spec.responseGen),
    };
  }
  return {
    id: String(row.id),
    existenceState: row.existenceState === "ABSENT" ? "ABSENT" : "LIVE",
    existenceKind: String(row.existenceKind),
    existenceRequestGen: asBigIntOrNull(
      row.existenceRequestGen,
      "existenceRequestGen",
    ),
    existenceResponseGen: asBigIntOrNull(
      row.existenceResponseGen,
      "existenceResponseGen",
    ),
    existenceDiagnosticState: asString(row.existenceDiagnosticState),
    shopifyCreatedAt: asDate(row.shopifyCreatedAt),
    shopifyUpdatedAt: asDate(row.shopifyUpdatedAt),
    attributeRequestGen: asBigIntOrNull(
      row.attributeRequestGen,
      "attributeRequestGen",
    ),
    attributeResponseGen: asBigIntOrNull(
      row.attributeResponseGen,
      "attributeResponseGen",
    ),
    attributeFreshnessState: String(row.attributeFreshnessState ?? "ORDERED"),
    lastSeenFullSyncRunId: asString(row.lastSeenFullSyncRunId),
    title: asString(row.title),
    handle: asString(row.handle),
    vendor: asString(row.vendor),
    productType: asString(row.productType),
    tags: tagsFrom(row.tags),
    status: asString(row.status),
    featuredMediaUrl: asString(row.featuredMediaUrl),
    shopifyProductGid: asString(row.shopifyProductGid),
    shopifyVariantGid: asString(row.shopifyVariantGid),
    displayName: asString(row.displayName),
    selectedOptions: row.selectedOptions,
    sku: asString(row.sku),
    barcode: asString(row.barcode),
    priceAmount: moneyCol(row.priceAmount),
    compareAtPriceAmount: moneyCol(row.compareAtPriceAmount),
    currencyCode: asString(row.currencyCode),
    position: asInt(row.position),
    tracked: row.tracked == null ? null : asBool(row.tracked),
    requiresShipping:
      row.requiresShipping == null ? null : asBool(row.requiresShipping),
    weightValue: moneyCol(row.weightValue),
    weightUnit: asString(row.weightUnit),
    unitCostAmount: moneyCol(row.unitCostAmount),
    unitCostCurrencyCode: asString(row.unitCostCurrencyCode),
    unitCostAccess: asString(row.unitCostAccess),
    name: asString(row.name),
    isActive: row.isActive == null ? null : asBool(row.isActive),
    deactivatedAt: asDate(row.deactivatedAt),
    fulfillsOnlineOrders:
      row.fulfillsOnlineOrders == null
        ? null
        : asBool(row.fulfillsOnlineOrders),
    shipsInventory:
      row.shipsInventory == null ? null : asBool(row.shipsInventory),
    isFulfillmentService:
      row.isFulfillmentService == null
        ? null
        : asBool(row.isFulfillmentService),
    hasActiveInventory:
      row.hasActiveInventory == null ? null : asBool(row.hasActiveInventory),
    address1: asString(row.address1),
    city: asString(row.city),
    provinceCode: asString(row.provinceCode),
    countryCode: asString(row.countryCode),
    zip: asString(row.zip),
    shopifyInventoryLevelGid: asString(row.shopifyInventoryLevelGid),
    quantities,
  };
}

export async function lockAndReadFact(
  db: CanonicalApplyDb,
  identity: CanonicalFactIdentity,
): Promise<FactSnapshot | null> {
  const shopId = identity.shopId;
  if (identity.resourceKind === "Product") {
    const rows = await queryRows(db)`SELECT * FROM "ShopifyProductFact"
       WHERE "shopId" = ${shopId} AND "shopifyGid" = ${identity.shopifyGid}
       FOR UPDATE`;
    return rows[0] ? mapSnapshot(rows[0]) : null;
  }
  if (identity.resourceKind === "ProductVariant") {
    const rows = await queryRows(db)`SELECT * FROM "ShopifyVariantFact"
       WHERE "shopId" = ${shopId} AND "shopifyGid" = ${identity.shopifyGid}
       FOR UPDATE`;
    return rows[0] ? mapSnapshot(rows[0]) : null;
  }
  if (identity.resourceKind === "InventoryItem") {
    const rows = await queryRows(db)`SELECT * FROM "ShopifyInventoryItemFact"
       WHERE "shopId" = ${shopId} AND "shopifyGid" = ${identity.shopifyGid}
       FOR UPDATE`;
    return rows[0] ? mapSnapshot(rows[0]) : null;
  }
  if (identity.resourceKind === "Location") {
    const rows = await queryRows(db)`SELECT * FROM "ShopifyLocationFact"
       WHERE "shopId" = ${shopId} AND "shopifyGid" = ${identity.shopifyGid}
       FOR UPDATE`;
    return rows[0] ? mapSnapshot(rows[0]) : null;
  }
  if (identity.resourceKind !== "InventoryLevel") {
    throw new Error("unsupported canonical identity");
  }
  const rows = await queryRows(db)`SELECT * FROM "ShopifyInventoryLevelFact"
     WHERE "shopId" = ${shopId}
       AND "inventoryItemGid" = ${identity.inventoryItemGid}
       AND "locationGid" = ${identity.locationGid}
     FOR UPDATE`;
  return rows[0] ? mapSnapshot(rows[0]) : null;
}

export type ExistenceWrite = {
  state: "LIVE" | "ABSENT";
  kind: ApprovedExistenceKind;
  interval: GenerationInterval | null;
  observedAt: Date;
  diagnostic: string | null;
  deletionSource: "CONFIRMED_QUERY" | "DISCONNECT" | null;
  shopifyCreatedAt?: Date | null;
};

function existenceGens(write: ExistenceWrite): {
  req: string | null;
  resp: string | null;
} {
  if (write.kind === "LIVE_FULL_SYNC_PRESENT") {
    return { req: null, resp: null };
  }
  if (!write.interval) {
    throw new Error("direct existence write requires an observation interval");
  }
  return {
    req: write.interval.requestGen.toString(),
    resp: write.interval.responseGen.toString(),
  };
}

export async function insertFact(
  db: CanonicalApplyDb,
  observation: CanonicalObservation,
  existence: ExistenceWrite,
  attributeInterval: GenerationInterval,
  freshness: "ORDERED" | "DEGRADED",
  presenceEpochId: string | null,
): Promise<string> {
  const id = newFactId();
  const identity = observation.identity;
  const gens = existenceGens(existence);
  const deletedAt = existence.state === "ABSENT" ? existence.observedAt : null;
  const sourceKind = observation.sourceKind;
  const observedAt = existence.observedAt;
  const createdAt = observation.shopifyCreatedAt ?? null;
  const updatedAt = observation.shopifyUpdatedAt ?? null;
  const attrReq = attributeInterval.requestGen.toString();
  const attrResp = attributeInterval.responseGen.toString();

  const firstLive = validateFirstLiveAttributes(observation);
  if (!firstLive.ok) {
    throw firstLive.error;
  }

  try {
    if (identity.resourceKind === "Product") {
      const attrs = observation.attributes as ProductAttributes;
      if (
        attrs.title == null ||
        attrs.handle == null ||
        attrs.status == null ||
        !Array.isArray(attrs.tags)
      ) {
        throw new CanonicalApplyIncompleteFirstLiveError([
          "title",
          "handle",
          "tags",
          "status",
        ]);
      }
      await queryRows(db)`INSERT INTO "ShopifyProductFact" (
           id, "shopId", "shopifyGid", title, handle, vendor, "productType", tags, status,
           "featuredMediaUrl", "shopifyCreatedAt", "shopifyUpdatedAt",
           "existenceState", "existenceKind", "existenceObservedAt",
           "existenceRequestGen", "existenceResponseGen", "existenceDiagnosticState",
           "attributeRequestGen", "attributeResponseGen", "attributeFreshnessState",
           "compatibilityProjectionState",
           "lastSeenFullSyncRunId", "ingestBatchId", "sourceKind",
           "deletedAt", "deletionSource", "shopifyLegacyResourceId",
           "appliedAt", "lastRefreshedAt", "createdAt", "updatedAt"
         ) VALUES (
           ${id}, ${identity.shopId}, ${identity.shopifyGid},
           ${attrs.title}, ${attrs.handle}, ${attrs.vendor},
           ${attrs.productType},
           ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(attrs.tags)}::jsonb)),
           ${attrs.status}::"ShopifyProductStatus",
           ${attrs.featuredMediaUrl}, ${createdAt}, ${updatedAt},
           ${existence.state}::"CatalogExistenceState",
           ${existence.kind}::"CatalogExistenceKind",
           ${observedAt},
           ${gens.req}::bigint, ${gens.resp}::bigint, ${existence.diagnostic},
           ${attrReq}::bigint, ${attrResp}::bigint,
           ${freshness}::"CatalogAttributeFreshnessState",
           'PROJECTION_PENDING'::"CatalogCompatibilityProjectionState",
           ${presenceEpochId}, ${observation.ingestBatchId ?? null},
           ${sourceKind}::"CatalogSourceKind",
           ${deletedAt}, ${existence.deletionSource}::"CatalogDeletionSource",
           ${observation.shopifyLegacyResourceId ?? null},
           clock_timestamp(), clock_timestamp(), clock_timestamp(), clock_timestamp()
         )`;
      return id;
    }
    if (identity.resourceKind === "ProductVariant") {
      const attrs = observation.attributes as VariantAttributes;
      await queryRows(db)`INSERT INTO "ShopifyVariantFact" (
           id, "shopId", "shopifyGid", "shopifyProductGid", title, "displayName",
           "selectedOptions", sku, barcode, "priceAmount", "compareAtPriceAmount",
           "currencyCode", position, "shopifyCreatedAt", "shopifyUpdatedAt",
           "existenceState", "existenceKind", "existenceObservedAt",
           "existenceRequestGen", "existenceResponseGen", "existenceDiagnosticState",
           "attributeRequestGen", "attributeResponseGen", "attributeFreshnessState",
           "compatibilityProjectionState",
           "lastSeenFullSyncRunId", "ingestBatchId", "sourceKind",
           "deletedAt", "deletionSource", "shopifyLegacyResourceId",
           "appliedAt", "lastRefreshedAt", "createdAt", "updatedAt"
         ) VALUES (
           ${id}, ${identity.shopId}, ${identity.shopifyGid}, ${attrs.shopifyProductGid},
           ${attrs.title}, ${attrs.displayName},
           ${JSON.stringify(attrs.selectedOptions)}::jsonb,
           ${attrs.sku}, ${attrs.barcode},
           ${assertFrozenNumericColumn(attrs.priceAmount, "priceAmount")}::decimal(20,6),
           ${frozenNumericTextOrNull(attrs.compareAtPriceAmount, "compareAtPriceAmount")}::decimal(20,6),
           ${attrs.currencyCode}, ${attrs.position},
           ${createdAt}, ${updatedAt},
           ${existence.state}::"CatalogExistenceState",
           ${existence.kind}::"CatalogExistenceKind",
           ${observedAt},
           ${gens.req}::bigint, ${gens.resp}::bigint, ${existence.diagnostic},
           ${attrReq}::bigint, ${attrResp}::bigint,
           ${freshness}::"CatalogAttributeFreshnessState",
           'PROJECTION_PENDING'::"CatalogCompatibilityProjectionState",
           ${presenceEpochId}, ${observation.ingestBatchId ?? null},
           ${sourceKind}::"CatalogSourceKind",
           ${deletedAt}, ${existence.deletionSource}::"CatalogDeletionSource",
           ${observation.shopifyLegacyResourceId ?? null},
           clock_timestamp(), clock_timestamp(), clock_timestamp(), clock_timestamp()
         )`;
      return id;
    }
    if (identity.resourceKind === "InventoryItem") {
      const attrs = observation.attributes as InventoryItemAttributes;
      await queryRows(db)`INSERT INTO "ShopifyInventoryItemFact" (
           id, "shopId", "shopifyGid", "shopifyVariantGid", sku, tracked,
           "requiresShipping", "weightValue", "weightUnit", "unitCostAmount",
           "unitCostCurrencyCode", "unitCostAccess",
           "shopifyCreatedAt", "shopifyUpdatedAt",
           "existenceState", "existenceKind", "existenceObservedAt",
           "existenceRequestGen", "existenceResponseGen", "existenceDiagnosticState",
           "attributeRequestGen", "attributeResponseGen", "attributeFreshnessState",
           "compatibilityProjectionState",
           "lastSeenFullSyncRunId", "ingestBatchId", "sourceKind",
           "deletedAt", "deletionSource", "shopifyLegacyResourceId",
           "appliedAt", "lastRefreshedAt", "createdAt", "updatedAt"
         ) VALUES (
           ${id}, ${identity.shopId}, ${identity.shopifyGid}, ${attrs.shopifyVariantGid},
           ${attrs.sku}, ${attrs.tracked}, ${attrs.requiresShipping},
           ${frozenNumericTextOrNull(attrs.weightValue, "weightValue")}::decimal(20,6),
           ${attrs.weightUnit},
           ${frozenNumericTextOrNull(attrs.unitCostAmount, "unitCostAmount")}::decimal(20,6),
           ${attrs.unitCostCurrencyCode},
           ${attrs.unitCostAccess}::"CatalogUnitCostAccess",
           ${createdAt}, ${updatedAt},
           ${existence.state}::"CatalogExistenceState",
           ${existence.kind}::"CatalogExistenceKind",
           ${observedAt},
           ${gens.req}::bigint, ${gens.resp}::bigint, ${existence.diagnostic},
           ${attrReq}::bigint, ${attrResp}::bigint,
           ${freshness}::"CatalogAttributeFreshnessState",
           'PROJECTION_PENDING'::"CatalogCompatibilityProjectionState",
           ${presenceEpochId}, ${observation.ingestBatchId ?? null},
           ${sourceKind}::"CatalogSourceKind",
           ${deletedAt}, ${existence.deletionSource}::"CatalogDeletionSource",
           ${observation.shopifyLegacyResourceId ?? null},
           clock_timestamp(), clock_timestamp(), clock_timestamp(), clock_timestamp()
         )`;
      return id;
    }
    if (identity.resourceKind === "Location") {
      const attrs = observation.attributes as LocationAttributes;
      await queryRows(db)`INSERT INTO "ShopifyLocationFact" (
           id, "shopId", "shopifyGid", name, "isActive", "deactivatedAt",
           "fulfillsOnlineOrders", "shipsInventory", "isFulfillmentService",
           "hasActiveInventory", address1, city, "provinceCode", "countryCode", zip,
           "shopifyCreatedAt", "shopifyUpdatedAt",
           "existenceState", "existenceKind", "existenceObservedAt",
           "existenceRequestGen", "existenceResponseGen", "existenceDiagnosticState",
           "attributeRequestGen", "attributeResponseGen", "attributeFreshnessState",
           "compatibilityProjectionState",
           "lastSeenFullSyncRunId", "ingestBatchId", "sourceKind",
           "deletedAt", "deletionSource", "shopifyLegacyResourceId",
           "appliedAt", "lastRefreshedAt", "createdAt", "updatedAt"
         ) VALUES (
           ${id}, ${identity.shopId}, ${identity.shopifyGid}, ${attrs.name},
           ${attrs.isActive}, ${attrs.deactivatedAt},
           ${attrs.fulfillsOnlineOrders}, ${attrs.shipsInventory},
           ${attrs.isFulfillmentService}, ${attrs.hasActiveInventory},
           ${attrs.address1}, ${attrs.city}, ${attrs.provinceCode},
           ${attrs.countryCode}, ${attrs.zip},
           ${createdAt}, ${updatedAt},
           ${existence.state}::"CatalogExistenceState",
           ${existence.kind}::"CatalogExistenceKind",
           ${observedAt},
           ${gens.req}::bigint, ${gens.resp}::bigint, ${existence.diagnostic},
           ${attrReq}::bigint, ${attrResp}::bigint,
           ${freshness}::"CatalogAttributeFreshnessState",
           'PROJECTION_PENDING'::"CatalogCompatibilityProjectionState",
           ${presenceEpochId}, ${observation.ingestBatchId ?? null},
           ${sourceKind}::"CatalogSourceKind",
           ${deletedAt}, ${existence.deletionSource}::"CatalogDeletionSource",
           ${observation.shopifyLegacyResourceId ?? null},
           clock_timestamp(), clock_timestamp(), clock_timestamp(), clock_timestamp()
         )`;
      return id;
    }
    if (identity.resourceKind !== "InventoryLevel") {
      throw new Error("unsupported canonical identity");
    }
    const attrs = observation.attributes as InventoryLevelAttributes;
    await queryRows(db)`INSERT INTO "ShopifyInventoryLevelFact" (
         id, "shopId", "inventoryItemGid", "locationGid", "shopifyInventoryLevelGid",
         "isActive", "shopifyCreatedAt", "shopifyUpdatedAt",
         "existenceState", "existenceKind", "existenceObservedAt",
         "existenceRequestGen", "existenceResponseGen", "existenceDiagnosticState",
         "attributeRequestGen", "attributeResponseGen", "attributeFreshnessState",
         "compatibilityProjectionState",
         "lastSeenFullSyncRunId", "ingestBatchId", "sourceKind",
         "deletedAt", "deletionSource", "shopifyLegacyResourceId",
         "appliedAt", "lastRefreshedAt", "createdAt", "updatedAt"
       ) VALUES (
         ${id}, ${identity.shopId}, ${identity.inventoryItemGid}, ${identity.locationGid},
         ${attrs.shopifyInventoryLevelGid}, ${attrs.isActive},
         ${createdAt}, ${updatedAt},
         ${existence.state}::"CatalogExistenceState",
         ${existence.kind}::"CatalogExistenceKind",
         ${observedAt},
         ${gens.req}::bigint, ${gens.resp}::bigint, ${existence.diagnostic},
         ${attrReq}::bigint, ${attrResp}::bigint,
         ${freshness}::"CatalogAttributeFreshnessState",
         'PROJECTION_PENDING'::"CatalogCompatibilityProjectionState",
         ${presenceEpochId}, ${observation.ingestBatchId ?? null},
         ${sourceKind}::"CatalogSourceKind",
         ${deletedAt}, ${existence.deletionSource}::"CatalogDeletionSource",
         ${observation.shopifyLegacyResourceId ?? null},
         clock_timestamp(), clock_timestamp(), clock_timestamp(), clock_timestamp()
       )`;
    return id;
  } catch (error) {
    throwIfUniqueViolation(error);
  }
  throw new Error("canonical insert returned without an id");
}

async function updateExistenceOnTable(
  db: CanonicalApplyDb,
  table:
    | "ShopifyProductFact"
    | "ShopifyVariantFact"
    | "ShopifyInventoryItemFact"
    | "ShopifyLocationFact"
    | "ShopifyInventoryLevelFact",
  shopId: string,
  factId: string,
  existence: ExistenceWrite,
): Promise<void> {
  const gens = existenceGens(existence);
  const deletedAt = existence.state === "ABSENT" ? existence.observedAt : null;
  if (table === "ShopifyProductFact") {
    await queryRows(db)`UPDATE "ShopifyProductFact"
       SET "existenceState" = ${existence.state}::"CatalogExistenceState",
           "existenceKind" = ${existence.kind}::"CatalogExistenceKind",
           "existenceObservedAt" = ${existence.observedAt},
           "existenceRequestGen" = ${gens.req}::bigint,
           "existenceResponseGen" = ${gens.resp}::bigint,
           "existenceDiagnosticState" = ${existence.diagnostic},
           "deletedAt" = ${deletedAt},
           "deletionSource" = ${existence.deletionSource}::"CatalogDeletionSource",
           "appliedAt" = clock_timestamp(),
           "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  if (table === "ShopifyVariantFact") {
    await queryRows(db)`UPDATE "ShopifyVariantFact"
       SET "existenceState" = ${existence.state}::"CatalogExistenceState",
           "existenceKind" = ${existence.kind}::"CatalogExistenceKind",
           "existenceObservedAt" = ${existence.observedAt},
           "existenceRequestGen" = ${gens.req}::bigint,
           "existenceResponseGen" = ${gens.resp}::bigint,
           "existenceDiagnosticState" = ${existence.diagnostic},
           "deletedAt" = ${deletedAt},
           "deletionSource" = ${existence.deletionSource}::"CatalogDeletionSource",
           "appliedAt" = clock_timestamp(),
           "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  if (table === "ShopifyInventoryItemFact") {
    await queryRows(db)`UPDATE "ShopifyInventoryItemFact"
       SET "existenceState" = ${existence.state}::"CatalogExistenceState",
           "existenceKind" = ${existence.kind}::"CatalogExistenceKind",
           "existenceObservedAt" = ${existence.observedAt},
           "existenceRequestGen" = ${gens.req}::bigint,
           "existenceResponseGen" = ${gens.resp}::bigint,
           "existenceDiagnosticState" = ${existence.diagnostic},
           "deletedAt" = ${deletedAt},
           "deletionSource" = ${existence.deletionSource}::"CatalogDeletionSource",
           "appliedAt" = clock_timestamp(),
           "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  if (table === "ShopifyLocationFact") {
    await queryRows(db)`UPDATE "ShopifyLocationFact"
       SET "existenceState" = ${existence.state}::"CatalogExistenceState",
           "existenceKind" = ${existence.kind}::"CatalogExistenceKind",
           "existenceObservedAt" = ${existence.observedAt},
           "existenceRequestGen" = ${gens.req}::bigint,
           "existenceResponseGen" = ${gens.resp}::bigint,
           "existenceDiagnosticState" = ${existence.diagnostic},
           "deletedAt" = ${deletedAt},
           "deletionSource" = ${existence.deletionSource}::"CatalogDeletionSource",
           "appliedAt" = clock_timestamp(),
           "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  await queryRows(db)`UPDATE "ShopifyInventoryLevelFact"
     SET "existenceState" = ${existence.state}::"CatalogExistenceState",
         "existenceKind" = ${existence.kind}::"CatalogExistenceKind",
         "existenceObservedAt" = ${existence.observedAt},
         "existenceRequestGen" = ${gens.req}::bigint,
         "existenceResponseGen" = ${gens.resp}::bigint,
         "existenceDiagnosticState" = ${existence.diagnostic},
         "deletedAt" = ${deletedAt},
         "deletionSource" = ${existence.deletionSource}::"CatalogDeletionSource",
         "appliedAt" = clock_timestamp(),
         "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId} AND id = ${factId}`;
}

function tableFor(identity: CanonicalFactIdentity) {
  switch (identity.resourceKind) {
    case "Product":
      return "ShopifyProductFact" as const;
    case "ProductVariant":
      return "ShopifyVariantFact" as const;
    case "InventoryItem":
      return "ShopifyInventoryItemFact" as const;
    case "Location":
      return "ShopifyLocationFact" as const;
    default:
      return "ShopifyInventoryLevelFact" as const;
  }
}

/**
 * F3 projection handoff marker. The caller already holds the canonical
 * advisory identity lock; this write stays in the same canonical transaction.
 */
export async function markCompatibilityProjectionPending(
  db: CanonicalApplyDb,
  identity: CanonicalFactIdentity,
  factId: string,
): Promise<void> {
  const shopId = identity.shopId;
  const table = tableFor(identity);
  if (table === "ShopifyProductFact") {
    await queryRows(db)`UPDATE "ShopifyProductFact"
       SET "compatibilityProjectionState" = 'PROJECTION_PENDING',
           "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  if (table === "ShopifyVariantFact") {
    await queryRows(db)`UPDATE "ShopifyVariantFact"
       SET "compatibilityProjectionState" = 'PROJECTION_PENDING',
           "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  if (table === "ShopifyInventoryItemFact") {
    await queryRows(db)`UPDATE "ShopifyInventoryItemFact"
       SET "compatibilityProjectionState" = 'PROJECTION_PENDING',
           "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  if (table === "ShopifyLocationFact") {
    await queryRows(db)`UPDATE "ShopifyLocationFact"
       SET "compatibilityProjectionState" = 'PROJECTION_PENDING',
           "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  await queryRows(db)`UPDATE "ShopifyInventoryLevelFact"
     SET "compatibilityProjectionState" = 'PROJECTION_PENDING',
         "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId} AND id = ${factId}`;
}

export async function updateExistence(
  db: CanonicalApplyDb,
  identity: CanonicalFactIdentity,
  factId: string,
  existence: ExistenceWrite,
): Promise<void> {
  await updateExistenceOnTable(
    db,
    tableFor(identity),
    identity.shopId,
    factId,
    existence,
  );
}

export async function updateDiagnostic(
  db: CanonicalApplyDb,
  identity: CanonicalFactIdentity,
  factId: string,
  diagnostic: string | null,
): Promise<void> {
  const shopId = identity.shopId;
  const table = tableFor(identity);
  if (table === "ShopifyProductFact") {
    await queryRows(
      db,
    )`UPDATE "ShopifyProductFact" SET "existenceDiagnosticState" = ${diagnostic}, "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  if (table === "ShopifyVariantFact") {
    await queryRows(
      db,
    )`UPDATE "ShopifyVariantFact" SET "existenceDiagnosticState" = ${diagnostic}, "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  if (table === "ShopifyInventoryItemFact") {
    await queryRows(
      db,
    )`UPDATE "ShopifyInventoryItemFact" SET "existenceDiagnosticState" = ${diagnostic}, "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  if (table === "ShopifyLocationFact") {
    await queryRows(
      db,
    )`UPDATE "ShopifyLocationFact" SET "existenceDiagnosticState" = ${diagnostic}, "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  await queryRows(
    db,
  )`UPDATE "ShopifyInventoryLevelFact" SET "existenceDiagnosticState" = ${diagnostic}, "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId} AND id = ${factId}`;
}

export async function updateFreshnessAndDiagnostic(
  db: CanonicalApplyDb,
  identity: CanonicalFactIdentity,
  factId: string,
  freshness: "ORDERED" | "DEGRADED",
  diagnostic: string | null,
): Promise<void> {
  const shopId = identity.shopId;
  const table = tableFor(identity);
  if (table === "ShopifyProductFact") {
    await queryRows(db)`UPDATE "ShopifyProductFact"
       SET "attributeFreshnessState" = ${freshness}::"CatalogAttributeFreshnessState",
           "existenceDiagnosticState" = ${diagnostic},
           "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  if (table === "ShopifyVariantFact") {
    await queryRows(db)`UPDATE "ShopifyVariantFact"
       SET "attributeFreshnessState" = ${freshness}::"CatalogAttributeFreshnessState",
           "existenceDiagnosticState" = ${diagnostic},
           "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  if (table === "ShopifyInventoryItemFact") {
    await queryRows(db)`UPDATE "ShopifyInventoryItemFact"
       SET "attributeFreshnessState" = ${freshness}::"CatalogAttributeFreshnessState",
           "existenceDiagnosticState" = ${diagnostic},
           "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  if (table === "ShopifyLocationFact") {
    await queryRows(db)`UPDATE "ShopifyLocationFact"
       SET "attributeFreshnessState" = ${freshness}::"CatalogAttributeFreshnessState",
           "existenceDiagnosticState" = ${diagnostic},
           "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  await queryRows(db)`UPDATE "ShopifyInventoryLevelFact"
     SET "attributeFreshnessState" = ${freshness}::"CatalogAttributeFreshnessState",
         "existenceDiagnosticState" = ${diagnostic},
         "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId} AND id = ${factId}`;
}

export async function updatePresenceMarker(
  db: CanonicalApplyDb,
  identity: CanonicalFactIdentity,
  factId: string,
  epochId: string,
): Promise<void> {
  const shopId = identity.shopId;
  const table = tableFor(identity);
  if (table === "ShopifyProductFact") {
    await queryRows(
      db,
    )`UPDATE "ShopifyProductFact" SET "lastSeenFullSyncRunId" = ${epochId}, "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  if (table === "ShopifyVariantFact") {
    await queryRows(
      db,
    )`UPDATE "ShopifyVariantFact" SET "lastSeenFullSyncRunId" = ${epochId}, "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  if (table === "ShopifyInventoryItemFact") {
    await queryRows(
      db,
    )`UPDATE "ShopifyInventoryItemFact" SET "lastSeenFullSyncRunId" = ${epochId}, "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  if (table === "ShopifyLocationFact") {
    await queryRows(
      db,
    )`UPDATE "ShopifyLocationFact" SET "lastSeenFullSyncRunId" = ${epochId}, "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  await queryRows(
    db,
  )`UPDATE "ShopifyInventoryLevelFact" SET "lastSeenFullSyncRunId" = ${epochId}, "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId} AND id = ${factId}`;
}

export async function updateFreshnessAndAttributeInterval(
  db: CanonicalApplyDb,
  identity: CanonicalFactIdentity,
  factId: string,
  freshness: "ORDERED" | "DEGRADED",
  interval: GenerationInterval,
  diagnostic: string | null,
): Promise<void> {
  const shopId = identity.shopId;
  const req = interval.requestGen.toString();
  const resp = interval.responseGen.toString();
  const table = tableFor(identity);
  if (table === "ShopifyProductFact") {
    await queryRows(db)`UPDATE "ShopifyProductFact"
       SET "attributeFreshnessState" = ${freshness}::"CatalogAttributeFreshnessState",
           "attributeRequestGen" = ${req}::bigint,
           "attributeResponseGen" = ${resp}::bigint,
           "existenceDiagnosticState" = COALESCE(${diagnostic}, "existenceDiagnosticState"),
           "appliedAt" = clock_timestamp(),
           "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  if (table === "ShopifyVariantFact") {
    await queryRows(db)`UPDATE "ShopifyVariantFact"
       SET "attributeFreshnessState" = ${freshness}::"CatalogAttributeFreshnessState",
           "attributeRequestGen" = ${req}::bigint,
           "attributeResponseGen" = ${resp}::bigint,
           "existenceDiagnosticState" = COALESCE(${diagnostic}, "existenceDiagnosticState"),
           "appliedAt" = clock_timestamp(),
           "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  if (table === "ShopifyInventoryItemFact") {
    await queryRows(db)`UPDATE "ShopifyInventoryItemFact"
       SET "attributeFreshnessState" = ${freshness}::"CatalogAttributeFreshnessState",
           "attributeRequestGen" = ${req}::bigint,
           "attributeResponseGen" = ${resp}::bigint,
           "existenceDiagnosticState" = COALESCE(${diagnostic}, "existenceDiagnosticState"),
           "appliedAt" = clock_timestamp(),
           "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  if (table === "ShopifyLocationFact") {
    await queryRows(db)`UPDATE "ShopifyLocationFact"
       SET "attributeFreshnessState" = ${freshness}::"CatalogAttributeFreshnessState",
           "attributeRequestGen" = ${req}::bigint,
           "attributeResponseGen" = ${resp}::bigint,
           "existenceDiagnosticState" = COALESCE(${diagnostic}, "existenceDiagnosticState"),
           "appliedAt" = clock_timestamp(),
           "updatedAt" = clock_timestamp()
       WHERE "shopId" = ${shopId} AND id = ${factId}`;
    return;
  }
  await queryRows(db)`UPDATE "ShopifyInventoryLevelFact"
     SET "attributeFreshnessState" = ${freshness}::"CatalogAttributeFreshnessState",
         "attributeRequestGen" = ${req}::bigint,
         "attributeResponseGen" = ${resp}::bigint,
         "existenceDiagnosticState" = COALESCE(${diagnostic}, "existenceDiagnosticState"),
         "appliedAt" = clock_timestamp(),
         "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId} AND id = ${factId}`;
}

export async function updateProductAttributes(
  db: CanonicalApplyDb,
  shopId: string,
  factId: string,
  attrs: ProductAttributes,
  shopifyUpdatedAt: Date | null,
  interval: GenerationInterval,
  freshness: "ORDERED" | "DEGRADED",
): Promise<void> {
  await queryRows(db)`UPDATE "ShopifyProductFact"
     SET title = ${attrs.title},
         handle = ${attrs.handle},
         vendor = ${attrs.vendor},
         "productType" = ${attrs.productType},
         tags = ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(attrs.tags)}::jsonb)),
         status = ${attrs.status}::"ShopifyProductStatus",
         "featuredMediaUrl" = ${attrs.featuredMediaUrl},
         "shopifyUpdatedAt" = ${shopifyUpdatedAt},
         "attributeRequestGen" = ${interval.requestGen.toString()}::bigint,
         "attributeResponseGen" = ${interval.responseGen.toString()}::bigint,
         "attributeFreshnessState" = ${freshness}::"CatalogAttributeFreshnessState",
         "appliedAt" = clock_timestamp(),
         "lastRefreshedAt" = clock_timestamp(),
         "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId} AND id = ${factId}`;
}

export async function updateVariantAttributes(
  db: CanonicalApplyDb,
  shopId: string,
  factId: string,
  attrs: VariantAttributes,
  shopifyUpdatedAt: Date | null,
  interval: GenerationInterval,
  freshness: "ORDERED" | "DEGRADED",
): Promise<void> {
  await queryRows(db)`UPDATE "ShopifyVariantFact"
     SET title = ${attrs.title},
         "displayName" = ${attrs.displayName},
         "selectedOptions" = ${JSON.stringify(attrs.selectedOptions)}::jsonb,
         sku = ${attrs.sku},
         barcode = ${attrs.barcode},
         "priceAmount" = ${assertFrozenNumericColumn(attrs.priceAmount, "priceAmount")}::decimal(20,6),
         "compareAtPriceAmount" = ${frozenNumericTextOrNull(attrs.compareAtPriceAmount, "compareAtPriceAmount")}::decimal(20,6),
         "currencyCode" = ${attrs.currencyCode},
         position = ${attrs.position},
         "shopifyProductGid" = ${attrs.shopifyProductGid},
         "shopifyUpdatedAt" = ${shopifyUpdatedAt},
         "attributeRequestGen" = ${interval.requestGen.toString()}::bigint,
         "attributeResponseGen" = ${interval.responseGen.toString()}::bigint,
         "attributeFreshnessState" = ${freshness}::"CatalogAttributeFreshnessState",
         "appliedAt" = clock_timestamp(),
         "lastRefreshedAt" = clock_timestamp(),
         "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId} AND id = ${factId}`;
}

export async function updateInventoryItemAttributes(
  db: CanonicalApplyDb,
  shopId: string,
  factId: string,
  attrs: InventoryItemAttributes,
  shopifyUpdatedAt: Date | null,
  interval: GenerationInterval,
  freshness: "ORDERED" | "DEGRADED",
): Promise<void> {
  await queryRows(db)`UPDATE "ShopifyInventoryItemFact"
     SET sku = ${attrs.sku},
         tracked = ${attrs.tracked},
         "requiresShipping" = ${attrs.requiresShipping},
         "weightValue" = ${frozenNumericTextOrNull(attrs.weightValue, "weightValue")}::decimal(20,6),
         "weightUnit" = ${attrs.weightUnit},
         "unitCostAmount" = ${frozenNumericTextOrNull(attrs.unitCostAmount, "unitCostAmount")}::decimal(20,6),
         "unitCostCurrencyCode" = ${attrs.unitCostCurrencyCode},
         "unitCostAccess" = ${attrs.unitCostAccess}::"CatalogUnitCostAccess",
         "shopifyVariantGid" = ${attrs.shopifyVariantGid},
         "shopifyUpdatedAt" = ${shopifyUpdatedAt},
         "attributeRequestGen" = ${interval.requestGen.toString()}::bigint,
         "attributeResponseGen" = ${interval.responseGen.toString()}::bigint,
         "attributeFreshnessState" = ${freshness}::"CatalogAttributeFreshnessState",
         "appliedAt" = clock_timestamp(),
         "lastRefreshedAt" = clock_timestamp(),
         "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId} AND id = ${factId}`;
}

export async function updateLocationAttributes(
  db: CanonicalApplyDb,
  shopId: string,
  factId: string,
  attrs: LocationAttributes,
  shopifyUpdatedAt: Date | null,
  interval: GenerationInterval,
  freshness: "ORDERED" | "DEGRADED",
): Promise<void> {
  await queryRows(db)`UPDATE "ShopifyLocationFact"
     SET name = ${attrs.name},
         "isActive" = ${attrs.isActive},
         "deactivatedAt" = ${attrs.deactivatedAt},
         "fulfillsOnlineOrders" = ${attrs.fulfillsOnlineOrders},
         "shipsInventory" = ${attrs.shipsInventory},
         "isFulfillmentService" = ${attrs.isFulfillmentService},
         "hasActiveInventory" = ${attrs.hasActiveInventory},
         address1 = ${attrs.address1},
         city = ${attrs.city},
         "provinceCode" = ${attrs.provinceCode},
         "countryCode" = ${attrs.countryCode},
         zip = ${attrs.zip},
         "shopifyUpdatedAt" = ${shopifyUpdatedAt},
         "attributeRequestGen" = ${interval.requestGen.toString()}::bigint,
         "attributeResponseGen" = ${interval.responseGen.toString()}::bigint,
         "attributeFreshnessState" = ${freshness}::"CatalogAttributeFreshnessState",
         "appliedAt" = clock_timestamp(),
         "lastRefreshedAt" = clock_timestamp(),
         "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId} AND id = ${factId}`;
}

export async function updateInventoryLevelAttributes(
  db: CanonicalApplyDb,
  shopId: string,
  factId: string,
  attrs: InventoryLevelAttributes,
  shopifyUpdatedAt: Date | null,
  interval: GenerationInterval,
  freshness: "ORDERED" | "DEGRADED",
): Promise<void> {
  await queryRows(db)`UPDATE "ShopifyInventoryLevelFact"
     SET "shopifyInventoryLevelGid" = ${attrs.shopifyInventoryLevelGid},
         "isActive" = ${attrs.isActive},
         "shopifyUpdatedAt" = ${shopifyUpdatedAt},
         "attributeRequestGen" = ${interval.requestGen.toString()}::bigint,
         "attributeResponseGen" = ${interval.responseGen.toString()}::bigint,
         "attributeFreshnessState" = ${freshness}::"CatalogAttributeFreshnessState",
         "appliedAt" = clock_timestamp(),
         "lastRefreshedAt" = clock_timestamp(),
         "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId} AND id = ${factId}`;
}

export async function updateQuantity(
  db: CanonicalApplyDb,
  shopId: string,
  factId: string,
  spec: (typeof QUANTITY_COLUMN_SPECS)[number],
  quantity: number | null,
  updatedAt: Date | null,
  interval: GenerationInterval,
): Promise<void> {
  if (quantity != null && !isCanonicalInt32(quantity)) {
    throw new CanonicalApplyQuantityDomainError(spec.name, quantity);
  }
  const req = interval.requestGen.toString();
  const resp = interval.responseGen.toString();
  switch (spec.name) {
    case "available":
      await queryRows(db)`UPDATE "ShopifyInventoryLevelFact"
         SET "availableQuantity" = ${quantity},
             "availableQuantityUpdatedAt" = ${updatedAt},
             "availableQuantityRequestGen" = ${req}::bigint,
             "availableQuantityResponseGen" = ${resp}::bigint,
             "updatedAt" = clock_timestamp()
         WHERE "shopId" = ${shopId} AND id = ${factId}`;
      return;
    case "onHand":
      await queryRows(db)`UPDATE "ShopifyInventoryLevelFact"
         SET "onHandQuantity" = ${quantity},
             "onHandQuantityUpdatedAt" = ${updatedAt},
             "onHandQuantityRequestGen" = ${req}::bigint,
             "onHandQuantityResponseGen" = ${resp}::bigint,
             "updatedAt" = clock_timestamp()
         WHERE "shopId" = ${shopId} AND id = ${factId}`;
      return;
    case "incoming":
      await queryRows(db)`UPDATE "ShopifyInventoryLevelFact"
         SET "incomingQuantity" = ${quantity},
             "incomingQuantityUpdatedAt" = ${updatedAt},
             "incomingQuantityRequestGen" = ${req}::bigint,
             "incomingQuantityResponseGen" = ${resp}::bigint,
             "updatedAt" = clock_timestamp()
         WHERE "shopId" = ${shopId} AND id = ${factId}`;
      return;
    case "committed":
      await queryRows(db)`UPDATE "ShopifyInventoryLevelFact"
         SET "committedQuantity" = ${quantity},
             "committedQuantityUpdatedAt" = ${updatedAt},
             "committedQuantityRequestGen" = ${req}::bigint,
             "committedQuantityResponseGen" = ${resp}::bigint,
             "updatedAt" = clock_timestamp()
         WHERE "shopId" = ${shopId} AND id = ${factId}`;
      return;
    case "reserved":
      await queryRows(db)`UPDATE "ShopifyInventoryLevelFact"
         SET "reservedQuantity" = ${quantity},
             "reservedQuantityUpdatedAt" = ${updatedAt},
             "reservedQuantityRequestGen" = ${req}::bigint,
             "reservedQuantityResponseGen" = ${resp}::bigint,
             "updatedAt" = clock_timestamp()
         WHERE "shopId" = ${shopId} AND id = ${factId}`;
      return;
    case "damaged":
      await queryRows(db)`UPDATE "ShopifyInventoryLevelFact"
         SET "damagedQuantity" = ${quantity},
             "damagedQuantityUpdatedAt" = ${updatedAt},
             "damagedQuantityRequestGen" = ${req}::bigint,
             "damagedQuantityResponseGen" = ${resp}::bigint,
             "updatedAt" = clock_timestamp()
         WHERE "shopId" = ${shopId} AND id = ${factId}`;
      return;
    case "safetyStock":
      await queryRows(db)`UPDATE "ShopifyInventoryLevelFact"
         SET "safetyStockQuantity" = ${quantity},
             "safetyStockQuantityUpdatedAt" = ${updatedAt},
             "safetyStockQuantityRequestGen" = ${req}::bigint,
             "safetyStockQuantityResponseGen" = ${resp}::bigint,
             "updatedAt" = clock_timestamp()
         WHERE "shopId" = ${shopId} AND id = ${factId}`;
      return;
    case "qualityControl":
      await queryRows(db)`UPDATE "ShopifyInventoryLevelFact"
         SET "qualityControlQuantity" = ${quantity},
             "qualityControlQuantityUpdatedAt" = ${updatedAt},
             "qualityControlQuantityRequestGen" = ${req}::bigint,
             "qualityControlQuantityResponseGen" = ${resp}::bigint,
             "updatedAt" = clock_timestamp()
         WHERE "shopId" = ${shopId} AND id = ${factId}`;
      return;
    default: {
      const _never: never = spec.name;
      throw new Error(`unknown quantity name ${String(_never)}`);
    }
  }
}

function tagsSemanticallyEqual(
  stored: readonly string[] | null | undefined,
  incoming: readonly string[],
): boolean {
  if (stored == null) return incoming.length === 0;
  if (stored.length !== incoming.length) return false;
  const left = [...stored].sort();
  const right = [...incoming].sort();
  return left.every((value, index) => value === right[index]);
}

function selectedOptionItemEqual(left: unknown, right: unknown): boolean {
  if (
    left == null ||
    right == null ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) return false;
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  return a.name === b.name && a.value === b.value;
}

export function selectedOptionsSemanticallyEqual(
  stored: unknown,
  incoming: unknown,
): boolean {
  if (!Array.isArray(stored) || !Array.isArray(incoming)) return false;
  if (stored.length !== incoming.length) return false;
  return stored.every((item, index) =>
    selectedOptionItemEqual(item, incoming[index]),
  );
}

export function productAttributesEqual(
  stored: FactSnapshot,
  attrs: ProductAttributes,
): boolean {
  return (
    stored.title === attrs.title &&
    stored.handle === attrs.handle &&
    (stored.vendor ?? null) === attrs.vendor &&
    (stored.productType ?? null) === attrs.productType &&
    tagsSemanticallyEqual(stored.tags, attrs.tags) &&
    stored.status === attrs.status &&
    (stored.featuredMediaUrl ?? null) === attrs.featuredMediaUrl
  );
}

export function variantAttributesEqual(
  stored: FactSnapshot,
  attrs: VariantAttributes,
): boolean {
  return (
    (stored.shopifyProductGid ?? null) === attrs.shopifyProductGid &&
    stored.title === attrs.title &&
    (stored.displayName ?? null) === attrs.displayName &&
    selectedOptionsSemanticallyEqual(
      stored.selectedOptions,
      attrs.selectedOptions,
    ) &&
    (stored.sku ?? null) === attrs.sku &&
    (stored.barcode ?? null) === attrs.barcode &&
    exactNumericEqual(
      stored.priceAmount ?? null,
      attrs.priceAmount,
      "priceAmount",
    ) &&
    exactNumericEqual(
      stored.compareAtPriceAmount ?? null,
      attrs.compareAtPriceAmount,
      "compareAtPriceAmount",
    ) &&
    stored.currencyCode === attrs.currencyCode &&
    (stored.position ?? null) === attrs.position
  );
}

export function inventoryItemAttributesEqual(
  stored: FactSnapshot,
  attrs: InventoryItemAttributes,
): boolean {
  return (
    (stored.shopifyVariantGid ?? null) === attrs.shopifyVariantGid &&
    (stored.sku ?? null) === attrs.sku &&
    stored.tracked === attrs.tracked &&
    stored.requiresShipping === attrs.requiresShipping &&
    exactNumericEqual(
      stored.weightValue ?? null,
      attrs.weightValue,
      "weightValue",
    ) &&
    (stored.weightUnit ?? null) === attrs.weightUnit &&
    exactNumericEqual(
      stored.unitCostAmount ?? null,
      attrs.unitCostAmount,
      "unitCostAmount",
    ) &&
    (stored.unitCostCurrencyCode ?? null) === attrs.unitCostCurrencyCode &&
    stored.unitCostAccess === attrs.unitCostAccess
  );
}

export function locationAttributesEqual(
  stored: FactSnapshot,
  attrs: LocationAttributes,
): boolean {
  return (
    stored.name === attrs.name &&
    stored.isActive === attrs.isActive &&
    (stored.deactivatedAt?.getTime() ?? null) ===
      (attrs.deactivatedAt?.getTime() ?? null) &&
    stored.fulfillsOnlineOrders === attrs.fulfillsOnlineOrders &&
    stored.shipsInventory === attrs.shipsInventory &&
    stored.isFulfillmentService === attrs.isFulfillmentService &&
    stored.hasActiveInventory === attrs.hasActiveInventory &&
    (stored.address1 ?? null) === attrs.address1 &&
    (stored.city ?? null) === attrs.city &&
    (stored.provinceCode ?? null) === attrs.provinceCode &&
    (stored.countryCode ?? null) === attrs.countryCode &&
    (stored.zip ?? null) === attrs.zip
  );
}

export function inventoryLevelAttributesEqual(
  stored: FactSnapshot,
  attrs: InventoryLevelAttributes,
): boolean {
  return (
    (stored.shopifyInventoryLevelGid ?? null) ===
      (attrs.shopifyInventoryLevelGid ?? null) &&
    stored.isActive === attrs.isActive
  );
}
