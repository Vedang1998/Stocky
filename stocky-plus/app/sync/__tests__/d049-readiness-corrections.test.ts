/**
 * D-049 adversarial readiness / reconciliation / immutability / deadlock tests.
 * F-D048-01…06 acceptance evidence (Cursor) — findings remain open pending review.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient, type Prisma } from "@prisma/client";
import { Client } from "pg";
import {
  buildFairClaimLockedSelectSql,
  fairClaimStarvationBoundCycles,
} from "../fair-claim-query.server";
import { dispatchPendingJobs } from "../dispatcher.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";
import { resetTenantJobEnvelopeSecretCache } from "../../tenant/job-envelope.server";

type DriftRow = {
  missing_readiness: bigint;
  late_earliest_hint: bigint;
  due_work_hidden: bigint;
  stale_false_positive: bigint;
  enabled_mismatch: bigint;
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
          AND r."nextDispatchAt" > NOW() + interval '1 second') AS due_work_hidden,
      (SELECT COUNT(*)::bigint FROM "DispatchReadyShop" r
        WHERE NOT EXISTS (
          SELECT 1 FROM "DurableJob" j
          WHERE j."shopId" = r."shopId" AND j.state IN ('PENDING', 'RETRY_WAIT')
        )) AS stale_false_positive,
      (SELECT COUNT(*)::bigint FROM "DispatchReadyShop" r
        INNER JOIN "Shop" s ON s.id = r."shopId"
        WHERE r."processingEnabled" IS DISTINCT FROM s."processingEnabled") AS enabled_mismatch
  `;
  return rows[0]!;
}

describe("D-049 readiness concurrency / heal / immutability", () => {
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
      where: { myshopifyDomain: { startsWith: "pr4-d049-" } },
    });
  });

  async function createShop(suffix: string, enabled = true) {
    return prisma.shop.create({
      data: {
        myshopifyDomain: `pr4-d049-${suffix}.myshopify.com`,
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
    client?: Prisma.TransactionClient | PrismaClient,
  ) {
    const db = client ?? prisma;
    await db.$executeRawUnsafe(`
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

  it("drift/invariant query reports missing/late/stale/mismatch zeros on healthy state", async () => {
    const shop = await createShop("drift-ok");
    await insertJob(shop.id, "d049_drift_ok", "PENDING", new Date());
    const report = await driftReport(prisma);
    expect(Number(report.missing_readiness)).toBe(0);
    expect(Number(report.late_earliest_hint)).toBe(0);
    expect(Number(report.due_work_hidden)).toBe(0);
    expect(Number(report.stale_false_positive)).toBe(0);
    expect(Number(report.enabled_mismatch)).toBe(0);
  });

  it("≥500 concurrent same-shop races produce ZERO false-negative readiness", async () => {
    const TRIALS = Number(process.env.D049_CONCURRENCY_TRIALS ?? "500");
    let falseNegatives = 0;
    let lateHints = 0;

    for (let trial = 0; trial < TRIALS; trial++) {
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE "DurableJob", "DispatchReadyShop" CASCADE`,
      );
      await prisma.shop.deleteMany({
        where: { myshopifyDomain: { startsWith: "pr4-d049-race-" } },
      });
      const shop = await createShop(`race-${trial}`);
      const now = Date.now();
      const urgent = new Date(now - 60_000);
      const future = new Date(now + 3_600_000);
      const later = new Date(now - 1_000);
      const earlier = new Date(now - 120_000);

      // Rotate adversarial pair shapes (A–F).
      const shape = trial % 6;
      const ops: Array<() => Promise<void>> = [];
      if (shape === 0) {
        // A: urgent PENDING vs future RETRY_WAIT
        ops.push(() => insertJob(shop.id, `u_${trial}`, "PENDING", urgent));
        ops.push(() => insertJob(shop.id, `f_${trial}`, "RETRY_WAIT", future));
      } else if (shape === 1) {
        // B: earlier PENDING vs later PENDING
        ops.push(() => insertJob(shop.id, `e_${trial}`, "PENDING", earlier));
        ops.push(() => insertJob(shop.id, `l_${trial}`, "PENDING", later));
      } else if (shape === 2) {
        // C: new eligible insert vs terminalizing other job
        await insertJob(shop.id, `pre_${trial}`, "PENDING", later);
        ops.push(() => insertJob(shop.id, `new_${trial}`, "PENDING", urgent));
        ops.push(async () => {
          await prisma.$executeRawUnsafe(`
            UPDATE "DurableJob" SET state = 'CANCELLED', "cancelledAt" = NOW()
            WHERE id = 'pre_${trial}'
          `);
        });
      } else if (shape === 3) {
        // D: nextEligibleAt moving earlier during concurrent work
        await insertJob(shop.id, `move_${trial}`, "PENDING", later);
        ops.push(() => insertJob(shop.id, `arr_${trial}`, "PENDING", urgent));
        ops.push(async () => {
          await prisma.$executeRawUnsafe(`
            UPDATE "DurableJob"
            SET "nextEligibleAt" = '${earlier.toISOString()}'
            WHERE id = 'move_${trial}'
          `);
        });
      } else if (shape === 4) {
        // E: nextEligibleAt moving later during concurrent eligible arrival
        await insertJob(shop.id, `late_${trial}`, "PENDING", earlier);
        ops.push(() => insertJob(shop.id, `arr2_${trial}`, "PENDING", urgent));
        ops.push(async () => {
          await prisma.$executeRawUnsafe(`
            UPDATE "DurableJob"
            SET "nextEligibleAt" = '${future.toISOString()}'
            WHERE id = 'late_${trial}'
          `);
        });
      } else {
        // F: repeated same-shop intake concurrency
        for (let k = 0; k < 4; k++) {
          const t = new Date(now - (k + 1) * 10_000);
          ops.push(() =>
            insertJob(shop.id, `rep_${trial}_${k}`, "PENDING", t),
          );
        }
      }

      await Promise.all(ops.map((fn) => fn()));

      const actual = await prisma.$queryRaw<
        Array<{ actual: Date | null }>
      >`
        SELECT MIN("nextEligibleAt") AS actual
        FROM "DurableJob"
        WHERE "shopId" = ${shop.id}
          AND state IN ('PENDING', 'RETRY_WAIT')
      `;
      const ready = await prisma.dispatchReadyShop.findUnique({
        where: { shopId: shop.id },
      });
      const actualEarliest = actual[0]?.actual;
      if (actualEarliest != null) {
        if (ready == null) {
          falseNegatives += 1;
        } else if (ready.earliestEligibleAt.getTime() > actualEarliest.getTime()) {
          lateHints += 1;
          falseNegatives += 1;
        } else if (
          actualEarliest.getTime() <= Date.now() &&
          ready.nextDispatchAt.getTime() > Date.now() + 1_000
        ) {
          // Due work hidden behind a far-future schedule (not a 1ms fairness floor).
          falseNegatives += 1;
        }
      }
    }

    expect(falseNegatives).toBe(0);
    expect(lateHints).toBe(0);
    const finalDrift = await driftReport(prisma);
    expect(Number(finalDrift.missing_readiness)).toBe(0);
    expect(Number(finalDrift.late_earliest_hint)).toBe(0);
    expect(Number(finalDrift.due_work_hidden)).toBe(0);
  }, 600_000);

  it("self-heal: stale empty / future / early / blocking stale rows via production claim path", async () => {
    const now = new Date();
    const legitimate = await createShop("heal-legit");
    await insertJob(
      legitimate.id,
      "d049_heal_legit",
      "PENDING",
      new Date(now.getTime() - 5_000),
    );

    const staleEmpty = await createShop("heal-empty");
    await prisma.$executeRawUnsafe(`
      INSERT INTO "DispatchReadyShop" (
        "shopId", "earliestEligibleAt", "nextDispatchAt", "lastServedAt",
        "processingEnabled", "createdAt", "updatedAt"
      ) VALUES (
        '${staleEmpty.id}', NOW() - interval '1 hour', NOW() - interval '1 hour',
        NULL, true, NOW(), NOW()
      )
    `);

    const staleFuture = await createShop("heal-future");
    const futureAt = new Date(now.getTime() + 3_600_000);
    await insertJob(staleFuture.id, "d049_heal_future", "PENDING", futureAt);
    await prisma.$executeRawUnsafe(`
      UPDATE "DispatchReadyShop"
      SET "nextDispatchAt" = NOW() - interval '1 hour',
          "earliestEligibleAt" = NOW() - interval '1 hour'
      WHERE "shopId" = '${staleFuture.id}'
    `);

    const earlyHint = await createShop("heal-early");
    const realAt = new Date(now.getTime() - 1_000);
    await insertJob(earlyHint.id, "d049_heal_early", "PENDING", realAt);
    await prisma.$executeRawUnsafe(`
      UPDATE "DispatchReadyShop"
      SET "nextDispatchAt" = NOW() - interval '1 day',
          "earliestEligibleAt" = NOW() - interval '1 day'
      WHERE "shopId" = '${earlyHint.id}'
    `);

    // Multiple stale rows ahead of legitimate due shops.
    for (let i = 0; i < 5; i++) {
      const s = await createShop(`heal-stale-${i}`);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "DispatchReadyShop" (
          "shopId", "earliestEligibleAt", "nextDispatchAt", "lastServedAt",
          "processingEnabled", "createdAt", "updatedAt"
        ) VALUES (
          '${s.id}', NOW() - interval '${10 + i} hours', NOW() - interval '${10 + i} hours',
          NULL, true, NOW(), NOW()
        )
        ON CONFLICT ("shopId") DO UPDATE SET
          "nextDispatchAt" = EXCLUDED."nextDispatchAt",
          "earliestEligibleAt" = EXCLUDED."earliestEligibleAt"
      `);
    }

    // Production claim path (same SQL builder) — healing documented as same invocation.
    const claimed = await prisma.$queryRaw<Array<{ shopId: string }>>(
      buildFairClaimLockedSelectSql({
        now: new Date(),
        batchSize: 20,
        maxPerShop: 1,
      }),
    );

    // Empty stale removed in same invocation.
    expect(
      await prisma.dispatchReadyShop.findUnique({
        where: { shopId: staleEmpty.id },
      }),
    ).toBeNull();

    // Future-only work rescheduled to real future (not permanently consuming due slots).
    const futureReady = await prisma.dispatchReadyShop.findUnique({
      where: { shopId: staleFuture.id },
    });
    expect(futureReady).not.toBeNull();
    expect(futureReady!.nextDispatchAt.getTime()).toBe(futureAt.getTime());

    // Early hint reconciled toward ground truth / fairness floor for due work.
    const earlyReady = await prisma.dispatchReadyShop.findUnique({
      where: { shopId: earlyHint.id },
    });
    expect(earlyReady).not.toBeNull();
    expect(earlyReady!.earliestEligibleAt.getTime()).toBe(realAt.getTime());

    // Legitimate due shop not starved forever by stale ahead rows (refill/heal).
    // May be claimed in this invocation or remain due after stale heal.
    const legitReady = await prisma.dispatchReadyShop.findUnique({
      where: { shopId: legitimate.id },
    });
    const legitStillDue =
      legitReady != null &&
      legitReady.processingEnabled &&
      legitReady.nextDispatchAt.getTime() <= Date.now() + 5_000;
    const legitClaimed = claimed.some((r) => r.shopId === legitimate.id);
    expect(legitClaimed || legitStillDue || legitReady == null).toBe(true);

    // Second invocation must fill remaining capacity after stale heal.
    const claimed2 = await prisma.$queryRaw<Array<{ shopId: string }>>(
      buildFairClaimLockedSelectSql({
        now: new Date(),
        batchSize: 20,
        maxPerShop: 1,
      }),
    );
    const allClaimed = new Set([
      ...claimed.map((r) => r.shopId),
      ...claimed2.map((r) => r.shopId),
    ]);
    expect(
      allClaimed.has(legitimate.id) || allClaimed.has(earlyHint.id),
    ).toBe(true);
  }, 120_000);

  it("DurableJob.shopId UPDATE fails closed (F-D048-04)", async () => {
    const a = await createShop("immut-a");
    const b = await createShop("immut-b");
    await insertJob(a.id, "d049_immut", "PENDING", new Date());

    await expect(
      prisma.$executeRawUnsafe(`
        UPDATE "DurableJob" SET "shopId" = '${b.id}' WHERE id = 'd049_immut'
      `),
    ).rejects.toThrow(/shop_id_immutable|shopId cannot be changed/i);

    const job = await prisma.durableJob.findUnique({ where: { id: "d049_immut" } });
    expect(job?.shopId).toBe(a.id);
    expect(
      await prisma.dispatchReadyShop.findUnique({ where: { shopId: a.id } }),
    ).not.toBeNull();
    expect(
      await prisma.dispatchReadyShop.findUnique({ where: { shopId: b.id } }),
    ).toBeNull();

    // Same-value no-op via state-preserving update is allowed (shopId unchanged).
    await prisma.$executeRawUnsafe(`
      UPDATE "DurableJob" SET "updatedAt" = NOW() WHERE id = 'd049_immut'
    `);
  });

  it("multi-shop writer in one transaction fails closed (F-D048-05 B)", async () => {
    const s1 = await createShop("dead-1");
    const s2 = await createShop("dead-2");
    await expect(
      prisma.$transaction(async (tx) => {
        await insertJob(s1.id, "d049_ms_1", "PENDING", new Date(), tx);
        await insertJob(s2.id, "d049_ms_2", "PENDING", new Date(), tx);
      }),
    ).rejects.toThrow(/single_shop_dispatch_ready_tx/i);

    // Opposite order also fails.
    await expect(
      prisma.$transaction(async (tx) => {
        await insertJob(s2.id, "d049_ms_3", "PENDING", new Date(), tx);
        await insertJob(s1.id, "d049_ms_4", "PENDING", new Date(), tx);
      }),
    ).rejects.toThrow(/single_shop_dispatch_ready_tx/i);
  });

  it("admin bypass GUC allows intentional multi-shop maintenance", async () => {
    const s1 = await createShop("admin-1");
    const s2 = await createShop("admin-2");
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('stocky.allow_multi_shop_dispatch_ready', '1', true)`,
      );
      await insertJob(s1.id, "d049_admin_1", "PENDING", new Date(), tx);
      await insertJob(s2.id, "d049_admin_2", "PENDING", new Date(), tx);
    });
    expect(
      await prisma.dispatchReadyShop.findUnique({ where: { shopId: s1.id } }),
    ).not.toBeNull();
    expect(
      await prisma.dispatchReadyShop.findUnique({ where: { shopId: s2.id } }),
    ).not.toBeNull();
  });

  it("adversarial multi-writer deadlock class is gone or guarded", async () => {
    const shops = [];
    for (let i = 0; i < 6; i++) {
      shops.push(await createShop(`dl-${i}`));
    }
    const url =
      process.env.DATABASE_URL ??
      process.env.DATABASE_CONTROL_PLANE_URL;
    if (!url) throw new Error("DATABASE_URL required");

    let deadlocks = 0;
    let guarded = 0;
    let ok = 0;
    const writers = 4;
    const durationMs = 8_000;
    const started = Date.now();

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
              const jid = `dlw_${id}_${Date.now()}_${Math.random()}`;
              await client.query(
                `INSERT INTO "DurableJob" (
                  id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
                  "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
                  "authorityVersion", "executionStrategy", state, "nextEligibleAt",
                  "createdAt", "updatedAt"
                ) VALUES ($1,$2,'webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
                  '{}',$3,$4,$5,'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','PENDING',
                  NOW(), NOW(), NOW())`,
                [
                  jid,
                  shop.id,
                  "e".repeat(64),
                  `idem-${jid}`,
                  `corr-${jid}`,
                ],
              );
            }
            await client.query("COMMIT");
            ok += 1;
          } catch (e) {
            await client.query("ROLLBACK").catch(() => undefined);
            const msg = e instanceof Error ? e.message : String(e);
            if (/40P01|deadlock detected/i.test(msg)) deadlocks += 1;
            else if (/single_shop_dispatch_ready_tx/i.test(msg)) guarded += 1;
            else throw e;
          }
        }
      } finally {
        await client.end();
      }
    }

    await Promise.all(Array.from({ length: writers }, (_, i) => writer(i)));
    // Either structurally prevented (guarded > 0, deadlocks == 0) or zero deadlocks.
    expect(deadlocks).toBe(0);
    expect(guarded + ok).toBeGreaterThan(0);
  }, 60_000);

  it("equal-timestamp fairness still respects documented starvation bound", async () => {
    const batchSize = 10;
    const shopCount = 25;
    const bound = fairClaimStarvationBoundCycles(shopCount, batchSize);
    const stamp = new Date("2026-01-01T00:00:00.000Z");
    const shops: string[] = [];
    for (let i = 0; i < shopCount; i++) {
      const s = await createShop(`fair-eq-${i}`);
      shops.push(s.id);
      await insertJob(s.id, `fair_eq_${i}`, "PENDING", stamp);
    }
    await prisma.$executeRawUnsafe(`
      UPDATE "DispatchReadyShop"
      SET "nextDispatchAt" = '${stamp.toISOString()}',
          "earliestEligibleAt" = '${stamp.toISOString()}',
          "lastServedAt" = NULL
    `);

    const firstProgress = new Map<string, number>();
    for (let c = 0; c < bound + 2; c++) {
      const before = new Map(
        (
          await prisma.jobDispatch.groupBy({ by: ["shopId"], _count: true })
        ).map((r) => [r.shopId, r._count]),
      );
      await dispatchPendingJobs({
        batchSize,
        maxPerShop: 1,
        workerId: `d049-fair-eq-${c}`,
      });
      const after = await prisma.jobDispatch.groupBy({
        by: ["shopId"],
        _count: true,
      });
      for (const row of after) {
        const prev = before.get(row.shopId) ?? 0;
        if (row._count > prev && !firstProgress.has(row.shopId)) {
          firstProgress.set(row.shopId, c);
        }
      }
    }
    for (const shopId of shops) {
      expect(firstProgress.has(shopId)).toBe(true);
      expect(firstProgress.get(shopId)!).toBeLessThanOrEqual(bound);
    }
  }, 180_000);
});
