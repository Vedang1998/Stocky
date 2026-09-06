/**
 * GraphQL AST inspection for the canonical Admin READ boundary (R-138).
 *
 * Deny-by-default: any operation whose GraphQL operation type is not QUERY
 * is rejected. Correctness is the graphql-js AST, not a mutation-name list
 * and not raw substring matching.
 */

import { Kind, parse, visit, type DocumentNode } from "graphql";

export const CANONICAL_SUBMIT_MUTATION_EXCEPTIONS = [
  {
    modulePath: "ingest/bulk-operation-submitter.ts",
    rootFieldName: "bulkOperationRunQuery",
  },
] as const;

export class CanonicalReadGraphQLSyntaxError extends Error {
  readonly code = "CANONICAL_READ_GRAPHQL_SYNTAX" as const;

  constructor(message: string) {
    super(message);
    this.name = "CanonicalReadGraphQLSyntaxError";
  }
}

export class CanonicalReadMutationRejectedError extends Error {
  readonly code = "CANONICAL_READ_MUTATION_REJECTED" as const;
  readonly operation: string;
  readonly operationName: string | null;
  readonly rootFieldNames: string[];

  constructor(
    operation: string,
    operationName: string | null,
    rootFieldNames: string[],
  ) {
    super(
      `Canonical Admin read boundary rejects GraphQL ${operation}` +
        `${operationName ? ` ${operationName}` : ""}` +
        `${rootFieldNames.length ? ` (fields: ${rootFieldNames.join(", ")})` : ""}` +
        ". Explicit product-owner write authorization is required before any mutation.",
    );
    this.name = "CanonicalReadMutationRejectedError";
    this.operation = operation;
    this.operationName = operationName;
    this.rootFieldNames = rootFieldNames;
  }
}

export class CanonicalReadForbiddenFieldError extends Error {
  readonly code = "CANONICAL_READ_FORBIDDEN_FIELD" as const;
  readonly fieldName: string;

  constructor(fieldName: string) {
    super(
      `Canonical Admin read boundary forbids GraphQL field ${fieldName}. ` +
        "Poll bulk operations by persisted GID via bulkOperation(id:).",
    );
    this.name = "CanonicalReadForbiddenFieldError";
    this.fieldName = fieldName;
  }
}

function rootFieldNamesOfOperation(
  ast: DocumentNode,
  operationName: string | null,
): string[] {
  const names: string[] = [];
  for (const def of ast.definitions) {
    if (def.kind !== Kind.OPERATION_DEFINITION) continue;
    if ((def.name?.value ?? null) !== operationName) continue;
    for (const sel of def.selectionSet.selections) {
      if (sel.kind === Kind.FIELD) names.push(sel.name.value);
    }
  }
  return names;
}

export function parseCanonicalReadDocument(source: string): DocumentNode {
  try {
    return parse(source);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new CanonicalReadGraphQLSyntaxError(
      `Invalid GraphQL document: ${detail}`,
    );
  }
}

/**
 * Semantic read-only assertion. Rejects mutation and subscription operations
 * regardless of field name. QUERY fields that share inventory/product prefixes
 * remain permitted.
 */
export function assertCanonicalReadDocument(source: string): DocumentNode {
  const ast = parseCanonicalReadDocument(source);
  const operations = ast.definitions.filter(
    (def) => def.kind === Kind.OPERATION_DEFINITION,
  );
  if (operations.length === 0) {
    throw new CanonicalReadGraphQLSyntaxError(
      "GraphQL document has no executable operation",
    );
  }

  for (const op of operations) {
    const operationName = op.name?.value ?? null;
    const rootFieldNames = rootFieldNamesOfOperation(ast, operationName);
    if (op.operation !== "query") {
      throw new CanonicalReadMutationRejectedError(
        op.operation,
        operationName,
        rootFieldNames,
      );
    }
  }

  visit(ast, {
    Field(node) {
      if (node.name.value === "currentBulkOperation") {
        throw new CanonicalReadForbiddenFieldError("currentBulkOperation");
      }
    },
  });

  return ast;
}

/**
 * Scanner-only assertion for the complete canonical catalog boundary.
 *
 * Queries retain the ordinary read contract. The sole mutation exception is
 * bound to one exact module path and one exact root field; no glob, prefix,
 * fragment-spread, second operation, or second root field is accepted.
 */
export function assertCanonicalCatalogDocumentForModule(
  source: string,
  modulePath: string,
): DocumentNode {
  const normalizedPath = modulePath.replace(/\\/g, "/");
  const ast = parseCanonicalReadDocument(source);
  const operations = ast.definitions.filter(
    (definition) => definition.kind === Kind.OPERATION_DEFINITION,
  );

  if (operations.length !== 1) {
    throw new CanonicalReadMutationRejectedError(
      operations.map((operation) => operation.operation).join(",") || "none",
      null,
      [],
    );
  }

  const operation = operations[0];
  if (operation.operation === "query") {
    return assertCanonicalReadDocument(source);
  }

  const rootFields = operation.selectionSet.selections.flatMap((selection) =>
    selection.kind === Kind.FIELD ? [selection.name.value] : [],
  );
  const hasOnlyDirectFieldSelections =
    rootFields.length === operation.selectionSet.selections.length;
  const exception = CANONICAL_SUBMIT_MUTATION_EXCEPTIONS.find(
    (candidate) =>
      candidate.modulePath === normalizedPath &&
      rootFields.length === 1 &&
      rootFields[0] === candidate.rootFieldName,
  );

  if (
    operation.operation !== "mutation" ||
    !hasOnlyDirectFieldSelections ||
    !exception
  ) {
    throw new CanonicalReadMutationRejectedError(
      operation.operation,
      operation.name?.value ?? null,
      rootFields,
    );
  }

  visit(ast, {
    Field(node) {
      if (node.name.value === "currentBulkOperation") {
        throw new CanonicalReadForbiddenFieldError("currentBulkOperation");
      }
    },
  });

  return ast;
}
