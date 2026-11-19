import type {
  CountResponse,
  CountSheet,
  StocktakeListResponse,
} from "./api-types";
import {
  call,
  RECEIVING_MESSAGES,
  failure,
  withLocation,
  type FetchLike,
  type Result,
} from "./receiving";

export const COUNT_MESSAGES = {
  noLocation: "Choose a location in POS before counting.",
  scanUnsure:
    "ProPo couldn't confirm that scan. Check the count shown for the item before scanning again.",
} as const;

export async function loadStocktakes(
  fetchImpl: FetchLike,
  locationId: number | null,
  signal?: AbortSignal,
): Promise<Result<StocktakeListResponse> | null> {
  if (locationId === null) return failure(COUNT_MESSAGES.noLocation);
  return call<StocktakeListResponse>(
    fetchImpl,
    withLocation("/api/pos/stocktakes", locationId),
    { signal },
  );
}

export async function loadCountSheet(
  fetchImpl: FetchLike,
  locationId: number | null,
  stocktakeId: string,
  signal?: AbortSignal,
): Promise<Result<CountSheet> | null> {
  if (locationId === null) return failure(COUNT_MESSAGES.noLocation);
  return call<CountSheet>(
    fetchImpl,
    withLocation(`/api/pos/stocktakes/${encodeURIComponent(stocktakeId)}`, locationId),
    { signal },
  );
}

async function send(
  fetchImpl: FetchLike,
  locationId: number | null,
  stocktakeId: string,
  body: object,
): Promise<Result<CountResponse>> {
  if (locationId === null) return failure(COUNT_MESSAGES.noLocation);
  const result = await call<CountResponse>(
    fetchImpl,
    withLocation(`/api/pos/stocktakes/${encodeURIComponent(stocktakeId)}`, locationId),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  // A dropped connection leaves unknown whether the scan was added.
  if (result === null || (!result.ok && result.message === RECEIVING_MESSAGES.offline)) {
    return failure(COUNT_MESSAGES.scanUnsure);
  }
  return result;
}

/** Add `quantity` units of a scanned item to the count. Not safe to repeat blindly. */
export function sendScan(
  fetchImpl: FetchLike,
  locationId: number | null,
  stocktakeId: string,
  code: string,
  quantity = 1,
) {
  return send(fetchImpl, locationId, stocktakeId, { intent: "scan", code, quantity });
}

/** Set one item's count, or clear it with null. Safe to repeat. */
export function sendCount(
  fetchImpl: FetchLike,
  locationId: number | null,
  stocktakeId: string,
  lineId: string,
  countedQty: number | null,
) {
  return send(fetchImpl, locationId, stocktakeId, { intent: "count", lineId, countedQty });
}

export type CountedItem = {
  lineId: string;
  title: string;
  countedQty: number;
};

/** Put (or replace) an item at the top of the list of what was counted. */
export function noteCounted(
  items: readonly CountedItem[],
  item: CountedItem,
): CountedItem[] {
  return [item, ...items.filter((existing) => existing.lineId !== item.lineId)];
}

export function removeCounted(
  items: readonly CountedItem[],
  lineId: string,
): CountedItem[] {
  return items.filter((item) => item.lineId !== lineId);
}

export function progressText(counted: number, total: number): string {
  return `${counted} of ${total} ${total === 1 ? "item" : "items"} counted`;
}
