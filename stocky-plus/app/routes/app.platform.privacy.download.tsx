import type { LoaderFunctionArgs } from "react-router";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import { proveShopOwner } from "../rbac/owner-proof.server";
import { gateAdminRequestIdentity, verifierFromEnv } from "../rbac/admin-auth-boundary.server";
import { downloadDataRequestArtifact } from "../privacy/fulfillment.server";

/**
 * Owner-only data-request download. Authorization at use. Expiry is synthetic
 * fixture TTL, not a legal Q008 default.
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
  const url = new URL(request.url);
  const requestId = url.searchParams.get("requestId") ?? "";
  const artifact = await downloadDataRequestArtifact({
    requestId,
    owner: proof,
  });
  return new Response(artifact.body, {
    headers: {
      "content-type": "application/octet-stream",
      "x-artifact-expires-at": artifact.expiresAt.toISOString(),
    },
  });
}
