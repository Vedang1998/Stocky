/**
 * Shopify locations a purchase order can be delivered to.
 *
 * The synced catalog is the normal source. A shop whose first sync has not
 * finished yet is read from Shopify so purchasing is usable straight away.
 */
import type { TenantDb } from "../../tenant/tenant-db.server";
import { shopifyGraphQL, type AdminGraphQLClient } from "../shopify-gql.server";
import { invalidInput } from "./errors";

const LOCATION_GID_PATTERN = /^gid:\/\/shopify\/Location\/\d+$/;
const SHOPIFY_PAGE_SIZE = 250;

export type DestinationLocation = {
  gid: string;
  name: string;
  isActive: boolean;
  /** Single-line postal address for documents; null when Shopify has none. */
  address: string | null;
};

type LocationFactRow = {
  shopifyGid: string;
  name: string;
  isActive: boolean;
  address1: string | null;
  city: string | null;
  provinceCode: string | null;
  zip: string | null;
  countryCode: string | null;
};

type ShopifyLocationNode = {
  id: string;
  name: string;
  isActive: boolean;
  address: { formatted: string[] } | null;
};

export function isLocationGid(value: string): boolean {
  return LOCATION_GID_PATTERN.test(value);
}

function joinAddress(parts: Array<string | null | undefined>): string | null {
  const present = parts.map((part) => part?.trim()).filter(Boolean);
  return present.length > 0 ? present.join(", ") : null;
}

function fromFact(row: LocationFactRow): DestinationLocation {
  return {
    gid: row.shopifyGid,
    name: row.name,
    isActive: row.isActive,
    address: joinAddress([
      row.address1,
      row.city,
      [row.provinceCode, row.zip].filter(Boolean).join(" "),
      row.countryCode,
    ]),
  };
}

async function readFromShopify(
  admin: AdminGraphQLClient,
): Promise<DestinationLocation[]> {
  const result = await shopifyGraphQL<{
    locations: { nodes: ShopifyLocationNode[] };
  }>(
    admin,
    `#graphql
      query StockyPurchasingLocations($first: Int!) {
        locations(first: $first, includeInactive: true) {
          nodes {
            id
            name
            isActive
            address {
              formatted
            }
          }
        }
      }`,
    { first: SHOPIFY_PAGE_SIZE },
  );
  return (result.data?.locations.nodes ?? []).map((node) => ({
    gid: node.id,
    name: node.name,
    isActive: node.isActive,
    address: joinAddress(node.address?.formatted ?? []),
  }));
}

/** Every location of the shop, active first, then by name. */
export async function listLocations(
  db: TenantDb,
  admin?: AdminGraphQLClient,
): Promise<DestinationLocation[]> {
  const rows: LocationFactRow[] = await db.shopifyLocationFact.findMany({
    where: { existenceState: "LIVE" },
    select: {
      shopifyGid: true,
      name: true,
      isActive: true,
      address1: true,
      city: true,
      provinceCode: true,
      zip: true,
      countryCode: true,
    },
  });
  const locations =
    rows.length > 0 || !admin ? rows.map(fromFact) : await readFromShopify(admin);
  return locations.sort(
    (a, b) =>
      Number(b.isActive) - Number(a.isActive) ||
      a.name.localeCompare(b.name) ||
      a.gid.localeCompare(b.gid),
  );
}

/** The active location with this GID, or an error the merchant can act on. */
export function pickActiveLocation(
  locations: readonly DestinationLocation[],
  locationGid: string,
): DestinationLocation {
  if (!isLocationGid(locationGid)) {
    throw invalidInput("Choose a destination location.");
  }
  const location = locations.find((candidate) => candidate.gid === locationGid);
  if (!location) {
    throw invalidInput("That location is not part of this store.");
  }
  if (!location.isActive) {
    throw invalidInput(
      `${location.name} is deactivated in Shopify. Choose an active location.`,
    );
  }
  return location;
}

export async function requireActiveLocation(
  db: TenantDb,
  locationGid: string,
  admin?: AdminGraphQLClient,
): Promise<DestinationLocation> {
  return pickActiveLocation(await listLocations(db, admin), locationGid);
}
