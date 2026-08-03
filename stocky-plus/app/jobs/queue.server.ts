import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import type { TenantAuthority } from "../tenant/authority.server";
import { isTenantAuthority } from "../tenant/authority.server";
import {
  createTenantJobEnvelope,
  type TenantJobEnvelopeV1,
  type TenantJobSource,
} from "../tenant/job-envelope.server";
import { TenantAuthorityError } from "../tenant/errors";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

let connection: IORedis | null = null;

function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  }
  return connection;
}

export const WEBHOOK_QUEUE = "stocky-webhooks";
export const CRON_QUEUE = "stocky-cron";

export type WebhookJobData = {
  topic: string;
  /** Informational only — never authority. */
  payloadShop: string;
  payload: Record<string, unknown>;
  tenant: TenantJobEnvelopeV1;
};

export type CatalogSyncJobData = {
  tenant: TenantJobEnvelopeV1;
};

export type AbcShopJobData = {
  tenant: TenantJobEnvelopeV1;
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

function webhookSource(topic: string): TenantJobSource {
  const source = `webhook:${topic}`;
  return source as TenantJobSource;
}

/** Enqueue and return immediately so the webhook route can 200 within 50ms. */
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
  const envelope = createTenantJobEnvelope(tenant, webhookSource(data.topic));

  await getWebhookQueue().add(
    data.topic,
    {
      topic: data.topic,
      payloadShop: data.payloadShop,
      payload: data.payload,
      tenant: envelope,
    },
    webhookId ? { jobId: webhookId } : undefined,
  );
}

export async function enqueueCatalogSync(tenant: TenantAuthority) {
  const auth = requireAuthority(tenant, "enqueueCatalogSync");
  const envelope = createTenantJobEnvelope(auth, "catalog_sync");

  await getCronQueue().add("catalog-sync", {
    tenant: envelope,
  } satisfies CatalogSyncJobData);
}

/** Dedicated producer for afterAuth catalog sync (approved source). */
export async function enqueueAfterAuthCatalogSync(tenant: TenantAuthority) {
  const auth = requireAuthority(tenant, "enqueueAfterAuthCatalogSync");
  const envelope = createTenantJobEnvelope(auth, "after_auth_catalog_sync");
  await getCronQueue().add("catalog-sync", {
    tenant: envelope,
  } satisfies CatalogSyncJobData);
}

export async function enqueueAbcAnalysisForShop(tenant: TenantAuthority) {
  const auth = requireAuthority(tenant, "enqueueAbcAnalysisForShop");
  const envelope = createTenantJobEnvelope(auth, "abc_analysis");

  await getCronQueue().add("abc-analysis-shop", {
    tenant: envelope,
  } satisfies AbcShopJobData);
}

export function createWebhookWorker(
  processor: (job: Job<WebhookJobData>) => Promise<void>,
) {
  return new Worker<WebhookJobData>(WEBHOOK_QUEUE, processor, {
    connection: getConnection(),
    concurrency: 5,
  });
}

export function createCronWorker(processor: (job: Job) => Promise<void>) {
  return new Worker(CRON_QUEUE, processor, {
    connection: getConnection(),
    concurrency: 1,
  });
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
