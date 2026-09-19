import type { CatalogAdminReadClient } from "../../catalog-facts/admin-read";
import type { OrderAdminReadClient, TrustedShopIdentity } from "../admin-read";
import { ORDER_ADMIN_READ_MAX_REQUESTS } from "../admin-read";
import { OrderPaginationError } from "../admin-read/errors";
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
} from "./apply-nominated";
import {
  lookupApplicationReceipt,
  probeReceiptBeforeShopifyIo,
} from "./apply-composition";
import {
  importReceiptMatchesV1Digest,
  legacyImportReceiptApplicationKey,
  nominatedImportReceipt,
} from "./import-receipt-binding";
import { APPLICATION_DIGEST_CONFLICT } from "../../../sync/execution-strategy.server";
import { SyncControlPlaneError } from "../../../sync/errors";
import { submitOrderFactsBulkA } from "./bulk";
import { ORDER_FACTS_D_BULK_A_ORDERS_LINES } from "./bulk-a-query";
import {
  ORDER_FACTS_BULK_POLL_INTERVAL_MS,
  ORDER_FACTS_BULK_POLL_MAX_ATTEMPTS,
  ORDER_FACTS_BULK_POLL_WALL_CLOCK_MAX_MS,
  BULK_OPERATION_GID_PREFIX,
  ORDER_FACTS_D_API_VERSION,
  ORDER_FACTS_SCRATCH_RESOURCE_REASON,
  ORDER_FACTS_SYNC_DOMAIN,
  ORDER_FACTS_SYNC_JOB_TYPE,
} from "./constants";
import { DiskOrdinalAck } from "./ordinal-ack";
import {
  defaultDScratchRoot,
  inspectDScratchOccupancy,
  sanitizeDScratchOccupancy,
} from "./source-stage";
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
import {
  createDTransportBudget,
  setDTransportPhase,
  wrapAdminWithDTransportBudget,
} from "./transport-budget";
import type { LedgerQueryCounts } from "./types";
import type { OrderFactsTxnHost } from "./apply-composition";

export type OrderFactsImportStepResult =
  | {
      status: "SUCCEEDED";
      applied: number;
      examined: number;
      followUpReads: number;
      bulkDirectApplies: number;
      verifiedReplayApplies: number;
      ledgerCounts: LedgerQueryCounts;
      runTransportAttempts: number;
      parentTransportAttempts: number;
      fallbackOrders: number;
      fallbackTransportAttempts: number;
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
  scratchRoot?: string;
}): Promise<OrderFactsImportStepResult> {
  const occupancy = sanitizeDScratchOccupancy(
    await inspectDScratchOccupancy({
      scratchRoot: input.scratchRoot ?? defaultDScratchRoot(),
    }),
  );
  const scratchFailure =
    input.errorCode === ORDER_FACTS_SCRATCH_RESOURCE_REASON ||
    input.errorCode === "JSONL_SCRATCH_RESOURCE" ||
    input.errorCode === "scratch_resource_exhausted" ||
    input.reason.includes(ORDER_FACTS_SCRATCH_RESOURCE_REASON);
  await markSyncRunPartialFailure({
    shopId: input.shopId,
    syncRunId: input.syncRunId,
    errorCode: input.errorCode.slice(0, 64),
    failureSummary: input.reason.slice(0, 512),
  });
  await recordOrderFactsDataIssue({
    shopId: input.shopId,
    reasonCode: (scratchFailure
      ? ORDER_FACTS_SCRATCH_RESOURCE_REASON
      : input.errorCode
    ).slice(0, 64),
    redactedEvidence: {
      reason: input.reason.slice(0, 200),
      leftoverAttemptCount: occupancy.leftoverAttemptCount,
      unknownAttemptCount: occupancy.unknownAttemptCount,
      observedBytes: occupancy.observedBytes,
      reservedBytes: occupancy.reservedBytes,
      oldestAgeMs: occupancy.oldestAgeMs,
      maxScratchAttempts: occupancy.maxScratchAttempts,
      maxScratchBytes: occupancy.maxScratchBytes,
      operatorInterventionRequired: occupancy.operatorInterventionRequired,
      ledgerIntegrity: occupancy.ledgerIntegrity,
      orphanMetadataPresent: occupancy.orphanMetadataPresent,
    },
  });
  await persistOrderFactsCoverageHealth({
    shopId: input.shopId,
    scratchRoot: input.scratchRoot,
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
  scratchRoot?: string;
  maxScratchBytes?: number;
  maxScratchAttempts?: number;
  reservedBytes?: number;
  parentTransportMaxRequests?: number;
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
      scratchRoot: input.scratchRoot,
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
  let runTransportAttempts = 0;
  const countRunAdmin: OrderAdminReadClient = {
    graphql: async (query, options) => {
      runTransportAttempts += 1;
      return input.admin.graphql(query, options);
    },
  };

  if (input.pollBulkOperation !== false && input.jsonlSource == null) {
    if (!bulkOperationGid) {
      const submitted = await submitOrderFactsBulkA(
        countRunAdmin as CatalogAdminReadClient,
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
        scratchRoot: input.scratchRoot,
        syncRunId: syncRun.id,
        errorCode: "ORDER_FACTS_BULK_POLL_EXHAUSTED",
        reason: "bulk_poll_budget_exhausted",
      });
    }
    const polled = await readBulkOperationById(
      countRunAdmin as CatalogAdminReadClient,
      bulkOperationGid,
    );
    if (!polled) {
      return failImport({
        shopId: input.shopId,
        scratchRoot: input.scratchRoot,
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
          scratchRoot: input.scratchRoot,
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
            scratchRoot: input.scratchRoot,
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
        scratchRoot: input.scratchRoot,
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
      scratchRoot: input.scratchRoot,
      syncRunId: syncRun.id,
      errorCode: "ORDER_FACTS_JSONL_MISSING",
      reason: "jsonl_source_missing",
    });
  }

  const persistedCommittedOrdinal = syncRun.jsonlCommittedLineOrdinal ?? 0;
  let contiguousCommitted = 0;
  let ordinalAck: DiskOrdinalAck | null = null;
  let applied = 0;
  let incomplete = 0;
  let examined = 0;
  let followUpReads = 0;
  let bulkDirectApplies = 0;
  let verifiedReplayApplies = 0;
  const ledgerCounts: LedgerQueryCounts = {
    initial: 0,
    recheck: 0,
    agreement: 0,
    sale: 0,
    refund: 0,
    fallback: 0,
    fallbackOrders: 0,
    fallbackTransportAttempts: 0,
    throttle: 0,
  };
  let parentTransportAttempts = 0;
  let fallbackOrders = 0;
  let fallbackTransportAttempts = 0;
  const epochBulkGid =
    bulkOperationGid && bulkOperationGid.startsWith(BULK_OPERATION_GID_PREFIX)
      ? bulkOperationGid
      : `${BULK_OPERATION_GID_PREFIX}d-jsonl-${syncRun.id}`;
  if (!fence.fenceGeneration && fence.fenceGeneration !== 0n) {
    return failImport({
      shopId: input.shopId,
      scratchRoot: input.scratchRoot,
      syncRunId: syncRun.id,
      errorCode: "order_facts_import_epoch_incomplete",
      reason: "fenceGeneration required",
    });
  }
  const observedAt = new Date();
  const scopes = await readGrantedAccessScopes({
    admin: countRunAdmin,
    shop: input.shop,
  });

  const noteCommitted = async (ordinals: number[]) => {
    if (!ordinalAck) {
      throw new OrderFactsSyncError(
        "order_facts_checkpoint_ack_missing",
        "validated source bitset was not opened before checkpointing",
      );
    }
    contiguousCommitted = ordinalAck.mark(ordinals);
    await ordinalAck.flush();
    if (bulkOperationGid && contiguousCommitted > persistedCommittedOrdinal) {
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
    const receipt = nominatedImportReceipt({
      durableJobId: input.durableJobId,
      shopifyGid: assembly.rootGid,
      sourceJobType: ORDER_FACTS_SYNC_JOB_TYPE,
      fenceGeneration: fence.fenceGeneration,
      shopId: input.shopId,
      syncRunId: syncRun.id,
      bulkOperationGid: epochBulkGid,
      queryFingerprint: fingerprint,
      apiVersion: ORDER_FACTS_D_API_VERSION,
      parent: assembly.root,
      children: assembly.children,
    });
    const legacyKey = legacyImportReceiptApplicationKey({
      durableJobId: input.durableJobId,
      shopifyGid: assembly.rootGid,
      sourceJobType: ORDER_FACTS_SYNC_JOB_TYPE,
    });
    const legacy = await lookupApplicationReceipt(
      input.db,
      input.shopId,
      legacyKey,
    );
    const modern = await lookupApplicationReceipt(
      input.db,
      input.shopId,
      receipt.applicationKey,
    );
    if (legacy && !modern) {
      throw new OrderFactsSyncError(
        "import_legacy_receipt_fresh_run_required",
        "import_legacy_receipt_fresh_run_required",
      );
    }
    if (
      modern &&
      importReceiptMatchesV1Digest({
        storedDigest: modern.payloadDigest,
        shopId: input.shopId,
        sourceJobType: ORDER_FACTS_SYNC_JOB_TYPE,
        durableJobId: input.durableJobId,
        shopifyGid: assembly.rootGid,
        queryFingerprint: fingerprint,
        apiVersion: ORDER_FACTS_D_API_VERSION,
        parent: assembly.root,
        children: assembly.children,
      })
    ) {
      throw new OrderFactsSyncError(
        "import_v1_receipt_fresh_run_required",
        "import_v1_receipt_fresh_run_required",
      );
    }
    let probed: "already_applied" | "proceed";
    try {
      probed = await probeReceiptBeforeShopifyIo(
        input.db,
        input.shopId,
        receipt,
      );
    } catch (error) {
      if (
        error instanceof SyncControlPlaneError &&
        error.code === APPLICATION_DIGEST_CONFLICT
      ) {
        throw new OrderFactsSyncError(
          "import_receipt_content_conflict_fresh_run_required",
          "import_receipt_content_conflict_fresh_run_required",
        );
      }
      throw error;
    }
    if (probed === "already_applied") {
      applied += 1;
      verifiedReplayApplies += 1;
      await noteCommitted(assembly.lineOrdinals);
      return;
    }
    const parentBudget = createDTransportBudget(
      input.parentTransportMaxRequests ?? ORDER_ADMIN_READ_MAX_REQUESTS,
    );
    const parentAdmin = wrapAdminWithDTransportBudget(input.admin, parentBudget, {
      resourceKind: "Order",
      requestedGid: assembly.rootGid,
      phase: "initial",
    });
    try {
      const ledger = await readOrderFactsImportLedger({
      context: { admin: parentAdmin, shop: input.shop },
      orderGid: assembly.rootGid,
      bulkUpdatedAt: bulkRootUpdatedAt(assembly.root),
      bulkCurrencyCode: bulkRootCurrencyCode(assembly.root),
      maxRequests: ORDER_ADMIN_READ_MAX_REQUESTS,
      transportBudget: parentBudget,
    });
    mergeLedgerCounts(ledgerCounts, ledger.counts);
    if (ledger.status === "drift") {
      if (parentBudget.used >= parentBudget.maxRequests) {
        incomplete += 1;
        return;
      }
      followUpReads += 1;
      fallbackOrders += 1;
      ledgerCounts.fallback += 1;
      ledgerCounts.fallbackOrders += 1;
      setDTransportPhase(parentBudget, "fallback");
      const usedBeforeFallback = parentBudget.used;
      let result;
      try {
        result = await applyNominatedOrderGid({
          db: input.db,
          admin: parentAdmin,
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
      } catch (error) {
        const fallbackUsed = parentBudget.used - usedBeforeFallback;
        fallbackTransportAttempts += fallbackUsed;
        ledgerCounts.fallbackTransportAttempts += fallbackUsed;
        if (error instanceof OrderPaginationError) {
          incomplete += 1;
          return;
        }
        throw error;
      }
      const fallbackUsed = parentBudget.used - usedBeforeFallback;
      fallbackTransportAttempts += fallbackUsed;
      ledgerCounts.fallbackTransportAttempts += fallbackUsed;
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
    } finally {
      parentTransportAttempts += parentBudget.used;
    }
  };

  let assembled;
  try {
    assembled = await streamOrderFactsJsonl(input.jsonlSource, {
      expectedObjectCount: expectedObjectCount ?? undefined,
      expectedRootObjectCount: expectedRootObjectCount ?? undefined,
      shopId: input.shopId,
      syncRunId: syncRun.id,
      scratchRoot: input.scratchRoot,
      maxScratchBytes: input.maxScratchBytes,
      maxScratchAttempts: input.maxScratchAttempts,
      reservedBytes: input.reservedBytes,
      epoch: {
        shopId: input.shopId,
        syncRunId: syncRun.id,
        bulkOperationGid: bulkOperationGid ?? null,
        queryFingerprint: fingerprint,
        apiVersion: ORDER_FACTS_D_API_VERSION,
        fenceGeneration:
          fence.fenceGeneration == null ? null : String(fence.fenceGeneration),
      },
      onValidatedStage: async (stage) => {
        ordinalAck = await DiskOrdinalAck.open({
          dir: stage.dir,
          lastOrdinal: stage.lastPhysicalOrdinal,
          contiguous: 0,
        });
      },
      onCompleteAssembly: applyAssembly,
    });
  } catch (error) {
    return failImport({
      shopId: input.shopId,
      scratchRoot: input.scratchRoot,
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
      scratchRoot: input.scratchRoot,
      syncRunId: syncRun.id,
      errorCode:
        assembled.status === "SCRATCH_RESOURCE"
          ? ORDER_FACTS_SCRATCH_RESOURCE_REASON
          : `JSONL_${assembled.status}`,
      reason: assembled.reason,
      examined,
      incomplete: Math.max(incomplete, assembled.rootCount),
      truncated: assembled.status === "TRUNCATED",
    });
  }

  if (incomplete > 0) {
    return failImport({
      shopId: input.shopId,
      scratchRoot: input.scratchRoot,
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
    scratchRoot: input.scratchRoot,
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
    verifiedReplayApplies,
    ledgerCounts,
    runTransportAttempts,
    parentTransportAttempts,
    fallbackOrders,
    fallbackTransportAttempts,
  };
}
