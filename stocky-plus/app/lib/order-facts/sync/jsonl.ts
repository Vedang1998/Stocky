import {
  ORDER_FACTS_JSONL_MAX_LINE_BYTES,
  ORDER_FACTS_JSONL_MAX_OPEN_PARENTS,
  ORDER_GID_PREFIX,
} from "./constants";
import { OrderFactsJsonlError } from "./errors";
import type { JsonlAssemblyResult, JsonlObject } from "./types";

export type JsonlByteSource =
  | AsyncIterable<Uint8Array | string>
  | ReadableStream<Uint8Array>;

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

/**
 * Assemble Bulk A JSONL without assuming groupObjects:false ordering.
 * Fail closed on truncated lines, duplicate ids, mis-parented children,
 * and open-parent memory bound. Physical chunks are not transactions.
 */
export async function assembleOrderFactsJsonl(
  source: JsonlByteSource,
  options?: { maxOpenParents?: number; maxLineBytes?: number },
): Promise<JsonlAssemblyResult> {
  const maxOpenParents =
    options?.maxOpenParents ?? ORDER_FACTS_JSONL_MAX_OPEN_PARENTS;
  const maxLineBytes =
    options?.maxLineBytes ?? ORDER_FACTS_JSONL_MAX_LINE_BYTES;
  const seenIds = new Set<string>();
  const roots = new Map<string, JsonlObject>();
  const orphans = new Map<string, JsonlObject[]>();
  let objectCount = 0;
  let leftover = "";

  const fail = (
    status: Exclude<JsonlAssemblyResult["status"], "COMPLETE">,
    reason: string,
  ): JsonlAssemblyResult => ({
    status,
    reason,
    rootGids: [...roots.keys()],
    objectCount,
    rootCount: roots.size,
  });

  const ingest = (obj: JsonlObject): JsonlAssemblyResult | null => {
    const id = typeof obj.id === "string" ? obj.id : null;
    if (!id) {
      return fail("MALFORMED", "JSONL object missing string id");
    }
    if (seenIds.has(id)) {
      return fail("DUPLICATE", `duplicate JSONL id ${id}`);
    }
    seenIds.add(id);
    objectCount += 1;
    const parentId =
      typeof obj.__parentId === "string" ? obj.__parentId : null;
    if (!parentId) {
      if (!id.startsWith(ORDER_GID_PREFIX) || id === ORDER_GID_PREFIX) {
        return fail("MALFORMED", `JSONL root is not an Order GID: ${id}`);
      }
      roots.set(id, obj);
      const pending = orphans.get(id);
      if (pending) orphans.delete(id);
      if (roots.size + orphans.size > maxOpenParents) {
        return fail(
          "OPEN_PARENT_BOUND",
          `open parent assemblies exceeded ${maxOpenParents}`,
        );
      }
      return null;
    }
    if (roots.has(parentId)) {
      return null;
    }
    const list = orphans.get(parentId) ?? [];
    list.push(obj);
    orphans.set(parentId, list);
    if (roots.size + orphans.size > maxOpenParents) {
      return fail(
        "OPEN_PARENT_BOUND",
        `open parent assemblies exceeded ${maxOpenParents}`,
      );
    }
    return null;
  };

  for await (const chunk of chunksOf(source)) {
    leftover += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    let newline = leftover.indexOf("\n");
    while (newline >= 0) {
      const line = leftover.slice(0, newline);
      leftover = leftover.slice(newline + 1);
      newline = leftover.indexOf("\n");
      if (line.trim() === "") continue;
      if (Buffer.byteLength(line, "utf8") > maxLineBytes) {
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
      const result = ingest(parsed);
      if (result) return result;
    }
    if (Buffer.byteLength(leftover, "utf8") > maxLineBytes) {
      return fail("TRUNCATED", "JSONL leftover exceeded max line bytes");
    }
  }

  if (leftover.trim() !== "") {
    return fail("TRUNCATED", "JSONL stream ended with a partial line");
  }
  if (orphans.size > 0) {
    return fail(
      "MIS_PARENTED",
      `JSONL children referenced ${orphans.size} missing parent(s)`,
    );
  }
  return {
    status: "COMPLETE",
    rootGids: [...roots.keys()],
    objectCount,
    rootCount: roots.size,
  };
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
