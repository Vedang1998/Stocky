import {
  CATALOG_FACT_INVENTORY_ITEM_QUERY,
  CATALOG_FACT_INVENTORY_LEVEL_BY_ID_QUERY,
  CATALOG_FACT_INVENTORY_LEVEL_BY_PAIR_QUERY,
  CATALOG_FACT_LOCATION_QUERY,
  CATALOG_FACT_PRODUCT_COLLECTIONS_QUERY,
  CATALOG_FACT_PRODUCT_QUERY,
  CATALOG_FACT_PRODUCT_VARIANT_QUERY,
  CATALOG_FACT_SHOP_CURRENCY_QUERY,
  INVENTORY_QUANTITY_NAMES_ARGUMENT,
} from "./documents";
import {
  optionalDecimalString,
  optionalIsoTimestamp,
  optionalLegacyResourceId,
  optionalString,
  requireBoolean,
  requireDecimalString,
  requireIsoTimestamp,
  requireNonEmptyString,
  requireString,
} from "./decimal";
import { executeAdminReadQuery } from "./execute";
import { mapLocationNode } from "./locations";
import { mapInventoryQuantities } from "./quantities";
import type {
  AdminGraphQLResponse,
  CatalogAdminReadClient,
  InventoryItemRead,
  InventoryLevelRead,
  LocationRead,
  ProductCollectionMembershipRead,
  ProductRead,
  ProductVariantRead,
} from "./types";

type ProductNode = {
  id?: unknown;
  legacyResourceId?: unknown;
  title?: unknown;
  handle?: unknown;
  vendor?: unknown;
  productType?: unknown;
  tags?: unknown;
  status?: unknown;
  featuredMedia?: { preview?: { image?: { url?: unknown } | null } | null } | null;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type VariantNode = {
  id?: unknown;
  legacyResourceId?: unknown;
  title?: unknown;
  displayName?: unknown;
  sku?: unknown;
  barcode?: unknown;
  position?: unknown;
  price?: unknown;
  compareAtPrice?: unknown;
  selectedOptions?: Array<{ name?: unknown; value?: unknown }> | null;
  product?: { id?: unknown } | null;
  inventoryItem?: { id?: unknown } | null;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type InventoryItemNode = {
  id?: unknown;
  legacyResourceId?: unknown;
  sku?: unknown;
  tracked?: unknown;
  requiresShipping?: unknown;
  measurement?: { weight?: { value?: unknown; unit?: unknown } | null } | null;
  unitCost?: { amount?: unknown; currencyCode?: unknown } | null;
  variants?: { nodes?: Array<{ id?: unknown } | null> | null } | null;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type InventoryLevelNode = {
  id?: unknown;
  isActive?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  location?: { id?: unknown } | null;
  item?: { id?: unknown } | null;
  quantities?: Array<{
    name?: unknown;
    quantity?: unknown;
    updatedAt?: unknown;
  }> | null;
};

export function mapProductNode(node: ProductNode): ProductRead {
  const tags = Array.isArray(node.tags)
    ? node.tags.map((tag) => requireString(tag, "product.tags[]"))
    : [];
  return {
    id: requireNonEmptyString(node.id, "product.id"),
    legacyResourceId: optionalLegacyResourceId(node.legacyResourceId),
    title: requireString(node.title, "product.title"),
    handle: requireString(node.handle, "product.handle"),
    vendor: requireString(node.vendor, "product.vendor"),
    productType: requireString(node.productType, "product.productType"),
    tags,
    status: requireString(node.status, "product.status"),
    featuredMediaUrl: optionalString(node.featuredMedia?.preview?.image?.url),
    shopifyCreatedAt: requireIsoTimestamp(node.createdAt, "product.createdAt"),
    shopifyUpdatedAt: requireIsoTimestamp(node.updatedAt, "product.updatedAt"),
  };
}

export function mapProductVariantNode(node: VariantNode): ProductVariantRead {
  const selectedOptions = (node.selectedOptions ?? []).map((option) => ({
    name: requireString(option.name, "selectedOptions.name"),
    value: requireString(option.value, "selectedOptions.value"),
  }));
  if (typeof node.position !== "number" || !Number.isInteger(node.position)) {
    throw new Error("productVariant.position must be an integer");
  }
  return {
    id: requireNonEmptyString(node.id, "productVariant.id"),
    legacyResourceId: optionalLegacyResourceId(node.legacyResourceId),
    productGid: requireNonEmptyString(node.product?.id, "productVariant.product.id"),
    title: requireString(node.title, "productVariant.title"),
    displayName: optionalString(node.displayName),
    sku: optionalString(node.sku),
    barcode: optionalString(node.barcode),
    position: node.position,
    priceAmount: requireDecimalString(node.price, "productVariant.price"),
    compareAtPriceAmount: optionalDecimalString(
      node.compareAtPrice,
      "productVariant.compareAtPrice",
    ),
    selectedOptions,
    inventoryItemGid: optionalString(node.inventoryItem?.id),
    shopifyCreatedAt: requireIsoTimestamp(
      node.createdAt,
      "productVariant.createdAt",
    ),
    shopifyUpdatedAt: requireIsoTimestamp(
      node.updatedAt,
      "productVariant.updatedAt",
    ),
  };
}

export function mapInventoryItemNode(
  node: InventoryItemNode,
  unitCostSelected: boolean,
): InventoryItemRead {
  const weight = node.measurement?.weight ?? null;
  const variantGid = node.variants?.nodes?.[0]?.id ?? null;
  return {
    id: requireNonEmptyString(node.id, "inventoryItem.id"),
    legacyResourceId: optionalLegacyResourceId(node.legacyResourceId),
    sku: optionalString(node.sku),
    tracked: requireBoolean(node.tracked, "inventoryItem.tracked"),
    requiresShipping: requireBoolean(
      node.requiresShipping,
      "inventoryItem.requiresShipping",
    ),
    weightValue: weight?.value == null ? null : Number(weight.value),
    weightUnit: optionalString(weight?.unit),
    variantGid: optionalString(variantGid),
    unitCostAmount: unitCostSelected
      ? optionalDecimalString(node.unitCost?.amount, "inventoryItem.unitCost.amount")
      : null,
    unitCostCurrencyCode: unitCostSelected
      ? optionalString(node.unitCost?.currencyCode)
      : null,
    unitCostSelected,
    shopifyCreatedAt: requireIsoTimestamp(
      node.createdAt,
      "inventoryItem.createdAt",
    ),
    shopifyUpdatedAt: requireIsoTimestamp(
      node.updatedAt,
      "inventoryItem.updatedAt",
    ),
  };
}

export function mapInventoryLevelNode(
  node: InventoryLevelNode,
  fallbackIdentity?: { inventoryItemGid?: string; locationGid?: string },
): InventoryLevelRead {
  const inventoryItemGid = requireNonEmptyString(
    node.item?.id ?? fallbackIdentity?.inventoryItemGid,
    "inventoryLevel.item.id",
  );
  const locationGid = requireNonEmptyString(
    node.location?.id ?? fallbackIdentity?.locationGid,
    "inventoryLevel.location.id",
  );
  return {
    shopifyLevelGid: optionalString(node.id),
    identity: { inventoryItemGid, locationGid },
    isActive: node.isActive == null ? null : Boolean(node.isActive),
    shopifyCreatedAt: optionalIsoTimestamp(node.createdAt),
    shopifyUpdatedAt: optionalIsoTimestamp(node.updatedAt),
    quantities: mapInventoryQuantities(node.quantities),
  };
}

export async function readProduct(
  admin: CatalogAdminReadClient,
  id: string,
): Promise<ProductRead | null> {
  const result = await executeAdminReadQuery<{ product?: ProductNode | null }>(
    admin,
    CATALOG_FACT_PRODUCT_QUERY,
    { id },
  );
  const node = result.data?.product;
  return node ? mapProductNode(node) : null;
}

export async function readProductCollectionMemberships(
  admin: CatalogAdminReadClient,
  productId: string,
): Promise<ProductCollectionMembershipRead[]> {
  const memberships: ProductCollectionMembershipRead[] = [];
  const seen = new Set<string>();
  let after: string | null = null;
  const seenCursors = new Set<string>();
  let hasMore = true;

  while (hasMore) {
    const result: AdminGraphQLResponse<{
      product?: {
        collections?: {
          pageInfo?: { hasNextPage?: unknown; endCursor?: unknown };
          edges?: Array<{
            node?: { id?: unknown; title?: unknown } | null;
          } | null>;
        } | null;
      } | null;
    }> = await executeAdminReadQuery(admin, CATALOG_FACT_PRODUCT_COLLECTIONS_QUERY, {
      id: productId,
      first: 250,
      after,
    });

    const connection = result.data?.product?.collections;
    if (!connection) return memberships;

    for (const edge of connection.edges ?? []) {
      const node = edge?.node;
      if (!node?.id) continue;
      const collectionGid = requireNonEmptyString(node.id, "collection.id");
      if (seen.has(collectionGid)) {
        throw new Error(`duplicate collection GID ${collectionGid}`);
      }
      seen.add(collectionGid);
      memberships.push({
        collectionGid,
        title: requireString(node.title, "collection.title"),
      });
    }

    const hasNextPage = Boolean(connection.pageInfo?.hasNextPage);
    if (!hasNextPage) {
      hasMore = false;
      continue;
    }
    const endCursor =
      connection.pageInfo?.endCursor == null
        ? null
        : String(connection.pageInfo.endCursor);
    if (!endCursor) {
      throw new Error("collections hasNextPage without endCursor");
    }
    if (seenCursors.has(endCursor)) {
      throw new Error(`duplicate collections endCursor ${endCursor}`);
    }
    seenCursors.add(endCursor);
    after = endCursor;
  }

  return memberships;
}

export async function readProductVariant(
  admin: CatalogAdminReadClient,
  id: string,
): Promise<ProductVariantRead | null> {
  const result = await executeAdminReadQuery<{
    productVariant?: VariantNode | null;
  }>(admin, CATALOG_FACT_PRODUCT_VARIANT_QUERY, { id });
  const node = result.data?.productVariant;
  return node ? mapProductVariantNode(node) : null;
}

export async function readInventoryItem(
  admin: CatalogAdminReadClient,
  id: string,
  options?: { includeUnitCost?: boolean },
): Promise<InventoryItemRead | null> {
  const includeUnitCost = options?.includeUnitCost ?? false;
  const result = await executeAdminReadQuery<{
    inventoryItem?: InventoryItemNode | null;
  }>(admin, CATALOG_FACT_INVENTORY_ITEM_QUERY, {
    id,
    includeUnitCost,
  });
  const node = result.data?.inventoryItem;
  return node ? mapInventoryItemNode(node, includeUnitCost) : null;
}

export async function readLocation(
  admin: CatalogAdminReadClient,
  id: string,
): Promise<LocationRead | null> {
  const result = await executeAdminReadQuery<{ location?: Parameters<typeof mapLocationNode>[0] | null }>(
    admin,
    CATALOG_FACT_LOCATION_QUERY,
    { id },
  );
  const node = result.data?.location;
  return node ? mapLocationNode(node) : null;
}

export async function readInventoryLevelByPair(
  admin: CatalogAdminReadClient,
  identity: { inventoryItemGid: string; locationGid: string },
  options?: { includeInactive?: boolean },
): Promise<InventoryLevelRead | null> {
  const result = await executeAdminReadQuery<{
    inventoryItem?: {
      id?: unknown;
      inventoryLevel?: InventoryLevelNode | null;
    } | null;
  }>(admin, CATALOG_FACT_INVENTORY_LEVEL_BY_PAIR_QUERY, {
    inventoryItemId: identity.inventoryItemGid,
    locationId: identity.locationGid,
    includeInactive: options?.includeInactive ?? true,
    quantityNames: INVENTORY_QUANTITY_NAMES_ARGUMENT,
  });
  const level = result.data?.inventoryItem?.inventoryLevel;
  if (!level) return null;
  return mapInventoryLevelNode(level, {
    inventoryItemGid: identity.inventoryItemGid,
    locationGid: identity.locationGid,
  });
}

export async function readInventoryLevelById(
  admin: CatalogAdminReadClient,
  id: string,
): Promise<InventoryLevelRead | null> {
  const result = await executeAdminReadQuery<{
    inventoryLevel?: InventoryLevelNode | null;
  }>(admin, CATALOG_FACT_INVENTORY_LEVEL_BY_ID_QUERY, {
    id,
    quantityNames: INVENTORY_QUANTITY_NAMES_ARGUMENT,
  });
  const level = result.data?.inventoryLevel;
  return level ? mapInventoryLevelNode(level) : null;
}

export async function readShopCurrencyCode(
  admin: CatalogAdminReadClient,
): Promise<string | null> {
  const result = await executeAdminReadQuery<{
    shop?: { currencyCode?: unknown } | null;
  }>(admin, CATALOG_FACT_SHOP_CURRENCY_QUERY);
  return optionalString(result.data?.shop?.currencyCode);
}
