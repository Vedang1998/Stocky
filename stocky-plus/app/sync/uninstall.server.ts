/**
 * App uninstall — disable shop processing, cancel ALL non-terminal jobs,
 * durable delivery, then session deletion (F-PR4-03).
 *
 * Uninstall visibility (F-PR4-17):
 * - Statements already completed before the uninstall commit cannot be undone
 *   by the processing gate.
 * - Subsequent statements under READ COMMITTED see the disabled Shop
 *   (stocky_shop_processing_enabled returns false).
 * - Atomic merchant application transactions must roll back when a later
 *   statement is denied by the processing gate.
 * - Long-running transactions and external side effects remain outside this
 *   guarantee unless explicitly prevented. Do not overclaim instantaneous
 *   cancellation of an already completed statement.
 */
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { deleteSessionsForShop } from "../tenant/bootstrap.server";
import { normalizeShopDomain } from "../tenant/shop-domain";
import { resolveApiVersionForPersistence } from "./api-version.server";
import { getControlPlanePrisma } from "./control-plane-db.server";
import { digestCanonicalJson } from "./digest.server";
import { SyncControlPlaneError } from "./errors";
import { sanitizeWebhookPayload } from "./sanitize.server";
import {
  CANCELLABLE_DURABLE_JOB_STATES,
  assertCancellableTransitionCoverage,
  assertTransition,
} from "./state-machine.server";

export type ProcessUninstallInput = {
  verifiedShop: string;
  webhookId: string | null | undefined;
  apiVersion: string | null | undefined;
  payload?: unknown;
};

export type ProcessUninstallResult = {
  shopId: string;
  cancelledJobs: number;
  closedAttempts: number;
  sessionsDeleted: number;
  deliveryId: string;
  duplicate: boolean;
};

/**
 * Durable uninstall sequence. Always disables processing even when jobs are
 * DISPATCH_LEASED or RUNNING. Session deletion occurs only after commit.
 */
export async function processUninstall(
  input: ProcessUninstallInput,
): Promise<ProcessUninstallResult> {
  assertCancellableTransitionCoverage();

  const apiVersion = resolveApiVersionForPersistence(input.apiVersion);
  const norm = normalizeShopDomain(input.verifiedShop);
  if (!norm.ok) {
    throw new SyncControlPlaneError(
      "shop_missing",
      `Invalid verified shop domain: ${norm.reason}`,
    );
  }

  const prisma = getControlPlanePrisma();
  const correlationId = randomUUID();
  const now = new Date();

  let shop = await prisma.shop.findUnique({
    where: { myshopifyDomain: norm.normalized },
    select: {
      id: true,
      myshopifyDomain: true,
      processingEnabled: true,
      processingDisabledAt: true,
      uninstalledAt: true,
    },
  });
  if (!shop) {
    shop = await prisma.shop.create({
      data: { myshopifyDomain: norm.normalized },
      select: {
        id: true,
        myshopifyDomain: true,
        processingEnabled: true,
        processingDisabledAt: true,
        uninstalledAt: true,
      },
    });
  }

  const sanitized = sanitizeWebhookPayload(
    "app/uninstalled",
    input.payload ?? { myshopify_domain: shop.myshopifyDomain },
  );
  const payloadDigest = digestCanonicalJson(sanitized.projection);
  const webhookId =
    input.webhookId && input.webhookId.trim() !== ""
      ? input.webhookId.trim()
      : null;

  const result = await prisma.$transaction(async (tx) => {
    const existing = webhookId
      ? await tx.webhookDelivery.findFirst({
          where: { shopId: shop!.id, shopifyWebhookId: webhookId },
        })
      : null;

    if (existing) {
      await tx.webhookDelivery.update({
        where: { id: existing.id },
        data: {
          duplicateCount: { increment: 1 },
          lastSeenAt: now,
        },
      });
      await tx.shop.update({
        where: { id: shop!.id },
        data: {
          processingEnabled: false,
          processingDisabledReason: "UNINSTALLED",
          processingDisabledAt: shop!.processingDisabledAt ?? now,
          uninstalledAt: shop!.uninstalledAt ?? now,
        },
      });
      // Still cancel any remaining non-terminal jobs (idempotent).
      const cancelled = await cancelAllCancellable(tx, shop!.id, now);
      return {
        deliveryId: existing.id,
        duplicate: true,
        cancelledJobs: cancelled.cancelledJobs,
        closedAttempts: cancelled.closedAttempts,
      };
    }

    const delivery = await tx.webhookDelivery.create({
      data: {
        shopId: shop!.id,
        shopifyWebhookId: webhookId,
        topic: "app/uninstalled",
        apiVersionReceived: apiVersion,
        payloadSchemaVersion: sanitized.schemaVersion,
        sanitizedPayload: sanitized.projection as Prisma.InputJsonValue,
        payloadDigest,
        correlationId,
        state: "COMPLETED",
        completedAt: now,
        firstSeenAt: now,
        lastSeenAt: now,
        quarantineReason: webhookId
          ? null
          : "missing_shopify_webhook_id",
      },
    });

    // 1. Durably disable processing first inside the same transaction.
    await tx.shop.update({
      where: { id: shop!.id },
      data: {
        processingEnabled: false,
        processingDisabledReason: "UNINSTALLED",
        processingDisabledAt: now,
        uninstalledAt: now,
      },
    });

    // 2–4. Cancel every cancellable non-terminal job; close active attempts.
    const cancelled = await cancelAllCancellable(tx, shop!.id, now);

    return {
      deliveryId: delivery.id,
      duplicate: false,
      cancelledJobs: cancelled.cancelledJobs,
      closedAttempts: cancelled.closedAttempts,
    };
  });

  // Session/token deletion ONLY after durable disablement is committed.
  // Failure must not re-enable the shop or roll back disablement.
  let sessionsDeleted = 0;
  try {
    sessionsDeleted = await deleteSessionsForShop(norm.normalized);
  } catch {
    try {
      const deleted = await prisma.session.deleteMany({
        where: { shop: norm.normalized },
      });
      sessionsDeleted = deleted.count;
    } catch {
      // Control-plane disable/cancel already committed.
    }
  }

  return {
    shopId: shop.id,
    cancelledJobs: result.cancelledJobs,
    closedAttempts: result.closedAttempts,
    sessionsDeleted,
    deliveryId: result.deliveryId,
    duplicate: result.duplicate,
  };
}

async function cancelAllCancellable(
  tx: Prisma.TransactionClient,
  shopId: string,
  now: Date,
): Promise<{ cancelledJobs: number; closedAttempts: number }> {
  await tx.$queryRaw`
    SELECT id FROM "DurableJob"
    WHERE "shopId" = ${shopId}
      AND state IN ('PENDING','DISPATCH_LEASED','ENQUEUED','RUNNING','RETRY_WAIT')
    FOR UPDATE
  `;

  const cancellable = await tx.durableJob.findMany({
    where: {
      shopId,
      state: { in: [...CANCELLABLE_DURABLE_JOB_STATES] },
    },
  });

  let cancelledJobs = 0;
  let closedAttempts = 0;

  for (const job of cancellable) {
    assertTransition(job.state, "CANCELLED");
    const updated = await tx.durableJob.updateMany({
      where: { id: job.id, shopId, state: job.state },
      data: {
        state: "CANCELLED",
        cancelledAt: now,
        leaseOwner: null,
        leaseExpiresAt: null,
        failureCode: "shop_uninstalled",
        failureSummary: "Cancelled due to app uninstall",
      },
    });
    if (updated.count === 0) continue;
    cancelledJobs += 1;

    const closed = await tx.jobAttempt.updateMany({
      where: {
        durableJobId: job.id,
        shopId,
        finishedAt: null,
      },
      data: {
        finishedAt: now,
        outcome: "CANCELLED",
        errorCode: "shop_uninstalled",
        failureSummary: "Attempt closed due to app uninstall",
        leaseExpiresAt: null,
      },
    });
    closedAttempts += closed.count;
  }

  return { cancelledJobs, closedAttempts };
}
