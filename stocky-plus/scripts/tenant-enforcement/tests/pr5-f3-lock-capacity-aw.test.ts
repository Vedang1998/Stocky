import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  acquireCanonicalIdentityAdvisoryLock,
  type CanonicalApplyDb,
} from "../../../app/lib/catalog-facts";
import { createTenantDb } from "../../../app/tenant/tenant-db.server";
import {
  assertCanonicalWriterCapacityAtStartup,
  deriveCanonicalWriterConcurrency,
  readCanonicalWriterConfig,
} from "../../../app/jobs/workers/catalog-facts/capacity";
import { CANONICAL_WRITER_QUEUE_CONCURRENCY_SUM } from "../../../app/jobs/worker-concurrency";
import { resetF3Rows, setupF3Database } from "./pr5-f3-test-helpers";

type Authority = Awaited<ReturnType<typeof setupF3Database>>["authority"];

describe("PR5-F3 Race AW derived lock-capacity envelope", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let authority: Authority;

  beforeAll(async () => {
    ({ prisma, shopAId, authority } = await setupF3Database());
  }, 120_000);

  beforeEach(async () => {
    await resetF3Rows(prisma);
    process.env.STOCKY_DISPATCHER_PROCESS_COUNT = "1";
    delete process.env.STOCKY_DISPATCH_BATCH_SIZE;
    delete process.env.STOCKY_CANONICAL_IDENTITIES_PER_TRANSACTION;
  });

  afterAll(async () => {
    delete process.env.STOCKY_DISPATCHER_PROCESS_COUNT;
    await prisma?.$disconnect();
  });

  it("FX-RACE-AW uses D * max(B, aggregate worker concurrency)", () => {
    expect(
      deriveCanonicalWriterConcurrency({
        dispatcherProcessCount: 2,
        dispatchBatchSize: 50,
        aggregateWorkerConcurrency: 6,
      }),
    ).toBe(100);
  });

  it("FX-RACE-AW / F-CLAUDE-PR5F3EC-01 does not undercount when dispatch batch is below worker concurrency", () => {
    expect(
      deriveCanonicalWriterConcurrency({
        dispatcherProcessCount: 3,
        dispatchBatchSize: 2,
        aggregateWorkerConcurrency: 6,
      }),
    ).toBe(18);
  });

  it("reads actual queue concurrency rather than evaluator default four", () => {
    const config = readCanonicalWriterConfig({
      STOCKY_DISPATCHER_PROCESS_COUNT: "1",
      STOCKY_DISPATCH_BATCH_SIZE: "1",
    });
    expect(config.aggregateWorkerConcurrency).toBe(
      CANONICAL_WRITER_QUEUE_CONCURRENCY_SUM,
    );
    expect(config.configuredWorstCaseConcurrentCanonicalTransactions).toBe(
      CANONICAL_WRITER_QUEUE_CONCURRENCY_SUM,
    );
  });

  it.each([undefined, "0", "-1", "1.5", "not-a-number"])(
    "fails closed on invalid dispatcher process count %s",
    (value) => {
      expect(() =>
        readCanonicalWriterConfig({
          STOCKY_DISPATCHER_PROCESS_COUNT: value,
        }),
      ).toThrow("STOCKY_DISPATCHER_PROCESS_COUNT");
    },
  );

  it("evaluates the real disposable PostgreSQL settings at startup", async () => {
    const result = await assertCanonicalWriterCapacityAtStartup({
      STOCKY_DISPATCHER_PROCESS_COUNT: "1",
      STOCKY_DISPATCH_BATCH_SIZE: "50",
      STOCKY_CANONICAL_IDENTITIES_PER_TRANSACTION: "32",
    });
    expect(result.configuredWorstCaseConcurrentCanonicalTransactions).toBe(50);
    expect(result.effectiveCanonicalIdentitiesPerTransaction).toBeGreaterThan(
      0,
    );
  });

  it("reduces an unsafe requested batch instead of raising PostgreSQL settings", async () => {
    const result = await assertCanonicalWriterCapacityAtStartup({
      STOCKY_DISPATCHER_PROCESS_COUNT: "2",
      STOCKY_DISPATCH_BATCH_SIZE: "50",
      STOCKY_CANONICAL_IDENTITIES_PER_TRANSACTION: "32",
    });
    expect(result.reduced).toBe(true);
    expect(result.effectiveCanonicalIdentitiesPerTransaction).toBeLessThan(32);
  });

  it("rejects an envelope whose derived concurrency cannot fit one identity", async () => {
    await expect(
      assertCanonicalWriterCapacityAtStartup({
        STOCKY_DISPATCHER_PROCESS_COUNT: "1000000",
        STOCKY_DISPATCH_BATCH_SIZE: "50",
        STOCKY_CANONICAL_IDENTITIES_PER_TRANSACTION: "32",
      }),
    ).rejects.toThrow(/insufficient|safe integer/i);
  });

  it("transaction advisory locks are released by rollback with no half-applied row", async () => {
    const db = createTenantDb(authority);
    await expect(
      db.$transaction(async (tx) => {
        await acquireCanonicalIdentityAdvisoryLock(
          tx as unknown as CanonicalApplyDb,
          {
            shopId: shopAId,
            resourceKind: "Product",
            shopifyGid: "gid://shopify/Product/rollback",
          },
        );
        throw new Error("force rollback");
      }),
    ).rejects.toThrow("force rollback");
    const locks = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS count
      FROM pg_locks
      WHERE locktype = 'advisory' AND granted
    `;
    expect(locks[0]?.count ?? 0n).toBe(0n);
    expect(await prisma.shopifyProductFact.count()).toBe(0);
  });
});
