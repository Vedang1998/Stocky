import { randomUUID } from "node:crypto";
import type { TenantAuthority } from "../../../tenant/authority.server";
import { createTenantDb } from "../../../tenant/tenant-db.server";
import { acquireCanonicalIdentityAdvisoryLock } from "../advisory-lock";
import {
  CATALOG_OBSERVATION_MAX_LEASE_DURATION_MS,
  CATALOG_OBSERVATION_MIN_LEASE_DURATION_MS,
} from "../constants";
import { allocateCatalogObservationGeneration } from "../observation-generation";
import type { CanonicalApplyDb } from "../apply";
import type { CanonicalFactIdentity } from "../apply/types";

export type DirectObservationHandle = {
  token: string;
  requestGeneration: bigint;
  identity: CanonicalFactIdentity;
  leaseExpiresAt: Date;
};

function validateLeaseDuration(leaseDurationMs: number): void {
  if (
    !Number.isSafeInteger(leaseDurationMs) ||
    leaseDurationMs < CATALOG_OBSERVATION_MIN_LEASE_DURATION_MS ||
    leaseDurationMs > CATALOG_OBSERVATION_MAX_LEASE_DURATION_MS
  ) {
    throw new Error("catalog_observation_lease_duration_invalid");
  }
}

export async function beginDirectObservation(
  authority: TenantAuthority,
  input: {
    identity: CanonicalFactIdentity;
    leaseDurationMs: number;
    durableJobId?: string | null;
    jobAttemptId?: string | null;
    correlationId?: string | null;
  },
): Promise<DirectObservationHandle> {
  if (input.identity.shopId !== authority.shopId) {
    throw new Error("catalog_observation_shop_mismatch");
  }
  validateLeaseDuration(input.leaseDurationMs);
  const token = randomUUID();
  const db = createTenantDb(authority);
  return db.$transaction(async (tx) => {
    const requestGeneration = await allocateCatalogObservationGeneration(
      tx as unknown as CanonicalApplyDb,
    );
    const identity = input.identity;
    const row = await tx.catalogObservationInFlight.create({
      data: {
        id: token,
        shopId: authority.shopId,
        resourceKind: identity.resourceKind,
        shopifyGid:
          identity.resourceKind === "InventoryLevel"
            ? null
            : identity.shopifyGid,
        inventoryItemGid:
          identity.resourceKind === "InventoryLevel"
            ? identity.inventoryItemGid
            : null,
        locationGid:
          identity.resourceKind === "InventoryLevel"
            ? identity.locationGid
            : null,
        observationRequestGen: requestGeneration,
        leaseDurationMs: input.leaseDurationMs,
        // The F1 trigger replaces this with DB clock_timestamp() + duration.
        leaseExpiresAt: new Date(0),
        lifecycleState: "ACTIVE",
        durableJobId: input.durableJobId ?? null,
        jobAttemptId: input.jobAttemptId ?? null,
        correlationId: input.correlationId ?? null,
      },
    });
    return {
      token,
      requestGeneration,
      identity,
      leaseExpiresAt: row.leaseExpiresAt as Date,
    };
  });
}

export async function allocateDirectResponseGeneration(
  authority: TenantAuthority,
): Promise<bigint> {
  const db = createTenantDb(authority);
  return db.$transaction((tx) =>
    allocateCatalogObservationGeneration(tx as unknown as CanonicalApplyDb),
  );
}

export async function abandonDirectObservation(
  authority: TenantAuthority,
  handle: DirectObservationHandle,
): Promise<void> {
  const db = createTenantDb(authority);
  await db.$transaction(async (tx) => {
    await acquireCanonicalIdentityAdvisoryLock(
      tx as unknown as CanonicalApplyDb,
      handle.identity.resourceKind === "InventoryLevel"
        ? {
            shopId: authority.shopId,
            resourceKind: "InventoryLevel",
            inventoryItemGid: handle.identity.inventoryItemGid,
            locationGid: handle.identity.locationGid,
          }
        : {
            shopId: authority.shopId,
            resourceKind: handle.identity.resourceKind,
            shopifyGid: handle.identity.shopifyGid,
          },
    );
    const updated = await tx.catalogObservationInFlight.updateMany({
      where: {
        id: handle.token,
        observationRequestGen: handle.requestGeneration,
        lifecycleState: "ACTIVE",
        observationResponseGen: null,
      },
      data: { lifecycleState: "ABANDONED" },
    });
    if (updated.count !== 1) {
      throw new Error("catalog_observation_abandon_fence_failed");
    }
  });
}
