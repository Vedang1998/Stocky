import type {
  ReceivableTransfer,
  TransferListResponse,
  TransferReceiveResponse,
  TransferSheet,
} from "./api-types";
import {
  call,
  failure,
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

/**
 * Whether the app may have saved the change without the device hearing. Every
 * refusal the app explains carries a status below 500; a failure with none is
 * a dropped connection or an answer that could not be read.
 */
function isUnsure(result: Result<unknown> | null): boolean {
  return result === null || (!result.ok && (result.status === undefined || result.status >= 500));
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

/** How an action ended, which decides whether the ones queued behind it still go. */
export type ActionOutcome =
  /** Done. */
  | "ok"
  /** The app refused it and said why; the rest still go. */
  | "refused"
  /** The answer was lost; what came after may rest on a wrong picture, so stop. */
  | "unsure"
  /** The device may not go on (sign-in, plan, too many requests); stop. */
  | "halt";

/** Pick the outcome of a failed answer: stop on anything that is not a plain refusal. */
export function failureOutcome(failure: { status?: number; message: string }): ActionOutcome {
  if (failure.status === 400 || failure.status === 404 || failure.status === 409) return "refused";
  return failure.status === undefined || failure.status >= 500 ? "unsure" : "halt";
}

/**
 * Runs scans, count edits and the receipt one at a time, in the order they
 * were asked for, so a receipt is never built from a partly counted transfer.
 * When one ends "unsure" or "halt" the ones behind it are dropped and counted.
 */
export function createActionQueue(options: { onIdle: (dropped: number) => void }) {
  const pending: Array<() => Promise<ActionOutcome>> = [];
  let draining = false;

  async function drain() {
    draining = true;
    let dropped = 0;
    try {
      while (pending.length > 0) {
        const action = pending.shift() as () => Promise<ActionOutcome>;
        const outcome = await action();
        if (outcome === "unsure" || outcome === "halt") {
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
    push(action: () => Promise<ActionOutcome>) {
      pending.push(action);
      if (!draining) void drain();
    },
  };
}
