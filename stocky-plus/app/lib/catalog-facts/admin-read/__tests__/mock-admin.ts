import type {
  AdminGraphQLResponse,
  CatalogAdminReadClient,
} from "../types";

export type MockAdminHandler = (
  query: string,
  variables?: Record<string, unknown>,
) => AdminGraphQLResponse<unknown> | Promise<AdminGraphQLResponse<unknown>>;

export function createMockAdmin(
  handler: MockAdminHandler,
): CatalogAdminReadClient & { calls: Array<{ query: string; variables?: Record<string, unknown> }> } {
  const calls: Array<{ query: string; variables?: Record<string, unknown> }> = [];
  return {
    calls,
    graphql: async (query, options) => {
      calls.push({ query, variables: options?.variables });
      const json = await handler(query, options?.variables);
      return { json: async () => json };
    },
  };
}

export function locationNode(
  index: number,
  overrides?: Record<string, unknown>,
) {
  return {
    id: `gid://shopify/Location/${index}`,
    legacyResourceId: String(index),
    name: `Location ${index}`,
    isActive: true,
    deactivatedAt: null,
    fulfillsOnlineOrders: true,
    shipsInventory: true,
    hasActiveInventory: true,
    fulfillmentService: null,
    address: {
      address1: "1 Test St",
      city: "Ottawa",
      provinceCode: "ON",
      countryCode: "CA",
      zip: "K1A 0B1",
    },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}
