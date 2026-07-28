import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";

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
  shop: string;
  payload: Record<string, unknown>;
};

let webhookQueue: Queue<WebhookJobData> | null = null;
let cronQueue: Queue | null = null;

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

/** Enqueue and return immediately so the webhook route can 200 within 50ms. */
export async function enqueueWebhook(data: WebhookJobData, webhookId?: string) {
  await getWebhookQueue().add(
    data.topic,
    data,
    // Shopify retries webhooks; the webhookId jobId dedupes redeliveries.
    webhookId ? { jobId: webhookId } : undefined,
  );
}

export async function enqueueCatalogSync(shop: string) {
  await getCronQueue().add("catalog-sync", { shop });
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
