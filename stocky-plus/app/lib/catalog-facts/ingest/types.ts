import type { CanonicalObservation } from "../apply/types";

export type JsonlBulkDomain = "catalog" | "inventory_levels";

export type JsonlResourceKind =
  | "Product"
  | "ProductVariant"
  | "InventoryItem"
  | "Location"
  | "InventoryLevel"
  | "Collection";

export type ParsedJsonlLine = {
  ordinal: number;
  resourceKind: JsonlResourceKind;
  root: boolean;
  value: Record<string, unknown>;
};

export type ParsedJsonlBatch = {
  startLineOrdinal: number;
  endLineOrdinal: number;
  lines: ParsedJsonlLine[];
};

export type JsonlCompletenessFailureCode =
  | "count_token_missing_or_malformed"
  | "stream_aborted"
  | "stream_truncated"
  | "malformed_jsonl"
  | "unknown_jsonl_identity"
  | "object_count_mismatch"
  | "root_object_count_mismatch"
  | "batch_apply_failed";

export type JsonlStreamResult =
  | {
      status: "COMPLETE";
      streamedObjectCount: string;
      streamedRootObjectCount: string;
      lastParsedLineOrdinal: number;
      lastAppliedLineOrdinal: number;
    }
  | {
      status: "PARTIAL_FAILURE";
      failureCode: JsonlCompletenessFailureCode;
      failureSummary: string;
      streamedObjectCount: string;
      streamedRootObjectCount: string;
      lastParsedLineOrdinal: number;
      lastAppliedLineOrdinal: number;
    };

export type MappedJsonlLine = {
  observations: CanonicalObservation[];
  collectionMembership?: {
    productGid: string;
    collectionGid: string;
    title: string;
  };
};
