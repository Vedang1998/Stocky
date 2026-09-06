import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { randomUUID } from "node:crypto";
import type { TenantAuthority } from "../tenant/authority.server";
import { isTenantAuthority } from "../tenant/authority.server";
import type { TenantJobEnvelopeV1 } from "../tenant/job-envelope.server";
import type { TenantJobEnvelopeV2 } from "../sync/envelope-v2.server";
import { TenantAuthorityError } from "../tenant/errors";
import { createDurableJob } from "../sync/intake.server";
import { getControlPlanePrisma } from "../sync/control-plane-db.server";
import {
  CRON_WORKER_CONCURRENCY,
  WEBHOOK_WORKER_CONCURRENCY,
} from "./worker-concurrency";

async function kickDispatcher(batchSize = 5): Promise<void> {
  // Dynamic import avoids circular dependency with dispatcher → queue.
  const { dispatchPendingJobs } = await import("../sync/dispatcher.server");
  await dispatchPendingJobs({ batchSize }).catch(() => undefined);
}

/**
 * Require an explicitly configured Redis URL (F-PR4-19).
 * Never fall back to a redaction placeholder or unexpected host.
 */
export function requireRedisUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.REDIS_URL;
  if (raw == null || raw.trim() === "") {
    throw new Error(
      "redis_url_not_configured: REDIS_URL must be set explicitly for queue functionality",
    );
  }
  const trimmed = raw.trim();
  if (
    trimmed === "[REDACTED]" ||
    trimmed.includes("[REDACTED]") ||
    trimmed === "undefined" ||
    trimmed === "null"
  ) {
    throw new Error(
      "redis_url_invalid: REDIS_URL must not be a redaction placeholder",
    );
  }
  return trimmed;
}

let connection: IORedis | null = null;

function getConnection(): IORedis {
  if (!connection) {
    const url = requireRedisUrl();
    // Fast-fail when tests intentionally point REDIS_URL at an unreachable host.
    // STOCKY_TEST_REDIS_FAST_FAIL is test-only (NEW-PR4-SC02); ignored outside NODE_ENV=test.
    const fastFail =
      (process.env.NODE_ENV === "test" &&
        process.env.STOCKY_TEST_REDIS_FAST_FAIL === "1") ||
      /127\.0\.0\.1:1\b/.test(url) ||
      /\[::1\]:1\b/.test(url);
    connection = new IORedis(url, {
      maxRetriesPerRequest: fastFail ? 1 : null,
      connectTimeout: fastFail ? 200 : undefined,
      enableOfflineQueue: fastFail ? false : undefined,
      retryStrategy: fastFail ? () => null : undefined,
      lazyConnect: false,
    });
  }
  return connection;
}

export const WEBHOOK_QUEUE = "stocky-webhooks";
export const CRON_QUEUE = "stocky-cron";
export const INVENTORY_RECONCILE_MIN_ENQUEUE_INTERVAL_MS = 15 * 60 * 1000;

export type WebhookJobData = {
  topic: string;
  /** Informational only — never authority. */
  payloadShop: string;
  payload: Record<string, unknown>;
  /** v3 preferred; v2 accepted only for in-flight pre-cutover jobs. */
  tenant:
    | TenantJobEnvelopeV1
    | TenantJobEnvelopeV2
    | import("../sync/envelope-v3.server").TenantJobEnvelopeV3;
  durableJobId?: string;
  dispatchId?: string;
  dispatchSequence?: number;
  queueJobId?: string;
};

export type CatalogSyncJobData = {
  tenant:
    | TenantJobEnvelopeV1
    | TenantJobEnvelopeV2
    | import("../sync/envelope-v3.server").TenantJobEnvelopeV3;
  durableJobId?: string;
  dispatchId?: string;
  dispatchSequence?: number;
  queueJobId?: string;
  payload?: Record<string, unknown>;
};

export type AbcShopJobData = {
  tenant:
    | TenantJobEnvelopeV1
    | TenantJobEnvelopeV2
    | import("../sync/envelope-v3.server").TenantJobEnvelopeV3;
  durableJobId?: string;
  dispatchId?: string;
  dispatchSequence?: number;
  queueJobId?: string;
  payload?: Record<string, unknown>;
};

let webhookQueue: Queue<WebhookJobData> | null = null;
let cronQueue: Queue | null = null;

function requireAuthority(
  tenant: TenantAuthority,
  label: string,
): TenantAuthority {
  if (!isTenantAuthority(tenant)) {
    throw new TenantAuthorityError(
      "enqueue_requires_authority",
      `${label} accepts branded TenantAuthority only — pre-built envelopes are not accepted`,
    );
  }
  return tenant;
}

export function getWebhookQueue(): Queue<WebhookJobData> {
  if (!webhookQueue) {
    webhookQueue = new Queue<WebhookJobData>(WEBHOOK_QUEUE, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }
  return webhookQueue;
}

export function getCronQueue(): Queue {
  if (!cronQueue) {
    cronQueue = new Queue(CRON_QUEUE, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    });
  }
  return cronQueue;
}

/**
 * @deprecated Prefer ingestAuthenticatedWebhook from routes. Kept as a thin
 * helper that creates a durable webhook job for tests/legacy callers.
 */
export async function enqueueWebhook(
  data: {
    topic: string;
    payloadShop: string;
    payload: Record<string, unknown>;
    tenant: TenantAuthority;
  },
  webhookId?: string,
) {
  const tenant = requireAuthority(data.tenant, "enqueueWebhook");
  await createDurableJob({
    shopId: tenant.shopId,
    jobType: `webhook:${data.topic}`,
    source: `webhook:${data.topic}`,
    queueName: WEBHOOK_QUEUE,
    payloadSchemaVersion: `legacy-enqueue-${data.topic}`,
    sanitizedPayload: data.payload,
    idempotencyKey: webhookId
      ? `webhook:${webhookId}`
      : `webhook-legacy:${tenant.shopId}:${data.topic}:${randomUUID()}`,
    correlationId: tenant.correlationId,
    causationId: tenant.causationId,
  });
  await kickDispatcher();
}

/** Create durable catalog-sync job; dispatcher enqueues to BullMQ. */
export async function enqueueCatalogSync(tenant: TenantAuthority) {
  const auth = requireAuthority(tenant, "enqueueCatalogSync");
  await createDurableJob({
    shopId: auth.shopId,
    jobType: "catalog-sync",
    source: "catalog_sync",
    queueName: CRON_QUEUE,
    payloadSchemaVersion: "catalog-facts-v1",
    sanitizedPayload: { shopId: auth.shopId },
    idempotencyKey: `catalog-sync:${auth.shopId}:${auth.correlationId}`,
    correlationId: auth.correlationId,
    causationId: auth.causationId,
    maxAttempts: 125,
  });
  await kickDispatcher();
}

/** Dedicated producer for afterAuth catalog sync (approved source). */
export async function enqueueAfterAuthCatalogSync(tenant: TenantAuthority) {
  const auth = requireAuthority(tenant, "enqueueAfterAuthCatalogSync");
  await createDurableJob({
    shopId: auth.shopId,
    jobType: "catalog-sync",
    source: "after_auth_catalog_sync",
    queueName: CRON_QUEUE,
    payloadSchemaVersion: "catalog-facts-v1",
    sanitizedPayload: { shopId: auth.shopId, reason: "after_auth" },
    idempotencyKey: `after-auth-catalog-sync:${auth.shopId}:${auth.correlationId}`,
    correlationId: auth.correlationId,
    causationId: auth.causationId,
    maxAttempts: 125,
  });
  await kickDispatcher();
}

export async function enqueueInventoryStateReconcile(
  tenant: TenantAuthority,
): Promise<{ enqueued: boolean; reason?: string }> {
  const auth = requireAuthority(tenant, "enqueueInventoryStateReconcile");
  const prisma = getControlPlanePrisma();
  const webhookBacklog = await prisma.durableJob.count({
    where: {
      shopId: auth.shopId,
      jobType: { startsWith: "webhook:" },
      NOT: { jobType: "webhook:bulk_operations/finish" },
      state: { in: ["PENDING", "RETRY_WAIT", "DISPATCH_LEASED"] },
    },
  });
  if (webhookBacklog > 0) {
    return { enqueued: false, reason: "webhook_backlog_preferred" };
  }
  const existing = await prisma.durableJob.findFirst({
    where: {
      shopId: auth.shopId,
      jobType: "inventory-state-reconcile",
      state: {
        in: ["PENDING", "RETRY_WAIT", "DISPATCH_LEASED", "ENQUEUED", "RUNNING"],
      },
    },
    select: { id: true },
  });
  if (existing) {
    return { enqueued: false, reason: "already_pending" };
  }
  const bucket = Math.floor(
    Date.now() / INVENTORY_RECONCILE_MIN_ENQUEUE_INTERVAL_MS,
  );
  await createDurableJob({
    shopId: auth.shopId,
    jobType: "inventory-state-reconcile",
    source: "inventory_state_reconcile",
    queueName: CRON_QUEUE,
    payloadSchemaVersion: "inventory-state-reconcile-v1",
    sanitizedPayload: { shopId: auth.shopId, scheduleBucket: bucket },
    idempotencyKey: `inventory-state-reconcile:${auth.shopId}:${bucket}`,
    correlationId: auth.correlationId,
    causationId: auth.causationId,
    maxAttempts: 125,
  });
  await kickDispatcher();
  return { enqueued: true };
}

export async function enqueueAbcAnalysisForShop(tenant: TenantAuthority) {
  const auth = requireAuthority(tenant, "enqueueAbcAnalysisForShop");
  await createDurableJob({
    shopId: auth.shopId,
    jobType: "abc-analysis-shop",
    source: "abc_analysis",
    queueName: CRON_QUEUE,
    payloadSchemaVersion: "abc-analysis-shop-v1",
    sanitizedPayload: { shopId: auth.shopId },
    idempotencyKey: `abc-analysis-shop:${auth.shopId}:${auth.correlationId}`,
    correlationId: auth.correlationId,
    causationId: auth.causationId,
  });
  await kickDispatcher();
}

export function createWebhookWorker(
  processor: (job: Job<WebhookJobData>) => Promise<void>,
) {
  return new Worker<WebhookJobData>(WEBHOOK_QUEUE, processor, {
    connection: getConnection(),
    concurrency: WEBHOOK_WORKER_CONCURRENCY,
  });
}

export function createCronWorker(processor: (job: Job) => Promise<void>) {
  return new Worker(CRON_QUEUE, processor, {
    connection: getConnection(),
    concurrency: CRON_WORKER_CONCURRENCY,
  });
}

/**
 * Test-only: close shared BullMQ clients so a subsequent REDIS_URL change
 * (e.g. outage simulation) creates fresh connections.
 */
export async function resetQueueClientsForTests(): Promise<void> {
  if (webhookQueue) {
    await webhookQueue.close().catch(() => undefined);
    webhookQueue = null;
  }
  if (cronQueue) {
    await cronQueue.close().catch(() => undefined);
    cronQueue = null;
  }
  if (connection) {
    await connection.quit().catch(() => undefined);
    connection = null;
  }
}

/**
 * Schedule the weekly ABC control-plane tick. The tick enumerates canonical
 * Shops and enqueues per-shop envelope jobs — it must not query ShopSettings.
 */
export async function scheduleAbcAnalysisCron() {
  await getCronQueue().add(
    "abc-analysis",
    {},
    {
      repeat: { pattern: "0 2 * * 0" },
      jobId: "weekly-abc-analysis",
    },
  );
}
