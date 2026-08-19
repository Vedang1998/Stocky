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
  LocationPaginationError,
  paginateCursorConnection,
} from "./cursor-pagination";
import {
  LOCATION_PAGE_SIZE,
  type CatalogAdminReadClient,
  type LocationRead,
} from "./types";

export { LocationPaginationError } from "./cursor-pagination";

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
    deactivatedAt: optionalIsoTimestamp(node.deactivatedAt, "location.deactivatedAt"),
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

  return paginateCursorConnection({
    noun: "location",
    connectionName: "locations",
    pageSize,
    createError: (message) => new LocationPaginationError(message),
    fetchConnection: async (after) => {
      const result = await executeAdminReadQuery<LocationsQueryData>(
        admin,
        CATALOG_FACT_LOCATIONS_QUERY,
        {
          first: pageSize,
          after,
          includeInactive: options?.includeInactive ?? true,
          includeLegacy: options?.includeLegacy ?? true,
        },
      );
      return result.data?.locations;
    },
    mapNode: mapLocationNode,
    identityOf: (mapped) => mapped.id,
    nodeIdentity: (node) => node.id,
  });
}
