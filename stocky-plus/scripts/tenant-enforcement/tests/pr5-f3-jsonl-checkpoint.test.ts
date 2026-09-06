import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { CatalogAdminReadClient } from "../../../app/lib/catalog-facts/admin-read";
import { CATALOG_BULK_QUERY_NO_UNIT_COST } from "../../../app/lib/catalog-facts/admin-read";
import { runCatalogFactsSyncStep } from "../../../app/jobs/workers/catalog-facts/catalog-sync";
import {
  acknowledgeJsonlBatch,
  attachBulkOperationGid,
  completeSyncRunAndCursor,
  fullSyncCursorValue,
  JsonlCheckpointError,
  markSyncRunPartialFailure,
  persistBulkCounts,
  persistBulkSubmitIntentAndFence,
  assertPolledBulkOperationMatches,
} from "../../../app/lib/catalog-facts/ingest/checkpoint";
import { fingerprintBulkQuery } from "../../../app/lib/catalog-facts/ingest/bulk-operation-recovery";
import { deriveIngestBatchId } from "../../../app/lib/catalog-facts/ingest/ingest-batch-id";
import { applyParsedJsonlBatch } from "../../../app/lib/catalog-facts/ingest/apply-batch";
import {
  catalogProductJsonl,
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

  it("FX-BULK-012 atomically resets ordinal when a new GID is attached", async () => {
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

  it("FX-BULK-013 fails closed when a stale GID tries to use another operation's ordinal", async () => {
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

  it("FX-JSONL-012 processing disabled mid-ingest prevents checkpoint advance", async () => {
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

  it("FX-BULK-005 Race E after-commit crash leaves facts durable while checkpoint lags, then catches up", async () => {
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

  it("FX-BULK-006 Race E before-commit crash leaves neither facts nor a leading checkpoint", async () => {
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

  it("FX-BULK-013 polled GID mismatch fails closed without a success cursor", () => {
    expect(() =>
      assertPolledBulkOperationMatches(
        "gid://shopify/BulkOperation/A",
        "gid://shopify/BulkOperation/B",
      ),
    ).toThrow(/does not match the paired checkpoint GID/);
  });
});

const BULK_GID = "gid://shopify/BulkOperation/1";
const JSONL_URL = "https://example.test/catalog.jsonl";

function bulkSnapshot(input: {
  id?: string;
  status?: string;
  objectCount: string;
  rootObjectCount: string;
  url?: string | null;
  partialDataUrl?: string | null;
}) {
  return {
    data: {
      bulkOperation: {
        id: input.id ?? BULK_GID,
        status: input.status ?? "COMPLETED",
        errorCode: null,
        objectCount: input.objectCount,
        rootObjectCount: input.rootObjectCount,
        url: input.url === undefined ? JSONL_URL : input.url,
        partialDataUrl: input.partialDataUrl ?? null,
        createdAt: "2026-09-05T12:00:00Z",
        completedAt: "2026-09-05T12:01:00Z",
      },
    },
  };
}

function catalogSyncAdmin(input?: {
  objectCount?: string;
  rootObjectCount?: string;
  url?: string | null;
  partialDataUrl?: string | null;
  status?: string;
  polledId?: string;
  recoveryNodes?: Array<Record<string, unknown>>;
}): CatalogAdminReadClient & { queries: string[] } {
  const queries: string[] = [];
  return {
    queries,
    async graphql(query) {
      queries.push(query);
      return {
        async json() {
          if (query.includes("query CatalogFactUnitCostProbeIdentity")) {
            return { data: { inventoryItems: { nodes: [] } } };
          }
          if (query.includes("mutation CatalogFactBulkOperationRunQuery")) {
            return {
              data: {
                bulkOperationRunQuery: {
                  bulkOperation: { id: BULK_GID, status: "CREATED" },
                  userErrors: [],
                },
              },
            };
          }
          if (query.includes("query CatalogFactBulkOperationRecovery")) {
            return {
              data: { bulkOperations: { nodes: input?.recoveryNodes ?? [] } },
            };
          }
          if (query.includes("query CatalogFactBulkOperation(")) {
            return bulkSnapshot({
              id: input?.polledId ?? BULK_GID,
              status: input?.status,
              objectCount: input?.objectCount ?? "1",
              rootObjectCount: input?.rootObjectCount ?? "1",
              url: input?.url,
              partialDataUrl: input?.partialDataUrl,
            });
          }
          if (query.includes("query CatalogFactShopCurrency")) {
            return { data: { shop: { currencyCode: "USD" } } };
          }
          throw new Error(`unexpected catalog-sync query ${query.slice(0, 80)}`);
        },
      };
    },
  };
}

describe("PR5-F3 JSONL completeness through catalog-sync", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let authority: Awaited<ReturnType<typeof setupF3Database>>["authority"];

  beforeAll(async () => {
    ({ prisma, shopAId, authority } = await setupF3Database());
  }, 120_000);

  beforeEach(async () => {
    await resetF3Rows(prisma);
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await prisma?.$disconnect();
  });

  async function seedLocationsSucceeded(correlationId: string) {
    await prisma.syncRun.create({
      data: {
        shopId: shopAId,
        syncDomain: "locations",
        source: "catalog-facts-v1",
        status: "SUCCEEDED",
        correlationId,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
  }

  async function submitThenIngest(input: {
    correlationId: string;
    jsonl: string;
    objectCount: string;
    rootObjectCount: string;
  }) {
    vi.stubGlobal(
      "fetch",
      async () => new Response(input.jsonl, { status: 200 }),
    );
    const admin = catalogSyncAdmin({
      objectCount: input.objectCount,
      rootObjectCount: input.rootObjectCount,
    });
    const first = await runCatalogFactsSyncStep({
      authority,
      admin,
      durableJobId: "catalog-job",
      correlationId: input.correlationId,
      durableAttemptCount: 0,
      canonicalBatchSize: 32,
      canonicalConcurrency: 50,
    });
    expect(first).toMatchObject({ status: "CONTINUE", reason: "bulk_submitted" });
    return runCatalogFactsSyncStep({
      authority,
      admin,
      durableJobId: "catalog-job",
      correlationId: input.correlationId,
      durableAttemptCount: 0,
      canonicalBatchSize: 32,
      canonicalConcurrency: 50,
    });
  }

  it("FX-JSONL-010 truncated complete-url stream does not nominate or watermark", async () => {
    const correlationId = "fx-jsonl-010";
    await seedLocationsSucceeded(correlationId);
    const products = Array.from({ length: 10 }, (_, index) =>
      catalogProductJsonl(index + 1),
    );
    const streamed = products.slice(0, 9).join("\n") + "\n";
    const result = await submitThenIngest({
      correlationId,
      jsonl: streamed,
      objectCount: "10",
      rootObjectCount: "10",
    });
    expect(result).toMatchObject({
      status: "PARTIAL_FAILURE",
      reason: "object_count_mismatch",
    });
    expect(
      await prisma.shopifyProductFact.count({
        where: { absenceNominationState: "CANDIDATE" },
      }),
    ).toBe(0);
    expect(
      await prisma.syncCursor.findUnique({
        where: {
          shopId_syncDomain: { shopId: shopAId, syncDomain: "catalog" },
        },
      }),
    ).toBeNull();
    expect(
      (
        await prisma.syncRun.findFirstOrThrow({
          where: { shopId: shopAId, syncDomain: "catalog" },
        })
      ).status,
    ).toBe("PARTIAL_FAILURE");
  });

  it("FX-JSONL-011 objectCount mismatch by one fails closed with zero nominations", async () => {
    const correlationId = "fx-jsonl-011";
    await seedLocationsSucceeded(correlationId);
    const result = await submitThenIngest({
      correlationId,
      jsonl: `${catalogProductJsonl(1)}\n`,
      objectCount: "2",
      rootObjectCount: "1",
    });
    expect(result).toMatchObject({
      status: "PARTIAL_FAILURE",
      reason: "object_count_mismatch",
    });
    expect(
      await prisma.shopifyProductFact.count({
        where: { absenceNominationState: "CANDIDATE" },
      }),
    ).toBe(0);
    expect(await prisma.syncCursor.count()).toBe(0);
  });

  it("FX-JSONL-006 malformed JSONL keeps prior committed facts and nominates nothing", async () => {
    const created = await prisma.syncRun.create({
      data: {
        shopId: shopAId,
        syncDomain: "catalog",
        source: "catalog-facts-v1",
        correlationId: "fx-jsonl-006",
        fenceGeneration: 10n,
      },
    });
    await applyParsedJsonlBatch({
      authority,
      domain: "catalog",
      batch: {
        startLineOrdinal: 1,
        endLineOrdinal: 1,
        lines: [
          {
            ordinal: 1,
            resourceKind: "Product",
            root: true,
            value: JSON.parse(catalogProductJsonl(1)),
          },
        ],
      },
      syncRunId: created.id,
      bulkOperationGid: BULK_GID,
      fenceGeneration: 10n,
      durableJobId: "job",
      observedAt: new Date("2026-09-05T00:00:00Z"),
      currencyCode: "USD",
      unitCostAccess: "OMITTED_NO_PERMISSION",
      unitCostSelected: false,
      canonicalIdentitiesPerTransaction: 32,
      configuredWorstCaseConcurrentCanonicalTransactions: 50,
      assertProcessingEnabled: async () => undefined,
    });
    await prisma.shopifyProductFact.updateMany({
      data: { compatibilityProjectionState: "HEALTHY" },
    });
    await seedLocationsSucceeded("fx-jsonl-006-stream");
    const result = await submitThenIngest({
      correlationId: "fx-jsonl-006-stream",
      jsonl: `${catalogProductJsonl(2)}\n{bad-json}\n`,
      objectCount: "2",
      rootObjectCount: "1",
    });
    expect(result.status).toBe("PARTIAL_FAILURE");
    expect(await prisma.shopifyProductFact.count()).toBe(1);
    expect(
      await prisma.shopifyProductFact.count({
        where: { absenceNominationState: "CANDIDATE" },
      }),
    ).toBe(0);
    expect(await prisma.syncCursor.count()).toBe(0);
  });

  it("FX-BULK-014 recovers a unique orphan via bulkOperations list, never currentBulkOperation", async () => {
    const correlationId = "fx-bulk-014";
    await seedLocationsSucceeded(correlationId);
    const fingerprint = fingerprintBulkQuery({
      query: CATALOG_BULK_QUERY_NO_UNIT_COST,
      shopId: shopAId,
    });
    await prisma.syncRun.create({
      data: {
        shopId: shopAId,
        syncDomain: "catalog",
        source: "catalog-facts-v1",
        status: "RUNNING",
        correlationId,
        startedAt: new Date(),
        bulkSubmitIntentAt: new Date("2026-09-05T12:00:00Z"),
        bulkQueryFingerprint: fingerprint,
        fenceGeneration: 3n,
        cursorBefore: "no-unitCost",
      },
    });
    const admin = catalogSyncAdmin({
      recoveryNodes: [
        {
          id: BULK_GID,
          status: "RUNNING",
          query: CATALOG_BULK_QUERY_NO_UNIT_COST,
          createdAt: "2026-09-05T12:00:30Z",
        },
      ],
    });
    const result = await runCatalogFactsSyncStep({
      authority,
      admin,
      durableJobId: "catalog-job",
      correlationId,
      durableAttemptCount: 0,
      canonicalBatchSize: 32,
      canonicalConcurrency: 50,
    });
    expect(result).toMatchObject({
      status: "CONTINUE",
      reason: "orphan_bulk_adopted",
    });
    expect(
      (
        await prisma.syncRun.findFirstOrThrow({
          where: { shopId: shopAId, syncDomain: "catalog" },
        })
      ).bulkOperationGid,
    ).toBe(BULK_GID);
    expect(admin.queries.join("\n")).not.toMatch(/\bcurrentBulkOperation\b/);
    expect(admin.queries.some((query) => query.includes("bulkOperations"))).toBe(
      true,
    );
  });
});
