import type { Job } from "bullmq";
import { randomUUID } from "node:crypto";
import { unauthenticated } from "../../shopify.server";
import type { WebhookJobData } from "../queue.server";
import { enqueueAbcAnalysisForShop } from "../queue.server";
import { runAbcAnalysis } from "../../services/forecasting.server";
import { processBomSale } from "../../services/shopify-sync.server";
import {
  resolveTenantJobContext,
  TENANT_JOB_ENVELOPE_VERSION,
  type TenantJobContext,
} from "../../tenant/job-envelope.server";
import {
  resolveTenantJobContextV2,
  TENANT_JOB_ENVELOPE_V2_VERSION,
} from "../../sync/envelope-v2.server";
import {
  resolveTenantJobContextV3,
  TENANT_JOB_ENVELOPE_V3_VERSION,
} from "../../sync/envelope-v3.server";
import { applyWithApplicationReceipt } from "../../sync/application-receipt.server";
import { finalizeApplicationAfterRollback } from "../../sync/application-finalize.server";
import {
  APPLICATION_ALREADY_APPLIED,
  APPLICATION_DIGEST_CONFLICT,
  APPLICATION_OUTCOME_UNCERTAIN,
  resolveApplicationKey,
} from "../../sync/execution-strategy.server";
import { getControlPlanePrisma } from "../../sync/control-plane-db.server";
import {
  claimAttempt,
  completeAttemptFail,
  completeAttemptRetry,
  completeAttemptSuccess,
} from "../../sync/lifecycle.server";
import { SyncControlPlaneError } from "../../sync/errors";
import { planPerShopSchedulerJobs } from "../../tenant/scheduler.server";
import type { TenantDb } from "../../tenant/tenant-db.server";
import { TenantAuthorityError } from "../../tenant/errors";
import {
  applyCatalogFactWebhookRefetch,
  catalogRefetchApplicationDigest,
  isCatalogFactAtomicWebhookTopic,
  resolveCatalogWebhookIdentity,
} from "./catalog-facts/resource-refetch";
import {
  runCatalogFactsSyncStep,
  runInventoryStateReconcileStep,
} from "./catalog-facts/catalog-sync";
import { assertCanonicalWriterCapacityAtStartup } from "./catalog-facts/capacity";
import { signalBulkOperationContinuation } from "./catalog-facts/bulk-finish";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function handleOrderCreate(
  db: TenantDb,
  payload: Record<string, unknown>,
) {
  const shop = db.authority.myshopifyDomain;
  const order = payload as {
    id: number;
    line_items?: Array<{
      variant_id: number | null;
      quantity: number;
      price: string;
      location_id?: number | null;
    }>;
  };

  const today = startOfDay(new Date());
  const locationId = "default";

  for (const item of order.line_items ?? []) {
    if (!item.variant_id) continue;
    const variantGid = `gid://shopify/ProductVariant/${item.variant_id}`;

    await db.salesDailyAggregate.upsert({
      where: {
        shop_shopifyVariantId_locationId_date: {
          shop,
          shopifyVariantId: variantGid,
          locationId,
          date: today,
        },
      },
      create: {
        shop,
        shopifyVariantId: variantGid,
        locationId,
        date: today,
        unitsSold: item.quantity,
        revenue: parseFloat(item.price) * item.quantity,
      },
      update: {
        unitsSold: { increment: item.quantity },
        revenue: { increment: parseFloat(item.price) * item.quantity },
      },
    });

    const bomComponents = await processBomSale(db, variantGid, item.quantity);
    if (bomComponents.length > 0) {
      for (const comp of bomComponents) {
        await db.salesDailyAggregate.upsert({
          where: {
            shop_shopifyVariantId_locationId_date: {
              shop,
              shopifyVariantId: comp.componentVariantId,
              locationId,
              date: today,
            },
          },
          create: {
            shop,
            shopifyVariantId: comp.componentVariantId,
            locationId,
            date: today,
            unitsSold: comp.quantityToDecrement,
            revenue: 0,
          },
          update: {
            unitsSold: { increment: comp.quantityToDecrement },
          },
        });
      }
    }
  }
}

async function handleOrderCancelled(
  db: TenantDb,
  payload: Record<string, unknown>,
) {
  const shop = db.authority.myshopifyDomain;
  const order = payload as {
    line_items?: Array<{
      variant_id: number | null;
      quantity: number;
      price: string;
    }>;
  };

  const today = startOfDay(new Date());
  const locationId = "default";

  for (const item of order.line_items ?? []) {
    if (!item.variant_id) continue;
    const variantGid = `gid://shopify/ProductVariant/${item.variant_id}`;

    const existing = await db.salesDailyAggregate.findUnique({
      where: {
        shop_shopifyVariantId_locationId_date: {
          shop,
          shopifyVariantId: variantGid,
          locationId,
          date: today,
        },
      },
    });

    if (existing) {
      await db.salesDailyAggregate.update({
        where: { id: existing.id },
        data: {
          unitsSold: Math.max(0, existing.unitsSold - item.quantity),
          revenue: Math.max(
            0,
            Number(existing.revenue) - parseFloat(item.price) * item.quantity,
          ),
        },
      });
    }
  }
}

async function handleRefundCreate(
  db: TenantDb,
  payload: Record<string, unknown>,
) {
  const shop = db.authority.myshopifyDomain;
  const refund = payload as {
    refund_line_items?: Array<{
      line_item?: {
        variant_id: number | null;
        quantity: number;
        price: string;
      };
      quantity: number;
    }>;
  };

  const today = startOfDay(new Date());
  const locationId = "default";

  for (const item of refund.refund_line_items ?? []) {
    const lineItem = item.line_item;
    if (!lineItem?.variant_id) continue;
    const variantGid = `gid://shopify/ProductVariant/${lineItem.variant_id}`;
    const qty = item.quantity;

    const existing = await db.salesDailyAggregate.findUnique({
      where: {
        shop_shopifyVariantId_locationId_date: {
          shop,
          shopifyVariantId: variantGid,
          locationId,
          date: today,
        },
      },
    });

    if (existing) {
      await db.salesDailyAggregate.update({
        where: { id: existing.id },
        data: {
          unitsSold: Math.max(0, existing.unitsSold - qty),
          revenue: Math.max(
            0,
            Number(existing.revenue) - parseFloat(lineItem.price) * qty,
          ),
        },
      });
    }
  }
}

async function requireJobContext(
  rawTenant: unknown,
  options?: { payloadShop?: string; expectedJobNameOrTopic?: string },
): Promise<TenantJobContext> {
  return resolveTenantJobContext(rawTenant, options);
}

async function assertShopProcessingEnabled(shopId: string): Promise<void> {
  const shop = await getControlPlanePrisma().shop.findUnique({
    where: { id: shopId },
    select: { processingEnabled: true },
  });
  if (!shop?.processingEnabled) {
    throw new SyncControlPlaneError(
      "shop_processing_disabled",
      "Shop processing is disabled — worker fails closed",
    );
  }
}

async function runLegacyWebhookHandler(
  topic: string,
  db: TenantDb,
  payload: Record<string, unknown>,
): Promise<void> {
  switch (topic) {
    case "orders/create":
      await handleOrderCreate(db, payload);
      break;
    case "orders/cancelled":
      await handleOrderCancelled(db, payload);
      break;
    case "refunds/create":
      await handleRefundCreate(db, payload);
      break;
    default:
      throw new SyncControlPlaneError(
        "topic_unsupported",
        `Legacy webhook handler does not own topic: ${topic}`,
      );
  }
}

/**
 * Process a webhook BullMQ job with exactly-once merchant application (F-PR4-01)
 * and envelope/dispatch identity assertions (F-PR4-16).
 */
export async function processWebhookJob(job: Job<WebhookJobData>) {
  const { topic, payload, payloadShop, tenant: envelope } = job.data;
  const workerId = `webhook-worker:${process.pid}:${randomUUID().slice(0, 8)}`;

  if (!isRecord(envelope)) {
    throw new TenantAuthorityError(
      "missing_envelope",
      "Webhook job missing tenant envelope",
    );
  }

  if (envelope.schemaVersion === TENANT_JOB_ENVELOPE_V3_VERSION) {
    const durableJobId =
      job.data.durableJobId ??
      (typeof envelope.durableJobId === "string"
        ? envelope.durableJobId
        : null);
    if (!durableJobId) {
      throw new SyncControlPlaneError(
        "job_not_found",
        "v3 webhook job missing durableJobId",
      );
    }

    const durable = await getControlPlanePrisma().durableJob.findUnique({
      where: { id: durableJobId },
    });
    if (!durable) {
      throw new SyncControlPlaneError("job_not_found", "DurableJob not found");
    }

    await assertShopProcessingEnabled(durable.shopId);

    const bullmqJobId = String(job.id ?? job.data.queueJobId ?? "");
    const ctx = await resolveTenantJobContextV3(envelope, {
      payloadShop,
      expectedJobNameOrTopic: topic,
      expectedDurableJobId: durable.id,
      expectedPayloadDigest: durable.payloadDigest,
      expectedQueueJobId: job.data.queueJobId ?? bullmqJobId,
      expectedDispatchId: job.data.dispatchId,
      expectedDispatchSequence: job.data.dispatchSequence,
    });

    // F-PR4-16 — explicit identity assertions before merchant access.
    if (durable.shopId !== ctx.envelope.shopId) {
      throw new SyncControlPlaneError(
        "envelope_shop_mismatch",
        "durable.shopId !== envelope.shopId",
      );
    }
    if (durable.payloadDigest !== ctx.envelope.payloadDigest) {
      throw new SyncControlPlaneError(
        "payload_digest_mismatch",
        "durable.payloadDigest !== envelope.payloadDigest",
      );
    }
    if (durable.id !== ctx.envelope.durableJobId) {
      throw new SyncControlPlaneError(
        "envelope_durable_job_mismatch",
        "durable.id !== envelope.durableJobId",
      );
    }
    if (
      job.data.queueJobId &&
      job.data.queueJobId !== ctx.envelope.queueJobId
    ) {
      throw new SyncControlPlaneError(
        "envelope_queue_job_mismatch",
        "dispatch queueJobId does not match envelope",
      );
    }
    if (bullmqJobId && bullmqJobId !== ctx.envelope.queueJobId) {
      throw new SyncControlPlaneError(
        "envelope_queue_job_mismatch",
        "BullMQ job ID does not match envelope queueJobId",
      );
    }

    if (durable.state === "CANCELLED") {
      throw new SyncControlPlaneError(
        "illegal_job_transition",
        "DurableJob was cancelled",
      );
    }

    const { attempt } = await claimAttempt({
      durableJobId: durable.id,
      shopId: durable.shopId,
      workerId,
      jobDispatchId: job.data.dispatchId ?? ctx.envelope.dispatchId,
    });

    if (!durable.webhookDeliveryId) {
      await completeAttemptFail({
        durableJobId: durable.id,
        shopId: durable.shopId,
        attemptId: attempt.id,
        errorCode: APPLICATION_OUTCOME_UNCERTAIN,
        failureSummary:
          "Webhook job missing webhookDeliveryId for application key",
      });
      throw new SyncControlPlaneError(
        APPLICATION_OUTCOME_UNCERTAIN,
        "Webhook job missing webhookDeliveryId for application key",
      );
    }

    const applicationKey = resolveApplicationKey({
      jobType: durable.jobType,
      webhookDeliveryId: durable.webhookDeliveryId,
      idempotencyKey: durable.idempotencyKey,
    });
    let expectedApplicationDigest = durable.payloadDigest;

    try {
      const handlerPayload =
        (durable.sanitizedPayload as Record<string, unknown>) ?? payload;

      if (topic === "bulk_operations/finish") {
        const signaled = await signalBulkOperationContinuation({
          shopId: durable.shopId,
          payload: handlerPayload,
        });
        await completeAttemptSuccess({
          durableJobId: durable.id,
          shopId: durable.shopId,
          attemptId: attempt.id,
          workerId,
          resultMetadata: {
            controlStatus: signaled.signaled ? "signaled" : "unmatched",
          },
        });
        return;
      }

      if (isCatalogFactAtomicWebhookTopic(topic)) {
        const { admin } = await unauthenticated.admin(
          ctx.tenant.myshopifyDomain,
        );
        const writerConfig = await assertCanonicalWriterCapacityAtStartup();
        const identity = resolveCatalogWebhookIdentity(
          durable.shopId,
          topic,
          handlerPayload,
        );
        expectedApplicationDigest = catalogRefetchApplicationDigest({
          applyingDurableJobId: durable.id,
          topic,
          shopId: durable.shopId,
          resolvedIdentities: [identity],
        });
        const result = await applyCatalogFactWebhookRefetch({
          authority: ctx.tenant,
          admin,
          topic,
          payload: handlerPayload,
          durableJobId: durable.id,
          rootDurableJobId: durable.causationId ?? durable.id,
          attemptId: attempt.id,
          correlationId: durable.correlationId,
          signalDeliveryId: durable.webhookDeliveryId,
          signalReceivedAt: durable.createdAt,
          applicationKey,
          applicationPayloadDigest: expectedApplicationDigest,
          leaseDurationMs: 60_000,
          canonicalBatchSize:
            writerConfig.effectiveCanonicalIdentitiesPerTransaction,
          configuredWorstCaseConcurrentCanonicalTransactions:
            writerConfig.configuredWorstCaseConcurrentCanonicalTransactions,
        });
        await completeAttemptSuccess({
          durableJobId: durable.id,
          shopId: durable.shopId,
          attemptId: attempt.id,
          workerId,
          resultMetadata: result,
        });
        return;
      }

      // Atomic merchant application: all writes + receipt in one tenant tx.
      const applyResult = await ctx.db.$transaction(async (tx) => {
        return applyWithApplicationReceipt(
          tx,
          {
            applicationKey,
            sourceJobType: durable.jobType,
            rootDurableJobId: durable.causationId ?? durable.id,
            applyingDurableJobId: durable.id,
            payloadDigest: durable.payloadDigest,
          },
          async (tdb) => {
            await runLegacyWebhookHandler(topic, tdb, handlerPayload);
            return { applied: true as const };
          },
        );
      });

      await completeAttemptSuccess({
        durableJobId: durable.id,
        shopId: durable.shopId,
        attemptId: attempt.id,
        workerId,
        resultMetadata: { applicationStatus: applyResult.status },
      });
    } catch (err) {
      if (
        err instanceof SyncControlPlaneError &&
        (err.code === APPLICATION_ALREADY_APPLIED ||
          err.code === APPLICATION_DIGEST_CONFLICT ||
          err.code === APPLICATION_OUTCOME_UNCERTAIN)
      ) {
        // NEW-PR4-SC01: never finalize SUCCEEDED from the error code alone.
        // Merchant tx has rolled back; verify receipt in a new tenant transaction.
        await finalizeApplicationAfterRollback({
          db: ctx.db,
          applicationKey,
          expectedPayloadDigest: expectedApplicationDigest,
          durableJobId: durable.id,
          shopId: durable.shopId,
          attemptId: attempt.id,
          workerId,
        });
        return;
      }

      const message = err instanceof Error ? err.message : String(err);
      const retryable =
        !(err instanceof SyncControlPlaneError) &&
        !(err instanceof TenantAuthorityError);
      if (retryable) {
        await completeAttemptRetry({
          durableJobId: durable.id,
          shopId: durable.shopId,
          attemptId: attempt.id,
          workerId,
          errorCode: "processor_error",
          failureSummary: message,
        });
      } else {
        await completeAttemptFail({
          durableJobId: durable.id,
          shopId: durable.shopId,
          attemptId: attempt.id,
          errorCode:
            err instanceof SyncControlPlaneError
              ? err.code
              : "non_retryable_processor_error",
          failureSummary: message,
        });
      }
      throw err;
    }
    return;
  }

  if (envelope.schemaVersion === TENANT_JOB_ENVELOPE_V2_VERSION) {
    // NEW-PR4-C04: v2 may execute only with durable identity sufficient for
    // the same application receipt as v3. Missing webhookDeliveryId → fail closed
    // on the control plane BEFORE opening a merchant-domain tenant transaction.
    const durableJobId =
      job.data.durableJobId ??
      (typeof envelope.durableJobId === "string"
        ? envelope.durableJobId
        : null);
    if (!durableJobId) {
      throw new SyncControlPlaneError(
        "job_not_found",
        "v2 webhook job missing durableJobId",
      );
    }

    const durable = await getControlPlanePrisma().durableJob.findUnique({
      where: { id: durableJobId },
    });
    if (!durable) {
      throw new SyncControlPlaneError("job_not_found", "DurableJob not found");
    }

    await assertShopProcessingEnabled(durable.shopId);

    if (durable.state === "CANCELLED") {
      throw new SyncControlPlaneError(
        "illegal_job_transition",
        "DurableJob was cancelled",
      );
    }

    // Fail closed without resolveTenantJobContextV2 / createTenantDb when the
    // durable webhook identity required for SyncApplicationReceipt is absent.
    if (!durable.webhookDeliveryId) {
      const { attempt } = await claimAttempt({
        durableJobId: durable.id,
        shopId: durable.shopId,
        workerId,
      });
      await completeAttemptFail({
        durableJobId: durable.id,
        shopId: durable.shopId,
        attemptId: attempt.id,
        errorCode: APPLICATION_OUTCOME_UNCERTAIN,
        failureSummary:
          "v2 webhook missing webhookDeliveryId — refuse merchant write outside receipt",
      });
      throw new SyncControlPlaneError(
        APPLICATION_OUTCOME_UNCERTAIN,
        "v2 webhook missing webhookDeliveryId",
      );
    }

    const ctx = await resolveTenantJobContextV2(envelope, {
      payloadShop,
      expectedJobNameOrTopic: topic,
      expectedDurableJobId: durable.id,
      expectedPayloadDigest: durable.payloadDigest,
    });

    if (durable.shopId !== ctx.envelope.shopId) {
      throw new SyncControlPlaneError(
        "envelope_shop_mismatch",
        "durable.shopId !== envelope.shopId",
      );
    }

    const { attempt } = await claimAttempt({
      durableJobId: durable.id,
      shopId: durable.shopId,
      workerId,
    });

    const applicationKey = resolveApplicationKey({
      jobType: durable.jobType,
      webhookDeliveryId: durable.webhookDeliveryId,
      idempotencyKey: durable.idempotencyKey,
    });

    try {
      const handlerPayload =
        (durable.sanitizedPayload as Record<string, unknown>) ?? payload;
      await ctx.db.$transaction(async (tx) => {
        await applyWithApplicationReceipt(
          tx,
          {
            applicationKey,
            sourceJobType: durable.jobType,
            rootDurableJobId: durable.causationId ?? durable.id,
            applyingDurableJobId: durable.id,
            payloadDigest: durable.payloadDigest,
          },
          async (tdb) => {
            await runLegacyWebhookHandler(topic, tdb, handlerPayload);
            return { applied: true as const };
          },
        );
      });
      await completeAttemptSuccess({
        durableJobId: durable.id,
        shopId: durable.shopId,
        attemptId: attempt.id,
        workerId,
        resultMetadata: { applicationStatus: "applied" },
      });
    } catch (err) {
      if (
        err instanceof SyncControlPlaneError &&
        (err.code === APPLICATION_ALREADY_APPLIED ||
          err.code === APPLICATION_DIGEST_CONFLICT ||
          err.code === APPLICATION_OUTCOME_UNCERTAIN)
      ) {
        // NEW-PR4-SC01: align v2 with v3 — verify receipt after rollback.
        await finalizeApplicationAfterRollback({
          db: ctx.db,
          applicationKey,
          expectedPayloadDigest: durable.payloadDigest,
          durableJobId: durable.id,
          shopId: durable.shopId,
          attemptId: attempt.id,
          workerId,
        });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      const retryable =
        !(err instanceof SyncControlPlaneError) &&
        !(err instanceof TenantAuthorityError);
      if (retryable) {
        await completeAttemptRetry({
          durableJobId: durable.id,
          shopId: durable.shopId,
          attemptId: attempt.id,
          workerId,
          errorCode: "processor_error",
          failureSummary: message,
        });
      } else {
        await completeAttemptFail({
          durableJobId: durable.id,
          shopId: durable.shopId,
          attemptId: attempt.id,
          errorCode:
            err instanceof SyncControlPlaneError
              ? err.code
              : "non_retryable_processor_error",
          failureSummary: message,
        });
      }
      throw err;
    }
    return;
  }

  // NEW-PR4-C04: v1 must not call merchant-domain handlers. Fail closed.
  const v1Schema = (envelope as { schemaVersion?: string }).schemaVersion;
  if (v1Schema === TENANT_JOB_ENVELOPE_VERSION) {
    throw new SyncControlPlaneError(
      "legacy_envelope_unsupported",
      "tenant-job-envelope-v1 cannot apply merchant writes; drain or migrate queues before enabling processing",
    );
  }

  throw new TenantAuthorityError(
    "unknown_envelope_version",
    `Unsupported envelope version: ${String(v1Schema)}`,
  );
}

export async function processCronJob(job: Job) {
  const workerId = `cron-worker:${process.pid}:${randomUUID().slice(0, 8)}`;

  if (job.name === "abc-analysis") {
    const planned = await planPerShopSchedulerJobs();
    for (const item of planned) {
      await enqueueAbcAnalysisForShop(item.tenant);
    }
    return;
  }

  const data = job.data as {
    tenant?: unknown;
    durableJobId?: string;
    dispatchId?: string;
    dispatchSequence?: number;
    queueJobId?: string;
  };

  if (
    job.name === "abc-analysis-shop" ||
    job.name === "catalog-sync" ||
    job.name === "inventory-state-reconcile"
  ) {
    if (!isRecord(data.tenant)) {
      throw new TenantAuthorityError(
        "missing_envelope",
        "Cron job missing tenant envelope",
      );
    }

    const isV3 = data.tenant.schemaVersion === TENANT_JOB_ENVELOPE_V3_VERSION;
    const isV2 = data.tenant.schemaVersion === TENANT_JOB_ENVELOPE_V2_VERSION;

    if (isV3 || isV2) {
      const durableJobId =
        data.durableJobId ??
        (typeof data.tenant.durableJobId === "string"
          ? data.tenant.durableJobId
          : null);
      if (!durableJobId) {
        throw new SyncControlPlaneError(
          "job_not_found",
          "cron job missing durableJobId",
        );
      }
      const durable = await getControlPlanePrisma().durableJob.findUnique({
        where: { id: durableJobId },
      });
      if (!durable) {
        throw new SyncControlPlaneError(
          "job_not_found",
          "DurableJob not found",
        );
      }
      await assertShopProcessingEnabled(durable.shopId);

      const ctx = isV3
        ? await resolveTenantJobContextV3(data.tenant, {
            expectedJobNameOrTopic: job.name,
            expectedDurableJobId: durable.id,
            expectedPayloadDigest: durable.payloadDigest,
            expectedQueueJobId: data.queueJobId ?? String(job.id ?? ""),
            expectedDispatchId: data.dispatchId,
            expectedDispatchSequence: data.dispatchSequence,
          })
        : await resolveTenantJobContextV2(data.tenant, {
            expectedJobNameOrTopic: job.name,
            expectedDurableJobId: durable.id,
            expectedPayloadDigest: durable.payloadDigest,
          });

      if (durable.shopId !== ctx.envelope.shopId) {
        throw new SyncControlPlaneError(
          "envelope_shop_mismatch",
          "durable.shopId !== envelope.shopId",
        );
      }

      const { attempt, job: claimedJob } = await claimAttempt({
        durableJobId: durable.id,
        shopId: durable.shopId,
        workerId,
        jobDispatchId: data.dispatchId,
      });

      try {
        if (job.name === "abc-analysis-shop") {
          await runAbcAnalysis(ctx.db, "REVENUE");
          await runAbcAnalysis(ctx.db, "VOLUME");
          await completeAttemptSuccess({
            durableJobId: durable.id,
            shopId: durable.shopId,
            attemptId: attempt.id,
            workerId,
          });
          return;
        }

        if (
          job.name === "catalog-sync" &&
          durable.payloadSchemaVersion !== "catalog-facts-v1"
        ) {
          await completeAttemptFail({
            durableJobId: durable.id,
            shopId: durable.shopId,
            attemptId: attempt.id,
            errorCode: "LEGACY_CATALOG_SYNC_V1_DISABLED",
            failureSummary:
              "catalog-sync-v1 is disabled after the canonical PR5-F3 cutover",
          });
          return;
        }

        if (
          job.name !== "catalog-sync" &&
          job.name !== "inventory-state-reconcile"
        ) {
          throw new SyncControlPlaneError(
            "job_type_unsupported",
            `Unsupported canonical cron job ${job.name}`,
          );
        }

        const { admin } = await unauthenticated.admin(
          ctx.tenant.myshopifyDomain,
        );
        const writerConfig = await assertCanonicalWriterCapacityAtStartup();
        const result =
          job.name === "catalog-sync"
            ? await runCatalogFactsSyncStep({
                authority: ctx.tenant,
                admin,
                durableJobId: durable.id,
                correlationId: durable.correlationId,
                durableAttemptCount: claimedJob.attemptCount,
                canonicalBatchSize:
                  writerConfig.effectiveCanonicalIdentitiesPerTransaction,
                canonicalConcurrency:
                  writerConfig.configuredWorstCaseConcurrentCanonicalTransactions,
              })
            : await runInventoryStateReconcileStep({
                authority: ctx.tenant,
                admin,
                durableJobId: durable.id,
                correlationId: durable.correlationId,
                canonicalBatchSize:
                  writerConfig.effectiveCanonicalIdentitiesPerTransaction,
                canonicalConcurrency:
                  writerConfig.configuredWorstCaseConcurrentCanonicalTransactions,
              });

        if (result.status === "SUCCEEDED") {
          await completeAttemptSuccess({
            durableJobId: durable.id,
            shopId: durable.shopId,
            attemptId: attempt.id,
            workerId,
          });
        } else {
          await completeAttemptRetry({
            durableJobId: durable.id,
            shopId: durable.shopId,
            attemptId: attempt.id,
            workerId,
            errorCode:
              result.status === "PARTIAL_FAILURE"
                ? "catalog_domain_partial_failure"
                : "catalog_continuation",
            failureSummary: result.reason,
            backoffMs: result.status === "CONTINUE" ? result.backoffMs : 5_000,
            retryClassification: result.status.toLowerCase(),
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await completeAttemptRetry({
          durableJobId: durable.id,
          shopId: durable.shopId,
          attemptId: attempt.id,
          workerId,
          errorCode: "processor_error",
          failureSummary: message,
        });
        throw err;
      }
      return;
    }

    const { db, tenant } = await requireJobContext(data.tenant, {
      expectedJobNameOrTopic: job.name,
    });
    await assertShopProcessingEnabled(tenant.shopId);

    if (job.name === "abc-analysis-shop") {
      await runAbcAnalysis(db, "REVENUE");
      await runAbcAnalysis(db, "VOLUME");
      return;
    }
    throw new SyncControlPlaneError(
      "legacy_envelope_unsupported",
      `${job.name} requires tenant-job-envelope-v3 after the PR5-F3 cutover`,
    );
  }
}
