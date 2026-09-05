import {
  compareUnsignedCountToken,
  validateUnsignedCountToken,
} from "./counts";
import { classifyJsonlGid, UnknownJsonlIdentityError } from "./gid-classifier";
import type {
  JsonlBulkDomain,
  JsonlStreamResult,
  ParsedJsonlBatch,
  ParsedJsonlLine,
} from "./types";

export type JsonlByteSource =
  AsyncIterable<Uint8Array | string> | ReadableStream<Uint8Array>;

type StreamOptions = {
  domain: JsonlBulkDomain;
  source: JsonlByteSource;
  expectedObjectCount: string | null;
  expectedRootObjectCount: string | null;
  readBatchSize?: number;
  maxLineBytes?: number;
  signal?: AbortSignal;
  onBatch: (batch: ParsedJsonlBatch) => Promise<void>;
};

async function* chunksOf(
  source: JsonlByteSource,
): AsyncGenerator<Uint8Array | string> {
  if (Symbol.asyncIterator in Object(source)) {
    yield* source as AsyncIterable<Uint8Array | string>;
    return;
  }
  const reader = (source as ReadableStream<Uint8Array>).getReader();
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) return;
      yield next.value;
    }
  } finally {
    reader.releaseLock();
  }
}

function partial(
  failureCode: Exclude<
    JsonlStreamResult,
    { status: "COMPLETE" }
  >["failureCode"],
  failureSummary: string,
  counts: {
    objects: bigint;
    roots: bigint;
    parsed: number;
    applied: number;
  },
): JsonlStreamResult {
  return {
    status: "PARTIAL_FAILURE",
    failureCode,
    failureSummary,
    streamedObjectCount: counts.objects.toString(),
    streamedRootObjectCount: counts.roots.toString(),
    lastParsedLineOrdinal: counts.parsed,
    lastAppliedLineOrdinal: counts.applied,
  };
}

export async function streamJsonlBatches(
  options: StreamOptions,
): Promise<JsonlStreamResult> {
  const objectToken = validateUnsignedCountToken(options.expectedObjectCount);
  const rootToken = validateUnsignedCountToken(options.expectedRootObjectCount);
  const counts = { objects: 0n, roots: 0n, parsed: 0, applied: 0 };
  if (!objectToken.ok || !rootToken.ok) {
    return partial(
      "count_token_missing_or_malformed",
      "Bulk objectCount/rootObjectCount must both match ^[0-9]+$",
      counts,
    );
  }

  const readBatchSize = options.readBatchSize ?? 500;
  const maxLineBytes = options.maxLineBytes ?? 4 * 1024 * 1024;
  if (!Number.isSafeInteger(readBatchSize) || readBatchSize < 1) {
    throw new Error("jsonl_read_batch_size_invalid");
  }
  if (!Number.isSafeInteger(maxLineBytes) || maxLineBytes < 1) {
    throw new Error("jsonl_max_line_bytes_invalid");
  }

  const decoder = new TextDecoder();
  let buffered = "";
  let batch: ParsedJsonlLine[] = [];

  const flush = async (): Promise<JsonlStreamResult | null> => {
    if (batch.length === 0) return null;
    const current = batch;
    batch = [];
    const parsedBatch: ParsedJsonlBatch = {
      startLineOrdinal: current[0]!.ordinal,
      endLineOrdinal: current[current.length - 1]!.ordinal,
      lines: current,
    };
    try {
      await options.onBatch(parsedBatch);
      counts.applied = parsedBatch.endLineOrdinal;
      return null;
    } catch (error) {
      return partial(
        "batch_apply_failed",
        error instanceof Error ? error.message : String(error),
        counts,
      );
    }
  };

  const acceptLine = async (
    rawLine: string,
  ): Promise<JsonlStreamResult | null> => {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (line.length === 0) return null;
    if (Buffer.byteLength(line, "utf8") > maxLineBytes) {
      return partial(
        "stream_truncated",
        `JSONL line exceeded ${maxLineBytes} bytes`,
        counts,
      );
    }

    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch (error) {
      return partial(
        "malformed_jsonl",
        error instanceof Error ? error.message : String(error),
        counts,
      );
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return partial(
        "malformed_jsonl",
        "Every JSONL line must be a JSON object",
        counts,
      );
    }

    try {
      const classified = classifyJsonlGid(
        (value as Record<string, unknown>).id,
        options.domain,
      );
      counts.objects += 1n;
      if (classified.root) counts.roots += 1n;
      counts.parsed += 1;
      batch.push({
        ordinal: counts.parsed,
        resourceKind: classified.resourceKind,
        root: classified.root,
        value: value as Record<string, unknown>,
      });
    } catch (error) {
      if (error instanceof UnknownJsonlIdentityError) {
        return partial("unknown_jsonl_identity", error.message, counts);
      }
      throw error;
    }

    return batch.length >= readBatchSize ? flush() : null;
  };

  try {
    for await (const chunk of chunksOf(options.source)) {
      if (options.signal?.aborted) {
        return partial("stream_aborted", "JSONL transfer was aborted", counts);
      }
      buffered +=
        typeof chunk === "string"
          ? chunk
          : decoder.decode(chunk, { stream: true });
      if (Buffer.byteLength(buffered, "utf8") > maxLineBytes * 2) {
        return partial(
          "stream_truncated",
          "JSONL parser buffer exceeded the bounded line envelope",
          counts,
        );
      }
      let newline = buffered.indexOf("\n");
      while (newline >= 0) {
        const accepted = await acceptLine(buffered.slice(0, newline));
        buffered = buffered.slice(newline + 1);
        if (accepted) return accepted;
        newline = buffered.indexOf("\n");
      }
    }
    buffered += decoder.decode();
  } catch (error) {
    return partial(
      "stream_aborted",
      error instanceof Error ? error.message : String(error),
      counts,
    );
  }

  if (options.signal?.aborted) {
    return partial("stream_aborted", "JSONL transfer was aborted", counts);
  }
  if (buffered.length > 0) {
    const accepted = await acceptLine(buffered);
    if (accepted) return accepted;
  }
  const flushed = await flush();
  if (flushed) return flushed;

  const objectComparison = compareUnsignedCountToken(
    objectToken.token,
    counts.objects,
  );
  if (!objectComparison.ok) {
    return partial(
      "object_count_mismatch",
      `Streamed ${objectComparison.observed} objects; BulkOperation reported ${objectComparison.expected}`,
      counts,
    );
  }
  const rootComparison = compareUnsignedCountToken(
    rootToken.token,
    counts.roots,
  );
  if (!rootComparison.ok) {
    return partial(
      "root_object_count_mismatch",
      `Streamed ${rootComparison.observed} roots; BulkOperation reported ${rootComparison.expected}`,
      counts,
    );
  }

  return {
    status: "COMPLETE",
    streamedObjectCount: counts.objects.toString(),
    streamedRootObjectCount: counts.roots.toString(),
    lastParsedLineOrdinal: counts.parsed,
    lastAppliedLineOrdinal: counts.applied,
  };
}
