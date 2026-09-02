/**
 * BulkOperation GID contract and bulkOperation(id:) polling (R-134).
 *
 * This lane does not start bulk operations, does not download JSONL, and does
 * not treat partialDataUrl as canonical success.
 */

import { CATALOG_FACT_BULK_OPERATION_QUERY } from "./documents";
import { optionalIsoTimestamp, optionalString, requireString, stringifyUnsignedCount } from "./decimal";
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

  if (node.id == null) {
    throw new BulkOperationGidError(
      "bulkOperation returned identity is missing",
    );
  }
  if (typeof node.id !== "string") {
    throw new BulkOperationGidError(
      `bulkOperation returned identity type:${typeof node.id} does not match requested ${contract.gid}`,
    );
  }
  const returnedGid = parseBulkOperationGid(node.id);
  if (returnedGid !== contract.gid) {
    throw new BulkOperationGidError(
      `bulkOperation returned identity ${returnedGid} does not match requested ${contract.gid}`,
    );
  }

  const snapshot: BulkOperationSnapshot = {
    id: returnedGid,
    status: requireString(node.status, "bulkOperation.status"),
    errorCode: optionalString(node.errorCode),
    objectCount: stringifyUnsignedCount(node.objectCount),
    rootObjectCount: stringifyUnsignedCount(node.rootObjectCount),
    url: optionalString(node.url),
    partialDataUrl: optionalString(node.partialDataUrl),
    createdAt: optionalIsoTimestamp(node.createdAt, "bulkOperation.createdAt"),
    completedAt: optionalIsoTimestamp(
      node.completedAt,
      "bulkOperation.completedAt",
    ),
  };
  return classifyBulkOperationSnapshot(snapshot);
}
