/**
 * Who performed a purchasing action.
 *
 * Embedded admin requests carry a Shopify session token whose `sub` claim is
 * the staff member's Shopify user id. It is recorded on purchasing events so
 * the history says who did what; it is not an authorization decision.
 */
import {
  requireAdminTenant,
  type AdminTenantContext,
} from "../../tenant/require-admin-tenant.server";

export type PurchasingActor =
  | { type: "STAFF"; id: string | null }
  | { type: "SYSTEM"; id: string };

export type PurchasingContext = AdminTenantContext & { actor: PurchasingActor };

export const systemActor = (id: string): PurchasingActor => ({
  type: "SYSTEM",
  id,
});

function staffUserId(auth: unknown): string | null {
  const sub = (auth as { sessionToken?: { sub?: unknown } }).sessionToken?.sub;
  return typeof sub === "string" && sub.length > 0 && sub.length <= 64
    ? sub
    : null;
}

export async function requirePurchasingContext(input: {
  request: Request;
  params?: Record<string, string | undefined>;
}): Promise<PurchasingContext> {
  let actorId: string | null = null;
  const context = await requireAdminTenant({
    ...input,
    authenticateAdmin: async (request) => {
      const { authenticate } = await import("../../shopify.server");
      const auth = await authenticate.admin(request);
      actorId = staffUserId(auth);
      return auth;
    },
  });
  return { ...context, actor: { type: "STAFF", id: actorId } };
}
