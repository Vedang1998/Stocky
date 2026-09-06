import {
  createCronWorker,
  createWebhookWorker,
  scheduleAbcAnalysisCron,
} from "../queue.server";
import { processCronJob, processWebhookJob } from "./webhook-processor";
import { dispatchPendingJobs } from "../../sync/dispatcher.server";
import { assertCanonicalWriterCapacityAtStartup } from "./catalog-facts/capacity";

async function main() {
  console.log("Starting Stocky++ workers...");
  const capacity = await assertCanonicalWriterCapacityAtStartup();
  console.log(
    `Canonical writer capacity: batch=${capacity.effectiveCanonicalIdentitiesPerTransaction} concurrency=${capacity.configuredWorstCaseConcurrentCanonicalTransactions}`,
  );

  const webhookWorker = createWebhookWorker(processWebhookJob);
  const cronWorker = createCronWorker(processCronJob);

  webhookWorker.on("completed", (job) => {
    console.log(`Webhook job ${job.id} (${job.data.topic}) completed`);
  });

  webhookWorker.on("failed", (job, err) => {
    console.error(`Webhook job ${job?.id} failed:`, err.message);
  });

  cronWorker.on("completed", (job) => {
    console.log(`Cron job ${job.id} (${job.name}) completed`);
  });

  await scheduleAbcAnalysisCron();

  // Optional dispatcher loop — DB is source of truth; Redis delivery is secondary.
  const dispatcherIntervalMs = Number(
    process.env.STOCKY_DISPATCHER_INTERVAL_MS ?? "5000",
  );
  if (dispatcherIntervalMs > 0) {
    setInterval(() => {
      void dispatchPendingJobs().catch((err) => {
        console.warn("dispatcher loop error:", err);
      });
    }, dispatcherIntervalMs);
    console.log(`Dispatcher loop every ${dispatcherIntervalMs}ms`);
  }

  console.log("Workers running. Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error("Worker startup failed:", err);
  process.exit(1);
});

export { main };
