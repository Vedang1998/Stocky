import type { TenantAuthority } from "../../../tenant/authority.server";
import type { OrderAdminReadClient } from "../../../lib/order-facts/admin-read";
import type { OrderFactsTxnHost } from "../../../lib/order-facts/sync/apply-composition";
import { runOrderFactsImportStep } from "../../../lib/order-facts/sync/import";
import { runOrderFactsReconcileStep } from "../../../lib/order-facts/sync/reconcile";
import {
  ORDER_FACTS_RECONCILE_JOB_TYPE,
  ORDER_FACTS_SYNC_JOB_TYPE,
} from "../../../lib/order-facts/sync/constants";

export type OrderFactsJobStepResult =
  | { status: "SUCCEEDED" }
  | { status: "CONTINUE"; backoffMs: number; reason: string }
  | { status: "PARTIAL_FAILURE"; reason: string };

export async function runOrderFactsSyncJob(input: {
  authority: TenantAuthority;
  admin: OrderAdminReadClient;
  db: OrderFactsTxnHost;
  durableJobId: string;
  correlationId: string;
  payload?: Record<string, unknown>;
  jsonlSource?: AsyncIterable<string>;
  requestedCanonicalIdentitiesPerTransaction?: number;
  configuredWorstCaseConcurrentCanonicalTransactions?: number;
}): Promise<OrderFactsJobStepResult> {
  void ORDER_FACTS_SYNC_JOB_TYPE;
  const result = await runOrderFactsImportStep({
    db: input.db,
    admin: input.admin,
    shop: {
      id: input.authority.shopId,
      myshopifyDomain: input.authority.myshopifyDomain,
    },
    shopId: input.authority.shopId,
    durableJobId: input.durableJobId,
    correlationId: input.correlationId,
    jsonlSource: input.jsonlSource,
    pollBulkOperation:
      input.jsonlSource == null && input.payload?.pollBulkOperation !== false,
    expectedObjectCount:
      typeof input.payload?.expectedObjectCount === "string"
        ? input.payload.expectedObjectCount
        : undefined,
    expectedRootObjectCount:
      typeof input.payload?.expectedRootObjectCount === "string"
        ? input.payload.expectedRootObjectCount
        : undefined,
    requestedCanonicalIdentitiesPerTransaction:
      input.requestedCanonicalIdentitiesPerTransaction,
    configuredWorstCaseConcurrentCanonicalTransactions:
      input.configuredWorstCaseConcurrentCanonicalTransactions,
  });
  if (result.status === "SUCCEEDED") return { status: "SUCCEEDED" };
  if (result.status === "CONTINUE") {
    return {
      status: "CONTINUE",
      backoffMs: result.backoffMs,
      reason: result.reason,
    };
  }
  return { status: "PARTIAL_FAILURE", reason: result.reason };
}

export async function runOrderFactsReconcileJob(input: {
  authority: TenantAuthority;
  admin: OrderAdminReadClient;
  db: OrderFactsTxnHost;
  durableJobId: string;
  correlationId: string;
  payload?: Record<string, unknown>;
  requestedCanonicalIdentitiesPerTransaction?: number;
  configuredWorstCaseConcurrentCanonicalTransactions?: number;
}): Promise<OrderFactsJobStepResult> {
  void ORDER_FACTS_RECONCILE_JOB_TYPE;
  const reason = typeof input.payload?.reason === "string" ? input.payload.reason : null;
  const requestedMode =
    typeof input.payload?.mode === "string" ? input.payload.mode : null;
  const mode =
    reason === "quarantine_projection_bounds" ||
    requestedMode === "quarantine_recovery"
      ? "quarantine_recovery"
      : reason === "sample" || requestedMode === "sample"
        ? "sample"
        : requestedMode === "incremental"
          ? "incremental"
          : "window_sweep";
  const result = await runOrderFactsReconcileStep({
    db: input.db,
    admin: input.admin,
    shop: {
      id: input.authority.shopId,
      myshopifyDomain: input.authority.myshopifyDomain,
    },
    shopId: input.authority.shopId,
    durableJobId: input.durableJobId,
    correlationId: input.correlationId,
    mode,
    resolvingIssueId:
      typeof input.payload?.resolvingIssueId === "string"
        ? input.payload.resolvingIssueId
        : null,
    requestedCanonicalIdentitiesPerTransaction:
      input.requestedCanonicalIdentitiesPerTransaction,
    configuredWorstCaseConcurrentCanonicalTransactions:
      input.configuredWorstCaseConcurrentCanonicalTransactions,
  });
  if (result.status === "SUCCEEDED") return { status: "SUCCEEDED" };
  return { status: "PARTIAL_FAILURE", reason: result.reason };
}
