import {
  requireAdminTenant,
  type AdminTenantContext,
  type RequireAdminTenantInput,
} from "../../tenant/require-admin-tenant.server";
import { InventoryPermissionError } from "./errors";
import type { InventoryActor } from "./types";

type AuthenticateAdmin = NonNullable<
  RequireAdminTenantInput["authenticateAdmin"]
>;

export type InventoryActorContext = AdminTenantContext & {
  actor: InventoryActor;
};

export const STAFF_REQUIRED_MESSAGE =
  "Inventory changes need a signed-in Shopify staff member. Open the app from Shopify admin and try again.";

const SHOPIFY_USER_ID = /^\d{1,20}$/;

/**
 * Staff identity from the verified App Bridge session token, or null when the
 * request carries none. The app uses offline access tokens, so the session
 * itself never names the user; `sub` of the token Shopify signed for this
 * request does.
 */
export function readAdminActor(token: unknown): InventoryActor | null {
  const sub = (token as { sub?: unknown } | null | undefined)?.sub;
  if (typeof sub !== "string" || !SHOPIFY_USER_ID.test(sub)) return null;
  return { shopifyUserId: sub, displayName: null, channel: "ADMIN" };
}

export function adminActorFromSessionToken(token: unknown): InventoryActor {
  const actor = readAdminActor(token);
  if (!actor) throw new InventoryPermissionError(STAFF_REQUIRED_MESSAGE);
  return actor;
}

/**
 * requireAdminTenant that also reports who is acting. Use it on routes where
 * only some intents write inventory; those intents must refuse a null actor.
 */
export async function requireAdminTenantWithActor(
  input: RequireAdminTenantInput,
): Promise<AdminTenantContext & { actor: InventoryActor | null }> {
  const authenticate: AuthenticateAdmin =
    input.authenticateAdmin ??
    (await import("../../shopify.server")).authenticate.admin;

  let sessionToken: unknown;
  const context = await requireAdminTenant({
    request: input.request,
    params: input.params,
    authenticateAdmin: async (request) => {
      const auth = await authenticate(request);
      sessionToken = (auth as { sessionToken?: unknown }).sessionToken;
      return auth;
    },
  });

  return { ...context, actor: readAdminActor(sessionToken) };
}

/** For requests that only write inventory: refuses when no staff member is named. */
export async function requireInventoryActorContext(
  input: RequireAdminTenantInput,
): Promise<InventoryActorContext> {
  const context = await requireAdminTenantWithActor(input);
  if (!context.actor)
    throw new InventoryPermissionError(STAFF_REQUIRED_MESSAGE);
  return { ...context, actor: context.actor };
}
