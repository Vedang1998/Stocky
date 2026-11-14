/**
 * Restricted bootstrap boundary.
 *
 * May access only Session and Shop (plus narrow canonical Shop enumeration
 * for control-plane job dispatch). Must not query merchant-owned models.
 * Must not expose the raw Prisma client or arbitrary model delegates.
 */

import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import type { Session } from "@shopify/shopify-api";
import type { ShopProcessingDisabledReason } from "@prisma/client";
import rawPrisma from "../db.server";
import { encryptedSessionStorage } from "../lib/session-tokens/encrypted-session-storage.server";
import {
  SessionTokenError,
  createSessionTokenCipher,
  loadSessionTokenCipher,
} from "../lib/session-tokens/cipher.server";
import {
  issueTenantAuthority,
  type TenantAuthority,
} from "./authority.server";
import { TenantAccessError, TenantAuthorityError } from "./errors";
import { normalizeShopDomain } from "./shop-domain";

export type CanonicalShopIdentity = {
  readonly id: string;
  readonly myshopifyDomain: string;
};

/**
 * Read when this module loads, which is at start-up for both the web server
 * and the worker: a production process without SESSION_TOKEN_ENCRYPTION_KEY
 * stops there instead of starting and failing every authenticated request.
 */
const sessionTokenCipher = loadSessionTokenCipher();

/**
 * Session-storage adapter constructed inside the bootstrap boundary (lazy).
 * Access and refresh tokens are encrypted before they reach the table.
 */
let _shopifySessionStorage: SessionStorage | null = null;

function getShopifySessionStorage(): SessionStorage {
  if (!_shopifySessionStorage) {
    _shopifySessionStorage = encryptedSessionStorage(
      new PrismaSessionStorage(rawPrisma),
      sessionTokenCipher,
    );
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

export type CanonicalShopWithProcessingState = CanonicalShopIdentity & {
  readonly processingEnabled: boolean;
  readonly processingDisabledReason: ShopProcessingDisabledReason | null;
};

export async function resolveCanonicalShopByDomain(
  verifiedDomain: string,
): Promise<CanonicalShopIdentity | null>;
export async function resolveCanonicalShopByDomain(
  verifiedDomain: string,
  options: { withProcessingState: true },
): Promise<CanonicalShopWithProcessingState | null>;
export async function resolveCanonicalShopByDomain(
  verifiedDomain: string,
  options?: { withProcessingState: true },
): Promise<CanonicalShopIdentity | CanonicalShopWithProcessingState | null> {
  const myshopifyDomain = normalizeVerifiedShopifyDomain(verifiedDomain);
  if (options?.withProcessingState) {
    return rawPrisma.shop.findUnique({
      where: { myshopifyDomain },
      select: {
        id: true,
        myshopifyDomain: true,
        processingEnabled: true,
        processingDisabledReason: true,
      },
    });
  }
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

/** Session bootstrap helpers — Session only. */
export async function deleteSessionsForShop(shopDomain: string): Promise<number> {
  const result = await rawPrisma.session.deleteMany({
    where: { shop: shopDomain },
  });
  return result.count;
}

/**
 * Rewrites stored access and refresh tokens that are in the clear or under an
 * older key with the current encryption key. Run it after switching
 * encryption on and after adding a new key, before the old key is removed.
 * A row whose token changes while this runs is left to the writer that
 * changed it. A row that cannot be read (written under a key that is no
 * longer listed, or damaged) is skipped and counted, so one bad row does not
 * stop the rest; the old key may be removed only when a run reports no
 * unreadable rows and nothing rewritten.
 */
type SessionTokenRow = {
  id: string;
  accessToken: string;
  refreshToken: string | null;
};

/** The two Session calls the re-encrypt run makes; a test can wrap them. */
export type SessionTokenTable = {
  findMany(args: {
    select: { id: true; accessToken: true; refreshToken: true };
    where: { id?: { gt: string } };
    orderBy: { id: "asc" };
    take: number;
  }): Promise<SessionTokenRow[]>;
  updateMany(args: {
    where: SessionTokenRow;
    data: { accessToken?: string; refreshToken?: string };
  }): Promise<{ count: number }>;
};

export async function reencryptSessionTokens(
  batchSize = 200,
  table: SessionTokenTable = rawPrisma.session,
): Promise<{ sessions: number; rewritten: number; unreadable: string[] }> {
  const keyList = process.env.SESSION_TOKEN_ENCRYPTION_KEY;
  if (!keyList?.trim()) {
    throw new Error(
      "SESSION_TOKEN_ENCRYPTION_KEY is not set; there is no key to encrypt with",
    );
  }
  // Sealing tokens stored before encryption is what this run is for, so it
  // reads them even where the app refuses clear tokens (production).
  const cipher = createSessionTokenCipher(keyList, { acceptPlaintext: true });
  let sessions = 0;
  let rewritten = 0;
  const unreadable: string[] = [];
  let after: string | undefined;
  for (;;) {
    // Keyset paging: a row deleted between pages (an uninstall) cannot end
    // the run early, as a Prisma cursor on a missing row would.
    const rows = await table.findMany({
      select: { id: true, accessToken: true, refreshToken: true },
      where: after === undefined ? {} : { id: { gt: after } },
      orderBy: { id: "asc" },
      take: batchSize,
    });
    if (rows.length === 0) break;
    for (const row of rows) {
      sessions += 1;
      const staleAccess = row.accessToken !== "" && cipher.isStale(row.accessToken);
      const staleRefresh =
        row.refreshToken !== null && cipher.isStale(row.refreshToken);
      if (!staleAccess && !staleRefresh) continue;

      let data: { accessToken?: string; refreshToken?: string };
      try {
        data = {
          ...(staleAccess
            ? {
                accessToken: cipher.seal(
                  row.id,
                  "accessToken",
                  cipher.open(row.id, "accessToken", row.accessToken),
                ),
              }
            : {}),
          ...(staleRefresh
            ? {
                refreshToken: cipher.seal(
                  row.id,
                  "refreshToken",
                  cipher.open(row.id, "refreshToken", row.refreshToken!),
                ),
              }
            : {}),
        };
      } catch (error) {
        if (!(error instanceof SessionTokenError)) throw error;
        unreadable.push(row.id);
        continue;
      }

      const result = await table.updateMany({
        where: {
          id: row.id,
          accessToken: row.accessToken,
          refreshToken: row.refreshToken,
        },
        data,
      });
      rewritten += result.count;
    }
    after = rows[rows.length - 1].id;
  }
  return { sessions, rewritten, unreadable };
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
