/**
 * D import-only receipt binding. Canonicalizes JSON representation for hashing
 * without altering Shopify business facts (signs, missing fields, decimals,
 * identities). Physical ordinals and scratch paths are not part of the digest.
 */
import { createHash } from "node:crypto";
import {
  ORDER_FACTS_D_API_VERSION,
  ORDER_FACTS_IMPORT_RECEIPT_BINDING_VERSION,
  ORDER_FACTS_SYNC_JOB_TYPE,
} from "./constants";
import type { JsonlObject } from "./types";
import type { OrderApplyReceiptInput } from "../apply/types";

export type ImportSourceBinding = {
  durableJobId: string;
  shopifyGid: string;
  sourceJobType?: string;
  fenceGeneration?: bigint | null;
  shopId: string;
  queryFingerprint: string;
  apiVersion?: string;
  parent: JsonlObject;
  children: JsonlObject[];
};

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

export function nominatedImportReceipt(
  input: ImportSourceBinding,
): OrderApplyReceiptInput {
  const sourceJobType = input.sourceJobType ?? ORDER_FACTS_SYNC_JOB_TYPE;
  const contentDigest = importParentContentDigest({
    parent: input.parent,
    children: input.children,
  });
  const payloadDigest = createHash("sha256")
    .update(ORDER_FACTS_IMPORT_RECEIPT_BINDING_VERSION)
    .update("\n")
    .update(input.shopId)
    .update("\n")
    .update(sourceJobType)
    .update("\n")
    .update(input.durableJobId)
    .update("\n")
    .update(input.shopifyGid)
    .update("\n")
    .update(input.queryFingerprint)
    .update("\n")
    .update(input.apiVersion ?? ORDER_FACTS_D_API_VERSION)
    .update("\n")
    .update(contentDigest)
    .digest("hex");
  return {
    applicationKey: importReceiptApplicationKey({
      durableJobId: input.durableJobId,
      shopifyGid: input.shopifyGid,
      sourceJobType,
      fenceGeneration: input.fenceGeneration,
    }),
    sourceJobType,
    rootDurableJobId: input.durableJobId,
    applyingDurableJobId: input.durableJobId,
    payloadDigest,
  };
}
