import { createTenantDb } from "../../../tenant/tenant-db.server";
import {
  CANONICAL_PROJECTION_STATE_WRITE,
  COMPATIBILITY_PROJECTION_DEFAULT_BATCH_SIZE,
  COMPATIBILITY_PROJECTION_MAX_BATCH_SIZE,
} from "./constants";
import { CompatibilityProjectionError } from "./errors";
import {
  assertWriter,
  createTenantDbLegacyWriter,
} from "./legacy-writer";
import {
  mapInventoryLevelToLegacySnapshot,
  mapVariantToLegacyCache,
} from "./mapping";
import type {
  CanonicalExistenceState,
  CanonicalInventoryItemRead,
  CanonicalInventoryLevelRead,
  CanonicalProductRead,
  CanonicalVariantRead,
  CompatibilityProjectionFailure,
  CompatibilityProjectionIdentity,
  CompatibilityProjectionRequest,
  CompatibilityProjectionResult,
  LegacyCompatibilityWriter,
  ShopRebuildCursor,
} from "./types";

const VARIANT_INCLUDE = {
  product: true,
  inventoryItems: true,
} as const;

const LEVEL_INCLUDE = {
  location: true,
  inventoryItem: {
    include: {
      variant: true,
    },
  },
} as const;

export async function projectCompatibilityFromCanonicalFacts(
  request: CompatibilityProjectionRequest,
): Promise<CompatibilityProjectionResult> {
  if (request.processingEnabled !== true) {
    return buildResult({
      status: "DENIED_PROCESSING_DISABLED",
      retryable: false,
      recommendedCanonicalProjectionState: "DEGRADED",
      remainingIdentities:
        request.mode === "identities" ? [...request.identities] : [],
      cursor: request.mode === "shop_rebuild" ? request.cursor ?? null : null,
      hasMore: true,
      failure: {
        code: "processing_disabled",
        message:
          "Compatibility projection refuses merchant writes while processingEnabled is not true",
        retryable: false,
      },
    });
  }

  let limit: number;
  try {
    limit = resolveLimit(request.limit);
  } catch (error) {
    return failureResult(error);
  }

  const now = request.now ?? new Date();
  const db = createTenantDb(request.authority);
  const writer = request.writer ?? createTenantDbLegacyWriter(db);
  try {
    assertWriter(writer);
  } catch (error) {
    return failureResult(error);
  }

  if (request.mode === "identities") {
    return projectIdentities({
      db,
      writer,
      now,
      limit,
      identities: request.identities,
    });
  }

  return projectShopRebuild({
    db,
    writer,
    now,
    limit,
    cursor: request.cursor ?? null,
  });
}

function resolveLimit(limit: number | undefined): number {
  const value = limit ?? COMPATIBILITY_PROJECTION_DEFAULT_BATCH_SIZE;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > COMPATIBILITY_PROJECTION_MAX_BATCH_SIZE
  ) {
    throw new CompatibilityProjectionError(
      "invalid_batch_limit",
      `Compatibility projection limit must be an integer from 1 to ${COMPATIBILITY_PROJECTION_MAX_BATCH_SIZE}`,
      { retryable: false },
    );
  }
  return value;
}

async function projectIdentities(input: {
  db: ReturnType<typeof createTenantDb>;
  writer: LegacyCompatibilityWriter;
  now: Date;
  limit: number;
  identities: CompatibilityProjectionIdentity[];
}): Promise<CompatibilityProjectionResult> {
  const queued = [...input.identities];
  let processedVariantCount = 0;
  let processedInventoryLevelCount = 0;
  let skippedTombstoneCount = 0;

  while (queued.length > 0 && processedCount() < input.limit) {
    const identity = queued[0];
    try {
      const outcome = await projectOneIdentity(
        input.db,
        input.writer,
        input.now,
        identity,
      );
      queued.shift();
      if (identity.kind === "ProductVariant") {
        processedVariantCount += 1;
      } else {
        processedInventoryLevelCount += 1;
      }
      skippedTombstoneCount += outcome.skippedTombstoneCount;
    } catch (error) {
      return failureResult(error, {
        processedVariantCount,
        processedInventoryLevelCount,
        skippedTombstoneCount,
        remainingIdentities: queued,
        hasMore: queued.length > 0,
      });
    }
  }

  function processedCount(): number {
    return processedVariantCount + processedInventoryLevelCount;
  }

  return buildResult({
    status: "SUCCEEDED",
    retryable: false,
    recommendedCanonicalProjectionState: "HEALTHY",
    processedVariantCount,
    processedInventoryLevelCount,
    skippedTombstoneCount,
    remainingIdentities: queued,
    hasMore: queued.length > 0,
  });
}

async function projectShopRebuild(input: {
  db: ReturnType<typeof createTenantDb>;
  writer: LegacyCompatibilityWriter;
  now: Date;
  limit: number;
  cursor: ShopRebuildCursor | null;
}): Promise<CompatibilityProjectionResult> {
  let cursor = normalizeCursor(input.cursor);
  let processedVariantCount = 0;
  let processedInventoryLevelCount = 0;
  let skippedTombstoneCount = 0;
  let remaining = input.limit;
  let afterVariantGid =
    cursor.phase === "variants" ? cursor.afterGid : undefined;
  let afterItemGid =
    cursor.phase === "inventory_levels" ? cursor.afterItemGid : undefined;
  let afterLocationGid =
    cursor.phase === "inventory_levels" ? cursor.afterLocationGid : undefined;

  const db = input.db;

  try {
    if (cursor.phase === "variants") {
      const asked = remaining;
      const variants = (await db.shopifyVariantFact.findMany({
        where: afterVariantGid ? { shopifyGid: { gt: afterVariantGid } } : {},
        orderBy: { shopifyGid: "asc" },
        take: asked,
        include: VARIANT_INCLUDE,
      })) as unknown[];

      for (const raw of variants) {
        const variant = coerceVariant(raw);
        const plan = mapVariantToLegacyCache(variant, input.now);
        await input.writer.applyVariantPlan(plan);
        processedVariantCount += 1;
        remaining -= 1;
        afterVariantGid = variant.shopifyGid;
        if (plan.action === "tombstone") skippedTombstoneCount += 1;
      }

      const moreVariants =
        variants.length === asked
          ? (
              (await db.shopifyVariantFact.findMany({
                where: afterVariantGid
                  ? { shopifyGid: { gt: afterVariantGid } }
                  : {},
                orderBy: { shopifyGid: "asc" },
                take: 1,
                select: { shopifyGid: true },
              })) as Array<{ shopifyGid: string }>
            ).length > 0
          : false;

      if (moreVariants) {
        return buildResult({
          status: "SUCCEEDED",
          retryable: false,
          recommendedCanonicalProjectionState: "HEALTHY",
          processedVariantCount,
          processedInventoryLevelCount,
          skippedTombstoneCount,
          cursor: { phase: "variants", afterGid: afterVariantGid },
          hasMore: true,
        });
      }

      cursor = { phase: "inventory_levels" };
      afterItemGid = undefined;
      afterLocationGid = undefined;
      if (remaining === 0) {
        const moreLevels =
          (
            (await db.shopifyInventoryLevelFact.findMany({
              take: 1,
              select: { inventoryItemGid: true },
            })) as Array<{ inventoryItemGid: string }>
          ).length > 0;
        return buildResult({
          status: "SUCCEEDED",
          retryable: false,
          recommendedCanonicalProjectionState: "HEALTHY",
          processedVariantCount,
          processedInventoryLevelCount,
          skippedTombstoneCount,
          cursor: moreLevels ? { phase: "inventory_levels" } : null,
          hasMore: moreLevels,
        });
      }
    }

    const askedLevels = remaining;
    const levels = (await db.shopifyInventoryLevelFact.findMany({
      where: levelAfterWhere(afterItemGid, afterLocationGid),
      orderBy: [{ inventoryItemGid: "asc" }, { locationGid: "asc" }],
      take: askedLevels,
      include: LEVEL_INCLUDE,
    })) as unknown[];

    for (const raw of levels) {
      const level = coerceLevel(raw);
      const plan = mapInventoryLevelToLegacySnapshot(level, input.now);
      if (plan) {
        await input.writer.applySnapshotPlan(plan);
      }
      processedInventoryLevelCount += 1;
      remaining -= 1;
      afterItemGid = level.inventoryItemGid;
      afterLocationGid = level.locationGid;
      if (level.existenceState !== "LIVE") skippedTombstoneCount += 1;
    }

    const moreLevels =
      levels.length === askedLevels
        ? (
            (await db.shopifyInventoryLevelFact.findMany({
              where: levelAfterWhere(afterItemGid, afterLocationGid),
              orderBy: [{ inventoryItemGid: "asc" }, { locationGid: "asc" }],
              take: 1,
              select: { inventoryItemGid: true },
            })) as Array<{ inventoryItemGid: string }>
          ).length > 0
        : false;

    return buildResult({
      status: "SUCCEEDED",
      retryable: false,
      recommendedCanonicalProjectionState: "HEALTHY",
      processedVariantCount,
      processedInventoryLevelCount,
      skippedTombstoneCount,
      cursor: moreLevels
        ? {
            phase: "inventory_levels",
            afterItemGid,
            afterLocationGid,
          }
        : null,
      hasMore: moreLevels,
    });
  } catch (error) {
    return failureResult(error, {
      processedVariantCount,
      processedInventoryLevelCount,
      skippedTombstoneCount,
      cursor:
        cursor.phase === "variants"
          ? { phase: "variants", afterGid: afterVariantGid }
          : {
              phase: "inventory_levels",
              afterItemGid,
              afterLocationGid,
            },
      hasMore: true,
    });
  }
}

async function projectOneIdentity(
  db: ReturnType<typeof createTenantDb>,
  writer: LegacyCompatibilityWriter,
  now: Date,
  identity: CompatibilityProjectionIdentity,
): Promise<{ skippedTombstoneCount: number }> {
  if (identity.kind === "ProductVariant") {
    const raw = await db.shopifyVariantFact.findUnique({
      where: {
        shopId_shopifyGid: {
          shopId: db.authority.shopId,
          shopifyGid: identity.shopifyGid,
        },
      },
      include: VARIANT_INCLUDE,
    });
    if (!raw) {
      throw new CompatibilityProjectionError(
        "canonical_variant_missing",
        `Canonical variant ${identity.shopifyGid} was not found for projection`,
        { retryable: true, identity },
      );
    }
    const variant = coerceVariant(raw);
    const plan = mapVariantToLegacyCache(variant, now);
    await writer.applyVariantPlan(plan);
    return {
      skippedTombstoneCount: plan.action === "tombstone" ? 1 : 0,
    };
  }

  const raw = await db.shopifyInventoryLevelFact.findUnique({
    where: {
      shopId_inventoryItemGid_locationGid: {
        shopId: db.authority.shopId,
        inventoryItemGid: identity.inventoryItemGid,
        locationGid: identity.locationGid,
      },
    },
    include: LEVEL_INCLUDE,
  });
  if (!raw) {
    throw new CompatibilityProjectionError(
      "canonical_inventory_level_missing",
      `Canonical inventory level ${identity.inventoryItemGid} @ ${identity.locationGid} was not found for projection`,
      { retryable: true, identity },
    );
  }
  const level = coerceLevel(raw);
  const plan = mapInventoryLevelToLegacySnapshot(level, now);
  if (plan) {
    await writer.applySnapshotPlan(plan);
  }
  return {
    skippedTombstoneCount: level.existenceState === "ABSENT" ? 1 : 0,
  };
}

function levelAfterWhere(
  afterItemGid: string | undefined,
  afterLocationGid: string | undefined,
): Record<string, unknown> {
  if (!afterItemGid) return {};
  return {
    OR: [
      { inventoryItemGid: { gt: afterItemGid } },
      {
        AND: [
          { inventoryItemGid: afterItemGid },
          { locationGid: { gt: afterLocationGid ?? "" } },
        ],
      },
    ],
  };
}

function normalizeCursor(cursor: ShopRebuildCursor | null): ShopRebuildCursor {
  if (cursor == null) return { phase: "variants" };
  if (cursor.phase === "variants" || cursor.phase === "inventory_levels") {
    return cursor;
  }
  throw new CompatibilityProjectionError(
    "invalid_rebuild_cursor",
    "Compatibility projection rebuild cursor is malformed",
    { retryable: false },
  );
}

function coerceExistence(value: unknown, label: string): CanonicalExistenceState {
  if (value === "LIVE" || value === "ABSENT") return value;
  throw new CompatibilityProjectionError(
    "invalid_canonical_existence",
    `Canonical ${label} existenceState is not LIVE or ABSENT`,
    { retryable: false },
  );
}

function coerceProduct(raw: unknown): CanonicalProductRead | null {
  if (raw == null) return null;
  if (typeof raw !== "object") {
    throw new CompatibilityProjectionError(
      "invalid_canonical_product",
      "Canonical product include was not an object",
      { retryable: false },
    );
  }
  const row = raw as Record<string, unknown>;
  if (typeof row.shopifyGid !== "string" || typeof row.title !== "string") {
    throw new CompatibilityProjectionError(
      "invalid_canonical_product",
      "Canonical product is missing shopifyGid or title",
      { retryable: false },
    );
  }
  return {
    shopifyGid: row.shopifyGid,
    title: row.title,
    featuredMediaUrl:
      typeof row.featuredMediaUrl === "string" ? row.featuredMediaUrl : null,
    existenceState: coerceExistence(row.existenceState, "product"),
  };
}

function coerceItem(raw: unknown): CanonicalInventoryItemRead {
  if (typeof raw !== "object" || raw == null) {
    throw new CompatibilityProjectionError(
      "invalid_canonical_inventory_item",
      "Canonical inventory item was not an object",
      { retryable: false },
    );
  }
  const row = raw as Record<string, unknown>;
  if (typeof row.shopifyGid !== "string") {
    throw new CompatibilityProjectionError(
      "invalid_canonical_inventory_item",
      "Canonical inventory item is missing shopifyGid",
      { retryable: false },
    );
  }
  return {
    shopifyGid: row.shopifyGid,
    shopifyVariantGid:
      typeof row.shopifyVariantGid === "string" ? row.shopifyVariantGid : null,
    weightValue: (row.weightValue as CanonicalInventoryItemRead["weightValue"]) ?? null,
    weightUnit: typeof row.weightUnit === "string" ? row.weightUnit : null,
    existenceState: coerceExistence(row.existenceState, "inventory item"),
  };
}

function coerceVariant(raw: unknown): CanonicalVariantRead {
  if (typeof raw !== "object" || raw == null) {
    throw new CompatibilityProjectionError(
      "invalid_canonical_variant",
      "Canonical variant was not an object",
      { retryable: false },
    );
  }
  const row = raw as Record<string, unknown>;
  if (
    typeof row.shopifyGid !== "string" ||
    typeof row.shopifyProductGid !== "string" ||
    typeof row.title !== "string"
  ) {
    throw new CompatibilityProjectionError(
      "invalid_canonical_variant",
      "Canonical variant is missing identity or title",
      { retryable: false },
    );
  }
  const items = Array.isArray(row.inventoryItems) ? row.inventoryItems : [];
  return {
    shopifyGid: row.shopifyGid,
    shopifyProductGid: row.shopifyProductGid,
    title: row.title,
    sku: typeof row.sku === "string" ? row.sku : null,
    barcode: typeof row.barcode === "string" ? row.barcode : null,
    existenceState: coerceExistence(row.existenceState, "variant"),
    product: coerceProduct(row.product),
    inventoryItems: items.map(coerceItem),
  };
}

function coerceLevel(raw: unknown): CanonicalInventoryLevelRead {
  if (typeof raw !== "object" || raw == null) {
    throw new CompatibilityProjectionError(
      "invalid_canonical_inventory_level",
      "Canonical inventory level was not an object",
      { retryable: false },
    );
  }
  const row = raw as Record<string, unknown>;
  if (
    typeof row.inventoryItemGid !== "string" ||
    typeof row.locationGid !== "string"
  ) {
    throw new CompatibilityProjectionError(
      "invalid_canonical_inventory_level",
      "Canonical inventory level is missing pair identity",
      { retryable: false },
    );
  }
  const item =
    row.inventoryItem == null ? null : coerceItem(row.inventoryItem);
  const locationRaw = row.location;
  const location =
    locationRaw == null
      ? null
      : {
          shopifyGid:
            typeof (locationRaw as { shopifyGid?: unknown }).shopifyGid ===
            "string"
              ? (locationRaw as { shopifyGid: string }).shopifyGid
              : row.locationGid,
          existenceState: coerceExistence(
            (locationRaw as { existenceState?: unknown }).existenceState,
            "location",
          ),
        };
  const nestedVariant = (row.inventoryItem as { variant?: unknown } | null)
    ?.variant;
  const variantExistenceState =
    nestedVariant == null
      ? null
      : coerceExistence(
          (nestedVariant as { existenceState?: unknown }).existenceState,
          "variant",
        );

  return {
    inventoryItemGid: row.inventoryItemGid,
    locationGid: row.locationGid,
    availableQuantity:
      typeof row.availableQuantity === "number" ? row.availableQuantity : null,
    existenceState: coerceExistence(row.existenceState, "inventory level"),
    inventoryItem: item,
    location,
    variantExistenceState,
  };
}

function buildResult(input: {
  status: CompatibilityProjectionResult["status"];
  retryable: boolean;
  recommendedCanonicalProjectionState: CompatibilityProjectionResult["recommendedCanonicalProjectionState"];
  processedVariantCount?: number;
  processedInventoryLevelCount?: number;
  skippedTombstoneCount?: number;
  remainingIdentities?: CompatibilityProjectionIdentity[];
  cursor?: ShopRebuildCursor | null;
  hasMore: boolean;
  failure?: CompatibilityProjectionFailure;
}): CompatibilityProjectionResult {
  return {
    status: input.status,
    retryable: input.retryable,
    canonicalFactsUnchanged: true,
    canonicalCompatibilityProjectionStateWrite: CANONICAL_PROJECTION_STATE_WRITE,
    recommendedCanonicalProjectionState: input.recommendedCanonicalProjectionState,
    processedVariantCount: input.processedVariantCount ?? 0,
    processedInventoryLevelCount: input.processedInventoryLevelCount ?? 0,
    skippedTombstoneCount: input.skippedTombstoneCount ?? 0,
    hasMore: input.hasMore,
    cursor: input.cursor ?? null,
    remainingIdentities: input.remainingIdentities ?? [],
    ...(input.failure ? { failure: input.failure } : {}),
  };
}

function failureResult(
  error: unknown,
  extras?: {
    processedVariantCount?: number;
    processedInventoryLevelCount?: number;
    skippedTombstoneCount?: number;
    remainingIdentities?: CompatibilityProjectionIdentity[];
    cursor?: ShopRebuildCursor | null;
    hasMore?: boolean;
  },
): CompatibilityProjectionResult {
  const failure = toFailure(error);
  return buildResult({
    status: "FAILED",
    retryable: failure.retryable,
    recommendedCanonicalProjectionState: "DEGRADED",
    processedVariantCount: extras?.processedVariantCount,
    processedInventoryLevelCount: extras?.processedInventoryLevelCount,
    skippedTombstoneCount: extras?.skippedTombstoneCount,
    remainingIdentities: extras?.remainingIdentities,
    cursor: extras?.cursor,
    hasMore: extras?.hasMore ?? true,
    failure,
  });
}

function toFailure(error: unknown): CompatibilityProjectionFailure {
  if (error instanceof CompatibilityProjectionError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      identity: error.identity,
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return {
    code: "projection_write_failed",
    message,
    retryable: true,
  };
}
