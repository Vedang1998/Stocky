/**
 * Production-owned fair-claim candidate selection + locking SQL
 * (D-048 / D-049 / F-PR4-11 / F-PR4-13).
 *
 * Single Prisma.sql definition used by:
 * 1. claimBatchFair at runtime; and
 * 2. the EXPLAIN (ANALYZE, BUFFERS) performance harness.
 *
 * Algorithm (D-049 DispatchReadyShop scheduling key):
 * - Lock a bounded set of due, processing-enabled shops from DispatchReadyShop
 *   WHERE nextDispatchAt <= now ORDER BY nextDispatchAt, shopId
 *   FOR UPDATE SKIP LOCKED LIMIT shopCap.
 * - Index leading order matches the predicate/order
 *   (processingEnabled, nextDispatchAt, shopId) so PostgreSQL can stop after
 *   the bounded window — no active-due Seq Scan / Bitmap walk / fairness Sort.
 * - Reconcile each locked shop against DurableJob ground truth (bounded
 *   shop-scoped index access):
 *     * no eligible work → DELETE readiness (one path; never UPDATE+DELETE);
 *     * actual earliest future → reschedule nextDispatchAt to that time;
 *     * actual earliest due → claim candidates and advance
 *       nextDispatchAt = GREATEST(actual, now + 1ms) (strict fairness).
 * - Per-shop LATERAL picks (PENDING ∪ RETRY_WAIT) capped at maxPerShop via
 *   shop-claim indexes (range-pair predicate retained — R-122).
 * - Prefer first-round (shop_slot=1) across selected shops before second slots.
 * - FOR UPDATE SKIP LOCKED on DurableJob, final LIMIT batchSize.
 *
 * Boundedness (per claim SQL invocation / refill round):
 * - Scheduling rows examined ≤ shopCap (SQL LIMIT + matching schedule index).
 * - Candidate DurableJob rows ≤ shopCap × maxPerShop (SQL LIMIT).
 * - Independent of total Shop count, total DurableJob backlog, and active-due
 *   population size.
 *
 * Refill (claimBatchFair):
 * - Up to FAIR_CLAIM_MAX_REFILL_ROUNDS rounds when reconciliation removes or
 *   reschedules stale rows and unlocked due shops remain.
 * - Max shops locked per dispatch invocation =
 *   shopCap × FAIR_CLAIM_MAX_REFILL_ROUNDS.
 * - Max jobs returned per invocation = batchSize.
 *
 * Eventual-progress invariant (documented):
 * A continuously eligible, processing-enabled shop receives a service
 * opportunity within ceil(activeEligibleShops / shopCap) successful dispatch
 * cycles when capacity exists (shopCap = batchSize). Served shops move
 * nextDispatchAt strictly after the dispatch cutoff so ties cannot re-win.
 */
import { Prisma } from "@prisma/client";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
 * Bounded refill rounds after stale readiness reconciliation.
 * Stale rows must not permanently consume shopCap when unlocked due work remains.
 */
export const FAIR_CLAIM_MAX_REFILL_ROUNDS = 8;

/** Max shops locked across all refill rounds of one dispatch invocation. */
export function maxFairClaimShopsLockedPerInvocation(
  batchSize: number,
): number {
  return shopCapForFairClaim(batchSize) * FAIR_CLAIM_MAX_REFILL_ROUNDS;
}

/**
 * Starvation bound: cycles until every continuously eligible shop has had a
 * service opportunity under nextDispatchAt rotation with strict forward movement.
 */
export function fairClaimStarvationBoundCycles(
  activeEligibleShops: number,
  batchSize: number,
): number {
  if (!Number.isInteger(activeEligibleShops) || activeEligibleShops < 0) {
    throw new Error("fair_claim_active_shops_invalid");
  }
  if (activeEligibleShops === 0) return 0;
  return Math.ceil(activeEligibleShops / shopCapForFairClaim(batchSize));
}

/**
 * Locked fair-claim SELECT — identical text for runtime claim and EXPLAIN harness.
 * Parameters are Prisma-bound (no string interpolation of values).
 *
 * Per-shop DurableJob predicates retain the D-047 range-pair
 * (`"shopId" >= $id AND "shopId" <= $id`) so PostgreSQL selects
 * DurableJob_shop_claim_* Index Only Scans. Bare equality still competes with
 * DurableJob_eligible_*_idx (P3-D047-R09 / R-122 residual — documented, CI-gated,
 * not a PostgreSQL contract). Selection itself is driven from DispatchReadyShop,
 * never from a Shop Seq Scan.
 */
export function buildFairClaimLockedSelectSql(
  params: FairClaimQueryParams,
): Prisma.Sql {
  const shopCap = shopCapForFairClaim(params.batchSize);
  const { now, batchSize, maxPerShop } = params;
  // Strict fairness: served continuously-eligible shops move at least 1ms past cutoff.
  const fairnessFloor = new Date(now.getTime() + 1);

  return Prisma.sql`
WITH due_shops AS MATERIALIZED (
  SELECT r."shopId"
  FROM "DispatchReadyShop" r
  WHERE r."processingEnabled" = true
    AND r."nextDispatchAt" <= ${now}
  ORDER BY r."nextDispatchAt" ASC, r."shopId" ASC
  FOR UPDATE OF r SKIP LOCKED
  LIMIT ${shopCap}
),
truth AS (
  SELECT
    d."shopId",
    LEAST(
      (
        SELECT j."nextEligibleAt"
        FROM "DurableJob" j
        WHERE j."shopId" >= d."shopId" AND j."shopId" <= d."shopId"
          AND j.state = 'PENDING'
        ORDER BY j."shopId" ASC, j."nextEligibleAt" ASC, j."createdAt" ASC, j.id ASC
        LIMIT 1
      ),
      (
        SELECT j."nextEligibleAt"
        FROM "DurableJob" j
        WHERE j."shopId" >= d."shopId" AND j."shopId" <= d."shopId"
          AND j.state = 'RETRY_WAIT'
        ORDER BY j."shopId" ASC, j."nextEligibleAt" ASC, j."createdAt" ASC, j.id ASC
        LIMIT 1
      )
    ) AS actual_earliest
  FROM due_shops d
),
heal_empty AS (
  DELETE FROM "DispatchReadyShop" r
  WHERE r."shopId" IN (
    SELECT t."shopId" FROM truth t WHERE t.actual_earliest IS NULL
  )
  RETURNING r."shopId"
),
reschedule_future AS (
  UPDATE "DispatchReadyShop" r
  SET
    "earliestEligibleAt" = t.actual_earliest,
    "nextDispatchAt" = t.actual_earliest,
    "updatedAt" = ${now}
  FROM truth t
  WHERE r."shopId" = t."shopId"
    AND t.actual_earliest IS NOT NULL
    AND t.actual_earliest > ${now}
  RETURNING r."shopId"
),
served AS (
  UPDATE "DispatchReadyShop" r
  SET
    "earliestEligibleAt" = t.actual_earliest,
    "nextDispatchAt" = GREATEST(t.actual_earliest, ${fairnessFloor}::timestamp(3)),
    "lastServedAt" = ${now},
    "updatedAt" = ${now}
  FROM truth t
  WHERE r."shopId" = t."shopId"
    AND t.actual_earliest IS NOT NULL
    AND t.actual_earliest <= ${now}
  RETURNING r."shopId"
),
candidates AS (
  SELECT
    x.id,
    x."nextEligibleAt",
    x."createdAt",
    x.shop_slot
  FROM served ss
  CROSS JOIN LATERAL (
    SELECT
      id,
      "nextEligibleAt",
      "createdAt",
      ROW_NUMBER() OVER (
        ORDER BY "nextEligibleAt" ASC, "createdAt" ASC, id ASC
      ) AS shop_slot
    FROM (
      (
        SELECT id, "nextEligibleAt", "createdAt"
        FROM "DurableJob"
        WHERE "shopId" >= ss."shopId" AND "shopId" <= ss."shopId"
          AND state = 'PENDING'
          AND "nextEligibleAt" <= ${now}
        ORDER BY "shopId" ASC, "nextEligibleAt" ASC, "createdAt" ASC, id ASC
        LIMIT ${maxPerShop}
      )
      UNION ALL
      (
        SELECT id, "nextEligibleAt", "createdAt"
        FROM "DurableJob"
        WHERE "shopId" >= ss."shopId" AND "shopId" <= ss."shopId"
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
ordered_candidates AS (
  SELECT id, "nextEligibleAt", "createdAt", shop_slot
  FROM candidates
  ORDER BY shop_slot ASC, "nextEligibleAt" ASC, "createdAt" ASC, id ASC
  LIMIT ${batchSize}
),
locked AS (
  SELECT
    d.id, d."shopId", d."jobType", d.source, d."queueName",
    d."payloadSchemaVersion", d."sanitizedPayload", d."payloadDigest",
    d."correlationId", d."causationId", d.state,
    d."executionStrategy"::text AS "executionStrategy",
    d."activeDispatchSequence",
    oc.shop_slot,
    oc."nextEligibleAt" AS claim_next_eligible_at,
    oc."createdAt" AS claim_created_at
  FROM ordered_candidates oc
  INNER JOIN "DurableJob" d ON d.id = oc.id
  WHERE d.state IN ('PENDING', 'RETRY_WAIT')
  ORDER BY oc.shop_slot ASC, oc."nextEligibleAt" ASC, oc."createdAt" ASC, oc.id ASC
  FOR UPDATE OF d SKIP LOCKED
)
SELECT
  id, "shopId", "jobType", source, "queueName",
  "payloadSchemaVersion", "sanitizedPayload", "payloadDigest",
  "correlationId", "causationId", state,
  "executionStrategy", "activeDispatchSequence"
FROM locked
ORDER BY shop_slot ASC, claim_next_eligible_at ASC, claim_created_at ASC, id ASC
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
  algorithm: "dispatch_ready_shop_next_dispatch_at_fair_skip_locked";
} {
  return {
    module: "app/sync/fair-claim-query.server.ts",
    selectBuilder: buildFairClaimLockedSelectSql,
    explainBuilder: buildFairClaimLockedExplainSql,
    algorithm: "dispatch_ready_shop_next_dispatch_at_fair_skip_locked",
  };
}

/** Absolute module path string expected in dispatcher import (source-boundary guard). */
export const FAIR_CLAIM_QUERY_MODULE_PATH = "./fair-claim-query.server";

/**
 * Independent source-boundary guard: dispatcher.server.ts must import and call
 * buildFairClaimLockedSelectSql, and must not embed a second claim SELECT body.
 * Reads the dispatcher source from disk — not a self-referential builder===builder check.
 */
export function assertDispatcherUsesProductionFairClaimSql(
  dispatcherSource?: string,
): void {
  const source =
    dispatcherSource ??
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "dispatcher.server.ts"),
      "utf8",
    );

  if (!source.includes(`from "${FAIR_CLAIM_QUERY_MODULE_PATH}"`)) {
    throw new Error(
      "dispatcher_missing_fair_claim_import: expected import from fair-claim-query.server",
    );
  }
  if (!/buildFairClaimLockedSelectSql\s*\(/.test(source)) {
    throw new Error(
      "dispatcher_missing_fair_claim_call: claimBatchFair must call buildFairClaimLockedSelectSql",
    );
  }
  // Detect a future inline raw claim that bypasses the production builder.
  if (
    /\$queryRaw[\s\S]{0,200}WITH\s+due_shops|\$queryRaw[\s\S]{0,200}WITH\s+shop_seed|\$queryRaw[\s\S]{0,400}FOR UPDATE[\s\S]{0,80}SKIP LOCKED/.test(
      source.replace(
        /buildFairClaimLockedSelectSql\s*\([^)]*\)/g,
        "buildFairClaimLockedSelectSql(/*ok*/)",
      ),
    )
  ) {
    const withoutBuilderCall = source.replace(
      /buildFairClaimLockedSelectSql\s*\(\s*\{[^}]*\}\s*\)/g,
      "BUILDER_CALL()",
    );
    if (
      /\$queryRaw(?:Unsafe)?(?:<[^>]+>)?\s*(?:`|\(\s*`)[\s\S]*?\bWITH\b[\s\S]*?\bFOR UPDATE\b[\s\S]*?\bSKIP LOCKED\b/.test(
        withoutBuilderCall,
      )
    ) {
      throw new Error(
        "dispatcher_inline_claim_sql: claim SQL must use buildFairClaimLockedSelectSql only",
      );
    }
  }
}
