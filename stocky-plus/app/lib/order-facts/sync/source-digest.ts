/**
 * Content digests for D scratch integrity. Local artifacts are not source
 * authority; a digest mismatch forces revalidation, not skip-by-ordinal.
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ORDER_FACTS_D_API_VERSION, ORDER_FACTS_SOURCE_MANIFEST_VERSION } from "./constants";
import { OrderFactsJsonlError } from "./errors";

export type SourceEpochBinding = {
  shopId: string;
  syncRunId: string;
  bulkOperationGid: string | null;
  queryFingerprint: string;
  apiVersion: string;
  fenceGeneration: string | null;
};

export type SourceContentDigests = {
  sourceJsonl: string;
  indexTsv: string;
  idsTsv: string;
  groupedTsv: string;
  emitTsv: string;
};

export type ValidatedSourceManifest = {
  version: typeof ORDER_FACTS_SOURCE_MANIFEST_VERSION;
  shopId: string;
  syncRunId: string;
  bulkOperationGid: string | null;
  queryFingerprint: string | null;
  apiVersion: string;
  fenceGeneration: string | null;
  objectCount: number;
  rootCount: number;
  lastPhysicalOrdinal: number;
  digests: SourceContentDigests;
};

export async function hashFileSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);
  try {
    for await (const chunk of stream) {
      hash.update(chunk);
    }
  } finally {
    stream.destroy();
  }
  return hash.digest("hex");
}

export function emptyHasher(): ReturnType<typeof createHash> {
  return createHash("sha256");
}

export async function writeValidatedSourceManifest(
  dir: string,
  manifest: ValidatedSourceManifest,
): Promise<string> {
  const manifestPath = path.join(dir, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`, {
    mode: 0o600,
  });
  return manifestPath;
}

export async function readValidatedSourceManifest(
  manifestPath: string,
): Promise<ValidatedSourceManifest> {
  const raw = await readFile(manifestPath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new OrderFactsJsonlError(
      "jsonl_manifest_malformed",
      "scratch manifest is not an object",
    );
  }
  return parsed as ValidatedSourceManifest;
}

export async function verifyValidatedSourceManifest(input: {
  dir: string;
  jsonlPath: string;
  indexPath: string;
  idsPath: string;
  groupedPath: string;
  emitPath: string;
  manifestPath: string;
  epoch?: SourceEpochBinding;
}): Promise<ValidatedSourceManifest> {
  const manifest = await readValidatedSourceManifest(input.manifestPath);
  if (manifest.version !== ORDER_FACTS_SOURCE_MANIFEST_VERSION) {
    throw new OrderFactsJsonlError(
      "jsonl_manifest_version",
      `scratch manifest version ${manifest.version} is not ${ORDER_FACTS_SOURCE_MANIFEST_VERSION}`,
    );
  }
  const observed: SourceContentDigests = {
    sourceJsonl: await hashFileSha256(input.jsonlPath),
    indexTsv: await hashFileSha256(input.indexPath),
    idsTsv: await hashFileSha256(input.idsPath),
    groupedTsv: await hashFileSha256(input.groupedPath),
    emitTsv: await hashFileSha256(input.emitPath),
  };
  const expected = manifest.digests;
  for (const key of Object.keys(observed) as (keyof SourceContentDigests)[]) {
    if (observed[key] !== expected[key]) {
      throw new OrderFactsJsonlError(
        "jsonl_source_digest_mismatch",
        `scratch ${key} digest mismatch`,
      );
    }
  }
  if (input.epoch) {
    if (manifest.shopId !== input.epoch.shopId) {
      throw new OrderFactsJsonlError(
        "jsonl_epoch_mismatch",
        "scratch manifest shopId does not match the import epoch",
      );
    }
    if (manifest.syncRunId !== input.epoch.syncRunId) {
      throw new OrderFactsJsonlError(
        "jsonl_epoch_mismatch",
        "scratch manifest syncRunId does not match the import epoch",
      );
    }
    if (manifest.queryFingerprint !== input.epoch.queryFingerprint) {
      throw new OrderFactsJsonlError(
        "jsonl_epoch_mismatch",
        "scratch manifest query fingerprint does not match the import epoch",
      );
    }
    if (manifest.apiVersion !== input.epoch.apiVersion) {
      throw new OrderFactsJsonlError(
        "jsonl_epoch_mismatch",
        "scratch manifest API version does not match the import epoch",
      );
    }
    if (manifest.bulkOperationGid !== input.epoch.bulkOperationGid) {
      throw new OrderFactsJsonlError(
        "jsonl_epoch_mismatch",
        "scratch manifest BulkOperation GID does not match the import epoch",
      );
    }
    if (manifest.fenceGeneration !== input.epoch.fenceGeneration) {
      throw new OrderFactsJsonlError(
        "jsonl_epoch_mismatch",
        "scratch manifest fence does not match the import epoch",
      );
    }
  }
  if (manifest.apiVersion !== ORDER_FACTS_D_API_VERSION) {
    throw new OrderFactsJsonlError(
      "jsonl_epoch_mismatch",
      `scratch manifest API version ${manifest.apiVersion} is not ${ORDER_FACTS_D_API_VERSION}`,
    );
  }
  return manifest;
}
