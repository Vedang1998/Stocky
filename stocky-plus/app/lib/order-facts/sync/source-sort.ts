/**
 * Bounded external sort for D scratch indexes. Never loads a whole export as
 * a JavaScript string, root array, or ID Set. Chunk arrays are finite.
 */
import { createReadStream, createWriteStream } from "node:fs";
import readline from "node:readline";
import { rename, rm } from "node:fs/promises";
import path from "node:path";
import { ORDER_FACTS_JSONL_MAX_GROUP_MERGE_FILES } from "./constants";

async function writeSortedChunk(
  dir: string,
  index: number,
  lines: string[],
): Promise<string> {
  lines.sort();
  const partPath = path.join(dir, `sort-${index}.part`);
  const out = createWriteStream(partPath, { mode: 0o600 });
  await new Promise<void>((resolve, reject) => {
    out.on("error", reject);
    out.on("finish", resolve);
    for (const line of lines) {
      out.write(`${line}\n`);
    }
    out.end();
  });
  return partPath;
}

async function mergeSortedParts(
  parts: string[],
  destPath: string,
): Promise<void> {
  if (parts.length === 0) {
    const out = createWriteStream(destPath, { mode: 0o600 });
    await new Promise<void>((resolve, reject) => {
      out.on("error", reject);
      out.on("finish", resolve);
      out.end();
    });
    return;
  }
  if (parts.length === 1) {
    if (parts[0] !== destPath) {
      await rename(parts[0], destPath);
    }
    return;
  }
  const streams = parts.map((part) =>
    createReadStream(part, { encoding: "utf8" }),
  );
  const readers = streams.map((stream) =>
    readline.createInterface({ input: stream, crlfDelay: Infinity }),
  );
  const iterators = readers.map((reader) => reader[Symbol.asyncIterator]());
  const heads: Array<string | null> = await Promise.all(
    iterators.map(async (iterator) => {
      const next = await iterator.next();
      return next.done ? null : next.value;
    }),
  );
  const out = createWriteStream(destPath, { mode: 0o600 });
  try {
    await new Promise<void>((resolve, reject) => {
      out.on("error", reject);
      const writeNext = async () => {
        try {
          for (;;) {
            let best: string | null = null;
            let bestI = -1;
            for (let i = 0; i < heads.length; i += 1) {
              const row = heads[i];
              if (row == null) continue;
              if (best == null || row < best) {
                best = row;
                bestI = i;
              }
            }
            if (best == null || bestI < 0) {
              out.end(() => resolve());
              return;
            }
            const ok = out.write(`${best}\n`);
            const advanced = await iterators[bestI].next();
            heads[bestI] = advanced.done ? null : advanced.value;
            if (!ok) {
              out.once("drain", () => {
                void writeNext();
              });
              return;
            }
          }
        } catch (error) {
          reject(error);
        }
      };
      void writeNext();
    });
  } finally {
    for (const reader of readers) reader.close();
    for (const stream of streams) stream.destroy();
  }
  await Promise.all(parts.map((part) => rm(part, { force: true })));
}

/**
 * Sort `filePath` in place using bounded chunk files and a streaming k-way merge.
 */
export async function externalSortLines(
  filePath: string,
  chunkSize: number,
): Promise<void> {
  const dir = path.dirname(filePath);
  const parts: string[] = [];
  const stream = createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let chunk: string[] = [];
  try {
    for await (const line of rl) {
      if (line === "") continue;
      chunk.push(line);
      if (chunk.length >= chunkSize) {
        if (parts.length >= ORDER_FACTS_JSONL_MAX_GROUP_MERGE_FILES) {
          const merged = path.join(dir, `sort-merged-${parts.length}.part`);
          await mergeSortedParts(parts.splice(0, parts.length), merged);
          parts.push(merged);
        }
        parts.push(await writeSortedChunk(dir, parts.length, chunk));
        chunk = [];
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }
  if (chunk.length > 0) {
    parts.push(await writeSortedChunk(dir, parts.length, chunk));
    chunk = [];
  }
  const dest = `${filePath}.sorted`;
  while (parts.length > ORDER_FACTS_JSONL_MAX_GROUP_MERGE_FILES) {
    const batch = parts.splice(0, ORDER_FACTS_JSONL_MAX_GROUP_MERGE_FILES);
    const merged = path.join(dir, `sort-pass-${parts.length}.part`);
    await mergeSortedParts(batch, merged);
    parts.unshift(merged);
  }
  await mergeSortedParts(parts, dest);
  await rename(dest, filePath);
}

export async function assertUniqueSortedFile(
  filePath: string,
): Promise<string | null> {
  const stream = createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let previous: string | null = null;
  try {
    for await (const line of rl) {
      if (line === "") continue;
      if (previous != null && line === previous) {
        return line;
      }
      previous = line;
    }
  } finally {
    rl.close();
    stream.destroy();
  }
  return null;
}
