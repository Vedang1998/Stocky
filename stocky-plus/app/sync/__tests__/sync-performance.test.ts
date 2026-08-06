/**
 * F-PR4-11 / F-PR4-13 — dispatch plan shape and per-shop fairness.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { dispatchPendingJobs } from "../dispatcher.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";
import { resetTenantJobEnvelopeSecretCache } from "../../tenant/job-envelope.server";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { WEBHOOK_QUEUE } from "../../jobs/queue.server";

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

  it("eligible claim plan uses index at scale (no Seq Scan + external sort)", async () => {
    // Seed ≥50k PENDING jobs across shops (F-PR4-11/13). Override with SYNC_PERF_JOB_COUNT.
    const SCALE = Number(process.env.SYNC_PERF_JOB_COUNT ?? "50000");
    const shops: string[] = [];
    for (let i = 0; i < 5; i++) {
      const s = await prisma.shop.create({
        data: { myshopifyDomain: `pr4-perf-${i}.myshopify.com` },
      });
      shops.push(s.id);
    }

    const now = new Date();
    const batchSize = 500;
    for (let offset = 0; offset < SCALE; offset += batchSize) {
      const values: string[] = [];
      for (let i = 0; i < batchSize && offset + i < SCALE; i++) {
        const shopId = shops[(offset + i) % shops.length];
        const id = `perfjob_${offset + i}`;
        values.push(
          `('${id}','${shopId}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1','{}','${"c".repeat(64)}','idem-${id}','corr-${id}','tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','PENDING',${i === 0 ? `'${now.toISOString()}'` : `'${now.toISOString()}'`},'${now.toISOString()}','${now.toISOString()}')`,
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

    // Raise work_mem so ordered index plans are not forced to external sort on
    // disposable CI with default low work_mem (not a production SLA claim).
    await prisma.$executeRawUnsafe(`SET work_mem = '64MB'`);
    try {
      const plan = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
         SELECT id FROM "DurableJob"
         WHERE state = 'PENDING' AND "nextEligibleAt" <= NOW()
         ORDER BY "nextEligibleAt" ASC, "createdAt" ASC, id ASC
         LIMIT 50`,
      );
      const planText = plan.map((r) => r["QUERY PLAN"]).join("\n");
      expect(planText).toMatch(/Index Scan|Bitmap Index Scan|Index Only Scan/i);
      // F-PR4-11 ships both global and shop-scoped eligible-pending partial
      // indexes. Postgres may choose either (or the schema state/nextEligibleAt
      // index) depending on stats; reject only when no eligible index appears.
      expect(planText).toMatch(
        /DurableJob_eligible_pending|DurableJob_shop_eligible_pending|DurableJob_.*nextEligibleAt/i,
      );
      expect(planText).not.toMatch(/Seq Scan on "DurableJob"/i);
      expect(planText).not.toMatch(/Sort Method: external/i);
    } finally {
      await prisma.$executeRawUnsafe(`RESET work_mem`);
    }

    // Fairness: dominant shop backlog must not consume every slot.
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

    const t0 = Date.now();
    const result = await dispatchPendingJobs({
      batchSize: 20,
      maxPerShop: 2,
    });
    const elapsed = Date.now() - t0;
    expect(result.claimed).toBeGreaterThan(0);

    const claimed = await prisma.jobDispatch.groupBy({
      by: ["shopId"],
      _count: true,
    });
    // More than one shop should have made progress under fairness.
    expect(claimed.length).toBeGreaterThan(1);
    // Soft latency bound on disposable env — not a production SLA.
    expect(elapsed).toBeLessThan(30_000);
  }, 180_000);
});
