import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { issueTenantAuthority } from "../authority.server";
import {
  createTenantJobEnvelope,
  requireTenantJobEnvelopeSecret,
  resetTenantJobEnvelopeSecretCache,
  resolveTenantJobContext,
} from "../job-envelope.server";
import { resolveTenantJobContextV3 } from "../../sync/envelope-v3.server";
import {
  enqueueAbcAnalysisForShop,
  enqueueCatalogSync,
  getCronQueue,
  CRON_QUEUE,
  requireRedisUrl,
} from "../../jobs/queue.server";
import { TenantAuthorityError } from "../errors";
import {
  createPrisma,
  resetPublicSchema,
  seedTwoShops,
  wipeSyncControlPlaneTables,
  SHOP_A_DOMAIN,
  SHOP_B_DOMAIN,
} from "./helpers";

describe("tenant queue/Redis envelope integration (C-03)", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;
  let redis: IORedis;

  beforeAll(async () => {
    // Durable producers require control-plane Prisma; disposable suites may fall back.
    process.env.STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK ??= "1";
    resetTenantJobEnvelopeSecretCache();
    requireTenantJobEnvelopeSecret();
    prisma = createPrisma();
    await resetPublicSchema(prisma);
    redis = new IORedis(requireRedisUrl(), {
      maxRetriesPerRequest: null,
    });
    await redis.ping();
  });

  beforeEach(async () => {
    await prisma.supplier.deleteMany();
    await wipeSyncControlPlaneTables(prisma);
    await prisma.shop.deleteMany();
    const shops = await seedTwoShops(prisma);
    shopAId = shops.shopA.id;
    shopBId = shops.shopB.id;
    const queue = getCronQueue();
    await queue.obliterate({ force: true }).catch(() => undefined);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });

  function authA() {
    return issueTenantAuthority({
      shopId: shopAId,
      myshopifyDomain: SHOP_A_DOMAIN,
      source: "verified_job",
      correlationId: "corr-redis-a",
    });
  }

  it("enqueueCatalogSync signs envelope and worker resolve succeeds", async () => {
    await enqueueCatalogSync(authA());
    const queue = getCronQueue();
    const jobs = await queue.getJobs(["waiting", "delayed", "active"]);
    const job = jobs.find((j) => j.name === "catalog-sync");
    expect(job).toBeTruthy();
    const data = job!.data as { tenant: unknown; durableJobId?: string };
    expect(data.durableJobId).toBeTruthy();
    const ctx = await resolveTenantJobContextV3(data.tenant, {
      expectedJobNameOrTopic: "catalog-sync",
      expectedDurableJobId: data.durableJobId,
    });
    expect(ctx.tenant.shopId).toBe(shopAId);
    expect(ctx.envelope.schemaVersion).toBe("tenant-job-envelope-v3");
  });

  it("rejects arbitrary pre-built envelope supplied to producer", async () => {
    const envelope = createTenantJobEnvelope(authA(), "catalog_sync");
    await expect(
      enqueueCatalogSync(envelope as never),
    ).rejects.toMatchObject({ code: "enqueue_requires_authority" });
  });

  it("direct BullMQ payload injection without valid signature is denied", async () => {
    const queue = new Queue(CRON_QUEUE, {
      connection: redis,
    });
    await queue.add("catalog-sync", {
      tenant: {
        schemaVersion: "tenant-job-envelope-v1",
        shopId: shopAId,
        myshopifyDomain: SHOP_A_DOMAIN,
        source: "catalog_sync",
        correlationId: "injected",
        issuedAt: new Date().toISOString(),
      },
    });
    const jobs = await queue.getJobs(["waiting", "delayed"]);
    const injected = jobs.find(
      (j) => (j.data as { tenant?: { correlationId?: string } })?.tenant?.correlationId === "injected",
    );
    expect(injected).toBeTruthy();
    await expect(
      resolveTenantJobContext((injected!.data as { tenant: unknown }).tenant, {
        expectedJobNameOrTopic: "catalog-sync",
      }),
    ).rejects.toBeInstanceOf(TenantAuthorityError);
    await queue.close();
  });

  it("concurrent valid jobs for two shops remain isolated via Redis", async () => {
    const authB = issueTenantAuthority({
      shopId: shopBId,
      myshopifyDomain: SHOP_B_DOMAIN,
      source: "verified_job",
    });
    await Promise.all([
      enqueueAbcAnalysisForShop(authA()),
      enqueueAbcAnalysisForShop(authB),
    ]);
    const queue = getCronQueue();
    const jobs = await queue.getJobs(["waiting", "delayed"]);
    const shopJobs = jobs.filter((j) => j.name === "abc-analysis-shop");
    expect(shopJobs.length).toBeGreaterThanOrEqual(2);
    const contexts = await Promise.all(
      shopJobs.map((j) => {
        const data = j.data as { tenant: unknown; durableJobId?: string };
        return resolveTenantJobContextV3(data.tenant, {
          expectedJobNameOrTopic: "abc-analysis-shop",
          expectedDurableJobId: data.durableJobId,
        });
      }),
    );
    const ids = new Set(contexts.map((c) => c.tenant.shopId));
    expect(ids.has(shopAId)).toBe(true);
    expect(ids.has(shopBId)).toBe(true);
  });
});
