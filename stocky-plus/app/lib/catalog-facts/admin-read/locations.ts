import { CATALOG_FACT_LOCATIONS_QUERY } from "./documents";
import { executeAdminReadQuery } from "./execute";
import {
  optionalIsoTimestamp,
  optionalLegacyResourceId,
  optionalString,
  requireBoolean,
  requireIsoTimestamp,
  requireNonEmptyString,
} from "./decimal";
import {
  LOCATION_PAGE_SIZE,
  type AdminGraphQLResponse,
  type CatalogAdminReadClient,
  type LocationRead,
} from "./types";

export class LocationPaginationError extends Error {
  readonly code = "LOCATION_PAGINATION_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "LocationPaginationError";
  }
}

type LocationNode = {
  id?: unknown;
  legacyResourceId?: unknown;
  name?: unknown;
  isActive?: unknown;
  deactivatedAt?: unknown;
  fulfillsOnlineOrders?: unknown;
  shipsInventory?: unknown;
  hasActiveInventory?: unknown;
  fulfillmentService?: { id?: unknown } | null;
  address?: {
    address1?: unknown;
    city?: unknown;
    provinceCode?: unknown;
    countryCode?: unknown;
    zip?: unknown;
  } | null;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type LocationsQueryData = {
  locations?: {
    pageInfo?: { hasNextPage?: unknown; endCursor?: unknown };
    edges?: Array<{ cursor?: unknown; node?: LocationNode | null } | null>;
  } | null;
};

export function mapLocationNode(node: LocationNode): LocationRead {
  return {
    id: requireNonEmptyString(node.id, "location.id"),
    legacyResourceId: optionalLegacyResourceId(node.legacyResourceId),
    name: requireNonEmptyString(node.name, "location.name"),
    isActive: requireBoolean(node.isActive, "location.isActive"),
    deactivatedAt: optionalIsoTimestamp(node.deactivatedAt),
    fulfillsOnlineOrders: requireBoolean(
      node.fulfillsOnlineOrders,
      "location.fulfillsOnlineOrders",
    ),
    shipsInventory: requireBoolean(node.shipsInventory, "location.shipsInventory"),
    hasActiveInventory: requireBoolean(
      node.hasActiveInventory,
      "location.hasActiveInventory",
    ),
    isFulfillmentService: node.fulfillmentService?.id != null,
    address1: optionalString(node.address?.address1),
    city: optionalString(node.address?.city),
    provinceCode: optionalString(node.address?.provinceCode),
    countryCode: optionalString(node.address?.countryCode),
    zip: optionalString(node.address?.zip),
    shopifyCreatedAt: requireIsoTimestamp(node.createdAt, "location.createdAt"),
    shopifyUpdatedAt: requireIsoTimestamp(node.updatedAt, "location.updatedAt"),
  };
}

export async function readAllLocations(
  admin: CatalogAdminReadClient,
  options?: {
    pageSize?: number;
    includeInactive?: boolean;
    includeLegacy?: boolean;
  },
): Promise<LocationRead[]> {
  const pageSize = options?.pageSize ?? LOCATION_PAGE_SIZE;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 250) {
    throw new LocationPaginationError("location pageSize must be 1..250");
  }

  const locations: LocationRead[] = [];
  const seenIds = new Set<string>();
  const seenCursors = new Set<string>();
  let after: string | null = null;
  let pages = 0;
  let hasMore = true;

  while (hasMore) {
    pages += 1;
    if (pages > 10_000) {
      throw new LocationPaginationError(
        "location pagination exceeded the explicit safety bound; refusing to return a truncated set",
      );
    }

    const result: AdminGraphQLResponse<LocationsQueryData> =
      await executeAdminReadQuery<LocationsQueryData>(
      admin,
      CATALOG_FACT_LOCATIONS_QUERY,
      {
        first: pageSize,
        after,
        includeInactive: options?.includeInactive ?? true,
        includeLegacy: options?.includeLegacy ?? true,
      },
    );

    const connection = result.data?.locations;
    if (!connection) {
      throw new LocationPaginationError("locations connection missing from Admin response");
    }

    const edges = connection.edges ?? [];
    const pageInfo = connection.pageInfo ?? {};
    const hasNextPage = Boolean(pageInfo.hasNextPage);
    const endCursor =
      pageInfo.endCursor == null ? null : String(pageInfo.endCursor);

    if (edges.length === 0 && hasNextPage) {
      throw new LocationPaginationError(
        "locations page was empty while pageInfo.hasNextPage is true (missing page)",
      );
    }

    for (const edge of edges) {
      const node = edge?.node;
      if (!node) {
        throw new LocationPaginationError("locations edge is missing node");
      }
      const mapped = mapLocationNode(node);
      if (seenIds.has(mapped.id)) {
        throw new LocationPaginationError(
          `duplicate location GID across pages: ${mapped.id}`,
        );
      }
      seenIds.add(mapped.id);
      locations.push(mapped);
    }

    if (!hasNextPage) {
      hasMore = false;
      continue;
    }

    if (!endCursor) {
      throw new LocationPaginationError(
        "locations pageInfo.hasNextPage is true but endCursor is missing",
      );
    }
    if (seenCursors.has(endCursor)) {
      throw new LocationPaginationError(
        `duplicate locations endCursor ${endCursor}; refusing to loop or skip`,
      );
    }
    seenCursors.add(endCursor);
    after = endCursor;
  }

  return locations;
}
