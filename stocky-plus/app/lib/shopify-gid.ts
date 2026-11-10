const PRODUCT_VARIANT_GID = /^gid:\/\/shopify\/ProductVariant\/\d{1,20}$/;
const RESOURCE_ID = /\/(\d{1,20})$/;

export function isProductVariantGid(value: string): boolean {
  return PRODUCT_VARIANT_GID.test(value);
}

/** Numeric ID at the end of a Shopify GID, for admin links. */
export function numericIdFromGid(gid: string): string | null {
  return RESOURCE_ID.exec(gid)?.[1] ?? null;
}
