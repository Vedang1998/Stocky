import type { SyncRun } from "@prisma/client";
import type { TenantAuthority } from "../../../tenant/authority.server";
import { getControlPlanePrisma } from "../../../sync/control-plane-db.server";
import {
  CATALOG_BULK_QUERY_NO_UNIT_COST,
  CATALOG_BULK_QUERY_WITH_UNIT_COST,
  INVENTORY_LEVEL_BULK_QUERY,
  chooseCatalogBulkQuery,
  preflightUnitCostCapability,
  readAllLocations,
  readBulkOperationById,
  readShopCurrencyCode,
  type CatalogAdminReadClient,
  type LocationRead,
  type UnitCostAccess,
} from "../../../lib/catalog-facts/admin-read";
import type { FullSyncCanonicalObservation } from "../../../lib/catalog-facts/apply/types";
import { applyParsedJsonlBatch } from "../../../lib/catalog-facts/ingest/apply-batch";
import {
  ProductCollectionAccumulator,
  replaceProductCollectionMemberships,
} from "../../../lib/catalog-facts/ingest/collection-memberships";
import {
  acknowledgeJsonlBatch,
  assertPolledBulkOperationMatches,
  attachBulkOperationGid,
  completeSyncRunAndCursor,
  markSyncRunPartialFailure,
  persistBulkCounts,
  persistBulkSubmitIntentAndFence,
  persistFullSyncFence,
} from "../../../lib/catalog-facts/ingest/checkpoint";
import {
  fingerprintBulkQuery,
  readUnitCostProbeIdentity,
  recoverOrphanBulkOperation,
} from "../../../lib/catalog-facts/ingest/bulk-operation-recovery";
import { submitCatalogFactBulkOperation } from "../../../lib/catalog-facts/ingest/bulk-operation-submitter";
import { streamJsonlBatches } from "../../../lib/catalog-facts/ingest/jsonl-stream";
import type {
  JsonlBulkDomain,
  ParsedJsonlBatch,
} from "../../../lib/catalog-facts/ingest/types";
import { nominateAbsenceCandidates } from "./absence";
import { applyCanonicalObservationBatches } from "./canonical-batch";
import { reconcileCatalogDiagnostics } from "./diagnostic-reconciler";
import { recoverPendingCompatibilityProjection } from "./projection";

const DOMAIN_ORDER = ["locations", "catalog", "inventory_levels"] as const;
type CatalogSyncDomain = (typeof DOMAIN_ORDER)[number];

export const BULK_POLL_INTERVAL_MS = 5_000;
export const BULK_POLL_MAX_ATTEMPTS = 120;
export const BULK_POLL_WALL_CLOCK_MAX_MS = 600_000;

export type CatalogSyncStepResult =
  | { status: "SUCCEEDED" }
  | { status: "CONTINUE"; backoffMs: number; reason: string }
  | { status: "PARTIAL_FAILURE"; reason: string };

async function assertProcessingEnabled(
  authority: TenantAuthority,
): Promise<void> {
  const shop = await getControlPlanePrisma().shop.findUnique({
    where: { id: authority.shopId },
    select: { myshopifyDomain: true, processingEnabled: true },
  });
  if (
    !shop?.processingEnabled ||
    shop.myshopifyDomain !== authority.myshopifyDomain
  ) {
    throw new Error("shop_processing_disabled");
  }
}

async function domainRun(input: {
  authority: TenantAuthority;
  domain: CatalogSyncDomain;
  correlationId: string;
}): Promise<SyncRun> {
  const prisma = getControlPlanePrisma();
  const latest = await prisma.syncRun.findFirst({
    where: {
      shopId: input.authority.shopId,
      syncDomain: input.domain,
      correlationId: input.correlationId,
    },
    orderBy: { createdAt: "desc" },
  });
  if (
    latest &&
    (latest.status === "PENDING" ||
      latest.status === "RUNNING" ||
      latest.status === "SUCCEEDED")
  ) {
    return latest;
  }
  return prisma.syncRun.create({
    data: {
      shopId: input.authority.shopId,
      syncDomain: input.domain,
      source: "catalog-facts-v1",
      status: "PENDING",
      correlationId: input.correlationId,
      startedAt: new Date(),
    },
  });
}

function mapLocation(
  authority: TenantAuthority,
  location: LocationRead,
  input: {
    syncRunId: string;
    durableJobId: string;
    fenceGeneration: bigint;
    observedAt: Date;
  },
): FullSyncCanonicalObservation {
  return {
    observationKind: "full_sync",
    identity: {
      shopId: authority.shopId,
      resourceKind: "Location",
      shopifyGid: location.id,
    },
    existenceKind: "LIVE_FULL_SYNC_PRESENT",
    existenceObservedAt: input.observedAt,
    shopifyCreatedAt: new Date(location.shopifyCreatedAt),
    shopifyUpdatedAt: new Date(location.shopifyUpdatedAt),
    shopifyLegacyResourceId: location.legacyResourceId,
    sourceKind: "FULL_SYNC",
    lastDurableJobId: input.durableJobId,
    lastSyncRunId: input.syncRunId,
    fenceGeneration: input.fenceGeneration,
    epochId: input.syncRunId,
    attributes: {
      name: location.name,
      isActive: location.isActive,
      deactivatedAt:
        location.deactivatedAt == null
          ? null
          : new Date(location.deactivatedAt),
      fulfillsOnlineOrders: location.fulfillsOnlineOrders,
      shipsInventory: location.shipsInventory,
      isFulfillmentService: location.isFulfillmentService,
      hasActiveInventory: location.hasActiveInventory,
      address1: location.address1,
      city: location.city,
      provinceCode: location.provinceCode,
      countryCode: location.countryCode,
      zip: location.zip,
    },
  };
}

async function runLocations(input: {
  authority: TenantAuthority;
  admin: CatalogAdminReadClient;
  run: SyncRun;
  durableJobId: string;
  canonicalBatchSize: number;
  canonicalConcurrency: number;
}): Promise<CatalogSyncStepResult> {
  const fence =
    input.run.fenceGeneration == null
      ? await persistFullSyncFence({
          shopId: input.authority.shopId,
          syncRunId: input.run.id,
        })
      : {
          fenceGeneration: input.run.fenceGeneration,
          fenceAt: input.run.fenceAt ?? new Date(),
        };
  try {
    const locations = await readAllLocations(input.admin);
    const observations = locations.map((location) =>
      mapLocation(input.authority, location, {
        syncRunId: input.run.id,
        durableJobId: input.durableJobId,
        fenceGeneration: fence.fenceGeneration,
        observedAt: new Date(),
      }),
    );
    const results = await applyCanonicalObservationBatches({
      authority: input.authority,
      observations,
      batchSize: input.canonicalBatchSize,
      configuredWorstCaseConcurrentCanonicalTransactions:
        input.canonicalConcurrency,
      assertProcessingEnabled: () => assertProcessingEnabled(input.authority),
      project: false,
    });
    await nominateAbsenceCandidates({
      authority: input.authority,
      domain: "locations",
      epochId: input.run.id,
      fenceGeneration: fence.fenceGeneration,
    });
    await completeSyncRunAndCursor({
      shopId: input.authority.shopId,
      syncRunId: input.run.id,
      syncDomain: "locations",
      examinedCount: locations.length,
      appliedCount: results.filter((result) => result.outcome === "applied")
        .length,
      skippedCount: results.filter((result) => result.outcome === "noop")
        .length,
    });
    return { status: "SUCCEEDED" };
  } catch (error) {
    await markSyncRunPartialFailure({
      shopId: input.authority.shopId,
      syncRunId: input.run.id,
      errorCode: "locations_incomplete",
      failureSummary: error instanceof Error ? error.message : String(error),
    });
    return { status: "PARTIAL_FAILURE", reason: "locations_incomplete" };
  }
}

async function chooseCatalogQuery(
  admin: CatalogAdminReadClient,
  persistedShape: string | null,
): Promise<{
  query: string;
  shape: "with-unitCost" | "no-unitCost";
  unitCostAccess: UnitCostAccess;
  unitCostSelected: boolean;
}> {
  if (persistedShape === "with-unitCost" || persistedShape === "no-unitCost") {
    return {
      query:
        persistedShape === "with-unitCost"
          ? CATALOG_BULK_QUERY_WITH_UNIT_COST
          : CATALOG_BULK_QUERY_NO_UNIT_COST,
      shape: persistedShape,
      unitCostAccess:
        persistedShape === "with-unitCost" ? "PRESENT" : "QUERY_ERROR_ISOLATED",
      unitCostSelected: persistedShape === "with-unitCost",
    };
  }
  const probe = await readUnitCostProbeIdentity(admin);
  if (!probe) {
    return {
      query: CATALOG_BULK_QUERY_NO_UNIT_COST,
      shape: "no-unitCost",
      unitCostAccess: "QUERY_ERROR_ISOLATED",
      unitCostSelected: false,
    };
  }
  const preflight = await preflightUnitCostCapability(admin, probe);
  const selected = chooseCatalogBulkQuery(preflight);
  return {
    query: selected.document,
    shape: selected.shape,
    unitCostAccess: preflight.unitCostAccess,
    unitCostSelected: selected.shape === "with-unitCost",
  };
}

async function incrementPollAttempt(run: SyncRun): Promise<boolean> {
  const elapsed =
    Date.now() -
    (run.bulkSubmitIntentAt ?? run.startedAt ?? run.createdAt).getTime();
  if (
    run.examinedCount >= BULK_POLL_MAX_ATTEMPTS ||
    elapsed >= BULK_POLL_WALL_CLOCK_MAX_MS
  ) {
    return false;
  }
  await getControlPlanePrisma().syncRun.updateMany({
    where: { id: run.id, shopId: run.shopId },
    data: { examinedCount: { increment: 1 } },
  });
  return true;
}

async function runBulkDomain(input: {
  authority: TenantAuthority;
  admin: CatalogAdminReadClient;
  run: SyncRun;
  domain: JsonlBulkDomain;
  durableJobId: string;
  canonicalBatchSize: number;
  canonicalConcurrency: number;
}): Promise<CatalogSyncStepResult> {
  const prisma = getControlPlanePrisma();
  const choice =
    input.domain === "catalog"
      ? await chooseCatalogQuery(input.admin, input.run.cursorBefore)
      : {
          query: INVENTORY_LEVEL_BULK_QUERY,
          shape: "inventory-levels" as const,
          unitCostAccess: "QUERY_ERROR_ISOLATED" as UnitCostAccess,
          unitCostSelected: false,
        };
  let run = input.run;

  if (!run.bulkOperationGid && !run.bulkSubmitIntentAt) {
    const fingerprint = fingerprintBulkQuery({
      query: choice.query,
      shopId: input.authority.shopId,
    });
    await prisma.syncRun.updateMany({
      where: { id: run.id, shopId: input.authority.shopId },
      data: { cursorBefore: choice.shape },
    });
    await persistBulkSubmitIntentAndFence({
      shopId: input.authority.shopId,
      syncRunId: run.id,
      bulkQueryFingerprint: fingerprint,
    });
    const submitted = await submitCatalogFactBulkOperation(
      input.admin,
      choice.query,
    );
    await attachBulkOperationGid({
      shopId: input.authority.shopId,
      syncRunId: run.id,
      bulkOperationGid: submitted.id,
    });
    return {
      status: "CONTINUE",
      backoffMs: BULK_POLL_INTERVAL_MS,
      reason: "bulk_submitted",
    };
  }

  if (!run.bulkOperationGid) {
    if (!run.bulkSubmitIntentAt || !run.bulkQueryFingerprint) {
      await markSyncRunPartialFailure({
        shopId: input.authority.shopId,
        syncRunId: run.id,
        errorCode: "bulk_submit_intent_incomplete",
        failureSummary: "Bulk submit intent is missing recovery identity",
      });
      return {
        status: "PARTIAL_FAILURE",
        reason: "bulk_submit_intent_incomplete",
      };
    }
    const recovered = await recoverOrphanBulkOperation(input.admin, {
      shopId: input.authority.shopId,
      bulkSubmitIntentAt: run.bulkSubmitIntentAt,
      bulkQueryFingerprint: run.bulkQueryFingerprint,
    });
    if (recovered.status === "ADOPTED") {
      await attachBulkOperationGid({
        shopId: input.authority.shopId,
        syncRunId: run.id,
        bulkOperationGid: recovered.bulkOperationGid,
      });
      return {
        status: "CONTINUE",
        backoffMs: BULK_POLL_INTERVAL_MS,
        reason: "orphan_bulk_adopted",
      };
    }
    if (recovered.status === "WAIT" && (await incrementPollAttempt(run))) {
      return {
        status: "CONTINUE",
        backoffMs: BULK_POLL_INTERVAL_MS,
        reason: "orphan_bulk_wait",
      };
    }
    await markSyncRunPartialFailure({
      shopId: input.authority.shopId,
      syncRunId: run.id,
      errorCode: "orphan_bulk_unproven",
      failureSummary: `Orphan BulkOperation recovery ${recovered.status}`,
    });
    return { status: "PARTIAL_FAILURE", reason: "orphan_bulk_unproven" };
  }

  const polled = await readBulkOperationById(input.admin, run.bulkOperationGid);
  if (!polled) {
    if (await incrementPollAttempt(run)) {
      return {
        status: "CONTINUE",
        backoffMs: BULK_POLL_INTERVAL_MS,
        reason: "bulk_not_visible",
      };
    }
    await markSyncRunPartialFailure({
      shopId: input.authority.shopId,
      syncRunId: run.id,
      errorCode: "bulk_poll_exhausted",
      failureSummary:
        "BulkOperation did not become visible within poll ceiling",
    });
    return { status: "PARTIAL_FAILURE", reason: "bulk_poll_exhausted" };
  }
  assertPolledBulkOperationMatches(run.bulkOperationGid, polled.snapshot.id);
  if (
    polled.snapshot.status === "CREATED" ||
    polled.snapshot.status === "RUNNING" ||
    polled.snapshot.status === "CANCELING"
  ) {
    if (await incrementPollAttempt(run)) {
      return {
        status: "CONTINUE",
        backoffMs: BULK_POLL_INTERVAL_MS,
        reason: "bulk_running",
      };
    }
  }

  if (!polled.canonicalSuccessEligible || !polled.snapshot.url) {
    await persistBulkCounts({
      shopId: input.authority.shopId,
      syncRunId: run.id,
      bulkOperationGid: run.bulkOperationGid,
      objectCount: polled.snapshot.objectCount,
      rootObjectCount: polled.snapshot.rootObjectCount,
    });
    await markSyncRunPartialFailure({
      shopId: input.authority.shopId,
      syncRunId: run.id,
      errorCode: "bulk_not_complete",
      failureSummary: `BulkOperation status=${polled.snapshot.status}; partial data is never canonical completion`,
    });
    return { status: "PARTIAL_FAILURE", reason: "bulk_not_complete" };
  }

  await persistBulkCounts({
    shopId: input.authority.shopId,
    syncRunId: run.id,
    bulkOperationGid: run.bulkOperationGid!,
    objectCount: polled.snapshot.objectCount,
    rootObjectCount: polled.snapshot.rootObjectCount,
  });
  const response = await fetch(polled.snapshot.url);
  if (!response.ok || !response.body) {
    await markSyncRunPartialFailure({
      shopId: input.authority.shopId,
      syncRunId: run.id,
      errorCode: "bulk_result_unavailable",
      failureSummary: `Bulk result HTTP ${response.status}`,
    });
    return { status: "PARTIAL_FAILURE", reason: "bulk_result_unavailable" };
  }

  run = (await prisma.syncRun.findUnique({ where: { id: run.id } }))!;
  const checkpoint = run.jsonlCommittedLineOrdinal ?? 0;
  const currencyCode =
    input.domain === "catalog"
      ? await readShopCurrencyCode(input.admin)
      : "USD";
  if (!currencyCode) {
    await markSyncRunPartialFailure({
      shopId: input.authority.shopId,
      syncRunId: run.id,
      errorCode: "shop_currency_missing",
      failureSummary: "Shop currency is required for exact Money facts",
    });
    return { status: "PARTIAL_FAILURE", reason: "shop_currency_missing" };
  }

  const collections = new ProductCollectionAccumulator();
  let appliedCount = 0;
  let skippedCount = 0;
  const streamed = await streamJsonlBatches({
    domain: input.domain,
    source: response.body,
    expectedObjectCount: polled.snapshot.objectCount,
    expectedRootObjectCount: polled.snapshot.rootObjectCount,
    onBatch: async (batch) => {
      const completeSets =
        input.domain === "catalog" ? collections.accept(batch.lines) : [];
      if (batch.endLineOrdinal <= checkpoint) {
        for (const set of completeSets) {
          await replaceProductCollectionMemberships(input.authority, set);
        }
        return;
      }
      const effectiveBatch: ParsedJsonlBatch =
        checkpoint >= batch.startLineOrdinal
          ? {
              startLineOrdinal: checkpoint + 1,
              endLineOrdinal: batch.endLineOrdinal,
              lines: batch.lines.filter((line) => line.ordinal > checkpoint),
            }
          : batch;
      const applied = await applyParsedJsonlBatch({
        authority: input.authority,
        domain: input.domain,
        batch: effectiveBatch,
        syncRunId: run.id,
        bulkOperationGid: run.bulkOperationGid!,
        fenceGeneration: run.fenceGeneration!,
        durableJobId: input.durableJobId,
        observedAt: new Date(),
        currencyCode,
        unitCostAccess: choice.unitCostAccess,
        unitCostSelected: choice.unitCostSelected,
        canonicalIdentitiesPerTransaction: input.canonicalBatchSize,
        configuredWorstCaseConcurrentCanonicalTransactions:
          input.canonicalConcurrency,
        assertProcessingEnabled: () => assertProcessingEnabled(input.authority),
      });
      appliedCount += applied.results.filter(
        (result) => result.outcome === "applied",
      ).length;
      skippedCount += applied.results.filter(
        (result) => result.outcome === "noop",
      ).length;
      for (const set of completeSets) {
        await replaceProductCollectionMemberships(input.authority, set);
      }
      await acknowledgeJsonlBatch({
        shopId: input.authority.shopId,
        syncRunId: run.id,
        bulkOperationGid: run.bulkOperationGid!,
        endLineOrdinal: batch.endLineOrdinal,
      });
    },
  });

  await persistBulkCounts({
    shopId: input.authority.shopId,
    syncRunId: run.id,
    bulkOperationGid: run.bulkOperationGid!,
    objectCount: polled.snapshot.objectCount,
    rootObjectCount: polled.snapshot.rootObjectCount,
    streamedObjectCount: streamed.streamedObjectCount,
    streamedRootObjectCount: streamed.streamedRootObjectCount,
  });
  if (streamed.status !== "COMPLETE") {
    collections.discardIncompleteStream();
    await markSyncRunPartialFailure({
      shopId: input.authority.shopId,
      syncRunId: run.id,
      errorCode: streamed.failureCode,
      failureSummary: streamed.failureSummary,
      streamedObjectCount: streamed.streamedObjectCount,
      streamedRootObjectCount: streamed.streamedRootObjectCount,
    });
    return { status: "PARTIAL_FAILURE", reason: streamed.failureCode };
  }
  if (input.domain === "catalog") {
    for (const set of collections.finishCompleteStream()) {
      await replaceProductCollectionMemberships(input.authority, set);
    }
  }
  await nominateAbsenceCandidates({
    authority: input.authority,
    domain: input.domain,
    epochId: run.id,
    fenceGeneration: run.fenceGeneration!,
  });
  await completeSyncRunAndCursor({
    shopId: input.authority.shopId,
    syncRunId: run.id,
    syncDomain: input.domain,
    examinedCount: streamed.lastParsedLineOrdinal,
    appliedCount,
    skippedCount,
  });
  return { status: "SUCCEEDED" };
}

export async function runCatalogFactsSyncStep(input: {
  authority: TenantAuthority;
  admin: CatalogAdminReadClient;
  durableJobId: string;
  correlationId: string;
  durableAttemptCount: number;
  canonicalBatchSize: number;
  canonicalConcurrency: number;
}): Promise<CatalogSyncStepResult> {
  await assertProcessingEnabled(input.authority);

  const recovery = await recoverPendingCompatibilityProjection({
    authority: input.authority,
    completedObservationCycles: input.durableAttemptCount,
  });
  if (recovery.attempted > 0) {
    if (recovery.failed) {
      return {
        status: "CONTINUE",
        backoffMs: BULK_POLL_INTERVAL_MS,
        reason: "projection_retry",
      };
    }
    return {
      status: "CONTINUE",
      backoffMs: 1,
      reason: "projection_page_completed",
    };
  }

  if (await hasWebhookClassBacklog(input.authority.shopId)) {
    return {
      status: "CONTINUE",
      backoffMs: BULK_POLL_INTERVAL_MS,
      reason: "webhook_backlog_preferred",
    };
  }

  for (const domain of DOMAIN_ORDER) {
    const run = await domainRun({
      authority: input.authority,
      domain,
      correlationId: input.correlationId,
    });
    if (run.status === "SUCCEEDED") continue;
    const result =
      domain === "locations"
        ? await runLocations({
            ...input,
            run,
          })
        : await runBulkDomain({
            ...input,
            run,
            domain,
          });
    if (result.status !== "SUCCEEDED") {
      await reconcileCatalogDiagnostics(input.authority, domain);
      return result;
    }
    const projection = await recoverPendingCompatibilityProjection({
      authority: input.authority,
      completedObservationCycles: input.durableAttemptCount,
    });
    if (projection.attempted > 0) {
      await reconcileCatalogDiagnostics(input.authority, domain);
      return {
        status: "CONTINUE",
        backoffMs: projection.failed ? BULK_POLL_INTERVAL_MS : 1,
        reason: projection.failed
          ? "projection_retry"
          : "projection_page_completed",
      };
    }
    await reconcileCatalogDiagnostics(input.authority, domain);
  }

  return { status: "SUCCEEDED" };
}

export async function hasWebhookClassBacklog(shopId: string): Promise<boolean> {
  return (
    (await getControlPlanePrisma().durableJob.count({
      where: {
        shopId,
        jobType: { startsWith: "webhook:" },
        state: { in: ["PENDING", "RETRY_WAIT", "DISPATCH_LEASED"] },
        NOT: { jobType: "webhook:bulk_operations/finish" },
      },
    })) > 0
  );
}

export async function runInventoryStateReconcileStep(input: {
  authority: TenantAuthority;
  admin: CatalogAdminReadClient;
  durableJobId: string;
  correlationId: string;
  canonicalBatchSize: number;
  canonicalConcurrency: number;
}): Promise<CatalogSyncStepResult> {
  await assertProcessingEnabled(input.authority);
  if (await hasWebhookClassBacklog(input.authority.shopId)) {
    return {
      status: "CONTINUE",
      backoffMs: BULK_POLL_INTERVAL_MS,
      reason: "webhook_backlog_preferred",
    };
  }
  const run = await domainRun({
    authority: input.authority,
    domain: "inventory_levels",
    correlationId: input.correlationId,
  });
  if (run.status === "SUCCEEDED") return { status: "SUCCEEDED" };
  return runBulkDomain({
    ...input,
    run,
    domain: "inventory_levels",
  });
}
