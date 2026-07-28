import {
  createCronWorker,
  createWebhookWorker,
  scheduleAbcAnalysisCron,
} from "../queue.server";
import { processCronJob, processWebhookJob } from "./webhook-processor";

async function main() {
  console.log("Starting Stocky++ workers...");

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
  console.log("Workers running. Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error("Worker startup failed:", err);
  process.exit(1);
});
