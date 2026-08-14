/**
 * Durable webhook intake — DB is source of truth; Redis not required for 200.
 * Corrections: F-PR4-08, F-PR4-18, F-PR4-20
 */
import { randomUUID } from "node:crypto";
import type { DurableJob, WebhookDelivery, Prisma } from "@prisma/client";
import { normalizeShopDomain } from "../tenant/shop-domain";
import {
  resolveApiVersionForPersistence,
  validateReceivedApiVersion,
} from "./api-version.server";
import { getControlPlanePrisma } from "./control-plane-db.server";
import { digestCanonicalJson } from "./digest.server";
import { SyncControlPlaneError } from "./errors";
import { executionStrategyForJobType } from "./execution-strategy.server";
import {
  sanitizeWebhookPayload,
  type SanitizedWebhookTopic,
} from "./sanitize.server";

export const DURABLE_JOB_AUTHORITY_VERSION = "tenant-job-envelope-v3" as const;

export type IngestAuthenticatedWebhookInput = {
  verifiedShop: string;
  topic: string;
  /** Null/undefined → quarantine; never invent a time-based key. */
  webhookId: string | null | undefined;
  apiVersion: string | null | undefined;
  payload: unknown;
  correlationId?: string;
};

export type IngestAuthenticatedWebhookResult = {
  delivery: WebhookDelivery;
  job: DurableJob | null;
  duplicate: boolean;
  quarantined: boolean;
  conflict: boolean;
};

function webhookJobType(topic: string): string {
  return `webhook:${topic}`;
}

function webhookSource(topic: string): string {
  return `webhook:${topic}`;
}

async function resolveShopViaControlPlane(verifiedShop: string) {
  const norm = normalizeShopDomain(verifiedShop);
  if (!norm.ok) {
    throw new SyncControlPlaneError(
      "shop_missing",
      `Invalid verified shop domain: ${norm.reason}`,
    );
  }
  const prisma = getControlPlanePrisma();
  const shopRow = await prisma.shop.findUnique({
    where: { myshopifyDomain: norm.normalized },
    select: {
      id: true,
      processingEnabled: true,
      myshopifyDomain: true,
    },
  });
  if (!shopRow) {
    throw new SyncControlPlaneError(
      "shop_missing",
      "Canonical Shop missing for verified webhook domain",
    );
  }
  return shopRow;
}

async function createDataIssue(
  tx: Prisma.TransactionClient,
  input: {
    shopId: string;
    reasonCode: string;
    severity?: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
    redactedEvidence?: Prisma.InputJsonValue;
  },
) {
  await tx.dataIssue.create({
    data: {
      shopId: input.shopId,
      reasonCode: input.reasonCode.slice(0, 64),
      severity: input.severity ?? "ERROR",
      redactedEvidence: input.redactedEvidence,
    },
  });
}

/**
 * Authenticated webhook → sanitize → digest → durable delivery + PENDING job.
 * Missing Shopify webhook ID → quarantine only (F-PR4-20).
 * Divergent digest for same ID → conflict quarantine (F-PR4-08).
 * Unsupported API version → durable quarantine, no job (F-PR4-18).
 */
export async function ingestAuthenticatedWebhook(
  input: IngestAuthenticatedWebhookInput,
): Promise<IngestAuthenticatedWebhookResult> {
  const shopRow = await resolveShopViaControlPlane(input.verifiedShop);
  const prisma = getControlPlanePrisma();

  if (!shopRow.processingEnabled && input.topic !== "app/uninstalled") {
    throw new SyncControlPlaneError(
      "shop_processing_disabled",
      "Shop processing is disabled; durable job creation denied",
    );
  }

  const apiValidation = validateReceivedApiVersion(input.apiVersion);
  const apiVersionPersisted = resolveApiVersionForPersistence(input.apiVersion);
  const correlationId = input.correlationId ?? randomUUID();
  const now = new Date();

  // Missing Shopify webhook ID — quarantine, no processing job (F-PR4-20).
  if (input.webhookId == null || input.webhookId.trim() === "") {
    let sanitizedProjection: Record<string, unknown> = {};
    let payloadDigest = digestCanonicalJson({ quarantine: true });
    let schemaVersion = "quarantine-missing-webhook-id-v1";
    try {
      const sanitized = sanitizeWebhookPayload(
        input.topic as SanitizedWebhookTopic,
        input.payload,
      );
      sanitizedProjection = sanitized.projection;
      payloadDigest = digestCanonicalJson(sanitized.projection);
      schemaVersion = sanitized.schemaVersion;
    } catch {
      // Even sanitize failure still gets a quarantine receipt.
      sanitizedProjection = { _quarantine: true };
    }

    const delivery = await prisma.$transaction(async (tx) => {
      const created = await tx.webhookDelivery.create({
        data: {
          shopId: shopRow.id,
          shopifyWebhookId: null,
          topic: input.topic,
          apiVersionReceived: apiVersionPersisted,
          payloadSchemaVersion: schemaVersion,
          sanitizedPayload: sanitizedProjection as Prisma.InputJsonValue,
          payloadDigest,
          correlationId,
          state: "QUARANTINED",
          quarantineReason: "missing_shopify_webhook_id",
          firstSeenAt: now,
          lastSeenAt: now,
        },
      });
      await createDataIssue(tx, {
        shopId: shopRow.id,
        reasonCode: "missing_shopify_webhook_id",
        redactedEvidence: {
          topic: input.topic,
          deliveryId: created.id,
          apiVersion: apiVersionPersisted,
        },
      });
      return created;
    });

    return {
      delivery,
      job: null,
      duplicate: false,
      quarantined: true,
      conflict: false,
    };
  }

  const webhookId = input.webhookId.trim();

  // Unsupported / missing API version — durable quarantine, no job (F-PR4-18).
  if (!apiValidation.ok) {
    let sanitizedProjection: Record<string, unknown> = { _quarantine: true };
    let payloadDigest = digestCanonicalJson(sanitizedProjection);
    let schemaVersion = "quarantine-api-version-v1";
    try {
      const sanitized = sanitizeWebhookPayload(
        input.topic as SanitizedWebhookTopic,
        input.payload,
      );
      sanitizedProjection = sanitized.projection;
      payloadDigest = digestCanonicalJson(sanitized.projection);
      schemaVersion = sanitized.schemaVersion;
    } catch {
      /* keep quarantine stub */
    }

    const delivery = await prisma.$transaction(async (tx) => {
      const existing = await tx.webhookDelivery.findFirst({
        where: { shopId: shopRow.id, shopifyWebhookId: webhookId },
      });
      if (existing) {
        await tx.webhookDelivery.update({
          where: { id: existing.id },
          data: { duplicateCount: { increment: 1 }, lastSeenAt: now },
        });
        return existing;
      }
      const created = await tx.webhookDelivery.create({
        data: {
          shopId: shopRow.id,
          shopifyWebhookId: webhookId,
          topic: input.topic,
          apiVersionReceived: apiVersionPersisted,
          payloadSchemaVersion: schemaVersion,
          sanitizedPayload: sanitizedProjection as Prisma.InputJsonValue,
          payloadDigest,
          correlationId,
          state: "QUARANTINED",
          quarantineReason:
            apiValidation.reason === "missing"
              ? "api_version_missing"
              : "api_version_unsupported",
          firstSeenAt: now,
          lastSeenAt: now,
        },
      });
      await createDataIssue(tx, {
        shopId: shopRow.id,
        reasonCode:
          apiValidation.reason === "missing"
            ? "api_version_missing"
            : "api_version_unsupported",
        redactedEvidence: {
          topic: input.topic,
          receivedApiVersion: apiValidation.received,
          deliveryId: created.id,
        },
      });
      return created;
    });

    return {
      delivery,
      job: null,
      duplicate: false,
      quarantined: true,
      conflict: false,
    };
  }

  let sanitized;
  try {
    sanitized = sanitizeWebhookPayload(
      input.topic as SanitizedWebhookTopic,
      input.payload,
    );
  } catch (err) {
    if (
      err instanceof SyncControlPlaneError &&
      (err.code === "projection_bounds_exceeded" ||
        err.code === "projection_scalar_type_invalid")
    ) {
      const delivery = await prisma.$transaction(async (tx) => {
        const created = await tx.webhookDelivery.create({
          data: {
            shopId: shopRow.id,
            shopifyWebhookId: webhookId,
            topic: input.topic,
            apiVersionReceived: apiVersionPersisted,
            payloadSchemaVersion: "quarantine-projection-bounds-v1",
            sanitizedPayload: { _quarantine: true, reason: err.code },
            payloadDigest: digestCanonicalJson({ reason: err.code }),
            correlationId,
            state: "QUARANTINED",
            quarantineReason: err.code,
            firstSeenAt: now,
            lastSeenAt: now,
          },
        });
        await createDataIssue(tx, {
          shopId: shopRow.id,
          reasonCode: err.code.slice(0, 64),
          redactedEvidence: { topic: input.topic, deliveryId: created.id },
        });
        return created;
      });
      return {
        delivery,
        job: null,
        duplicate: false,
        quarantined: true,
        conflict: false,
      };
    }
    throw err;
  }

  const payloadDigest = digestCanonicalJson(sanitized.projection);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.webhookDelivery.findFirst({
      where: { shopId: shopRow.id, shopifyWebhookId: webhookId },
      include: { durableJob: true },
    });

    if (existing) {
      // Same digest → duplicate.
      if (existing.payloadDigest === payloadDigest) {
        const updated = await tx.webhookDelivery.update({
          where: { id: existing.id },
          data: {
            duplicateCount: { increment: 1 },
            lastSeenAt: now,
          },
        });
        return {
          delivery: updated,
          job: existing.durableJob,
          duplicate: true,
          quarantined: false,
          conflict: false,
        };
      }

      // Divergent digest — preserve original; record conflict (F-PR4-08).
      const updated = await tx.webhookDelivery.update({
        where: { id: existing.id },
        data: {
          duplicateCount: { increment: 1 },
          payloadDigestMismatchCount: { increment: 1 },
          lastConflictingDigest: payloadDigest,
          firstMismatchAt: existing.firstMismatchAt ?? now,
          lastMismatchAt: now,
          lastSeenAt: now,
          state:
            existing.state === "COMPLETED" || existing.state === "FAILED"
              ? existing.state
              : "CONFLICT",
          quarantineReason:
            existing.state === "COMPLETED" || existing.state === "FAILED"
              ? existing.quarantineReason
              : "payload_digest_conflict",
        },
      });

      await createDataIssue(tx, {
        shopId: shopRow.id,
        reasonCode: "webhook_payload_digest_conflict",
        severity: "CRITICAL",
        redactedEvidence: {
          deliveryId: existing.id,
          originalDigest: existing.payloadDigest,
          conflictingDigest: payloadDigest,
          topic: input.topic,
        },
      });

      // If first job has not applied, cancel/quarantine it.
      if (
        existing.durableJob &&
        !["SUCCEEDED", "DEAD_LETTERED", "CANCELLED"].includes(
          existing.durableJob.state,
        )
      ) {
        await tx.durableJob.updateMany({
          where: {
            id: existing.durableJob.id,
            shopId: shopRow.id,
            state: {
              in: [
                "PENDING",
                "DISPATCH_LEASED",
                "ENQUEUED",
                "RETRY_WAIT",
                "RUNNING",
              ],
            },
          },
          data: {
            state: "CANCELLED",
            cancelledAt: now,
            failureCode: "payload_digest_conflict",
            failureSummary:
              "Cancelled — conflicting payload digest for same Shopify webhook ID",
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
      }

      return {
        delivery: updated,
        job: existing.durableJob,
        duplicate: true,
        quarantined: updated.state === "CONFLICT" || updated.state === "QUARANTINED",
        conflict: true,
      };
    }

    const strategy = executionStrategyForJobType(webhookJobType(input.topic));

    const job = await tx.durableJob.create({
      data: {
        shopId: shopRow.id,
        jobType: webhookJobType(input.topic),
        source: webhookSource(input.topic),
        queueName: "stocky-webhooks",
        payloadSchemaVersion: sanitized.schemaVersion,
        sanitizedPayload: sanitized.projection as Prisma.InputJsonValue,
        payloadDigest,
        idempotencyKey: `webhook:${webhookId}`,
        correlationId,
        authorityVersion: DURABLE_JOB_AUTHORITY_VERSION,
        executionStrategy: strategy,
        state: "PENDING",
        nextEligibleAt: now,
      },
    });

    const delivery = await tx.webhookDelivery.create({
      data: {
        shopId: shopRow.id,
        shopifyWebhookId: webhookId,
        topic: input.topic,
        apiVersionReceived: apiVersionPersisted,
        payloadSchemaVersion: sanitized.schemaVersion,
        sanitizedPayload: sanitized.projection as Prisma.InputJsonValue,
        payloadDigest,
        correlationId,
        state: "JOB_CREATED",
        durableJobId: job.id,
        firstSeenAt: now,
        lastSeenAt: now,
      },
    });

    await tx.durableJob.update({
      where: { id: job.id },
      data: { webhookDeliveryId: delivery.id },
    });

    const refreshedJob = await tx.durableJob.findUniqueOrThrow({
      where: { id: job.id },
    });

    return {
      delivery,
      job: refreshedJob,
      duplicate: false,
      quarantined: false,
      conflict: false,
    };
  });
}

/**
 * Create a durable PENDING job for catalog/ABC producers (dispatcher enqueues).
 */
export async function createDurableJob(input: {
  shopId: string;
  jobType: string;
  source: string;
  queueName: string;
  payloadSchemaVersion: string;
  sanitizedPayload: Record<string, unknown>;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string;
  maxAttempts?: number;
}): Promise<DurableJob> {
  const prisma = getControlPlanePrisma();
  const shop = await prisma.shop.findUnique({
    where: { id: input.shopId },
    select: { id: true, processingEnabled: true },
  });
  if (!shop) {
    throw new SyncControlPlaneError("shop_missing", "Shop not found");
  }
  if (!shop.processingEnabled) {
    throw new SyncControlPlaneError(
      "shop_processing_disabled",
      "Cannot create durable job for disabled shop",
    );
  }

  const payloadDigest = digestCanonicalJson(input.sanitizedPayload);
  const correlationId = input.correlationId ?? randomUUID();
  const strategy = executionStrategyForJobType(input.jobType);

  try {
    return await prisma.durableJob.create({
      data: {
        shopId: input.shopId,
        jobType: input.jobType,
        source: input.source,
        queueName: input.queueName,
        payloadSchemaVersion: input.payloadSchemaVersion,
        sanitizedPayload: input.sanitizedPayload as Prisma.InputJsonValue,
        payloadDigest,
        idempotencyKey: input.idempotencyKey,
        correlationId,
        causationId: input.causationId,
        authorityVersion: DURABLE_JOB_AUTHORITY_VERSION,
        executionStrategy: strategy,
        state: "PENDING",
        maxAttempts: input.maxAttempts ?? 3,
        nextEligibleAt: new Date(),
      },
    });
  } catch (err) {
    const existing = await prisma.durableJob.findUnique({
      where: {
        shopId_idempotencyKey: {
          shopId: input.shopId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) return existing;
    throw err;
  }
}
