import { queryRows, type OrderApplyDb } from "../apply/sql";
import { OrderFactsSyncError } from "./errors";

/**
 * Persist B-read Shop timezone/currency through the authorized tenant path.
 * No UTC/currency defaults. Do not widen control-plane column grants.
 */
export async function persistShopTimezoneCurrencyValues(
  db: OrderApplyDb,
  shopId: string,
  input: { ianaTimezone: string; currencyCode: string },
): Promise<void> {
  if (!input.ianaTimezone || !input.currencyCode) {
    throw new OrderFactsSyncError(
      "order_facts_shop_metadata_malformed",
      "Shop.ianaTimezone and Shop.currencyCode must be non-empty Shopify facts",
    );
  }
  const rows = await queryRows<{
    id: string;
    ianaTimezone: string | null;
    currencyCode: string | null;
  }>(db)`UPDATE "Shop"
     SET "ianaTimezone" = ${input.ianaTimezone},
         "currencyCode" = ${input.currencyCode},
         "updatedAt" = clock_timestamp()
     WHERE id = ${shopId}
       AND NULLIF(current_setting('stocky.current_shop_id', true), '') = ${shopId}
     RETURNING id, "ianaTimezone", "currencyCode"`;
  if (rows.length !== 1) {
    throw new OrderFactsSyncError(
      "order_facts_shop_metadata_persist_denied",
      "Tenant Shop timezone/currency UPDATE did not affect the authenticated shop",
    );
  }
  if (
    rows[0].ianaTimezone !== input.ianaTimezone ||
    rows[0].currencyCode !== input.currencyCode
  ) {
    throw new OrderFactsSyncError(
      "order_facts_shop_metadata_persist_mismatch",
      "Persisted Shop timezone/currency did not match the Shopify read",
    );
  }
}
