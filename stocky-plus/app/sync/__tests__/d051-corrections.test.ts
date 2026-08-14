/**
 * D-051 adversarial corrections: per-shop readiness advisory locks
 * (F-CLAUDE-D050-01), plus lock-order / convoy gates.
 *
 * Findings remain OPEN pending independent verification — do not close on
 * Cursor evidence.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import {
  DEFAULT_EXPIRED_LEASE_RECOVERY_LIMIT,
  buildExpiredDispatchLeaseRecoverySql,
} from "../fair-claim-query.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";
import { resetTenantJobEnvelopeSecretCache } from "../../tenant/job-envelope.server";

const DIGEST = "d".repeat(64);

function dbUrl(): string {
  const url =
    process.env.DATABASE_URL ?? process.env.DATABASE_CONTROL_PLANE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  return url;
}

async function connectClient(): Promise<Client> {
  const client = new Client({ connectionString: dbUrl() });
  await client.connect();
  await client.query(`SET deadlock_timeout = '250ms'`).catch(() => undefined);
  return client;
}

function insertPendingSql(
  id: string,
  shopId: string,
  state: "PENDING" | "RETRY_WAIT" | "ENQUEUED" | "DISPATCH_LEASED" = "PENDING",
): { text: string; values: unknown[] } {
  return {
    text: `
      INSERT INTO "DurableJob" (
        id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
        "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
        "authorityVersion", "executionStrategy", state, "nextEligibleAt",
        "createdAt", "updatedAt"
      ) VALUES (
        $1,$2,'webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
        '{}',$3,$4,$5,'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT',$6,
        NOW(), NOW(), NOW()
      )
    `,
    values: [id, shopId, DIGEST, `idem-${id}`, `corr-${id}`, state],
  };
}

async function waitForLockWait(
  observer: Client,
  pid: number,
  timeoutMs: number,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await observer.query<{ wait_event_type: string | null }>(
      `SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1`,
      [pid],
    );
    if (r.rows[0]?.wait_event_type === "Lock") return true;
    await new Promise((res) => setTimeout(res, 15));
  }
  return false;
}

async function backendPid(client: Client): Promise<number> {
  const r = await client.query<{ pid: number }>(`SELECT pg_backend_pid() AS pid`);
  return r.rows[0]!.pid;
}

async function activityState(
  observer: Client,
  pid: number,
): Promise<string | null> {
  const r = await observer.query<{ state: string | null }>(
    `SELECT state FROM pg_stat_activity WHERE pid = $1`,
    [pid],
  );
  return r.rows[0]?.state ?? null;
}

describe("D-051 corrections (F-CLAUDE-D050-01 lock scope)", () => {
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
      where: { myshopifyDomain: { startsWith: "pr4-d051-" } },
    });
  });

  async function createShop(suffix: string, enabled = true) {
    return prisma.shop.create({
      data: {
        myshopifyDomain: `pr4-d051-${suffix}.myshopify.com`,
        processingEnabled: enabled,
        processingDisabledReason: enabled ? undefined : "MANUAL",
        processingDisabledAt: enabled ? undefined : new Date(),
      },
    });
  }

  async function insertJob(
    shopId: string,
    id: string,
    state: "PENDING" | "RETRY_WAIT" | "ENQUEUED" | "DISPATCH_LEASED" = "PENDING",
  ) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "DurableJob" (
        id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
        "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
        "authorityVersion", "executionStrategy", state, "nextEligibleAt",
        "createdAt", "updatedAt"
      ) VALUES (
        '${id}','${shopId}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
        '{}','${DIGEST}','idem-${id}','corr-${id}',
        'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','${state}',
        NOW(), NOW(), NOW()
      )
    `);
  }

  it("PENDING intake for shop B finishes while shop A readiness tx is held", async () => {
    const shopA = await createShop("nb-pending-a");
    const shopB = await createShop("nb-pending-b");
    const t1 = await connectClient();
    const t2 = await connectClient();
    const observer = await connectClient();
    try {
      await t1.query("BEGIN");
      const pid1 = await backendPid(t1);
      await t1.query(insertPendingSql("d051_nb_p_a", shopA.id));
      const start = Date.now();
      await t2.query(insertPendingSql("d051_nb_p_b", shopB.id));
      const elapsed = Date.now() - start;
      expect(await activityState(observer, pid1)).toBe("idle in transaction");
      await t1.query("COMMIT");
      expect(elapsed).toBeLessThan(2_000);
      expect(
        await prisma.dispatchReadyShop.findUnique({ where: { shopId: shopB.id } }),
      ).not.toBeNull();
      expect(
        await prisma.dispatchReadyShop.findUnique({ where: { shopId: shopA.id } }),
      ).not.toBeNull();
    } finally {
      await t1.query("ROLLBACK").catch(() => undefined);
      await t1.end();
      await t2.end();
      await observer.end();
    }
  });

  it("RETRY_WAIT transition for shop B finishes while shop A readiness tx is held", async () => {
    const shopA = await createShop("nb-retry-a");
    const shopB = await createShop("nb-retry-b");
    await insertJob(shopB.id, "d051_nb_r_b_seed", "ENQUEUED");
    const t1 = await connectClient();
    const t2 = await connectClient();
    const observer = await connectClient();
    try {
      await t1.query("BEGIN");
      const pid1 = await backendPid(t1);
      await t1.query(insertPendingSql("d051_nb_r_a", shopA.id));
      const start = Date.now();
      await t2.query(`
        UPDATE "DurableJob"
        SET state = 'RETRY_WAIT', "nextEligibleAt" = NOW(), "updatedAt" = NOW()
        WHERE id = 'd051_nb_r_b_seed' AND state = 'ENQUEUED'
      `);
      const elapsed = Date.now() - start;
      expect(await activityState(observer, pid1)).toBe("idle in transaction");
      await t1.query("COMMIT");
      expect(elapsed).toBeLessThan(2_000);
      expect(
        await prisma.dispatchReadyShop.findUnique({ where: { shopId: shopB.id } }),
      ).not.toBeNull();
    } finally {
      await t1.query("ROLLBACK").catch(() => undefined);
      await t1.end();
      await t2.end();
      await observer.end();
    }
  });

  it("expired-lease recovery for shop A does not block unrelated shop B intake", async () => {
    const shopA = await createShop("nb-rec-a");
    const shopB = await createShop("nb-rec-b");
    const t1 = await connectClient();
    const t2 = await connectClient();
    const observer = await connectClient();
    try {
      await t1.query(insertPendingSql("d051_nb_rec_a", shopA.id));
      await t1.query(`
        UPDATE "DurableJob" SET state = 'DISPATCH_LEASED',
          "leaseOwner" = 'w1', "leaseExpiresAt" = NOW() - interval '1 minute'
        WHERE id = 'd051_nb_rec_a'
      `);
      await t1.query("BEGIN");
      const pid1 = await backendPid(t1);
      await t1.query(
        `
        WITH expired AS (
          SELECT d.id
          FROM "DurableJob" d
          WHERE d.state = 'DISPATCH_LEASED'
            AND d."leaseExpiresAt" IS NOT NULL
            AND d."leaseExpiresAt" < NOW()
          ORDER BY d."leaseExpiresAt" ASC, d.id ASC
          FOR UPDATE OF d SKIP LOCKED
          LIMIT 100
        )
        UPDATE "DurableJob" j
        SET state = 'PENDING', "leaseOwner" = NULL, "leaseExpiresAt" = NULL, "updatedAt" = NOW()
        FROM expired e
        WHERE j.id = e.id
        RETURNING j.id
        `,
      );
      const start = Date.now();
      await t2.query(insertPendingSql("d051_nb_rec_b", shopB.id));
      const elapsed = Date.now() - start;
      expect(await activityState(observer, pid1)).toBe("idle in transaction");
      await t1.query("COMMIT");
      expect(elapsed).toBeLessThan(2_000);
      expect(
        await prisma.dispatchReadyShop.findUnique({ where: { shopId: shopB.id } }),
      ).not.toBeNull();
    } finally {
      await t1.query("ROLLBACK").catch(() => undefined);
      await t1.end();
      await t2.end();
      await observer.end();
    }
  });

  it("processingEnabled maintenance for shop A does not block unrelated shop B intake", async () => {
    const shopA = await createShop("nb-pe-a");
    const shopB = await createShop("nb-pe-b");
    const t1 = await connectClient();
    const t2 = await connectClient();
    const observer = await connectClient();
    try {
      await t1.query("BEGIN");
      const pid1 = await backendPid(t1);
      await t1.query(
        `UPDATE "Shop" SET "processingEnabled" = false WHERE id = $1`,
        [shopA.id],
      );
      const start = Date.now();
      await t2.query(insertPendingSql("d051_nb_pe_b", shopB.id));
      const elapsed = Date.now() - start;
      expect(await activityState(observer, pid1)).toBe("idle in transaction");
      await t1.query("COMMIT");
      expect(elapsed).toBeLessThan(2_000);
      expect(
        await prisma.dispatchReadyShop.findUnique({ where: { shopId: shopB.id } }),
      ).not.toBeNull();
    } finally {
      await t1.query("ROLLBACK").catch(() => undefined);
      await t1.end();
      await t2.end();
      await observer.end();
    }
  });

  it("same-shop conflicting readiness write waits, then completes with correct readiness", async () => {
    const shopA = await createShop("ss-a");
    const t1 = await connectClient();
    const t2 = await connectClient();
    const observer = await connectClient();
    try {
      await t1.query("BEGIN");
      await t1.query(insertPendingSql("d051_ss_a1", shopA.id));
      const pid2 = (await t2.query<{ pid: number }>(`SELECT pg_backend_pid() AS pid`))
        .rows[0]!.pid;
      const t2Insert = t2.query(insertPendingSql("d051_ss_a2", shopA.id));
      const blocked = await waitForLockWait(observer, pid2, 2_000);
      expect(blocked).toBe(true);
      await t1.query("COMMIT");
      await t2Insert;
      const ready = await prisma.dispatchReadyShop.findUnique({
        where: { shopId: shopA.id },
      });
      expect(ready).not.toBeNull();
      const jobs = await prisma.durableJob.count({
        where: { shopId: shopA.id, state: "PENDING" },
      });
      expect(jobs).toBe(2);
    } finally {
      await t1.query("ROLLBACK").catch(() => undefined);
      await t1.end();
      await t2.end();
      await observer.end();
    }
  }, 30_000);

  it("global D-050 advisory key is not held during a per-shop readiness write", async () => {
    const shopA = await createShop("glob-a");
    const t1 = await connectClient();
    const t2 = await connectClient();
    try {
      await t1.query("BEGIN");
      await t1.query(insertPendingSql("d051_glob_a", shopA.id));
      const probe = await t2.query<{ ok: boolean }>(`
        SELECT pg_try_advisory_lock(
          hashtextextended('stocky_dispatch_ready_shop_maintain', 0)
        ) AS ok
      `);
      expect(probe.rows[0]?.ok).toBe(true);
      await t2.query(`
        SELECT pg_advisory_unlock(
          hashtextextended('stocky_dispatch_ready_shop_maintain', 0)
        )
      `);
      await t1.query("COMMIT");
    } finally {
      await t1.query("ROLLBACK").catch(() => undefined);
      await t1.end();
      await t2.end();
    }
  });

  it("single-statement multi-shop INSERT succeeds regardless of VALUES order", async () => {
    const s1 = await createShop("stmt-1");
    const s2 = await createShop("stmt-2");
    const [lo, hi] = [s1, s2].sort((a, b) => a.id.localeCompare(b.id));
    await prisma.$executeRawUnsafe(`
      INSERT INTO "DurableJob" (
        id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
        "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
        "authorityVersion", "executionStrategy", state, "nextEligibleAt",
        "createdAt", "updatedAt"
      ) VALUES
        ('d051_stmt_hi','${hi.id}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
         '{}','${DIGEST}','idem-d051_stmt_hi','corr-d051_stmt_hi',
         'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','PENDING', NOW(), NOW(), NOW()),
        ('d051_stmt_lo','${lo.id}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
         '{}','${DIGEST}','idem-d051_stmt_lo','corr-d051_stmt_lo',
         'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','PENDING', NOW(), NOW(), NOW())
    `);
    expect(
      await prisma.dispatchReadyShop.findUnique({ where: { shopId: lo.id } }),
    ).not.toBeNull();
    expect(
      await prisma.dispatchReadyShop.findUnique({ where: { shopId: hi.id } }),
    ).not.toBeNull();
  });

  it("opposite-order multi-statement txs: lock-order fail-closed, zero 40P01, readiness intact", async () => {
    const s1 = await createShop("oo-1");
    const s2 = await createShop("oo-2");
    const [lo, hi] = [s1, s2].sort((a, b) => (a.id < b.id ? -1 : 1));
    const t1 = await connectClient();
    const t2 = await connectClient();
    try {
      await t1.query("BEGIN");
      await t2.query("BEGIN");
      await t1.query(insertPendingSql("d051_oo_t1_hi", hi.id));
      await t2.query(insertPendingSql("d051_oo_t2_lo", lo.id));

      let t1Second: "order" | "deadlock" | "ok" | "other" = "other";
      try {
        await t1.query(insertPendingSql("d051_oo_t1_lo", lo.id));
        t1Second = "ok";
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/stocky_dispatch_ready_lock_order/.test(msg)) t1Second = "order";
        else if (/40P01|deadlock/i.test(msg)) t1Second = "deadlock";
        await t1.query("ROLLBACK").catch(() => undefined);
      }

      let t2Second: "order" | "deadlock" | "ok" | "other" = "other";
      try {
        await t2.query(insertPendingSql("d051_oo_t2_hi", hi.id));
        t2Second = "ok";
        await t2.query("COMMIT");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/stocky_dispatch_ready_lock_order/.test(msg)) t2Second = "order";
        else if (/40P01|deadlock/i.test(msg)) t2Second = "deadlock";
        await t2.query("ROLLBACK").catch(() => undefined);
      }

      if (t1Second === "ok") {
        await t1.query("COMMIT").catch(() => undefined);
      }

      expect(t1Second).not.toBe("deadlock");
      expect(t2Second).not.toBe("deadlock");
      expect([t1Second, t2Second].some((x) => x === "ok" || x === "order")).toBe(
        true,
      );
      // T1 inserted hi first then tried lo — must fail closed on lock order.
      expect(t1Second).toBe("order");
      // T2 inserted lo then hi (ascending) — must be allowed.
      expect(t2Second).toBe("ok");

      const readyLo = await prisma.dispatchReadyShop.findUnique({
        where: { shopId: lo.id },
      });
      const readyHi = await prisma.dispatchReadyShop.findUnique({
        where: { shopId: hi.id },
      });
      expect(readyLo).not.toBeNull();
      expect(readyHi).not.toBeNull();
    } finally {
      await t1.query("ROLLBACK").catch(() => undefined);
      await t2.query("ROLLBACK").catch(() => undefined);
      await t1.end();
      await t2.end();
    }
  }, 30_000);

  it("head-of-line: held 100-shop readiness tx does not stall an unrelated merchant for the hold duration", async () => {
    const holderShops: string[] = [];
    for (let i = 0; i < 100; i++) {
      const s = await createShop(`hol-${i.toString().padStart(3, "0")}`);
      holderShops.push(s.id);
    }
    const unrelated = await createShop("hol-unrelated");
    const t1 = await connectClient();
    const t2 = await connectClient();
    const observer = await connectClient();
    try {
      const values = holderShops
        .map(
          (id, i) =>
            `('d051_hol_${i}','${id}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
              '{}','${DIGEST}','idem-d051_hol_${i}','corr-d051_hol_${i}',
              'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','PENDING', NOW(), NOW(), NOW())`,
        )
        .join(",\n");
      await t1.query("BEGIN");
      const pid1 = await backendPid(t1);
      await t1.query(`
        INSERT INTO "DurableJob" (
          id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
          "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
          "authorityVersion", "executionStrategy", state, "nextEligibleAt",
          "createdAt", "updatedAt"
        ) VALUES ${values}
      `);
      const start = Date.now();
      await t2.query(insertPendingSql("d051_hol_unrel", unrelated.id));
      const elapsed = Date.now() - start;
      expect(await activityState(observer, pid1)).toBe("idle in transaction");
      // Keep the 100-shop transaction open after the unrelated write completes
      // so a convoy would still be holding. Then release.
      await new Promise((r) => setTimeout(r, 1_000));
      expect(await activityState(observer, pid1)).toBe("idle in transaction");
      await t1.query("COMMIT");
      // Secondary bound only — primary proof is completion while T1 remained open.
      expect(elapsed).toBeLessThan(2_000);
      expect(
        await prisma.dispatchReadyShop.findUnique({
          where: { shopId: unrelated.id },
        }),
      ).not.toBeNull();
    } finally {
      await t1.query("ROLLBACK").catch(() => undefined);
      await t1.end();
      await t2.end();
      await observer.end();
    }
  }, 120_000);

  it("distinct-shop concurrency benchmark: no global convoy, zero deadlocks", async () => {
    const levels =
      process.env.D051_FULL_BENCH === "1"
        ? [1, 2, 4, 10, 25, 50, 100]
        : [1, 2, 4, 10];
    const burstMs = 750;
    const results: Array<{
      workload: string;
      concurrency: number;
      tps: number;
      p50: number;
      p95: number;
      p99: number;
      max: number;
      deadlocks: number;
      errors: number;
      advisoryWaitSamples: number;
      advisoryWaitMax: number;
      advisoryGrantedMax: number;
    }> = [];

    async function runLevel(
      workload: "control" | "intake" | "retry" | "recovery" | "mixed",
      concurrency: number,
    ) {
      const shops = await Promise.all(
        Array.from({ length: concurrency }, (_, i) =>
          createShop(`bench-${workload}-${concurrency}-${i}`),
        ),
      );
      const latencies: number[] = [];
      let deadlocks = 0;
      let errors = 0;
      let commits = 0;
      let advisoryWaitSamples = 0;
      let advisoryWaitMax = 0;
      let advisoryGrantedMax = 0;
      const sampler = await connectClient();
      const started = Date.now();
      const sampleTimer = setInterval(() => {
        void sampler
          .query<{ waiting: string; granted: string }>(
            `SELECT
               count(*) FILTER (WHERE NOT granted)::text AS waiting,
               count(*) FILTER (WHERE granted)::text AS granted
             FROM pg_locks
             WHERE locktype = 'advisory'`,
          )
          .then((r) => {
            const waiting = Number(r.rows[0]?.waiting ?? 0);
            const granted = Number(r.rows[0]?.granted ?? 0);
            advisoryWaitSamples += waiting > 0 ? 1 : 0;
            if (waiting > advisoryWaitMax) advisoryWaitMax = waiting;
            if (granted > advisoryGrantedMax) advisoryGrantedMax = granted;
          })
          .catch(() => undefined);
      }, 50);
      try {
      await Promise.all(
        shops.map(async (shop, i) => {
          const c = await connectClient();
          let n = 0;
          try {
            await c.query(`SET deadlock_timeout = '250ms'`).catch(() => undefined);
            while (Date.now() - started < burstMs) {
              const id = `d051_b_${workload}_${concurrency}_${i}_${n++}`;
              const t0 = performance.now();
              try {
                if (workload === "control") {
                  await c.query(insertPendingSql(id, shop.id, "ENQUEUED"));
                } else if (workload === "intake") {
                  await c.query(insertPendingSql(id, shop.id, "PENDING"));
                } else if (workload === "retry") {
                  const seed = `${id}_s`;
                  await c.query(insertPendingSql(seed, shop.id, "ENQUEUED"));
                  await c.query(
                    `UPDATE "DurableJob" SET state='RETRY_WAIT', "nextEligibleAt"=NOW(), "updatedAt"=NOW() WHERE id=$1`,
                    [seed],
                  );
                } else if (workload === "recovery") {
                  const seed = `${id}_r`;
                  await c.query(insertPendingSql(seed, shop.id, "PENDING"));
                  await c.query(
                    `UPDATE "DurableJob" SET state='DISPATCH_LEASED', "leaseOwner"='w', "leaseExpiresAt"=NOW() - interval '1 minute' WHERE id=$1`,
                    [seed],
                  );
                  await c.query(
                    `UPDATE "DurableJob" SET state='PENDING', "leaseOwner"=NULL, "leaseExpiresAt"=NULL, "updatedAt"=NOW() WHERE id=$1 AND state='DISPATCH_LEASED'`,
                    [seed],
                  );
                } else {
                  if (i % 3 === 0) {
                    await c.query(insertPendingSql(id, shop.id, "PENDING"));
                  } else if (i % 3 === 1) {
                    const seed = `${id}_s`;
                    await c.query(insertPendingSql(seed, shop.id, "ENQUEUED"));
                    await c.query(
                      `UPDATE "DurableJob" SET state='RETRY_WAIT', "nextEligibleAt"=NOW() WHERE id=$1`,
                      [seed],
                    );
                  } else {
                    await c.query(
                      `UPDATE "Shop" SET "processingEnabled" = "processingEnabled" WHERE id=$1`,
                      [shop.id],
                    );
                    await c.query(insertPendingSql(id, shop.id, "PENDING"));
                  }
                }
                latencies.push(performance.now() - t0);
                commits += 1;
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                if (/40P01|deadlock/i.test(msg)) deadlocks += 1;
                else errors += 1;
              }
            }
          } finally {
            await c.end();
          }
        }),
      );
      } finally {
      clearInterval(sampleTimer);
      await sampler.end();
      }
      latencies.sort((a, b) => a - b);
      const pct = (p: number) =>
        latencies.length === 0
          ? 0
          : latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))]!;
      const elapsedSec = Math.max((Date.now() - started) / 1000, 0.001);
      const round = (n: number) => Math.round(n * 100) / 100;
      results.push({
        workload,
        concurrency,
        tps: round(commits / elapsedSec),
        p50: round(pct(50)),
        p95: round(pct(95)),
        p99: round(pct(99)),
        max: round(latencies[latencies.length - 1] ?? 0),
        deadlocks,
        errors,
        advisoryWaitSamples,
        advisoryWaitMax,
        advisoryGrantedMax,
      });
    }

    for (const workload of ["control", "intake", "retry", "recovery", "mixed"] as const) {
      for (const n of levels) {
        await prisma.$executeRawUnsafe(
          `TRUNCATE TABLE "DataIssue", "JobDispatch", "DurableJob", "DispatchReadyShop" CASCADE`,
        );
        await prisma.shop.deleteMany({
          where: { myshopifyDomain: { startsWith: "pr4-d051-bench-" } },
        });
        await runLevel(workload, n);
      }
    }

    // eslint-disable-next-line no-console
    console.log("D-051_BENCHMARK " + JSON.stringify(results, null, 2));

    expect(results.every((r) => r.deadlocks === 0)).toBe(true);
    expect(results.every((r) => r.errors === 0)).toBe(true);
    const intake1 = results.find((r) => r.workload === "intake" && r.concurrency === 1);
    const intake10 = results.find(
      (r) => r.workload === "intake" && r.concurrency === 10,
    );
    expect(intake1).toBeTruthy();
    expect(intake10).toBeTruthy();
    // Qualitative non-convoy: 10 distinct-shop writers must not collapse to
    // single-file (D-050 intake declined past concurrency 2). Not a brittle ratio.
    expect(intake10!.tps).toBeGreaterThan(intake1!.tps);
  }, 300_000);

  it("expired-lease recovery matrix still recreates readiness (1/2/100 shops)", async () => {
    const now = new Date();
    const s1 = await createShop("lease-1");
    await insertJob(s1.id, "d051_lease_1");
    await prisma.$executeRawUnsafe(`
      UPDATE "DurableJob" SET state='DISPATCH_LEASED',
        "leaseExpiresAt"=NOW() - interval '1 minute', "leaseOwner"='w1'
      WHERE id='d051_lease_1'
    `);
    const r1 = await prisma.$queryRaw<Array<{ id: string }>>(
      buildExpiredDispatchLeaseRecoverySql({
        now,
        limit: DEFAULT_EXPIRED_LEASE_RECOVERY_LIMIT,
      }),
    );
    expect(r1.map((x) => x.id)).toContain("d051_lease_1");
    expect(
      await prisma.dispatchReadyShop.findUnique({ where: { shopId: s1.id } }),
    ).not.toBeNull();

    for (let i = 0; i < 2; i++) {
      const s = await createShop(`lease-2-${i}`);
      const id = `d051_lease_2_${i}`;
      await insertJob(s.id, id);
      await prisma.$executeRawUnsafe(`
        UPDATE "DurableJob" SET state='DISPATCH_LEASED',
          "leaseExpiresAt"=NOW() - interval '1 minute', "leaseOwner"='w1'
        WHERE id='${id}'
      `);
    }
    const r2 = await prisma.$queryRaw<Array<{ id: string }>>(
      buildExpiredDispatchLeaseRecoverySql({ now: new Date(), limit: 10 }),
    );
    expect(r2.length).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < 100; i++) {
      const s = await createShop(`lease-100-${i}`);
      const id = `d051_lease_100_${i}`;
      await insertJob(s.id, id);
      await prisma.$executeRawUnsafe(`
        UPDATE "DurableJob" SET state='DISPATCH_LEASED',
          "leaseExpiresAt"=NOW() - interval '1 minute', "leaseOwner"='w1'
        WHERE id='${id}'
      `);
    }
    const r100 = await prisma.$queryRaw<Array<{ id: string }>>(
      buildExpiredDispatchLeaseRecoverySql({ now: new Date(), limit: 100 }),
    );
    expect(r100.length).toBe(100);
  }, 180_000);
});
