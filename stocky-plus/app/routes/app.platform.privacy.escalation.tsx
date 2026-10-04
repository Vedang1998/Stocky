import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import { proveShopOwner } from "../rbac/owner-proof.server";
import { gateAdminRequestIdentity, verifierFromEnv } from "../rbac/admin-auth-boundary.server";
import { operatorInspectPrivacyRequest } from "../privacy/operator-resolve.server";

/**
 * Owner-only escalation view. Does not waive erasure or mark complete.
 * R1-01: this route is same-origin embedded admin, not a POS/extension caller.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const ctx = await requireAdminTenant({ request, params });
  if (ctx.actor.status !== "verified") {
    throw new Response("platform_denied", { status: 403 });
  }
  const identity = await gateAdminRequestIdentity({ request });
  if (!identity.idToken || !identity.verifiedActor) {
    throw new Response("owner_proof_required", { status: 403 });
  }
  const proof = await proveShopOwner({
    request,
    verifier: verifierFromEnv(),
    actor: identity.verifiedActor,
    idToken: identity.idToken,
  });
  if (proof.status !== "owner") {
    throw new Response(proof.code, { status: 403 });
  }
  return { shop: ctx.shop.myshopifyDomain, owner: true };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const url = new URL(request.url);
  if (url.searchParams.get("operator") === "1") {
    const body = (await request.json()) as {
      requestId?: string;
      operatorToken?: string;
    };
    return operatorInspectPrivacyRequest({
      requestId: String(body.requestId ?? ""),
      operatorToken: String(body.operatorToken ?? ""),
    });
  }
  await loader({ request, params, context: {} } as LoaderFunctionArgs);
  throw new Response("escalation_view_only", { status: 400 });
}
