import { shopifyGraphQL, type AdminGraphQLClient } from "../shopify-gql.server";

const LEVEL_QUANTITIES_QUERY = `#graphql
  query ProPoInventoryLevelQuantities(
    $ids: [ID!]!
    $locationId: ID!
    $names: [String!]!
  ) {
    nodes(ids: $ids) {
      ... on InventoryItem {
        id
        inventoryLevel(locationId: $locationId) {
          quantities(names: $names) {
            name
            quantity
          }
        }
      }
    }
  }`;

const ITEMS_PER_REQUEST = 100;

/** The inventory states this app reads live: sellable units, and units physically at the location. */
export type LevelQuantityName = "available" | "on_hand";

interface LevelQuantitiesData {
  nodes: Array<{
    id?: string;
    inventoryLevel?: {
      quantities: Array<{ name: string; quantity: number }>;
    } | null;
  } | null>;
}

/**
 * Shopify's current quantity for each inventory item at one location, read
 * live. An item maps to null when it is not stocked at the location (or no
 * longer exists), and is never reported as 0 in that case.
 */
export type ReadLevelQuantities = (
  locationId: string,
  inventoryItemIds: readonly string[],
) => Promise<Map<string, number | null>>;

export type ReadAvailableQuantities = ReadLevelQuantities;

export function createLevelQuantityReader(
  admin: AdminGraphQLClient,
  name: LevelQuantityName,
): ReadLevelQuantities {
  return async (locationId, inventoryItemIds) => {
    const ids = [...new Set(inventoryItemIds)];
    const quantities = new Map<string, number | null>(
      ids.map((id) => [id, null]),
    );
    for (let start = 0; start < ids.length; start += ITEMS_PER_REQUEST) {
      const result = await shopifyGraphQL<LevelQuantitiesData>(
        admin,
        LEVEL_QUANTITIES_QUERY,
        {
          ids: ids.slice(start, start + ITEMS_PER_REQUEST),
          locationId,
          names: [name],
        },
      );
      for (const node of result.data?.nodes ?? []) {
        if (!node?.id || !quantities.has(node.id)) continue;
        const level = node.inventoryLevel?.quantities.find(
          (q) => q.name === name,
        );
        if (level && Number.isInteger(level.quantity)) {
          quantities.set(node.id, level.quantity);
        }
      }
    }
    return quantities;
  };
}

export function createAvailableQuantityReader(
  admin: AdminGraphQLClient,
): ReadAvailableQuantities {
  return createLevelQuantityReader(admin, "available");
}
