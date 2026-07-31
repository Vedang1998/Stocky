/**
 * Verified admin-request helper.
 *
 * Authority derives only from Shopify authenticate.admin + canonical Shop.
 * Client-supplied shop identifiers never establish or replace authority.
 */

import type { Session } from "@shopify/shopify-api";
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
};

/**
 * @param request Incoming loader/action request
 * @param authenticateAdmin Injectable for tests; defaults to shopify.authenticate.admin
 */
export async function requireAdminTenant(
  request: Request,
  authenticateAdmin?: AuthenticateAdmin,
): Promise<AdminTenantContext> {
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

  await denyConflictingClientShop(request, shop);

  const tenant = issueTenantAuthority({
    shopId: shop.id,
    myshopifyDomain: shop.myshopifyDomain,
    source: "verified_admin_request",
  });

  const db = createTenantDb(tenant);

  return { admin, session, redirect, shop, tenant, db };
}
