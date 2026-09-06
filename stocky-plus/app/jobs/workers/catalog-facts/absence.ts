import type { TenantAuthority } from "../../../tenant/authority.server";
import { createTenantDb } from "../../../tenant/tenant-db.server";
import type { CanonicalFactIdentity } from "../../../lib/catalog-facts/apply/types";
import { featureFlags } from "../../../lib/feature-flags.server";
import { writeCanonicalFactMetadata } from "./fact-diagnostics";

export const DEFAULT_ABSENCE_BREAKER_ABSOLUTE_COUNT = 250;
export const DEFAULT_ABSENCE_BREAKER_PROPORTION_BPS = 200;

export type PresenceAuthorityDomain =
  "catalog" | "locations" | "inventory_levels";

type FactDescriptor = {
  resourceKind: CanonicalFactIdentity["resourceKind"];
  delegate:
    | "shopifyProductFact"
    | "shopifyVariantFact"
    | "shopifyInventoryItemFact"
    | "shopifyLocationFact"
    | "shopifyInventoryLevelFact";
};

const DOMAIN_FACTS: Record<PresenceAuthorityDomain, FactDescriptor[]> = {
  catalog: [
    { resourceKind: "Product", delegate: "shopifyProductFact" },
    { resourceKind: "ProductVariant", delegate: "shopifyVariantFact" },
    { resourceKind: "InventoryItem", delegate: "shopifyInventoryItemFact" },
  ],
  locations: [{ resourceKind: "Location", delegate: "shopifyLocationFact" }],
  inventory_levels: [
    {
      resourceKind: "InventoryLevel",
      delegate: "shopifyInventoryLevelFact",
    },
  ],
};

function candidateWhere(epochId: string, fenceGeneration: bigint) {
  return {
    existenceState: "LIVE" as const,
    AND: [
      {
        OR: [
          { lastSeenFullSyncRunId: null },
          { lastSeenFullSyncRunId: { not: epochId } },
        ],
      },
      {
        OR: [
          { existenceRequestGen: null },
          { existenceRequestGen: { lte: fenceGeneration } },
        ],
      },
    ],
  };
}

type AbsenceCandidateRow = {
  id: string;
  shopifyGid?: string;
  inventoryItemGid?: string;
  locationGid?: string;
};

async function countAbsenceCandidates(
  db: ReturnType<typeof createTenantDb>,
  descriptor: FactDescriptor,
  epochId: string,
  fenceGeneration: bigint,
): Promise<{ liveCount: number; candidateCount: number }> {
  const where = candidateWhere(epochId, fenceGeneration);
  switch (descriptor.delegate) {
    case "shopifyProductFact":
      return {
        liveCount: await db.shopifyProductFact.count({
          where: { existenceState: "LIVE" },
        }),
        candidateCount: await db.shopifyProductFact.count({ where }),
      };
    case "shopifyVariantFact":
      return {
        liveCount: await db.shopifyVariantFact.count({
          where: { existenceState: "LIVE" },
        }),
        candidateCount: await db.shopifyVariantFact.count({ where }),
      };
    case "shopifyInventoryItemFact":
      return {
        liveCount: await db.shopifyInventoryItemFact.count({
          where: { existenceState: "LIVE" },
        }),
        candidateCount: await db.shopifyInventoryItemFact.count({ where }),
      };
    case "shopifyLocationFact":
      return {
        liveCount: await db.shopifyLocationFact.count({
          where: { existenceState: "LIVE" },
        }),
        candidateCount: await db.shopifyLocationFact.count({ where }),
      };
    case "shopifyInventoryLevelFact":
      return {
        liveCount: await db.shopifyInventoryLevelFact.count({
          where: { existenceState: "LIVE" },
        }),
        candidateCount: await db.shopifyInventoryLevelFact.count({ where }),
      };
  }
}

async function loadAbsenceCandidatePage(
  db: ReturnType<typeof createTenantDb>,
  descriptor: FactDescriptor,
  epochId: string,
  fenceGeneration: bigint,
  cursor: string | undefined,
): Promise<AbsenceCandidateRow[]> {
  const where = {
    ...candidateWhere(epochId, fenceGeneration),
    ...(cursor ? { id: { gt: cursor } } : {}),
  };
  switch (descriptor.delegate) {
    case "shopifyProductFact":
      return db.shopifyProductFact.findMany({
        where,
        orderBy: { id: "asc" },
        take: 32,
        select: { id: true, shopifyGid: true },
      });
    case "shopifyVariantFact":
      return db.shopifyVariantFact.findMany({
        where,
        orderBy: { id: "asc" },
        take: 32,
        select: { id: true, shopifyGid: true },
      });
    case "shopifyInventoryItemFact":
      return db.shopifyInventoryItemFact.findMany({
        where,
        orderBy: { id: "asc" },
        take: 32,
        select: { id: true, shopifyGid: true },
      });
    case "shopifyLocationFact":
      return db.shopifyLocationFact.findMany({
        where,
        orderBy: { id: "asc" },
        take: 32,
        select: { id: true, shopifyGid: true },
      });
    case "shopifyInventoryLevelFact":
      return db.shopifyInventoryLevelFact.findMany({
        where,
        orderBy: { id: "asc" },
        take: 32,
        select: { id: true, inventoryItemGid: true, locationGid: true },
      });
  }
}

function identityFromRow(
  shopId: string,
  descriptor: FactDescriptor,
  row: {
    shopifyGid?: string;
    inventoryItemGid?: string;
    locationGid?: string;
  },
): CanonicalFactIdentity {
  if (descriptor.resourceKind === "InventoryLevel") {
    if (!row.inventoryItemGid || !row.locationGid) {
      throw new Error("absence_inventory_level_identity_missing");
    }
    return {
      shopId,
      resourceKind: "InventoryLevel",
      inventoryItemGid: row.inventoryItemGid,
      locationGid: row.locationGid,
    };
  }
  if (!row.shopifyGid) {
    throw new Error("absence_gid_identity_missing");
  }
  return {
    shopId,
    resourceKind: descriptor.resourceKind,
    shopifyGid: row.shopifyGid,
  } as CanonicalFactIdentity;
}

function validateBreaker(input: {
  absoluteCount: number;
  proportionBps: number;
}): void {
  if (!Number.isSafeInteger(input.absoluteCount) || input.absoluteCount < 1) {
    throw new Error("absence_breaker_absolute_invalid");
  }
  if (
    !Number.isSafeInteger(input.proportionBps) ||
    input.proportionBps < 1 ||
    input.proportionBps > 10_000
  ) {
    throw new Error("absence_breaker_proportion_invalid");
  }
}

export async function nominateAbsenceCandidates(input: {
  authority: TenantAuthority;
  domain: PresenceAuthorityDomain;
  epochId: string;
  fenceGeneration: bigint;
  breakerAbsoluteCount?: number;
  breakerProportionBps?: number;
}): Promise<{
  candidateCount: number;
  nominatedCount: number;
  circuitBreakerHeldCount: number;
  deletionReconciliationHealthy: false;
}> {
  const breaker = {
    absoluteCount:
      input.breakerAbsoluteCount ?? DEFAULT_ABSENCE_BREAKER_ABSOLUTE_COUNT,
    proportionBps:
      input.breakerProportionBps ?? DEFAULT_ABSENCE_BREAKER_PROPORTION_BPS,
  };
  validateBreaker(breaker);
  const db = createTenantDb(input.authority);
  let candidateCount = 0;
  let nominatedCount = 0;
  let circuitBreakerHeldCount = 0;

  for (const descriptor of DOMAIN_FACTS[input.domain]) {
    const { liveCount, candidateCount: count } = await countAbsenceCandidates(
      db,
      descriptor,
      input.epochId,
      input.fenceGeneration,
    );
    candidateCount += count;
    const proportionBps =
      liveCount === 0 ? 0 : Math.floor((count * 10_000) / liveCount);
    const held =
      count >= breaker.absoluteCount && proportionBps >= breaker.proportionBps;

    let cursor: string | undefined;
    for (;;) {
      const rows = await loadAbsenceCandidatePage(
        db,
        descriptor,
        input.epochId,
        input.fenceGeneration,
        cursor,
      );
      if (rows.length === 0) break;
      for (const row of rows) {
        const updated = await writeCanonicalFactMetadata(input.authority, {
          identity: identityFromRow(input.authority.shopId, descriptor, row),
          absenceState: held ? "CIRCUIT_BREAKER_HELD" : "CANDIDATE",
          epochId: input.epochId,
          candidateGeneration: input.fenceGeneration,
          diagnostic: held ? "ABSENCE_CIRCUIT_BREAKER_HELD" : undefined,
          requireFenceEligibility: true,
        });
        if (updated) {
          if (held) circuitBreakerHeldCount += 1;
          else nominatedCount += 1;
        }
      }
      cursor = rows[rows.length - 1]!.id;
      if (rows.length < 32) break;
    }
  }

  return {
    candidateCount,
    nominatedCount,
    circuitBreakerHeldCount,
    // The flag is default off, so nomination alone never certifies deletion
    // reconciliation as healthy.
    deletionReconciliationHealthy: false,
  };
}

export async function confirmAbsenceCandidates(input: {
  authority: TenantAuthority;
  identities: readonly CanonicalFactIdentity[];
  confirm: (
    identity: CanonicalFactIdentity,
  ) => Promise<"LIVE" | "ABSENT" | "FAILED">;
  applyConfirmedAbsence: (identity: CanonicalFactIdentity) => Promise<void>;
  tombstoneGate?: () => boolean;
}): Promise<{
  live: number;
  tombstoned: number;
  failed: number;
  heldByFlag: number;
}> {
  const gate = input.tombstoneGate ?? featureFlags.pr5AbsenceTombstone;
  const output = { live: 0, tombstoned: 0, failed: 0, heldByFlag: 0 };
  for (const identity of input.identities) {
    const result = await input.confirm(identity);
    if (result === "FAILED") {
      output.failed += 1;
      continue;
    }
    if (result === "LIVE") {
      await writeCanonicalFactMetadata(input.authority, {
        identity,
        absenceState: "NONE",
        epochId: null,
        candidateGeneration: null,
      });
      output.live += 1;
      continue;
    }
    // Required server-side check immediately before the destructive canonical
    // transition. The default implementation reads the runtime kill switch.
    if (!gate()) {
      output.heldByFlag += 1;
      continue;
    }
    await input.applyConfirmedAbsence(identity);
    await writeCanonicalFactMetadata(input.authority, {
      identity,
      absenceState: "NONE",
      epochId: null,
      candidateGeneration: null,
    });
    output.tombstoned += 1;
  }
  return output;
}
