/**
 * Production-owned fair-claim SQL builders (D-048 / D-049 / D-050 /
 * F-PR4-11 / F-PR4-13 / F-CLAUDE-D049-01…06).
 *
 * D-050 splits the former single claim+reconcile statement into:
 *   A. Scheduler lock — due DispatchReadyShop FOR UPDATE SKIP LOCKED LIMIT shopCap
 *   B. Job-candidate lock — PENDING/RETRY_WAIT FOR UPDATE SKIP LOCKED for those shops
 *   C. Lease CAS (dispatcher) — DISPATCH_LEASED
 *   D. Fresh-snapshot readiness reconciliation — ONLY place that deletes /
 *      reschedules / advances readiness non-monotonically
 *
 * A/B/C/D run in one READ COMMITTED transaction. D is a later statement so it
 * obtains a fresh statement snapshot while readiness row locks from A are held.
 *
 * Boundedness (per scheduler/candidate invocation / refill round):
 * - Scheduler rows RETURNED/LOCKED ≤ shopCap.
 * - Under SKIP LOCKED contention, physical index walk may examine
 *   lockedPrefix + shopCap (truthful bound; F-CLAUDE-D049-04).
 * - Candidate DurableJob rows ≤ shopCap × maxPerShop.
 *
 * Healthy-state starvation bound (F-PR4-13):
 *   ceil(activeEligibleShops / shopCap)
 * Degraded stale-contaminated bound (F-CLAUDE-D049-06):
 *   ceil(staleDueRows / repairCapacity) + ceil(activeEligibleShops / shopCap)
 *   where repairCapacity = FAIR_CLAIM_MAX_REFILL_ROUNDS × shopCap
 *
 * Approved urgent-arrival anti-reset maximum delay: 1 second
 * (URGENT_ARRIVAL_ANTI_RESET_MAX_DELAY_MS). Fairness floor after service: +1ms.
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

export type FairClaimSchedulerShop = {
  shopId: string;
  nextDispatchAt: Date;
  earliestEligibleAt: Date;
  ordinal: number;
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

/** Strict fairness floor after a service opportunity (ms past cutoff). */
export const FAIRNESS_FLOOR_OFFSET_MS = 1;

/**
 * Approved maximum delay (ms) that the urgent-arrival anti-reset policy may
 * leave a due arrival behind a future nextDispatchAt before pulling it earlier.
 * Documented D-050 scheduling tradeoff (F-CLAUDE-D049-05).
 */
export const URGENT_ARRIVAL_ANTI_RESET_MAX_DELAY_MS = 1_000;

/** Default bounded expired-lease recovery batch size (D-050). */
export const DEFAULT_EXPIRED_LEASE_RECOVERY_LIMIT = 100;

/** Max shops locked across all refill rounds of one dispatch invocation. */
export function maxFairClaimShopsLockedPerInvocation(
  batchSize: number,
): number {
  return shopCapForFairClaim(batchSize) * FAIR_CLAIM_MAX_REFILL_ROUNDS;
}

/**
 * Healthy-state starvation bound: cycles until every continuously eligible shop
 * has had a service opportunity under nextDispatchAt rotation (F-PR4-13).
 * Does NOT apply to a queue contaminated with stale false-positive readiness.
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
 * Degraded-state repair + service bound when stale due readiness precedes real
 * work (F-CLAUDE-D049-06). Repair capacity per invocation = R × shopCap.
 */
export function fairClaimDegradedStaleRepairBoundCycles(
  staleDueRows: number,
  activeEligibleShops: number,
  batchSize: number,
  refillRounds: number = FAIR_CLAIM_MAX_REFILL_ROUNDS,
): number {
  if (!Number.isInteger(staleDueRows) || staleDueRows < 0) {
    throw new Error("fair_claim_stale_rows_invalid");
  }
  if (!Number.isInteger(refillRounds) || refillRounds < 1) {
    throw new Error("fair_claim_refill_rounds_invalid");
  }
  const shopCap = shopCapForFairClaim(batchSize);
  const repairCapacity = refillRounds * shopCap;
  const repairCycles =
    staleDueRows === 0 ? 0 : Math.ceil(staleDueRows / repairCapacity);
  return (
    repairCycles +
    fairClaimStarvationBoundCycles(activeEligibleShops, batchSize)
  );
}

/**
 * Truthful SKIP LOCKED contention bound: physical index tuples visited may be
 * lockedPrefix + shopCap; rows returned/locked remain ≤ shopCap.
 */
export function fairClaimLockedPrefixExaminedBound(
  lockedPrefix: number,
  shopCap: number,
): number {
  if (!Number.isInteger(lockedPrefix) || lockedPrefix < 0) {
    throw new Error("fair_claim_locked_prefix_invalid");
  }
  if (!Number.isInteger(shopCap) || shopCap < 1) {
    throw new Error("fair_claim_shop_cap_invalid");
  }
  return lockedPrefix + shopCap;
}

/**
 * A. Production scheduler statement — locks due readiness only.
 * Does NOT delete, reschedule, recompute earliest, or heal.
 */
export function buildFairClaimSchedulerLockSql(params: {
  now: Date;
  shopCap: number;
}): Prisma.Sql {
  const { now, shopCap } = params;
  if (!Number.isInteger(shopCap) || shopCap < 1) {
    throw new Error("fair_claim_shop_cap_invalid");
  }
  // FOR UPDATE cannot appear in the same SELECT level as window functions
  // (PostgreSQL 0A000). Lock in a MATERIALIZED CTE, then assign ordinals.
  return Prisma.sql`
WITH due AS MATERIALIZED (
  SELECT
    r."shopId",
    r."nextDispatchAt",
    r."earliestEligibleAt"
  FROM "DispatchReadyShop" r
  WHERE r."processingEnabled" = true
    AND r."nextDispatchAt" <= ${now}
  ORDER BY r."nextDispatchAt" ASC, r."shopId" ASC
  FOR UPDATE OF r SKIP LOCKED
  LIMIT ${shopCap}
)
SELECT
  d."shopId",
  d."nextDispatchAt",
  d."earliestEligibleAt",
  ROW_NUMBER() OVER (
    ORDER BY d."nextDispatchAt" ASC, d."shopId" ASC
  )::int AS ordinal
FROM due d
ORDER BY d."nextDispatchAt" ASC, d."shopId" ASC
`;
}

/**
 * B. Production job-candidate statement — locks DurableJob for already-locked
 * ordered shops. No shop re-discovery. Parameterized VALUES ordinal relation.
 */
export function buildFairClaimJobCandidateSql(params: {
  now: Date;
  batchSize: number;
  maxPerShop: number;
  shops: Array<{ shopId: string; ordinal: number }>;
}): Prisma.Sql {
  const { now, batchSize, maxPerShop, shops } = params;
  if (shops.length === 0) {
    // Empty VALUES is invalid SQL — return a no-row sentinel.
    return Prisma.sql`
SELECT
  NULL::text AS id,
  NULL::text AS "shopId",
  NULL::text AS "jobType",
  NULL::text AS source,
  NULL::text AS "queueName",
  NULL::text AS "payloadSchemaVersion",
  NULL::jsonb AS "sanitizedPayload",
  NULL::text AS "payloadDigest",
  NULL::text AS "correlationId",
  NULL::text AS "causationId",
  NULL::"DurableJobState" AS state,
  NULL::text AS "executionStrategy",
  NULL::int AS "activeDispatchSequence"
WHERE false
`;
  }

  const shopValues = Prisma.join(
    shops.map((s) => Prisma.sql`(${s.shopId}::text, ${s.ordinal}::int)`),
  );

  return Prisma.sql`
WITH locked_shops(shop_id, shop_ord) AS (
  VALUES ${shopValues}
),
candidates AS (
  SELECT
    x.id,
    x."nextEligibleAt",
    x."createdAt",
    x.webhook_priority,
    ls.shop_ord,
    x.shop_slot
  FROM locked_shops ls
  CROSS JOIN LATERAL (
    SELECT
      id,
      "nextEligibleAt",
      "createdAt",
      webhook_priority,
      ROW_NUMBER() OVER (
        ORDER BY webhook_priority ASC, "nextEligibleAt" ASC, "createdAt" ASC, id ASC
      ) AS shop_slot
    FROM (
      (
        SELECT id, "nextEligibleAt", "createdAt",
          CASE
            WHEN "jobType" LIKE 'webhook:%'
              AND "jobType" <> 'webhook:bulk_operations/finish'
            THEN 0 ELSE 1
          END AS webhook_priority
        FROM "DurableJob"
        WHERE "shopId" >= ls.shop_id AND "shopId" <= ls.shop_id
          AND state = 'PENDING'
          AND "nextEligibleAt" <= ${now}
        ORDER BY "shopId" ASC, webhook_priority ASC, "nextEligibleAt" ASC, "createdAt" ASC, id ASC
        LIMIT ${maxPerShop}
      )
      UNION ALL
      (
        SELECT id, "nextEligibleAt", "createdAt",
          CASE
            WHEN "jobType" LIKE 'webhook:%'
              AND "jobType" <> 'webhook:bulk_operations/finish'
            THEN 0 ELSE 1
          END AS webhook_priority
        FROM "DurableJob"
        WHERE "shopId" >= ls.shop_id AND "shopId" <= ls.shop_id
          AND state = 'RETRY_WAIT'
          AND "nextEligibleAt" <= ${now}
        ORDER BY "shopId" ASC, webhook_priority ASC, "nextEligibleAt" ASC, "createdAt" ASC, id ASC
        LIMIT ${maxPerShop}
      )
    ) merged
    ORDER BY webhook_priority ASC, "nextEligibleAt" ASC, "createdAt" ASC, id ASC
    LIMIT ${maxPerShop}
  ) x
),
ordered_candidates AS (
  SELECT id, "nextEligibleAt", "createdAt", webhook_priority, shop_ord, shop_slot
  FROM candidates
  ORDER BY shop_slot ASC, shop_ord ASC, "nextEligibleAt" ASC, "createdAt" ASC, id ASC
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
    oc.shop_ord,
    oc."nextEligibleAt" AS claim_next_eligible_at,
    oc."createdAt" AS claim_created_at
  FROM ordered_candidates oc
  INNER JOIN "DurableJob" d ON d.id = oc.id
  WHERE d.state IN ('PENDING', 'RETRY_WAIT')
  ORDER BY oc.shop_slot ASC, oc.shop_ord ASC, oc."nextEligibleAt" ASC, oc."createdAt" ASC, oc.id ASC
  FOR UPDATE OF d SKIP LOCKED
)
SELECT
  id, "shopId", "jobType", source, "queueName",
  "payloadSchemaVersion", "sanitizedPayload", "payloadDigest",
  "correlationId", "causationId", state,
  "executionStrategy", "activeDispatchSequence"
FROM locked
ORDER BY shop_slot ASC, shop_ord ASC, claim_next_eligible_at ASC, claim_created_at ASC, id ASC
`;
}

/**
 * D. Fresh-snapshot readiness reconciliation for already-locked shops.
 * ONLY place that performs non-monotonic readiness correction (delete /
 * future reschedule / fairness advance). Must run as a later statement in the
 * same READ COMMITTED transaction after scheduler/claim so it sees a fresh
 * snapshot of DurableJob truth.
 */
export function buildFairClaimReadinessReconcileSql(params: {
  now: Date;
  shopIds: string[];
}): Prisma.Sql {
  const { now, shopIds } = params;
  const fairnessFloor = new Date(now.getTime() + FAIRNESS_FLOOR_OFFSET_MS);

  if (shopIds.length === 0) {
    return Prisma.sql`SELECT NULL::text AS "shopId", NULL::text AS action WHERE false`;
  }

  const shopValues = Prisma.join(
    shopIds.map((id) => Prisma.sql`(${id}::text)`),
  );

  return Prisma.sql`
WITH locked_shops(shop_id) AS (
  VALUES ${shopValues}
),
truth AS (
  SELECT
    ls.shop_id AS "shopId",
    LEAST(
      (
        SELECT j."nextEligibleAt"
        FROM "DurableJob" j
        WHERE j."shopId" >= ls.shop_id AND j."shopId" <= ls.shop_id
          AND j.state = 'PENDING'
        ORDER BY j."shopId" ASC, j."nextEligibleAt" ASC, j."createdAt" ASC, j.id ASC
        LIMIT 1
      ),
      (
        SELECT j."nextEligibleAt"
        FROM "DurableJob" j
        WHERE j."shopId" >= ls.shop_id AND j."shopId" <= ls.shop_id
          AND j.state = 'RETRY_WAIT'
        ORDER BY j."shopId" ASC, j."nextEligibleAt" ASC, j."createdAt" ASC, j.id ASC
        LIMIT 1
      )
    ) AS actual_earliest
  FROM locked_shops ls
),
heal_empty AS (
  DELETE FROM "DispatchReadyShop" r
  WHERE r."shopId" IN (
    SELECT t."shopId" FROM truth t WHERE t.actual_earliest IS NULL
  )
  RETURNING r."shopId", 'deleted'::text AS action
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
  RETURNING r."shopId", 'rescheduled_future'::text AS action
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
  RETURNING r."shopId", 'served'::text AS action
)
SELECT "shopId", action FROM heal_empty
UNION ALL
SELECT "shopId", action FROM reschedule_future
UNION ALL
SELECT "shopId", action FROM served
`;
}

/**
 * Bounded expired-lease recovery select+update (D-050 / F-CLAUDE-D049-02).
 * Deterministic ORDER BY + FOR UPDATE SKIP LOCKED + LIMIT so concurrent
 * dispatchers recover without duplicates and no single merchant blocks the
 * platform. Statement-level readiness maintenance processes all affected shops.
 */
export function buildExpiredDispatchLeaseRecoverySql(params: {
  now: Date;
  limit: number;
}): Prisma.Sql {
  const { now, limit } = params;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("expired_lease_recovery_limit_invalid");
  }
  return Prisma.sql`
WITH expired AS (
  SELECT d.id
  FROM "DurableJob" d
  WHERE d.state = 'DISPATCH_LEASED'
    AND d."leaseExpiresAt" IS NOT NULL
    AND d."leaseExpiresAt" < ${now}
  ORDER BY d."leaseExpiresAt" ASC, d.id ASC
  FOR UPDATE OF d SKIP LOCKED
  LIMIT ${limit}
)
UPDATE "DurableJob" j
SET
  state = 'PENDING',
  "leaseOwner" = NULL,
  "leaseExpiresAt" = NULL,
  "updatedAt" = ${now}
FROM expired e
WHERE j.id = e.id
RETURNING j.id, j."shopId"
`;
}

/** EXPLAIN wrapper for the scheduler lock statement. */
export function buildFairClaimSchedulerExplainSql(params: {
  now: Date;
  shopCap: number;
}): Prisma.Sql {
  return Prisma.sql`
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
${buildFairClaimSchedulerLockSql(params)}
`;
}

/** EXPLAIN wrapper for the job-candidate statement. */
export function buildFairClaimJobCandidateExplainSql(params: {
  now: Date;
  batchSize: number;
  maxPerShop: number;
  shops: Array<{ shopId: string; ordinal: number }>;
}): Prisma.Sql {
  return Prisma.sql`
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
${buildFairClaimJobCandidateSql(params)}
`;
}

/**
 * @deprecated D-050 split — prefer scheduler + candidate builders.
 * Compatibility alias used by older plan harness call sites that still expect
 * a single EXPLAIN subject covering readiness lock + job candidates.
 * Intentionally excludes reconciliation (separate fresh-snapshot statement).
 */
export function buildFairClaimLockedSelectSql(
  params: FairClaimQueryParams,
): Prisma.Sql {
  const shopCap = shopCapForFairClaim(params.batchSize);
  const { now, batchSize, maxPerShop } = params;
  return Prisma.sql`
WITH due_shops AS MATERIALIZED (
  SELECT
    r."shopId",
    r."nextDispatchAt"
  FROM "DispatchReadyShop" r
  WHERE r."processingEnabled" = true
    AND r."nextDispatchAt" <= ${now}
  ORDER BY r."nextDispatchAt" ASC, r."shopId" ASC
  FOR UPDATE OF r SKIP LOCKED
  LIMIT ${shopCap}
),
due_shops_ord AS (
  SELECT
    "shopId",
    ROW_NUMBER() OVER (
      ORDER BY "nextDispatchAt" ASC, "shopId" ASC
    )::int AS ordinal
  FROM due_shops
),
candidates AS (
  SELECT
    x.id,
    x."nextEligibleAt",
    x."createdAt",
    ds.ordinal AS shop_ord,
    x.shop_slot
  FROM due_shops_ord ds
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
        WHERE "shopId" >= ds."shopId" AND "shopId" <= ds."shopId"
          AND state = 'PENDING'
          AND "nextEligibleAt" <= ${now}
        ORDER BY "shopId" ASC, "nextEligibleAt" ASC, "createdAt" ASC, id ASC
        LIMIT ${maxPerShop}
      )
      UNION ALL
      (
        SELECT id, "nextEligibleAt", "createdAt"
        FROM "DurableJob"
        WHERE "shopId" >= ds."shopId" AND "shopId" <= ds."shopId"
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
  SELECT id, "nextEligibleAt", "createdAt", shop_ord, shop_slot
  FROM candidates
  ORDER BY shop_slot ASC, shop_ord ASC, "nextEligibleAt" ASC, "createdAt" ASC, id ASC
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
    oc.shop_ord,
    oc."nextEligibleAt" AS claim_next_eligible_at,
    oc."createdAt" AS claim_created_at
  FROM ordered_candidates oc
  INNER JOIN "DurableJob" d ON d.id = oc.id
  WHERE d.state IN ('PENDING', 'RETRY_WAIT')
  ORDER BY oc.shop_slot ASC, oc.shop_ord ASC, oc."nextEligibleAt" ASC, oc."createdAt" ASC, oc.id ASC
  FOR UPDATE OF d SKIP LOCKED
)
SELECT
  id, "shopId", "jobType", source, "queueName",
  "payloadSchemaVersion", "sanitizedPayload", "payloadDigest",
  "correlationId", "causationId", state,
  "executionStrategy", "activeDispatchSequence"
FROM locked
ORDER BY shop_slot ASC, shop_ord ASC, claim_next_eligible_at ASC, claim_created_at ASC, id ASC
`;
}

/** EXPLAIN wrapper over the compatibility claim SELECT (no reconcile). */
export function buildFairClaimLockedExplainSql(
  params: FairClaimQueryParams,
): Prisma.Sql {
  return Prisma.sql`
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
${buildFairClaimLockedSelectSql(params)}
`;
}

export function fairClaimSqlIdentity(): {
  module: string;
  selectBuilder: typeof buildFairClaimLockedSelectSql;
  explainBuilder: typeof buildFairClaimLockedExplainSql;
  schedulerBuilder: typeof buildFairClaimSchedulerLockSql;
  candidateBuilder: typeof buildFairClaimJobCandidateSql;
  reconcileBuilder: typeof buildFairClaimReadinessReconcileSql;
  algorithm: "dispatch_ready_shop_split_claim_fresh_reconcile_d050";
} {
  return {
    module: "app/sync/fair-claim-query.server.ts",
    selectBuilder: buildFairClaimLockedSelectSql,
    explainBuilder: buildFairClaimLockedExplainSql,
    schedulerBuilder: buildFairClaimSchedulerLockSql,
    candidateBuilder: buildFairClaimJobCandidateSql,
    reconcileBuilder: buildFairClaimReadinessReconcileSql,
    algorithm: "dispatch_ready_shop_split_claim_fresh_reconcile_d050",
  };
}

/**
 * One fair-claim lock + fresh-snapshot reconcile round (no lease).
 * Used by lifecycle/heal tests and mirrors dispatcher steps A/B/D.
 */
export async function executeFairClaimLockAndReconcileRound<
  TClient extends {
    $queryRaw: <T = unknown>(query: Prisma.Sql) => Promise<T>;
  },
>(
  tx: TClient,
  params: FairClaimQueryParams,
): Promise<
  Array<{
    id: string;
    shopId: string;
    jobType: string;
    source: string;
    queueName: string;
    payloadSchemaVersion: string;
    sanitizedPayload: Prisma.JsonValue;
    payloadDigest: string;
    correlationId: string;
    causationId: string | null;
    state: string;
    executionStrategy: string;
    activeDispatchSequence: number | null;
  }>
> {
  const shopCap = shopCapForFairClaim(params.batchSize);
  const lockedShops = await tx.$queryRaw<FairClaimSchedulerShop[]>(
    buildFairClaimSchedulerLockSql({ now: params.now, shopCap }),
  );
  if (lockedShops.length === 0) return [];

  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      shopId: string;
      jobType: string;
      source: string;
      queueName: string;
      payloadSchemaVersion: string;
      sanitizedPayload: Prisma.JsonValue;
      payloadDigest: string;
      correlationId: string;
      causationId: string | null;
      state: string;
      executionStrategy: string;
      activeDispatchSequence: number | null;
    }>
  >(
    buildFairClaimJobCandidateSql({
      now: params.now,
      batchSize: params.batchSize,
      maxPerShop: params.maxPerShop,
      shops: lockedShops.map((s) => ({
        shopId: s.shopId,
        ordinal: Number(s.ordinal),
      })),
    }),
  );

  await tx.$queryRaw(
    buildFairClaimReadinessReconcileSql({
      now: params.now,
      shopIds: lockedShops.map((s) => s.shopId),
    }),
  );

  return rows;
}

export const FAIR_CLAIM_QUERY_MODULE_PATH = "./fair-claim-query.server";

/**
 * Independent source-boundary guard: dispatcher must import and call the D-050
 * split builders (scheduler + candidate + reconcile), not embed inline claim SQL.
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
  if (!/buildFairClaimSchedulerLockSql\s*\(/.test(source)) {
    throw new Error(
      "dispatcher_missing_scheduler_call: claimBatchFair must call buildFairClaimSchedulerLockSql",
    );
  }
  if (!/buildFairClaimJobCandidateSql\s*\(/.test(source)) {
    throw new Error(
      "dispatcher_missing_candidate_call: claimBatchFair must call buildFairClaimJobCandidateSql",
    );
  }
  if (!/buildFairClaimReadinessReconcileSql\s*\(/.test(source)) {
    throw new Error(
      "dispatcher_missing_reconcile_call: claimBatchFair must call buildFairClaimReadinessReconcileSql",
    );
  }
  const withoutBuilderCalls = source
    .replace(
      /buildFairClaimSchedulerLockSql\s*\(\s*\{[^}]*\}\s*\)/g,
      "BUILDER()",
    )
    .replace(
      /buildFairClaimJobCandidateSql\s*\(\s*\{[\s\S]*?\}\s*\)/g,
      "BUILDER()",
    )
    .replace(
      /buildFairClaimReadinessReconcileSql\s*\(\s*\{[^}]*\}\s*\)/g,
      "BUILDER()",
    )
    .replace(
      /buildExpiredDispatchLeaseRecoverySql\s*\(\s*\{[^}]*\}\s*\)/g,
      "BUILDER()",
    )
    .replace(
      /buildFairClaimLockedSelectSql\s*\(\s*\{[^}]*\}\s*\)/g,
      "BUILDER()",
    );
  if (
    /\$queryRaw(?:Unsafe)?(?:<[^>]+>)?\s*(?:`|\(\s*`)[\s\S]*?\bWITH\b[\s\S]*?\bFOR UPDATE\b[\s\S]*?\bSKIP LOCKED\b/.test(
      withoutBuilderCalls,
    )
  ) {
    throw new Error(
      "dispatcher_inline_claim_sql: claim SQL must use production fair-claim builders only",
    );
  }
}
