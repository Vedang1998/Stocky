/**
 * One source of truth for BullMQ worker concurrency and the PR5 canonical
 * writer lock-capacity envelope.
 */
export const WEBHOOK_WORKER_CONCURRENCY = 5;
export const CRON_WORKER_CONCURRENCY = 1;

export const CANONICAL_WRITER_QUEUE_CONCURRENCY_SUM =
  WEBHOOK_WORKER_CONCURRENCY + CRON_WORKER_CONCURRENCY;
