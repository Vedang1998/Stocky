/**
 * Durable webhook intake — DB is source of truth; Redis not required for 200.
 */
import { randomUUID } from "node:crypto";
import type { DurableJob, WebhookDelivery, Prisma } from "@prisma/client";
import { normalizeShopDomain } from "../tenant/shop-domain";
import { requireTargetApiVersion } from "./api-version.server";
import { getControlPlanePrisma } from "./control-plane-db.server";
import { digestCanonicalJson } from "./digest.server";
import { SyncControlPlaneError } from "./errors";
import {
  sanitizeWebhookPayload,
  type SanitizedWebhookTopic,
} from "./sanitize.server";

export const DURABLE_JOB_AUTHORITY_VERSION = "tenant-job-envelope-v2" as const;

export type IngestAuthenticatedWebhookInput = {
  verifiedShop: string;
  topic: string;
  webhookId: string;
  apiVersion: string | null | undefined;
  payload: unknown;
  correlationId?: string;
};

export type IngestAuthenticatedWebhookResult = {
  delivery: WebhookDelivery;
  job: DurableJob | null;
  duplicate: boolean;
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

/**
 * Authenticated webhook → sanitize → digest → durable delivery + PENDING job.
 * Duplicate (shopId, shopifyWebhookId) bumps counters and does not create a second job.
 */
export async function ingestAuthenticatedWebhook(
  input: IngestAuthenticatedWebhookInput,
): Promise<IngestAuthenticatedWebhookResult> {
  const shopRow = await resolveShopViaControlPlane(input.verifiedShop);
  const prisma = getControlPlanePrisma();

  // Uninstall is handled by processUninstall — other topics deny when disabled.
  if (!shopRow.processingEnabled && input.topic !== "app/uninstalled") {
    throw new SyncControlPlaneError(
      "shop_processing_disabled",
      "Shop processing is disabled; durable job creation denied",
    );
  }

  const apiVersion = requireTargetApiVersion(input.apiVersion);
  const sanitized = sanitizeWebhookPayload(
    input.topic as SanitizedWebhookTopic,
    input.payload,
  );
  const payloadDigest = digestCanonicalJson(sanitized.projection);
  const correlationId = input.correlationId ?? randomUUID();
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.webhookDelivery.findUnique({
      where: {
        shopId_shopifyWebhookId: {
          shopId: shopRow.id,
          shopifyWebhookId: input.webhookId,
        },
      },
      include: { durableJob: true },
    });

    if (existing) {
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
      };
    }

    const job = await tx.durableJob.create({
      data: {
        shopId: shopRow.id,
        jobType: webhookJobType(input.topic),
        source: webhookSource(input.topic),
        queueName: "stocky-webhooks",
        payloadSchemaVersion: sanitized.schemaVersion,
        sanitizedPayload: sanitized.projection as Prisma.InputJsonValue,
        payloadDigest,
        idempotencyKey: `webhook:${input.webhookId}`,
        correlationId,
        authorityVersion: DURABLE_JOB_AUTHORITY_VERSION,
        state: "PENDING",
        nextEligibleAt: now,
      },
    });

    const delivery = await tx.webhookDelivery.create({
      data: {
        shopId: shopRow.id,
        shopifyWebhookId: input.webhookId,
        topic: input.topic,
        apiVersionReceived: apiVersion,
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

    return { delivery, job: refreshedJob, duplicate: false };
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
