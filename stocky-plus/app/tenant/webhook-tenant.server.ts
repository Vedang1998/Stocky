/**
 * Webhook authority derivation after Shopify webhook authentication.
 * Payload shop fields and URL parameters are never authority.
 *
 * F-PR2-07 / C-07: canonical Shop creation remains the verified afterAuth
 * install path. Webhook resolution requires the Shop to already exist.
 * Shopify redelivery covers the narrow first-delivery race before afterAuth
 * completes. No Shop provenance schema is added in this correction cycle.
 */

import { randomUUID } from "node:crypto";
import {
  createTenantJobEnvelope,
  type TenantJobEnvelopeV1,
  type TenantJobSource,
} from "./job-envelope.server";
import {
  resolveAuthorityAfterVerifiedAuth,
} from "./bootstrap.server";
import type { TenantAuthority } from "./authority.server";

export type WebhookTenantResult = {
  tenant: TenantAuthority;
  envelope: TenantJobEnvelopeV1;
};

/**
 * @param verifiedShop Domain from authenticate.webhook (Shopify-verified)
 * @param topic Webhook topic for envelope source labeling
 */
export async function resolveWebhookTenant(
  verifiedShop: string,
  topic: string,
): Promise<WebhookTenantResult> {
  const source = `webhook:${topic}` as TenantJobSource;

  const { tenant } = await resolveAuthorityAfterVerifiedAuth({
    verifiedDomain: verifiedShop,
    source: "verified_webhook",
    correlationId: randomUUID(),
    // C-07: do not create canonical Shop outside the install/afterAuth path.
    createIfMissing: false,
  });

  return {
    tenant,
    envelope: createTenantJobEnvelope(tenant, source),
  };
}
