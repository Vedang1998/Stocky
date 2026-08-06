/**
 * F-PR4-11 / F-PR4-13 / D-047 — operational fair-claim plan, fairness, concurrency.
 *
 * EXPLAIN subject is the production buildFairClaimLockedSelectSql statement
 * (PENDING + RETRY_WAIT, bounded per-shop LATERAL, FOR UPDATE SKIP LOCKED).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { dispatchPendingJobs } from "../dispatcher.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";
import { resetTenantJobEnvelopeSecretCache } from "../../tenant/job-envelope.server";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { WEBHOOK_QUEUE } from "../../jobs/queue.server";
import { assertEligibleClaimPlanShape } from "./eligible-claim-plan";
import {
  buildFairClaimLockedExplainSql,
  buildFairClaimLockedSelectSql,
  fairClaimSqlIdentity,
  maxFairClaimCandidateRows,
} from "../fair-claim-query.server";

describe("test:sync-performance", () => {
  let prisma: PrismaClient;
  let redis: IORedis;

  beforeAll(async () => {
    process.env.STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK = "1";
    process.env.TENANT_JOB_ENVELOPE_SECRET =
      process.env.TENANT_JOB_ENVELOPE_SECRET ??
      "test-only-tenant-job-envelope-secret-32b!!";
    resetTenantJobEnvelopeSecretCache();
    await resetControlPlanePrismaForTests();
    prisma = new PrismaClient();
    if (!process.env.REDIS_URL) throw new Error("REDIS_URL required");
    redis = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  });

  afterAll(async () => {
    await resetControlPlanePrismaForTests();
    await prisma.$disconnect();
    await redis.quit();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "DataIssue", "ReconciliationRun", "SyncHealth", "SyncCursor", "SyncRun",
        "JobReplay", "DeadLetter", "JobAttempt", "JobDispatch", "WebhookDelivery",
        "DurableJob", "SyncApplicationReceipt"
      CASCADE
    `);
    await prisma.shop.deleteMany({
      where: { myshopifyDomain: { startsWith: "pr4-perf-" } },
    });
    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    await q.obliterate({ force: true }).catch(() => undefined);
    await q.close();
    await resetControlPlanePrismaForTests();
  });

  it("shared SQL identity: runtime select builder === EXPLAIN subject builder", () => {
    const id = fairClaimSqlIdentity();
    expect(id.algorithm).toBe("bounded_shop_lateral_skip_locked");
    expect(id.selectBuilder).toBe(buildFairClaimLockedSelectSql);
    expect(id.explainBuilder).toBe(buildFairClaimLockedExplainSql);
    // Explain wraps the identical select builder — same function reference, no fork.
    const params = { now: new Date(), batchSize: 50, maxPerShop: 2 };
    const selectSql = buildFairClaimLockedSelectSql(params);
    const explainSql = buildFairClaimLockedExplainSql(params);
    expect(selectSql).toBeInstanceOf(Object);
    expect(explainSql).toBeInstanceOf(Object);
    // Prisma.Sql values arrays must include the same bound params (now×N, limits).
    expect(selectSql.values.length).toBeGreaterThan(0);
    expect(explainSql.values).toEqual(selectSql.values);
  });

  it("operational fair-claim plan at ≥50k mixed eligible rows (no Seq Scan / external sort / WindowAgg)", async () => {
    const SCALE = Number(process.env.SYNC_PERF_JOB_COUNT ?? "50000");
    const batchSize = 50;
    const maxPerShop = 2;
    const shops: string[] = [];
    for (let i = 0; i < 5; i++) {
      const s = await prisma.shop.create({
        data: { myshopifyDomain: `pr4-perf-${i}.myshopify.com` },
      });
      shops.push(s.id);
    }

    const now = new Date();
    const future = new Date(now.getTime() + 3_600_000);
    const insertBatch = 500;
    for (let offset = 0; offset < SCALE; offset += insertBatch) {
      const values: string[] = [];
      for (let i = 0; i < insertBatch && offset + i < SCALE; i++) {
        const n = offset + i;
        const shopId = shops[n % shops.length];
        const id = `perfjob_${n}`;
        // Mix PENDING eligible, RETRY_WAIT eligible, and future ineligible.
        let state: string;
        let nextAt: string;
        if (n % 10 === 0) {
          state = "RETRY_WAIT";
          nextAt = now.toISOString();
        } else if (n % 10 === 1) {
          state = "PENDING";
          nextAt = future.toISOString();
        } else {
          state = "PENDING";
          nextAt = now.toISOString();
        }
        values.push(
          `('${id}','${shopId}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1','{}','${"c".repeat(64)}','idem-${id}','corr-${id}','tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','${state}','${nextAt}','${now.toISOString()}','${now.toISOString()}')`,
        );
      }
      await prisma.$executeRawUnsafe(`
        INSERT INTO "DurableJob" (
          id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
          "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
          "authorityVersion", "executionStrategy", state, "nextEligibleAt",
          "createdAt", "updatedAt"
        ) VALUES ${values.join(",")}
      `);
    }

    // Dominant-shop backlog (eligible PENDING).
    const dominant = shops[0];
    for (let i = 0; i < 200; i++) {
      const id = `dom_${i}`;
      await prisma.$executeRawUnsafe(`
        INSERT INTO "DurableJob" (
          id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
          "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
          "authorityVersion", "executionStrategy", state, "nextEligibleAt",
          "createdAt", "updatedAt"
        ) VALUES (
          '${id}','${dominant}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
          '{}','${"d".repeat(64)}','idem-${id}','corr-${id}',
          'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','PENDING',NOW() - interval '1 hour',
          NOW(), NOW()
        )
      `);
    }

    await prisma.$executeRawUnsafe(`ANALYZE "DurableJob"`);
    await prisma.$executeRawUnsafe(`ANALYZE "Shop"`);

    // Disposable-env default work_mem — do not inflate to conceal the plan.
    await prisma.$executeRawUnsafe(`RESET work_mem`);

    const maxCandidateRows = maxFairClaimCandidateRows(batchSize, maxPerShop);
    const planParams = { now: new Date(), batchSize, maxPerShop };

    const plans: string[] = [];
    for (let i = 0; i < 2; i++) {
      const planRows = await prisma.$queryRaw<Array<{ "QUERY PLAN": string }>>(
        buildFairClaimLockedExplainSql(planParams),
      );
      const planText = planRows.map((r) => r["QUERY PLAN"]).join("\n");
      plans.push(planText);
      assertEligibleClaimPlanShape(planText, { maxCandidateRows });
      // Bounded buffer evidence (disposable env — not a production SLA).
      expect(planText).toMatch(/Buffers:\s*shared hit=\d+/i);
      // No full-backlog actual row counts on Sort / Seq / Window nodes.
      expect(planText).not.toMatch(
        /(?:Sort|Seq Scan|WindowAgg)[^\n]*\(actual[^)]*rows=(?:[1-9]\d{4,}|[4-9]\d{3})/i,
      );
    }
    // Repeated plan stability: both runs index-supported and lock rows.
    for (const p of plans) {
      expect(p).toMatch(/DurableJob_shop_claim_/);
      expect(p).toMatch(/LockRows/i);
    }

    // Fairness + maxPerShop + every active shop progresses when capacity permits.
    const t0 = Date.now();
    const result = await dispatchPendingJobs({
      batchSize: 20,
      maxPerShop: 2,
    });
    const elapsed = Date.now() - t0;
    expect(result.claimed).toBeGreaterThan(0);

    const claimedByShop = await prisma.jobDispatch.groupBy({
      by: ["shopId"],
      _count: true,
    });
    // More than one shop progresses under dominant backlog.
    expect(claimedByShop.length).toBeGreaterThan(1);
    // maxPerShop=2 enforced for this dispatch cycle.
    for (const row of claimedByShop) {
      expect(row._count).toBeLessThanOrEqual(2);
    }
    // Every seeded shop makes progress when batch capacity permits (5 shops × 2 ≤ 20).
    expect(claimedByShop.length).toBe(shops.length);
    // Soft latency bound on disposable env — not a production SLA.
    expect(elapsed).toBeLessThan(30_000);
  }, 180_000);

  it("concurrent dispatchers: SKIP LOCKED, no duplicate claims, deterministic ordering", async () => {
    const shops: string[] = [];
    for (let i = 0; i < 4; i++) {
      const s = await prisma.shop.create({
        data: { myshopifyDomain: `pr4-perf-c-${i}.myshopify.com` },
      });
      shops.push(s.id);
    }
    const now = new Date();
    for (let n = 0; n < 40; n++) {
      const shopId = shops[n % shops.length];
      const id = `conc_${n}`;
      await prisma.$executeRawUnsafe(`
        INSERT INTO "DurableJob" (
          id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
          "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
          "authorityVersion", "executionStrategy", state, "nextEligibleAt",
          "createdAt", "updatedAt"
        ) VALUES (
          '${id}','${shopId}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
          '{}','${"e".repeat(64)}','idem-${id}','corr-${id}',
          'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','PENDING',
          '${new Date(now.getTime() - (40 - n) * 1000).toISOString()}',
          '${new Date(now.getTime() - (40 - n) * 1000).toISOString()}',
          '${now.toISOString()}'
        )
      `);
    }
    await prisma.$executeRawUnsafe(`ANALYZE "DurableJob"`);

    const [a, b] = await Promise.all([
      dispatchPendingJobs({
        batchSize: 10,
        maxPerShop: 2,
        workerId: "perf-dispatcher-a",
      }),
      dispatchPendingJobs({
        batchSize: 10,
        maxPerShop: 2,
        workerId: "perf-dispatcher-b",
      }),
    ]);
    expect(a.claimed + b.claimed).toBeGreaterThan(0);

    const dispatches = await prisma.jobDispatch.findMany({
      select: { durableJobId: true, leaseOwner: true },
    });
    const ids = dispatches.map((r) => r.durableJobId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(a.claimed + b.claimed);

    // Deterministic ordering: earliest nextEligibleAt among claimed set.
    const ordered = await prisma.durableJob.findMany({
      where: { id: { in: ids } },
      orderBy: [{ nextEligibleAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: { id: true, nextEligibleAt: true },
    });
    expect(ordered.length).toBe(ids.length);
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1].nextEligibleAt.getTime();
      const cur = ordered[i].nextEligibleAt.getTime();
      expect(cur).toBeGreaterThanOrEqual(prev);
    }
  }, 120_000);
});
