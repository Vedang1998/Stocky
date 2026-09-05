/**
 * F3 post-commit compatibility projection state writer.
 *
 * The caller supplies an open tenant transaction. Every fact identity is
 * protected by the same canonical transaction-scoped advisory lock used by
 * the applicator. This module never performs Shopify/network I/O.
 */
import { acquireCanonicalIdentityAdvisoryLock } from "../advisory-lock";
import {
  deriveCanonicalLockKey,
  orderCanonicalLockKeysForAcquisition,
  type CanonicalLockIdentity,
} from "../lock-key";
import { CanonicalApplyError } from "./errors";
import { queryRows, type CanonicalApplyDb } from "./sql";
import { identityKey, type CanonicalFactIdentity } from "./types";

export type CompatibilityProjectionWriteState =
  "PROJECTION_PENDING" | "HEALTHY" | "DEGRADED";

function uniqueIdentities(
  identities: readonly CanonicalFactIdentity[],
): CanonicalFactIdentity[] {
  const byIdentity = new Map<string, CanonicalFactIdentity>();
  for (const identity of identities) {
    byIdentity.set(identityKey(identity), identity);
  }
  return [...byIdentity.values()];
}

function lockIdentityOf(
  identity: CanonicalFactIdentity,
): CanonicalLockIdentity {
  if (identity.resourceKind === "InventoryLevel") {
    return {
      shopId: identity.shopId,
      resourceKind: "InventoryLevel",
      inventoryItemGid: identity.inventoryItemGid,
      locationGid: identity.locationGid,
    };
  }
  return {
    shopId: identity.shopId,
    resourceKind: identity.resourceKind,
    shopifyGid: identity.shopifyGid,
  };
}

async function updateOne(
  db: CanonicalApplyDb,
  identity: CanonicalFactIdentity,
  state: CompatibilityProjectionWriteState,
): Promise<number> {
  const shopId = identity.shopId;
  if (identity.resourceKind === "Product") {
    const rows = await queryRows(db)`UPDATE "ShopifyProductFact"
      SET "compatibilityProjectionState" = ${state}::"CatalogCompatibilityProjectionState",
          "updatedAt" = clock_timestamp()
      WHERE "shopId" = ${shopId} AND "shopifyGid" = ${identity.shopifyGid}
      RETURNING id`;
    return rows.length;
  }
  if (identity.resourceKind === "ProductVariant") {
    const rows = await queryRows(db)`UPDATE "ShopifyVariantFact"
      SET "compatibilityProjectionState" = ${state}::"CatalogCompatibilityProjectionState",
          "updatedAt" = clock_timestamp()
      WHERE "shopId" = ${shopId} AND "shopifyGid" = ${identity.shopifyGid}
      RETURNING id`;
    return rows.length;
  }
  if (identity.resourceKind === "InventoryItem") {
    const rows = await queryRows(db)`UPDATE "ShopifyInventoryItemFact"
      SET "compatibilityProjectionState" = ${state}::"CatalogCompatibilityProjectionState",
          "updatedAt" = clock_timestamp()
      WHERE "shopId" = ${shopId} AND "shopifyGid" = ${identity.shopifyGid}
      RETURNING id`;
    return rows.length;
  }
  if (identity.resourceKind === "Location") {
    const rows = await queryRows(db)`UPDATE "ShopifyLocationFact"
      SET "compatibilityProjectionState" = ${state}::"CatalogCompatibilityProjectionState",
          "updatedAt" = clock_timestamp()
      WHERE "shopId" = ${shopId} AND "shopifyGid" = ${identity.shopifyGid}
      RETURNING id`;
    return rows.length;
  }
  const levelIdentity = identity as Extract<
    CanonicalFactIdentity,
    { resourceKind: "InventoryLevel" }
  >;
  const rows = await queryRows(db)`UPDATE "ShopifyInventoryLevelFact"
    SET "compatibilityProjectionState" = ${state}::"CatalogCompatibilityProjectionState",
        "updatedAt" = clock_timestamp()
    WHERE "shopId" = ${shopId}
      AND "inventoryItemGid" = ${levelIdentity.inventoryItemGid}
      AND "locationGid" = ${levelIdentity.locationGid}
    RETURNING id`;
  return rows.length;
}

export async function writeCompatibilityProjectionState(
  db: CanonicalApplyDb,
  input: {
    shopId: string;
    identities: readonly CanonicalFactIdentity[];
    state: CompatibilityProjectionWriteState;
  },
): Promise<{ affectedRows: number }> {
  const identities = uniqueIdentities(input.identities);
  for (const identity of identities) {
    if (identity.shopId !== input.shopId) {
      throw new CanonicalApplyError(
        "projection_state_shop_mismatch",
        "Projection-state identity does not match the tenant shop",
      );
    }
  }

  const keyed = identities.map((identity) => ({
    identity,
    lockIdentity: lockIdentityOf(identity),
  }));
  const orderedKeys = orderCanonicalLockKeysForAcquisition(
    keyed.map(({ lockIdentity }) => deriveCanonicalLockKey(lockIdentity)),
  );
  const acquired = new Set<string>();
  for (const key of orderedKeys) {
    const lockId = `${key.key1}:${key.key2}`;
    if (acquired.has(lockId)) continue;
    const item = keyed.find(({ lockIdentity }) => {
      const derived = deriveCanonicalLockKey(lockIdentity);
      return derived.key1 === key.key1 && derived.key2 === key.key2;
    });
    if (!item) {
      throw new CanonicalApplyError(
        "projection_state_lock_identity_missing",
        "Unable to resolve ordered projection-state lock identity",
      );
    }
    await acquireCanonicalIdentityAdvisoryLock(db, item.lockIdentity);
    acquired.add(lockId);
  }

  let affectedRows = 0;
  for (const identity of identities.sort((a, b) =>
    identityKey(a).localeCompare(identityKey(b)),
  )) {
    const affected = await updateOne(db, identity, input.state);
    if (affected !== 1) {
      throw new CanonicalApplyError(
        "projection_state_fact_missing",
        `Projection-state write expected one canonical fact for ${identityKey(identity)}, got ${affected}`,
      );
    }
    affectedRows += affected;
  }

  return { affectedRows };
}
