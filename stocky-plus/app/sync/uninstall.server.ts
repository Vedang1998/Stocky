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
 *
 * Deliveries that are out of date (attack round 8, SEC-23):
 * Shopify delivers app/uninstalled at least once and in no promised order, so
 * a copy can reach us after the merchant has installed the app again. Such a
 * copy must not switch the running shop off. Two cases are recognised, and
 * only for a shop that is switched on:
 * - a delivery id this shop has already had for app/uninstalled;
 * - a trigger time earlier than the shop's last verified reinstall.
 * Everything else switches the shop off, including a delivery with no usable
 * trigger time: an uninstall that is wrongly honoured heals when the merchant
 * next opens the app, one that is wrongly ignored keeps data we should erase.
 * The trigger time header is not covered by the signature. Whoever can
 * replay a signed uninstall body can still send it with a later time.
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
  /** X-Shopify-Triggered-At: when Shopify raised the event. Not signed. */
  triggeredAt?: string | null;
};

export type ProcessUninstallResult = {
  shopId: string;
  cancelledJobs: number;
  closedAttempts: number;
  sessionsDeleted: number;
  deliveryId: string;
  duplicate: boolean;
  /** The delivery was out of date for a running shop; nothing was changed. */
  ignored: boolean;
};

/**
 * The trigger time is Shopify's clock and `reinstalledAt` is ours; the two may
 * differ a little. An uninstall counts as older than a reinstall only when it
 * is older by more than this. The allowance works in one direction only: an
 * uninstall triggered within it before the reinstall still switches the shop
 * off, which heals when the merchant next opens the app.
 */
const TRIGGER_TIME_ALLOWANCE_MS = 5_000;

const STALE_UNINSTALL_REASON = "uninstall_before_current_install";

type LockedShop = {
  processingEnabled: boolean;
  uninstalledAt: Date | null;
  reinstalledAt: Date | null;
};

function parseTriggeredAt(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function triggeredBeforeReinstall(
  triggeredAt: Date | null,
  reinstalledAt: Date | null,
): boolean {
  if (!triggeredAt || !reinstalledAt) return false;
  return (
    triggeredAt.getTime() < reinstalledAt.getTime() - TRIGGER_TIME_ALLOWANCE_MS
  );
}

/**
 * Durable uninstall sequence. Disables processing even when jobs are
 * DISPATCH_LEASED or RUNNING, unless the delivery is out of date for a
 * running shop (see the file comment). A shop that something else has already
 * switched off (operator hold, erasure) keeps that state. Session deletion
 * occurs only after commit.
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

  const shop =
    (await prisma.shop.findUnique({
      where: { myshopifyDomain: norm.normalized },
      select: { id: true, myshopifyDomain: true },
    })) ??
    (await prisma.shop.create({
      data: { myshopifyDomain: norm.normalized },
      select: { id: true, myshopifyDomain: true },
    }));

  const sanitized = sanitizeWebhookPayload(
    "app/uninstalled",
    input.payload ?? { myshopify_domain: shop.myshopifyDomain },
  );
  const payloadDigest = digestCanonicalJson(sanitized.projection);
  const webhookId =
    input.webhookId && input.webhookId.trim() !== ""
      ? input.webhookId.trim()
      : null;

  const triggeredAt = parseTriggeredAt(input.triggeredAt);

  const result = await prisma.$transaction(async (tx) => {
    // Lock the shop row: the decision below depends on whether the shop is
    // running, and a reinstall must not slip in between reading and writing.
    const [current] = await tx.$queryRaw<LockedShop[]>`
      SELECT "processingEnabled", "uninstalledAt", "reinstalledAt"
      FROM "Shop"
      WHERE id = ${shop.id}
      FOR UPDATE
    `;
    if (!current) {
      throw new SyncControlPlaneError("shop_missing", "Shop row missing");
    }

    const existing = webhookId
      ? await tx.webhookDelivery.findFirst({
          where: { shopId: shop.id, shopifyWebhookId: webhookId },
        })
      : null;
    const seenBefore = existing?.topic === "app/uninstalled";
    const outOfDate =
      current.processingEnabled &&
      (seenBefore ||
        triggeredBeforeReinstall(triggeredAt, current.reinstalledAt));

    let deliveryId: string;
    if (existing) {
      await tx.webhookDelivery.update({
        where: { id: existing.id },
        data: {
          duplicateCount: { increment: 1 },
          lastSeenAt: now,
        },
      });
      deliveryId = existing.id;
    } else {
      const delivery = await tx.webhookDelivery.create({
        data: {
          shopId: shop.id,
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
          quarantineReason: outOfDate
            ? STALE_UNINSTALL_REASON
            : webhookId
              ? null
              : "missing_shopify_webhook_id",
        },
      });
      deliveryId = delivery.id;
    }

    if (outOfDate) {
      return {
        deliveryId,
        duplicate: existing != null,
        ignored: true,
        cancelledJobs: 0,
        closedAttempts: 0,
      };
    }

    if (current.processingEnabled) {
      // 1. Durably disable processing first inside the same transaction.
      await tx.shop.update({
        where: { id: shop.id },
        data: {
          processingEnabled: false,
          processingDisabledReason: "UNINSTALLED",
          processingDisabledAt: now,
          uninstalledAt: now,
        },
      });
    } else if (!current.uninstalledAt) {
      // Already switched off by an operator or by an erasure. That reason and
      // its time stay; only the fact of the uninstall is added. The retention
      // sweep reads this time, so a shop on operator hold is still erased
      // once it has been uninstalled for the retention period.
      await tx.shop.update({
        where: { id: shop.id },
        data: { uninstalledAt: now },
      });
    }

    // 2–4. Cancel every cancellable non-terminal job; close active attempts.
    // Idempotent, so a repeated delivery cancels whatever is left.
    const cancelled = await cancelAllCancellable(tx, shop.id, now);

    return {
      deliveryId,
      duplicate: existing != null,
      ignored: false,
      cancelledJobs: cancelled.cancelledJobs,
      closedAttempts: cancelled.closedAttempts,
    };
  });

  // Session/token deletion ONLY after durable disablement is committed.
  // Failure must not re-enable the shop or roll back disablement.
  let sessionsDeleted = 0;
  if (result.ignored) {
    console.warn(
      `Ignored an out-of-date app/uninstalled delivery for ${norm.normalized}: the shop is installed`,
    );
  } else {
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
  }

  return { shopId: shop.id, sessionsDeleted, ...result };
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
