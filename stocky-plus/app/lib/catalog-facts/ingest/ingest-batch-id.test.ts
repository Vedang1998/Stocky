import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  deriveIngestBatchId,
  INGEST_BATCH_ID_VERSION,
} from "./ingest-batch-id";

describe("F3 deterministic ingestBatchId", () => {
  it("matches the frozen newline-delimited SHA-256 derivation", () => {
    const expected = createHash("sha256")
      .update(
        [
          "f3-ingest-v1",
          "sync-run-1",
          "gid://shopify/BulkOperation/9",
          "101",
        ].join("\n"),
      )
      .digest("hex");
    expect(
      deriveIngestBatchId({
        syncRunId: "sync-run-1",
        bulkOperationGid: "gid://shopify/BulkOperation/9",
        startLineOrdinal: 101,
      }),
    ).toBe(expected);
    expect(INGEST_BATCH_ID_VERSION).toBe("f3-ingest-v1");
  });

  it("replay derives the same id", () => {
    const input = {
      syncRunId: "run",
      bulkOperationGid: "gid://shopify/BulkOperation/1",
      startLineOrdinal: 1,
    };
    expect(deriveIngestBatchId(input)).toBe(deriveIngestBatchId(input));
  });

  it("different operation GIDs cannot share a checkpoint identity", () => {
    const common = { syncRunId: "run", startLineOrdinal: 1 };
    expect(
      deriveIngestBatchId({
        ...common,
        bulkOperationGid: "gid://shopify/BulkOperation/A",
      }),
    ).not.toBe(
      deriveIngestBatchId({
        ...common,
        bulkOperationGid: "gid://shopify/BulkOperation/B",
      }),
    );
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid start ordinal %s",
    (startLineOrdinal) => {
      expect(() =>
        deriveIngestBatchId({
          syncRunId: "run",
          bulkOperationGid: "gid://shopify/BulkOperation/A",
          startLineOrdinal,
        }),
      ).toThrow("ingest_batch_start_ordinal_invalid");
    },
  );
});
