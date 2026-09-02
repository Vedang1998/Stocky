/**
 * Execute a canonical Admin READ GraphQL query.
 *
 * Always AST-inspects the document before any network call. Mutations never
 * reach the Shopify Admin client from this module.
 */

import {
  assertCanonicalReadDocument,
} from "./safety/graphql-ast";
import type {
  AdminGraphQLError,
  AdminGraphQLResponse,
  CatalogAdminReadClient,
} from "./types";

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 500;

export class CanonicalAdminReadError extends Error {
  readonly code = "CANONICAL_ADMIN_READ_ERROR" as const;
  readonly graphqlErrors: AdminGraphQLError[];

  constructor(message: string, graphqlErrors: AdminGraphQLError[] = []) {
    super(message);
    this.name = "CanonicalAdminReadError";
    this.graphqlErrors = graphqlErrors;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isThrottled(errors: AdminGraphQLError[] | undefined): boolean {
  return Boolean(
    errors?.some((error) => error.message.toLowerCase().includes("throttled")),
  );
}

export async function executeAdminReadQuery<T>(
  admin: CatalogAdminReadClient,
  document: string,
  variables?: Record<string, unknown>,
  options?: { allowFieldErrors?: boolean },
): Promise<AdminGraphQLResponse<T>> {
  assertCanonicalReadDocument(document);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await admin.graphql(document, { variables });
    const json = (await response.json()) as AdminGraphQLResponse<T>;
    const errors = json.errors ?? [];

    if (errors.length > 0) {
      if (isThrottled(errors) && attempt < MAX_RETRIES - 1) {
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
      if (!options?.allowFieldErrors) {
        throw new CanonicalAdminReadError(
          errors.map((error) => error.message).join("; "),
          errors,
        );
      }
      return json;
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

  throw new CanonicalAdminReadError("GraphQL request failed after retries");
}
