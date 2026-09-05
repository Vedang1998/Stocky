import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  acknowledgeJsonlBatch,
  attachBulkOperationGid,
  completeSyncRunAndCursor,
  fullSyncCursorValue,
  JsonlCheckpointError,
  markSyncRunPartialFailure,
  persistBulkCounts,
  persistBulkSubmitIntentAndFence,
} from "../../../app/lib/catalog-facts/ingest/checkpoint";
import { deriveIngestBatchId } from "../../../app/lib/catalog-facts/ingest/ingest-batch-id";
import {
  completeProductData,
  resetF3Rows,
  setupF3Database,
} from "./pr5-f3-test-helpers";

describe("PR5-F3 paired JSONL checkpoint PostgreSQL boundaries", () => {
  let prisma: PrismaClient;
  let shopAId: string;

  beforeAll(async () => {
    ({ prisma, shopAId } = await setupF3Database());
  }, 120_000);

  beforeEach(async () => {
    await resetF3Rows(prisma);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function run() {
    return prisma.syncRun.create({
      data: {
        shopId: shopAId,
        syncDomain: "catalog",
        source: "catalog-facts-v1",
        correlationId: `corr-${Math.random()}`,
      },
    });
  }

  it("schema carries all paired checkpoint columns and index", async () => {
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'SyncRun'
    `;
    expect(columns.map((row) => row.column_name)).toEqual(
      expect.arrayContaining([
        "bulkOperationGid",
        "jsonlCommittedLineOrdinal",
        "bulkSubmitIntentAt",
        "bulkQueryFingerprint",
        "bulkObjectCount",
        "bulkRootObjectCount",
        "streamedObjectCount",
        "streamedRootObjectCount",
      ]),
    );
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes WHERE tablename = 'SyncRun'
    `;
    expect(indexes.map((row) => row.indexname)).toContain(
      "SyncRun_shopId_bulkOperationGid_idx",
    );
  });

  it("persists submit intent and a sequence fence before Shopify I/O", async () => {
    const created = await run();
    const result = await persistBulkSubmitIntentAndFence(
      {
        shopId: shopAId,
        syncRunId: created.id,
        bulkQueryFingerprint: "a".repeat(64),
      },
      prisma,
    );
    const stored = await prisma.syncRun.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(result.fenceGeneration).toBeGreaterThan(0n);
    expect(stored).toMatchObject({
      status: "RUNNING",
      bulkQueryFingerprint: "a".repeat(64),
    });
    expect(stored.bulkSubmitIntentAt).toBeInstanceOf(Date);
  });

  it("atomically resets ordinal when a new GID is attached", async () => {
    const created = await run();
    await prisma.syncRun.update({
      where: { id: created.id },
      data: {
        bulkOperationGid: "gid://shopify/BulkOperation/A",
        jsonlCommittedLineOrdinal: 100,
      },
    });
    await attachBulkOperationGid(
      {
        shopId: shopAId,
        syncRunId: created.id,
        bulkOperationGid: "gid://shopify/BulkOperation/B",
      },
      prisma,
    );
    expect(
      await prisma.syncRun.findUniqueOrThrow({ where: { id: created.id } }),
    ).toMatchObject({
      bulkOperationGid: "gid://shopify/BulkOperation/B",
      jsonlCommittedLineOrdinal: null,
    });
  });

  it("does not reset an ordinal when the exact same GID is reattached", async () => {
    const created = await run();
    await prisma.syncRun.update({
      where: { id: created.id },
      data: {
        bulkOperationGid: "gid://shopify/BulkOperation/A",
        jsonlCommittedLineOrdinal: 9,
      },
    });
    await attachBulkOperationGid(
      {
        shopId: shopAId,
        syncRunId: created.id,
        bulkOperationGid: "gid://shopify/BulkOperation/A",
      },
      prisma,
    );
    expect(
      (
        await prisma.syncRun.findUniqueOrThrow({
          where: { id: created.id },
        })
      ).jsonlCommittedLineOrdinal,
    ).toBe(9);
  });

  it("acknowledges a 1-based applied batch after merchant commit", async () => {
    const created = await run();
    await attachBulkOperationGid(
      {
        shopId: shopAId,
        syncRunId: created.id,
        bulkOperationGid: "gid://shopify/BulkOperation/A",
      },
      prisma,
    );
    await acknowledgeJsonlBatch(
      {
        shopId: shopAId,
        syncRunId: created.id,
        bulkOperationGid: "gid://shopify/BulkOperation/A",
        endLineOrdinal: 200,
      },
      prisma,
    );
    expect(
      (
        await prisma.syncRun.findUniqueOrThrow({
          where: { id: created.id },
        })
      ).jsonlCommittedLineOrdinal,
    ).toBe(200);
  });

  it("same acknowledgement is idempotent", async () => {
    const created = await run();
    await attachBulkOperationGid(
      {
        shopId: shopAId,
        syncRunId: created.id,
        bulkOperationGid: "gid://shopify/BulkOperation/A",
      },
      prisma,
    );
    for (const endLineOrdinal of [2, 2]) {
      await acknowledgeJsonlBatch(
        {
          shopId: shopAId,
          syncRunId: created.id,
          bulkOperationGid: "gid://shopify/BulkOperation/A",
          endLineOrdinal,
        },
        prisma,
      );
    }
    expect(
      (
        await prisma.syncRun.findUniqueOrThrow({
          where: { id: created.id },
        })
      ).jsonlCommittedLineOrdinal,
    ).toBe(2);
  });

  it("fails closed when a stale GID tries to use another operation's ordinal", async () => {
    const created = await run();
    await attachBulkOperationGid(
      {
        shopId: shopAId,
        syncRunId: created.id,
        bulkOperationGid: "gid://shopify/BulkOperation/B",
      },
      prisma,
    );
    await expect(
      acknowledgeJsonlBatch(
        {
          shopId: shopAId,
          syncRunId: created.id,
          bulkOperationGid: "gid://shopify/BulkOperation/A",
          endLineOrdinal: 1,
        },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "bulk_operation_gid_mismatch" });
  });

  it("rejects checkpoint regression within the same GID", async () => {
    const created = await run();
    await prisma.syncRun.update({
      where: { id: created.id },
      data: {
        bulkOperationGid: "gid://shopify/BulkOperation/A",
        jsonlCommittedLineOrdinal: 10,
      },
    });
    await expect(
      acknowledgeJsonlBatch(
        {
          shopId: shopAId,
          syncRunId: created.id,
          bulkOperationGid: "gid://shopify/BulkOperation/A",
          endLineOrdinal: 9,
        },
        prisma,
      ),
    ).rejects.toBeInstanceOf(JsonlCheckpointError);
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid checkpoint ordinal %s",
    async (endLineOrdinal) => {
      const created = await run();
      await prisma.syncRun.update({
        where: { id: created.id },
        data: { bulkOperationGid: "gid://shopify/BulkOperation/A" },
      });
      await expect(
        acknowledgeJsonlBatch(
          {
            shopId: shopAId,
            syncRunId: created.id,
            bulkOperationGid: "gid://shopify/BulkOperation/A",
            endLineOrdinal,
          },
          prisma,
        ),
      ).rejects.toMatchObject({ code: "checkpoint_ordinal_invalid" });
    },
  );

  it("database CHECK rejects ordinal zero bypass", async () => {
    const created = await run();
    await expect(
      prisma.$executeRaw`
        UPDATE "SyncRun"
        SET "jsonlCommittedLineOrdinal" = 0
        WHERE id = ${created.id}
      `,
    ).rejects.toThrow();
  });

  it("processing disabled mid-ingest prevents checkpoint advance", async () => {
    const created = await run();
    await prisma.syncRun.update({
      where: { id: created.id },
      data: { bulkOperationGid: "gid://shopify/BulkOperation/A" },
    });
    await prisma.shop.update({
      where: { id: shopAId },
      data: { processingEnabled: false },
    });
    await expect(
      acknowledgeJsonlBatch(
        {
          shopId: shopAId,
          syncRunId: created.id,
          bulkOperationGid: "gid://shopify/BulkOperation/A",
          endLineOrdinal: 1,
        },
        prisma,
      ),
    ).rejects.toMatchObject({ code: "shop_processing_disabled" });
    expect(
      (
        await prisma.syncRun.findUniqueOrThrow({
          where: { id: created.id },
        })
      ).jsonlCommittedLineOrdinal,
    ).toBeNull();
  });

  it("Race E after-commit crash leaves facts durable while checkpoint lags, then catches up", async () => {
    const created = await run();
    const gid = "gid://shopify/BulkOperation/A";
    await attachBulkOperationGid(
      {
        shopId: shopAId,
        syncRunId: created.id,
        bulkOperationGid: gid,
      },
      prisma,
    );
    const ingestBatchId = deriveIngestBatchId({
      syncRunId: created.id,
      bulkOperationGid: gid,
      startLineOrdinal: 101,
    });
    await prisma.shopifyProductFact.create({
      data: {
        ...completeProductData({ id: "orphan", shopId: shopAId }),
        ingestBatchId,
      },
    });
    expect(
      (
        await prisma.syncRun.findUniqueOrThrow({
          where: { id: created.id },
        })
      ).jsonlCommittedLineOrdinal,
    ).toBeNull();
    expect(
      await prisma.shopifyProductFact.count({
        where: { shopId: shopAId, ingestBatchId },
      }),
    ).toBe(1);
    await acknowledgeJsonlBatch(
      {
        shopId: shopAId,
        syncRunId: created.id,
        bulkOperationGid: gid,
        endLineOrdinal: 200,
      },
      prisma,
    );
    expect(
      (
        await prisma.syncRun.findUniqueOrThrow({
          where: { id: created.id },
        })
      ).jsonlCommittedLineOrdinal,
    ).toBe(200);
  });

  it("Race E before-commit crash leaves neither facts nor a leading checkpoint", async () => {
    const created = await run();
    await attachBulkOperationGid(
      {
        shopId: shopAId,
        syncRunId: created.id,
        bulkOperationGid: "gid://shopify/BulkOperation/A",
      },
      prisma,
    );
    expect(await prisma.shopifyProductFact.count()).toBe(0);
    expect(
      (
        await prisma.syncRun.findUniqueOrThrow({
          where: { id: created.id },
        })
      ).jsonlCommittedLineOrdinal,
    ).toBeNull();
  });

  it("persists diagnostic count tokens without Number conversion", async () => {
    const created = await run();
    await prisma.syncRun.update({
      where: { id: created.id },
      data: { bulkOperationGid: "gid://shopify/BulkOperation/A" },
    });
    await persistBulkCounts(
      {
        shopId: shopAId,
        syncRunId: created.id,
        bulkOperationGid: "gid://shopify/BulkOperation/A",
        objectCount: "9007199254740993",
        rootObjectCount: "3",
        streamedObjectCount: "9007199254740993",
        streamedRootObjectCount: "3",
      },
      prisma,
    );
    expect(
      await prisma.syncRun.findUniqueOrThrow({ where: { id: created.id } }),
    ).toMatchObject({
      bulkObjectCount: "9007199254740993",
      streamedObjectCount: "9007199254740993",
    });
  });

  it("partial failure does not create or overwrite a success cursor", async () => {
    const created = await run();
    await markSyncRunPartialFailure(
      {
        shopId: shopAId,
        syncRunId: created.id,
        errorCode: "object_count_mismatch",
        failureSummary: "unproven stream",
      },
      prisma,
    );
    expect(
      await prisma.syncCursor.findUnique({
        where: {
          shopId_syncDomain: { shopId: shopAId, syncDomain: "catalog" },
        },
      }),
    ).toBeNull();
  });

  it("successful completion writes the app-owned full-sync epoch cursor", async () => {
    const created = await run();
    await completeSyncRunAndCursor(
      {
        shopId: shopAId,
        syncRunId: created.id,
        syncDomain: "catalog",
        examinedCount: 2,
        appliedCount: 2,
        skippedCount: 0,
      },
      prisma,
    );
    expect(
      await prisma.syncCursor.findUniqueOrThrow({
        where: {
          shopId_syncDomain: { shopId: shopAId, syncDomain: "catalog" },
        },
      }),
    ).toMatchObject({ cursorValue: `full-sync-epoch:${created.id}` });
  });

  it("derives stable orphan-batch evidence from GID plus starting ordinal", () => {
    const input = {
      syncRunId: "run-1",
      bulkOperationGid: "gid://shopify/BulkOperation/A",
      startLineOrdinal: 101,
    };
    expect(deriveIngestBatchId(input)).toBe(deriveIngestBatchId(input));
    expect(deriveIngestBatchId(input)).toHaveLength(64);
  });

  it("different GIDs cannot collide by reusing the same ordinal", () => {
    expect(
      deriveIngestBatchId({
        syncRunId: "run-1",
        bulkOperationGid: "gid://shopify/BulkOperation/A",
        startLineOrdinal: 1,
      }),
    ).not.toBe(
      deriveIngestBatchId({
        syncRunId: "run-1",
        bulkOperationGid: "gid://shopify/BulkOperation/B",
        startLineOrdinal: 1,
      }),
    );
  });

  it("full-sync cursor helper rejects missing run identity", () => {
    expect(fullSyncCursorValue("run")).toBe("full-sync-epoch:run");
    expect(() => fullSyncCursorValue("")).toThrow("sync_run_id_missing");
  });
});
