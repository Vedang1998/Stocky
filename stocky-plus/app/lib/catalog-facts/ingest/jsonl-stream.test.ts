import { describe, expect, it, vi } from "vitest";
import { streamJsonlBatches } from "./jsonl-stream";

async function* chunks(...values: Array<string | Uint8Array>) {
  for (const value of values) yield value;
}

const product = (id: number) =>
  JSON.stringify({ id: `gid://shopify/Product/${id}`, title: `P${id}` });
const variant = (id: number, parent = 1) =>
  JSON.stringify({
    id: `gid://shopify/ProductVariant/${id}`,
    __parentId: `gid://shopify/Product/${parent}`,
  });

describe("F3 bounded JSONL completeness", () => {
  it("streams complete JSONL in bounded batches with 1-based ordinals", async () => {
    const seen: Array<[number, number]> = [];
    const result = await streamJsonlBatches({
      domain: "catalog",
      source: chunks(`${product(1)}\n${variant(1)}\n${product(2)}\n`),
      expectedObjectCount: "3",
      expectedRootObjectCount: "2",
      readBatchSize: 2,
      onBatch: async (batch) => {
        seen.push([batch.startLineOrdinal, batch.endLineOrdinal]);
      },
    });
    expect(result).toMatchObject({
      status: "COMPLETE",
      streamedObjectCount: "3",
      streamedRootObjectCount: "2",
      lastAppliedLineOrdinal: 3,
    });
    expect(seen).toEqual([
      [1, 2],
      [3, 3],
    ]);
  });

  it.each([null, "", " 1", "+1", "-1", "1.0", "1e1"])(
    "does not invoke apply for malformed object count %s",
    async (expectedObjectCount) => {
      const onBatch = vi.fn();
      const result = await streamJsonlBatches({
        domain: "catalog",
        source: chunks(`${product(1)}\n`),
        expectedObjectCount,
        expectedRootObjectCount: "1",
        onBatch,
      });
      expect(result).toMatchObject({
        status: "PARTIAL_FAILURE",
        failureCode: "count_token_missing_or_malformed",
      });
      expect(onBatch).not.toHaveBeenCalled();
    },
  );

  it("fails a malformed root count before transfer", async () => {
    const onBatch = vi.fn();
    const result = await streamJsonlBatches({
      domain: "catalog",
      source: chunks(`${product(1)}\n`),
      expectedObjectCount: "1",
      expectedRootObjectCount: "not-a-count",
      onBatch,
    });
    expect(result.status).toBe("PARTIAL_FAILURE");
    expect(onBatch).not.toHaveBeenCalled();
  });

  it("FX-JSONL-010 treats boundary-aligned truncation as partial failure", async () => {
    const result = await streamJsonlBatches({
      domain: "catalog",
      source: chunks(`${product(1)}\n${variant(1)}\n`),
      expectedObjectCount: "3",
      expectedRootObjectCount: "2",
      onBatch: async () => undefined,
    });
    expect(result).toMatchObject({
      status: "PARTIAL_FAILURE",
      failureCode: "object_count_mismatch",
      streamedObjectCount: "2",
    });
  });

  it("fails a root count mismatch even when object count matches", async () => {
    const result = await streamJsonlBatches({
      domain: "catalog",
      source: chunks(`${product(1)}\n${variant(1)}\n`),
      expectedObjectCount: "2",
      expectedRootObjectCount: "2",
      onBatch: async () => undefined,
    });
    expect(result).toMatchObject({
      status: "PARTIAL_FAILURE",
      failureCode: "root_object_count_mismatch",
    });
  });

  it("FX-JSONL-006 retains prior batch acknowledgement on malformed JSON", async () => {
    const result = await streamJsonlBatches({
      domain: "catalog",
      source: chunks(`${product(1)}\n{bad-json}\n`),
      expectedObjectCount: "2",
      expectedRootObjectCount: "1",
      readBatchSize: 1,
      onBatch: async () => undefined,
    });
    expect(result).toMatchObject({
      status: "PARTIAL_FAILURE",
      failureCode: "malformed_jsonl",
      lastAppliedLineOrdinal: 1,
    });
  });

  it("rejects a non-object JSON line", async () => {
    const result = await streamJsonlBatches({
      domain: "catalog",
      source: chunks('"scalar"\n'),
      expectedObjectCount: "1",
      expectedRootObjectCount: "0",
      onBatch: async () => undefined,
    });
    expect(result).toMatchObject({
      status: "PARTIAL_FAILURE",
      failureCode: "malformed_jsonl",
    });
  });

  it("fails closed on an unknown GID prefix", async () => {
    const result = await streamJsonlBatches({
      domain: "catalog",
      source: chunks('{"id":"gid://shopify/Unknown/1"}\n'),
      expectedObjectCount: "1",
      expectedRootObjectCount: "0",
      onBatch: async () => undefined,
    });
    expect(result).toMatchObject({
      status: "PARTIAL_FAILURE",
      failureCode: "unknown_jsonl_identity",
    });
  });

  it("classifies an interrupted async transfer as partial failure", async () => {
    async function* interrupted() {
      yield `${product(1)}\n`;
      throw new Error("socket reset");
    }
    const result = await streamJsonlBatches({
      domain: "catalog",
      source: interrupted(),
      expectedObjectCount: "2",
      expectedRootObjectCount: "2",
      onBatch: async () => undefined,
    });
    expect(result).toMatchObject({
      status: "PARTIAL_FAILURE",
      failureCode: "stream_aborted",
    });
  });

  it("honors an AbortSignal without a completeness claim", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await streamJsonlBatches({
      domain: "catalog",
      source: chunks(`${product(1)}\n`),
      expectedObjectCount: "1",
      expectedRootObjectCount: "1",
      signal: controller.signal,
      onBatch: async () => undefined,
    });
    expect(result).toMatchObject({
      status: "PARTIAL_FAILURE",
      failureCode: "stream_aborted",
    });
  });

  it("records a failed apply boundary without advancing it", async () => {
    const result = await streamJsonlBatches({
      domain: "catalog",
      source: chunks(`${product(1)}\n${product(2)}\n`),
      expectedObjectCount: "2",
      expectedRootObjectCount: "2",
      readBatchSize: 1,
      onBatch: async (batch) => {
        if (batch.startLineOrdinal === 2) throw new Error("commit failed");
      },
    });
    expect(result).toMatchObject({
      status: "PARTIAL_FAILURE",
      failureCode: "batch_apply_failed",
      lastAppliedLineOrdinal: 1,
    });
  });

  it("handles records split across transport chunks", async () => {
    const line = `${product(1)}\n`;
    const result = await streamJsonlBatches({
      domain: "catalog",
      source: chunks(line.slice(0, 7), line.slice(7)),
      expectedObjectCount: "1",
      expectedRootObjectCount: "1",
      onBatch: async () => undefined,
    });
    expect(result.status).toBe("COMPLETE");
  });

  it("accepts CRLF without changing counts", async () => {
    const result = await streamJsonlBatches({
      domain: "catalog",
      source: chunks(`${product(1)}\r\n`),
      expectedObjectCount: "1",
      expectedRootObjectCount: "1",
      onBatch: async () => undefined,
    });
    expect(result.status).toBe("COMPLETE");
  });

  it("accepts an empty proven stream", async () => {
    const result = await streamJsonlBatches({
      domain: "catalog",
      source: chunks(""),
      expectedObjectCount: "0",
      expectedRootObjectCount: "0",
      onBatch: async () => undefined,
    });
    expect(result).toMatchObject({
      status: "COMPLETE",
      lastParsedLineOrdinal: 0,
      lastAppliedLineOrdinal: 0,
    });
  });

  it("counts duplicate replay lines rather than deduplicating completeness", async () => {
    const result = await streamJsonlBatches({
      domain: "catalog",
      source: chunks(`${product(1)}\n${product(1)}\n`),
      expectedObjectCount: "2",
      expectedRootObjectCount: "2",
      onBatch: async () => undefined,
    });
    expect(result).toMatchObject({
      status: "COMPLETE",
      streamedObjectCount: "2",
    });
  });

  it("bounds a pathological unterminated line", async () => {
    const result = await streamJsonlBatches({
      domain: "catalog",
      source: chunks("x".repeat(40)),
      expectedObjectCount: "1",
      expectedRootObjectCount: "0",
      maxLineBytes: 8,
      onBatch: async () => undefined,
    });
    expect(result).toMatchObject({
      status: "PARTIAL_FAILURE",
      failureCode: "stream_truncated",
    });
  });

  it("uses InventoryItem roots for the inventory-level domain", async () => {
    const result = await streamJsonlBatches({
      domain: "inventory_levels",
      source: chunks(
        '{"id":"gid://shopify/InventoryItem/1"}\n' +
          '{"id":"gid://shopify/InventoryLevel/1"}\n',
      ),
      expectedObjectCount: "2",
      expectedRootObjectCount: "1",
      onBatch: async () => undefined,
    });
    expect(result.status).toBe("COMPLETE");
  });

  it("FX-JSONL-005 streams 100k lines within the 256MB bounded-memory envelope", async () => {
    async function* largeFixture() {
      for (let start = 1; start <= 100_000; start += 1_000) {
        yield `${Array.from({ length: 1_000 }, (_, offset) =>
          product(start + offset),
        ).join("\n")}\n`;
      }
    }
    const before = process.memoryUsage().heapUsed;
    let maxBatch = 0;
    const result = await streamJsonlBatches({
      domain: "catalog",
      source: largeFixture(),
      expectedObjectCount: "100000",
      expectedRootObjectCount: "100000",
      readBatchSize: 500,
      onBatch: async (batch) => {
        maxBatch = Math.max(maxBatch, batch.lines.length);
      },
    });
    const heapGrowth = Math.max(0, process.memoryUsage().heapUsed - before);
    expect(result.status).toBe("COMPLETE");
    expect(maxBatch).toBeLessThanOrEqual(500);
    expect(heapGrowth).toBeLessThan(256 * 1024 * 1024);
  }, 30_000);
});
