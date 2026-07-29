/**
 * Minimal structural type for the Admin GraphQL client so the same helpers
 * work with `authenticate.admin(request)` contexts (web requests) and
 * `unauthenticated.admin(shop)` contexts (background workers).
 */
export interface AdminGraphQLClient {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<{ json: () => Promise<unknown> }>;
}

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 500;

interface ThrottleStatus {
  maximumAvailable?: number;
  currentlyAvailable?: number;
  restoreRate?: number;
}

interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string }>;
  extensions?: {
    cost?: {
      throttleStatus?: ThrottleStatus;
      requestedQueryCost?: number;
    };
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function shopifyGraphQL<T = unknown>(
  admin: AdminGraphQLClient,
  query: string,
  variables?: Record<string, unknown>,
): Promise<GraphQLResponse<T>> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await admin.graphql(query, { variables });
    const json = (await response.json()) as GraphQLResponse<T>;

    if (json.errors?.length) {
      const rateLimited = json.errors.some((e) =>
        e.message.toLowerCase().includes("throttled"),
      );
      if (rateLimited && attempt < MAX_RETRIES - 1) {
        const throttle = json.extensions?.cost?.throttleStatus;
        const delay =
          throttle?.restoreRate && throttle.currentlyAvailable !== undefined
            ? Math.ceil(
                ((json.extensions?.cost?.requestedQueryCost ?? 10) -
                  throttle.currentlyAvailable) /
                  throttle.restoreRate,
              ) * 1000
            : BASE_DELAY_MS * Math.pow(2, attempt);
        await sleep(Math.max(delay, BASE_DELAY_MS));
        continue;
      }
      throw new Error(json.errors.map((e) => e.message).join("; "));
    }

    const throttle = json.extensions?.cost?.throttleStatus;
    if (
      throttle?.currentlyAvailable !== undefined &&
      throttle.currentlyAvailable < 50 &&
      attempt < MAX_RETRIES - 1
    ) {
      await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
    }

    return json;
  }

  throw new Error("GraphQL request failed after retries");
}

export async function fetchLocations(admin: AdminGraphQLClient) {
  const result = await shopifyGraphQL<{
    locations: { edges: Array<{ node: { id: string; name: string } }> };
  }>(
    admin,
    `#graphql
      query StockyLocations {
        locations(first: 50) {
          edges {
            node {
              id
              name
            }
          }
        }
      }`,
  );
  return result.data?.locations.edges.map((e) => e.node) ?? [];
}

export async function fetchInventoryLevels(
  admin: AdminGraphQLClient,
  inventoryItemId: string,
  locationId: string,
): Promise<number> {
  // Admin API 2025-10: QueryRoot.inventoryLevel requires InventoryLevel `id`.
  // Look up by inventory item + location via InventoryItem.inventoryLevel.
  const result = await shopifyGraphQL<{
    inventoryItem: {
      inventoryLevel: { quantities: Array<{ quantity: number }> } | null;
    } | null;
  }>(
    admin,
    `#graphql
      query StockyInventoryLevel($inventoryItemId: ID!, $locationId: ID!) {
        inventoryItem(id: $inventoryItemId) {
          inventoryLevel(locationId: $locationId) {
            quantities(names: ["available"]) {
              quantity
            }
          }
        }
      }`,
    { inventoryItemId, locationId },
  );
  return (
    result.data?.inventoryItem?.inventoryLevel?.quantities[0]?.quantity ?? 0
  );
}

export async function runBulkProductSync(admin: AdminGraphQLClient) {
  const result = await shopifyGraphQL<{
    bulkOperationRunQuery: {
      bulkOperation: { id: string; status: string } | null;
      userErrors: Array<{ message: string }>;
    };
  }>(
    admin,
    `#graphql
      mutation StockyBulkProductSync {
        bulkOperationRunQuery(
          query: """
            {
              products {
                edges {
                  node {
                    id
                    title
                    variants {
                      edges {
                        node {
                          id
                          title
                          sku
                          barcode
                          inventoryItem {
                            id
                            measurement {
                              weight {
                                value
                                unit
                              }
                            }
                          }
                          image {
                            url
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          """
        ) {
          bulkOperation {
            id
            status
          }
          userErrors {
            message
          }
        }
      }`,
  );

  const errors = result.data?.bulkOperationRunQuery.userErrors;
  if (errors?.length) {
    throw new Error(errors.map((e) => e.message).join("; "));
  }
  return result.data?.bulkOperationRunQuery.bulkOperation;
}

export async function pollBulkOperation(admin: AdminGraphQLClient) {
  const result = await shopifyGraphQL<{
    currentBulkOperation: {
      id: string;
      status: string;
      url: string | null;
      errorCode: string | null;
    } | null;
  }>(
    admin,
    `#graphql
      query StockyCurrentBulkOperation {
        currentBulkOperation {
          id
          status
          url
          errorCode
        }
      }`,
  );
  return result.data?.currentBulkOperation;
}
