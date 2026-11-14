/**
 * Removes a shop's jobs from the BullMQ queues. Job data carries Shopify
 * webhook payloads, so it is part of what a shop erasure must remove.
 */
import type { Queue } from "bullmq";
import { getCronQueue, getWebhookQueue } from "../jobs/queue.server";

const JOB_STATES = [
  "waiting",
  "delayed",
  "prioritized",
  "paused",
  "waiting-children",
  "completed",
  "failed",
] as const;

const PAGE_SIZE = 500;

function jobShopId(data: unknown): string | null {
  const tenant =
    data !== null && typeof data === "object"
      ? (data as { tenant?: unknown }).tenant
      : null;
  const shopId =
    tenant !== null && typeof tenant === "object"
      ? (tenant as { shopId?: unknown }).shopId
      : null;
  return typeof shopId === "string" ? shopId : null;
}

async function purgeQueue(queue: Queue, shopId: string): Promise<number> {
  let removed = 0;
  for (const state of JOB_STATES) {
    let offset = 0;
    for (;;) {
      const jobs = await queue.getJobs([state], offset, offset + PAGE_SIZE - 1);
      if (jobs.length === 0) break;
      let kept = 0;
      for (const job of jobs) {
        if (!job || jobShopId(job.data) !== shopId) {
          kept += 1;
          continue;
        }
        try {
          await job.remove();
          removed += 1;
        } catch {
          // Locked by a worker that is running it. The job fails closed on
          // the disabled shop and is picked up by the next purge.
          kept += 1;
        }
      }
      // Removed jobs shift the rest of the list down.
      offset += kept;
      if (jobs.length < PAGE_SIZE) break;
    }
  }
  return removed;
}

export async function purgeQueuedJobsForShop(shopId: string): Promise<number> {
  const removed = await Promise.all([
    purgeQueue(getWebhookQueue(), shopId),
    purgeQueue(getCronQueue(), shopId),
  ]);
  return removed[0] + removed[1];
}
