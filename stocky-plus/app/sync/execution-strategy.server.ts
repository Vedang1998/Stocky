/**
 * Job execution strategy matrix (F-PR4-01).
 * No job may default silently to a retryable mode without an explicit strategy.
 */
import type { JobExecutionStrategy } from "@prisma/client";

export type ExecutionStrategy = JobExecutionStrategy;

/** Stable application-outcome codes for dead-letter / quarantine. */
export const APPLICATION_OUTCOME_UNCERTAIN = "application_outcome_uncertain" as const;
export const APPLICATION_DIGEST_CONFLICT = "application_digest_conflict" as const;
export const APPLICATION_ALREADY_APPLIED = "application_already_applied" as const;

const WEBHOOK_ATOMIC_TOPICS = new Set([
  "orders/create",
  "orders/cancelled",
  "refunds/create",
  "inventory_levels/update",
]);

/**
 * Declare execution strategy for every known job type.
 * Unknown job types fail closed as NO_AUTOMATIC_RETRY.
 */
export function executionStrategyForJobType(jobType: string): ExecutionStrategy {
  if (jobType.startsWith("webhook:")) {
    const topic = jobType.slice("webhook:".length);
    if (WEBHOOK_ATOMIC_TOPICS.has(topic)) {
      return "ATOMIC_APPLICATION_RECEIPT";
    }
    // Uninstall and other control webhooks have no merchant-domain effect.
    if (topic === "app/uninstalled") {
      return "CONTROL_ONLY";
    }
    return "NO_AUTOMATIC_RETRY";
  }

  switch (jobType) {
    case "catalog-sync":
      // Rebuildable: startCatalogSync upserts cache rows to converge.
      return "REBUILDABLE_IDEMPOTENT";
    case "abc-analysis-shop":
      // Rebuildable: ABC recompute overwrites classification rows.
      return "REBUILDABLE_IDEMPOTENT";
    case "abc-analysis":
      return "CONTROL_ONLY";
    default:
      return "NO_AUTOMATIC_RETRY";
  }
}

/**
 * Application key for webhook jobs — stable across replay.
 * Derived from the durable webhook delivery id, never the replay job id.
 */
export function webhookApplicationKey(webhookDeliveryId: string): string {
  return `webhook-delivery:${webhookDeliveryId}`;
}

/**
 * Application key for non-webhook jobs — root logical idempotency identity.
 */
export function logicalApplicationKey(idempotencyKey: string): string {
  return `logical:${idempotencyKey}`;
}

export function resolveApplicationKey(input: {
  jobType: string;
  webhookDeliveryId: string | null | undefined;
  idempotencyKey: string;
  /** When replaying, pass the original job's webhook delivery / root key. */
  rootApplicationKey?: string | null;
}): string {
  if (input.rootApplicationKey) {
    return input.rootApplicationKey;
  }
  if (input.webhookDeliveryId) {
    return webhookApplicationKey(input.webhookDeliveryId);
  }
  if (input.jobType.startsWith("webhook:")) {
    // Webhook without delivery id cannot safely claim idempotency.
    throw new Error("webhook_application_key_requires_delivery");
  }
  return logicalApplicationKey(input.idempotencyKey);
}

/**
 * Soft-fail variant for recovery paths (NEW-PR4-C02).
 * Returns null when a webhook lacks durable delivery identity.
 */
export function tryResolveApplicationKey(input: {
  jobType: string;
  webhookDeliveryId: string | null | undefined;
  idempotencyKey: string;
  rootApplicationKey?: string | null;
}): string | null {
  try {
    return resolveApplicationKey(input);
  } catch (err) {
    if (
      err instanceof Error &&
      err.message === "webhook_application_key_requires_delivery"
    ) {
      return null;
    }
    throw err;
  }
}
