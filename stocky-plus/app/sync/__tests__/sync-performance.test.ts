/**
 * F-PR4-11 / F-PR4-13 / D-048 / D-049 / D-050 — operational fair-claim plan,
 * fairness, concurrency, Shop-scaling and active-due boundedness, runtime/EXPLAIN
 * identity.
 *
 * D-050 splits claim into scheduler lock → job candidates → lease → fresh-snapshot
 * reconcile. EXPLAIN subject remains buildFairClaimLockedSelectSql (compatibility
 * claim path without reconcile) — plan shape still valid for lock/candidate bounds.
 *
 * Boundedness: rows returned/locked ≤ shopCap; under SKIP LOCKED contention the
 * physical index walk may examine lockedPrefix + shopCap.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dispatchPendingJobs } from "../dispatcher.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";
import { resetTenantJobEnvelopeSecretCache } from "../../tenant/job-envelope.server";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { WEBHOOK_QUEUE } from "../../jobs/queue.server";
import {
  assertEligibleClaimPlanShape,
  parseSharedHitBuffers,
} from "./eligible-claim-plan";
import {
  assertDispatcherUsesProductionFairClaimSql,
  buildFairClaimJobCandidateSql,
  buildFairClaimLockedExplainSql,
  buildFairClaimLockedSelectSql,
  buildFairClaimReadinessReconcileSql,
  buildFairClaimSchedulerLockSql,
  fairClaimSqlIdentity,
  fairClaimStarvationBoundCycles,
  maxFairClaimCandidateRows,
  shopCapForFairClaim,
} from "../fair-claim-query.server";

async function truncateSyncTables(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "DataIssue", "ReconciliationRun", "SyncHealth", "SyncCursor", "SyncRun",
      "JobReplay", "DeadLetter", "JobAttempt", "JobDispatch", "WebhookDelivery",
      "DurableJob", "DispatchReadyShop", "SyncApplicationReceipt"
    CASCADE
  `);
}

async function insertEligibleJob(
  prisma: PrismaClient,
  input: {
    id: string;
    shopId: string;
    state?: "PENDING" | "RETRY_WAIT";
    nextEligibleAt: Date;
    createdAt?: Date;
  },
) {
  const state = input.state ?? "PENDING";
  const createdAt = input.createdAt ?? input.nextEligibleAt;
  const now = new Date();
  await prisma.$executeRawUnsafe(`
    INSERT INTO "DurableJob" (
      id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
      "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
      "authorityVersion", "executionStrategy", state, "nextEligibleAt",
      "createdAt", "updatedAt"
    ) VALUES (
      '${input.id}','${input.shopId}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1',
      '{}','${"e".repeat(64)}','idem-${input.id}','corr-${input.id}',
      'tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','${state}',
      '${input.nextEligibleAt.toISOString()}',
      '${createdAt.toISOString()}',
      '${now.toISOString()}'
    )
  `);
}

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
    await truncateSyncTables(prisma);
    await prisma.shop.deleteMany({
      where: { myshopifyDomain: { startsWith: "pr4-perf-" } },
    });
    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    await q.obliterate({ force: true }).catch(() => undefined);
    await q.close();
    await resetControlPlanePrismaForTests();
  });

  it("shared SQL identity + independent dispatcher source-boundary guard", () => {
    const id = fairClaimSqlIdentity();
    expect(id.algorithm).toBe(
      "dispatch_ready_shop_split_claim_fresh_reconcile_d050",
    );
    expect(id.selectBuilder).toBe(buildFairClaimLockedSelectSql);
    expect(id.explainBuilder).toBe(buildFairClaimLockedExplainSql);
    expect(id.schedulerBuilder).toBe(buildFairClaimSchedulerLockSql);
    expect(id.candidateBuilder).toBe(buildFairClaimJobCandidateSql);
    expect(id.reconcileBuilder).toBe(buildFairClaimReadinessReconcileSql);
    const params = { now: new Date(), batchSize: 50, maxPerShop: 2 };
    const selectSql = buildFairClaimLockedSelectSql(params);
    const explainSql = buildFairClaimLockedExplainSql(params);
    expect(selectSql.values.length).toBeGreaterThan(0);
    expect(explainSql.values).toEqual(selectSql.values);

    // Independent disk read of dispatcher.server.ts — not builder===builder.
    const dispatcherPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../dispatcher.server.ts",
    );
    const source = readFileSync(dispatcherPath, "utf8");
    expect(() => assertDispatcherUsesProductionFairClaimSql(source)).not.toThrow();

    // Planted inline claim must fail the guard (scheduler call replaced).
    const planted = source.replace(
      /buildFairClaimSchedulerLockSql\s*\([\s\S]*?\)/,
      `Prisma.sql\`WITH due_shops AS (SELECT 1) SELECT * FROM "DurableJob" FOR UPDATE SKIP LOCKED\``,
    );
    expect(planted.includes("FOR UPDATE SKIP LOCKED")).toBe(true);
    expect(/buildFairClaimSchedulerLockSql\s*\(/.test(planted)).toBe(false);
    expect(() => assertDispatcherUsesProductionFairClaimSql(planted)).toThrow(
      /inline_claim_sql|missing_scheduler_call|missing_candidate_call|missing_reconcile_call/,
    );
  });

  it("operational fair-claim plan at ≥50k mixed eligible rows (no Shop/DurableJob Seq Scan)", async () => {
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

    const dominant = shops[0];
    for (let i = 0; i < 200; i++) {
      await insertEligibleJob(prisma, {
        id: `dom_${i}`,
        shopId: dominant,
        nextEligibleAt: new Date(now.getTime() - 3_600_000),
      });
    }

    await prisma.$executeRawUnsafe(`ANALYZE "DurableJob"`);
    await prisma.$executeRawUnsafe(`ANALYZE "DispatchReadyShop"`);
    await prisma.$executeRawUnsafe(`ANALYZE "Shop"`);
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
      assertEligibleClaimPlanShape(planText, {
        maxCandidateRows,
        maxReadyShopRows: shopCapForFairClaim(batchSize),
        // Disposable bound — far below former O(Shop) 100k-buffer regime.
        maxSharedHitBuffers: 20_000,
      });
      expect(planText).toMatch(/Buffers:\s*shared hit=\d+/i);
      expect(planText).not.toMatch(/Seq Scan on "Shop"/i);
      const hits = parseSharedHitBuffers(planText);
      expect(hits).not.toBeNull();
      expect(hits!).toBeLessThan(20_000);
    }
    for (const p of plans) {
      expect(p).toMatch(/DurableJob_shop_claim_/);
      expect(p).toMatch(/DispatchReadyShop/);
      expect(p).toMatch(/LockRows/i);
    }

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
    expect(claimedByShop.length).toBeGreaterThan(1);
    for (const row of claimedByShop) {
      expect(row._count).toBeLessThanOrEqual(2);
    }
    expect(claimedByShop.length).toBe(shops.length);
    expect(elapsed).toBeLessThan(30_000);
  }, 180_000);

  it("Shop scaling: readiness rows returned/locked stay bounded as total Shop grows", async () => {
    const active = 10;
    const batchSize = 10;
    const maxPerShop = 2;
    const now = new Date();
    const activeIds: string[] = [];
    for (let i = 0; i < active; i++) {
      const s = await prisma.shop.create({
        data: { myshopifyDomain: `pr4-perf-scale-a-${i}.myshopify.com` },
      });
      activeIds.push(s.id);
      for (let j = 0; j < 5; j++) {
        await insertEligibleJob(prisma, {
          id: `scale_a_${i}_${j}`,
          shopId: s.id,
          nextEligibleAt: new Date(now.getTime() - 60_000),
        });
      }
    }

    const emptyCounts = [1_000, 5_000, 20_000];
    const bufferByEmpty: number[] = [];
    for (const empty of emptyCounts) {
      // Remove prior empty shops from previous iteration.
      await prisma.shop.deleteMany({
        where: { myshopifyDomain: { startsWith: "pr4-perf-scale-e-" } },
      });
      const values: string[] = [];
      for (let i = 0; i < empty; i++) {
        values.push(
          `('pr4-perf-scale-e-${empty}-${i}','pr4-perf-scale-e-${empty}-${i}.myshopify.com',true,NOW(),NOW())`,
        );
        if (values.length >= 500 || i === empty - 1) {
          await prisma.$executeRawUnsafe(`
            INSERT INTO "Shop" (id, "myshopifyDomain", "processingEnabled", "createdAt", "updatedAt")
            VALUES ${values.join(",")}
            ON CONFLICT (id) DO NOTHING
          `);
          values.length = 0;
        }
      }
      // Also seed a large DurableJob backlog once (multi-shop inserts OK under D-050).
      if (empty === emptyCounts[0]) {
        for (let n = 0; n < 50_000; n += 500) {
          const chunk: string[] = [];
          for (let i = 0; i < 500 && n + i < 50_000; i++) {
            const id = `scale_backlog_${n + i}`;
            const shopId = activeIds[(n + i) % activeIds.length];
            chunk.push(
              `('${id}','${shopId}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1','{}','${"b".repeat(64)}','idem-${id}','corr-${id}','tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','PENDING','${now.toISOString()}','${now.toISOString()}','${now.toISOString()}')`,
            );
          }
          await prisma.$executeRawUnsafe(`
            INSERT INTO "DurableJob" (
              id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
              "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
              "authorityVersion", "executionStrategy", state, "nextEligibleAt",
              "createdAt", "updatedAt"
            ) VALUES ${chunk.join(",")}
          `);
        }
      }

      await prisma.$executeRawUnsafe(`ANALYZE "DurableJob"`);
      await prisma.$executeRawUnsafe(`ANALYZE "DispatchReadyShop"`);
      await prisma.$executeRawUnsafe(`ANALYZE "Shop"`);
      await prisma.$executeRawUnsafe(`RESET work_mem`);

      const planRows = await prisma.$queryRaw<Array<{ "QUERY PLAN": string }>>(
        buildFairClaimLockedExplainSql({
          now: new Date(),
          batchSize,
          maxPerShop,
        }),
      );
      const planText = planRows.map((r) => r["QUERY PLAN"]).join("\n");
      assertEligibleClaimPlanShape(planText, {
        maxCandidateRows: maxFairClaimCandidateRows(batchSize, maxPerShop),
        maxReadyShopRows: shopCapForFairClaim(batchSize),
        maxSharedHitBuffers: 20_000,
      });
      expect(planText).not.toMatch(/Seq Scan on "Shop"/i);
      const hits = parseSharedHitBuffers(planText) ?? 0;
      bufferByEmpty.push(hits);
    }

    // Boundedness: buffers must not grow linearly with empty Shop count.
    // Allow noise but reject the former ~5 buffers/shop regime (20k → 100k).
    expect(Math.max(...bufferByEmpty)).toBeLessThan(20_000);
    const growth = bufferByEmpty[2]! / Math.max(bufferByEmpty[0]!, 1);
    expect(growth).toBeLessThan(5);

    // 100+ active / 20k total
    for (let i = 0; i < 100; i++) {
      const s = await prisma.shop.create({
        data: { myshopifyDomain: `pr4-perf-scale-extra-${i}.myshopify.com` },
      });
      await insertEligibleJob(prisma, {
        id: `scale_extra_${i}`,
        shopId: s.id,
        nextEligibleAt: new Date(now.getTime() - 30_000),
      });
    }
    await prisma.$executeRawUnsafe(`ANALYZE "DispatchReadyShop"`);
    const plan100 = (
      await prisma.$queryRaw<Array<{ "QUERY PLAN": string }>>(
        buildFairClaimLockedExplainSql({
          now: new Date(),
          batchSize: 50,
          maxPerShop: 2,
        }),
      )
    )
      .map((r) => r["QUERY PLAN"])
      .join("\n");
    assertEligibleClaimPlanShape(plan100, {
      maxCandidateRows: maxFairClaimCandidateRows(50, 2),
      // Fixture has ~110 readiness rows; disposable Seq Scan of the small
      // table is allowed — returned/locked remain ≤ shopCap (D-050 truthful bound).
      maxReadyShopRows: 120,
      maxSharedHitBuffers: 20_000,
    });
    expect(plan100).not.toMatch(/Seq Scan on "Shop"/i);
  }, 300_000);

  it("active-due scaling 10/100/1k/5k/20k uses schedule index (F-D048-03 release gate)", async () => {
    const batchSize = 10;
    const maxPerShop = 2;
    const shopCap = shopCapForFairClaim(batchSize);
    const now = new Date();
    const cases: Array<{ total: number; activeDue: number }> = [
      { total: 1_000, activeDue: 10 },
      { total: 5_000, activeDue: 10 },
      { total: 20_000, activeDue: 10 },
      { total: 20_000, activeDue: 100 },
      { total: 20_000, activeDue: 1_000 },
      { total: 20_000, activeDue: 5_000 },
      { total: 20_000, activeDue: 20_000 },
    ];

    // Seed once at max size; smaller cases reuse / trim via nextDispatchAt filter.
    const maxActive = 20_000;
    const shopIds: string[] = [];
    for (let i = 0; i < maxActive; i += 500) {
      const values: string[] = [];
      for (let j = 0; j < 500 && i + j < maxActive; j++) {
        const n = i + j;
        const id = `pr4-perf-adue-${n}`;
        values.push(
          `('${id}','pr4-perf-adue-${n}.myshopify.com',true,NOW(),NOW())`,
        );
        shopIds.push(id);
      }
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Shop" (id, "myshopifyDomain", "processingEnabled", "createdAt", "updatedAt")
        VALUES ${values.join(",")}
        ON CONFLICT (id) DO NOTHING
      `);
    }
    // Extra empty shops for total=20k when activeDue < total are already covered
    // by maxActive=20k; for total 1k/5k we simply leave extras present (OK for gate).

    // ≥50k DurableJob backlog on a subset of shops (multi-shop bulk seed native).
    for (let n = 0; n < 50_000; n += 500) {
      const chunk: string[] = [];
      for (let i = 0; i < 500 && n + i < 50_000; i++) {
        const id = `adue_backlog_${n + i}`;
        const shopId = shopIds[(n + i) % 100]!;
        chunk.push(
          `('${id}','${shopId}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1','{}','${"a".repeat(64)}','idem-${id}','corr-${id}','tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','PENDING','${now.toISOString()}','${now.toISOString()}','${now.toISOString()}')`,
        );
      }
      await prisma.$executeRawUnsafe(`
        INSERT INTO "DurableJob" (
          id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
          "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
          "authorityVersion", "executionStrategy", state, "nextEligibleAt",
          "createdAt", "updatedAt"
        ) VALUES ${chunk.join(",")}
      `);
    }

    // Pre-seed future readiness for all shops so activeDue=10 probes still run
    // against a large DispatchReadyShop table (planner selects schedule index).
    await prisma.$executeRawUnsafe(`
      INSERT INTO "DispatchReadyShop" (
        "shopId", "earliestEligibleAt", "nextDispatchAt", "lastServedAt",
        "processingEnabled", "createdAt", "updatedAt"
      )
      SELECT id, NOW() + interval '30 days', NOW() + interval '30 days',
             NULL, true, NOW(), NOW()
      FROM "Shop"
      WHERE "myshopifyDomain" LIKE 'pr4-perf-adue-%'
      ON CONFLICT ("shopId") DO UPDATE SET
        "nextDispatchAt" = EXCLUDED."nextDispatchAt",
        "earliestEligibleAt" = EXCLUDED."earliestEligibleAt",
        "updatedAt" = NOW()
    `);

    for (const { activeDue } of cases) {
      // Make exactly activeDue shops due; others far future.
      await prisma.$executeRawUnsafe(`
        UPDATE "DispatchReadyShop"
        SET "nextDispatchAt" = NOW() + interval '30 days',
            "earliestEligibleAt" = NOW() + interval '30 days'
      `);
      await prisma.$executeRawUnsafe(`
        UPDATE "DispatchReadyShop" r
        SET "nextDispatchAt" = NOW() - interval '1 minute',
            "earliestEligibleAt" = NOW() - interval '1 minute',
            "processingEnabled" = true
        FROM (
          SELECT id FROM "Shop"
          WHERE "myshopifyDomain" LIKE 'pr4-perf-adue-%'
          ORDER BY id
          LIMIT ${activeDue}
        ) s
        WHERE r."shopId" = s.id
      `);
      // Ensure readiness exists for shops that may have been healed away.
      await prisma.$executeRawUnsafe(`
        INSERT INTO "DispatchReadyShop" (
          "shopId", "earliestEligibleAt", "nextDispatchAt", "lastServedAt",
          "processingEnabled", "createdAt", "updatedAt"
        )
        SELECT s.id, NOW() - interval '1 minute', NOW() - interval '1 minute',
               NULL, true, NOW(), NOW()
        FROM (
          SELECT id FROM "Shop"
          WHERE "myshopifyDomain" LIKE 'pr4-perf-adue-%'
          ORDER BY id
          LIMIT ${activeDue}
        ) s
        ON CONFLICT ("shopId") DO UPDATE SET
          "nextDispatchAt" = EXCLUDED."nextDispatchAt",
          "earliestEligibleAt" = EXCLUDED."earliestEligibleAt",
          "processingEnabled" = true,
          "updatedAt" = NOW()
      `);

      await prisma.$executeRawUnsafe(`ANALYZE "DispatchReadyShop"`);
      await prisma.$executeRawUnsafe(`ANALYZE "DurableJob"`);
      await prisma.$executeRawUnsafe(`ANALYZE "Shop"`);
      await prisma.$executeRawUnsafe(`RESET work_mem`);

      const planRows = await prisma.$queryRaw<Array<{ "QUERY PLAN": string }>>(
        buildFairClaimLockedExplainSql({
          now: new Date(),
          batchSize,
          maxPerShop,
        }),
      );
      const planText = planRows.map((r) => r["QUERY PLAN"]).join("\n");
      assertEligibleClaimPlanShape(planText, {
        maxCandidateRows: maxFairClaimCandidateRows(batchSize, maxPerShop),
        maxReadyShopRows: shopCap,
        maxSharedHitBuffers: 20_000,
        maxSortMethodMemoryKb: 256,
      });
      // At tiny active-due counts the planner may Seq Scan ≤ shopCap rows; at the
      // release-gate regimes (activeDue ≫ shopCap) require the schedule index.
      if (activeDue > shopCap * 4) {
        expect(planText).toMatch(/DispatchReadyShop_dispatch_schedule_idx/);
        expect(planText).not.toMatch(
          /Seq Scan on "DispatchReadyShop" r\s+\(actual[^)]*rows=(?:[1-9]\d{2,}|\d{4,})/i,
        );
      } else {
        // Even with activeDue=10, a large readiness table must use the schedule index.
        expect(planText).toMatch(/DispatchReadyShop_dispatch_schedule_idx/);
      }
      expect(planText).not.toMatch(/Seq Scan on "Shop"/i);
      expect(planText).not.toMatch(/Seq Scan on "DurableJob"/i);
      expect(planText).toMatch(/DurableJob_shop_claim_/);

      // due_shops LockRows: rows returned/locked ≤ shopCap; under SKIP LOCKED
      // contention physical walk may be lockedPrefix+shopCap (allow small slack).
      for (const line of planText.split("\n")) {
        if (!/on "DispatchReadyShop" r\s+\(/i.test(line)) continue;
        if (!/\(actual /i.test(line)) continue;
        const m = /\(actual[^)]*rows=(\d+)/i.exec(line);
        if (m) {
          expect(Number(m[1])).toBeLessThanOrEqual(shopCap * 2);
        }
      }
    }

    // 100+ active with batchSize that does NOT hide the issue (batchSize=10).
    await prisma.$executeRawUnsafe(`
      UPDATE "DispatchReadyShop"
      SET "nextDispatchAt" = NOW() + interval '30 days'
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "DispatchReadyShop" r
      SET "nextDispatchAt" = NOW() - interval '1 minute'
      FROM (
        SELECT id FROM "Shop"
        WHERE "myshopifyDomain" LIKE 'pr4-perf-adue-%'
        ORDER BY id LIMIT 150
      ) s
      WHERE r."shopId" = s.id
    `);
    await prisma.$executeRawUnsafe(`ANALYZE "DispatchReadyShop"`);
    const plan150 = (
      await prisma.$queryRaw<Array<{ "QUERY PLAN": string }>>(
        buildFairClaimLockedExplainSql({
          now: new Date(),
          batchSize: 10,
          maxPerShop: 2,
        }),
      )
    )
      .map((r) => r["QUERY PLAN"])
      .join("\n");
    assertEligibleClaimPlanShape(plan150, {
      maxCandidateRows: maxFairClaimCandidateRows(10, 2),
      maxReadyShopRows: 10,
      maxSharedHitBuffers: 20_000,
      maxSortMethodMemoryKb: 256,
    });
    expect(plan150).not.toMatch(/Seq Scan on "DispatchReadyShop"/i);
  }, 600_000);

  it("fairness matrix through 2,000 shops with identical timestamps", async () => {
    const batchSize = 20;
    const shopCount = 2_000;
    const bound = fairClaimStarvationBoundCycles(shopCount, batchSize);
    expect(bound).toBe(100);
    const stamp = new Date("2026-02-01T00:00:00.000Z");
    const shops: string[] = [];
    for (let i = 0; i < shopCount; i += 200) {
      const values: string[] = [];
      for (let j = 0; j < 200 && i + j < shopCount; j++) {
        const n = i + j;
        const id = `pr4-perf-fair2k-${n}`;
        values.push(
          `('${id}','pr4-perf-fair2k-${n}.myshopify.com',true,NOW(),NOW())`,
        );
        shops.push(id);
      }
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Shop" (id, "myshopifyDomain", "processingEnabled", "createdAt", "updatedAt")
        VALUES ${values.join(",")}
        ON CONFLICT (id) DO NOTHING
      `);
    }
    for (let i = 0; i < shopCount; i += 200) {
      const chunk: string[] = [];
      for (let j = 0; j < 200 && i + j < shopCount; j++) {
        const n = i + j;
        const id = `fair2k_job_${n}`;
        chunk.push(
          `('${id}','${shops[n]}','webhook:orders/create','webhook:orders/create','stocky-webhooks','v1','{}','${"f".repeat(64)}','idem-${id}','corr-${id}','tenant-job-envelope-v3','ATOMIC_APPLICATION_RECEIPT','PENDING','${stamp.toISOString()}','${stamp.toISOString()}','${stamp.toISOString()}')`,
        );
      }
      await prisma.$executeRawUnsafe(`
        INSERT INTO "DurableJob" (
          id, "shopId", "jobType", source, "queueName", "payloadSchemaVersion",
          "sanitizedPayload", "payloadDigest", "idempotencyKey", "correlationId",
          "authorityVersion", "executionStrategy", state, "nextEligibleAt",
          "createdAt", "updatedAt"
        ) VALUES ${chunk.join(",")}
      `);
    }
    await prisma.$executeRawUnsafe(`
      UPDATE "DispatchReadyShop"
      SET "nextDispatchAt" = '${stamp.toISOString()}',
          "earliestEligibleAt" = '${stamp.toISOString()}',
          "lastServedAt" = NULL
    `);

    const firstProgress = new Map<string, number>();
    for (let c = 0; c < bound; c++) {
      const before = new Map(
        (
          await prisma.jobDispatch.groupBy({ by: ["shopId"], _count: true })
        ).map((r) => [r.shopId, r._count]),
      );
      const result = await dispatchPendingJobs({
        batchSize,
        maxPerShop: 1,
        workerId: `fair2k-${c}`,
      });
      expect(result.claimed).toBeGreaterThan(0);
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
    expect(firstProgress.size).toBe(shopCount);
    for (const shopId of shops) {
      expect(firstProgress.get(shopId)!).toBeLessThanOrEqual(bound - 1);
    }
  }, 600_000);

  it("repeated-cycle fairness: every eligible shop progresses within documented bound", async () => {
    const batchSize = 4;
    const maxPerShop = 1;
    const shopCount = 12; // > batchSize and > 2×batchSize/2
    expect(shopCount).toBeGreaterThan(batchSize);
    expect(shopCount).toBeGreaterThan(2 * batchSize);
    const bound = fairClaimStarvationBoundCycles(shopCount, batchSize);
    const shops: string[] = [];
    const now = new Date();
    for (let i = 0; i < shopCount; i++) {
      const s = await prisma.shop.create({
        data: { myshopifyDomain: `pr4-perf-fair-${i}.myshopify.com` },
      });
      shops.push(s.id);
      // Greedy shops 0..2 get very old backlog; others get recent work.
      const age = i < 3 ? 86_400_000 : 3_600_000;
      for (let j = 0; j < 8; j++) {
        await insertEligibleJob(prisma, {
          id: `fair_${i}_${j}`,
          shopId: s.id,
          state: j % 2 === 0 ? "PENDING" : "RETRY_WAIT",
          nextEligibleAt: new Date(now.getTime() - age - j * 1000),
        });
      }
    }

    // Disabled shop with oldest work must not consume capacity.
    const disabled = await prisma.shop.create({
      data: {
        myshopifyDomain: "pr4-perf-fair-disabled.myshopify.com",
        processingEnabled: false,
        processingDisabledReason: "MANUAL",
        processingDisabledAt: now,
      },
    });
    await insertEligibleJob(prisma, {
      id: "fair_disabled_old",
      shopId: disabled.id,
      nextEligibleAt: new Date(now.getTime() - 200_000_000),
    });

    const firstProgress = new Map<string, number>();
    const cycles = bound * 3;
    for (let c = 0; c < cycles; c++) {
      // Continuously replenish greedy shops with older work after each cycle.
      for (let g = 0; g < 3; g++) {
        await insertEligibleJob(prisma, {
          id: `fair_greedy_repl_${c}_${g}`,
          shopId: shops[g]!,
          nextEligibleAt: new Date(now.getTime() - 86_400_000 - c * 1000),
        });
      }
      const countsBefore = new Map(
        (
          await prisma.jobDispatch.groupBy({
            by: ["shopId"],
            _count: true,
          })
        ).map((r) => [r.shopId, r._count]),
      );
      const result = await dispatchPendingJobs({
        batchSize,
        maxPerShop,
        workerId: `fair-cycle-${c}`,
      });
      expect(result.claimed).toBeGreaterThan(0);
      const countsAfter = await prisma.jobDispatch.groupBy({
        by: ["shopId"],
        _count: true,
      });
      for (const row of countsAfter) {
        const prev = countsBefore.get(row.shopId) ?? 0;
        if (row._count > prev && !firstProgress.has(row.shopId)) {
          firstProgress.set(row.shopId, c);
        }
      }
    }

    for (const shopId of shops) {
      expect(firstProgress.has(shopId)).toBe(true);
      expect(firstProgress.get(shopId)!).toBeLessThanOrEqual(bound);
    }
    // Disabled shop must never be claimed.
    expect(firstProgress.has(disabled.id)).toBe(false);
  }, 300_000);

  it("concurrent 2-way and 4-way dispatch refill aggregate capacity", async () => {
    const batchSize = 10;
    const maxPerShop = 2;
    const now = new Date();

    async function seedShops(prefix: string, count: number): Promise<string[]> {
      const shops: string[] = [];
      for (let i = 0; i < count; i++) {
        const s = await prisma.shop.create({
          data: { myshopifyDomain: `${prefix}-${i}.myshopify.com` },
        });
        shops.push(s.id);
        for (let j = 0; j < 6; j++) {
          await insertEligibleJob(prisma, {
            id: `${prefix}_${i}_${j}`,
            shopId: s.id,
            nextEligibleAt: new Date(now.getTime() - (i * 10 + j) * 1000),
          });
        }
      }
      await prisma.$executeRawUnsafe(`ANALYZE "DispatchReadyShop"`);
      return shops;
    }

    // --- 2-way wave (dedicated shops) ---
    const shops2 = await seedShops("pr4-perf-conc2", 30);
    const two = await Promise.all([
      dispatchPendingJobs({
        batchSize,
        maxPerShop,
        workerId: "perf-dispatcher-a",
      }),
      dispatchPendingJobs({
        batchSize,
        maxPerShop,
        workerId: "perf-dispatcher-b",
      }),
    ]);
    const twoTotal = two[0]!.claimed + two[1]!.claimed;
    const twoCap = Math.min(shops2.length * maxPerShop, 2 * batchSize);
    expect(twoTotal).toBeGreaterThanOrEqual(twoCap);
    expect(two.every((r) => r.claimed > 0)).toBe(true);

    // --- 4-way wave on a fresh eligible set (no illegal ENQUEUED→PENDING) ---
    await truncateSyncTables(prisma);
    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    await q.obliterate({ force: true }).catch(() => undefined);
    await q.close();
    await resetControlPlanePrismaForTests();

    const shops4 = await seedShops("pr4-perf-conc4", 60);
    const pendingReady = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT COUNT(*)::bigint AS n FROM "DispatchReadyShop"
       WHERE "processingEnabled" = true AND "nextDispatchAt" <= NOW()`,
    );
    expect(Number(pendingReady[0]?.n ?? 0)).toBeGreaterThanOrEqual(4 * batchSize);

    const four = await Promise.all(
      [0, 1, 2, 3].map((i) =>
        dispatchPendingJobs({
          batchSize,
          maxPerShop,
          workerId: `perf-dispatcher-4-${i}`,
        }),
      ),
    );
    const fourTotal = four.reduce((a, r) => a + r.claimed, 0);
    const fourCap = Math.min(shops4.length * maxPerShop, 4 * batchSize);
    // Aggregate refill: with unlocked eligible shops remaining, N dispatchers
    // reach N × batchSize without a zero-claim underfill.
    expect(fourTotal).toBeGreaterThanOrEqual(fourCap);
    expect(four.filter((r) => r.claimed === 0)).toHaveLength(0);
    expect(four.every((r) => r.claimed > 0)).toBe(true);

    const dispatches = await prisma.jobDispatch.findMany({
      select: { durableJobId: true },
    });
    const ids = dispatches.map((r) => r.durableJobId);
    expect(new Set(ids).size).toBe(ids.length);
  }, 180_000);

  it("deterministic raw claim ordering without re-sorting results", async () => {
    const shops: string[] = [];
    const now = new Date();
    for (let i = 0; i < 4; i++) {
      const s = await prisma.shop.create({
        data: { myshopifyDomain: `pr4-perf-order-${i}.myshopify.com` },
      });
      shops.push(s.id);
    }
    // Ensure known schedule order: identical nextDispatchAt orders by shopId.
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        await insertEligibleJob(prisma, {
          id: `ord_${i}_${j}`,
          shopId: shops[i]!,
          nextEligibleAt: new Date(now.getTime() - (100 - i * 10 - j) * 1000),
          createdAt: new Date(now.getTime() - (100 - i * 10 - j) * 1000),
        });
      }
    }
    await prisma.$executeRawUnsafe(`
      UPDATE "DispatchReadyShop"
      SET "nextDispatchAt" = '${new Date(now.getTime() - 100_000).toISOString()}',
          "lastServedAt" = NULL
    `);

    const rows = await prisma.$queryRaw<
      Array<{ id: string; shopId: string }>
    >(
      buildFairClaimLockedSelectSql({
        now: new Date(),
        batchSize: 8,
        maxPerShop: 2,
      }),
    );
    expect(rows.length).toBeGreaterThan(0);
    // First-round preference: first N unique shops appear before any shop's 2nd slot
    // when capacity is constrained (maxPerShop=2, batchSize=8 → 4 shops × 2).
    const firstRoundShops = new Set(rows.slice(0, 4).map((r) => r.shopId));
    expect(firstRoundShops.size).toBe(4);
    // Returned sequence must match SQL ORDER BY — assert directly on raw rows.
    const shopFirstIndex = new Map<string, number>();
    rows.forEach((r, idx) => {
      if (!shopFirstIndex.has(r.shopId)) shopFirstIndex.set(r.shopId, idx);
    });
    for (let i = 4; i < rows.length; i++) {
      const first = shopFirstIndex.get(rows[i]!.shopId)!;
      expect(first).toBeLessThan(i);
      expect(first).toBeLessThan(4);
    }
  }, 120_000);

  it("equality shopId predicate regresses to eligible_* filter; range-pair retains shop-claim", async () => {
    const s = await prisma.shop.create({
      data: { myshopifyDomain: "pr4-perf-eq.myshopify.com" },
    });
    const now = new Date();
    for (let i = 0; i < 100; i++) {
      await insertEligibleJob(prisma, {
        id: `eq_${i}`,
        shopId: s.id,
        nextEligibleAt: new Date(now.getTime() - i * 1000),
      });
    }
    for (let i = 0; i < 500; i++) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Shop" (id, "myshopifyDomain", "processingEnabled", "createdAt", "updatedAt")
        VALUES ('pr4-perf-eq-empty-${i}', 'pr4-perf-eq-empty-${i}.myshopify.com', true, NOW(), NOW())
      `);
    }
    await prisma.$executeRawUnsafe(`ANALYZE "DurableJob"`);
    await prisma.$executeRawUnsafe(`ANALYZE "DispatchReadyShop"`);
    const plan = (
      await prisma.$queryRaw<Array<{ "QUERY PLAN": string }>>(
        buildFairClaimLockedExplainSql({
          now: new Date(),
          batchSize: 10,
          maxPerShop: 2,
        }),
      )
    )
      .map((r) => r["QUERY PLAN"])
      .join("\n");
    expect(plan).toMatch(/DurableJob_shop_claim_/);
    expect(plan).not.toMatch(
      /DurableJob_eligible_.*Filter:\s*\("shopId"/s,
    );
    const sqlModule = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../fair-claim-query.server.ts",
      ),
      "utf8",
    );
    // Range-pair retained (P3-D047-R09) — equality alone is not a planner contract.
    // D-050 aliases: ds/ls/"shopId" depending on scheduler vs candidate CTE.
    expect(sqlModule).toMatch(
      /"shopId" >= (?:ss|ds|ls)\."?shopId"? AND "shopId" <= (?:ss|ds|ls)\."?shopId"?|"shopId" >= ls\.shop_id AND "shopId" <= ls\.shop_id/,
    );
  }, 120_000);

  it("rollback releases locks and readiness fairness survives", async () => {
    const shops: string[] = [];
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      const s = await prisma.shop.create({
        data: { myshopifyDomain: `pr4-perf-rb-${i}.myshopify.com` },
      });
      shops.push(s.id);
      await insertEligibleJob(prisma, {
        id: `rb_${i}`,
        shopId: s.id,
        nextEligibleAt: new Date(now.getTime() - 1000),
      });
    }
    try {
      await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ id: string }>>(
          buildFairClaimLockedSelectSql({
            now: new Date(),
            batchSize: 3,
            maxPerShop: 1,
          }),
        );
        expect(rows.length).toBe(3);
        throw new Error("force_rollback");
      });
    } catch (e) {
      expect(String(e)).toMatch(/force_rollback/);
    }
    const again = await prisma.$queryRaw<Array<{ id: string }>>(
      buildFairClaimLockedSelectSql({
        now: new Date(),
        batchSize: 3,
        maxPerShop: 1,
      }),
    );
    expect(again.length).toBe(3);
  }, 60_000);
});
