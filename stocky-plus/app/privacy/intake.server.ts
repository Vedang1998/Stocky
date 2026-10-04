/**
 * Durable authenticated Shopify compliance intake.
 * Authenticate/validate before persist. Distinct delivery / work / generation ids.
 */
import { createHash, randomUUID } from "node:crypto";
import { getControlPlanePrisma } from "../sync/control-plane-db.server";
import { normalizeShopDomain } from "../tenant/shop-domain";
import { PrivacyBoundaryError } from "./errors.server";
import {
  GENERATION_FENCE,
  ensureLiveInstallGeneration,
  loadGenerationForShop,
} from "./generation.server";
import { isPrivacyPauseEnabled } from "./pause.server";

export const COMPLIANCE_TOPICS = [
  "customers/data_request",
  "customers/redact",
  "shop/redact",
] as const;

export type ComplianceTopic = (typeof COMPLIANCE_TOPICS)[number];

export type ComplianceIntakeInput = {
  shop: string;
  topic: string;
  payload: unknown;
  webhookId?: string | null;
  apiVersion?: string | null;
};

export type ComplianceIntakeResult = {
  requestId: string;
  workId: string;
  deliveryId: string;
  generationId: string;
  duplicate: boolean;
  pauseHonored: boolean;
  state: string;
};

function isComplianceTopic(topic: string): topic is ComplianceTopic {
  return (COMPLIANCE_TOPICS as readonly string[]).includes(topic);
}

function payloadDigest(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload ?? null))
    .digest("hex");
}

function lookupCustomerRestId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const customer = (payload as { customer?: { id?: unknown } }).customer;
  if (customer == null || customer.id == null) return null;
  const id = customer.id;
  if (typeof id === "string" && /^[0-9]+$/.test(id)) return id;
  if (typeof id === "number" && Number.isSafeInteger(id)) return String(id);
  return null;
}

function lookupOrderLegacyIds(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const orders = (payload as { orders_to_redact?: unknown }).orders_to_redact;
  if (!Array.isArray(orders)) return [];
  return orders
    .map((entry) => {
      if (typeof entry === "string" && /^[0-9]+$/.test(entry)) return entry;
      if (typeof entry === "number" && Number.isSafeInteger(entry)) {
        return String(entry);
      }
      if (entry && typeof entry === "object" && "id" in entry) {
        const id = (entry as { id: unknown }).id;
        if (typeof id === "string" && /^[0-9]+$/.test(id)) return id;
        if (typeof id === "number" && Number.isSafeInteger(id)) return String(id);
      }
      return null;
    })
    .filter((id): id is string => id != null);
}

export async function intakeComplianceWebhook(
  input: ComplianceIntakeInput,
): Promise<ComplianceIntakeResult> {
  if (!isComplianceTopic(input.topic)) {
    throw new PrivacyBoundaryError(
      "unknown_compliance_topic",
      `Unsupported compliance topic ${input.topic}`,
    );
  }

  const norm = normalizeShopDomain(input.shop);
  if (!norm.ok) {
    throw new PrivacyBoundaryError(
      "invalid_shop_domain",
      `Invalid compliance shop domain: ${norm.reason}`,
    );
  }

  const customerRestId = lookupCustomerRestId(input.payload);
  const orderLegacyIds = lookupOrderLegacyIds(input.payload);
  if (
    (input.topic === "customers/data_request" ||
      input.topic === "customers/redact") &&
    !customerRestId
  ) {
    throw new PrivacyBoundaryError(
      "customer_target_missing",
      "Customer compliance webhook missing exact customer rest id",
    );
  }

  const prisma = getControlPlanePrisma();
  const digest = payloadDigest(input.payload);
  const pauseHonored = isPrivacyPauseEnabled();
  const now = new Date();
  const deadlineAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (input.webhookId) {
    const existingBind = await prisma.privacyDeliveryBinding.findUnique({
      where: { shopifyWebhookId: input.webhookId },
    });
    if (existingBind) {
      const existing = await prisma.privacyRequest.findUnique({
        where: { id: existingBind.privacyRequestId },
      });
      if (existing) {
        await prisma.privacyRequest.update({
          where: { id: existing.id },
          data: { duplicateCount: { increment: 1 } },
        });
        return {
          requestId: existing.id,
          workId: existing.workId,
          deliveryId: existingBind.id,
          generationId: existing.generationId,
          duplicate: true,
          pauseHonored: existing.pauseHonored,
          state: existing.state,
        };
      }
    }
  }

  const shop = await prisma.shop.findUnique({
    where: { myshopifyDomain: norm.normalized },
    select: { id: true, myshopifyDomain: true },
  });
  const shopId = shop?.id ?? `missing:${norm.normalized}`;

  let generation = shop
    ? await loadGenerationForShop({
        shopId: shop.id,
        canonicalDomain: shop.myshopifyDomain,
      })
    : null;
  if (shop && !generation) {
    generation = await ensureLiveInstallGeneration({
      shopId: shop.id,
      canonicalDomain: shop.myshopifyDomain,
    });
  }
  if (!generation) {
    const created = await prisma.shopInstallGeneration.create({
      data: {
        id: randomUUID(),
        canonicalDomain: norm.normalized,
        targetShopId: shopId,
        shopRowId: shop?.id ?? null,
        fence: shop ? GENERATION_FENCE.LIVE : GENERATION_FENCE.UNINSTALLED,
      },
    });
    generation = {
      id: created.id,
      fence: created.fence,
      targetShopId: created.targetShopId,
    };
  }

  const requestId = randomUUID();
  const workId = randomUUID();
  const deliveryId = randomUUID();

  const created = await prisma.$transaction(async (tx) => {
    const request = await tx.privacyRequest.create({
      data: {
        id: requestId,
        topic: input.topic,
        state: pauseHonored ? "PAUSED" : "RECEIVED",
        targetShopId: generation.targetShopId,
        generationId: generation.id,
        shopRowId: shop?.id ?? null,
        canonicalDomain: norm.normalized,
        lookupCustomerRestId: customerRestId,
        lookupOrderLegacyIds: orderLegacyIds,
        workId,
        deliveryId,
        shopifyWebhookId: input.webhookId ?? null,
        payloadDigest: digest,
        deadlineAt,
        pauseHonored,
      },
    });
    await tx.privacyDeliveryBinding.create({
      data: {
        id: deliveryId,
        canonicalDomain: norm.normalized,
        shopifyWebhookId: input.webhookId ?? null,
        topic: input.topic,
        payloadDigest: digest,
        privacyRequestId: request.id,
      },
    });
    await tx.privacyCoordinatorEvent.create({
      data: {
        privacyRequestId: request.id,
        kind: "intake_persisted",
        detail: JSON.stringify({
          topic: input.topic,
          duplicate: false,
          pauseHonored,
          shopPresent: Boolean(shop),
        }),
      },
    });
    return request;
  });

  return {
    requestId: created.id,
    workId: created.workId,
    deliveryId,
    generationId: created.generationId,
    duplicate: false,
    pauseHonored,
    state: created.state,
  };
}
