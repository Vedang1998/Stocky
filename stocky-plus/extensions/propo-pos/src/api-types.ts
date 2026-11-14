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
