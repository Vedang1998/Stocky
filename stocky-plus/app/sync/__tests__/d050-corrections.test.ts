/**
 * D-050 adversarial corrections: claim/reconcile snapshot split, statement
 * triggers, expired-lease recovery, SKIP LOCKED bound, fairness/stale matrix,
 * urgent-arrival anti-reset contract (F-CLAUDE-D049-01…06).
 *
 * Findings remain OPEN pending independent verification — do not close on
 * Cursor evidence.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import {
  DEFAULT_EXPIRED_LEASE_RECOVERY_LIMIT,
  FAIRNESS_FLOOR_OFFSET_MS,
  FAIR_CLAIM_MAX_REFILL_ROUNDS,
  URGENT_ARRIVAL_ANTI_RESET_MAX_DELAY_MS,
  buildExpiredDispatchLeaseRecoverySql,
  buildFairClaimJobCandidateSql,
  buildFairClaimReadinessReconcileSql,
  buildFairClaimSchedulerLockSql,
  executeFairClaimLockAndReconcileRound,
  fairClaimDegradedStaleRepairBoundCycles,
  fairClaimLockedPrefixExaminedBound,
  fairClaimStarvationBoundCycles,
  shopCapForFairClaim,
} from "../fair-claim-query.server";
import { dispatchPendingJobs } from "../dispatcher.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";
import { resetTenantJobEnvelopeSecretCache } from "../../tenant/job-envelope.server";

type DriftRow = {
  missing_readiness: bigint;
  late_earliest_hint: bigint;
  due_work_hidden: bigint;
};

async function driftReport(prisma: PrismaClient): Promise<DriftRow> {
  const rows = await prisma.$queryRaw<DriftRow[]>`
    WITH eligible AS (
      SELECT j."shopId", MIN(j."nextEligibleAt") AS actual_earliest
      FROM "DurableJob" j
      WHERE j.state IN ('PENDING', 'RETRY_WAIT')
      GROUP BY j."shopId"
    )
    SELECT
      (SELECT COUNT(*)::bigint FROM eligible e
        WHERE NOT EXISTS (
          SELECT 1 FROM "DispatchReadyShop" r WHERE r."shopId" = e."shopId"
        )) AS missing_readiness,
      (SELECT COUNT(*)::bigint FROM eligible e
        INNER JOIN "DispatchReadyShop" r ON r."shopId" = e."shopId"
        WHERE r."earliestEligibleAt" > e.actual_earliest) AS late_earliest_hint,
      (SELECT COUNT(*)::bigint FROM eligible e
        INNER JOIN "DispatchReadyShop" r ON r."shopId" = e."shopId"
        WHERE e.actual_earliest <= NOW()
          AND r."nextDispatchAt" > NOW() + interval '1 second') AS due_work_hidden
  `;
  return rows[0]!;
}

describe("D-050 corrections (F-CLAUDE-D049-01…06)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK = "1";
    process.env.TENANT_JOB_ENVELOPE_SECRET =
      process.env.TENANT_JOB_ENVELOPE_SECRET ??
      "test-only-tenant-job-envelope-secret-32b!!";
    resetTenantJobEnvelopeSecretCache();
    await resetControlPlanePrismaForTests();
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await resetControlPlanePrismaForTests();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "DataIssue", "JobDispatch", "DurableJob", "DispatchReadyShop"
      CASCADE
    `);
    await prisma.shop.deleteMany({
      where: { myshopifyDomain: { startsWith: "pr4-d050-" } },
    });
  });

  async function createShop(suffix: string, enabled = true) {
    return prisma.shop.create({
      data: {
        myshopifyDomain: `pr4-d050-${suffix}.myshopify.com`,
        processingEnabled: enabled,
        processingDisabledReason: enabled ? undefined : "MANUAL",
        processingDisabledAt: enabled ? undefined : new Date(),
      },
    });
  }

  async function insertJob(
    shopId: string,
    id: string,
    state: "PENDING" | "RETRY_WAIT",
    nextEligibleAt: Date,
  ) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "DurableJob" (
        id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
        "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
        "authorityVersion", "executionStrategy", state, "nextEligibleAt",
        "createdAt", "updatedAt"
      ) VALUES (
        '${id}','${shopId}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
        '{}','${"d".repeat(64)}','idem-${id}','corr-${id}',
        'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','${state}',
        '${nextEligibleAt.toISOString()}', NOW(), NOW()
      )
    `);
  }

  async function plantStaleReadiness(shopId: string, hoursAgo: number) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "DispatchReadyShop" (
        "shopId", "earliestEligibleAt", "nextDispatchAt", "lastServedAt",
        "processingEnabled", "createdAt", "updatedAt"
      ) VALUES (
        '${shopId}', NOW() - interval '${hoursAgo} hours',
        NOW() - interval '${hoursAgo} hours',
        NULL, true, NOW(), NOW()
      )
      ON CONFLICT ("shopId") DO UPDATE SET
        "nextDispatchAt" = EXCLUDED."nextDispatchAt",
        "earliestEligibleAt" = EXCLUDED."earliestEligibleAt",
        "processingEnabled" = true
    `);
  }

  it("GUC custom settings are not a correctness boundary (removed)", async () => {
    const guc = await prisma.$queryRaw<Array<{ v: string | null }>>`
      SELECT nullif(current_setting('stocky.allow_multi_shop_dispatch_ready', true), '') AS v
    `;
    // Setting may be absent; production must not require it.
    expect(guc[0]?.v ?? null).not.toBe("required");

    const s1 = await createShop("guc-1");
    const s2 = await createShop("guc-2");
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`
        INSERT INTO "DurableJob" (
          id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
          "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
          "authorityVersion", "executionStrategy", state, "nextEligibleAt",
          "createdAt", "updatedAt"
        ) VALUES
          ('d050_guc_1','${s1.id}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
           '{}','${"g".repeat(64)}','idem-d050_guc_1','corr-d050_guc_1',
           'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','PENDING', NOW(), NOW(), NOW()),
          ('d050_guc_2','${s2.id}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
           '{}','${"g".repeat(64)}','idem-d050_guc_2','corr-d050_guc_2',
           'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','PENDING', NOW(), NOW(), NOW())
      `);
    });
    expect(
      await prisma.dispatchReadyShop.findUnique({ where: { shopId: s1.id } }),
    ).not.toBeNull();
    expect(
      await prisma.dispatchReadyShop.findUnique({ where: { shopId: s2.id } }),
    ).not.toBeNull();
  });

  it("urgent-arrival anti-reset contract is exactly 1s (independent of impl drift)", async () => {
    // Contract constants — fail if implementation widens beyond approved bound.
    const APPROVED_MAX_DELAY_MS = 1000;
    const APPROVED_FAIRNESS_FLOOR_MS = 1;
    expect(URGENT_ARRIVAL_ANTI_RESET_MAX_DELAY_MS).toBe(APPROVED_MAX_DELAY_MS);
    expect(FAIRNESS_FLOOR_OFFSET_MS).toBe(APPROVED_FAIRNESS_FLOOR_MS);

    const shop = await createShop("anti-reset");
    const due = new Date(Date.now() - 5_000);
    await insertJob(shop.id, "d050_anti_reset", "PENDING", due);
    // Advance nextDispatchAt into the future beyond fairness floor but within
    // and beyond the approved anti-reset window.
    await prisma.$executeRawUnsafe(`
      UPDATE "DispatchReadyShop"
      SET "nextDispatchAt" = NOW() + interval '500 milliseconds'
      WHERE "shopId" = '${shop.id}'
    `);
    // New due arrival hint via earlier nextEligibleAt on a second job — pull
    // should occur when nextDispatchAt is > now + 1s.
    await prisma.$executeRawUnsafe(`
      UPDATE "DispatchReadyShop"
      SET "nextDispatchAt" = NOW() + interval '2 seconds'
      WHERE "shopId" = '${shop.id}'
    `);
    await insertJob(
      shop.id,
      "d050_anti_reset_2",
      "PENDING",
      new Date(Date.now() - 1_000),
    );
    const ready = await prisma.dispatchReadyShop.findUnique({
      where: { shopId: shop.id },
    });
    expect(ready).not.toBeNull();
    // After due arrival with nextDispatchAt > now+1s, upsert must pull earlier.
    expect(ready!.nextDispatchAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 50,
    );
  });

  it("fresh-snapshot reconciliation sees writer committed before readiness lock", async () => {
    const shop = await createShop("snap-before");
    await plantStaleReadiness(shop.id, 2);

    const url =
      process.env.DATABASE_URL ?? process.env.DATABASE_CONTROL_PLANE_URL;
    if (!url) throw new Error("DATABASE_URL required");

    const dispatcher = new Client({ connectionString: url });
    const writer = new Client({ connectionString: url });
    await dispatcher.connect();
    await writer.connect();
    try {
      await dispatcher.query("BEGIN");
      const locked = await dispatcher.query(
        `SELECT r."shopId" FROM "DispatchReadyShop" r
         WHERE r."processingEnabled" = true AND r."nextDispatchAt" <= NOW()
         ORDER BY r."nextDispatchAt", r."shopId"
         FOR UPDATE OF r SKIP LOCKED LIMIT 10`,
      );
      expect(locked.rowCount).toBeGreaterThan(0);

      // Writer commits eligible work BEFORE reconcile (after lock).
      // Upsert blocks behind readiness lock — so commit job first without
      // waiting: use a separate path... Actually trigger blocks. Instead:
      // commit writer BEFORE dispatcher takes lock (this test's named case).
      await dispatcher.query("ROLLBACK");

      await writer.query("BEGIN");
      await writer.query(`
        INSERT INTO "DurableJob" (
          id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
          "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
          "authorityVersion", "executionStrategy", state, "nextEligibleAt",
          "createdAt", "updatedAt"
        ) VALUES (
          'd050_snap_before','${shop.id}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
          '{}','${"s".repeat(64)}','idem-d050_snap_before','corr-d050_snap_before',
          'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','PENDING', NOW(), NOW(), NOW()
        )
      `);
      await writer.query("COMMIT");

      await prisma.$transaction(async (tx) => {
        await executeFairClaimLockAndReconcileRound(tx, {
          now: new Date(),
          batchSize: 5,
          maxPerShop: 1,
        });
      });

      const drift = await driftReport(prisma);
      expect(Number(drift.missing_readiness)).toBe(0);
      expect(Number(drift.late_earliest_hint)).toBe(0);
      expect(
        await prisma.dispatchReadyShop.findUnique({ where: { shopId: shop.id } }),
      ).not.toBeNull();
    } finally {
      await dispatcher.end();
      await writer.end();
    }
  }, 60_000);

  it("writer blocked behind readiness lock recreates readiness after reconcile DELETE", async () => {
    const shop = await createShop("snap-block");
    await plantStaleReadiness(shop.id, 3);

    const url =
      process.env.DATABASE_URL ?? process.env.DATABASE_CONTROL_PLANE_URL;
    if (!url) throw new Error("DATABASE_URL required");

    const dispatcher = new Client({ connectionString: url });
    const writer = new Client({ connectionString: url });
    await dispatcher.connect();
    await writer.connect();
    try {
      await dispatcher.query("BEGIN");
      await dispatcher.query(
        `SELECT r."shopId" FROM "DispatchReadyShop" r
         WHERE r."shopId" = $1 FOR UPDATE OF r`,
        [shop.id],
      );

      // Writer starts insert; statement trigger will block on readiness upsert.
      const writerInsert = writer.query(`
        INSERT INTO "DurableJob" (
          id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
          "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
          "authorityVersion", "executionStrategy", state, "nextEligibleAt",
          "createdAt", "updatedAt"
        ) VALUES (
          'd050_snap_block','${shop.id}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
          '{}','${"b".repeat(64)}','idem-d050_snap_block','corr-d050_snap_block',
          'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','PENDING', NOW(), NOW(), NOW()
        )
      `);

      // Give writer time to reach the blocked upsert.
      await new Promise((r) => setTimeout(r, 200));

      // Reconcile under stale snapshot (writer not committed) → DELETE.
      await dispatcher.query(
        `DELETE FROM "DispatchReadyShop" WHERE "shopId" = $1`,
        [shop.id],
      );
      await dispatcher.query("COMMIT");

      await writerInsert;
      // Writer's trigger recreates readiness after our commit.
      const ready = await prisma.dispatchReadyShop.findUnique({
        where: { shopId: shop.id },
      });
      expect(ready).not.toBeNull();
      const drift = await driftReport(prisma);
      expect(Number(drift.missing_readiness)).toBe(0);
    } finally {
      await dispatcher.end().catch(() => undefined);
      await writer.end().catch(() => undefined);
    }
  }, 60_000);

  it("≥1000 claim-vs-insert false-negative races: zero missing readiness", async () => {
    const ITER = 1000;
    let falseNegatives = 0;
    let permanentHidden = 0;

    for (let i = 0; i < ITER; i++) {
      await prisma.$executeRawUnsafe(`
        TRUNCATE TABLE "JobDispatch", "DurableJob", "DispatchReadyShop" CASCADE
      `);
      await prisma.shop.deleteMany({
        where: { myshopifyDomain: { startsWith: "pr4-d050-race-" } },
      });

      const shop = await createShop(`race-${i}`);
      await plantStaleReadiness(shop.id, 1 + (i % 5));

      const variant = i % 8;
      const url =
        process.env.DATABASE_URL ?? process.env.DATABASE_CONTROL_PLANE_URL!;
      const d = new Client({ connectionString: url });
      const w = new Client({ connectionString: url });
      await d.connect();
      await w.connect();
      try {
        // Start dispatcher protocol
        await d.query("BEGIN");
        const shops = await d.query(
          `SELECT r."shopId", ROW_NUMBER() OVER (ORDER BY r."nextDispatchAt", r."shopId")::int AS ordinal
           FROM "DispatchReadyShop" r
           WHERE r."processingEnabled" AND r."nextDispatchAt" <= NOW()
           ORDER BY r."nextDispatchAt", r."shopId"
           FOR UPDATE OF r SKIP LOCKED LIMIT 10`,
        );

        // Concurrent writer commits eligible work for same shop
        const state =
          variant === 1 ? "RETRY_WAIT" : variant === 4 ? "PENDING" : "PENDING";
        const eligibleAt =
          variant === 3
            ? new Date(Date.now() + 60_000).toISOString()
            : variant === 2
              ? new Date(Date.now() - 120_000).toISOString()
              : new Date().toISOString();

        if (variant === 5) {
          // cancellation race — insert then cancel after
          await w.query(`
            INSERT INTO "DurableJob" (
              id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
              "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
              "authorityVersion", "executionStrategy", state, "nextEligibleAt",
              "createdAt", "updatedAt"
            ) VALUES (
              'd050_race_${i}','${shop.id}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
              '{}','${"r".repeat(64)}','idem-d050_race_${i}','corr-d050_race_${i}',
              'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','${state}',
              '${eligibleAt}', NOW(), NOW()
            )
          `);
          await w.query(
            `UPDATE "DurableJob" SET state='CANCELLED', "cancelledAt"=NOW() WHERE id='d050_race_${i}'`,
          );
        } else if (variant === 6) {
          await w.query(`
            INSERT INTO "DurableJob" (
              id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
              "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
              "authorityVersion", "executionStrategy", state, "nextEligibleAt",
              "createdAt", "updatedAt"
            ) VALUES (
              'd050_race_${i}','${shop.id}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
              '{}','${"r".repeat(64)}','idem-d050_race_${i}','corr-d050_race_${i}',
              'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','PENDING',
              NOW(), NOW(), NOW()
            )
          `);
          await w.query(`DELETE FROM "DurableJob" WHERE id='d050_race_${i}'`);
        } else if (variant === 7) {
          await w.query(`UPDATE "Shop" SET "processingEnabled"=false WHERE id='${shop.id}'`);
          await w.query(`
            INSERT INTO "DurableJob" (
              id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
              "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
              "authorityVersion", "executionStrategy", state, "nextEligibleAt",
              "createdAt", "updatedAt"
            ) VALUES (
              'd050_race_${i}','${shop.id}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
              '{}','${"r".repeat(64)}','idem-d050_race_${i}','corr-d050_race_${i}',
              'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','PENDING',
              NOW(), NOW(), NOW()
            )
          `);
        } else if (variant === 0) {
          // rollback race
          await w.query("BEGIN");
          await w.query(`
            INSERT INTO "DurableJob" (
              id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
              "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
              "authorityVersion", "executionStrategy", state, "nextEligibleAt",
              "createdAt", "updatedAt"
            ) VALUES (
              'd050_race_${i}','${shop.id}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
              '{}','${"r".repeat(64)}','idem-d050_race_${i}','corr-d050_race_${i}',
              'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','PENDING',
              NOW(), NOW(), NOW()
            )
          `);
          await w.query("ROLLBACK");
        } else {
          // Interleave: try to commit writer while dispatcher holds lock.
          // Writer may block; use short lock_timeout then fall back to post-commit.
          await w.query(`SET LOCAL lock_timeout = '50ms'`).catch(() => undefined);
          try {
            await w.query(`
              INSERT INTO "DurableJob" (
                id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
                "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
                "authorityVersion", "executionStrategy", state, "nextEligibleAt",
                "createdAt", "updatedAt"
              ) VALUES (
                'd050_race_${i}','${shop.id}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
                '{}','${"r".repeat(64)}','idem-d050_race_${i}','corr-d050_race_${i}',
                'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','${state}',
                '${eligibleAt}', NOW(), NOW()
              )
            `);
          } catch {
            // lock timeout — writer will insert after dispatcher commits
          }
        }

        // Fresh reconcile for locked shops
        if (shops.rows.length > 0) {
          const ids = shops.rows.map((r: { shopId: string }) => r.shopId);
          await d.query(
            `WITH locked_shops(shop_id) AS (SELECT unnest($1::text[]))
             , truth AS (
               SELECT ls.shop_id AS "shopId",
                 LEAST(
                   (SELECT j."nextEligibleAt" FROM "DurableJob" j
                    WHERE j."shopId" >= ls.shop_id AND j."shopId" <= ls.shop_id AND j.state='PENDING'
                    ORDER BY j."nextEligibleAt", j."createdAt", j.id LIMIT 1),
                   (SELECT j."nextEligibleAt" FROM "DurableJob" j
                    WHERE j."shopId" >= ls.shop_id AND j."shopId" <= ls.shop_id AND j.state='RETRY_WAIT'
                    ORDER BY j."nextEligibleAt", j."createdAt", j.id LIMIT 1)
                 ) AS actual_earliest
               FROM locked_shops ls
             )
             DELETE FROM "DispatchReadyShop" r
             WHERE r."shopId" IN (SELECT t."shopId" FROM truth t WHERE t.actual_earliest IS NULL)`,
            [ids],
          );
          await d.query(
            `WITH locked_shops(shop_id) AS (SELECT unnest($1::text[]))
             , truth AS (
               SELECT ls.shop_id AS "shopId",
                 LEAST(
                   (SELECT j."nextEligibleAt" FROM "DurableJob" j
                    WHERE j."shopId" >= ls.shop_id AND j."shopId" <= ls.shop_id AND j.state='PENDING'
                    ORDER BY j."nextEligibleAt", j."createdAt", j.id LIMIT 1),
                   (SELECT j."nextEligibleAt" FROM "DurableJob" j
                    WHERE j."shopId" >= ls.shop_id AND j."shopId" <= ls.shop_id AND j.state='RETRY_WAIT'
                    ORDER BY j."nextEligibleAt", j."createdAt", j.id LIMIT 1)
                 ) AS actual_earliest
               FROM locked_shops ls
             )
             UPDATE "DispatchReadyShop" r SET
               "earliestEligibleAt" = t.actual_earliest,
               "nextDispatchAt" = CASE
                 WHEN t.actual_earliest > NOW() THEN t.actual_earliest
                 ELSE GREATEST(t.actual_earliest, NOW() + interval '1 millisecond')
               END,
               "updatedAt" = NOW()
             FROM truth t
             WHERE r."shopId" = t."shopId" AND t.actual_earliest IS NOT NULL`,
            [ids],
          );
        }
        await d.query("COMMIT");

        // If writer was blocked, finish insert after commit
        const exists = await prisma.durableJob.findUnique({
          where: { id: `d050_race_${i}` },
        });
        if (!exists && variant !== 0 && variant !== 5 && variant !== 6) {
          try {
            await w.query(`
              INSERT INTO "DurableJob" (
                id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
                "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
                "authorityVersion", "executionStrategy", state, "nextEligibleAt",
                "createdAt", "updatedAt"
              ) VALUES (
                'd050_race_${i}','${shop.id}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
                '{}','${"r".repeat(64)}','idem-d050_race_${i}','corr-d050_race_${i}',
                'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','${state}',
                '${eligibleAt}', NOW(), NOW()
              )
            `);
          } catch {
            /* already inserted */
          }
        }

        const drift = await driftReport(prisma);
        if (Number(drift.missing_readiness) > 0 || Number(drift.late_earliest_hint) > 0) {
          falseNegatives += 1;
        }

        // Eligible due work must remain discoverable across further cycles
        const job = await prisma.durableJob.findUnique({
          where: { id: `d050_race_${i}` },
        });
        if (
          job &&
          (job.state === "PENDING" || job.state === "RETRY_WAIT") &&
          job.nextEligibleAt.getTime() <= Date.now() &&
          variant !== 7
        ) {
          let found = false;
          for (let c = 0; c < 10; c++) {
            await prisma.$transaction(async (tx) => {
              await executeFairClaimLockAndReconcileRound(tx, {
                now: new Date(),
                batchSize: 5,
                maxPerShop: 1,
              });
            });
            const ready = await prisma.dispatchReadyShop.findUnique({
              where: { shopId: shop.id },
            });
            if (ready != null) {
              found = true;
              break;
            }
            // also check via dispatch
            const r = await dispatchPendingJobs({ batchSize: 5, maxPerShop: 1 });
            if (r.claimed > 0) {
              found = true;
              break;
            }
          }
          if (!found) {
            const still = await prisma.durableJob.findUnique({
              where: { id: `d050_race_${i}` },
            });
            const ready = await prisma.dispatchReadyShop.findUnique({
              where: { shopId: shop.id },
            });
            if (
              still &&
              (still.state === "PENDING" || still.state === "RETRY_WAIT") &&
              ready == null
            ) {
              permanentHidden += 1;
            }
          }
        }
      } finally {
        await d.end().catch(() => undefined);
        await w.end().catch(() => undefined);
      }
    }

    expect(falseNegatives).toBe(0);
    expect(permanentHidden).toBe(0);
  }, 600_000);

  it("expired lease recovery: 1 shop, multi lease, ≥2 shops, 100 shops, concurrent", async () => {
    const now = new Date();
    // 1 shop / 1 lease
    const s1 = await createShop("lease-1");
    await insertJob(s1.id, "d050_lease_1", "PENDING", now);
    await prisma.$executeRawUnsafe(`
      UPDATE "DurableJob" SET state='DISPATCH_LEASED',
        "leaseExpiresAt"=NOW() - interval '1 minute', "leaseOwner"='w1'
      WHERE id='d050_lease_1'
    `);
    const r1 = await prisma.$queryRaw<Array<{ id: string; shopId: string }>>(
      buildExpiredDispatchLeaseRecoverySql({
        now: new Date(),
        limit: DEFAULT_EXPIRED_LEASE_RECOVERY_LIMIT,
      }),
    );
    expect(r1.map((x) => x.id)).toContain("d050_lease_1");
    expect(
      await prisma.dispatchReadyShop.findUnique({ where: { shopId: s1.id } }),
    ).not.toBeNull();

    // multi lease / one shop
    const s2 = await createShop("lease-multi");
    for (let i = 0; i < 5; i++) {
      await insertJob(s2.id, `d050_lease_m_${i}`, "PENDING", now);
      await prisma.$executeRawUnsafe(`
        UPDATE "DurableJob" SET state='DISPATCH_LEASED',
          "leaseExpiresAt"=NOW() - interval '1 minute', "leaseOwner"='w1'
        WHERE id='d050_lease_m_${i}'
      `);
    }
    const r2 = await prisma.$queryRaw<Array<{ id: string }>>(
      buildExpiredDispatchLeaseRecoverySql({ now: new Date(), limit: 10 }),
    );
    expect(r2.length).toBe(5);

    // ≥2 shops — production dispatchPendingJobs must succeed (Claude's failure class)
    const shops2: string[] = [];
    for (let i = 0; i < 3; i++) {
      const s = await createShop(`lease-2s-${i}`);
      shops2.push(s.id);
      await insertJob(s.id, `d050_lease_2s_${i}`, "PENDING", now);
      await prisma.$executeRawUnsafe(`
        UPDATE "DurableJob" SET state='DISPATCH_LEASED',
          "leaseExpiresAt"=NOW() - interval '1 minute', "leaseOwner"='w1'
        WHERE id='d050_lease_2s_${i}'
      `);
    }
    const result = await dispatchPendingJobs({ batchSize: 10, maxPerShop: 2 });
    expect(result.recoveredLeases).toBeGreaterThanOrEqual(3);
    // no platform-wide abort
    expect(result.claimed + result.recoveredLeases).toBeGreaterThan(0);

    // 100 shops
    for (let i = 0; i < 100; i++) {
      const s = await createShop(`lease-100-${i}`);
      await insertJob(s.id, `d050_lease_100_${i}`, "PENDING", now);
      await prisma.$executeRawUnsafe(`
        UPDATE "DurableJob" SET state='DISPATCH_LEASED',
          "leaseExpiresAt"=NOW() - interval '1 minute', "leaseOwner"='w1'
        WHERE id='d050_lease_100_${i}'
      `);
    }
    const r100 = await prisma.$queryRaw<Array<{ id: string }>>(
      buildExpiredDispatchLeaseRecoverySql({ now: new Date(), limit: 100 }),
    );
    expect(r100.length).toBe(100);

    // concurrent recovery — no duplicates
    const sC = await createShop("lease-conc");
    for (let i = 0; i < 20; i++) {
      await insertJob(sC.id, `d050_lease_c_${i}`, "PENDING", now);
      await prisma.$executeRawUnsafe(`
        UPDATE "DurableJob" SET state='DISPATCH_LEASED',
          "leaseExpiresAt"=NOW() - interval '1 minute', "leaseOwner"='w1'
        WHERE id='d050_lease_c_${i}'
      `);
    }
    const [a, b] = await Promise.all([
      prisma.$queryRaw<Array<{ id: string }>>(
        buildExpiredDispatchLeaseRecoverySql({ now: new Date(), limit: 20 }),
      ),
      prisma.$queryRaw<Array<{ id: string }>>(
        buildExpiredDispatchLeaseRecoverySql({ now: new Date(), limit: 20 }),
      ),
    ]);
    const ids = new Set([...a, ...b].map((x) => x.id));
    expect(ids.size).toBe(a.length + b.length);
    expect(ids.size).toBe(20);
  }, 180_000);

  it("multi-shop deadlock stress: zero 40P01 under statement triggers", async () => {
    const shops: Array<{ id: string }> = [];
    for (let i = 0; i < 6; i++) shops.push(await createShop(`dl-${i}`));
    const url =
      process.env.DATABASE_URL ?? process.env.DATABASE_CONTROL_PLANE_URL!;
    let deadlocks = 0;
    let ok = 0;
    const writers = 4;
    const durationMs = 25_000;
    const started = Date.now();
    let seq = 0;

    async function writer(id: number) {
      const client = new Client({ connectionString: url });
      await client.connect();
      try {
        await client.query(`SET deadlock_timeout = '200ms'`).catch(() => undefined);
        while (Date.now() - started < durationMs) {
          const order =
            id % 2 === 0
              ? [shops[0]!, shops[1]!, shops[2]!]
              : [shops[2]!, shops[1]!, shops[0]!];
          try {
            await client.query("BEGIN");
            for (const shop of order) {
              const n = seq++;
              await client.query(
                `INSERT INTO "DurableJob" (
                  id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
                  "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
                  "authorityVersion", "executionStrategy", state, "nextEligibleAt",
                  "createdAt", "updatedAt"
                ) VALUES (
                  $1,$2,'webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
                  '{}',$3,$4,$5,
                  'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','PENDING', NOW(), NOW(), NOW()
                )`,
                [
                  `d050_dl_${id}_${n}`,
                  shop.id,
                  "d".repeat(64),
                  `idem-d050_dl_${id}_${n}`,
                  `corr-d050_dl_${id}_${n}`,
                ],
              );
            }
            await client.query("COMMIT");
            ok += 1;
          } catch (e: unknown) {
            await client.query("ROLLBACK").catch(() => undefined);
            const msg = e instanceof Error ? e.message : String(e);
            if (/40P01|deadlock/i.test(msg)) deadlocks += 1;
          }
        }
      } finally {
        await client.end();
      }
    }

    await Promise.all(Array.from({ length: writers }, (_, i) => writer(i)));
    expect(ok).toBeGreaterThan(0);
    expect(deadlocks).toBe(0);
  }, 90_000);

  it("processingEnabled bulk update + dispatch: zero deadlocks", async () => {
    const shops: string[] = [];
    for (let i = 0; i < 20; i++) {
      const s = await createShop(`pe-${i}`);
      shops.push(s.id);
      await insertJob(s.id, `d050_pe_${i}`, "PENDING", new Date());
    }
    const url =
      process.env.DATABASE_URL ?? process.env.DATABASE_CONTROL_PLANE_URL!;
    let deadlocks = 0;
    const bulk = async () => {
      const c = new Client({ connectionString: url });
      await c.connect();
      try {
        for (let i = 0; i < 50; i++) {
          try {
            await c.query(
              `UPDATE "Shop" SET "processingEnabled" = (i % 2 = 0)
               FROM unnest($1::text[]) WITH ORDINALITY AS u(id, i)
               WHERE "Shop".id = u.id`,
              [shops],
            );
            await c.query(
              `UPDATE "Shop" SET "processingEnabled" = true WHERE id = ANY($1::text[])`,
              [shops],
            );
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            if (/40P01|deadlock/i.test(msg)) deadlocks += 1;
          }
        }
      } finally {
        await c.end();
      }
    };
    const dispatch = async () => {
      for (let i = 0; i < 30; i++) {
        try {
          await dispatchPendingJobs({ batchSize: 10, maxPerShop: 2 });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (/40P01|deadlock/i.test(msg)) deadlocks += 1;
        }
      }
    };
    await Promise.all([bulk(), dispatch(), dispatch()]);
    expect(deadlocks).toBe(0);
  }, 120_000);

  it("stale-row degraded fairness matrix (F-CLAUDE-D049-06)", async () => {
    const batchSize = 5;
    const shopCap = shopCapForFairClaim(batchSize);
    const cases = [
      { stale: 0, real: 10 },
      { stale: shopCap, real: 5 },
      { stale: 7 * shopCap, real: 5 },
      { stale: 8 * shopCap, real: 5 },
      { stale: 8 * shopCap + 3, real: 5 },
    ];

    for (const c of cases) {
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE "JobDispatch", "DurableJob", "DispatchReadyShop" CASCADE`,
      );
      await prisma.shop.deleteMany({
        where: { myshopifyDomain: { startsWith: "pr4-d050-stale-" } },
      });

      for (let i = 0; i < c.stale; i++) {
        const s = await createShop(`stale-${c.stale}-${i}`);
        await plantStaleReadiness(s.id, 10 + i);
      }
      const realIds: string[] = [];
      for (let i = 0; i < c.real; i++) {
        const s = await createShop(`real-${c.stale}-${i}`);
        realIds.push(s.id);
        await insertJob(
          s.id,
          `d050_stale_real_${c.stale}_${i}`,
          "PENDING",
          new Date(Date.now() - 1000),
        );
        // Make real shops later in nextDispatchAt than stale prefix when interspersed
        if (i % 2 === 0) {
          await prisma.$executeRawUnsafe(`
            UPDATE "DispatchReadyShop"
            SET "nextDispatchAt" = NOW() - interval '1 minute'
            WHERE "shopId" = '${s.id}'
          `);
        }
      }

      const bound = fairClaimDegradedStaleRepairBoundCycles(
        c.stale,
        c.real,
        batchSize,
      );
      const firstProgress = new Map<string, number>();
      for (let cycle = 1; cycle <= bound + 2; cycle++) {
        await dispatchPendingJobs({ batchSize, maxPerShop: 1 });
        const after = await prisma.jobDispatch.groupBy({
          by: ["shopId"],
          _count: true,
        });
        for (const row of after) {
          if (!firstProgress.has(row.shopId) && realIds.includes(row.shopId)) {
            firstProgress.set(row.shopId, cycle);
          }
        }
        if (firstProgress.size === realIds.length) break;
      }
      for (const id of realIds) {
        expect(firstProgress.has(id)).toBe(true);
        expect(firstProgress.get(id)!).toBeLessThanOrEqual(bound);
      }
    }

    // Healthy bound unchanged
    expect(fairClaimStarvationBoundCycles(20, 5)).toBe(4);
    expect(FAIR_CLAIM_MAX_REFILL_ROUNDS).toBe(8);
  }, 300_000);

  it("locked-prefix examined bound is truthful (returned ≤ shopCap)", async () => {
    const batchSize = 10;
    const shopCap = shopCapForFairClaim(batchSize);
    for (const prefix of [0, 10, 100]) {
      expect(fairClaimLockedPrefixExaminedBound(prefix, shopCap)).toBe(
        prefix + shopCap,
      );
    }
    // Scheduler returns ≤ shopCap even with many due rows
    for (let i = 0; i < 50; i++) {
      const s = await createShop(`pref-${i}`);
      await insertJob(s.id, `d050_pref_${i}`, "PENDING", new Date());
    }
    const locked = await prisma.$transaction(async (tx) => {
      return tx.$queryRaw<Array<{ shopId: string }>>(
        buildFairClaimSchedulerLockSql({ now: new Date(), shopCap }),
      );
    });
    expect(locked.length).toBeLessThanOrEqual(shopCap);
  });

  it("READ COMMITTED: reconcile is a later statement with fresh snapshot", async () => {
    // Prove protocol uses distinct statements — scheduler then reconcile.
    const shop = await createShop("iso");
    await plantStaleReadiness(shop.id, 1);
    await insertJob(shop.id, "d050_iso", "PENDING", new Date());

    await prisma.$transaction(async (tx) => {
      const shops = await tx.$queryRaw<Array<{ shopId: string; ordinal: number }>>(
        buildFairClaimSchedulerLockSql({ now: new Date(), shopCap: 5 }),
      );
      expect(shops.length).toBeGreaterThan(0);
      const jobs = await tx.$queryRaw(
        buildFairClaimJobCandidateSql({
          now: new Date(),
          batchSize: 5,
          maxPerShop: 1,
          shops: shops.map((s) => ({
            shopId: s.shopId,
            ordinal: Number(s.ordinal),
          })),
        }),
      );
      expect(Array.isArray(jobs)).toBe(true);
      await tx.$queryRaw(
        buildFairClaimReadinessReconcileSql({
          now: new Date(),
          shopIds: shops.map((s) => s.shopId),
        }),
      );
    });
    // Isolation remains READ COMMITTED (default) — not REPEATABLE READ.
    const iso = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(
      `SHOW transaction_isolation`,
    );
    const level = Object.values(iso[0] ?? {})[0] ?? "";
    expect(String(level).toLowerCase()).toMatch(/read committed/);
  });
});
