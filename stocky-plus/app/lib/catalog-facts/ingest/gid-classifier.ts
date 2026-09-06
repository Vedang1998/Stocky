import type { JsonlBulkDomain, JsonlResourceKind } from "./types";

const PREFIX_TO_KIND: ReadonlyArray<readonly [string, JsonlResourceKind]> = [
  ["gid://shopify/Product/", "Product"],
  ["gid://shopify/ProductVariant/", "ProductVariant"],
  ["gid://shopify/InventoryItem/", "InventoryItem"],
  ["gid://shopify/Location/", "Location"],
  ["gid://shopify/InventoryLevel/", "InventoryLevel"],
  ["gid://shopify/Collection/", "Collection"],
];

export class UnknownJsonlIdentityError extends Error {
  readonly code = "unknown_jsonl_identity" as const;

  constructor(id: unknown) {
    super(`JSONL line has an unknown or missing Shopify GID: ${String(id)}`);
    this.name = "UnknownJsonlIdentityError";
  }
}

export function classifyJsonlGid(
  id: unknown,
  domain: JsonlBulkDomain,
): { resourceKind: JsonlResourceKind; root: boolean } {
  if (typeof id !== "string" || id.length === 0) {
    throw new UnknownJsonlIdentityError(id);
  }
  const match = PREFIX_TO_KIND.find(([prefix]) => id.startsWith(prefix));
  if (!match) {
    throw new UnknownJsonlIdentityError(id);
  }
  const resourceKind = match[1];
  const root =
    (domain === "catalog" && resourceKind === "Product") ||
    (domain === "inventory_levels" && resourceKind === "InventoryItem");
  return { resourceKind, root };
}
