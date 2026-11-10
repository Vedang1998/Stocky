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

const SHOPIFY_USER_ID = /^\d{1,20}$/;

/**
 * Staff identity from the verified App Bridge session token. The app uses
 * offline access tokens, so the session itself never names the user; `sub` of
 * the token Shopify signed for this request does.
 */
export function adminActorFromSessionToken(token: unknown): InventoryActor {
  const sub = (token as { sub?: unknown } | null | undefined)?.sub;
  if (typeof sub !== "string" || !SHOPIFY_USER_ID.test(sub)) {
    throw new InventoryPermissionError(
      "Inventory changes need a signed-in Shopify staff member. Open the app from Shopify admin and try again.",
    );
  }
  return { shopifyUserId: sub, displayName: null, channel: "ADMIN" };
}

/**
 * requireAdminTenant for requests that write inventory: also resolves the
 * staff member who is acting, and refuses requests that cannot name one.
 */
export async function requireInventoryActorContext(
  input: RequireAdminTenantInput,
): Promise<InventoryActorContext> {
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

  return { ...context, actor: adminActorFromSessionToken(sessionToken) };
}
