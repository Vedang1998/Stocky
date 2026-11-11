import { shopifyGraphQL, type AdminGraphQLClient } from "../shopify-gql.server";

const AVAILABLE_QUANTITIES_QUERY = `#graphql
  query ProPoInventoryAvailable($ids: [ID!]!, $locationId: ID!) {
    nodes(ids: $ids) {
      ... on InventoryItem {
        id
        inventoryLevel(locationId: $locationId) {
          quantities(names: ["available"]) {
            name
            quantity
          }
        }
      }
    }
  }`;

const ITEMS_PER_REQUEST = 100;

interface AvailableQuantitiesData {
  nodes: Array<{
    id?: string;
    inventoryLevel?: {
      quantities: Array<{ name: string; quantity: number }>;
    } | null;
  } | null>;
}

/**
 * Shopify's current `available` quantity for each inventory item at one
 * location, read live. An item maps to null when it is not stocked at the
 * location (or no longer exists), and is never reported as 0 in that case.
 */
export type ReadAvailableQuantities = (
  locationId: string,
  inventoryItemIds: readonly string[],
) => Promise<Map<string, number | null>>;

export function createAvailableQuantityReader(
  admin: AdminGraphQLClient,
): ReadAvailableQuantities {
  return async (locationId, inventoryItemIds) => {
    const ids = [...new Set(inventoryItemIds)];
    const quantities = new Map<string, number | null>(
      ids.map((id) => [id, null]),
    );
    for (let start = 0; start < ids.length; start += ITEMS_PER_REQUEST) {
      const result = await shopifyGraphQL<AvailableQuantitiesData>(
        admin,
        AVAILABLE_QUANTITIES_QUERY,
        { ids: ids.slice(start, start + ITEMS_PER_REQUEST), locationId },
      );
      for (const node of result.data?.nodes ?? []) {
        if (!node?.id || !quantities.has(node.id)) continue;
        const available = node.inventoryLevel?.quantities.find(
          (q) => q.name === "available",
        );
        if (available && Number.isInteger(available.quantity)) {
          quantities.set(node.id, available.quantity);
        }
      }
    }
    return quantities;
  };
}
