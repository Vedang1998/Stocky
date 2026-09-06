import type { TenantAuthority } from "../../../tenant/authority.server";
import {
  createTenantDb,
  type TenantDb,
} from "../../../tenant/tenant-db.server";
import { applyCanonicalFactsWithRetry, type CanonicalApplyDb } from "../apply";
import type {
  CanonicalApplyObservationResult,
  CanonicalFactIdentity,
  CanonicalObservation,
} from "../apply/types";
import { identityKey } from "../apply/types";
import { deriveIngestBatchId } from "./ingest-batch-id";
import { mapJsonlLineToCanonical } from "./mappers";
import type { JsonlBulkDomain, ParsedJsonlBatch } from "./types";
import type { UnitCostAccess } from "../admin-read";

const RESOURCE_ORDER: CanonicalFactIdentity["resourceKind"][] = [
  "Product",
  "ProductVariant",
  "InventoryItem",
  "Location",
  "InventoryLevel",
];

type ApplyBatchInput = {
  authority: TenantAuthority;
  domain: JsonlBulkDomain;
  batch: ParsedJsonlBatch;
  syncRunId: string;
  bulkOperationGid: string;
  fenceGeneration: bigint;
  durableJobId: string;
  observedAt: Date;
  currencyCode: string;
  unitCostAccess: UnitCostAccess;
  unitCostSelected: boolean;
  canonicalIdentitiesPerTransaction: number;
  configuredWorstCaseConcurrentCanonicalTransactions: number;
  assertProcessingEnabled: () => Promise<void>;
};

export type AppliedJsonlBatch = {
  ingestBatchId: string;
  results: CanonicalApplyObservationResult[];
  projectionIdentities: CanonicalFactIdentity[];
  collectionMemberships: Array<{
    productGid: string;
    collectionGid: string;
    title: string;
  }>;
};

function groupByIdentity(
  observations: readonly CanonicalObservation[],
): CanonicalObservation[][] {
  const groups = new Map<string, CanonicalObservation[]>();
  for (const observation of observations) {
    const key = identityKey(observation.identity);
    const group = groups.get(key) ?? [];
    group.push(observation);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function isSharedLockResourceFailure(error: unknown): boolean {
  const candidate = error as {
    code?: string;
    message?: string;
    meta?: { code?: string; message?: string };
  };
  const code = candidate.code ?? candidate.meta?.code;
  const message = `${candidate.message ?? ""} ${candidate.meta?.message ?? ""}`;
  return (
    code === "53200" ||
    /out of shared memory|increase max_locks_per_transaction/i.test(message)
  );
}

async function applyGroupsWithCapacityFallback(
  db: TenantDb,
  input: ApplyBatchInput,
  groups: CanonicalObservation[][],
): Promise<CanonicalApplyObservationResult[]> {
  const results: CanonicalApplyObservationResult[] = [];
  let cursor = 0;
  let effectiveSize = Math.min(
    input.canonicalIdentitiesPerTransaction,
    groups.length || 1,
  );
  let capacityFailures = 0;

  while (cursor < groups.length) {
    await input.assertProcessingEnabled();
    const slice = groups.slice(cursor, cursor + effectiveSize);
    const observations = slice.flat();
    try {
      const result = await applyCanonicalFactsWithRetry(
        (apply) =>
          db.$transaction((tx) => apply(tx as unknown as CanonicalApplyDb)),
        {
          shopId: input.authority.shopId,
          observations,
          requestedCanonicalIdentitiesPerTransaction: effectiveSize,
          configuredWorstCaseConcurrentCanonicalTransactions:
            input.configuredWorstCaseConcurrentCanonicalTransactions,
        },
      );
      if (
        result.results.length !== observations.length ||
        result.results.some(
          (item) =>
            item.factId == null &&
            observations.some(
              (observation) =>
                identityKey(observation.identity) ===
                  identityKey(item.identity) &&
                observation.existenceKind === "LIVE_FULL_SYNC_PRESENT",
            ),
        )
      ) {
        throw new Error("canonical_batch_affected_rows_mismatch");
      }
      results.push(...result.results);
      cursor += slice.length;
      capacityFailures = 0;
    } catch (error) {
      if (!isSharedLockResourceFailure(error) || effectiveSize <= 1) {
        throw error;
      }
      capacityFailures += 1;
      if (capacityFailures > 6) {
        throw new Error("canonical_lock_capacity_retry_exhausted");
      }
      effectiveSize = Math.max(1, Math.floor(effectiveSize / 2));
    }
  }
  return results;
}

export async function applyParsedJsonlBatch(
  input: ApplyBatchInput,
): Promise<AppliedJsonlBatch> {
  const ingestBatchId = deriveIngestBatchId({
    syncRunId: input.syncRunId,
    bulkOperationGid: input.bulkOperationGid,
    startLineOrdinal: input.batch.startLineOrdinal,
  });
  const mapped = input.batch.lines.map((line) =>
    mapJsonlLineToCanonical({
      shopId: input.authority.shopId,
      domain: input.domain,
      line,
      fenceGeneration: input.fenceGeneration,
      epochId: input.syncRunId,
      syncRunId: input.syncRunId,
      durableJobId: input.durableJobId,
      ingestBatchId,
      observedAt: input.observedAt,
      currencyCode: input.currencyCode,
      unitCostAccess: input.unitCostAccess,
      unitCostSelected: input.unitCostSelected,
    }),
  );
  const observations = mapped.flatMap((item) => item.observations);
  const db = createTenantDb(input.authority);
  const results: CanonicalApplyObservationResult[] = [];

  for (const resourceKind of RESOURCE_ORDER) {
    const groups = groupByIdentity(
      observations.filter(
        (observation) => observation.identity.resourceKind === resourceKind,
      ),
    );
    results.push(...(await applyGroupsWithCapacityFallback(db, input, groups)));
  }

  const projectionIdentities = [
    ...new Map(
      results
        .filter((result) => result.factId != null)
        .map((result) => [identityKey(result.identity), result.identity]),
    ).values(),
  ];
  return {
    ingestBatchId,
    results,
    projectionIdentities,
    collectionMemberships: mapped.flatMap((item) =>
      item.collectionMembership ? [item.collectionMembership] : [],
    ),
  };
}
