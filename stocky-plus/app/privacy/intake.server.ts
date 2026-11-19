/**
 * Durable intake for Shopify's compliance webhooks.
 *
 * Each delivery becomes one PrivacyRequest row before the route answers 200,
 * so an acknowledged request can never be lost. The customer block of the
 * payload (id, email, phone) is never read or stored.
 */
import { Prisma, type PrivacyRequestResolution } from "@prisma/client";
import { getControlPlanePrisma } from "../sync/control-plane-db.server";
import { SyncControlPlaneError } from "../sync/errors";
import { normalizeShopDomain } from "../tenant/shop-domain";
import { PRIVACY_REQUEST_DUE_DAYS } from "./config.server";
import type { ComplianceTopic } from "./topics";

const DAY_MS = 24 * 60 * 60 * 1000;

const STORED_TOPIC = {
  "customers/data_request": "CUSTOMERS_DATA_REQUEST",
  "customers/redact": "CUSTOMERS_REDACT",
  "shop/redact": "SHOP_REDACT",
} as const;

export type RecordedPrivacyRequest = {
  requestId: string;
  /** True when this webhook id was already recorded. */
  duplicate: boolean;
  /** Null while the request still needs work. */
  resolution: PrivacyRequestResolution | null;
};

function numericId(value: unknown): string | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }
  if (typeof value === "string" && /^\d{1,32}$/.test(value)) return value;
  return null;
}

function field(payload: unknown, key: string): unknown {
  return payload !== null && typeof payload === "object"
    ? (payload as Record<string, unknown>)[key]
    : undefined;
}

export async function recordPrivacyRequest(input: {
  topic: ComplianceTopic;
  verifiedShop: string;
  webhookId: string | null | undefined;
  payload: unknown;
  now?: Date;
}): Promise<RecordedPrivacyRequest> {
  const domain = normalizeShopDomain(input.verifiedShop);
  if (!domain.ok) {
    throw new SyncControlPlaneError(
      "shop_missing",
      `Invalid verified shop domain: ${domain.reason}`,
    );
  }

  const prisma = getControlPlanePrisma();
  const now = input.now ?? new Date();
  const webhookId = input.webhookId?.trim() || null;

  const alreadyRecorded = async () => {
    if (!webhookId) return null;
    const existing = await prisma.privacyRequest.findUnique({
      where: { shopifyWebhookId: webhookId },
      select: { id: true, resolution: true },
    });
    return existing
      ? {
          requestId: existing.id,
          duplicate: true,
          resolution: existing.resolution,
        }
      : null;
  };

  const earlier = await alreadyRecorded();
  if (earlier) return earlier;

  const shop = await prisma.shop.findUnique({
    where: { myshopifyDomain: domain.normalized },
    select: { id: true },
  });

  // ProPo stores no customer records, so a customer request is answered the
  // moment it is recorded. shop/redact is carried out by the worker.
  const customerRequest = input.topic !== "shop/redact";
  const orders = field(
    input.payload,
    input.topic === "customers/data_request"
      ? "orders_requested"
      : "orders_to_redact",
  );

  try {
    const created = await prisma.privacyRequest.create({
      data: {
        topic: STORED_TOPIC[input.topic],
        origin: "SHOPIFY_WEBHOOK",
        shopDomain: domain.normalized,
        shopRecordId: shop?.id ?? null,
        shopifyShopId: numericId(field(input.payload, "shop_id")),
        shopifyWebhookId: webhookId,
        dataRequestId:
          input.topic === "customers/data_request"
            ? numericId(field(field(input.payload, "data_request"), "id"))
            : null,
        ordersListed:
          customerRequest && Array.isArray(orders) ? orders.length : null,
        receivedAt: now,
        dueAt: new Date(now.getTime() + PRIVACY_REQUEST_DUE_DAYS * DAY_MS),
        nextAttemptAt: now,
        resolution: customerRequest ? "NO_CUSTOMER_DATA_HELD" : null,
        resolvedAt: customerRequest ? now : null,
      },
      select: { id: true, resolution: true },
    });
    return {
      requestId: created.id,
      duplicate: false,
      resolution: created.resolution,
    };
  } catch (error) {
    // Two deliveries of the same webhook raced; the other one recorded it.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const winner = await alreadyRecorded();
      if (winner) return winner;
    }
    throw error;
  }
}
