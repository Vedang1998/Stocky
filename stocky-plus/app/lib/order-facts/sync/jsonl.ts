import {
  compareUnsignedCountToken,
  validateUnsignedCountToken,
} from "../../catalog-facts/ingest/counts";
import {
  ORDER_FACTS_JSONL_MAX_LINE_BYTES,
  ORDER_FACTS_JSONL_MAX_LIVE_BYTES,
  ORDER_FACTS_JSONL_MAX_OPEN_PARENTS,
  ORDER_GID_PREFIX,
} from "./constants";
import { OrderFactsJsonlError } from "./errors";
import type {
  JsonlAssemblyResult,
  JsonlCloseEvidence,
  JsonlObject,
} from "./types";

export type JsonlByteSource =
  | AsyncIterable<Uint8Array | string>
  | ReadableStream<Uint8Array>;

export type JsonlCompleteAssembly = {
  rootGid: string;
  root: JsonlObject;
  children: JsonlObject[];
  lineOrdinals: number[];
  startLineOrdinal: number;
  endLineOrdinal: number;
  closeEvidence: JsonlCloseEvidence;
};

export type StreamOrderFactsJsonlOptions = {
  maxOpenParents?: number;
  maxLineBytes?: number;
  maxLiveBytes?: number;
  expectedObjectCount?: string | null;
  expectedRootObjectCount?: string | null;
  onCompleteAssembly?: (assembly: JsonlCompleteAssembly) => Promise<void>;
};

const LINE_ITEM_PREFIX = "gid://shopify/LineItem/";

function isRecord(value: unknown): value is JsonlObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

function lineItemCount(children: JsonlObject[]): number {
  return children.filter((child) => {
    const id = typeof child.id === "string" ? child.id : "";
    return id.startsWith(LINE_ITEM_PREFIX);
  }).length;
}

function expectedLineQuantity(root: JsonlObject): number | null {
  const raw = root.currentSubtotalLineItemsQuantity;
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0) {
    return raw;
  }
  if (typeof raw === "string" && /^[0-9]+$/.test(raw)) {
    const parsed = Number.parseInt(raw, 10);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

type OpenAssembly = {
  root: JsonlObject | null;
  children: JsonlObject[];
  lineOrdinals: number[];
  liveBytes: number;
};

/** Bounded recently-released root GIDs for duplicate detection across windows. */
class ReleasedRootRing {
  private readonly order: string[] = [];
  private readonly present = new Set<string>();

  constructor(private readonly max: number) {}

  has(id: string): boolean {
    return this.present.has(id);
  }

  add(id: string): void {
    if (this.present.has(id) || this.max <= 0) return;
    while (this.order.length >= this.max) {
      const oldest = this.order.shift();
      if (oldest) this.present.delete(oldest);
    }
    this.order.push(id);
    this.present.add(id);
  }
}

/**
 * Stream Bulk A JSONL without assuming groupObjects:false ordering.
 * Mid-stream release requires the selected currentSubtotalLineItemsQuantity
 * to equal attached LineItem children. Stream-end release additionally
 * requires leftover-empty, no orphans, and both unsigned count tokens.
 */
export async function streamOrderFactsJsonl(
  source: JsonlByteSource,
  options?: StreamOrderFactsJsonlOptions,
): Promise<JsonlAssemblyResult> {
  const maxOpenParents =
    options?.maxOpenParents ?? ORDER_FACTS_JSONL_MAX_OPEN_PARENTS;
  const maxLineBytes =
    options?.maxLineBytes ?? ORDER_FACTS_JSONL_MAX_LINE_BYTES;
  const maxLiveBytes =
    options?.maxLiveBytes ?? ORDER_FACTS_JSONL_MAX_LIVE_BYTES;
  const liveIds = new Set<string>();
  const releasedRootIds = new ReleasedRootRing(Math.max(maxOpenParents * 2, 32));
  const assemblies = new Map<string, OpenAssembly>();
  const orphanIndex = new Map<string, string>();
  const completedRootGids: string[] = [];
  let objectCount = 0;
  let rootCount = 0;
  let lastPhysicalOrdinal = 0;
  let liveBytes = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  let leftover = "";

  const fail = (
    status: Exclude<JsonlAssemblyResult["status"], "COMPLETE">,
    reason: string,
  ): JsonlAssemblyResult => ({
    status,
    reason,
    rootGids: completedRootGids,
    objectCount,
    rootCount,
    lastPhysicalOrdinal,
  });

  const liveParentKeys = (): number => {
    const keys = new Set(assemblies.keys());
    for (const parentId of orphanIndex.values()) {
      keys.add(parentId);
    }
    return keys.size;
  };

  const releaseAssembly = async (
    gid: string,
    evidence: JsonlCloseEvidence,
  ): Promise<JsonlAssemblyResult | null> => {
    const assembly = assemblies.get(gid);
    if (!assembly?.root) return null;
    const ordinals = [...assembly.lineOrdinals].sort((a, b) => a - b);
    const complete: JsonlCompleteAssembly = {
      rootGid: gid,
      root: assembly.root,
      children: assembly.children,
      lineOrdinals: ordinals,
      startLineOrdinal: ordinals[0] ?? lastPhysicalOrdinal,
      endLineOrdinal: ordinals[ordinals.length - 1] ?? lastPhysicalOrdinal,
      closeEvidence: evidence,
    };
    if (options?.onCompleteAssembly) {
      await options.onCompleteAssembly(complete);
    }
    if (!options?.onCompleteAssembly) {
      completedRootGids.push(gid);
    }
    releasedRootIds.add(gid);
    liveBytes -= assembly.liveBytes;
    for (const child of assembly.children) {
      if (typeof child.id === "string") {
        liveIds.delete(child.id);
        orphanIndex.delete(child.id);
      }
    }
    liveIds.delete(gid);
    assemblies.delete(gid);
    return null;
  };

  const tryClose = async (
    gid: string,
  ): Promise<JsonlAssemblyResult | null> => {
    const assembly = assemblies.get(gid);
    if (!assembly?.root) return null;
    const expected = expectedLineQuantity(assembly.root);
    if (expected == null) return null;
    if (lineItemCount(assembly.children) !== expected) return null;
    return releaseAssembly(gid, "currentSubtotalLineItemsQuantity");
  };

  const ingest = async (
    obj: JsonlObject,
    ordinal: number,
    encodedBytes: number,
  ): Promise<JsonlAssemblyResult | null> => {
    const id = typeof obj.id === "string" ? obj.id : null;
    if (!id) {
      return fail("MALFORMED", "JSONL object missing string id");
    }
    if (liveIds.has(id) || releasedRootIds.has(id)) {
      return fail("DUPLICATE", `duplicate JSONL id ${id}`);
    }
    objectCount += 1;
    liveIds.add(id);
    liveBytes += encodedBytes;
    if (liveBytes > maxLiveBytes) {
      return fail(
        "OPEN_PARENT_BOUND",
        `live JSONL assembly bytes exceeded ${maxLiveBytes}`,
      );
    }
    const parentId =
      typeof obj.__parentId === "string" ? obj.__parentId : null;
    if (!parentId) {
      if (!id.startsWith(ORDER_GID_PREFIX) || id === ORDER_GID_PREFIX) {
        return fail("MALFORMED", `JSONL root is not an Order GID: ${id}`);
      }
      rootCount += 1;
      const existing = assemblies.get(id) ?? {
        root: null,
        children: [],
        lineOrdinals: [],
        liveBytes: 0,
      };
      existing.root = obj;
      existing.lineOrdinals.push(ordinal);
      existing.liveBytes += encodedBytes;
      assemblies.set(id, existing);
      for (const child of existing.children) {
        if (typeof child.id === "string") orphanIndex.delete(child.id);
      }
      const closed = await tryClose(id);
      if (closed) return closed;
      if (liveParentKeys() > maxOpenParents) {
        return fail(
          "OPEN_PARENT_BOUND",
          `open parent assemblies exceeded ${maxOpenParents}`,
        );
      }
      return null;
    }
    const parentAssembly = assemblies.get(parentId) ?? {
      root: null,
      children: [],
      lineOrdinals: [],
      liveBytes: 0,
    };
    parentAssembly.children.push(obj);
    parentAssembly.lineOrdinals.push(ordinal);
    parentAssembly.liveBytes += encodedBytes;
    assemblies.set(parentId, parentAssembly);
    if (!parentAssembly.root) {
      orphanIndex.set(id, parentId);
    }
    if (liveParentKeys() > maxOpenParents) {
      return fail(
        "OPEN_PARENT_BOUND",
        `open parent assemblies exceeded ${maxOpenParents}`,
      );
    }
    if (parentAssembly.root) {
      return tryClose(parentId);
    }
    return null;
  };

  try {
    for await (const chunk of chunksOf(source)) {
      leftover +=
        typeof chunk === "string"
          ? chunk
          : decoder.decode(chunk, { stream: true });
      let newline = leftover.indexOf("\n");
      while (newline >= 0) {
        const rawLine = leftover.slice(0, newline);
        leftover = leftover.slice(newline + 1);
        newline = leftover.indexOf("\n");
        const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
        if (line.trim() === "") continue;
        lastPhysicalOrdinal += 1;
        if (utf8Bytes(line) > maxLineBytes) {
          return fail("TRUNCATED", "JSONL line exceeded max line bytes");
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          return fail("TRUNCATED", "JSONL line is not complete JSON");
        }
        if (!isRecord(parsed)) {
          return fail("MALFORMED", "JSONL line is not an object");
        }
        const result = await ingest(parsed, lastPhysicalOrdinal, utf8Bytes(line));
        if (result) return result;
      }
      if (utf8Bytes(leftover) > maxLineBytes) {
        return fail("TRUNCATED", "JSONL leftover exceeded max line bytes");
      }
    }
    leftover += decoder.decode();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/invalid|malformed|unexpected|utf/i.test(message)) {
      return fail("MALFORMED", `JSONL UTF-8 decode failed: ${message}`);
    }
    throw error;
  }

  if (leftover.trim() !== "") {
    return fail("TRUNCATED", "JSONL stream ended with a partial line");
  }

  const objectToken = validateUnsignedCountToken(options?.expectedObjectCount);
  const rootToken = validateUnsignedCountToken(options?.expectedRootObjectCount);
  if (!objectToken.ok || !rootToken.ok) {
    return fail(
      "TRUNCATED",
      "Bulk objectCount/rootObjectCount must both match ^[0-9]+$",
    );
  }
  const objectComparison = compareUnsignedCountToken(
    objectToken.token,
    BigInt(objectCount),
  );
  if (!objectComparison.ok) {
    return fail(
      "TRUNCATED",
      `Streamed ${objectComparison.observed} objects; BulkOperation reported ${objectComparison.expected}`,
    );
  }
  const rootComparison = compareUnsignedCountToken(
    rootToken.token,
    BigInt(rootCount),
  );
  if (!rootComparison.ok) {
    return fail(
      "TRUNCATED",
      `Streamed ${rootComparison.observed} roots; BulkOperation reported ${rootComparison.expected}`,
    );
  }

  const stillOrphan = [...assemblies.entries()].filter(([, row]) => !row.root);
  if (stillOrphan.length > 0) {
    return fail(
      "MIS_PARENTED",
      `JSONL children referenced ${stillOrphan.length} missing parent(s)`,
    );
  }

  const leftoverParents = [...assemblies.entries()].filter(([, row]) => row.root);
  if (leftoverParents.length > 0) {
    const [gid, assembly] = leftoverParents[0];
    const expected = expectedLineQuantity(assembly.root!);
    if (expected == null) {
      return fail(
        "TRUNCATED",
        `Order ${gid} missing currentSubtotalLineItemsQuantity; newline and export counts are not parent-complete evidence`,
      );
    }
    return fail(
      "TRUNCATED",
      `Order ${gid} LineItem count ${lineItemCount(assembly.children)} !== currentSubtotalLineItemsQuantity ${expected}`,
    );
  }

  return {
    status: "COMPLETE",
    rootGids: completedRootGids,
    objectCount,
    rootCount,
    lastPhysicalOrdinal,
    closeEvidence: "stream_end_count_agreement",
  };
}

export async function assembleOrderFactsJsonl(
  source: JsonlByteSource,
  options?: StreamOrderFactsJsonlOptions,
): Promise<JsonlAssemblyResult> {
  return streamOrderFactsJsonl(source, options);
}

export function nominatedOrderGids(result: JsonlAssemblyResult): string[] {
  if (result.status !== "COMPLETE") {
    throw new OrderFactsJsonlError(
      "jsonl_not_complete",
      "Cannot nominate GIDs from an incomplete JSONL assembly",
    );
  }
  return result.rootGids;
}
