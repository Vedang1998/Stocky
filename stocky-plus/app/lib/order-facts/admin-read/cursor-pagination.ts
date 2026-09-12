/**
 * Cursor-pagination primitives for PR6-B nested connection walks.
 * Fail closed: missing pageInfo, empty+hasNext, non-advancing/duplicate cursor.
 */

import { OrderPaginationError } from "./errors";
import type { OrderReadIssueExtras } from "./types";

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
  extras: OrderReadIssueExtras = {},
): { hasNextPage: boolean; endCursor: string | null } {
  if (pageInfo == null) {
    throw new OrderPaginationError(
      `${connectionName} pageInfo is missing from Admin response`,
      extras,
    );
  }
  if (typeof pageInfo !== "object" || Array.isArray(pageInfo)) {
    throw new OrderPaginationError(
      `${connectionName} pageInfo is not an object`,
      extras,
    );
  }
  const record = pageInfo as { hasNextPage?: unknown; endCursor?: unknown };
  if (typeof record.hasNextPage !== "boolean") {
    throw new OrderPaginationError(
      `${connectionName} pageInfo.hasNextPage must be a boolean`,
      extras,
    );
  }
  if (record.endCursor == null) {
    return { hasNextPage: record.hasNextPage, endCursor: null };
  }
  if (typeof record.endCursor !== "string") {
    throw new OrderPaginationError(
      `${connectionName} pageInfo.endCursor must be a string or null`,
      extras,
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
  /** Continuation pages that promised hasNextPage must not arrive empty. */
  requireNonEmpty?: boolean;
  extras?: OrderReadIssueExtras;
}): MappedConnectionPage<TMapped> {
  const extras = options.extras ?? {};
  const connection = options.connection;
  if (!connection) {
    throw new OrderPaginationError(
      `${options.connectionName} connection missing from Admin response`,
      extras,
    );
  }
  if (!Array.isArray(connection.edges)) {
    throw new OrderPaginationError(
      `${options.connectionName} edges must be an array; missing/null/object/scalar is not an empty page`,
      extras,
    );
  }
  const edges = connection.edges;
  const { hasNextPage, endCursor } = readCursorPageInfo(
    connection.pageInfo,
    options.connectionName,
    extras,
  );
  if (edges.length === 0 && hasNextPage) {
    throw new OrderPaginationError(
      `${options.connectionName} page was empty while pageInfo.hasNextPage is true (missing page)`,
      extras,
    );
  }
  if (options.requireNonEmpty && edges.length === 0) {
    throw new OrderPaginationError(
      `${options.connectionName} continuation page was empty after hasNextPage`,
      extras,
    );
  }

  const items: TMapped[] = [];
  const edgeCursors: string[] = [];
  for (const edge of edges) {
    const node = edge?.node;
    if (!edge || !node) {
      throw new OrderPaginationError(
        `${options.connectionName} edge is missing node`,
        extras,
      );
    }
    if (typeof edge.cursor !== "string" || edge.cursor === "") {
      throw new OrderPaginationError(
        `${options.connectionName} edge is missing cursor`,
        extras,
      );
    }
    const rawId = options.nodeIdentity(node);
    if (!options.allowNullNodeId && (typeof rawId !== "string" || rawId === "")) {
      throw new OrderPaginationError(
        `${options.connectionName} edge node is missing id`,
        extras,
      );
    }
    items.push(options.mapNode(node, edge.cursor));
    edgeCursors.push(edge.cursor);
  }

  if (hasNextPage && !endCursor) {
    throw new OrderPaginationError(
      `${options.connectionName} pageInfo.hasNextPage is true but endCursor is missing`,
      extras,
    );
  }

  return { items, edgeCursors, hasNextPage, endCursor };
}

export function assertAdvancingCursor(
  connectionName: string,
  endCursor: string,
  seenCursors: Set<string>,
  extras: OrderReadIssueExtras = {},
): void {
  if (seenCursors.has(endCursor)) {
    throw new OrderPaginationError(
      `duplicate ${connectionName} endCursor ${endCursor}; refusing to loop or skip`,
      extras,
    );
  }
  seenCursors.add(endCursor);
}
