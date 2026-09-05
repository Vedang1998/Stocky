import type { Prisma, PrismaClient, SyncRun } from "@prisma/client";
import { getControlPlanePrisma } from "../../../sync/control-plane-db.server";

type ControlPlaneClient = Pick<
  PrismaClient,
  "$transaction" | "syncRun" | "syncCursor" | "shop"
>;

export class JsonlCheckpointError extends Error {
  constructor(
    readonly code:
      | "sync_run_missing"
      | "shop_processing_disabled"
      | "bulk_operation_gid_mismatch"
      | "checkpoint_ordinal_invalid"
      | "checkpoint_regression",
    message: string,
  ) {
    super(message);
    this.name = "JsonlCheckpointError";
  }
}

function requireOrdinal(ordinal: number): void {
  if (!Number.isSafeInteger(ordinal) || ordinal < 1) {
    throw new JsonlCheckpointError(
      "checkpoint_ordinal_invalid",
      "JSONL checkpoint ordinal must be a 1-based safe integer",
    );
  }
}

async function lockSyncRun(
  tx: Prisma.TransactionClient,
  syncRunId: string,
  shopId: string,
): Promise<SyncRun> {
  const rows = await tx.$queryRaw<SyncRun[]>`
    SELECT * FROM "SyncRun"
    WHERE id = ${syncRunId} AND "shopId" = ${shopId}
    FOR UPDATE
  `;
  if (rows.length !== 1) {
    throw new JsonlCheckpointError(
      "sync_run_missing",
      "SyncRun checkpoint row is missing",
    );
  }
  return rows[0]!;
}

async function requireProcessingEnabled(
  tx: Prisma.TransactionClient,
  shopId: string,
): Promise<void> {
  const shop = await tx.shop.findUnique({
    where: { id: shopId },
    select: { processingEnabled: true },
  });
  if (!shop?.processingEnabled) {
    throw new JsonlCheckpointError(
      "shop_processing_disabled",
      "Shop processing is disabled; checkpoint must not advance",
    );
  }
}

async function persistFence(
  input: {
    shopId: string;
    syncRunId: string;
    bulkQueryFingerprint?: string;
  },
  prisma: ControlPlaneClient = getControlPlanePrisma(),
): Promise<{ fenceGeneration: bigint; fenceAt: Date; submitIntentAt: Date }> {
  if (
    input.bulkQueryFingerprint !== undefined &&
    !/^[0-9a-f]{64}$/.test(input.bulkQueryFingerprint)
  ) {
    throw new Error("bulk_query_fingerprint_invalid");
  }
  return prisma.$transaction(async (tx) => {
    await requireProcessingEnabled(tx, input.shopId);
    await lockSyncRun(tx, input.syncRunId, input.shopId);
    const generated = await tx.$queryRaw<
      Array<{ generation: bigint; observed_at: Date }>
    >`
      SELECT
        nextval('stocky_catalog_observation_gen_seq') AS generation,
        clock_timestamp() AS observed_at
    `;
    const generation = generated[0]?.generation;
    const observedAt = generated[0]?.observed_at;
    if (typeof generation !== "bigint" || !(observedAt instanceof Date)) {
      throw new Error("bulk_fence_generation_missing");
    }
    const updated = await tx.syncRun.update({
      where: { id: input.syncRunId },
      data: {
        status: "RUNNING",
        fenceGeneration: generation,
        fenceAt: observedAt,
        ...(input.bulkQueryFingerprint !== undefined
          ? {
              bulkSubmitIntentAt: observedAt,
              bulkQueryFingerprint: input.bulkQueryFingerprint,
            }
          : {}),
      },
    });
    return {
      fenceGeneration: generation,
      fenceAt: observedAt,
      submitIntentAt: updated.bulkSubmitIntentAt!,
    };
  });
}

export async function persistBulkSubmitIntentAndFence(
  input: {
    shopId: string;
    syncRunId: string;
    bulkQueryFingerprint: string;
  },
  prisma: ControlPlaneClient = getControlPlanePrisma(),
): Promise<{ fenceGeneration: bigint; fenceAt: Date; submitIntentAt: Date }> {
  return persistFence(input, prisma);
}

export async function persistFullSyncFence(
  input: { shopId: string; syncRunId: string },
  prisma: ControlPlaneClient = getControlPlanePrisma(),
): Promise<{ fenceGeneration: bigint; fenceAt: Date }> {
  const result = await persistFence(input, prisma);
  return {
    fenceGeneration: result.fenceGeneration,
    fenceAt: result.fenceAt,
  };
}

export async function attachBulkOperationGid(
  input: { shopId: string; syncRunId: string; bulkOperationGid: string },
  prisma: ControlPlaneClient = getControlPlanePrisma(),
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await requireProcessingEnabled(tx, input.shopId);
    const run = await lockSyncRun(tx, input.syncRunId, input.shopId);
    if (run.bulkOperationGid === input.bulkOperationGid) return;
    await tx.syncRun.update({
      where: { id: input.syncRunId },
      data: {
        bulkOperationGid: input.bulkOperationGid,
        jsonlCommittedLineOrdinal: null,
        bulkObjectCount: null,
        bulkRootObjectCount: null,
        streamedObjectCount: null,
        streamedRootObjectCount: null,
      },
    });
  });
}

export function assertPolledBulkOperationMatches(
  persistedGid: string | null,
  polledGid: string,
): asserts persistedGid is string {
  if (!persistedGid || persistedGid !== polledGid) {
    throw new JsonlCheckpointError(
      "bulk_operation_gid_mismatch",
      "Polled BulkOperation GID does not match the paired checkpoint GID",
    );
  }
}

export async function acknowledgeJsonlBatch(
  input: {
    shopId: string;
    syncRunId: string;
    bulkOperationGid: string;
    endLineOrdinal: number;
  },
  prisma: ControlPlaneClient = getControlPlanePrisma(),
): Promise<void> {
  requireOrdinal(input.endLineOrdinal);
  await prisma.$transaction(async (tx) => {
    await requireProcessingEnabled(tx, input.shopId);
    const run = await lockSyncRun(tx, input.syncRunId, input.shopId);
    assertPolledBulkOperationMatches(
      run.bulkOperationGid,
      input.bulkOperationGid,
    );
    const current = run.jsonlCommittedLineOrdinal;
    if (current != null && input.endLineOrdinal < current) {
      throw new JsonlCheckpointError(
        "checkpoint_regression",
        "JSONL checkpoint cannot move backward within one BulkOperation",
      );
    }
    if (current === input.endLineOrdinal) return;
    await tx.syncRun.update({
      where: { id: input.syncRunId },
      data: { jsonlCommittedLineOrdinal: input.endLineOrdinal },
    });
  });
}

export async function persistBulkCounts(
  input: {
    shopId: string;
    syncRunId: string;
    bulkOperationGid: string;
    objectCount: string | null;
    rootObjectCount: string | null;
    streamedObjectCount?: string;
    streamedRootObjectCount?: string;
  },
  prisma: ControlPlaneClient = getControlPlanePrisma(),
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const run = await lockSyncRun(tx, input.syncRunId, input.shopId);
    assertPolledBulkOperationMatches(
      run.bulkOperationGid,
      input.bulkOperationGid,
    );
    await tx.syncRun.update({
      where: { id: input.syncRunId },
      data: {
        bulkObjectCount: input.objectCount,
        bulkRootObjectCount: input.rootObjectCount,
        ...(input.streamedObjectCount !== undefined
          ? { streamedObjectCount: input.streamedObjectCount }
          : {}),
        ...(input.streamedRootObjectCount !== undefined
          ? { streamedRootObjectCount: input.streamedRootObjectCount }
          : {}),
      },
    });
  });
}

export function fullSyncCursorValue(syncRunId: string): string {
  if (!syncRunId) throw new Error("sync_run_id_missing");
  return `full-sync-epoch:${syncRunId}`;
}

export async function markSyncRunPartialFailure(
  input: {
    shopId: string;
    syncRunId: string;
    errorCode: string;
    failureSummary: string;
    streamedObjectCount?: string;
    streamedRootObjectCount?: string;
  },
  prisma: ControlPlaneClient = getControlPlanePrisma(),
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockSyncRun(tx, input.syncRunId, input.shopId);
    await tx.syncRun.update({
      where: { id: input.syncRunId },
      data: {
        status: "PARTIAL_FAILURE",
        partialFailure: true,
        errorCode: input.errorCode.slice(0, 64),
        failureSummary: input.failureSummary.slice(0, 512),
        failedAt: new Date(),
        ...(input.streamedObjectCount !== undefined
          ? { streamedObjectCount: input.streamedObjectCount }
          : {}),
        ...(input.streamedRootObjectCount !== undefined
          ? { streamedRootObjectCount: input.streamedRootObjectCount }
          : {}),
      },
    });
  });
}

export async function completeSyncRunAndCursor(
  input: {
    shopId: string;
    syncRunId: string;
    syncDomain: string;
    examinedCount: number;
    appliedCount: number;
    skippedCount: number;
  },
  prisma: ControlPlaneClient = getControlPlanePrisma(),
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await requireProcessingEnabled(tx, input.shopId);
    await lockSyncRun(tx, input.syncRunId, input.shopId);
    const now = new Date();
    await tx.syncRun.update({
      where: { id: input.syncRunId },
      data: {
        status: "SUCCEEDED",
        partialFailure: false,
        completedAt: now,
        failedAt: null,
        errorCode: null,
        failureSummary: null,
        examinedCount: input.examinedCount,
        appliedCount: input.appliedCount,
        skippedCount: input.skippedCount,
      },
    });
    await tx.syncCursor.upsert({
      where: {
        shopId_syncDomain: {
          shopId: input.shopId,
          syncDomain: input.syncDomain,
        },
      },
      create: {
        shopId: input.shopId,
        syncDomain: input.syncDomain,
        cursorValue: fullSyncCursorValue(input.syncRunId),
      },
      update: {
        cursorValue: fullSyncCursorValue(input.syncRunId),
      },
    });
  });
}
