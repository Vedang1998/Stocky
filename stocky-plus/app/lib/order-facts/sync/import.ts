import type { CatalogAdminReadClient } from "../../catalog-facts/admin-read";
import type { OrderAdminReadClient, TrustedShopIdentity } from "../admin-read";
import { ORDER_FACTS_BULK_A_ORDERS_LINES } from "../admin-read";
import { readBulkOperationById } from "../../catalog-facts/admin-read";
import { fingerprintBulkQuery } from "../../catalog-facts/ingest/bulk-operation-recovery";
import {
  acknowledgeJsonlBatch,
  assertPolledBulkOperationMatches,
  attachBulkOperationGid,
  completeSyncRunAndCursor,
  markSyncRunPartialFailure,
  persistBulkCounts,
  persistBulkSubmitIntentAndFence,
} from "../../catalog-facts/ingest/checkpoint";
import {
  applyNominatedOrderGid,
  nominatedReceipt,
} from "./apply-nominated";
import { submitOrderFactsBulkA } from "./bulk";
import {
  ORDER_FACTS_BULK_POLL_INTERVAL_MS,
  ORDER_FACTS_BULK_POLL_MAX_ATTEMPTS,
  ORDER_FACTS_SYNC_DOMAIN,
  ORDER_FACTS_SYNC_JOB_TYPE,
} from "./constants";
import {
  assertShopProcessingEnabled,
  createOrderFactsSyncRun,
  persistOrderFactsCoverageHealth,
  recordOrderFactsDataIssue,
} from "./control-plane";
import { OrderFactsSyncError } from "./errors";
import {
  assembleOrderFactsJsonl,
  nominatedOrderGids,
  type JsonlByteSource,
} from "./jsonl";
import type { OrderFactsTxnHost } from "./apply-composition";

export type OrderFactsImportStepResult =
  | { status: "SUCCEEDED"; applied: number; examined: number }
  | { status: "CONTINUE"; backoffMs: number; reason: string }
  | { status: "PARTIAL_FAILURE"; reason: string };

async function defaultFetchJsonl(url: string): Promise<JsonlByteSource> {
  const response = await fetch(url);
  if (!response.ok || response.body == null) {
    throw new OrderFactsSyncError(
      "order_facts_jsonl_download_failed",
      `JSONL download failed with HTTP ${response.status}`,
    );
  }
  return response.body;
}

export async function runOrderFactsImportStep(input: {
  db: OrderFactsTxnHost;
  admin: OrderAdminReadClient;
  shop: TrustedShopIdentity;
  shopId: string;
  durableJobId: string;
  correlationId: string;
  jsonlSource?: JsonlByteSource;
  pollBulkOperation?: boolean;
  fetchJsonl?: (url: string) => Promise<JsonlByteSource>;
  requestedCanonicalIdentitiesPerTransaction?: number;
  configuredWorstCaseConcurrentCanonicalTransactions?: number;
}): Promise<OrderFactsImportStepResult> {
  await assertShopProcessingEnabled(input.shopId);
  const syncRun = await createOrderFactsSyncRun({
    shopId: input.shopId,
    source: ORDER_FACTS_SYNC_JOB_TYPE,
    correlationId: input.correlationId,
  });
  const fingerprint = fingerprintBulkQuery({
    query: ORDER_FACTS_BULK_A_ORDERS_LINES,
    shopId: input.shopId,
  });
  const fence =
    syncRun.fenceGeneration != null
      ? { fenceGeneration: syncRun.fenceGeneration }
      : await persistBulkSubmitIntentAndFence({
          shopId: input.shopId,
          syncRunId: syncRun.id,
          bulkQueryFingerprint: fingerprint,
        });

  let bulkOperationGid = syncRun.bulkOperationGid;
  if (input.pollBulkOperation !== false && input.jsonlSource == null) {
    if (!bulkOperationGid) {
      const submitted = await submitOrderFactsBulkA(
        input.admin as CatalogAdminReadClient,
        {
          shopId: input.shopId,
          fenceGeneration: fence.fenceGeneration,
        },
      );
      bulkOperationGid = submitted.id;
      await attachBulkOperationGid({
        shopId: input.shopId,
        syncRunId: syncRun.id,
        bulkOperationGid,
      });
    }
    let url: string | null = null;
    for (let attempt = 0; attempt < ORDER_FACTS_BULK_POLL_MAX_ATTEMPTS; attempt += 1) {
      const polled = await readBulkOperationById(
        input.admin as CatalogAdminReadClient,
        bulkOperationGid,
      );
      if (!polled) {
        await recordOrderFactsDataIssue({
          shopId: input.shopId,
          reasonCode: "order_facts_bulk_poll_missing",
          redactedEvidence: { bulkOperationGid },
        });
        return {
          status: "PARTIAL_FAILURE",
          reason: "bulk_operation_missing",
        };
      }
      assertPolledBulkOperationMatches(bulkOperationGid, polled.snapshot.id);
      if (polled.snapshot.status === "COMPLETED" && polled.snapshot.url) {
        if (polled.snapshot.partialDataUrl) {
          await markSyncRunPartialFailure({
            shopId: input.shopId,
            syncRunId: syncRun.id,
            errorCode: "ORDER_FACTS_BULK_PARTIAL_URL",
            failureSummary: "partialDataUrl is not canonical success",
          });
          return {
            status: "PARTIAL_FAILURE",
            reason: "partial_data_url_not_canonical",
          };
        }
        url = polled.snapshot.url;
        await persistBulkCounts({
          shopId: input.shopId,
          syncRunId: syncRun.id,
          bulkOperationGid,
          objectCount: polled.snapshot.objectCount,
          rootObjectCount: polled.snapshot.rootObjectCount,
        });
        break;
      }
      if (
        polled.snapshot.status === "FAILED" ||
        polled.snapshot.status === "CANCELED" ||
        polled.snapshot.status === "EXPIRED"
      ) {
        await markSyncRunPartialFailure({
          shopId: input.shopId,
          syncRunId: syncRun.id,
          errorCode: "ORDER_FACTS_BULK_FAILED",
          failureSummary: `Bulk A ${polled.snapshot.status}`,
        });
        return { status: "PARTIAL_FAILURE", reason: polled.snapshot.status };
      }
      if (attempt === 0) {
        return {
          status: "CONTINUE",
          backoffMs: ORDER_FACTS_BULK_POLL_INTERVAL_MS,
          reason: `bulk_status_${polled.snapshot.status}`,
        };
      }
    }
    if (!url && input.jsonlSource == null) {
      return {
        status: "CONTINUE",
        backoffMs: ORDER_FACTS_BULK_POLL_INTERVAL_MS,
        reason: "bulk_poll_in_progress",
      };
    }
    if (url && input.jsonlSource == null) {
      input = {
        ...input,
        jsonlSource: await (input.fetchJsonl ?? defaultFetchJsonl)(url),
      };
    }
  }

  if (input.jsonlSource == null) {
    return {
      status: "PARTIAL_FAILURE",
      reason: "jsonl_source_missing",
    };
  }

  const assembled = await assembleOrderFactsJsonl(input.jsonlSource);
  if (assembled.status !== "COMPLETE") {
    await markSyncRunPartialFailure({
      shopId: input.shopId,
      syncRunId: syncRun.id,
      errorCode: `JSONL_${assembled.status}`.slice(0, 64),
      failureSummary: assembled.reason.slice(0, 512),
    });
    await persistOrderFactsCoverageHealth({
      shopId: input.shopId,
      coverage: {
        mode: "incremental",
        examinedGids: assembled.rootCount,
        appliedGids: 0,
        incompleteGids: assembled.rootCount,
        outOfWindowGids: 0,
        behindWatermarkExamined: 0,
        watermarkPersisted: false,
        cursorValue: null,
      },
      evidence: {
        unresolvedCoverageCount: 1,
        openDiagnosticIssueCount: 1,
        incompletePaginationCount: assembled.status === "TRUNCATED" ? 1 : 0,
        quarantineOpenCount: 0,
      },
    });
    return { status: "PARTIAL_FAILURE", reason: assembled.reason };
  }

  const gids = nominatedOrderGids(assembled);
  let applied = 0;
  let incomplete = 0;
  const observedAt = new Date();
  for (let index = 0; index < gids.length; index += 1) {
    const gid = gids[index]!;
    const result = await applyNominatedOrderGid({
      db: input.db,
      admin: input.admin,
      shop: input.shop,
      shopId: input.shopId,
      shopifyGid: gid,
      sourceKind: "FULL_SYNC",
      observedAt,
      receipt: nominatedReceipt({
        durableJobId: input.durableJobId,
        shopifyGid: gid,
        sourceJobType: ORDER_FACTS_SYNC_JOB_TYPE,
        fenceGeneration: fence.fenceGeneration,
      }),
      durableJobId: input.durableJobId,
      correlationId: input.correlationId,
      requestedCanonicalIdentitiesPerTransaction:
        input.requestedCanonicalIdentitiesPerTransaction,
      configuredWorstCaseConcurrentCanonicalTransactions:
        input.configuredWorstCaseConcurrentCanonicalTransactions,
    });
    if (result.status === "applied" || result.status === "already_applied") {
      applied += 1;
      if (bulkOperationGid) {
        await acknowledgeJsonlBatch({
          shopId: input.shopId,
          syncRunId: syncRun.id,
          bulkOperationGid,
          endLineOrdinal: index + 1,
        });
      }
    } else {
      incomplete += 1;
    }
  }

  if (incomplete > 0) {
    await markSyncRunPartialFailure({
      shopId: input.shopId,
      syncRunId: syncRun.id,
      errorCode: "ORDER_FACTS_IMPORT_PARTIAL",
      failureSummary: "Partial bulk import is not complete coverage",
      streamedObjectCount: String(assembled.objectCount),
      streamedRootObjectCount: String(assembled.rootCount),
    });
    await persistOrderFactsCoverageHealth({
      shopId: input.shopId,
      coverage: {
        mode: "incremental",
        examinedGids: gids.length,
        appliedGids: applied,
        incompleteGids: incomplete,
        outOfWindowGids: 0,
        behindWatermarkExamined: 0,
        watermarkPersisted: false,
        cursorValue: null,
      },
      evidence: {
        unresolvedCoverageCount: incomplete,
        openDiagnosticIssueCount: 1,
        incompletePaginationCount: 0,
        quarantineOpenCount: 0,
      },
    });
    return { status: "PARTIAL_FAILURE", reason: "import_incomplete" };
  }

  await completeSyncRunAndCursor({
    shopId: input.shopId,
    syncRunId: syncRun.id,
    syncDomain: ORDER_FACTS_SYNC_DOMAIN,
    examinedCount: gids.length,
    appliedCount: applied,
    skippedCount: 0,
  });
  await persistOrderFactsCoverageHealth({
    shopId: input.shopId,
    coverage: {
      mode: "incremental",
      examinedGids: gids.length,
      appliedGids: applied,
      incompleteGids: 0,
      outOfWindowGids: 0,
      behindWatermarkExamined: 0,
      watermarkPersisted: true,
      cursorValue: syncRun.id,
    },
    evidence: {
      unresolvedCoverageCount: 0,
      openDiagnosticIssueCount: 0,
      incompletePaginationCount: 0,
      quarantineOpenCount: 0,
    },
  });
  return { status: "SUCCEEDED", applied, examined: gids.length };
}
