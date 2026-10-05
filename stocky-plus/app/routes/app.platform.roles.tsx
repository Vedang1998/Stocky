import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  grantShopRole,
  requirePlatformOwner,
  revokeShopRole,
} from "../rbac/assignment.server";
import { ActorBoundaryError } from "../rbac/errors.server";

/**
 * Owner-only role grant/revoke. Same-origin embedded admin (R1-01 deferred:
 * no POS/extension/cross-origin caller).
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const { ctx, proof } = await requirePlatformOwner({
    request,
    params,
    auditAction: "role.authorize",
  });
  return { shop: ctx.shop.myshopifyDomain, actor: proof.actor.shopifyUserId };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { ctx, proof } = await requirePlatformOwner({
    request,
    params,
    auditAction: "role.grant",
  });
  const body = (await request.json()) as {
    op?: string;
    targetShopifyUserId?: string;
    role?: string;
  };
  if (body.role !== "shop_owner" && body.role !== "shop_admin") {
    throw new Response("unsupported_role", { status: 400 });
  }
  try {
    if (body.op === "grant") {
      await grantShopRole({
        tenant: ctx.tenant,
        targetShopifyUserId: String(body.targetShopifyUserId ?? ""),
        role: body.role,
        owner: proof,
        request,
      });
    } else if (body.op === "revoke") {
      await revokeShopRole({
        tenant: ctx.tenant,
        targetShopifyUserId: String(body.targetShopifyUserId ?? ""),
        role: body.role,
        owner: proof,
        request,
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
