import { readShopReportingProfile } from "../../tenant/bootstrap.server";
import type { TenantAuthority } from "../../tenant/authority.server";
import { usableTimeZone } from "./shop-time";

/**
 * The time zone the shop's pages show times in: the one Shopify gave for the
 * shop, as stored by the last sync. null until it has been synced, or when
 * this runtime does not know the zone; times are then shown in UTC.
 *
 * It is read from the database, so a page load asks Shopify nothing for it.
 */
export async function readShopTimeZone(
  tenant: TenantAuthority,
): Promise<string | null> {
  const profile = await readShopReportingProfile(tenant);
  return usableTimeZone(profile.ianaTimezone);
}
