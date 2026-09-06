import type { CatalogAdminReadClient } from "../admin-read";
import { assertCanonicalCatalogDocumentForModule } from "../admin-read/safety/graphql-ast";
import { parseBulkOperationGid } from "../admin-read/bulk-operation";

export const BULK_OPERATION_SUBMITTER_MODULE_PATH =
  "ingest/bulk-operation-submitter.ts" as const;

export const CATALOG_FACT_BULK_OPERATION_RUN_QUERY_MUTATION = `#graphql
  mutation CatalogFactBulkOperationRunQuery(
    $query: String!
    $groupObjects: Boolean!
  ) {
    bulkOperationRunQuery(query: $query, groupObjects: $groupObjects) {
      bulkOperation {
        id
        status
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

export class BulkOperationSubmitError extends Error {
  readonly code = "bulk_operation_submit_failed" as const;

  constructor(message: string) {
    super(message);
    this.name = "BulkOperationSubmitError";
  }
}

export async function submitCatalogFactBulkOperation(
  admin: CatalogAdminReadClient,
  query: string,
): Promise<{ id: string; status: string }> {
  assertCanonicalCatalogDocumentForModule(
    CATALOG_FACT_BULK_OPERATION_RUN_QUERY_MUTATION,
    BULK_OPERATION_SUBMITTER_MODULE_PATH,
  );
  const response = await admin.graphql(
    CATALOG_FACT_BULK_OPERATION_RUN_QUERY_MUTATION,
    { variables: { query, groupObjects: false } },
  );
  const json = (await response.json()) as {
    data?: {
      bulkOperationRunQuery?: {
        bulkOperation?: { id?: unknown; status?: unknown } | null;
        userErrors?: Array<{
          code?: unknown;
          field?: unknown;
          message?: unknown;
        }>;
      } | null;
    };
    errors?: Array<{ message?: unknown }>;
  };

  const topErrors = json.errors ?? [];
  if (topErrors.length > 0) {
    throw new BulkOperationSubmitError(
      topErrors
        .map((error) => String(error.message ?? "GraphQL error"))
        .join("; "),
    );
  }
  const payload = json.data?.bulkOperationRunQuery;
  const userErrors = payload?.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new BulkOperationSubmitError(
      userErrors
        .map((error) => String(error.message ?? error.code ?? "user error"))
        .join("; "),
    );
  }
  if (!payload?.bulkOperation) {
    throw new BulkOperationSubmitError(
      "bulkOperationRunQuery returned no operation",
    );
  }
  if (typeof payload.bulkOperation.id !== "string") {
    throw new BulkOperationSubmitError(
      "bulkOperationRunQuery returned an invalid operation id",
    );
  }
  const id = parseBulkOperationGid(payload.bulkOperation.id);
  if (
    typeof payload.bulkOperation.status !== "string" ||
    payload.bulkOperation.status.length === 0
  ) {
    throw new BulkOperationSubmitError(
      "bulkOperationRunQuery returned no status",
    );
  }
  return { id, status: payload.bulkOperation.status };
}
