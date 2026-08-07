/**
 * F-PR4-11 / F-PR4-13 / D-048 — operational fair-claim plan, fairness, concurrency,
 * Shop-scaling boundedness, and runtime/EXPLAIN identity.
 *
 * EXPLAIN subject is the production buildFairClaimLockedSelectSql statement
 * (DispatchReadyShop lock + PENDING/RETRY_WAIT LATERAL + FOR UPDATE SKIP LOCKED).
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
  buildFairClaimLockedExplainSql,
  buildFairClaimLockedSelectSql,
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
    expect(id.algorithm).toBe("dispatch_ready_shop_fair_skip_locked");
    expect(id.selectBuilder).toBe(buildFairClaimLockedSelectSql);
    expect(id.explainBuilder).toBe(buildFairClaimLockedExplainSql);
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

    // Planted inline claim must fail the guard.
    const planted = source.replace(
      "buildFairClaimLockedSelectSql({ now, batchSize, maxPerShop })",
      `Prisma.sql\`WITH due_shops AS (SELECT 1) SELECT * FROM "DurableJob" FOR UPDATE SKIP LOCKED\``,
    );
    expect(() => assertDispatcherUsesProductionFairClaimSql(planted)).toThrow(
      /inline_claim_sql|missing_fair_claim_call/,
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
        maxSharedHitBuffers: 5_000,
      });
      expect(planText).toMatch(/Buffers:\s*shared hit=\d+/i);
      expect(planText).not.toMatch(/Seq Scan on "Shop"/i);
      const hits = parseSharedHitBuffers(planText);
      expect(hits).not.toBeNull();
      expect(hits!).toBeLessThan(5_000);
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

  it("Shop scaling: readiness rows examined stay bounded as total Shop grows", async () => {
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
      // Also seed a large DurableJob backlog once.
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
        maxSharedHitBuffers: 5_000,
      });
      expect(planText).not.toMatch(/Seq Scan on "Shop"/i);
      const hits = parseSharedHitBuffers(planText) ?? 0;
      bufferByEmpty.push(hits);
    }

    // Boundedness: buffers must not grow linearly with empty Shop count.
    // Allow noise but reject the former ~5 buffers/shop regime (20k → 100k).
    expect(Math.max(...bufferByEmpty)).toBeLessThan(5_000);
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
      maxReadyShopRows: 50,
      maxSharedHitBuffers: 5_000,
    });
    expect(plan100).not.toMatch(/Seq Scan on "Shop"/i);
  }, 300_000);

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
    const shops: string[] = [];
    const now = new Date();
    // Enough shops for 4 × batchSize disjoint readiness windows (+ margin).
    for (let i = 0; i < 60; i++) {
      const s = await prisma.shop.create({
        data: { myshopifyDomain: `pr4-perf-conc-${i}.myshopify.com` },
      });
      shops.push(s.id);
      for (let j = 0; j < 6; j++) {
        await insertEligibleJob(prisma, {
          id: `conc2_${i}_${j}`,
          shopId: s.id,
          nextEligibleAt: new Date(now.getTime() - (i * 10 + j) * 1000),
        });
      }
    }
    await prisma.$executeRawUnsafe(`ANALYZE "DispatchReadyShop"`);

    const batchSize = 10;
    const maxPerShop = 2;
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
    const twoCap = Math.min(shops.length * maxPerShop, 2 * batchSize);
    expect(twoTotal).toBeGreaterThanOrEqual(twoCap);
    expect(two.every((r) => r.claimed > 0)).toBe(true);

    // Restore all previously claimed work (ENQUEUED and DISPATCH_LEASED) so the
    // 4-way wave starts with a full eligible backlog — not only lease leftovers.
    const q = new Queue(WEBHOOK_QUEUE, { connection: redis.duplicate() });
    await q.obliterate({ force: true }).catch(() => undefined);
    await q.close();
    await prisma.jobAttempt.deleteMany({});
    await prisma.jobDispatch.deleteMany({});
    await prisma.$executeRawUnsafe(`
      UPDATE "DurableJob"
      SET
        state = 'PENDING',
        "leaseOwner" = NULL,
        "leaseExpiresAt" = NULL,
        "enqueuedAt" = NULL,
        "activeDispatchSequence" = NULL,
        "updatedAt" = NOW()
      WHERE state IN ('DISPATCH_LEASED', 'ENQUEUED')
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "DispatchReadyShop" SET "lastServedAt" = NULL
    `);
    await prisma.$executeRawUnsafe(`ANALYZE "DispatchReadyShop"`);

    const pendingReady = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT COUNT(*)::bigint AS n FROM "DispatchReadyShop"
       WHERE "processingEnabled" = true AND "earliestEligibleAt" <= NOW()`,
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
    const fourCap = Math.min(shops.length * maxPerShop, 4 * batchSize);
    // Aggregate refill: with unlocked eligible shops remaining, N dispatchers
    // reach N × batchSize (here 40) without a zero-claim underfill.
    expect(fourTotal).toBeGreaterThanOrEqual(fourCap);
    const zeroCount = four.filter((r) => r.claimed === 0).length;
    expect(zeroCount).toBe(0);
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
    // Ensure known lastServedAt order: serve shop 0 first historically.
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
      SET "lastServedAt" = NULL
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
    expect(sqlModule).toMatch(
      /"shopId" >= ss\."shopId" AND "shopId" <= ss\."shopId"/,
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
