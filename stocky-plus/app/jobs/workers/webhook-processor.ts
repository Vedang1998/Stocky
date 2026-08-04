import type { Job } from "bullmq";
import { randomUUID } from "node:crypto";
import { unauthenticated } from "../../shopify.server";
import type { WebhookJobData } from "../queue.server";
import { enqueueAbcAnalysisForShop } from "../queue.server";
import {
  computeForecast,
  runAbcAnalysis,
} from "../../services/forecasting.server";
import {
  processBomSale,
  startCatalogSync,
} from "../../services/shopify-sync.server";
import {
  resolveTenantJobContext,
  TENANT_JOB_ENVELOPE_VERSION,
  type TenantJobContext,
} from "../../tenant/job-envelope.server";
import {
  parseTenantJobEnvelopeV2,
  resolveTenantJobContextV2,
  TENANT_JOB_ENVELOPE_V2_VERSION,
} from "../../sync/envelope-v2.server";
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
      line_item?: { variant_id: number | null; quantity: number; price: string };
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

async function handleInventoryUpdate(
  db: TenantDb,
  payload: Record<string, unknown>,
) {
  const shop = db.authority.myshopifyDomain;
  const inv = payload as {
    inventory_item_id: number;
    location_id: number;
    available: number | null;
  };

  const variantGid = await resolveVariantFromInventoryItem(
    db,
    inv.inventory_item_id,
  );
  if (!variantGid) return;

  const locationGid = `gid://shopify/Location/${inv.location_id}`;
  const today = startOfDay(new Date());

  await db.inventorySnapshot.upsert({
    where: {
      shop_shopifyVariantId_locationId_snapshotDate: {
        shop,
        shopifyVariantId: variantGid,
        locationId: locationGid,
        snapshotDate: today,
      },
    },
    create: {
      shop,
      shopifyVariantId: variantGid,
      locationId: locationGid,
      snapshotDate: today,
      quantityAvailable: inv.available ?? 0,
    },
    update: {
      quantityAvailable: inv.available ?? 0,
    },
  });

  const forecast = await computeForecast(db, {
    variantId: variantGid,
    locationId: locationGid,
  });

  const abc = await db.variantAbcClass.findFirst({
    where: { shopifyVariantId: variantGid },
  });

  if (abc?.abcClass === "A" && forecast.onHand < forecast.reorderPoint) {
    await db.lowStockAlert.create({
      data: {
        shop,
        shopifyVariantId: variantGid,
        locationId: locationGid,
        reorderPoint: forecast.reorderPoint,
        currentStock: forecast.onHand,
      },
    });
  }
}

async function resolveVariantFromInventoryItem(
  db: TenantDb,
  inventoryItemId: number,
): Promise<string | null> {
  const cache = await db.shopifyVariantCache.findFirst({
    where: {
      inventoryItemId: `gid://shopify/InventoryItem/${inventoryItemId}`,
    },
  });
  return cache?.shopifyVariantId ?? null;
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
    case "inventory_levels/update":
      await handleInventoryUpdate(db, payload);
      break;
    default:
      console.warn(`Unhandled webhook topic: ${topic}`);
  }
}

/**
 * Process a webhook BullMQ job.
 * v2: verify envelope against durable job, lifecycle, then legacy handlers.
 * v1: compatibility path for in-flight pre-cutover jobs only.
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

  if (envelope.schemaVersion === TENANT_JOB_ENVELOPE_V2_VERSION) {
    const durableJobId =
      job.data.durableJobId ??
      (typeof envelope.durableJobId === "string" ? envelope.durableJobId : null);
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

    const ctx = await resolveTenantJobContextV2(envelope, {
      payloadShop,
      expectedJobNameOrTopic: topic,
      expectedDurableJobId: durable.id,
      expectedPayloadDigest: durable.payloadDigest,
    });

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
    });

    try {
      const handlerPayload =
        (durable.sanitizedPayload as Record<string, unknown>) ?? payload;
      await runLegacyWebhookHandler(topic, ctx.db, handlerPayload);
      await completeAttemptSuccess({
        durableJobId: durable.id,
        shopId: durable.shopId,
        attemptId: attempt.id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const retryable =
        !(err instanceof SyncControlPlaneError) &&
        !(err instanceof TenantAuthorityError);
      if (retryable) {
        await completeAttemptRetry({
          durableJobId: durable.id,
          shopId: durable.shopId,
          attemptId: attempt.id,
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
          deadLetter: true,
        });
      }
      throw err;
    }
    return;
  }

  // v1 compatibility window
  if (envelope.schemaVersion !== TENANT_JOB_ENVELOPE_VERSION) {
    // Attempt parse to surface a clear error; also accepts if somehow already parsed.
    try {
      parseTenantJobEnvelopeV2(envelope);
    } catch {
      /* fall through */
    }
    throw new TenantAuthorityError(
      "unknown_envelope_version",
      `Unsupported envelope version: ${String(envelope.schemaVersion)}`,
    );
  }

  const { db, tenant } = await requireJobContext(envelope, {
    payloadShop,
    expectedJobNameOrTopic: topic,
  });
  await assertShopProcessingEnabled(tenant.shopId);
  await runLegacyWebhookHandler(topic, db, payload);
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
  };

  if (job.name === "abc-analysis-shop" || job.name === "catalog-sync") {
    if (!isRecord(data.tenant)) {
      throw new TenantAuthorityError(
        "missing_envelope",
        "Cron job missing tenant envelope",
      );
    }

    if (data.tenant.schemaVersion === TENANT_JOB_ENVELOPE_V2_VERSION) {
      const durableJobId =
        data.durableJobId ??
        (typeof data.tenant.durableJobId === "string"
          ? data.tenant.durableJobId
          : null);
      if (!durableJobId) {
        throw new SyncControlPlaneError(
          "job_not_found",
          "v2 cron job missing durableJobId",
        );
      }
      const durable = await getControlPlanePrisma().durableJob.findUnique({
        where: { id: durableJobId },
      });
      if (!durable) {
        throw new SyncControlPlaneError("job_not_found", "DurableJob not found");
      }
      await assertShopProcessingEnabled(durable.shopId);

      const ctx = await resolveTenantJobContextV2(data.tenant, {
        expectedJobNameOrTopic: job.name,
        expectedDurableJobId: durable.id,
        expectedPayloadDigest: durable.payloadDigest,
      });

      const { attempt } = await claimAttempt({
        durableJobId: durable.id,
        shopId: durable.shopId,
        workerId,
      });

      try {
        if (job.name === "abc-analysis-shop") {
          await runAbcAnalysis(ctx.db, "REVENUE");
          await runAbcAnalysis(ctx.db, "VOLUME");
        } else {
          const { admin } = await unauthenticated.admin(
            ctx.tenant.myshopifyDomain,
          );
          const count = await startCatalogSync(ctx.db, admin);
          console.log(
            `Catalog sync for ${ctx.tenant.myshopifyDomain}: ${count} variants cached`,
          );
        }
        await completeAttemptSuccess({
          durableJobId: durable.id,
          shopId: durable.shopId,
          attemptId: attempt.id,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await completeAttemptRetry({
          durableJobId: durable.id,
          shopId: durable.shopId,
          attemptId: attempt.id,
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

    const { admin } = await unauthenticated.admin(tenant.myshopifyDomain);
    const count = await startCatalogSync(db, admin);
    console.log(
      `Catalog sync for ${tenant.myshopifyDomain}: ${count} variants cached`,
    );
  }
}
