import { createHash } from "node:crypto";

export const INGEST_BATCH_ID_VERSION = "f3-ingest-v1" as const;

export function deriveIngestBatchId(input: {
  syncRunId: string;
  bulkOperationGid: string;
  startLineOrdinal: number;
}): string {
  if (!input.syncRunId || !input.bulkOperationGid) {
    throw new Error("ingest_batch_identity_missing");
  }
  if (
    !Number.isSafeInteger(input.startLineOrdinal) ||
    input.startLineOrdinal < 1
  ) {
    throw new Error("ingest_batch_start_ordinal_invalid");
  }
  return createHash("sha256")
    .update(
      [
        INGEST_BATCH_ID_VERSION,
        input.syncRunId,
        input.bulkOperationGid,
        String(input.startLineOrdinal),
      ].join("\n"),
    )
    .digest("hex");
}
