/**
 * D-owned validated-source staging. Scratch files are worker-local, per-shop,
 * disposable, and not source authority. Parent closure is indexed membership
 * after validated EOF — not quantity, next-root, or groupObjects:false order.
 */
import { createReadStream, createWriteStream } from "node:fs";
import readline from "node:readline";
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  compareUnsignedCountToken,
  validateUnsignedCountToken,
} from "../../catalog-facts/ingest/counts";
import {
  ORDER_FACTS_JSONL_ID_SORT_CHUNK,
  ORDER_FACTS_JSONL_MAX_GROUP_MERGE_FILES,
  ORDER_FACTS_JSONL_MAX_LINE_BYTES,
  ORDER_FACTS_JSONL_MAX_LIVE_BYTES,
  ORDER_FACTS_JSONL_MAX_SCRATCH_BYTES,
  ORDER_FACTS_SCRATCH_PREFIX,
  ORDER_GID_PREFIX,
} from "./constants";
import { OrderFactsJsonlError } from "./errors";
import type { JsonlAssemblyResult, JsonlByteSource, JsonlObject } from "./types";

export type JsonlIndexKind = "R" | "C";

export type JsonlIndexRow = {
  ordinal: number;
  offset: number;
  length: number;
  kind: JsonlIndexKind;
  id: string;
  parentId: string;
};

export type ValidatedSourceStage = {
  status: "COMPLETE";
  dir: string;
  jsonlPath: string;
  indexPath: string;
  groupedPath: string;
  objectCount: number;
  rootCount: number;
  lastPhysicalOrdinal: number;
  owned: true;
};

export type StageFail = Extract<JsonlAssemblyResult, { status: Exclude<JsonlAssemblyResult["status"], "COMPLETE"> }>;

export type StageResult = ValidatedSourceStage | StageFail;

export type StageJsonlOptions = {
  shopId?: string;
  syncRunId?: string;
  maxLineBytes?: number;
  maxLiveBytes?: number;
  maxScratchBytes?: number;
  expectedObjectCount?: string | null;
  expectedRootObjectCount?: string | null;
  scratchRoot?: string;
};

function fail(
  status: StageFail["status"],
  reason: string,
  extras?: { objectCount?: number; rootCount?: number; lastPhysicalOrdinal?: number },
): StageFail {
  return {
    status,
    reason,
    rootGids: [],
    objectCount: extras?.objectCount ?? 0,
    rootCount: extras?.rootCount ?? 0,
    lastPhysicalOrdinal: extras?.lastPhysicalOrdinal ?? 0,
  };
}

function safeSegment(value: string, fallback: string): string {
  const trimmed = value.trim();
  const cleaned = trimmed.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  if (!cleaned || cleaned === "." || cleaned === "..") return fallback;
  return cleaned;
}

async function chunksOf(
  source: JsonlByteSource,
): Promise<AsyncGenerator<Uint8Array | string>> {
  async function* iterate() {
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
  return iterate();
}

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function isRecord(value: unknown): value is JsonlObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function assertOwnedDirectory(dir: string): Promise<void> {
  const st = await lstat(dir);
  if (st.isSymbolicLink()) {
    throw new OrderFactsJsonlError(
      "scratch_symlink_refused",
      `refusing to use symlink scratch ${dir}`,
    );
  }
  if (!st.isDirectory()) {
    throw new OrderFactsJsonlError(
      "scratch_not_directory",
      `scratch path is not a directory ${dir}`,
    );
  }
  if (typeof process.getuid === "function" && st.uid !== process.getuid()) {
    throw new OrderFactsJsonlError(
      "scratch_unowned",
      `refusing unowned scratch ${dir}`,
    );
  }
}

export async function createOwnedScratchDir(input: {
  shopId?: string;
  syncRunId?: string;
  scratchRoot?: string;
}): Promise<string> {
  const root = input.scratchRoot ?? path.join(os.tmpdir(), ORDER_FACTS_SCRATCH_PREFIX);
  const shop = safeSegment(input.shopId ?? "local", "local");
  const run = safeSegment(
    input.syncRunId ?? `run-${process.pid}-${Date.now()}`,
    `run-${process.pid}`,
  );
  await mkdir(root, { recursive: true, mode: 0o700 });
  await assertOwnedDirectory(root);
  const shopDir = path.join(root, shop);
  await mkdir(shopDir, { recursive: true, mode: 0o700 });
  await assertOwnedDirectory(shopDir);
  const dir = path.join(shopDir, run);
  try {
    await assertOwnedDirectory(dir);
    await rm(dir, { recursive: true, force: false });
  } catch (error) {
    if (error instanceof OrderFactsJsonlError) throw error;
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (code !== "ENOENT") throw error;
  }
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await assertOwnedDirectory(dir);
  const resolved = await realpath(dir);
  if (resolved !== dir && path.resolve(dir) !== resolved) {
    const st = await lstat(dir);
    if (st.isSymbolicLink()) {
      throw new OrderFactsJsonlError(
        "scratch_symlink_refused",
        `refusing to use symlink scratch ${dir}`,
      );
    }
  }
  return resolved;
}

export async function disposeOwnedScratch(
  dir: string | null | undefined,
  scratchRoot?: string,
): Promise<void> {
  if (!dir) return;
  try {
    await assertOwnedDirectory(dir);
  } catch {
    return;
  }
  const resolved = await realpath(dir);
  const prefix = scratchRoot ?? path.join(os.tmpdir(), ORDER_FACTS_SCRATCH_PREFIX);
  const resolvedPrefix = await realpath(prefix).catch(() => prefix);
  if (!resolved.startsWith(resolvedPrefix + path.sep) && resolved !== resolvedPrefix) {
    throw new OrderFactsJsonlError(
      "scratch_unowned",
      "refusing to delete scratch outside the D prefix",
    );
  }
  await rm(resolved, { recursive: true, force: false });
}

function tsvEscape(value: string): string {
  if (/[\t\n\r]/.test(value)) {
    throw new OrderFactsJsonlError(
      "jsonl_id_invalid",
      "JSONL id contains a delimiter",
    );
  }
  return value;
}

async function sortLines(filePath: string, chunkSize: number): Promise<void> {
  const raw = await readFile(filePath, "utf8");
  if (raw === "") return;
  const lines = raw.endsWith("\n") ? raw.slice(0, -1).split("\n") : raw.split("\n");
  if (lines.length <= chunkSize) {
    lines.sort();
    await writeFile(filePath, lines.length ? `${lines.join("\n")}\n` : "", "utf8");
    return;
  }
  const dir = path.dirname(filePath);
  const parts: string[] = [];
  for (let offset = 0; offset < lines.length; offset += chunkSize) {
    if (parts.length >= ORDER_FACTS_JSONL_MAX_GROUP_MERGE_FILES) {
      throw new OrderFactsJsonlError(
        "jsonl_sort_bound",
        `external sort exceeded ${ORDER_FACTS_JSONL_MAX_GROUP_MERGE_FILES} chunk files`,
      );
    }
    const chunk = lines.slice(offset, offset + chunkSize).sort();
    const partPath = path.join(dir, `sort-${parts.length}.part`);
    await writeFile(partPath, `${chunk.join("\n")}\n`, "utf8");
    parts.push(partPath);
  }
  const merged: string[] = [];
  const heads = await Promise.all(
    parts.map(async (part) => {
      const text = await readFile(part, "utf8");
      return text.endsWith("\n") ? text.slice(0, -1).split("\n") : text.split("\n");
    }),
  );
  const idx = heads.map(() => 0);
  for (;;) {
    let best: string | null = null;
    let bestI = -1;
    for (let i = 0; i < heads.length; i += 1) {
      const row = heads[i][idx[i]];
      if (row == null) continue;
      if (best == null || row < best) {
        best = row;
        bestI = i;
      }
    }
    if (best == null || bestI < 0) break;
    merged.push(best);
    idx[bestI] += 1;
  }
  await writeFile(filePath, merged.length ? `${merged.join("\n")}\n` : "", "utf8");
  await Promise.all(parts.map((part) => rm(part, { force: true })));
}

async function assertUniqueSortedIds(idsPath: string): Promise<StageFail | null> {
  const text = await readFile(idsPath, "utf8");
  if (text === "") return null;
  const lines = text.endsWith("\n") ? text.slice(0, -1).split("\n") : text.split("\n");
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === lines[i - 1]) {
      return fail("DUPLICATE", `duplicate JSONL id ${lines[i]}`);
    }
  }
  return null;
}

export async function stageOrderFactsJsonl(
  source: JsonlByteSource,
  options?: StageJsonlOptions,
): Promise<StageResult> {
  const maxLineBytes = options?.maxLineBytes ?? ORDER_FACTS_JSONL_MAX_LINE_BYTES;
  const maxLiveBytes = options?.maxLiveBytes ?? ORDER_FACTS_JSONL_MAX_LIVE_BYTES;
  const maxScratchBytes =
    options?.maxScratchBytes ?? ORDER_FACTS_JSONL_MAX_SCRATCH_BYTES;
  let dir: string | null = null;
  let keepScratch = false;
  const streams: ReturnType<typeof createWriteStream>[] = [];
  let streamsEnded = false;
  const endStreams = async (): Promise<void> => {
    if (streamsEnded) return;
    streamsEnded = true;
    await Promise.all(
      streams.map(
        (stream) =>
          new Promise<void>((resolve) => {
            if (stream.destroyed) {
              resolve();
              return;
            }
            stream.end(() => resolve());
            stream.once("error", () => resolve());
          }),
      ),
    );
  };
  try {
    dir = await createOwnedScratchDir({
      shopId: options?.shopId,
      syncRunId: options?.syncRunId,
      scratchRoot: options?.scratchRoot,
    });
    const jsonlPath = path.join(dir, "source.jsonl");
    const indexPath = path.join(dir, "index.tsv");
    const idsPath = path.join(dir, "ids.tsv");
    const groupedPath = path.join(dir, "grouped.tsv");
    const jsonlOut = createWriteStream(jsonlPath, { mode: 0o600 });
    const indexOut = createWriteStream(indexPath, { mode: 0o600 });
    const idsOut = createWriteStream(idsPath, { mode: 0o600 });
    const groupedOut = createWriteStream(groupedPath, { mode: 0o600 });
    streams.push(jsonlOut, indexOut, idsOut, groupedOut);
    const writeOk = async (
      stream: NodeJS.WritableStream,
      chunk: string,
    ): Promise<void> => {
      if (stream.write(chunk)) return;
      await new Promise<void>((resolve, reject) => {
        stream.once("drain", resolve);
        stream.once("error", reject);
      });
    };
    let scratchBytes = 0;
    const account = (n: number): StageFail | null => {
      scratchBytes += n;
      if (scratchBytes > maxScratchBytes) {
        return fail(
          "OPEN_PARENT_BOUND",
          `scratch JSONL bytes exceeded ${maxScratchBytes}`,
        );
      }
      return null;
    };
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    let leftover = "";
    let objectCount = 0;
    let rootCount = 0;
    let lastPhysicalOrdinal = 0;
    let fileOffset = 0;

    const ingestLine = async (line: string): Promise<StageFail | null> => {
      if (line.trim() === "") return null;
      lastPhysicalOrdinal += 1;
      const encoded = Buffer.from(line, "utf8");
      if (encoded.length > maxLineBytes) {
        return fail("TRUNCATED", "JSONL line exceeded max line bytes", {
          objectCount,
          rootCount,
          lastPhysicalOrdinal,
        });
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        return fail("TRUNCATED", "JSONL line is not complete JSON", {
          objectCount,
          rootCount,
          lastPhysicalOrdinal,
        });
      }
      if (!isRecord(parsed)) {
        return fail("MALFORMED", "JSONL line is not an object", {
          objectCount,
          rootCount,
          lastPhysicalOrdinal,
        });
      }
      const id = typeof parsed.id === "string" ? parsed.id : null;
      if (!id) {
        return fail("MALFORMED", "JSONL object missing string id", {
          objectCount,
          rootCount,
          lastPhysicalOrdinal,
        });
      }
      const parentId =
        typeof parsed.__parentId === "string" ? parsed.__parentId : "";
      const kind: JsonlIndexKind = parentId ? "C" : "R";
      if (kind === "R") {
        if (!id.startsWith(ORDER_GID_PREFIX) || id === ORDER_GID_PREFIX) {
          return fail("MALFORMED", `JSONL root is not an Order GID: ${id}`, {
            objectCount,
            rootCount,
            lastPhysicalOrdinal,
          });
        }
        rootCount += 1;
      }
      objectCount += 1;
      const record = `${line}\n`;
      const bound = account(utf8Bytes(record) + 160);
      if (bound) return bound;
      await writeOk(jsonlOut, record);
      const indexRow = `${lastPhysicalOrdinal}\t${fileOffset}\t${encoded.length}\t${kind}\t${tsvEscape(id)}\t${tsvEscape(parentId)}\n`;
      await writeOk(indexOut, indexRow);
      await writeOk(idsOut, `${tsvEscape(id)}\n`);
      const groupKey = parentId || id;
      await writeOk(
        groupedOut,
        `${tsvEscape(groupKey)}\t${kind}\t${lastPhysicalOrdinal}\t${fileOffset}\t${encoded.length}\t${tsvEscape(id)}\n`,
      );
      fileOffset += Buffer.byteLength(record, "utf8");
      return null;
    };

    try {
      for await (const chunk of await chunksOf(source)) {
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
          const result = await ingestLine(line);
          if (result) {
            await endStreams();
            return result;
          }
        }
        if (utf8Bytes(leftover) > maxLineBytes) {
          await endStreams();
          return fail("TRUNCATED", "JSONL leftover exceeded max line bytes", {
            objectCount,
            rootCount,
            lastPhysicalOrdinal,
          });
        }
      }
      leftover += decoder.decode();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/invalid|malformed|unexpected|utf/i.test(message)) {
        await endStreams();
        return fail("MALFORMED", `JSONL UTF-8 decode failed: ${message}`, {
          objectCount,
          rootCount,
          lastPhysicalOrdinal,
        });
      }
      if (error instanceof OrderFactsJsonlError) {
        await endStreams();
        return fail("OPEN_PARENT_BOUND", error.message, {
          objectCount,
          rootCount,
          lastPhysicalOrdinal,
        });
      }
      throw error;
    }

    if (leftover.trim() !== "") {
      await endStreams();
      return fail("TRUNCATED", "JSONL stream ended with a partial line", {
        objectCount,
        rootCount,
        lastPhysicalOrdinal,
      });
    }

    await endStreams();

    const objectToken = validateUnsignedCountToken(options?.expectedObjectCount);
    const rootToken = validateUnsignedCountToken(options?.expectedRootObjectCount);
    if (!objectToken.ok || !rootToken.ok) {
      return fail(
        "TRUNCATED",
        "Bulk objectCount/rootObjectCount must both match ^[0-9]+$",
        { objectCount, rootCount, lastPhysicalOrdinal },
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
        { objectCount, rootCount, lastPhysicalOrdinal },
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
        { objectCount, rootCount, lastPhysicalOrdinal },
      );
    }

    await sortLines(idsPath, ORDER_FACTS_JSONL_ID_SORT_CHUNK);
    const duplicate = await assertUniqueSortedIds(idsPath);
    if (duplicate) {
      return {
        ...duplicate,
        objectCount,
        rootCount,
        lastPhysicalOrdinal,
      };
    }
    await sortLines(groupedPath, ORDER_FACTS_JSONL_ID_SORT_CHUNK);

    const groupedText = await readFile(groupedPath, "utf8");
    if (groupedText !== "") {
      const groupedLines = groupedText.endsWith("\n")
        ? groupedText.slice(0, -1).split("\n")
        : groupedText.split("\n");
      let i = 0;
      while (i < groupedLines.length) {
        const firstCols = groupedLines[i].split("\t");
        const groupKey = firstCols[0] ?? "";
        let hasRoot = false;
        let liveBytes = 0;
        let j = i;
        while (j < groupedLines.length) {
          const cols = groupedLines[j].split("\t");
          if (cols[0] !== groupKey) break;
          if (cols[1] === "R") hasRoot = true;
          liveBytes += Number.parseInt(cols[4] ?? "0", 10);
          j += 1;
        }
        if (!hasRoot) {
          return fail(
            "MIS_PARENTED",
            `JSONL children referenced missing parent ${groupKey}`,
            { objectCount, rootCount, lastPhysicalOrdinal },
          );
        }
        if (liveBytes > maxLiveBytes) {
          return fail(
            "OPEN_PARENT_BOUND",
            `live JSONL assembly bytes exceeded ${maxLiveBytes}`,
            { objectCount, rootCount, lastPhysicalOrdinal },
          );
        }
        i = j;
      }
    }

    keepScratch = true;
    return {
      status: "COMPLETE",
      dir,
      jsonlPath,
      indexPath,
      groupedPath,
      objectCount,
      rootCount,
      lastPhysicalOrdinal,
      owned: true,
    };
  } catch (error) {
    throw error;
  } finally {
    await endStreams().catch(() => undefined);
    if (dir && !keepScratch) {
      await disposeOwnedScratch(dir, options?.scratchRoot).catch(() => undefined);
    }
  }
}

export async function readJsonlObjectAt(
  jsonlPath: string,
  offset: number,
  length: number,
): Promise<JsonlObject> {
  const handle = await open(jsonlPath, "r");
  try {
    const buf = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buf, 0, length, offset);
    if (bytesRead !== length) {
      throw new OrderFactsJsonlError(
        "jsonl_short_read",
        `expected ${length} bytes at ${offset}, read ${bytesRead}`,
      );
    }
    const parsed: unknown = JSON.parse(buf.toString("utf8"));
    if (!isRecord(parsed)) {
      throw new OrderFactsJsonlError(
        "jsonl_materialize_malformed",
        "materialized JSONL row is not an object",
      );
    }
    return parsed;
  } finally {
    await handle.close();
  }
}

export async function* iterateGroupedIndex(
  groupedPath: string,
): AsyncGenerator<{ groupKey: string; rows: JsonlIndexRow[] }> {
  const stream = createReadStream(groupedPath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let currentKey: string | null = null;
  let rows: JsonlIndexRow[] = [];
  try {
    for await (const leftover of rl) {
      if (leftover === "") continue;
      const cols = leftover.split("\t");
      const groupKey = cols[0] ?? "";
      const kind = cols[1] === "C" ? "C" : "R";
      const ordinal = Number.parseInt(cols[2] ?? "", 10);
      const offset = Number.parseInt(cols[3] ?? "", 10);
      const length = Number.parseInt(cols[4] ?? "", 10);
      const id = cols[5] ?? "";
      const row: JsonlIndexRow = {
        ordinal,
        offset,
        length,
        kind,
        id,
        parentId: kind === "C" ? groupKey : "",
      };
      if (currentKey != null && groupKey !== currentKey) {
        yield { groupKey: currentKey, rows };
        rows = [];
      }
      currentKey = groupKey;
      rows.push(row);
    }
    if (currentKey != null && rows.length > 0) {
      yield { groupKey: currentKey, rows };
    }
  } finally {
    rl.close();
    stream.destroy();
  }
}
