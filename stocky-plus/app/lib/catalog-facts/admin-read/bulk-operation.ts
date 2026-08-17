/**
 * BulkOperation GID contract and bulkOperation(id:) polling (R-134).
 *
 * This lane does not start bulk operations, does not download JSONL, and does
 * not treat partialDataUrl as canonical success.
 */

import { CATALOG_FACT_BULK_OPERATION_QUERY } from "./documents";
import { optionalString, stringifyUnsignedCount } from "./decimal";
import { executeAdminReadQuery } from "./execute";
import type {
  BulkOperationGid,
  BulkOperationReadClassification,
  BulkOperationSnapshot,
  CatalogAdminReadClient,
} from "./types";

const BULK_OPERATION_GID_PREFIX = "gid://shopify/BulkOperation/";

export class BulkOperationGidError extends Error {
  readonly code = "BULK_OPERATION_GID_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "BulkOperationGidError";
  }
}

export function isBulkOperationGid(value: string): value is BulkOperationGid {
  return (
    value.startsWith(BULK_OPERATION_GID_PREFIX) &&
    value.length > BULK_OPERATION_GID_PREFIX.length
  );
}

export function parseBulkOperationGid(value: string): BulkOperationGid {
  if (!isBulkOperationGid(value)) {
    throw new BulkOperationGidError(
      `Expected BulkOperation GID (${BULK_OPERATION_GID_PREFIX}…), received ${value}`,
    );
  }
  return value;
}

export type BulkOperationGidContract = {
  gid: BulkOperationGid;
};

export function persistBulkOperationGid(
  value: string,
): BulkOperationGidContract {
  return { gid: parseBulkOperationGid(value) };
}

export function consumeBulkOperationGid(
  contract: BulkOperationGidContract,
): BulkOperationGid {
  return parseBulkOperationGid(contract.gid);
}

export function classifyBulkOperationSnapshot(
  snapshot: BulkOperationSnapshot,
): BulkOperationReadClassification {
  const canonicalSuccessEligible =
    snapshot.status === "COMPLETED" &&
    snapshot.url != null &&
    snapshot.url !== "" &&
    snapshot.partialDataUrl == null;
  return {
    snapshot,
    canonicalSuccessEligible,
    partialDataUrlIsNotCanonicalSuccess: true,
  };
}

export async function readBulkOperationById(
  admin: CatalogAdminReadClient,
  gid: string,
): Promise<BulkOperationReadClassification | null> {
  const contract = persistBulkOperationGid(gid);
  const result = await executeAdminReadQuery<{
    bulkOperation?: {
      id?: unknown;
      status?: unknown;
      errorCode?: unknown;
      objectCount?: unknown;
      rootObjectCount?: unknown;
      url?: unknown;
      partialDataUrl?: unknown;
      createdAt?: unknown;
      completedAt?: unknown;
    } | null;
  }>(admin, CATALOG_FACT_BULK_OPERATION_QUERY, {
    id: consumeBulkOperationGid(contract),
  });

  const node = result.data?.bulkOperation;
  if (!node) return null;

  const snapshot: BulkOperationSnapshot = {
    id: parseBulkOperationGid(String(node.id)),
    status: String(node.status ?? ""),
    errorCode: optionalString(node.errorCode),
    objectCount: stringifyUnsignedCount(node.objectCount),
    rootObjectCount: stringifyUnsignedCount(node.rootObjectCount),
    url: optionalString(node.url),
    partialDataUrl: optionalString(node.partialDataUrl),
    createdAt: optionalString(node.createdAt),
    completedAt: optionalString(node.completedAt),
  };
  return classifyBulkOperationSnapshot(snapshot);
}
