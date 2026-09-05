import type { TenantAuthority } from "../../../tenant/authority.server";
import { createTenantDb } from "../../../tenant/tenant-db.server";
import { getControlPlanePrisma } from "../../../sync/control-plane-db.server";
import {
  writeCompatibilityProjectionState,
  type CanonicalApplyDb,
} from "../../../lib/catalog-facts";
import type { CanonicalFactIdentity } from "../../../lib/catalog-facts/apply/types";
import {
  projectCompatibilityFromCanonicalFacts,
  type CompatibilityProjectionIdentity,
  type CompatibilityProjectionResult,
} from "../../../lib/catalog-facts/compatibility-projection";

export const MIN_PRODUCT_REVIVAL_OBSERVATION_CYCLES = 2;
export const MAX_COMPATIBILITY_PROJECTION_ATTEMPTS = 3;

export function shouldRetryCompatibilityProjection(
  failureCode: string,
  completedObservationCycles: number,
): boolean {
  if (
    !Number.isSafeInteger(completedObservationCycles) ||
    completedObservationCycles < 0
  ) {
    throw new Error("projection_observation_cycle_count_invalid");
  }
  if (failureCode === "canonical_product_not_live") {
    return completedObservationCycles < MIN_PRODUCT_REVIVAL_OBSERVATION_CYCLES;
  }
  return true;
}

async function requireLiveProcessing(
  authority: TenantAuthority,
): Promise<void> {
  const shop = await getControlPlanePrisma().shop.findUnique({
    where: { id: authority.shopId },
    select: { myshopifyDomain: true, processingEnabled: true },
  });
  if (
    !shop?.processingEnabled ||
    shop.myshopifyDomain !== authority.myshopifyDomain
  ) {
    throw new Error("shop_processing_disabled");
  }
}

async function resolveProjectionIdentities(
  authority: TenantAuthority,
  identities: readonly CanonicalFactIdentity[],
): Promise<CompatibilityProjectionIdentity[]> {
  const db = createTenantDb(authority);
  const resolved: CompatibilityProjectionIdentity[] = [];
  for (const identity of identities) {
    if (identity.resourceKind === "ProductVariant") {
      resolved.push({
        kind: "ProductVariant",
        shopifyGid: identity.shopifyGid,
      });
    } else if (identity.resourceKind === "InventoryLevel") {
      resolved.push({
        kind: "InventoryLevel",
        inventoryItemGid: identity.inventoryItemGid,
        locationGid: identity.locationGid,
      });
    } else if (identity.resourceKind === "Product") {
      const variants = await db.shopifyVariantFact.findMany({
        where: { shopifyProductGid: identity.shopifyGid },
        select: { shopifyGid: true },
        orderBy: { shopifyGid: "asc" },
        take: 100,
      });
      resolved.push(
        ...variants.map((variant: { shopifyGid: string }) => ({
          kind: "ProductVariant" as const,
          shopifyGid: variant.shopifyGid,
        })),
      );
    } else if (identity.resourceKind === "InventoryItem") {
      const item = await db.shopifyInventoryItemFact.findUnique({
        where: {
          shopId_shopifyGid: {
            shopId: authority.shopId,
            shopifyGid: identity.shopifyGid,
          },
        },
        select: { shopifyVariantGid: true },
      });
      if (item?.shopifyVariantGid) {
        resolved.push({
          kind: "ProductVariant",
          shopifyGid: item.shopifyVariantGid,
        });
      }
      const levels = await db.shopifyInventoryLevelFact.findMany({
        where: { inventoryItemGid: identity.shopifyGid },
        select: { inventoryItemGid: true, locationGid: true },
        take: 100,
      });
      resolved.push(
        ...levels.map(
          (level: { inventoryItemGid: string; locationGid: string }) => ({
            kind: "InventoryLevel" as const,
            inventoryItemGid: level.inventoryItemGid,
            locationGid: level.locationGid,
          }),
        ),
      );
    } else {
      const levels = await db.shopifyInventoryLevelFact.findMany({
        where: { locationGid: identity.shopifyGid },
        select: { inventoryItemGid: true, locationGid: true },
        take: 100,
      });
      resolved.push(
        ...levels.map(
          (level: { inventoryItemGid: string; locationGid: string }) => ({
            kind: "InventoryLevel" as const,
            inventoryItemGid: level.inventoryItemGid,
            locationGid: level.locationGid,
          }),
        ),
      );
    }
  }
  const unique = new Map<string, CompatibilityProjectionIdentity>();
  for (const identity of resolved) {
    const key =
      identity.kind === "ProductVariant"
        ? `variant:${identity.shopifyGid}`
        : `level:${identity.inventoryItemGid}:${identity.locationGid}`;
    unique.set(key, identity);
  }
  return [...unique.values()];
}

async function persistState(
  authority: TenantAuthority,
  identities: readonly CanonicalFactIdentity[],
  state: "HEALTHY" | "DEGRADED",
): Promise<void> {
  if (identities.length === 0) return;
  const db = createTenantDb(authority);
  await db.$transaction((tx) =>
    writeCompatibilityProjectionState(tx as unknown as CanonicalApplyDb, {
      shopId: authority.shopId,
      identities,
      state,
    }),
  );
}

export async function projectAppliedCanonicalFacts(input: {
  authority: TenantAuthority;
  canonicalIdentities: readonly CanonicalFactIdentity[];
  now?: Date;
  completedObservationCycles?: number;
}): Promise<CompatibilityProjectionResult | null> {
  await requireLiveProcessing(input.authority);
  const projectionIdentities = await resolveProjectionIdentities(
    input.authority,
    input.canonicalIdentities,
  );
  if (projectionIdentities.length === 0) {
    await persistState(input.authority, input.canonicalIdentities, "HEALTHY");
    return null;
  }

  const result = await projectCompatibilityFromCanonicalFacts({
    authority: input.authority,
    processingEnabled: true,
    mode: "identities",
    identities: projectionIdentities,
    limit: 100,
    now: input.now,
  });
  if (result.status === "SUCCEEDED" && !result.hasMore) {
    await persistState(input.authority, input.canonicalIdentities, "HEALTHY");
    return result;
  }
  if (result.status === "SUCCEEDED") {
    // A bounded partial page is not failure and cannot authorize whole-set
    // HEALTHY. Existing PROJECTION_PENDING evidence remains authoritative.
    return result;
  }

  await persistState(input.authority, input.canonicalIdentities, "DEGRADED");
  const code = result.failure?.code ?? "compatibility_projection_incomplete";
  if (
    result.retryable &&
    shouldRetryCompatibilityProjection(
      code,
      input.completedObservationCycles ?? 0,
    )
  ) {
    return result;
  }
  return result;
}

export async function recoverPendingCompatibilityProjection(input: {
  authority: TenantAuthority;
  completedObservationCycles: number;
  limit?: number;
}): Promise<{ attempted: number; failed: boolean }> {
  const limit = input.limit ?? 32;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("projection_recovery_limit_invalid");
  }
  const db = createTenantDb(input.authority);
  const pendingState = {
    compatibilityProjectionState: {
      in: ["PROJECTION_PENDING", "DEGRADED"],
    },
  };
  const identities: CanonicalFactIdentity[] = [];
  const products = await db.shopifyProductFact.findMany({
    where: pendingState,
    select: { shopifyGid: true },
    take: limit,
  });
  identities.push(
    ...products.map((row: { shopifyGid: string }) => ({
      shopId: input.authority.shopId,
      resourceKind: "Product" as const,
      shopifyGid: row.shopifyGid,
    })),
  );
  if (identities.length < limit) {
    const variants = await db.shopifyVariantFact.findMany({
      where: pendingState,
      select: { shopifyGid: true },
      take: limit - identities.length,
    });
    identities.push(
      ...variants.map((row: { shopifyGid: string }) => ({
        shopId: input.authority.shopId,
        resourceKind: "ProductVariant" as const,
        shopifyGid: row.shopifyGid,
      })),
    );
  }
  if (identities.length < limit) {
    const items = await db.shopifyInventoryItemFact.findMany({
      where: pendingState,
      select: { shopifyGid: true },
      take: limit - identities.length,
    });
    identities.push(
      ...items.map((row: { shopifyGid: string }) => ({
        shopId: input.authority.shopId,
        resourceKind: "InventoryItem" as const,
        shopifyGid: row.shopifyGid,
      })),
    );
  }
  if (identities.length < limit) {
    const locations = await db.shopifyLocationFact.findMany({
      where: pendingState,
      select: { shopifyGid: true },
      take: limit - identities.length,
    });
    identities.push(
      ...locations.map((row: { shopifyGid: string }) => ({
        shopId: input.authority.shopId,
        resourceKind: "Location" as const,
        shopifyGid: row.shopifyGid,
      })),
    );
  }
  if (identities.length < limit) {
    const levels = await db.shopifyInventoryLevelFact.findMany({
      where: pendingState,
      select: { inventoryItemGid: true, locationGid: true },
      take: limit - identities.length,
    });
    identities.push(
      ...levels.map(
        (row: { inventoryItemGid: string; locationGid: string }) => ({
          shopId: input.authority.shopId,
          resourceKind: "InventoryLevel" as const,
          inventoryItemGid: row.inventoryItemGid,
          locationGid: row.locationGid,
        }),
      ),
    );
  }

  if (identities.length === 0) return { attempted: 0, failed: false };
  const result = await projectAppliedCanonicalFacts({
    authority: input.authority,
    canonicalIdentities: identities,
    completedObservationCycles: input.completedObservationCycles,
  });
  return {
    attempted: identities.length,
    failed: result?.status === "FAILED",
  };
}
