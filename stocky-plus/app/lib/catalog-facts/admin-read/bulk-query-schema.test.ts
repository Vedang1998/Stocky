import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildClientSchema,
  getIntrospectionQuery,
  type GraphQLSchema,
  type IntrospectionQuery,
} from "graphql";
import {
  CANONICAL_BULK_QUERY_DOCUMENTS,
  CATALOG_BULK_QUERY_NO_UNIT_COST,
  CATALOG_BULK_QUERY_WITH_UNIT_COST,
  INVENTORY_LEVEL_BULK_QUERY,
} from "./bulk-query-documents";
import {
  assertBulkQuerySchemaValid,
  validateBulkQueryAgainstAdminSchema,
} from "./bulk-query-schema";
import { assertCanonicalReadDocument } from "./safety/graphql-ast";

const SCHEMA_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../types/admin-2026-07.schema.json",
);
const ADMIN_SCHEMA_PROXY = "https://shopify.dev/admin-graphql-direct-proxy/2026-07";

const INVALID_BULK_QUERY_MISSING_CONNECTION_TRAVERSAL = `{
  products {
    id
    title
  }
}`;

function introspectionFromUnknown(parsed: unknown): IntrospectionQuery {
  if (parsed && typeof parsed === "object" && "__schema" in parsed) {
    return parsed as IntrospectionQuery;
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    "data" in parsed &&
    parsed.data &&
    typeof parsed.data === "object" &&
    "__schema" in (parsed.data as object)
  ) {
    return parsed.data as IntrospectionQuery;
  }
  throw new Error(
    "Admin 2026-07 schema JSON is not a GraphQL introspection result",
  );
}

async function loadAdmin202607Schema(): Promise<{
  schema: GraphQLSchema;
  source: "file" | "proxy";
}> {
  if (existsSync(SCHEMA_PATH)) {
    return {
      source: "file",
      schema: buildClientSchema(
        introspectionFromUnknown(JSON.parse(readFileSync(SCHEMA_PATH, "utf8"))),
      ),
    };
  }
  const response = await fetch(ADMIN_SCHEMA_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: getIntrospectionQuery() }),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Admin 2026-07 schema from ${ADMIN_SCHEMA_PROXY}: HTTP ${response.status}`,
    );
  }
  const json: unknown = await response.json();
  return {
    source: "proxy",
    schema: buildClientSchema(introspectionFromUnknown(json)),
  };
}

describe("PR5-F2A untagged bulk query Admin 2026-07 schema gate", () => {
  it(
    "validates every CANONICAL_BULK_QUERY_DOCUMENTS member and rejects an invalid fixture",
    async () => {
      const { schema, source } = await loadAdmin202607Schema();
      expect(source === "file" || source === "proxy").toBe(true);

      expect(CANONICAL_BULK_QUERY_DOCUMENTS).toHaveLength(3);
      for (const [index, document] of CANONICAL_BULK_QUERY_DOCUMENTS.entries()) {
        assertCanonicalReadDocument(document);
        const errors = validateBulkQueryAgainstAdminSchema(schema, document);
        expect(errors, `document[${index}] schema errors`).toEqual([]);
        assertBulkQuerySchemaValid(schema, document, `canonical bulk[${index}]`);
      }

      expect(CATALOG_BULK_QUERY_WITH_UNIT_COST).toContain("unitCost");
      expect(CATALOG_BULK_QUERY_NO_UNIT_COST).not.toMatch(/\bunitCost\b/);
      expect(INVENTORY_LEVEL_BULK_QUERY).toContain("item {");
      expect(INVENTORY_LEVEL_BULK_QUERY).toContain('"quality_control"');

      const invalidErrors = validateBulkQueryAgainstAdminSchema(
        schema,
        INVALID_BULK_QUERY_MISSING_CONNECTION_TRAVERSAL,
      );
      expect(invalidErrors.length).toBeGreaterThan(0);
      expect(
        invalidErrors.some((error) =>
          error.message.includes('Cannot query field "id" on type "ProductConnection"'),
        ),
      ).toBe(true);
    },
    60_000,
  );
});
