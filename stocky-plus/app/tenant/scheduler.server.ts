/**
 * Control-plane scheduler helpers — enumerate shops via bootstrap, enqueue
 * one tenant envelope per Shop. Never query merchant-owned ShopSettings globally.
 */

import { randomUUID } from "node:crypto";
import {
  enumerateCanonicalShopsForScheduler,
} from "./bootstrap.server";
import { issueTenantAuthority, type TenantAuthority } from "./authority.server";

export type ScheduledShopJob = {
  shopId: string;
  myshopifyDomain: string;
  tenant: TenantAuthority;
};

export async function planPerShopSchedulerJobs(): Promise<ScheduledShopJob[]> {
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
      tenant,
    };
  });
}
