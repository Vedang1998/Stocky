/**
 * Identifiers for what a plan covers. A stock scope is either the whole shop
 * ("SHOP", all locations together) or one Shopify location.
 */

export const SHOP_SCOPE = "SHOP";

// Shopify ids are 64-bit integers, so at most 20 digits.
const VARIANT_GID = /^gid:\/\/shopify\/ProductVariant\/\d{1,20}$/;
const LOCATION_GID = /^gid:\/\/shopify\/Location\/\d{1,20}$/;

export function isVariantGid(value: unknown): value is string {
  return typeof value === "string" && VARIANT_GID.test(value);
}

export function isLocationGid(value: unknown): value is string {
  return typeof value === "string" && LOCATION_GID.test(value);
}

export function isScopeKey(value: unknown): value is string {
  return value === SHOP_SCOPE || isLocationGid(value);
}
