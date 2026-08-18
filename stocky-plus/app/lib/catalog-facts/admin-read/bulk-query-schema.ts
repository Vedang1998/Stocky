/**
 * Schema-aware validation for untagged bulk inner QUERY documents.
 *
 * graphql-codegen covers `#graphql`-tagged Admin documents. These bulk
 * strings are untagged by design and must still be validated against the
 * committed Shopify Admin 2026-07 introspection schema using graphql-js
 * `validate`. This is not field-name counting.
 *
 * Shopify bulk operations treat connection pagination arguments
 * (`first` / `after` / `last` / `before`) as optional and ignored. The
 * default graphql-js required-argument rule is therefore relaxed for those
 * names only. Connection traversal, field existence, and all other
 * required arguments (for example `quantities(names:)`) remain enforced.
 */

import {
  GraphQLError,
  ProvidedRequiredArgumentsRule,
  isRequiredArgument,
  parse,
  specifiedRules,
  validate,
  type GraphQLSchema,
  type ValidationRule,
} from "graphql";

const BULK_OPTIONAL_PAGINATION_ARGS = new Set([
  "first",
  "after",
  "last",
  "before",
]);

export const bulkRelaxedProvidedRequiredArgumentsRule: ValidationRule = (
  context,
) => {
  const directiveVisitor = ProvidedRequiredArgumentsRule(context);
  return {
    ...directiveVisitor,
    Field: {
      leave(fieldNode) {
        const fieldDef = context.getFieldDef();
        if (!fieldDef) {
          return false;
        }
        const provided = new Set(
          (fieldNode.arguments ?? []).map((arg) => arg.name.value),
        );
        for (const argDef of fieldDef.args) {
          if (BULK_OPTIONAL_PAGINATION_ARGS.has(argDef.name)) {
            continue;
          }
          if (!provided.has(argDef.name) && isRequiredArgument(argDef)) {
            context.reportError(
              new GraphQLError(
                `Field "${fieldDef.name}" argument "${argDef.name}" of type "${String(argDef.type)}" is required, but it was not provided.`,
                { nodes: fieldNode },
              ),
            );
          }
        }
      },
    },
  };
};

export const bulkQueryValidationRules: ValidationRule[] = specifiedRules.map(
  (rule) =>
    rule === ProvidedRequiredArgumentsRule
      ? bulkRelaxedProvidedRequiredArgumentsRule
      : rule,
);

export function validateBulkQueryAgainstAdminSchema(
  schema: GraphQLSchema,
  document: string,
): readonly GraphQLError[] {
  return validate(schema, parse(document), bulkQueryValidationRules);
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
