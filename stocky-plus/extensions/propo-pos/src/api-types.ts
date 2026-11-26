/**
 * Response contract of the app's /api/pos endpoints. The app's test suite
 * checks these against the server types, so drift fails CI.
 */

export type ResolvedVariant = {
  variantGid: string;
  productGid: string;
  displayName: string;
  productTitle: string | null;
  variantTitle: string;
  sku: string | null;
  barcode: string | null;
  imageUrl: string | null;
};

export type ScanMatchField = "barcode" | "sku";

export type ScanResolution =
  | { status: "invalid"; reason: "empty" | "too_long" }
  | { status: "unknown"; code: string }
  | {
      status: "matched";
      code: string;
      matchedOn: ScanMatchField;
      variant: ResolvedVariant;
    }
  | {
      status: "ambiguous";
      code: string;
      matchedOn: ScanMatchField;
      candidates: ResolvedVariant[];
      truncated: boolean;
    };

export type StockQuantities = {
  available: number | null;
  onHand: number | null;
  committed: number | null;
  incoming: number | null;
};

export type LocationStock = StockQuantities & {
  locationGid: string;
  locationName: string;
  observedAt: string | null;
};

export type VariantStock = {
  variantGid: string;
  inventoryItemGid: string | null;
  tracked: boolean | null;
  locations: LocationStock[];
  totals: StockQuantities;
};

export type ScanResponse = {
  resolution: ScanResolution;
  stock: VariantStock | null;
};

export type StockResponse = {
  variant: ResolvedVariant;
  stock: VariantStock | null;
};

export type ApiErrorBody = {
  error: { code: string; message: string };
};

export type ReceivableOrder = {
  id: string;
  poNumber: string;
  supplierName: string;
  status: string;
  /** YYYY-MM-DD, or null when no date is set. */
  expectedOn: string | null;
  orderedUnits: number;
  receivedUnits: number;
  remainingUnits: number;
};

export type ReceivingListResponse = {
  receivingEnabled: boolean;
  orders: ReceivableOrder[];
  hasMore: boolean;
};

export type ReceivingLine = {
  lineItemId: string;
  variantGid: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  orderedQty: number;
  receivedQty: number;
  pendingQty: number;
  rejectedQty: number;
  /** Units a new receipt can accept without confirming an over-receipt. */
  openQty: number;
};

export type ReceivingSheet = {
  receivingEnabled: boolean;
  order: { id: string; poNumber: string; supplierName: string };
  /** Why nothing can be received right now, or null when receiving is open. */
  denial: string | null;
  lines: ReceivingLine[];
};

export type ReceiptRequest = {
  /** One per submission; sending it again records the receipt once. */
  idempotencyKey: string;
  lines: Array<{ lineItemId: string; acceptedQty: number }>;
  allowOverReceipt?: boolean;
};

export type ReceiptResponse = {
  complete: boolean;
  message: string;
  receiptNumber: number | null;
  /** posted: finished; pending: saved, retry the same request; settled: ended unfinished, start fresh; not_recorded: nothing saved. */
  outcome: "posted" | "pending" | "settled" | "not_recorded";
  /** Null when the order could not be read back after the receipt was recorded. */
  sheet: ReceivingSheet | null;
};

export type ApiErrorWithFields = {
  error: { code: string; message: string; fieldErrors?: Record<string, string> };
};

export type CountableStocktake = {
  id: string;
  name: string;
  scope: "FULL" | "PARTIAL";
  blind: boolean;
  lineCount: number;
  countedCount: number;
};

export type StocktakeListResponse = {
  stocktakes: CountableStocktake[];
  hasMore: boolean;
};

export type CountLine = {
  lineId: string;
  variantGid: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  countedQty: number | null;
};

export type CountProgress = { lineCount: number; countedCount: number };

export type CountSheet = {
  stocktake: { id: string; name: string; blind: boolean } & CountProgress;
  counted: CountLine[];
  hasMoreCounted: boolean;
};

export type CountResponse =
  | {
      ok: true;
      line: {
        lineId: string;
        title: string;
        countedQty: number | null;
        added: boolean;
        recounted: boolean;
      };
      progress: CountProgress;
    }
  | { ok: false; message: string; progress: CountProgress };
