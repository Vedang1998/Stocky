import type { CatalogAdminReadClient } from "../../catalog-facts/admin-read";
import type { OrderAdminReadClient, TrustedShopIdentity } from "../admin-read";
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
import { validateUnsignedCountToken } from "../../catalog-facts/ingest/counts";
import {
  applyBulkAssembledOrder,
  applyNominatedOrderGid,
  nominatedReceipt,
} from "./apply-nominated";
import { submitOrderFactsBulkA } from "./bulk";
import { ORDER_FACTS_D_BULK_A_ORDERS_LINES } from "./bulk-a-query";
import {
  ORDER_FACTS_BULK_POLL_INTERVAL_MS,
  ORDER_FACTS_BULK_POLL_MAX_ATTEMPTS,
  ORDER_FACTS_BULK_POLL_WALL_CLOCK_MAX_MS,
  ORDER_FACTS_JSONL_MAX_PENDING_ORDINALS,
  ORDER_FACTS_SYNC_DOMAIN,
  ORDER_FACTS_SYNC_JOB_TYPE,
} from "./constants";
import {
  assertShopProcessingEnabled,
  createOrderFactsSyncRun,
  incrementOrderFactsPollExaminedCount,
  persistOrderFactsCoverageHealth,
  recordOrderFactsDataIssue,
} from "./control-plane";
import { OrderFactsSyncError } from "./errors";
import {
  streamOrderFactsJsonl,
  type JsonlByteSource,
  type JsonlCompleteAssembly,
} from "./jsonl";
import {
  bulkRootCurrencyCode,
  bulkRootUpdatedAt,
  mapBulkAAssemblyToOrderSnapshot,
} from "./mapper-bulk";
import { readGrantedAccessScopes } from "./refetch";
import {
  mergeLedgerCounts,
  readOrderFactsImportLedger,
} from "./supplemental-ledger";
import type { LedgerQueryCounts } from "./types";
import type { OrderFactsTxnHost } from "./apply-composition";

export type OrderFactsImportStepResult =
  | {
      status: "SUCCEEDED";
      applied: number;
      examined: number;
      followUpReads: number;
      bulkDirectApplies: number;
      ledgerCounts: LedgerQueryCounts;
    }
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

async function consumePollBudget(input: {
  shopId: string;
  syncRunId: string;
  examinedCount: number;
  startedAt: Date;
  bulkSubmitIntentAt: Date | null;
}): Promise<"ok" | "exhausted"> {
  const elapsed =
    Date.now() -
    (input.bulkSubmitIntentAt ?? input.startedAt).getTime();
  if (
    input.examinedCount >= ORDER_FACTS_BULK_POLL_MAX_ATTEMPTS ||
    elapsed >= ORDER_FACTS_BULK_POLL_WALL_CLOCK_MAX_MS
  ) {
    return "exhausted";
  }
  await incrementOrderFactsPollExaminedCount({
    shopId: input.shopId,
    syncRunId: input.syncRunId,
  });
  return "ok";
}

async function failImport(input: {
  shopId: string;
  syncRunId: string;
  errorCode: string;
  reason: string;
  examined?: number;
  incomplete?: number;
  truncated?: boolean;
}): Promise<OrderFactsImportStepResult> {
  await markSyncRunPartialFailure({
    shopId: input.shopId,
    syncRunId: input.syncRunId,
    errorCode: input.errorCode.slice(0, 64),
    failureSummary: input.reason.slice(0, 512),
  });
  await recordOrderFactsDataIssue({
    shopId: input.shopId,
    reasonCode: input.errorCode.slice(0, 64),
    redactedEvidence: { reason: input.reason.slice(0, 200) },
  });
  await persistOrderFactsCoverageHealth({
    shopId: input.shopId,
    coverage: {
      mode: "incremental",
      examinedGids: input.examined ?? 0,
      appliedGids: 0,
      incompleteGids: input.incomplete ?? 1,
      outOfWindowGids: 0,
      behindWatermarkExamined: 0,
      watermarkPersisted: false,
      cursorValue: null,
    },
    evidence: {
      unresolvedCoverageCount: 1,
      openDiagnosticIssueCount: 1,
      incompletePaginationCount: input.truncated ? 1 : 0,
      quarantineOpenCount: 0,
    },
  });
  return { status: "PARTIAL_FAILURE", reason: input.reason };
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
  expectedObjectCount?: string | null;
  expectedRootObjectCount?: string | null;
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
    query: ORDER_FACTS_D_BULK_A_ORDERS_LINES,
    shopId: input.shopId,
  });
  if (
    syncRun.bulkQueryFingerprint &&
    syncRun.bulkQueryFingerprint !== fingerprint
  ) {
    return failImport({
      shopId: input.shopId,
      syncRunId: syncRun.id,
      errorCode: "ORDER_FACTS_BULK_FINGERPRINT_MISMATCH",
      reason: "old_bulk_a_checkpoint_not_transferable",
    });
  }
  const fence =
    syncRun.fenceGeneration != null
      ? { fenceGeneration: syncRun.fenceGeneration }
      : await persistBulkSubmitIntentAndFence({
          shopId: input.shopId,
          syncRunId: syncRun.id,
          bulkQueryFingerprint: fingerprint,
        });

  let bulkOperationGid = syncRun.bulkOperationGid;
  let expectedObjectCount = input.expectedObjectCount ?? syncRun.bulkObjectCount;
  let expectedRootObjectCount =
    input.expectedRootObjectCount ?? syncRun.bulkRootObjectCount;

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
    const budget = await consumePollBudget({
      shopId: input.shopId,
      syncRunId: syncRun.id,
      examinedCount: syncRun.examinedCount,
      startedAt: syncRun.startedAt ?? syncRun.createdAt,
      bulkSubmitIntentAt: syncRun.bulkSubmitIntentAt,
    });
    if (budget === "exhausted") {
      return failImport({
        shopId: input.shopId,
        syncRunId: syncRun.id,
        errorCode: "ORDER_FACTS_BULK_POLL_EXHAUSTED",
        reason: "bulk_poll_budget_exhausted",
      });
    }
    const polled = await readBulkOperationById(
      input.admin as CatalogAdminReadClient,
      bulkOperationGid,
    );
    if (!polled) {
      return failImport({
        shopId: input.shopId,
        syncRunId: syncRun.id,
        errorCode: "order_facts_bulk_poll_missing",
        reason: "bulk_operation_missing",
      });
    }
    assertPolledBulkOperationMatches(bulkOperationGid, polled.snapshot.id);
    if (polled.snapshot.status === "COMPLETED") {
      if (polled.snapshot.partialDataUrl) {
        return failImport({
          shopId: input.shopId,
          syncRunId: syncRun.id,
          errorCode: "ORDER_FACTS_BULK_PARTIAL_URL",
          reason: "partial_data_url_not_canonical",
        });
      }
      expectedObjectCount = polled.snapshot.objectCount;
      expectedRootObjectCount = polled.snapshot.rootObjectCount;
      await persistBulkCounts({
        shopId: input.shopId,
        syncRunId: syncRun.id,
        bulkOperationGid,
        objectCount: polled.snapshot.objectCount,
        rootObjectCount: polled.snapshot.rootObjectCount,
      });
      if (!polled.snapshot.url) {
        const objectToken = validateUnsignedCountToken(expectedObjectCount);
        const rootToken = validateUnsignedCountToken(expectedRootObjectCount);
        if (
          objectToken.ok &&
          rootToken.ok &&
          objectToken.token === "0" &&
          rootToken.token === "0"
        ) {
          input = { ...input, jsonlSource: (async function* () {})() };
        } else {
          return failImport({
            shopId: input.shopId,
            syncRunId: syncRun.id,
            errorCode: "ORDER_FACTS_JSONL_EMPTY_NONEMPTY",
            reason: "empty_download_of_nonempty_export",
          });
        }
      } else {
        input = {
          ...input,
          jsonlSource: await (input.fetchJsonl ?? defaultFetchJsonl)(
            polled.snapshot.url,
          ),
        };
      }
    } else if (
      polled.snapshot.status === "FAILED" ||
      polled.snapshot.status === "CANCELED" ||
      polled.snapshot.status === "EXPIRED"
    ) {
      return failImport({
        shopId: input.shopId,
        syncRunId: syncRun.id,
        errorCode: "ORDER_FACTS_BULK_FAILED",
        reason: polled.snapshot.status,
      });
    } else {
      return {
        status: "CONTINUE",
        backoffMs: ORDER_FACTS_BULK_POLL_INTERVAL_MS,
        reason: `bulk_status_${polled.snapshot.status}`,
      };
    }
  }

  if (input.jsonlSource == null) {
    return failImport({
      shopId: input.shopId,
      syncRunId: syncRun.id,
      errorCode: "ORDER_FACTS_JSONL_MISSING",
      reason: "jsonl_source_missing",
    });
  }

  const skipThroughOrdinal =
    syncRun.bulkQueryFingerprint === fingerprint
      ? (syncRun.jsonlCommittedLineOrdinal ?? 0)
      : 0;
  let contiguousCommitted = skipThroughOrdinal;
  const pendingCommitted = new Set<number>();
  let applied = 0;
  let incomplete = 0;
  let examined = 0;
  let followUpReads = 0;
  let bulkDirectApplies = 0;
  const ledgerCounts: LedgerQueryCounts = {
    initial: 0,
    recheck: 0,
    agreement: 0,
    sale: 0,
    refund: 0,
    fallback: 0,
    throttle: 0,
  };
  const observedAt = new Date();
  const scopes = await readGrantedAccessScopes({
    admin: input.admin,
    shop: input.shop,
  });

  const noteCommitted = async (ordinals: number[]) => {
    for (const ordinal of ordinals) {
      if (ordinal > contiguousCommitted) pendingCommitted.add(ordinal);
    }
    if (pendingCommitted.size > ORDER_FACTS_JSONL_MAX_PENDING_ORDINALS) {
      throw new OrderFactsSyncError(
        "order_facts_checkpoint_pending_bound",
        `pending checkpoint ordinals exceeded ${ORDER_FACTS_JSONL_MAX_PENDING_ORDINALS}`,
      );
    }
    while (pendingCommitted.has(contiguousCommitted + 1)) {
      contiguousCommitted += 1;
      pendingCommitted.delete(contiguousCommitted);
    }
    if (bulkOperationGid && contiguousCommitted > skipThroughOrdinal) {
      await acknowledgeJsonlBatch({
        shopId: input.shopId,
        syncRunId: syncRun.id,
        bulkOperationGid,
        endLineOrdinal: contiguousCommitted,
      });
    }
  };

  const applyAssembly = async (assembly: JsonlCompleteAssembly) => {
    examined += 1;
    if (assembly.lineOrdinals.every((ordinal) => ordinal <= skipThroughOrdinal)) {
      await noteCommitted(assembly.lineOrdinals);
      return;
    }
    const receipt = nominatedReceipt({
      durableJobId: input.durableJobId,
      shopifyGid: assembly.rootGid,
      sourceJobType: ORDER_FACTS_SYNC_JOB_TYPE,
      fenceGeneration: fence.fenceGeneration,
    });
    const ledger = await readOrderFactsImportLedger({
      context: { admin: input.admin, shop: input.shop },
      orderGid: assembly.rootGid,
      bulkUpdatedAt: bulkRootUpdatedAt(assembly.root),
      bulkCurrencyCode: bulkRootCurrencyCode(assembly.root),
    });
    mergeLedgerCounts(ledgerCounts, ledger.counts);
    if (ledger.status === "drift") {
      followUpReads += 1;
      ledgerCounts.fallback += 1;
      const result = await applyNominatedOrderGid({
        db: input.db,
        admin: input.admin,
        shop: input.shop,
        shopId: input.shopId,
        shopifyGid: assembly.rootGid,
        sourceKind: "FULL_SYNC",
        observedAt,
        receipt,
        durableJobId: input.durableJobId,
        correlationId: input.correlationId,
        requestedCanonicalIdentitiesPerTransaction:
          input.requestedCanonicalIdentitiesPerTransaction,
        configuredWorstCaseConcurrentCanonicalTransactions:
          input.configuredWorstCaseConcurrentCanonicalTransactions,
      });
      if (result.status === "applied" || result.status === "already_applied") {
        applied += 1;
        await noteCommitted(assembly.lineOrdinals);
        return;
      }
      if (result.status === "first_confirmation_pending") {
        incomplete += 1;
        return;
      }
      incomplete += 1;
      return;
    }
    if (ledger.status !== "complete") {
      incomplete += 1;
      return;
    }
    const snapshot = mapBulkAAssemblyToOrderSnapshot(
      assembly.root,
      assembly.children,
    );
    snapshot.agreements = ledger.agreements;
    snapshot.agreementsComplete = true;
    const result = await applyBulkAssembledOrder({
      db: input.db,
      shopId: input.shopId,
      snapshot,
      fenceGeneration: fence.fenceGeneration,
      epochId: syncRun.id,
      observedAt,
      accessScopeSnapshot: scopes,
      receipt,
      nestedRefunds: ledger.refunds,
      requestedCanonicalIdentitiesPerTransaction:
        input.requestedCanonicalIdentitiesPerTransaction,
      configuredWorstCaseConcurrentCanonicalTransactions:
        input.configuredWorstCaseConcurrentCanonicalTransactions,
    });
    bulkDirectApplies += 1;
    if (result.status === "applied" || result.status === "already_applied") {
      applied += 1;
      await noteCommitted(assembly.lineOrdinals);
      return;
    }
    if (result.status === "first_confirmation_pending") {
      incomplete += 1;
      return;
    }
    incomplete += 1;
  };

  let assembled;
  try {
    assembled = await streamOrderFactsJsonl(input.jsonlSource, {
      expectedObjectCount: expectedObjectCount ?? undefined,
      expectedRootObjectCount: expectedRootObjectCount ?? undefined,
      shopId: input.shopId,
      syncRunId: syncRun.id,
      onCompleteAssembly: applyAssembly,
    });
  } catch (error) {
    return failImport({
      shopId: input.shopId,
      syncRunId: syncRun.id,
      errorCode:
        error instanceof OrderFactsSyncError
          ? error.code
          : "ORDER_FACTS_IMPORT_APPLY",
      reason: error instanceof Error ? error.message : String(error),
      examined,
      incomplete: Math.max(incomplete, 1),
    });
  }

  if (assembled.status !== "COMPLETE") {
    return failImport({
      shopId: input.shopId,
      syncRunId: syncRun.id,
      errorCode: `JSONL_${assembled.status}`,
      reason: assembled.reason,
      examined,
      incomplete: Math.max(incomplete, assembled.rootCount),
      truncated: assembled.status === "TRUNCATED",
    });
  }

  if (incomplete > 0) {
    return failImport({
      shopId: input.shopId,
      syncRunId: syncRun.id,
      errorCode: "ORDER_FACTS_IMPORT_PARTIAL",
      reason: "import_incomplete",
      examined,
      incomplete,
    });
  }

  if (bulkOperationGid) {
    await persistBulkCounts({
      shopId: input.shopId,
      syncRunId: syncRun.id,
      bulkOperationGid,
      objectCount: String(assembled.objectCount),
      rootObjectCount: String(assembled.rootCount),
      streamedObjectCount: String(assembled.objectCount),
      streamedRootObjectCount: String(assembled.rootCount),
    });
  }

  await completeSyncRunAndCursor({
    shopId: input.shopId,
    syncRunId: syncRun.id,
    syncDomain: ORDER_FACTS_SYNC_DOMAIN,
    examinedCount: examined,
    appliedCount: applied,
    skippedCount: 0,
  });
  await persistOrderFactsCoverageHealth({
    shopId: input.shopId,
    coverage: {
      mode: "incremental",
      examinedGids: examined,
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
  return {
    status: "SUCCEEDED",
    applied,
    examined,
    followUpReads,
    bulkDirectApplies,
    ledgerCounts,
  };
}
