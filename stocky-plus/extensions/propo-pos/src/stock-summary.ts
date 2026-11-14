import type { LocationStock, StockQuantities, VariantStock } from "./api-types";

export type LocationSplit = {
  /** The POS device's location, when the product is stocked there. */
  here: LocationStock | null;
  elsewhere: LocationStock[];
};

export function splitByLocation(
  stock: VariantStock | null,
  locationId: number | null,
): LocationSplit {
  const locations = stock?.locations ?? [];
  const currentGid =
    locationId === null ? null : `gid://shopify/Location/${locationId}`;
  const here = locations.find((l) => l.locationGid === currentGid) ?? null;
  return { here, elsewhere: locations.filter((l) => l !== here) };
}

export type StockSummary =
  | { kind: "untracked" }
  | { kind: "unstocked" }
  | {
      kind: "levels";
      here: LocationStock | null;
      /** False when POS did not say which location the device is at. */
      locationKnown: boolean;
      locationCount: number;
      totals: StockQuantities;
    };

/** What the product details block shows: this location, then the shop total. */
export function summarizeStock(
  stock: VariantStock | null,
  locationId: number | null,
): StockSummary {
  if (stock?.tracked === false) return { kind: "untracked" };
  if (!stock || stock.locations.length === 0) return { kind: "unstocked" };
  return {
    kind: "levels",
    here: splitByLocation(stock, locationId).here,
    locationKnown: locationId !== null,
    locationCount: stock.locations.length,
    totals: stock.totals,
  };
}

/** POS reports numeric IDs; the app's API takes GIDs. */
export function variantGidFromPosId(variantId: unknown): string | null {
  return typeof variantId === "number" &&
    Number.isSafeInteger(variantId) &&
    variantId > 0
    ? `gid://shopify/ProductVariant/${variantId}`
    : null;
}
