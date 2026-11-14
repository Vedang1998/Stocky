/**
 * Restricted bootstrap boundary.
 *
 * May access only Session and Shop (plus narrow canonical Shop enumeration
 * for control-plane job dispatch). Must not query merchant-owned models.
 * Must not expose the raw Prisma client or arbitrary model delegates.
 */

import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import type { Session } from "@shopify/shopify-api";
import rawPrisma from "../db.server";
import {
  assertTenantAuthority,
  issueTenantAuthority,
  type TenantAuthority,
} from "./authority.server";
import { TenantAccessError, TenantAuthorityError } from "./errors";
import { normalizeShopDomain } from "./shop-domain";

export type CanonicalShopIdentity = {
  readonly id: string;
  readonly myshopifyDomain: string;
};

/** Session-storage adapter constructed inside the bootstrap boundary (lazy). */
type SessionStorage = PrismaSessionStorage<typeof rawPrisma>;

let _shopifySessionStorage: SessionStorage | null = null;

function getShopifySessionStorage(): SessionStorage {
  if (!_shopifySessionStorage) {
    _shopifySessionStorage = new PrismaSessionStorage(rawPrisma);
  }
  return _shopifySessionStorage;
}

export const shopifySessionStorage: SessionStorage = new Proxy(
  {} as SessionStorage,
  {
    get(_target, prop, receiver) {
      const storage = getShopifySessionStorage() as unknown as Record<
        PropertyKey,
        unknown
      >;
      const value = Reflect.get(storage, prop, receiver);
      return typeof value === "function" ? value.bind(storage) : value;
    },
  },
);

export function normalizeVerifiedShopifyDomain(raw: string): string {
  const result = normalizeShopDomain(raw);
  if (!result.ok) {
    throw new TenantAuthorityError(
      "malformed_authenticated_domain",
      `Authenticated shop domain failed phase1-shop-domain-v1 normalization: ${result.reason}`,
    );
  }
  return result.normalized;
}

export async function upsertCanonicalShop(
  verifiedDomain: string,
): Promise<CanonicalShopIdentity> {
  const myshopifyDomain = normalizeVerifiedShopifyDomain(verifiedDomain);
  const shop = await rawPrisma.shop.upsert({
    where: { myshopifyDomain },
    create: { myshopifyDomain },
    update: {},
    select: { id: true, myshopifyDomain: true },
  });
  return shop;
}

export async function resolveCanonicalShopByDomain(
  verifiedDomain: string,
): Promise<CanonicalShopIdentity | null> {
  const myshopifyDomain = normalizeVerifiedShopifyDomain(verifiedDomain);
  return rawPrisma.shop.findUnique({
    where: { myshopifyDomain },
    select: { id: true, myshopifyDomain: true },
  });
}

/**
 * Canonical Shop plus whether it still accepts work. Processing is disabled
 * after uninstall, privacy redaction or a manual stop; callers that are not
 * backed by a live offline session (e.g. POS extension requests) must check it.
 */
export async function resolveCanonicalShopProcessingState(
  verifiedDomain: string,
): Promise<{ shop: CanonicalShopIdentity; processingEnabled: boolean } | null> {
  const myshopifyDomain = normalizeVerifiedShopifyDomain(verifiedDomain);
  const row = await rawPrisma.shop.findUnique({
    where: { myshopifyDomain },
    select: { id: true, myshopifyDomain: true, processingEnabled: true },
  });
  if (!row) return null;
  return {
    shop: { id: row.id, myshopifyDomain: row.myshopifyDomain },
    processingEnabled: row.processingEnabled,
  };
}

export async function resolveCanonicalShopById(
  shopId: string,
): Promise<CanonicalShopIdentity | null> {
  if (!shopId || typeof shopId !== "string") {
    return null;
  }
  return rawPrisma.shop.findUnique({
    where: { id: shopId },
    select: { id: true, myshopifyDomain: true },
  });
}

/**
 * Resolve canonical Shop and require ID + domain consistency.
 * Fails closed on missing or mismatched identity.
 */
export async function requireCanonicalShopMatch(input: {
  shopId: string;
  myshopifyDomain: string;
}): Promise<CanonicalShopIdentity> {
  const normalized = normalizeVerifiedShopifyDomain(input.myshopifyDomain);
  const byId = await resolveCanonicalShopById(input.shopId);
  if (!byId) {
    throw new TenantAuthorityError(
      "canonical_shop_missing",
      "Canonical Shop not found for shopId",
    );
  }
  if (byId.myshopifyDomain !== normalized) {
    throw new TenantAuthorityError(
      "canonical_shop_mismatch",
      "Canonical Shop id/domain mismatch",
    );
  }
  return byId;
}

/**
 * After verified Shopify authentication: upsert Shop and issue scheduler/admin
 * bootstrap authority used only to establish tenant-bound access next.
 */
export async function resolveAuthorityAfterVerifiedAuth(input: {
  verifiedDomain: string;
  source: "verified_admin_request" | "verified_webhook" | "verified_scheduler";
  correlationId?: string;
  causationId?: string;
  /** When false, missing Shop fails closed (no create). Default true for afterAuth. */
  createIfMissing?: boolean;
}): Promise<{ shop: CanonicalShopIdentity; tenant: TenantAuthority }> {
  const createIfMissing = input.createIfMissing !== false;
  const shop = createIfMissing
    ? await upsertCanonicalShop(input.verifiedDomain)
    : await resolveCanonicalShopByDomain(input.verifiedDomain);

  if (!shop) {
    throw new TenantAuthorityError(
      "canonical_shop_missing",
      "Canonical Shop missing for verified domain",
    );
  }

  const tenant = issueTenantAuthority({
    shopId: shop.id,
    myshopifyDomain: shop.myshopifyDomain,
    source: input.source,
    correlationId: input.correlationId,
    causationId: input.causationId,
  });

  return { shop, tenant };
}

/**
 * Control-plane only: enumerate canonical Shop identities to enqueue
 * isolated per-shop jobs. Does not return merchant data or raw Prisma.
 */
export async function enumerateCanonicalShopsForScheduler(): Promise<
  CanonicalShopIdentity[]
> {
  return rawPrisma.shop.findMany({
    where: { processingEnabled: true },
    select: { id: true, myshopifyDomain: true },
    orderBy: { myshopifyDomain: "asc" },
  });
}

export type ShopReportingProfile = {
  /** Shopify `Shop.ianaTimezone`; null until order-facts sync records it. */
  readonly ianaTimezone: string | null;
  /** Shopify `Shop.currencyCode`; null until order-facts sync records it. */
  readonly currencyCode: string | null;
  /** When the app first created this shop's canonical row (first install). */
  readonly installedAt: Date;
};

/**
 * Read-only shop facts that reports need for calendar days, money and history
 * coverage. Scoped to the caller's verified tenant; returns nothing else.
 */
export async function readShopReportingProfile(
  tenant: TenantAuthority,
): Promise<ShopReportingProfile> {
  assertTenantAuthority(tenant);
  const shop = await rawPrisma.shop.findUnique({
    where: { id: tenant.shopId },
    select: { ianaTimezone: true, currencyCode: true, createdAt: true },
  });
  if (!shop) {
    throw new TenantAuthorityError(
      "canonical_shop_missing",
      "Canonical Shop missing for tenant authority",
    );
  }
  return {
    ianaTimezone: shop.ianaTimezone,
    currencyCode: shop.currencyCode,
    installedAt: shop.createdAt,
  };
}

/** Session bootstrap helpers — Session only. */
export async function deleteSessionsForShop(shopDomain: string): Promise<number> {
  const result = await rawPrisma.session.deleteMany({
    where: { shop: shopDomain },
  });
  return result.count;
}

/**
 * Record the scopes Shopify reports for a shop on its offline session(s).
 * Returns the number of sessions updated; zero when none is stored, which is
 * normal after an uninstall.
 */
export async function updateOfflineSessionScope(input: {
  shopDomain: string;
  scope: string;
}): Promise<number> {
  const result = await rawPrisma.session.updateMany({
    where: { shop: input.shopDomain, isOnline: false },
    data: { scope: input.scope },
  });
  return result.count;
}

/**
 * Intentionally unavailable — bootstrap must not expose merchant delegates.
 * Architecture tests assert this export pattern remains absent.
 */
export function getMerchantDelegate(): never {
  throw new TenantAccessError(
    "bootstrap_merchant_denied",
    "Bootstrap boundary cannot access merchant-owned model delegates",
  );
}

/** Type-only re-export helper for session storage consumers. */
export type { Session };
