import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import { grantShopRole, revokeShopRole } from "../rbac/assignment.server";
import { ActorBoundaryError } from "../rbac/errors.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireAdminTenant({ request, params });
  if (ctx.actor.status !== "verified") {
    throw new Response("platform_denied", { status: 403 });
  }
  return { shop: ctx.shop.myshopifyDomain, actor: ctx.actor.actor.shopifyUserId };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const ctx = await requireAdminTenant({ request, params });
  if (ctx.actor.status !== "verified") {
    throw new Response("platform_denied", { status: 403 });
  }
  const body = (await request.json()) as {
    op?: string;
    targetShopifyUserId?: string;
    role?: "shop_owner" | "shop_admin";
  };
  try {
    if (body.op === "grant") {
      await grantShopRole({
        tenant: ctx.tenant,
        targetShopifyUserId: String(body.targetShopifyUserId ?? ""),
        role: body.role === "shop_owner" ? "shop_owner" : "shop_admin",
        grantedBy: ctx.actor.actor.shopifyUserId,
      });
    } else if (body.op === "revoke") {
      await revokeShopRole({
        tenant: ctx.tenant,
        targetShopifyUserId: String(body.targetShopifyUserId ?? ""),
        role: body.role === "shop_owner" ? "shop_owner" : "shop_admin",
        revokedBy: ctx.actor.actor.shopifyUserId,
      });
    } else {
      throw new Response("unsupported_op", { status: 400 });
    }
  } catch (error) {
    if (error instanceof ActorBoundaryError) {
      throw new Response(error.code, { status: 403 });
    }
    throw error;
  }
  return { ok: true };
}
