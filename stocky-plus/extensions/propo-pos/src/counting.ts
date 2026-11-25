import type {
  CountResponse,
  CountSheet,
  StocktakeListResponse,
} from "./api-types";
import {
  call,
  MAX_COUNT,
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
  // A dropped connection, or a server error after the work may have been
  // saved, leaves unknown whether the scan was added.
  if (
    result === null ||
    (!result.ok &&
      (result.message === RECEIVING_MESSAGES.offline ||
        (result.status !== undefined && result.status >= 500)))
  ) {
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

/**
 * Read what staff typed into a count field. Empty or invalid text is `null`
 * (leave the saved count alone); a number saves, capped at MAX_COUNT.
 */
export function parseCount(value: string | null | undefined): number | null {
  const text = (value ?? "").trim();
  if (!/^\d{1,7}$/.test(text)) return null;
  return Math.min(Number(text), MAX_COUNT);
}

/**
 * Sends scans one at a time, in the order they arrive, so quick scans are
 * all counted. If one cannot be confirmed (`run` returns false) the scans
 * behind it are dropped and reported through the return of `push`'s drain.
 */
export function createScanQueue(options: {
  run: (code: string) => Promise<boolean>;
  onIdle: (dropped: number) => void;
}) {
  const pending: string[] = [];
  let draining = false;

  async function drain() {
    draining = true;
    let dropped = 0;
    try {
      while (pending.length > 0) {
        const code = pending.shift() as string;
        if (!(await options.run(code))) {
          dropped += pending.length;
          pending.length = 0;
        }
      }
    } finally {
      draining = false;
      options.onIdle(dropped);
    }
  }

  return {
    push(code: string) {
      pending.push(code);
      if (!draining) void drain();
    },
  };
}
