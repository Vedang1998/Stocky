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

export type RequireAdminTenantInput = {
  request: Request;
  params?: Record<string, string | undefined>;
  authenticateAdmin?: AuthenticateAdmin;
  /** How long to wait for a reinstall's afterAuth hook; tests shorten it. */
  reinstallWait?: { timeoutMs: number; pollMs: number };
};

export const REINSTALL_WAIT = { timeoutMs: 5_000, pollMs: 100 } as const;

/**
 * After a reinstall the page's loaders authenticate alongside the request
 * that runs the afterAuth hook, and a loader that found the new session
 * already stored can reach the database before the hook has re-enabled the
 * shop (#123). Every tenant policy hides a disabled shop's rows: reads come
 * back empty and writes are refused. So a request for a shop that the
 * uninstall webhook disabled waits, for a bounded time, until the shop is
 * enabled again.
 *
 * It does not re-enable the shop itself. A request that authenticated with a
 * session stored before the uninstall (the webhook deletes sessions only
 * after it has disabled the shop) must not switch a shop back on that is
 * actually uninstalled: its data would then never be erased. If the hook
 * does not finish in time, the request goes on with the shop disabled, as
 * before.
 */
async function waitForReinstall(
  shop: CanonicalShopIdentity,
  wait: { timeoutMs: number; pollMs: number },
): Promise<void> {
  const deadline = Date.now() + wait.timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, wait.pollMs));
    const state = await resolveCanonicalShopByDomain(shop.myshopifyDomain, {
      withProcessingState: true,
    });
    if (
      !state ||
      state.id !== shop.id ||
      state.processingEnabled !== false ||
      state.processingDisabledReason !== "UNINSTALLED"
    ) {
      return;
    }
  }
}

/**
 * Derive branded tenant authority from a verified admin request.
 * Pass route `params` so conflicting shop identifiers in the path are denied.
 */
export async function requireAdminTenant(
  input: RequireAdminTenantInput,
): Promise<AdminTenantContext> {
  const { request, params, authenticateAdmin } = input;
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
  const found = await resolveCanonicalShopByDomain(normalizedDomain, {
    withProcessingState: true,
  });
  if (!found) {
    throw new TenantAuthorityError(
      "canonical_shop_missing",
      "Canonical Shop missing for authenticated domain — complete afterAuth bootstrap first",
    );
  }
  const shop: CanonicalShopIdentity = {
    id: found.id,
    myshopifyDomain: found.myshopifyDomain,
  };

  await denyConflictingClientShop(request, shop, params);

  if (
    found.processingEnabled === false &&
    found.processingDisabledReason === "UNINSTALLED"
  ) {
    await waitForReinstall(shop, input.reinstallWait ?? REINSTALL_WAIT);
  }

  const tenant = issueTenantAuthority({
    shopId: shop.id,
    myshopifyDomain: shop.myshopifyDomain,
    source: "verified_admin_request",
  });

  const db = createTenantDb(tenant);

  return { admin, session, redirect, shop, tenant, db };
}
