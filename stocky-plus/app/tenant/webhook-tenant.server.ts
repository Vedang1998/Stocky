/**
 * Webhook authority derivation after Shopify webhook authentication.
 * Payload shop fields and URL parameters are never authority.
 */

import { randomUUID } from "node:crypto";
import {
  createTenantJobEnvelope,
  type TenantJobEnvelopeV1,
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
  const { tenant } = await resolveAuthorityAfterVerifiedAuth({
    verifiedDomain: verifiedShop,
    source: "verified_webhook",
    correlationId: randomUUID(),
    // Webhooks for installed shops must already have a Shop from afterAuth.
    // createIfMissing=true covers first-delivery races before afterAuth completes.
    createIfMissing: true,
  });

  return {
    tenant,
    envelope: createTenantJobEnvelope(tenant, `webhook:${topic}`),
  };
}
