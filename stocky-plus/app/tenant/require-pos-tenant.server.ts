/**
 * Verified POS UI extension request helper.
 *
 * Authority derives only from a Shopify-signed POS session token validated by
 * authenticate.pos. The token's `dest` names the shop; client-supplied shop
 * identifiers never establish or replace authority. POS requests are not
 * backed by an offline session check, so the canonical Shop must still be
 * accepting work.
 */

import type { JwtPayload } from "@shopify/shopify-api";
import { issueTenantAuthority, type TenantAuthority } from "./authority.server";
import {
  normalizeVerifiedShopifyDomain,
  resolveCanonicalShopProcessingState,
  type CanonicalShopIdentity,
} from "./bootstrap.server";
import { denyConflictingClientShop } from "./client-shop.server";
import { TenantAuthorityError } from "./errors";
import { createTenantDb, type TenantDb } from "./tenant-db.server";

type AuthenticatePos = (request: Request) => Promise<{
  sessionToken: JwtPayload;
  cors: (response: Response) => Response;
}>;

/** Who performed a POS action, in the shape shared by operational services. */
export type PosActor = {
  readonly shopifyUserId: string | null;
  readonly displayName: null;
  readonly channel: "POS";
};

export type PosTenantContext = {
  shop: CanonicalShopIdentity;
  tenant: TenantAuthority;
  db: TenantDb;
  actor: PosActor;
  /** Adds the CORS headers POS needs to read the response. */
  cors: (response: Response) => Response;
};

export type RequirePosTenantInput = {
  request: Request;
  params?: Record<string, string | undefined>;
  authenticatePos?: AuthenticatePos;
  /** Expected token audience; defaults to SHOPIFY_API_KEY. */
  apiKey?: string;
};

function audienceMatches(aud: JwtPayload["aud"], apiKey: string): boolean {
  const audiences: unknown[] = Array.isArray(aud) ? aud : [aud];
  return audiences.some((value) => value === apiKey);
}

function domainFromDest(dest: unknown): string {
  if (typeof dest !== "string" || dest.length === 0) {
    throw new TenantAuthorityError(
      "malformed_authenticated_domain",
      "POS session token has no destination shop",
    );
  }
  // Shopify issues `dest` as an https origin on admin and POS tokens and as a
  // bare domain on other extension tokens. Anything else (path, port, query,
  // other scheme) fails shop-domain normalization.
  const host = dest.startsWith("https://") ? dest.slice("https://".length) : dest;
  return normalizeVerifiedShopifyDomain(host);
}

/** Numeric Shopify user ID from a token subject ("42" or a User GID). */
function shopifyUserIdFromSubject(sub: unknown): string | null {
  if (typeof sub !== "string") return null;
  const match = /^(?:gid:\/\/shopify\/User\/)?(\d+)$/.exec(sub);
  return match ? match[1] : null;
}

/**
 * Derive branded tenant authority from a verified POS extension request.
 * Throws the Response produced by authenticate.pos for missing or invalid
 * tokens and for CORS preflight requests.
 */
export async function requirePosTenant(
  input: RequirePosTenantInput,
): Promise<PosTenantContext> {
  const { request, params } = input;
  const authenticate =
    input.authenticatePos ??
    (await import("../shopify.server")).authenticate.pos;

  const { sessionToken, cors } = await authenticate(request);

  // authenticate.pos verifies the signature with the app secret but skips
  // the audience check; enforce it so only tokens minted for this app count.
  const apiKey = input.apiKey ?? process.env.SHOPIFY_API_KEY ?? "";
  if (!apiKey || !audienceMatches(sessionToken.aud, apiKey)) {
    throw new TenantAuthorityError(
      "token_audience_mismatch",
      "POS session token was not issued for this app",
    );
  }

  const domain = domainFromDest(sessionToken.dest);
  const resolved = await resolveCanonicalShopProcessingState(domain);
  if (!resolved) {
    throw new TenantAuthorityError(
      "canonical_shop_missing",
      "Canonical Shop missing for authenticated POS domain",
    );
  }
  if (!resolved.processingEnabled) {
    throw new TenantAuthorityError(
      "shop_processing_disabled",
      "Shop is uninstalled, redacted or paused",
    );
  }

  await denyConflictingClientShop(request, resolved.shop, params);

  const tenant = issueTenantAuthority({
    shopId: resolved.shop.id,
    myshopifyDomain: resolved.shop.myshopifyDomain,
    source: "verified_pos_request",
  });

  const actor: PosActor = Object.freeze({
    shopifyUserId: shopifyUserIdFromSubject(sessionToken.sub),
    displayName: null,
    channel: "POS",
  });

  return {
    shop: resolved.shop,
    tenant,
    db: createTenantDb(tenant),
    actor,
    cors,
  };
}
