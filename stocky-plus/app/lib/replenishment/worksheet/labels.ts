/** A variant's name as merchants read it. Shopify titles a product's only variant "Default Title". */
export function variantLabel(variant: { productTitle: string; variantTitle: string }): string {
  if (!variant.variantTitle || variant.variantTitle === "Default Title") {
    return variant.productTitle;
  }
  return `${variant.productTitle} - ${variant.variantTitle}`;
}
