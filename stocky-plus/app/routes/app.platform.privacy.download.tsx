import type { LoaderFunctionArgs } from "react-router";
import { requirePlatformOwner } from "../rbac/assignment.server";
import { downloadDataRequestArtifact } from "../privacy/fulfillment.server";
import { PrivacyBoundaryError } from "../privacy/errors.server";

/**
 * Owner-only data-request download. Authorization at use. Expiry is synthetic
 * fixture TTL, not a legal Q008 default. Same-origin embedded admin
 * (R1-01 deferred: no POS/extension/cross-origin caller).
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const { ctx, proof } = await requirePlatformOwner({
    request,
    params,
    auditAction: "privacy.data_request.download",
  });
  const url = new URL(request.url);
  const requestId = url.searchParams.get("requestId") ?? "";
  try {
    const artifact = await downloadDataRequestArtifact({
      requestId,
      owner: proof,
      shopId: ctx.shop.id,
      canonicalDomain: ctx.shop.myshopifyDomain,
      tenant: ctx.tenant,
      request,
    });
    return new Response(new Uint8Array(artifact.body), {
      headers: {
        "content-type": "application/octet-stream",
        "x-artifact-expires-at": artifact.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof PrivacyBoundaryError) {
      throw new Response(error.code, { status: 403 });
    }
    throw error;
  }
}
