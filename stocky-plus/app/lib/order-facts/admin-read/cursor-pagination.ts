/**
 * Cursor-pagination primitives for PR6-B nested connection walks.
 * Fail closed: missing pageInfo, empty+hasNext, non-advancing/duplicate cursor.
 */

import { OrderPaginationError } from "./errors";

export type CursorPageInfo = {
  hasNextPage?: unknown;
  endCursor?: unknown;
};

export type CursorEdge<TNode> = {
  cursor?: unknown;
  node?: TNode | null;
} | null;

export type CursorConnection<TNode> = {
  pageInfo?: CursorPageInfo;
  edges?: Array<CursorEdge<TNode>> | null;
} | null;

export function readCursorPageInfo(
  pageInfo: unknown,
  connectionName: string,
): { hasNextPage: boolean; endCursor: string | null } {
  if (pageInfo == null) {
    throw new OrderPaginationError(
      `${connectionName} pageInfo is missing from Admin response`,
    );
  }
  if (typeof pageInfo !== "object" || Array.isArray(pageInfo)) {
    throw new OrderPaginationError(`${connectionName} pageInfo is not an object`);
  }
  const record = pageInfo as { hasNextPage?: unknown; endCursor?: unknown };
  if (typeof record.hasNextPage !== "boolean") {
    throw new OrderPaginationError(
      `${connectionName} pageInfo.hasNextPage must be a boolean`,
    );
  }
  if (record.endCursor == null) {
    return { hasNextPage: record.hasNextPage, endCursor: null };
  }
  if (typeof record.endCursor !== "string") {
    throw new OrderPaginationError(
      `${connectionName} pageInfo.endCursor must be a string or null`,
    );
  }
  return {
    hasNextPage: record.hasNextPage,
    endCursor: record.endCursor === "" ? null : record.endCursor,
  };
}

export type MappedConnectionPage<TMapped> = {
  items: TMapped[];
  edgeCursors: string[];
  hasNextPage: boolean;
  endCursor: string | null;
};

export function mapConnectionPage<TNode, TMapped>(options: {
  connection: CursorConnection<TNode> | undefined;
  connectionName: string;
  mapNode: (node: TNode, edgeCursor: string) => TMapped;
  nodeIdentity: (node: TNode) => unknown;
  allowNullNodeId?: boolean;
}): MappedConnectionPage<TMapped> {
  const connection = options.connection;
  if (!connection) {
    throw new OrderPaginationError(
      `${options.connectionName} connection missing from Admin response`,
    );
  }
  const edges = Array.isArray(connection.edges) ? connection.edges : [];
  const { hasNextPage, endCursor } = readCursorPageInfo(
    connection.pageInfo,
    options.connectionName,
  );
  if (edges.length === 0 && hasNextPage) {
    throw new OrderPaginationError(
      `${options.connectionName} page was empty while pageInfo.hasNextPage is true (missing page)`,
    );
  }

  const items: TMapped[] = [];
  const edgeCursors: string[] = [];
  for (const edge of edges) {
    const node = edge?.node;
    if (!edge || !node) {
      throw new OrderPaginationError(
        `${options.connectionName} edge is missing node`,
      );
    }
    if (typeof edge.cursor !== "string" || edge.cursor === "") {
      throw new OrderPaginationError(
        `${options.connectionName} edge is missing cursor`,
      );
    }
    const rawId = options.nodeIdentity(node);
    if (!options.allowNullNodeId && (typeof rawId !== "string" || rawId === "")) {
      throw new OrderPaginationError(
        `${options.connectionName} edge node is missing id`,
      );
    }
    items.push(options.mapNode(node, edge.cursor));
    edgeCursors.push(edge.cursor);
  }

  if (hasNextPage && !endCursor) {
    throw new OrderPaginationError(
      `${options.connectionName} pageInfo.hasNextPage is true but endCursor is missing`,
    );
  }

  return { items, edgeCursors, hasNextPage, endCursor };
}

export function assertAdvancingCursor(
  connectionName: string,
  endCursor: string,
  seenCursors: Set<string>,
): void {
  if (seenCursors.has(endCursor)) {
    throw new OrderPaginationError(
      `duplicate ${connectionName} endCursor ${endCursor}; refusing to loop or skip`,
    );
  }
  seenCursors.add(endCursor);
}
