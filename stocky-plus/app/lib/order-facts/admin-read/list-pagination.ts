/**
 * T20: named non-connection LIST fields must not receive pagination arguments.
 * Refund.transactions is a Connection and must paginate.
 */

import {
  TypeInfo,
  getNamedType,
  isListType,
  isNonNullType,
  parse,
  visit,
  visitWithTypeInfo,
  type GraphQLSchema,
} from "graphql";
import { FORBIDDEN_LIST_PAGINATION_FIELDS } from "./constants";

export type ListPaginationViolation = {
  fieldName: string;
  parentTypeName: string;
  argumentName: string;
  returnTypeName: string;
  isConnection: boolean;
};

function unwrap(type: unknown): { namedName: string; isList: boolean } {
  let current = type as
    | { name?: string; ofType?: unknown }
    | null
    | undefined;
  let isList = false;
  while (current && isNonNullType(current as never)) {
    current = (current as { ofType: unknown }).ofType as typeof current;
  }
  if (current && isListType(current as never)) {
    isList = true;
    current = (current as { ofType: unknown }).ofType as typeof current;
  }
  while (current && isNonNullType(current as never)) {
    current = (current as { ofType: unknown }).ofType as typeof current;
  }
  const named = current && typeof current === "object" && "name" in current
    ? String((current as { name?: string }).name ?? "")
    : "";
  return { namedName: named, isList };
}

export function findForbiddenListPagination(
  schema: GraphQLSchema,
  document: string,
): ListPaginationViolation[] {
  const ast = parse(document);
  const typeInfo = new TypeInfo(schema);
  const violations: ListPaginationViolation[] = [];
  const forbidden = new Set<string>(FORBIDDEN_LIST_PAGINATION_FIELDS);

  visit(
    ast,
    visitWithTypeInfo(typeInfo, {
      Field(node) {
        const fieldName = node.name.value;
        if (!forbidden.has(fieldName)) return;
        const parent = typeInfo.getParentType();
        const outputType = typeInfo.getType();
        const named = outputType ? getNamedType(outputType) : null;
        const isConnection = Boolean(named?.name.endsWith("Connection"));
        const { isList } = unwrap(outputType);
        const args = node.arguments ?? [];
        for (const arg of args) {
          if (
            arg.name.value === "first" ||
            arg.name.value === "after" ||
            arg.name.value === "last" ||
            arg.name.value === "before"
          ) {
            if (!isConnection && isList) {
              violations.push({
                fieldName,
                parentTypeName: parent?.name ?? "(unknown)",
                argumentName: arg.name.value,
                returnTypeName: named?.name ?? "(unknown)",
                isConnection: false,
              });
            }
          }
        }
      },
    }),
  );

  return violations;
}

export function assertNoForbiddenListPagination(
  schema: GraphQLSchema,
  document: string,
  label: string,
): void {
  const violations = findForbiddenListPagination(schema, document);
  if (violations.length === 0) return;
  throw new Error(
    `${label} passes pagination arguments on named non-connection LIST fields:\n` +
      violations
        .map(
          (item) =>
            `- ${item.parentTypeName}.${item.fieldName}(${item.argumentName})`,
        )
        .join("\n"),
  );
}
