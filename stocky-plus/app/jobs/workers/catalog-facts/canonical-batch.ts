import type { TenantAuthority } from "../../../tenant/authority.server";
import { createTenantDb } from "../../../tenant/tenant-db.server";
import {
  applyCanonicalFactsWithRetry,
  type CanonicalApplyDb,
} from "../../../lib/catalog-facts";
import type {
  CanonicalApplyObservationResult,
  CanonicalFactIdentity,
  CanonicalObservation,
} from "../../../lib/catalog-facts/apply/types";
import { identityKey } from "../../../lib/catalog-facts/apply/types";
import { projectAppliedCanonicalFacts } from "./projection";

export async function applyCanonicalObservationBatches(input: {
  authority: TenantAuthority;
  observations: readonly CanonicalObservation[];
  batchSize: number;
  configuredWorstCaseConcurrentCanonicalTransactions: number;
  assertProcessingEnabled: () => Promise<void>;
  project?: boolean;
}): Promise<CanonicalApplyObservationResult[]> {
  if (!Number.isSafeInteger(input.batchSize) || input.batchSize < 1) {
    throw new Error("canonical_observation_batch_size_invalid");
  }
  const db = createTenantDb(input.authority);
  const groups = new Map<string, CanonicalObservation[]>();
  for (const observation of input.observations) {
    const key = identityKey(observation.identity);
    const grouped = groups.get(key) ?? [];
    grouped.push(observation);
    groups.set(key, grouped);
  }
  const orderedGroups = [...groups.values()].sort((a, b) =>
    identityKey(a[0]!.identity).localeCompare(identityKey(b[0]!.identity)),
  );
  const results: CanonicalApplyObservationResult[] = [];
  for (let start = 0; start < orderedGroups.length; start += input.batchSize) {
    await input.assertProcessingEnabled();
    const groupSlice = orderedGroups.slice(start, start + input.batchSize);
    const observations = groupSlice.flat();
    const applied = await applyCanonicalFactsWithRetry(
      (apply) =>
        db.$transaction((tx) => apply(tx as unknown as CanonicalApplyDb)),
      {
        shopId: input.authority.shopId,
        observations,
        requestedCanonicalIdentitiesPerTransaction: groupSlice.length,
        configuredWorstCaseConcurrentCanonicalTransactions:
          input.configuredWorstCaseConcurrentCanonicalTransactions,
      },
    );
    if (applied.results.length !== observations.length) {
      throw new Error("canonical_batch_result_count_mismatch");
    }
    results.push(...applied.results);
    if (input.project !== false) {
      const identities: CanonicalFactIdentity[] = [
        ...new Map(
          applied.results
            .filter((result) => result.factId != null)
            .map((result) => [identityKey(result.identity), result.identity]),
        ).values(),
      ];
      await projectAppliedCanonicalFacts({
        authority: input.authority,
        canonicalIdentities: identities,
      });
    }
  }
  return results;
}
