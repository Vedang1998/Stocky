/**
 * Shopify bulk-operation QUERY rule validator (PR6-B / T53).
 *
 * Official bulk query limits (Admin API usage docs):
 * - the query must include a connection;
 * - at most five connections;
 * - at most two nested connection levels;
 * - connections must implement the Node interface;
 * - top-level `node` / `nodes` are forbidden.
 *
 * Schema validity (`specifiedRules`) is a separate gate. A document can be
 * GraphQL-valid and still illegal for bulk execution.
 */

import {
  TypeInfo,
  getNamedType,
  isInterfaceType,
  isObjectType,
  parse,
  visit,
  visitWithTypeInfo,
  type GraphQLNamedType,
  type GraphQLSchema,
  type GraphQLObjectType,
} from "graphql";

export const BULK_MAX_CONNECTIONS = 5;
export const BULK_MAX_CONNECTION_DEPTH = 2;

export type BulkConnectionFinding = {
  fieldName: string;
  typeName: string;
  depth: number;
  nodeTypeName: string | null;
  nodeImplementsNode: boolean;
};

export type BulkRuleResult = {
  eligible: boolean;
  reasons: string[];
  connections: BulkConnectionFinding[];
  maxDepth: number;
  hasTopLevelNodeOrNodes: boolean;
};

function namedTypeName(type: GraphQLNamedType | null | undefined): string | null {
  return type?.name ?? null;
}

function isConnectionNamedType(type: GraphQLNamedType | null | undefined): boolean {
  return Boolean(type && isObjectType(type) && type.name.endsWith("Connection"));
}

function implementsNode(type: GraphQLNamedType | null | undefined): boolean {
  if (!type) return false;
  if (type.name === "Node") return true;
  if (isObjectType(type)) {
    return type.getInterfaces().some((iface) => iface.name === "Node");
  }
  if (isInterfaceType(type)) {
    return type.name === "Node";
  }
  return false;
}

function connectionNodeType(
  connectionType: GraphQLObjectType,
): GraphQLNamedType | null {
  const edgesField = connectionType.getFields().edges;
  if (!edgesField) return null;
  const edgeType = getNamedType(edgesField.type);
  if (!isObjectType(edgeType)) return null;
  const nodeField = edgeType.getFields().node;
  if (!nodeField) return null;
  return getNamedType(nodeField.type);
}

export function evaluateBulkOperationRules(
  schema: GraphQLSchema,
  document: string,
): BulkRuleResult {
  const ast = parse(document);
  const typeInfo = new TypeInfo(schema);
  const connections: BulkConnectionFinding[] = [];
  let hasTopLevelNodeOrNodes = false;
  const reasons: string[] = [];

  const connectionAncestorStack: string[] = [];
  const connectionEnterStack: boolean[] = [];

  visit(
    ast,
    visitWithTypeInfo(typeInfo, {
      OperationDefinition: {
        enter(node) {
          for (const selection of node.selectionSet.selections) {
            if (selection.kind === "Field") {
              const name = selection.name.value;
              if (name === "node" || name === "nodes") {
                hasTopLevelNodeOrNodes = true;
              }
            }
          }
        },
      },
      Field: {
        enter(node) {
          const outputType = typeInfo.getType();
          const named = outputType ? getNamedType(outputType) : null;
          const isConnection =
            isConnectionNamedType(named) && isObjectType(named);
          connectionEnterStack.push(isConnection);
          if (!isConnection || !named || !isObjectType(named)) {
            return;
          }
          const depth = connectionAncestorStack.length + 1;
          const nodeType = connectionNodeType(named);
          const nodeTypeName = namedTypeName(nodeType);
          const nodeImplements = implementsNode(nodeType);
          connections.push({
            fieldName: node.name.value,
            typeName: named.name,
            depth,
            nodeTypeName,
            nodeImplementsNode: nodeImplements,
          });
          connectionAncestorStack.push(node.name.value);
        },
        leave() {
          const wasConnection = connectionEnterStack.pop();
          if (wasConnection) {
            connectionAncestorStack.pop();
          }
        },
      },
    }),
  );

  if (hasTopLevelNodeOrNodes) {
    reasons.push("top-level node/nodes is forbidden in a bulk query");
  }
  if (connections.length === 0) {
    reasons.push("bulk query must include a connection");
  }
  if (connections.length > BULK_MAX_CONNECTIONS) {
    reasons.push(
      `bulk query has ${connections.length} connections; maximum is ${BULK_MAX_CONNECTIONS}`,
    );
  }
  const maxDepth = connections.reduce(
    (max, item) => Math.max(max, item.depth),
    0,
  );
  if (maxDepth > BULK_MAX_CONNECTION_DEPTH) {
    reasons.push(
      `bulk query nested connection depth is ${maxDepth}; maximum is ${BULK_MAX_CONNECTION_DEPTH}`,
    );
  }
  for (const item of connections) {
    if (!item.nodeImplementsNode) {
      reasons.push(
        `connection ${item.fieldName} node type ${item.nodeTypeName ?? "(unknown)"} does not implement Node`,
      );
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    connections,
    maxDepth,
    hasTopLevelNodeOrNodes,
  };
}

export function assertBulkOperationEligible(
  schema: GraphQLSchema,
  document: string,
  label: string,
): BulkRuleResult {
  const result = evaluateBulkOperationRules(schema, document);
  if (result.eligible) return result;
  throw new Error(
    `${label} is not eligible for Shopify bulk operations:\n` +
      result.reasons.map((reason) => `- ${reason}`).join("\n"),
  );
}
