/**
 * Production-owned fair-claim candidate selection + locking SQL (D-047 / F-PR4-11 / F-PR4-13).
 *
 * Single Prisma.sql definition used by:
 * 1. claimBatchFair at runtime; and
 * 2. the EXPLAIN (ANALYZE, BUFFERS) performance harness.
 *
 * Algorithm: SQL-capped shop seed (LIMIT shopCap = batchSize) via indexed
 * earliest-eligibility probes, then per-shop LATERAL picks (PENDING ∪ RETRY_WAIT)
 * capped at maxPerShop using shop-claim indexes, then FOR UPDATE SKIP LOCKED on
 * the bounded candidate id set.
 *
 * Bound: candidate rows ≤ shopCap × maxPerShop, enforced by SQL LIMIT — independent
 * of total DurableJob backlog. Sort inputs are therefore bounded.
 */
import { Prisma } from "@prisma/client";

export type FairClaimQueryParams = {
  now: Date;
  batchSize: number;
  maxPerShop: number;
};

/** SQL-enforced shop discovery cap — enough to fill a batch at 1 job/shop. */
export function shopCapForFairClaim(batchSize: number): number {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("fair_claim_batch_size_invalid");
  }
  return batchSize;
}

/** Maximum candidate rows the fair-claim SQL may materialize before the final LIMIT. */
export function maxFairClaimCandidateRows(
  batchSize: number,
  maxPerShop: number,
): number {
  if (!Number.isInteger(maxPerShop) || maxPerShop < 1) {
    throw new Error("fair_claim_max_per_shop_invalid");
  }
  return shopCapForFairClaim(batchSize) * maxPerShop;
}

/**
 * Locked fair-claim SELECT — identical text for runtime claim and EXPLAIN harness.
 * Parameters are Prisma-bound (no string interpolation of values).
 *
 * Index-covered id probes (shopId, nextEligibleAt, createdAt, id) prefer
 * DurableJob_shop_claim_{pending,retry_wait}_idx over Seq Scan / global eligible
 * indexes when selecting LIMIT-bounded per-shop rows.
 */
export function buildFairClaimLockedSelectSql(
  params: FairClaimQueryParams,
): Prisma.Sql {
  const shopCap = shopCapForFairClaim(params.batchSize);
  const { now, batchSize, maxPerShop } = params;

  return Prisma.sql`
WITH shop_seed AS MATERIALIZED (
  SELECT s.id AS "shopId"
  FROM "Shop" s
  WHERE (
      SELECT j.id FROM "DurableJob" j
      WHERE j."shopId" = s.id
        AND j.state = 'PENDING'
        AND j."nextEligibleAt" <= ${now}
      ORDER BY j."shopId" ASC, j."nextEligibleAt" ASC, j."createdAt" ASC, j.id ASC
      LIMIT 1
    ) IS NOT NULL
    OR (
      SELECT j.id FROM "DurableJob" j
      WHERE j."shopId" = s.id
        AND j.state = 'RETRY_WAIT'
        AND j."nextEligibleAt" <= ${now}
      ORDER BY j."shopId" ASC, j."nextEligibleAt" ASC, j."createdAt" ASC, j.id ASC
      LIMIT 1
    ) IS NOT NULL
  ORDER BY LEAST(
    (
      SELECT j."nextEligibleAt" FROM "DurableJob" j
      WHERE j."shopId" = s.id
        AND j.state = 'PENDING'
        AND j."nextEligibleAt" <= ${now}
      ORDER BY j."shopId" ASC, j."nextEligibleAt" ASC, j."createdAt" ASC, j.id ASC
      LIMIT 1
    ),
    (
      SELECT j."nextEligibleAt" FROM "DurableJob" j
      WHERE j."shopId" = s.id
        AND j.state = 'RETRY_WAIT'
        AND j."nextEligibleAt" <= ${now}
      ORDER BY j."shopId" ASC, j."nextEligibleAt" ASC, j."createdAt" ASC, j.id ASC
      LIMIT 1
    )
  ) ASC NULLS LAST, s.id ASC
  LIMIT ${shopCap}
),
candidates AS (
  SELECT x.id
  FROM shop_seed ss
  CROSS JOIN LATERAL (
    SELECT id FROM (
      (
        SELECT id, "nextEligibleAt", "createdAt"
        FROM "DurableJob"
        WHERE "shopId" = ss."shopId"
          AND state = 'PENDING'
          AND "nextEligibleAt" <= ${now}
        ORDER BY "shopId" ASC, "nextEligibleAt" ASC, "createdAt" ASC, id ASC
        LIMIT ${maxPerShop}
      )
      UNION ALL
      (
        SELECT id, "nextEligibleAt", "createdAt"
        FROM "DurableJob"
        WHERE "shopId" = ss."shopId"
          AND state = 'RETRY_WAIT'
          AND "nextEligibleAt" <= ${now}
        ORDER BY "shopId" ASC, "nextEligibleAt" ASC, "createdAt" ASC, id ASC
        LIMIT ${maxPerShop}
      )
    ) merged
    ORDER BY "nextEligibleAt" ASC, "createdAt" ASC, id ASC
    LIMIT ${maxPerShop}
  ) x
),
locked AS (
  SELECT
    d.id, d."shopId", d."jobType", d.source, d."queueName",
    d."payloadSchemaVersion", d."sanitizedPayload", d."payloadDigest",
    d."correlationId", d."causationId", d.state,
    d."executionStrategy"::text AS "executionStrategy",
    d."activeDispatchSequence"
  FROM "DurableJob" d
  WHERE d.id = ANY(ARRAY(SELECT id FROM candidates))
    AND d.state IN ('PENDING', 'RETRY_WAIT')
  ORDER BY d."nextEligibleAt" ASC, d."createdAt" ASC, d.id ASC
  FOR UPDATE OF d SKIP LOCKED
  LIMIT ${batchSize}
)
SELECT
  id, "shopId", "jobType", source, "queueName",
  "payloadSchemaVersion", "sanitizedPayload", "payloadDigest",
  "correlationId", "causationId", state,
  "executionStrategy", "activeDispatchSequence"
FROM locked
`;
}

/** EXPLAIN wrapper over the identical production SELECT (no test-only SQL branch). */
export function buildFairClaimLockedExplainSql(
  params: FairClaimQueryParams,
): Prisma.Sql {
  return Prisma.sql`
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
${buildFairClaimLockedSelectSql(params)}
`;
}

/**
 * Stable identity fingerprint of the production claim SQL shape.
 * Used by tests to prove runtime and harness share one builder (no duplicated text).
 */
export function fairClaimSqlIdentity(): {
  module: string;
  selectBuilder: typeof buildFairClaimLockedSelectSql;
  explainBuilder: typeof buildFairClaimLockedExplainSql;
  algorithm: "bounded_shop_lateral_skip_locked";
} {
  return {
    module: "app/sync/fair-claim-query.server.ts",
    selectBuilder: buildFairClaimLockedSelectSql,
    explainBuilder: buildFairClaimLockedExplainSql,
    algorithm: "bounded_shop_lateral_skip_locked",
  };
}
