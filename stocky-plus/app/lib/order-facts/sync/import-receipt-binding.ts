/**
 * D import-only receipt binding. Canonicalizes JSON representation for hashing
 * without altering Shopify business facts (signs, missing fields, decimals,
 * identities). Physical ordinals and scratch paths are not part of the digest.
 *
 * The logical application key is stable across epoch changes so a changed
 * fence/run/Bulk identity under the same logical attempt conflicts instead of
 * selecting a silent new key. Epoch fields belong in the payload digest.
 */
import { createHash } from "node:crypto";
import {
  BULK_OPERATION_GID_PREFIX,
  ORDER_FACTS_D_API_VERSION,
  ORDER_FACTS_IMPORT_RECEIPT_BINDING_VERSION,
  ORDER_FACTS_IMPORT_RECEIPT_DIGEST_VERSION,
  ORDER_FACTS_SYNC_JOB_TYPE,
} from "./constants";
import { OrderFactsSyncError } from "./errors";
import type { JsonlObject } from "./types";
import type { OrderApplyReceiptInput } from "../apply/types";

export type ImportSourceBinding = {
  durableJobId: string;
  shopifyGid: string;
  sourceJobType?: string;
  fenceGeneration?: bigint | null;
  shopId: string;
  syncRunId: string;
  bulkOperationGid: string;
  queryFingerprint: string;
  apiVersion?: string;
  parent: JsonlObject;
  children: JsonlObject[];
};

function requireNonEmpty(name: string, value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new OrderFactsSyncError(
      "import_epoch_fields_required",
      `import receipt epoch field ${name} is required`,
    );
  }
  return value;
}

function requireFenceGeneration(value: bigint | null | undefined): string {
  if (typeof value !== "bigint") {
    throw new OrderFactsSyncError(
      "import_epoch_fields_required",
      "import receipt epoch field fenceGeneration is required",
    );
  }
  return value.toString();
}

function requireBulkOperationGid(value: unknown): string {
  const gid = requireNonEmpty("bulkOperationGid", value);
  if (!gid.startsWith(BULK_OPERATION_GID_PREFIX)) {
    throw new OrderFactsSyncError(
      "import_epoch_fields_required",
      "import receipt BulkOperation GID is invalid",
    );
  }
  return gid;
}

function sortJsonValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortJsonValue);
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    const next = record[key];
    if (next === undefined) continue;
    out[key] = sortJsonValue(next);
  }
  return out;
}

export function canonicalizeImportJson(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

export function importParentContentDigest(input: {
  parent: JsonlObject;
  children: JsonlObject[];
}): string {
  const children = [...input.children].sort((left, right) => {
    const leftId = typeof left.id === "string" ? left.id : "";
    const rightId = typeof right.id === "string" ? right.id : "";
    return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
  });
  return createHash("sha256")
    .update(canonicalizeImportJson(input.parent))
    .update("\n")
    .update(canonicalizeImportJson(children))
    .digest("hex");
}

export function importReceiptApplicationKey(input: {
  durableJobId: string;
  shopifyGid: string;
  sourceJobType?: string;
  fenceGeneration?: bigint | null;
}): string {
  const jobType = input.sourceJobType ?? ORDER_FACTS_SYNC_JOB_TYPE;
  void input.fenceGeneration;
  return `${ORDER_FACTS_IMPORT_RECEIPT_BINDING_VERSION}:${jobType}:${input.durableJobId}:${input.shopifyGid}`;
}

export function legacyImportReceiptApplicationKey(input: {
  durableJobId: string;
  shopifyGid: string;
  sourceJobType?: string;
}): string {
  const jobType = input.sourceJobType ?? ORDER_FACTS_SYNC_JOB_TYPE;
  return `${jobType}:${input.durableJobId}:${input.shopifyGid}`;
}

export function v1ImportReceiptPayloadDigest(input: {
  shopId: string;
  sourceJobType: string;
  durableJobId: string;
  shopifyGid: string;
  queryFingerprint: string;
  apiVersion: string;
  contentDigest: string;
}): string {
  return createHash("sha256")
    .update(ORDER_FACTS_IMPORT_RECEIPT_BINDING_VERSION)
    .update("\n")
    .update(input.shopId)
    .update("\n")
    .update(input.sourceJobType)
    .update("\n")
    .update(input.durableJobId)
    .update("\n")
    .update(input.shopifyGid)
    .update("\n")
    .update(input.queryFingerprint)
    .update("\n")
    .update(input.apiVersion)
    .update("\n")
    .update(input.contentDigest)
    .digest("hex");
}

export function nominatedImportReceipt(
  input: ImportSourceBinding,
): OrderApplyReceiptInput {
  const sourceJobType = input.sourceJobType ?? ORDER_FACTS_SYNC_JOB_TYPE;
  const shopId = requireNonEmpty("shopId", input.shopId);
  const syncRunId = requireNonEmpty("syncRunId", input.syncRunId);
  const bulkOperationGid = requireBulkOperationGid(input.bulkOperationGid);
  const queryFingerprint = requireNonEmpty(
    "queryFingerprint",
    input.queryFingerprint,
  );
  const durableJobId = requireNonEmpty("durableJobId", input.durableJobId);
  const shopifyGid = requireNonEmpty("shopifyGid", input.shopifyGid);
  const apiVersion = input.apiVersion ?? ORDER_FACTS_D_API_VERSION;
  const fenceGeneration = requireFenceGeneration(input.fenceGeneration);
  const contentDigest = importParentContentDigest({
    parent: input.parent,
    children: input.children,
  });
  const payloadDigest = createHash("sha256")
    .update(ORDER_FACTS_IMPORT_RECEIPT_DIGEST_VERSION)
    .update("\n")
    .update(shopId)
    .update("\n")
    .update(sourceJobType)
    .update("\n")
    .update(durableJobId)
    .update("\n")
    .update(shopifyGid)
    .update("\n")
    .update(syncRunId)
    .update("\n")
    .update(bulkOperationGid)
    .update("\n")
    .update(queryFingerprint)
    .update("\n")
    .update(apiVersion)
    .update("\n")
    .update(fenceGeneration)
    .update("\n")
    .update(contentDigest)
    .digest("hex");
  return {
    applicationKey: importReceiptApplicationKey({
      durableJobId,
      shopifyGid,
      sourceJobType,
      fenceGeneration: input.fenceGeneration,
    }),
    sourceJobType,
    rootDurableJobId: durableJobId,
    applyingDurableJobId: durableJobId,
    payloadDigest,
  };
}

export function importReceiptMatchesV1Digest(input: {
  storedDigest: string;
  shopId: string;
  sourceJobType: string;
  durableJobId: string;
  shopifyGid: string;
  queryFingerprint: string;
  apiVersion: string;
  parent: JsonlObject;
  children: JsonlObject[];
}): boolean {
  const contentDigest = importParentContentDigest({
    parent: input.parent,
    children: input.children,
  });
  return (
    input.storedDigest ===
    v1ImportReceiptPayloadDigest({
      shopId: input.shopId,
      sourceJobType: input.sourceJobType,
      durableJobId: input.durableJobId,
      shopifyGid: input.shopifyGid,
      queryFingerprint: input.queryFingerprint,
      apiVersion: input.apiVersion,
      contentDigest,
    })
  );
}
