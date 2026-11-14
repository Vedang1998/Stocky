/**
 * Issue #94, second defect: the queue re-delivered webhook jobs whose
 * DurableJob had already been dead-lettered, and the worker then failed with
 * "Illegal DurableJob transition: DEAD_LETTERED → RUNNING".
 */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { PrismaClient } from "@prisma/client";
import type { Job } from "bullmq";
import { getWebhookQueue, type WebhookJobData } from "../../jobs/queue.server";
import { processWebhookJob } from "../../jobs/workers/webhook-processor";
import {
  CATALOG_REFETCH_LEASE_MS,
  catalogRefetchRetryDelayMs,
} from "../../jobs/workers/catalog-facts/resource-refetch";
import { resetTenantJobEnvelopeSecretCache } from "../../tenant/job-envelope.server";
import { issueSyncDispatchAuthority } from "../../tenant/sync-dispatch-authority.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";
import { dispatchPendingJobs, formatQueueJobId } from "../dispatcher.server";
import { createTenantJobEnvelopeV3 } from "../envelope-v3.server";
import { ingestAuthenticatedWebhook } from "../intake.server";
import { claimAttempt, completeAttemptSuccess } from "../lifecycle.server";
import {
  transitionRetryWaitToEnqueuedForTests,
  transitionToEnqueuedForTests,
} from "./test-state-helpers";

const SHOP = "durable-redelivery.myshopify.com";
const TOPIC = "inventory_items/create";

vi.mock("../../shopify.server", () => ({
  unauthenticated: {
    admin: async () => ({
      admin: {
        graphql: async () => {
          throw new Error("shopify_unavailable");
        },
      },
    }),
  },
}));

describe("re-delivery of durable webhook jobs (#94)", () => {
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
    await getWebhookQueue().close();
    await resetControlPlanePrismaForTests();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "DataIssue", "SyncHealth", "CatalogObservationInFlight",
        "JobReplay", "DeadLetter", "JobAttempt", "JobDispatch",
        "WebhookDelivery", "DurableJob", "DispatchReadyShop",
        "SyncApplicationReceipt"
      CASCADE
    `);
    await prisma.shop.deleteMany({ where: { myshopifyDomain: SHOP } });
    await prisma.shop.create({
      data: { myshopifyDomain: SHOP, processingEnabled: true },
    });
    await resetControlPlanePrismaForTests();
  });

  async function ingest(webhookId: string) {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic: TOPIC,
      webhookId,
      apiVersion: "2026-07",
      payload: {
        id: 9003,
        admin_graphql_api_id: "gid://shopify/InventoryItem/9003",
      },
    });
    return ingested.job!;
  }

  /** The job as the dispatcher would hand it to the worker. */
  async function enqueuedDelivery(webhookId: string) {
    const job = await ingest(webhookId);
    await transitionToEnqueuedForTests(prisma, job.id);
    const dispatch = await prisma.jobDispatch.create({
      data: {
        shopId: job.shopId,
        durableJobId: job.id,
        dispatchSequence: 1,
        queueName: "stocky-webhooks",
        queueJobId: formatQueueJobId(job.id, 1),
        state: "ENQUEUED",
        payloadDigest: job.payloadDigest,
        enqueuedAt: new Date(),
      },
    });
    await prisma.durableJob.update({
      where: { id: job.id },
      data: { activeDispatchSequence: 1 },
    });
    const envelope = createTenantJobEnvelopeV3({
      tenant: issueSyncDispatchAuthority({
        shopId: job.shopId,
        myshopifyDomain: SHOP,
        source: "verified_scheduler",
        correlationId: job.correlationId,
      }),
      source: `webhook:${TOPIC}`,
      durableJobId: job.id,
      dispatchId: dispatch.id,
      dispatchSequence: dispatch.dispatchSequence,
      queueJobId: dispatch.queueJobId,
      payloadDigest: job.payloadDigest,
    });
    const delivery = {
      id: dispatch.queueJobId,
      name: TOPIC,
      data: {
        topic: TOPIC,
        payloadShop: SHOP,
        payload: (job.sanitizedPayload as Record<string, unknown>) ?? {},
        tenant: envelope,
        durableJobId: job.id,
        dispatchId: dispatch.id,
        dispatchSequence: dispatch.dispatchSequence,
        queueJobId: dispatch.queueJobId,
      },
    } as unknown as Job<WebhookJobData>;
    return { job, dispatch, delivery };
  }

  async function failOnce(delivery: Job<WebhookJobData>) {
    const before = Date.now();
    await expect(processWebhookJob(delivery)).rejects.toThrow();
    return before;
  }

  it("retries a failed catalog webhook on the catalog schedule, dead-letters it once, and drops a later re-delivery", async () => {
    const { job, delivery } = await enqueuedDelivery("wh-redelivery-1");
    expect(job.maxAttempts).toBe(3);

    for (const attemptNumber of [1, 2]) {
      const before = await failOnce(delivery);
      const waiting = await prisma.durableJob.findUniqueOrThrow({
        where: { id: job.id },
      });
      expect(waiting.state).toBe("RETRY_WAIT");
      expect(waiting.attemptCount).toBe(attemptNumber);
      const delay = waiting.nextEligibleAt!.getTime() - before;
      const expected = catalogRefetchRetryDelayMs(attemptNumber);
      expect(delay).toBeGreaterThanOrEqual(expected);
      expect(delay).toBeLessThan(expected + 5_000);
      await transitionRetryWaitToEnqueuedForTests(prisma, job.id);
    }
    // The last retry has to come after a crashed job's read lease has expired.
    expect(catalogRefetchRetryDelayMs(1) + catalogRefetchRetryDelayMs(2)).toBeGreaterThan(
      CATALOG_REFETCH_LEASE_MS,
    );

    await failOnce(delivery);
    const dead = await prisma.durableJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(dead.state).toBe("DEAD_LETTERED");
    expect(await prisma.deadLetter.count()).toBe(1);
    expect(await prisma.jobAttempt.count()).toBe(3);
    // No read of the item is left open to block a replay of this job.
    expect(
      await prisma.catalogObservationInFlight.count({
        where: { lifecycleState: "ACTIVE", observationResponseGen: null },
      }),
    ).toBe(0);

    await expect(processWebhookJob(delivery)).resolves.toBeUndefined();
    expect(
      (await prisma.durableJob.findUniqueOrThrow({ where: { id: job.id } }))
        .state,
    ).toBe("DEAD_LETTERED");
    expect(await prisma.deadLetter.count()).toBe(1);
    expect(await prisma.jobAttempt.count()).toBe(3);
  });

  it("drops a re-delivery of a job that has already succeeded", async () => {
    const { job, delivery } = await enqueuedDelivery("wh-redelivery-2");
    const { attempt } = await claimAttempt({
      durableJobId: job.id,
      shopId: job.shopId,
      workerId: "first-delivery",
    });
    await completeAttemptSuccess({
      durableJobId: job.id,
      shopId: job.shopId,
      attemptId: attempt.id,
      workerId: "first-delivery",
    });

    await expect(processWebhookJob(delivery)).resolves.toBeUndefined();
    expect(
      (await prisma.durableJob.findUniqueOrThrow({ where: { id: job.id } }))
        .state,
    ).toBe("SUCCEEDED");
    expect(await prisma.jobAttempt.count()).toBe(1);
  });

  it("hands each dispatch to the queue for a single delivery attempt", async () => {
    const job = await ingest("wh-redelivery-3");
    await dispatchPendingJobs({ batchSize: 10, workerId: "redelivery-test" });

    const dispatch = await prisma.jobDispatch.findFirstOrThrow({
      where: { durableJobId: job.id },
    });
    const queued = await getWebhookQueue().getJob(dispatch.queueJobId);
    try {
      expect(queued?.opts.attempts).toBe(1);
    } finally {
      await queued?.remove();
    }
  });
});
