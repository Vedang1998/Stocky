/**
 * The shop's currency and time zone, read from Shopify. Purchasing uses the
 * time zone to decide what "today" is for order dates and overdue lists.
 */
import { todayInTimeZone } from "../../lib/purchasing/form-input";
import { shopifyGraphQL, type AdminGraphQLClient } from "../shopify-gql.server";

export type ShopProfile = {
  currencyCode: string | null;
  ianaTimezone: string | null;
  /** The merchant's calendar date as YYYY-MM-DD; null when the time zone is unknown. */
  today: string | null;
};

export async function readShopProfile(
  admin: AdminGraphQLClient,
  now: Date = new Date(),
): Promise<ShopProfile> {
  const result = await shopifyGraphQL<{
    shop: { currencyCode: string | null; ianaTimezone: string | null } | null;
  }>(
    admin,
    `#graphql
      query StockyPurchasingShopProfile {
        shop {
          currencyCode
          ianaTimezone
        }
      }`,
  );
  const shop = result.data?.shop ?? null;
  const ianaTimezone = shop?.ianaTimezone ?? null;
  return {
    currencyCode: shop?.currencyCode ?? null,
    ianaTimezone,
    today: todayInTimeZone(ianaTimezone, now),
  };
}
