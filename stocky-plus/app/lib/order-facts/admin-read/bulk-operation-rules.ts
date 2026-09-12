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
 * Inspects the single executed operation and reachable fragment spreads.
 * Unused fragment definitions are not counted. Unknown/unresolved shape
 * never returns eligible: true.
 *
 * Schema validity (`specifiedRules`) is a separate gate.
 */

import {
  Kind,
  doTypesOverlap,
  getNamedType,
  isCompositeType,
  isInterfaceType,
  isObjectType,
  parse,
  type DocumentNode,
  type FieldNode,
  type FragmentDefinitionNode,
  type GraphQLNamedType,
  type GraphQLObjectType,
  type GraphQLSchema,
  type OperationDefinitionNode,
  type SelectionSetNode,
} from "graphql";

export const BULK_MAX_CONNECTIONS = 5;
export const BULK_MAX_CONNECTION_DEPTH = 2;
export const BULK_MAX_SELECTION_VISITS = 10_000;

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

function ineligible(
  reasons: string[],
  extras: Partial<BulkRuleResult> = {},
): BulkRuleResult {
  return {
    eligible: false,
    reasons,
    connections: extras.connections ?? [],
    maxDepth: extras.maxDepth ?? 0,
    hasTopLevelNodeOrNodes: extras.hasTopLevelNodeOrNodes ?? false,
  };
}

function fieldMapOf(type: GraphQLNamedType): ReturnType<GraphQLObjectType["getFields"]> | null {
  if (isObjectType(type) || isInterfaceType(type)) {
    return type.getFields();
  }
  return null;
}

function resolveSpreadType(
  schema: GraphQLSchema,
  typeConditionName: string | undefined,
  parentType: GraphQLNamedType,
): GraphQLNamedType | null {
  if (!typeConditionName) return parentType;
  const named = schema.getType(typeConditionName);
  if (!named) return null;
  if (!isCompositeType(parentType) || !isCompositeType(named)) return null;
  if (!doTypesOverlap(schema, parentType, named)) return null;
  return named;
}

type WalkState = {
  schema: GraphQLSchema;
  fragments: Map<string, FragmentDefinitionNode>;
  connections: BulkConnectionFinding[];
  reasons: string[];
  hasTopLevelNodeOrNodes: boolean;
  visits: number;
  unresolved: boolean;
};

function walkSelectionSet(
  state: WalkState,
  selectionSet: SelectionSetNode,
  parentType: GraphQLNamedType,
  connectionDepth: number,
  atRoot: boolean,
  fragmentStack: readonly string[],
): void {
  if (state.unresolved) return;
  for (const selection of selectionSet.selections) {
    state.visits += 1;
    if (state.visits > BULK_MAX_SELECTION_VISITS) {
      state.unresolved = true;
      state.reasons.push("selection traversal exceeded bound");
      return;
    }
    if (selection.kind === Kind.FIELD) {
      walkField(state, selection, parentType, connectionDepth, atRoot, fragmentStack);
      continue;
    }
    if (selection.kind === Kind.INLINE_FRAGMENT) {
      const nextType = resolveSpreadType(
        state.schema,
        selection.typeCondition?.name.value,
        parentType,
      );
      if (!nextType) {
        state.unresolved = true;
        state.reasons.push("inline fragment type is unresolved or invalid on parent");
        return;
      }
      walkSelectionSet(
        state,
        selection.selectionSet,
        nextType,
        connectionDepth,
        atRoot,
        fragmentStack,
      );
      continue;
    }
    if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const name = selection.name.value;
      if (fragmentStack.includes(name)) {
        state.unresolved = true;
        state.reasons.push(`fragment cycle involving ${name}`);
        return;
      }
      const fragment = state.fragments.get(name);
      if (!fragment) {
        state.unresolved = true;
        state.reasons.push(`undefined fragment ${name}`);
        return;
      }
      const nextType = resolveSpreadType(
        state.schema,
        fragment.typeCondition.name.value,
        parentType,
      );
      if (!nextType) {
        state.unresolved = true;
        state.reasons.push(
          `fragment ${name} type is unresolved or invalid on parent`,
        );
        return;
      }
      walkSelectionSet(
        state,
        fragment.selectionSet,
        nextType,
        connectionDepth,
        atRoot,
        [...fragmentStack, name],
      );
    }
  }
}

function walkField(
  state: WalkState,
  field: FieldNode,
  parentType: GraphQLNamedType,
  connectionDepth: number,
  atRoot: boolean,
  fragmentStack: readonly string[],
): void {
  if (state.unresolved) return;
  const fieldName = field.name.value;
  if (atRoot && (fieldName === "node" || fieldName === "nodes")) {
    state.hasTopLevelNodeOrNodes = true;
  }
  if (fieldName.startsWith("__")) {
    return;
  }
  const fields = fieldMapOf(parentType);
  const fieldDef = fields?.[fieldName];
  if (!fieldDef) {
    state.unresolved = true;
    state.reasons.push(`unresolved field ${fieldName} on ${parentType.name}`);
    return;
  }
  const named = getNamedType(fieldDef.type);
  const isConnection = isConnectionNamedType(named) && isObjectType(named);
  let nextDepth = connectionDepth;
  if (isConnection && isObjectType(named)) {
    const depth = connectionDepth + 1;
    const nodeType = connectionNodeType(named);
    state.connections.push({
      fieldName,
      typeName: named.name,
      depth,
      nodeTypeName: namedTypeName(nodeType),
      nodeImplementsNode: implementsNode(nodeType),
    });
    nextDepth = depth;
  }
  if (field.selectionSet) {
    if (!named) {
      state.unresolved = true;
      state.reasons.push(`unresolved return type for field ${fieldName}`);
      return;
    }
    walkSelectionSet(
      state,
      field.selectionSet,
      named,
      nextDepth,
      false,
      fragmentStack,
    );
  }
}

export function evaluateBulkOperationRules(
  schema: GraphQLSchema,
  document: string,
): BulkRuleResult {
  let ast: DocumentNode;
  try {
    ast = parse(document);
  } catch {
    return ineligible(["GraphQL document is not parseable"]);
  }

  const operations = ast.definitions.filter(
    (definition): definition is OperationDefinitionNode =>
      definition.kind === Kind.OPERATION_DEFINITION,
  );
  const fragments = new Map<string, FragmentDefinitionNode>();
  for (const definition of ast.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(definition.name.value, definition);
    }
  }

  if (operations.length === 0) {
    return ineligible(["document has no executable operation"]);
  }
  if (operations.length > 1) {
    return ineligible([
      "multiple executable operations; refusing implicit choice",
    ]);
  }

  const operation = operations[0]!;
  const rootType =
    operation.operation === "query"
      ? schema.getQueryType()
      : operation.operation === "mutation"
        ? schema.getMutationType()
        : schema.getSubscriptionType();
  if (!rootType) {
    return ineligible(["operation root type is unresolved"]);
  }

  const state: WalkState = {
    schema,
    fragments,
    connections: [],
    reasons: [],
    hasTopLevelNodeOrNodes: false,
    visits: 0,
    unresolved: false,
  };
  walkSelectionSet(state, operation.selectionSet, rootType, 0, true, []);

  if (state.unresolved) {
    return ineligible(state.reasons, {
      connections: state.connections,
      hasTopLevelNodeOrNodes: state.hasTopLevelNodeOrNodes,
      maxDepth: state.connections.reduce(
        (max, item) => Math.max(max, item.depth),
        0,
      ),
    });
  }

  const reasons = [...state.reasons];
  if (state.hasTopLevelNodeOrNodes) {
    reasons.push("top-level node/nodes is forbidden in a bulk query");
  }
  if (state.connections.length === 0) {
    reasons.push("bulk query must include a connection");
  }
  if (state.connections.length > BULK_MAX_CONNECTIONS) {
    reasons.push(
      `bulk query has ${state.connections.length} connections; maximum is ${BULK_MAX_CONNECTIONS}`,
    );
  }
  const maxDepth = state.connections.reduce(
    (max, item) => Math.max(max, item.depth),
    0,
  );
  if (maxDepth > BULK_MAX_CONNECTION_DEPTH) {
    reasons.push(
      `bulk query nested connection depth is ${maxDepth}; maximum is ${BULK_MAX_CONNECTION_DEPTH}`,
    );
  }
  for (const item of state.connections) {
    if (!item.nodeImplementsNode) {
      reasons.push(
        `connection ${item.fieldName} node type ${item.nodeTypeName ?? "(unknown)"} does not implement Node`,
      );
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    connections: state.connections,
    maxDepth,
    hasTopLevelNodeOrNodes: state.hasTopLevelNodeOrNodes,
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
