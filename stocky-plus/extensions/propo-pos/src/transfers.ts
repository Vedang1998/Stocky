import type {
  ReceivableTransfer,
  TransferListResponse,
  TransferReceiveResponse,
  TransferSheet,
} from "./api-types";
import {
  call,
  failure,
  RECEIVING_MESSAGES,
  withLocation,
  type FetchLike,
  type Result,
} from "./receiving";

export const TRANSFER_MESSAGES = {
  noLocation: "Choose a location in POS before receiving a transfer.",
  scanUnsure:
    "ProPo couldn't confirm that scan. Check the count shown for the item before scanning again.",
  countUnsure: "ProPo couldn't confirm that count. Check the count shown, then try again.",
  postUnsure:
    "ProPo couldn't confirm the receipt. Tap Post receipt again; units Shopify already has are not added twice.",
} as const;

export async function loadTransfers(
  fetchImpl: FetchLike,
  locationId: number | null,
  signal?: AbortSignal,
): Promise<Result<TransferListResponse> | null> {
  if (locationId === null) return failure(TRANSFER_MESSAGES.noLocation);
  return call<TransferListResponse>(fetchImpl, withLocation("/api/pos/transfers", locationId), {
    signal,
  });
}

export async function loadTransferSheet(
  fetchImpl: FetchLike,
  locationId: number | null,
  transferId: string,
  signal?: AbortSignal,
): Promise<Result<TransferSheet> | null> {
  if (locationId === null) return failure(TRANSFER_MESSAGES.noLocation);
  return call<TransferSheet>(
    fetchImpl,
    withLocation(`/api/pos/transfers/${encodeURIComponent(transferId)}`, locationId),
    { signal },
  );
}

/** A dropped connection or a server error may come after the work was saved. */
function isUnsure(result: Result<unknown> | null): boolean {
  return (
    result === null ||
    (!result.ok &&
      (result.message === RECEIVING_MESSAGES.offline ||
        (result.status !== undefined && result.status >= 500)))
  );
}

async function send(
  fetchImpl: FetchLike,
  locationId: number | null,
  transferId: string,
  body: object,
  unsureMessage: string,
): Promise<Result<TransferReceiveResponse>> {
  if (locationId === null) return failure(TRANSFER_MESSAGES.noLocation);
  const result = await call<TransferReceiveResponse>(
    fetchImpl,
    withLocation(`/api/pos/transfers/${encodeURIComponent(transferId)}`, locationId),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return isUnsure(result) ? failure(unsureMessage) : (result as Result<TransferReceiveResponse>);
}

/** Count `quantity` units of a scanned item in. Not safe to repeat blindly. */
export function sendTransferScan(
  fetchImpl: FetchLike,
  locationId: number | null,
  transferId: string,
  code: string,
  quantity = 1,
) {
  return send(
    fetchImpl,
    locationId,
    transferId,
    { intent: "scan", code, quantity },
    TRANSFER_MESSAGES.scanUnsure,
  );
}

/** Set how many units of a line are counted in. Safe to repeat. */
export function sendTransferCount(
  fetchImpl: FetchLike,
  locationId: number | null,
  transferId: string,
  lineId: string,
  quantity: number,
) {
  return send(
    fetchImpl,
    locationId,
    transferId,
    { intent: "set", lineId, quantity },
    TRANSFER_MESSAGES.countUnsure,
  );
}

/** Add the counted-in units to stock. Safe to repeat: only what Shopify lacks is sent. */
export function postTransferReceipt(
  fetchImpl: FetchLike,
  locationId: number | null,
  transferId: string,
) {
  return send(fetchImpl, locationId, transferId, { intent: "post" }, TRANSFER_MESSAGES.postUnsure);
}

/** The most a line's count can be: what is counted in plus what is still unaccounted for. */
export function mostCountedIn(line: { countedInQty: number; outstandingQty: number }): number {
  return line.countedInQty + line.outstandingQty;
}

export function describeTransfer(transfer: ReceivableTransfer, now: number): string {
  const units = `${transfer.outstandingUnits} of ${transfer.shippedUnits} units to receive`;
  const counted = transfer.countedInUnits > 0 ? ` · ${transfer.countedInUnits} counted in` : "";
  if (!transfer.shippedAt) return `${units}${counted}`;
  const days = Math.floor(Math.max(0, now - Date.parse(transfer.shippedAt)) / 86_400_000);
  const sent = days === 0 ? "Sent today" : `Sent ${days} d ago`;
  return `${sent} · ${units}${counted}`;
}

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
