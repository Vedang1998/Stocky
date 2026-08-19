/**
 * Schema-aware validation for untagged bulk inner QUERY documents.
 *
 * graphql-codegen covers `#graphql`-tagged Admin documents. These bulk
 * strings are untagged by design and must still be validated against the
 * Admin 2026-07 schema artifact materialized by `npm run graphql-codegen`,
 * using graphql-js `validate` with stock `specifiedRules`. This is not
 * field-name counting and is not a live shopify.dev fetch.
 *
 * Heavy CI runs `npm run graphql-codegen` before `npm test` so the local
 * generated schema exists when this gate runs. The schema cache is
 * gitignored; R-016 remains OPEN because codegen itself still needs the
 * Shopify network. This module does not add a second network path.
 *
 * If a future bulk document selects a field whose `first` argument is
 * schema-required (`Int!`), that document must supply `first` explicitly
 * even if Shopify bulk execution later ignores pagination arguments.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildClientSchema,
  parse,
  specifiedRules,
  validate,
  type GraphQLError,
  type GraphQLSchema,
  type IntrospectionQuery,
} from "graphql";

export const ADMIN_2026_07_SCHEMA_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../types/admin-2026-07.schema.json",
);

export const bulkQueryValidationRules = specifiedRules;

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

export function loadGeneratedAdmin202607Schema(
  schemaPath = ADMIN_2026_07_SCHEMA_PATH,
): {
  schema: GraphQLSchema;
  source: "file";
  path: string;
} {
  if (!existsSync(schemaPath)) {
    throw new Error(
      `Admin 2026-07 schema artifact is absent at ${schemaPath}. ` +
        "Materialize it with `npm run graphql-codegen` before tests. " +
        "This gate reads only the generated local file and does not fetch shopify.dev.",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(schemaPath, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Admin 2026-07 schema artifact at ${schemaPath} is unreadable: ${detail}. ` +
        "This gate does not fetch shopify.dev.",
    );
  }

  return {
    source: "file",
    path: schemaPath,
    schema: buildClientSchema(introspectionFromUnknown(parsed)),
  };
}

export function validateBulkQueryAgainstAdminSchema(
  schema: GraphQLSchema,
  document: string,
): readonly GraphQLError[] {
  return validate(schema, parse(document), specifiedRules);
}

export function assertBulkQuerySchemaValid(
  schema: GraphQLSchema,
  document: string,
  label: string,
): void {
  const errors = validateBulkQueryAgainstAdminSchema(schema, document);
  if (errors.length === 0) return;
  throw new Error(
    `${label} failed Admin 2026-07 schema validation:\n` +
      errors.map((error) => `- ${error.message}`).join("\n"),
  );
}
