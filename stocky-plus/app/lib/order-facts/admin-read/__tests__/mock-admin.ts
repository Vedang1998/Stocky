import type {
  AdminGraphQLResponse,
  OrderAdminReadClient,
} from "../types";

export type MockAdminHandler = (
  query: string,
  variables?: Record<string, unknown>,
) => AdminGraphQLResponse<unknown> | Promise<AdminGraphQLResponse<unknown>>;

export function createMockAdmin(
  handler: MockAdminHandler,
): OrderAdminReadClient & {
  calls: Array<{ query: string; variables?: Record<string, unknown> }>;
} {
  const calls: Array<{ query: string; variables?: Record<string, unknown> }> =
    [];
  return {
    calls,
    graphql: async (query, options) => {
      calls.push({ query, variables: options?.variables });
      const json = await handler(query, options?.variables);
      return { json: async () => json };
    },
  };
}

export function operationNameOf(query: string): string | null {
  const match = /(?:query|mutation|subscription)\s+([A-Za-z0-9_]+)/.exec(
    query,
  );
  return match?.[1] ?? null;
}
