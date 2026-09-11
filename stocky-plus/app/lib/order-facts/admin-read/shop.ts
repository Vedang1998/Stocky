import { SHOP_TIMEZONE_CURRENCY_QUERY } from "./documents";
import { executeBudgetedQuery } from "./budgeted-execute";
import { OrderFactReadWalkError } from "./errors";
import { requireNonEmptyString } from "./decimal";
import { createRequestCostAccumulator, walkErrorToResult } from "./result";
import { assertTrustedOrderAdminReadContext } from "./tenant";
import {
  ORDER_ADMIN_READ_MAX_REQUESTS,
} from "./constants";
import type {
  OrderAdminReadContext,
  OrderReadResult,
  ShopTimezoneCurrencyRead,
} from "./types";

type ShopQueryData = {
  shop?: {
    id?: unknown;
    ianaTimezone?: unknown;
    currencyCode?: unknown;
  } | null;
};

/**
 * Read Shop.ianaTimezone and Shop.currencyCode. Do not persist.
 */
export async function readShopTimezoneCurrency(
  context: OrderAdminReadContext,
): Promise<OrderReadResult<ShopTimezoneCurrencyRead>> {
  const cost = createRequestCostAccumulator();
  try {
    await assertTrustedOrderAdminReadContext(context);
    const json = await executeBudgetedQuery<ShopQueryData>(
      context.admin,
      SHOP_TIMEZONE_CURRENCY_QUERY,
      undefined,
      cost,
      ORDER_ADMIN_READ_MAX_REQUESTS,
    );
    const shop = json.data?.shop;
    if (shop == null) {
      throw new OrderFactReadWalkError(
        "ADMIN_READ_ERROR",
        "shop query returned no shop",
      );
    }
    return {
      status: "complete",
      value: {
        shopGid: requireNonEmptyString(shop.id, "shop.id"),
        ianaTimezone: requireNonEmptyString(
          shop.ianaTimezone,
          "shop.ianaTimezone",
        ),
        currencyCode: requireNonEmptyString(
          shop.currencyCode,
          "shop.currencyCode",
        ),
      },
      cost,
    };
  } catch (error) {
    return walkErrorToResult(error, cost);
  }
}
