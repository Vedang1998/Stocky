/**
 * Control-plane scheduler helpers — enumerate shops via bootstrap, enqueue
 * one tenant envelope per Shop. Never query merchant-owned ShopSettings globally.
 */

import { randomUUID } from "node:crypto";
import {
  enumerateCanonicalShopsForScheduler,
} from "./bootstrap.server";
import {
  createTenantJobEnvelope,
  type TenantJobEnvelopeV1,
} from "./job-envelope.server";
import { issueTenantAuthority } from "./authority.server";

export type ScheduledShopJob = {
  shopId: string;
  myshopifyDomain: string;
  envelope: TenantJobEnvelopeV1;
};

export async function planPerShopSchedulerJobs(
  source: string,
): Promise<ScheduledShopJob[]> {
  const shops = await enumerateCanonicalShopsForScheduler();
  const correlationRoot = randomUUID();

  return shops.map((shop) => {
    const tenant = issueTenantAuthority({
      shopId: shop.id,
      myshopifyDomain: shop.myshopifyDomain,
      source: "verified_scheduler",
      correlationId: randomUUID(),
      causationId: correlationRoot,
    });
    return {
      shopId: shop.id,
      myshopifyDomain: shop.myshopifyDomain,
      envelope: createTenantJobEnvelope(tenant, source),
    };
  });
}
