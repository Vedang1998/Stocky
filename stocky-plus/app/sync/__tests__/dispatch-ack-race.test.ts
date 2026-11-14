/**
 * Issue #122: the dispatcher puts a dispatch on the queue and only then
 * records the job as ENQUEUED. A worker that picked the delivery up in
 * between failed the claim ("DISPATCH_LEASED → RUNNING"), and with one queue
 * attempt per dispatch nothing ever ran the job or noticed it.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { PrismaClient, type DurableJob, type JobDispatch } from "@prisma/client";
import { DelayedError, type Job } from "bullmq";
import {
  createWebhookWorker,
  getWebhookQueue,
  WEBHOOK_QUEUE,
  type WebhookJobData,
} from "../../jobs/queue.server";
import {
  DISPATCH_ACK_RETRY_MS,
  DISPATCH_ACK_WAIT_MS,
  processWebhookJob,
} from "../../jobs/workers/webhook-processor";
import { resetTenantJobEnvelopeSecretCache } from "../../tenant/job-envelope.server";
import { issueSyncDispatchAuthority } from "../../tenant/sync-dispatch-authority.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";
import {
  DEFAULT_STRANDED_ENQUEUED_MS,
  DURABLE_DISPATCH_JOB_OPTIONS,
  formatQueueJobId,
  recoverStrandedEnqueuedJobs,
} from "../dispatcher.server";
import { createTenantJobEnvelopeV3 } from "../envelope-v3.server";
import { SyncControlPlaneError } from "../errors";
import { ingestAuthenticatedWebhook } from "../intake.server";
import { claimAttempt } from "../lifecycle.server";

const SHOP = "dispatch-ack-race.myshopify.com";
const TOPIC = "bulk_operations/finish";

vi.mock("../../shopify.server", () => ({
  unauthenticated: {
    admin: async () => {
      throw new Error("shopify_not_expected");
    },
  },
}));

async function waitFor<T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
  timeoutMs = 10_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (done(value)) return value;
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting; last value ${JSON.stringify(value)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

describe("delivery that arrives before its dispatch is recorded (#122)", () => {
  let prisma: PrismaClient;
  const workers: Array<{ close(): Promise<void> }> = [];

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
    await getWebhookQueue().obliterate({ force: true });
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "DataIssue", "SyncHealth", "JobReplay", "DeadLetter", "JobAttempt",
        "JobDispatch", "WebhookDelivery", "DurableJob", "DispatchReadyShop",
        "SyncApplicationReceipt"
      CASCADE
    `);
    await prisma.shop.deleteMany({ where: { myshopifyDomain: SHOP } });
    await prisma.shop.create({
      data: { myshopifyDomain: SHOP, processingEnabled: true },
    });
    await resetControlPlanePrismaForTests();
  });

  afterEach(async () => {
    await Promise.all(workers.splice(0).map((worker) => worker.close()));
  });

  /**
   * The state between the dispatcher's queue.add and its acknowledgement:
   * job DISPATCH_LEASED, dispatch PENDING_ENQUEUE.
   */
  async function leasedDispatch(
    webhookId: string,
    topic = TOPIC,
    payload: Record<string, unknown> = {
      admin_graphql_api_id: "gid://shopify/BulkOperation/122",
      status: "completed",
    },
  ) {
    const ingested = await ingestAuthenticatedWebhook({
      verifiedShop: SHOP,
      topic,
      webhookId,
      apiVersion: "2026-07",
      payload,
    });
    const job = ingested.job!;
    await prisma.$executeRaw`
      UPDATE "DurableJob"
      SET state = 'DISPATCH_LEASED', "leaseOwner" = 'dispatcher-under-test',
          "leaseExpiresAt" = NOW() + INTERVAL '30 seconds', "updatedAt" = NOW()
      WHERE id = ${job.id} AND state = 'PENDING'
    `;
    const dispatch = await prisma.jobDispatch.create({
      data: {
        shopId: job.shopId,
        durableJobId: job.id,
        dispatchSequence: 1,
        queueName: WEBHOOK_QUEUE,
        queueJobId: formatQueueJobId(job.id, 1),
        state: "PENDING_ENQUEUE",
        payloadDigest: job.payloadDigest,
      },
    });
    const data: WebhookJobData = {
      topic,
      payloadShop: SHOP,
      payload: (job.sanitizedPayload as Record<string, unknown>) ?? {},
      tenant: createTenantJobEnvelopeV3({
        tenant: issueSyncDispatchAuthority({
          shopId: job.shopId,
          myshopifyDomain: SHOP,
          source: "verified_scheduler",
          correlationId: job.correlationId,
        }),
        source: `webhook:${topic}` as Parameters<
          typeof createTenantJobEnvelopeV3
        >[0]["source"],
        durableJobId: job.id,
        dispatchId: dispatch.id,
        dispatchSequence: dispatch.dispatchSequence,
        queueJobId: dispatch.queueJobId,
        payloadDigest: job.payloadDigest,
      }),
      durableJobId: job.id,
      dispatchId: dispatch.id,
      dispatchSequence: dispatch.dispatchSequence,
      queueJobId: dispatch.queueJobId,
    } as WebhookJobData;
    return { job, dispatch, data };
  }

  /** What the dispatcher's acknowledgement writes. */
  async function acknowledge(job: DurableJob, dispatch: JobDispatch) {
    await prisma.$transaction([
      prisma.$executeRaw`
        UPDATE "DurableJob"
        SET state = 'ENQUEUED', "enqueuedAt" = NOW(), "leaseOwner" = NULL,
            "leaseExpiresAt" = NULL, "activeDispatchSequence" = 1,
            "updatedAt" = NOW()
        WHERE id = ${job.id} AND state = 'DISPATCH_LEASED'
      `,
      prisma.$executeRaw`
        UPDATE "JobDispatch"
        SET state = 'ENQUEUED', "enqueuedAt" = NOW()
        WHERE id = ${dispatch.id} AND state = 'PENDING_ENQUEUE'
      `,
    ]);
  }

  function fakeDelivery(
    data: WebhookJobData,
    timestamp: number,
  ): Job<WebhookJobData> & { moveToDelayed: ReturnType<typeof vi.fn> } {
    return {
      id: data.queueJobId,
      name: data.topic,
      data,
      timestamp,
      moveToDelayed: vi.fn(async () => undefined),
    } as unknown as Job<WebhookJobData> & {
      moveToDelayed: ReturnType<typeof vi.fn>;
    };
  }

  it("runs the job exactly once on the real queue after the dispatcher records it", async () => {
    const { job, dispatch, data } = await leasedDispatch("wh-ack-race-1");
    const queue = getWebhookQueue();
    await queue.add(TOPIC, data, {
      ...DURABLE_DISPATCH_JOB_OPTIONS,
      jobId: dispatch.queueJobId,
    });

    const failures: string[] = [];
    const worker = createWebhookWorker(processWebhookJob);
    worker.on("failed", (_job, error) => failures.push(error.message));
    workers.push(worker);

    // The worker reached the job first and handed it back to wait.
    await waitFor(
      () => queue.getJobState(dispatch.queueJobId),
      (state) => state === "delayed",
    );
    const early = await prisma.durableJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(early.state).toBe("DISPATCH_LEASED");
    expect(await prisma.jobAttempt.count({ where: { durableJobId: job.id } })).toBe(0);

    await acknowledge(job, dispatch);

    await waitFor(
      () => queue.getJobState(dispatch.queueJobId),
      (state) => state === "completed",
    );
    const finished = await prisma.durableJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(finished.state).toBe("SUCCEEDED");
    expect(finished.attemptCount).toBe(1);
    expect(await prisma.jobAttempt.count({ where: { durableJobId: job.id } })).toBe(1);
    expect(failures).toEqual([]);
    const delivered = await queue.getJob(dispatch.queueJobId);
    expect(delivered?.attemptsMade).toBe(1);
  });

  it("hands an early delivery back to the queue for a short wait", async () => {
    const { job, data } = await leasedDispatch("wh-ack-race-2");
    const delivery = fakeDelivery(data, Date.now());

    const before = Date.now();
    await expect(processWebhookJob(delivery, "lock-token")).rejects.toBeInstanceOf(
      DelayedError,
    );

    expect(delivery.moveToDelayed).toHaveBeenCalledTimes(1);
    const [until, token] = delivery.moveToDelayed.mock.calls[0];
    expect(token).toBe("lock-token");
    expect(until).toBeGreaterThanOrEqual(before + DISPATCH_ACK_RETRY_MS);
    expect(until).toBeLessThan(Date.now() + DISPATCH_ACK_RETRY_MS + 1_000);
    expect(
      (await prisma.durableJob.findUniqueOrThrow({ where: { id: job.id } })).state,
    ).toBe("DISPATCH_LEASED");
    expect(await prisma.jobAttempt.count()).toBe(0);
  });

  it("stops waiting once the delivery is older than the wait limit", async () => {
    const { data } = await leasedDispatch("wh-ack-race-3");
    const delivery = fakeDelivery(data, Date.now() - DISPATCH_ACK_WAIT_MS - 1);

    await expect(processWebhookJob(delivery, "lock-token")).rejects.toMatchObject({
      code: "dispatch_not_acknowledged",
    });
    expect(delivery.moveToDelayed).not.toHaveBeenCalled();
    // The limit outlasts the dispatcher's lease, so a dispatcher that died
    // before acknowledging is replaced while the delivery is still waiting.
    expect(DISPATCH_ACK_WAIT_MS).toBeGreaterThan(30_000 * 2);
  });

  it("refuses a delivery whose dispatch is no longer the pending one", async () => {
    const { job, dispatch } = await leasedDispatch("wh-ack-race-4");
    await prisma.jobDispatch.update({
      where: { id: dispatch.id },
      data: { state: "SUPERSEDED", completedAt: new Date() },
    });

    const refused = await claimAttempt({
      durableJobId: job.id,
      shopId: job.shopId,
      workerId: "stale-delivery",
      jobDispatchId: dispatch.id,
    }).catch((error: unknown) => error);

    expect(refused).toBeInstanceOf(SyncControlPlaneError);
    expect((refused as SyncControlPlaneError).code).toBe("illegal_job_transition");
    expect(await prisma.jobAttempt.count()).toBe(0);
  });

  it("puts a job whose only delivery failed back for a retry", async () => {
    // The state store testing found: ENQUEUED, no attempt, dispatch ENQUEUED,
    // and the queue's single delivery already failed.
    const { job, dispatch, data } = await leasedDispatch(
      "wh-ack-race-5",
      "products/create",
      {
        id: 1221,
        admin_graphql_api_id: "gid://shopify/Product/1221",
        title: "Stranded",
      },
    );
    await acknowledge(job, dispatch);
    const queue = getWebhookQueue();
    await queue.add("products/create", data, {
      ...DURABLE_DISPATCH_JOB_OPTIONS,
      jobId: dispatch.queueJobId,
    });
    // The worker as it failed before this fix.
    workers.push(
      createWebhookWorker(async () => {
        throw new Error("Illegal DurableJob transition: DISPATCH_LEASED → RUNNING");
      }),
    );
    await waitFor(
      () => queue.getJobState(dispatch.queueJobId),
      (state) => state === "failed",
    );

    const result = await recoverStrandedEnqueuedJobs({
      now: new Date(Date.now() + DEFAULT_STRANDED_ENQUEUED_MS + 1_000),
    });

    expect(result).toMatchObject({ recovered: 1, deadLettered: 0 });
    const recovered = await prisma.durableJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(recovered.state).toBe("RETRY_WAIT");
    expect(recovered.failureCode).toBe("stranded_enqueued");
    expect(
      (await prisma.jobDispatch.findUniqueOrThrow({ where: { id: dispatch.id } }))
        .state,
    ).toBe("SUPERSEDED");
    expect(
      await prisma.dataIssue.count({ where: { reasonCode: "stranded_enqueued" } }),
    ).toBe(1);
  });
});
