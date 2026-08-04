/**
 * App uninstall — disable shop processing, cancel pending jobs, durable delivery,
 * delete sessions via bootstrap.
 */
import { randomUUID } from "node:crypto";
import { deleteSessionsForShop } from "../tenant/bootstrap.server";
import { normalizeShopDomain } from "../tenant/shop-domain";
import { requireTargetApiVersion } from "./api-version.server";
import { getControlPlanePrisma } from "./control-plane-db.server";
import { digestCanonicalJson } from "./digest.server";
import { SyncControlPlaneError } from "./errors";
import { sanitizeWebhookPayload } from "./sanitize.server";
import {
  CANCELLABLE_DURABLE_JOB_STATES,
  assertTransition,
} from "./state-machine.server";

export type ProcessUninstallInput = {
  verifiedShop: string;
  webhookId: string;
  apiVersion: string | null | undefined;
  payload?: unknown;
};

export type ProcessUninstallResult = {
  shopId: string;
  cancelledJobs: number;
  sessionsDeleted: number;
  deliveryId: string;
  duplicate: boolean;
};

/**
 * Durable uninstall sequence. Idempotent on shopifyWebhookId.
 */
export async function processUninstall(
  input: ProcessUninstallInput,
): Promise<ProcessUninstallResult> {
  const apiVersion = requireTargetApiVersion(input.apiVersion);
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

  // Ensure Shop exists on control-plane connection (no runtime bootstrap required).
  let shop = await prisma.shop.findUnique({
    where: { myshopifyDomain: norm.normalized },
  });
  if (!shop) {
    shop = await prisma.shop.create({
      data: { myshopifyDomain: norm.normalized },
    });
  }

  const sanitized = sanitizeWebhookPayload(
    "app/uninstalled",
    input.payload ?? { myshopify_domain: shop.myshopifyDomain },
  );
  const payloadDigest = digestCanonicalJson(sanitized.projection);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.webhookDelivery.findUnique({
      where: {
        shopId_shopifyWebhookId: {
          shopId: shop!.id,
          shopifyWebhookId: input.webhookId,
        },
      },
    });

    if (existing) {
      await tx.webhookDelivery.update({
        where: { id: existing.id },
        data: {
          duplicateCount: { increment: 1 },
          lastSeenAt: now,
        },
      });
      // Still ensure disabled (idempotent).
      await tx.shop.update({
        where: { id: shop!.id },
        data: {
          processingEnabled: false,
          processingDisabledReason: "UNINSTALLED",
          processingDisabledAt: shop!.processingDisabledAt ?? now,
          uninstalledAt: shop!.uninstalledAt ?? now,
        },
      });
      return {
        deliveryId: existing.id,
        duplicate: true,
        cancelledJobs: 0,
      };
    }

    const delivery = await tx.webhookDelivery.create({
      data: {
        shopId: shop!.id,
        shopifyWebhookId: input.webhookId,
        topic: "app/uninstalled",
        apiVersionReceived: apiVersion,
        payloadSchemaVersion: sanitized.schemaVersion,
        sanitizedPayload: sanitized.projection,
        payloadDigest,
        correlationId,
        state: "COMPLETED",
        completedAt: now,
        firstSeenAt: now,
        lastSeenAt: now,
      },
    });

    await tx.shop.update({
      where: { id: shop!.id },
      data: {
        processingEnabled: false,
        processingDisabledReason: "UNINSTALLED",
        processingDisabledAt: now,
        uninstalledAt: now,
      },
    });

    const cancellable = await tx.durableJob.findMany({
      where: {
        shopId: shop!.id,
        state: { in: [...CANCELLABLE_DURABLE_JOB_STATES] },
      },
    });

    for (const job of cancellable) {
      assertTransition(job.state, "CANCELLED");
      await tx.durableJob.update({
        where: { id: job.id },
        data: {
          state: "CANCELLED",
          cancelledAt: now,
          leaseOwner: null,
          leaseExpiresAt: null,
          failureCode: "shop_uninstalled",
          failureSummary: "Cancelled due to app uninstall",
        },
      });
    }

    return {
      deliveryId: delivery.id,
      duplicate: false,
      cancelledJobs: cancellable.length,
    };
  });

  let sessionsDeleted = 0;
  try {
    sessionsDeleted = await deleteSessionsForShop(norm.normalized);
  } catch {
    // Prefer bootstrap boundary; fall back to control-plane connection for
    // disposable harnesses where runtime identity is not provisioned.
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
    sessionsDeleted,
    deliveryId: result.deliveryId,
    duplicate: result.duplicate,
  };
}
