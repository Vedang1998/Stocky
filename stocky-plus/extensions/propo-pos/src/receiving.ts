import type {
  ApiErrorWithFields,
  ReceiptRequest,
  ReceiptResponse,
  ReceivableOrder,
  ReceivingLine,
  ReceivingListResponse,
  ReceivingSheet,
} from "./api-types";

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<Pick<Response, "ok" | "status" | "json">>;

export const RECEIVING_MESSAGES = {
  signIn:
    "Your POS user can't use ProPo. Sign in with a staff account that has access to the ProPo app, then try again.",
  unavailable: "ProPo isn't available for this store right now.",
  offline: "Can't reach ProPo. Check the device's connection and try again.",
  failed: "ProPo couldn't finish that. Try again.",
  busy: "Too many requests in a short time. Wait a moment and try again.",
  noLocation: "Choose a location in POS before receiving.",
  notFound: "This purchase order wasn't found. It may have been removed.",
  submitUnsure:
    "ProPo couldn't confirm the receipt. Tap Receive again to retry; the same delivery won't be counted twice.",
} as const;

export type Failure = {
  ok: false;
  message: string;
  fieldErrors: Record<string, string>;
  /** HTTP status of the refusal; absent when the server was never reached. */
  status?: number;
};

export type Result<T> = { ok: true; value: T } | Failure;

function failure(
  message: string,
  fieldErrors: Record<string, string> = {},
  status?: number,
): Failure {
  return status === undefined
    ? { ok: false, message, fieldErrors }
    : { ok: false, message, fieldErrors, status };
}

async function errorResult(
  response: Pick<Response, "status" | "json">,
): Promise<Failure> {
  const body = (await response.json().catch(() => null)) as ApiErrorWithFields | null;
  const message = body?.error?.message;
  const fieldErrors = body?.error?.fieldErrors ?? {};
  switch (response.status) {
    case 401:
      return failure(RECEIVING_MESSAGES.signIn, {}, 401);
    case 403:
      return failure(message || RECEIVING_MESSAGES.unavailable, {}, 403);
    case 404:
      return failure(message || RECEIVING_MESSAGES.notFound, {}, 404);
    case 429:
      return failure(RECEIVING_MESSAGES.busy, {}, 429);
    case 400:
    case 409:
      return failure(message || RECEIVING_MESSAGES.failed, fieldErrors, response.status);
    default:
      return failure(RECEIVING_MESSAGES.failed, {}, response.status);
  }
}

function isAbort(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

async function call<T>(
  fetchImpl: FetchLike,
  url: string,
  init: Parameters<FetchLike>[1],
): Promise<Result<T> | null> {
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchImpl(url, init);
  } catch (error) {
    if (isAbort(error)) return null;
    return failure(RECEIVING_MESSAGES.offline);
  }
  if (!response.ok) return errorResult(response);
  try {
    return { ok: true, value: (await response.json()) as T };
  } catch (error) {
    if (isAbort(error)) return null;
    return failure(RECEIVING_MESSAGES.failed);
  }
}

function withLocation(path: string, locationId: number | null, extra: Record<string, string> = {}) {
  const params = new URLSearchParams(extra);
  if (locationId !== null) params.set("location", String(locationId));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export async function loadOrders(
  fetchImpl: FetchLike,
  locationId: number | null,
  search: string,
  signal?: AbortSignal,
): Promise<Result<ReceivingListResponse> | null> {
  if (locationId === null) return failure(RECEIVING_MESSAGES.noLocation);
  const extra: Record<string, string> = search.trim() ? { search: search.trim() } : {};
  return call<ReceivingListResponse>(
    fetchImpl,
    withLocation("/api/pos/receiving", locationId, extra),
    { signal },
  );
}

export async function loadSheet(
  fetchImpl: FetchLike,
  locationId: number | null,
  orderId: string,
  signal?: AbortSignal,
): Promise<Result<ReceivingSheet> | null> {
  if (locationId === null) return failure(RECEIVING_MESSAGES.noLocation);
  return call<ReceivingSheet>(
    fetchImpl,
    withLocation(`/api/pos/receiving/${encodeURIComponent(orderId)}`, locationId),
    { signal },
  );
}

/**
 * Send a receipt. A network failure here leaves the outcome unknown, so the
 * message tells the person to retry with the same key.
 */
export async function submitReceipt(
  fetchImpl: FetchLike,
  locationId: number | null,
  orderId: string,
  request: ReceiptRequest,
): Promise<Result<ReceiptResponse>> {
  if (locationId === null) return failure(RECEIVING_MESSAGES.noLocation);
  const result = await call<ReceiptResponse>(
    fetchImpl,
    withLocation(`/api/pos/receiving/${encodeURIComponent(orderId)}`, locationId),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
  );
  if (result === null) return failure(RECEIVING_MESSAGES.submitUnsure);
  if (!result.ok && result.message === RECEIVING_MESSAGES.offline) {
    return failure(RECEIVING_MESSAGES.submitUnsure);
  }
  return result;
}

export type Counts = Readonly<Record<string, number>>;

function sameCode(candidate: string | null, code: string): boolean {
  return candidate !== null && candidate.trim().toLowerCase() === code;
}

/** The line a scanned or typed code belongs to: barcode first, then SKU. */
export function matchLine(
  lines: readonly ReceivingLine[],
  scanned: string,
): ReceivingLine | null {
  const code = scanned.trim().toLowerCase();
  if (!code) return null;
  return (
    lines.find((line) => sameCode(line.barcode, code)) ??
    lines.find((line) => sameCode(line.sku, code)) ??
    null
  );
}

export const MAX_COUNT = 1_000_000;

/** Add (or remove) units on one line, never below zero or above the limit. */
export function bumpCount(counts: Counts, lineItemId: string, delta: number): Counts {
  const next = Math.min(MAX_COUNT, Math.max(0, (counts[lineItemId] ?? 0) + delta));
  const rest = { ...counts };
  if (next === 0) delete rest[lineItemId];
  else rest[lineItemId] = next;
  return rest;
}

export function setCount(counts: Counts, lineItemId: string, value: number): Counts {
  return bumpCount(counts, lineItemId, value - (counts[lineItemId] ?? 0));
}

/** Read what a person typed in a count field as a whole number of units. */
export function readCount(value: string | null | undefined): number {
  const text = (value ?? "").trim();
  return /^\d{1,7}$/.test(text) ? Math.min(Number(text), MAX_COUNT) : 0;
}

export function totalUnits(counts: Counts): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

/** Lines where more units were counted than the order still expects. */
export function overReceived(
  lines: readonly ReceivingLine[],
  counts: Counts,
): ReceivingLine[] {
  return lines.filter((line) => (counts[line.lineItemId] ?? 0) > line.openQty);
}

export function receiptRequest(
  idempotencyKey: string,
  counts: Counts,
  allowOverReceipt: boolean,
): ReceiptRequest {
  return {
    idempotencyKey,
    lines: Object.entries(counts)
      .filter(([, count]) => count > 0)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([lineItemId, acceptedQty]) => ({ lineItemId, acceptedQty })),
    ...(allowOverReceipt ? { allowOverReceipt: true } : {}),
  };
}

/**
 * One idempotency key for a delivery, kept from the first tap of Receive until
 * a receipt completes, whatever happens to the counts in between. If an answer
 * is lost the receipt may already exist; sending the same key again finishes
 * or repeats that receipt, and sending different counts under it is refused
 * (409) instead of recording the delivery twice. Refusals record nothing, so
 * the key stays safe to reuse after them.
 */
export function createSubmissionKey(newKey: () => string) {
  let current: string | null = null;
  return {
    get(): string {
      current ??= newKey();
      return current;
    },
    reset() {
      current = null;
    },
  };
}

/**
 * A fresh submission key. The extension sandbox may lack crypto.randomUUID, so
 * fall back to random hex of the same shape; a key only has to be unique.
 */
export function newSubmissionKey(): string {
  const webCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof webCrypto?.randomUUID === "function") return webCrypto.randomUUID();
  const hex = () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, "0");
  return `${hex()}-${hex()}-${hex()}-${hex()}`;
}

export function describeOrder(order: ReceivableOrder): string {
  const parts = [order.supplierName];
  if (order.expectedOn) parts.push(`due ${order.expectedOn}`);
  parts.push(`${order.remainingUnits} to come`);
  return parts.join(" · ");
}
