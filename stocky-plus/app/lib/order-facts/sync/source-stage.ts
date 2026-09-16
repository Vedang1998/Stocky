/**
 * D-owned validated-source staging. Scratch files are worker-local, per-shop,
 * disposable, and not source authority. Parent closure is indexed membership
 * after validated EOF — not quantity, next-root, or groupObjects:false order.
 *
 * Blank/whitespace-only physical lines are framing only: they do not occupy a
 * checkpoint ordinal. `lastPhysicalOrdinal` counts JSON objects in stream order.
 */
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
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
  ORDER_FACTS_D_API_VERSION,
  ORDER_FACTS_JSONL_ID_SORT_CHUNK,
  ORDER_FACTS_JSONL_MAX_LINE_BYTES,
  ORDER_FACTS_JSONL_MAX_LIVE_BYTES,
  ORDER_FACTS_JSONL_MAX_SCRATCH_BYTES,
  ORDER_FACTS_SCRATCH_MARKER,
  ORDER_FACTS_SCRATCH_PREFIX,
  ORDER_FACTS_SOURCE_MANIFEST_VERSION,
  ORDER_GID_PREFIX,
} from "./constants";
import { OrderFactsJsonlError } from "./errors";
import {
  hashFileSha256,
  verifyValidatedSourceManifest,
  writeValidatedSourceManifest,
  type SourceEpochBinding,
  type ValidatedSourceManifest,
} from "./source-digest";
import { assertUniqueSortedFile, externalSortLines } from "./source-sort";
import type { JsonlAssemblyResult, JsonlByteSource, JsonlObject } from "./types";

export type { SourceEpochBinding, ValidatedSourceManifest };

export type JsonlIndexKind = "R" | "C";

export type JsonlIndexRow = {
  ordinal: number;
  offset: number;
  length: number;
  kind: JsonlIndexKind;
  id: string;
  parentId: string;
};

export type EmitSlice = {
  minOrdinal: number;
  offset: number;
  length: number;
};

export type ValidatedSourceStage = {
  status: "COMPLETE";
  dir: string;
  jsonlPath: string;
  indexPath: string;
  idsPath: string;
  groupedPath: string;
  emitPath: string;
  manifestPath: string;
  objectCount: number;
  rootCount: number;
  lastPhysicalOrdinal: number;
  owned: true;
  manifest: ValidatedSourceManifest;
};

export type StageFail = Extract<
  JsonlAssemblyResult,
  { status: Exclude<JsonlAssemblyResult["status"], "COMPLETE"> }
>;

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
  epoch?: SourceEpochBinding;
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

function isEnospc(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ENOSPC",
  );
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

function markerPath(dir: string): string {
  return path.join(dir, ORDER_FACTS_SCRATCH_MARKER);
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

async function assertOwnedScratch(dir: string): Promise<void> {
  await assertOwnedDirectory(dir);
  try {
    const marker = await readFile(markerPath(dir), "utf8");
    const parsed: unknown = JSON.parse(marker);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      (parsed as { owned?: unknown }).owned !== true ||
      (parsed as { prefix?: unknown }).prefix !== ORDER_FACTS_SCRATCH_PREFIX
    ) {
      throw new OrderFactsJsonlError(
        "scratch_unowned",
        `refusing scratch without D ownership marker ${dir}`,
      );
    }
  } catch (error) {
    if (error instanceof OrderFactsJsonlError) throw error;
    throw new OrderFactsJsonlError(
      "scratch_unowned",
      `refusing scratch without D ownership marker ${dir}`,
    );
  }
}

async function isAbandonedDScratch(dir: string): Promise<boolean> {
  try {
    await assertOwnedScratch(dir);
    return true;
  } catch {
    /* fall through to artifact-only leftovers */
  }
  try {
    await assertOwnedDirectory(dir);
  } catch {
    return false;
  }
  const entries = await readdir(dir);
  if (entries.length === 0) return true;
  return entries.every((name) => {
    if (name === ORDER_FACTS_SCRATCH_MARKER) return true;
    if (name === "source.jsonl" || name === "index.tsv" || name === "ids.tsv") {
      return true;
    }
    if (name === "grouped.tsv" || name === "emit.tsv" || name === "manifest.json") {
      return true;
    }
    if (name === "ack.bits") return true;
    if (name.startsWith("sort-") && name.endsWith(".part")) return true;
    if (name.endsWith(".sorted")) return true;
    return false;
  });
}

async function writeOwnershipMarker(
  dir: string,
  input: { shopId?: string; syncRunId?: string },
): Promise<void> {
  await writeFile(
    markerPath(dir),
    `${JSON.stringify({
      owned: true,
      prefix: ORDER_FACTS_SCRATCH_PREFIX,
      shopId: input.shopId ?? null,
      syncRunId: input.syncRunId ?? null,
      pid: process.pid,
      createdAt: new Date().toISOString(),
    })}\n`,
    { mode: 0o600 },
  );
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
  await writeOwnershipMarker(root, { shopId: "root", syncRunId: "prefix" });
  const shopDir = path.join(root, shop);
  await mkdir(shopDir, { recursive: true, mode: 0o700 });
  await assertOwnedDirectory(shopDir);
  await writeOwnershipMarker(shopDir, { shopId: input.shopId, syncRunId: "shop" });
  const dir = path.join(shopDir, run);
  try {
    const existing = await lstat(dir);
    if (existing.isSymbolicLink()) {
      throw new OrderFactsJsonlError(
        "scratch_symlink_refused",
        `refusing to use symlink scratch ${dir}`,
      );
    }
    if (existing.isDirectory()) {
      if (!(await isAbandonedDScratch(dir))) {
        throw new OrderFactsJsonlError(
          "scratch_unowned",
          `refusing pre-existing unowned scratch ${dir}`,
        );
      }
      await rm(dir, { recursive: true, force: false });
    }
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
  await writeOwnershipMarker(dir, input);
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
  const prefix = scratchRoot ?? path.join(os.tmpdir(), ORDER_FACTS_SCRATCH_PREFIX);
  const resolvedPrefix = await realpath(prefix).catch(() => prefix);
  const resolved = await realpath(dir).catch(() => path.resolve(dir));
  if (!resolved.startsWith(resolvedPrefix + path.sep) && resolved !== resolvedPrefix) {
    throw new OrderFactsJsonlError(
      "scratch_unowned",
      "refusing to delete scratch outside the D prefix",
    );
  }
  try {
    await assertOwnedScratch(dir);
  } catch {
    return;
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

export async function writeStreamChunk(
  stream: NodeJS.WritableStream,
  chunk: string | Buffer,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error | null) => {
      if (settled) return;
      settled = true;
      stream.off("drain", onDrain);
      stream.off("error", onError);
      if (error) reject(error);
      else resolve();
    };
    const onDrain = () => finish();
    const onError = (error: Error) => finish(error);
    stream.once("error", onError);
    try {
      const ok = stream.write(chunk);
      if (ok) finish();
      else stream.once("drain", onDrain);
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

function parseGroupedLine(line: string): JsonlIndexRow {
  const cols = line.split("\t");
  const groupKey = cols[0] ?? "";
  const kind: JsonlIndexKind = cols[1] === "C" ? "C" : "R";
  return {
    ordinal: Number.parseInt(cols[2] ?? "", 10),
    offset: Number.parseInt(cols[3] ?? "", 10),
    length: Number.parseInt(cols[4] ?? "", 10),
    kind,
    id: cols[5] ?? "",
    parentId: kind === "C" ? groupKey : "",
  };
}

async function* iterateFileLines(
  filePath: string,
): AsyncGenerator<{ line: string; offset: number; length: number }> {
  const stream = createReadStream(filePath);
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  let leftover = "";
  let offset = 0;
  try {
    for await (const chunk of stream) {
      leftover +=
        typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
      let newline = leftover.indexOf("\n");
      while (newline >= 0) {
        const rawLine = leftover.slice(0, newline);
        leftover = leftover.slice(newline + 1);
        const consumed = newline + 1;
        const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
        if (line !== "") {
          yield { line, offset, length: consumed };
        }
        offset += consumed;
        newline = leftover.indexOf("\n");
      }
    }
    leftover += decoder.decode();
    if (leftover !== "") {
      yield { line: leftover, offset, length: utf8Bytes(leftover) };
    }
  } finally {
    stream.destroy();
  }
}

async function validateGroupedAndWriteEmit(input: {
  groupedPath: string;
  emitPath: string;
  maxLiveBytes: number;
  objectCount: number;
  rootCount: number;
  lastPhysicalOrdinal: number;
}): Promise<StageFail | null> {
  const emitOut = createWriteStream(input.emitPath, { mode: 0o600 });
  try {
    let currentKey: string | null = null;
    let hasRoot = false;
    let liveBytes = 0;
    let minOrdinal = Number.POSITIVE_INFINITY;
    let groupStart = 0;
    let groupEnd = 0;

    const flush = async (): Promise<StageFail | null> => {
      if (currentKey == null) return null;
      if (!hasRoot) {
        return fail(
          "MIS_PARENTED",
          `JSONL children referenced missing parent ${currentKey}`,
          {
            objectCount: input.objectCount,
            rootCount: input.rootCount,
            lastPhysicalOrdinal: input.lastPhysicalOrdinal,
          },
        );
      }
      if (liveBytes > input.maxLiveBytes) {
        return fail(
          "OPEN_PARENT_BOUND",
          `live JSONL assembly bytes exceeded ${input.maxLiveBytes}`,
          {
            objectCount: input.objectCount,
            rootCount: input.rootCount,
            lastPhysicalOrdinal: input.lastPhysicalOrdinal,
          },
        );
      }
      const padded = String(minOrdinal).padStart(20, "0");
      await writeStreamChunk(
        emitOut,
        `${padded}\t${groupStart}\t${groupEnd - groupStart}\n`,
      );
      return null;
    };

    for await (const row of iterateFileLines(input.groupedPath)) {
      const cols = row.line.split("\t");
      const groupKey = cols[0] ?? "";
      const kind = cols[1] === "C" ? "C" : "R";
      const ordinal = Number.parseInt(cols[2] ?? "", 10);
      const length = Number.parseInt(cols[4] ?? "", 10);
      if (currentKey != null && groupKey !== currentKey) {
        const flushed = await flush();
        if (flushed) return flushed;
        hasRoot = false;
        liveBytes = 0;
        minOrdinal = Number.POSITIVE_INFINITY;
        groupStart = row.offset;
      }
      if (currentKey == null) groupStart = row.offset;
      currentKey = groupKey;
      if (kind === "R") hasRoot = true;
      liveBytes += Number.isFinite(length) ? length : 0;
      if (Number.isFinite(ordinal)) {
        minOrdinal = Math.min(minOrdinal, ordinal);
      }
      groupEnd = row.offset + row.length;
    }
    const flushed = await flush();
    if (flushed) return flushed;
  } finally {
    await new Promise<void>((resolve) => {
      if (emitOut.destroyed) {
        resolve();
        return;
      }
      emitOut.end(() => resolve());
      emitOut.once("error", () => resolve());
    });
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
    const emitPath = path.join(dir, "emit.tsv");
    const jsonlOut = createWriteStream(jsonlPath, { mode: 0o600 });
    const indexOut = createWriteStream(indexPath, { mode: 0o600 });
    const idsOut = createWriteStream(idsPath, { mode: 0o600 });
    const groupedOut = createWriteStream(groupedPath, { mode: 0o600 });
    streams.push(jsonlOut, indexOut, idsOut, groupedOut);
    let writeError: Error | null = null;
    for (const stream of streams) {
      stream.on("error", (error: Error) => {
        writeError = error;
      });
    }
    const sourceHash = createHash("sha256");
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
      sourceHash.update(record);
      await writeStreamChunk(jsonlOut, record);
      if (writeError) throw writeError;
      const indexRow = `${lastPhysicalOrdinal}\t${fileOffset}\t${encoded.length}\t${kind}\t${tsvEscape(id)}\t${tsvEscape(parentId)}\n`;
      await writeStreamChunk(indexOut, indexRow);
      await writeStreamChunk(idsOut, `${tsvEscape(id)}\n`);
      const groupKey = parentId || id;
      await writeStreamChunk(
        groupedOut,
        `${tsvEscape(groupKey)}\t${kind}\t${lastPhysicalOrdinal}\t${fileOffset}\t${encoded.length}\t${tsvEscape(id)}\n`,
      );
      if (writeError) throw writeError;
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
      if (isEnospc(error)) {
        await endStreams();
        return fail("OPEN_PARENT_BOUND", "scratch disk full", {
          objectCount,
          rootCount,
          lastPhysicalOrdinal,
        });
      }
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

    await externalSortLines(idsPath, ORDER_FACTS_JSONL_ID_SORT_CHUNK);
    const duplicateId = await assertUniqueSortedFile(idsPath);
    if (duplicateId) {
      return fail("DUPLICATE", `duplicate JSONL id ${duplicateId}`, {
        objectCount,
        rootCount,
        lastPhysicalOrdinal,
      });
    }
    await externalSortLines(groupedPath, ORDER_FACTS_JSONL_ID_SORT_CHUNK);
    const groupedFail = await validateGroupedAndWriteEmit({
      groupedPath,
      emitPath,
      maxLiveBytes,
      objectCount,
      rootCount,
      lastPhysicalOrdinal,
    });
    if (groupedFail) return groupedFail;
    await externalSortLines(emitPath, ORDER_FACTS_JSONL_ID_SORT_CHUNK);

    const epoch = options?.epoch;
    const manifest: ValidatedSourceManifest = {
      version: ORDER_FACTS_SOURCE_MANIFEST_VERSION,
      shopId: epoch?.shopId ?? options?.shopId ?? "local",
      syncRunId: epoch?.syncRunId ?? options?.syncRunId ?? path.basename(dir),
      bulkOperationGid: epoch?.bulkOperationGid ?? null,
      queryFingerprint: epoch?.queryFingerprint ?? null,
      apiVersion: epoch?.apiVersion ?? ORDER_FACTS_D_API_VERSION,
      fenceGeneration: epoch?.fenceGeneration ?? null,
      objectCount,
      rootCount,
      lastPhysicalOrdinal,
      digests: {
        sourceJsonl: sourceHash.digest("hex"),
        indexTsv: await hashFileSha256(indexPath),
        idsTsv: await hashFileSha256(idsPath),
        groupedTsv: await hashFileSha256(groupedPath),
        emitTsv: await hashFileSha256(emitPath),
      },
    };
    const observedSource = await hashFileSha256(jsonlPath);
    if (observedSource !== manifest.digests.sourceJsonl) {
      return fail("MALFORMED", "scratch source.jsonl digest mismatch", {
        objectCount,
        rootCount,
        lastPhysicalOrdinal,
      });
    }
    const manifestPath = await writeValidatedSourceManifest(dir, manifest);
    await verifyValidatedSourceManifest({
      dir,
      jsonlPath,
      indexPath,
      idsPath,
      groupedPath,
      emitPath,
      manifestPath,
      epoch,
    });

    keepScratch = true;
    return {
      status: "COMPLETE",
      dir,
      jsonlPath,
      indexPath,
      idsPath,
      groupedPath,
      emitPath,
      manifestPath,
      objectCount,
      rootCount,
      lastPhysicalOrdinal,
      owned: true,
      manifest,
    };
  } catch (error) {
    if (isEnospc(error)) {
      return fail("OPEN_PARENT_BOUND", "scratch disk full");
    }
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

export async function readGroupedSlice(
  groupedPath: string,
  offset: number,
  length: number,
): Promise<JsonlIndexRow[]> {
  if (length === 0) return [];
  const handle = await open(groupedPath, "r");
  try {
    const buf = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buf, 0, length, offset);
    if (bytesRead !== length) {
      throw new OrderFactsJsonlError(
        "jsonl_short_read",
        `expected ${length} grouped bytes at ${offset}, read ${bytesRead}`,
      );
    }
    const text = buf.toString("utf8");
    const lines = text.endsWith("\n") ? text.slice(0, -1).split("\n") : text.split("\n");
    return lines.filter((line) => line !== "").map(parseGroupedLine);
  } finally {
    await handle.close();
  }
}

export async function* iterateEmitOrder(
  emitPath: string,
): AsyncGenerator<EmitSlice> {
  for await (const row of iterateFileLines(emitPath)) {
    const cols = row.line.split("\t");
    yield {
      minOrdinal: Number.parseInt(cols[0] ?? "", 10),
      offset: Number.parseInt(cols[1] ?? "", 10),
      length: Number.parseInt(cols[2] ?? "", 10),
    };
  }
}

export async function* iterateGroupedIndex(
  groupedPath: string,
): AsyncGenerator<{ groupKey: string; rows: JsonlIndexRow[] }> {
  let currentKey: string | null = null;
  let rows: JsonlIndexRow[] = [];
  for await (const leftover of iterateFileLines(groupedPath)) {
    const parsed = parseGroupedLine(leftover.line);
    const groupKey = parsed.parentId || parsed.id;
    if (currentKey != null && groupKey !== currentKey) {
      yield { groupKey: currentKey, rows };
      rows = [];
    }
    currentKey = groupKey;
    rows.push(parsed);
  }
  if (currentKey != null && rows.length > 0) {
    yield { groupKey: currentKey, rows };
  }
}
