import { createHash } from "node:crypto";
import {
  executeAdminReadQuery,
  parseBulkOperationGid,
  type CatalogAdminReadClient,
} from "../admin-read";

export const BULK_OPERATION_RECOVERY_QUERY = `#graphql
  query CatalogFactBulkOperationRecovery($first: Int!) {
    bulkOperations(first: $first) {
      nodes {
        id
        status
        query
        createdAt
      }
    }
  }
`;

export const UNIT_COST_PROBE_IDENTITY_QUERY = `#graphql
  query CatalogFactUnitCostProbeIdentity {
    inventoryItems(first: 1) {
      nodes {
        id
      }
    }
  }
`;

const ADOPTABLE_STATUSES = new Set([
  "CREATED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELED",
  "EXPIRED",
]);

export function fingerprintBulkQuery(input: {
  query: string;
  shopId: string;
}): string {
  return createHash("sha256")
    .update(`${input.query}\ngroupObjects:false\n${input.shopId}`)
    .digest("hex");
}

export type BulkOperationRecoveryResult =
  | { status: "ADOPTED"; bulkOperationGid: string }
  | { status: "WAIT"; reason: "no_unique_match" }
  | { status: "FAILED_CLOSED"; reason: "ambiguous_match" };

export async function recoverOrphanBulkOperation(
  admin: CatalogAdminReadClient,
  intent: {
    shopId: string;
    bulkSubmitIntentAt: Date;
    bulkQueryFingerprint: string;
  },
): Promise<BulkOperationRecoveryResult> {
  const response = await executeAdminReadQuery<{
    bulkOperations?: {
      nodes?: Array<{
        id?: unknown;
        status?: unknown;
        query?: unknown;
        createdAt?: unknown;
      } | null>;
    } | null;
  }>(admin, BULK_OPERATION_RECOVERY_QUERY, { first: 25 });

  const earliest = intent.bulkSubmitIntentAt.getTime() - 5_000;
  const latest = intent.bulkSubmitIntentAt.getTime() + 120_000;
  const matches = (response.data?.bulkOperations?.nodes ?? []).flatMap(
    (node) => {
      if (
        node == null ||
        typeof node.query !== "string" ||
        typeof node.status !== "string" ||
        typeof node.createdAt !== "string" ||
        !ADOPTABLE_STATUSES.has(node.status)
      ) {
        return [];
      }
      const createdAt = Date.parse(node.createdAt);
      if (
        !Number.isFinite(createdAt) ||
        createdAt < earliest ||
        createdAt > latest ||
        fingerprintBulkQuery({
          query: node.query,
          shopId: intent.shopId,
        }) !== intent.bulkQueryFingerprint
      ) {
        return [];
      }
      return [parseBulkOperationGid(node.id)];
    },
  );

  if (matches.length === 1) {
    return { status: "ADOPTED", bulkOperationGid: matches[0]! };
  }
  if (matches.length > 1) {
    return { status: "FAILED_CLOSED", reason: "ambiguous_match" };
  }
  return { status: "WAIT", reason: "no_unique_match" };
}

export async function readUnitCostProbeIdentity(
  admin: CatalogAdminReadClient,
): Promise<string | null> {
  const response = await executeAdminReadQuery<{
    inventoryItems?: {
      nodes?: Array<{ id?: unknown } | null>;
    } | null;
  }>(admin, UNIT_COST_PROBE_IDENTITY_QUERY);
  const id = response.data?.inventoryItems?.nodes?.[0]?.id;
  if (id == null) return null;
  if (
    typeof id !== "string" ||
    !id.startsWith("gid://shopify/InventoryItem/")
  ) {
    throw new Error("unit_cost_probe_identity_invalid");
  }
  return id;
}
