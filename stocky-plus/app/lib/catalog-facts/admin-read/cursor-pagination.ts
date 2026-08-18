/**
 * Small shared cursor-pagination primitive for canonical Admin reads.
 *
 * Used by location listing and product collection-membership listing so the
 * two cannot silently diverge. This is not a general pagination framework.
 */

export const CURSOR_PAGE_SIZE_MAX = 250;
export const CURSOR_PAGINATION_MAX_PAGES = 10_000;

export class LocationPaginationError extends Error {
  readonly code = "LOCATION_PAGINATION_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "LocationPaginationError";
  }
}

export class CollectionPaginationError extends Error {
  readonly code = "COLLECTION_PAGINATION_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "CollectionPaginationError";
  }
}

export type CursorPageInfo = {
  hasNextPage?: unknown;
  endCursor?: unknown;
};

export type CursorEdge<TNode> = {
  node?: TNode | null;
} | null;

export type CursorConnection<TNode> = {
  pageInfo?: CursorPageInfo;
  edges?: Array<CursorEdge<TNode>> | null;
} | null;

export function assertCursorPageSize(
  pageSize: number,
  createError: (message: string) => Error,
  noun: string,
): void {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > CURSOR_PAGE_SIZE_MAX) {
    throw createError(`${noun} pageSize must be 1..250`);
  }
}

export async function paginateCursorConnection<TNode, TMapped>(options: {
  noun: string;
  connectionName: string;
  pageSize: number;
  createError: (message: string) => Error;
  fetchConnection: (
    after: string | null,
  ) => Promise<CursorConnection<TNode> | undefined>;
  mapNode: (node: TNode) => TMapped;
  identityOf: (mapped: TMapped) => string;
  nodeIdentity: (node: TNode) => unknown;
}): Promise<TMapped[]> {
  assertCursorPageSize(options.pageSize, options.createError, options.noun);

  const items: TMapped[] = [];
  const seenIds = new Set<string>();
  const seenCursors = new Set<string>();
  let after: string | null = null;
  let pages = 0;
  let hasMore = true;

  while (hasMore) {
    pages += 1;
    if (pages > CURSOR_PAGINATION_MAX_PAGES) {
      throw options.createError(
        `${options.noun} pagination exceeded the explicit safety bound; refusing to return a truncated set`,
      );
    }

    const connection = await options.fetchConnection(after);
    if (!connection) {
      throw options.createError(
        `${options.connectionName} connection missing from Admin response`,
      );
    }

    const edges = Array.isArray(connection.edges) ? connection.edges : [];
    const pageInfo = connection.pageInfo ?? {};
    const hasNextPage = Boolean(pageInfo.hasNextPage);
    const endCursor =
      pageInfo.endCursor == null ? null : String(pageInfo.endCursor);

    if (edges.length === 0 && hasNextPage) {
      throw options.createError(
        `${options.connectionName} page was empty while pageInfo.hasNextPage is true (missing page)`,
      );
    }

    for (const edge of edges) {
      const node = edge?.node;
      if (!edge || !node) {
        throw options.createError(
          `${options.connectionName} edge is missing node`,
        );
      }
      const rawId = options.nodeIdentity(node);
      if (typeof rawId !== "string" || rawId === "") {
        throw options.createError(
          `${options.connectionName} edge node is missing id`,
        );
      }
      const mapped = options.mapNode(node);
      const identity = options.identityOf(mapped);
      if (seenIds.has(identity)) {
        throw options.createError(
          `duplicate ${options.noun} GID across pages: ${identity}`,
        );
      }
      seenIds.add(identity);
      items.push(mapped);
    }

    if (!hasNextPage) {
      hasMore = false;
      continue;
    }

    if (!endCursor) {
      throw options.createError(
        `${options.connectionName} pageInfo.hasNextPage is true but endCursor is missing`,
      );
    }
    if (seenCursors.has(endCursor)) {
      throw options.createError(
        `duplicate ${options.connectionName} endCursor ${endCursor}; refusing to loop or skip`,
      );
    }
    seenCursors.add(endCursor);
    after = endCursor;
  }

  return items;
}
