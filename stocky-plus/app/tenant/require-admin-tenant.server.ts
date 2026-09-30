/**
 * Verified admin-request helper.
 *
 * Authority derives only from Shopify authenticate.admin + canonical Shop.
 * Client-supplied shop identifiers never establish or replace authority.
 *
 * PR7 checkpoint A: when an embedded ID token is present, cryptographic
 * claims and iss/dest agreement are checked BEFORE authenticate.admin.
 * Actor identity is attached for platform powers; merchandising remains
 * tenant-only (D-PR7-07). Owner proof is not consumed here.
 */

import type { Session } from "@shopify/shopify-api";
import {
  gateAdminRequestIdentity,
  type ShopifyVerifier,
} from "../rbac/admin-auth-boundary.server";
import type { ActorResolution } from "../rbac/actor.server";
import {
  issueTenantAuthority,
  type TenantAuthority,
} from "./authority.server";
import {
  normalizeVerifiedShopifyDomain,
  resolveCanonicalShopByDomain,
  type CanonicalShopIdentity,
} from "./bootstrap.server";
import { denyConflictingClientShop } from "./client-shop.server";
import { TenantAuthorityError } from "./errors";
import { createTenantDb, type TenantDb } from "./tenant-db.server";

type AdminAuthResult = Awaited<
  ReturnType<
    Awaited<typeof import("../shopify.server")>["authenticate"]["admin"]
  >
>;

type AdminClient = AdminAuthResult["admin"];
type AdminRedirect = AdminAuthResult extends { redirect: infer R } ? R : never;

type AuthenticateAdmin = (
  request: Request,
) => Promise<
  { admin: AdminClient; session: Session } & Partial<{ redirect: AdminRedirect }>
>;

export type AdminTenantContext = {
  admin: AdminClient;
  session: Session;
  /** Embedded-app redirect helper from authenticate.admin when available. */
  redirect: AdminRedirect | undefined;
  shop: CanonicalShopIdentity;
  tenant: TenantAuthority;
  db: TenantDb;
  /** Verified actor or absent/unsupported. Not an owner grant. */
  actor: ActorResolution;
};

export type RequireAdminTenantInput = {
  request: Request;
  params?: Record<string, string | undefined>;
  authenticateAdmin?: AuthenticateAdmin;
  /** Test override for ID-token verification. Production uses env secrets. */
  identityVerifier?: ShopifyVerifier;
};

/**
 * Derive branded tenant authority from a verified admin request.
 * Pass route `params` so conflicting shop identifiers in the path are denied.
 */
export async function requireAdminTenant(
  input: RequireAdminTenantInput,
): Promise<AdminTenantContext> {
  const { request, params, authenticateAdmin, identityVerifier } = input;

  const identity = await gateAdminRequestIdentity({
    request,
    verifier: identityVerifier,
  });

  const authenticate =
    authenticateAdmin ??
    (await import("../shopify.server")).authenticate.admin;

  const auth = await authenticate(request);
  const { admin, session } = auth;
  const redirect =
    "redirect" in auth
      ? (auth as { redirect: AdminRedirect }).redirect
      : undefined;

  const normalizedDomain = normalizeVerifiedShopifyDomain(session.shop);
  const shop = await resolveCanonicalShopByDomain(normalizedDomain);
  if (!shop) {
    throw new TenantAuthorityError(
      "canonical_shop_missing",
      "Canonical Shop missing for authenticated domain — complete afterAuth bootstrap first",
    );
  }

  await denyConflictingClientShop(request, shop, params);

  const tenant = issueTenantAuthority({
    shopId: shop.id,
    myshopifyDomain: shop.myshopifyDomain,
    source: "verified_admin_request",
  });

  const db = createTenantDb(tenant);

  return { admin, session, redirect, shop, tenant, db, actor: identity.actor };
}
