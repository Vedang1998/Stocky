import type {
  ApiErrorBody,
  ResolvedVariant,
  ScanMatchField,
  ScanResponse,
  StockResponse,
  VariantStock,
} from "./api-types";

export type LookupView =
  | { kind: "idle" }
  | { kind: "loading"; label: string }
  | { kind: "error"; message: string }
  | { kind: "invalid" }
  | { kind: "unknown"; code: string }
  | {
      kind: "choose";
      code: string;
      matchedOn: ScanMatchField;
      candidates: ResolvedVariant[];
      truncated: boolean;
    }
  | {
      kind: "stock";
      variant: ResolvedVariant;
      matchedOn: ScanMatchField | null;
      stock: VariantStock | null;
      /** When the stock arrived; freshness labels are relative to it. */
      loadedAt: number;
    };

export type ErrorView = Extract<LookupView, { kind: "error" }>;
export type StockView = Extract<LookupView, { kind: "stock" }>;

type FetchLike = (
  input: string,
  init?: { signal?: AbortSignal },
) => Promise<Pick<Response, "ok" | "status" | "json">>;

export const MESSAGES = {
  signIn:
    "Your POS user can't use ProPo. Sign in with a staff account that has access to the ProPo app, then try again.",
  unavailable: "ProPo isn't available for this store right now.",
  offline: "Can't reach ProPo. Check the device's connection and try again.",
  failed: "ProPo couldn't load stock. Try again.",
  unreadable: "That code couldn't be read. Scan it again.",
  removed:
    "This product isn't in ProPo's catalog. Products added in Shopify appear after the next catalog sync.",
  busy: "Too many lookups in a short time. Wait a moment and try again.",
  noVariant: "ProPo can't show stock for this item.",
} as const;

function scanUrl(code: string, locationId: number | null): string {
  const params = new URLSearchParams({ code });
  if (locationId !== null) params.set("location", String(locationId));
  return `/api/pos/scan?${params.toString()}`;
}

function stockUrl(variantGid: string, locationId: number | null): string {
  const params = new URLSearchParams({ variant: variantGid });
  if (locationId !== null) params.set("location", String(locationId));
  return `/api/pos/stock?${params.toString()}`;
}

function isAbort(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

async function errorView(
  response: Pick<Response, "status" | "json">,
): Promise<ErrorView> {
  if (response.status === 401) return { kind: "error", message: MESSAGES.signIn };
  if (response.status === 400) return { kind: "error", message: MESSAGES.unreadable };
  if (response.status === 404) return { kind: "error", message: MESSAGES.removed };
  if (response.status === 429) return { kind: "error", message: MESSAGES.busy };
  if (response.status === 403) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    return {
      kind: "error",
      message: body?.error?.message || MESSAGES.unavailable,
    };
  }
  return { kind: "error", message: MESSAGES.failed };
}

/**
 * Request JSON from the app. Returns null when the request was aborted
 * because a newer scan replaced it.
 */
async function request<T>(
  fetchImpl: FetchLike,
  url: string,
  signal: AbortSignal | undefined,
): Promise<{ ok: true; body: T } | { ok: false; view: ErrorView } | null> {
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchImpl(url, { signal });
  } catch (error) {
    if (isAbort(error)) return null;
    return { ok: false, view: { kind: "error", message: MESSAGES.offline } };
  }
  if (!response.ok) return { ok: false, view: await errorView(response) };
  try {
    return { ok: true, body: (await response.json()) as T };
  } catch (error) {
    if (isAbort(error)) return null;
    return { ok: false, view: { kind: "error", message: MESSAGES.failed } };
  }
}

export async function lookupCode(
  fetchImpl: FetchLike,
  code: string,
  locationId: number | null,
  signal?: AbortSignal,
): Promise<LookupView | null> {
  const result = await request<ScanResponse>(fetchImpl, scanUrl(code, locationId), signal);
  if (result === null) return null;
  if (!result.ok) return result.view;

  const { resolution, stock } = result.body;
  switch (resolution.status) {
    case "invalid":
      return { kind: "invalid" };
    case "unknown":
      return { kind: "unknown", code: resolution.code };
    case "ambiguous":
      return {
        kind: "choose",
        code: resolution.code,
        matchedOn: resolution.matchedOn,
        candidates: resolution.candidates,
        truncated: resolution.truncated,
      };
    case "matched":
      return {
        kind: "stock",
        variant: resolution.variant,
        matchedOn: resolution.matchedOn,
        stock,
        loadedAt: Date.now(),
      };
  }
}

export async function lookupVariant(
  fetchImpl: FetchLike,
  variantGid: string,
  locationId: number | null,
  signal?: AbortSignal,
): Promise<ErrorView | StockView | null> {
  const result = await request<StockResponse>(
    fetchImpl,
    stockUrl(variantGid, locationId),
    signal,
  );
  if (result === null) return null;
  if (!result.ok) return result.view;
  return {
    kind: "stock",
    variant: result.body.variant,
    matchedOn: null,
    stock: result.body.stock,
    loadedAt: Date.now(),
  };
}
