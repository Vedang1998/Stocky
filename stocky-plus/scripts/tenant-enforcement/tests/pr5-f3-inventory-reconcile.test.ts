import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { CatalogAdminReadClient } from "../../../app/lib/catalog-facts/admin-read";
import {
  readCatalogHealthEvidence,
  reconcileCatalogDiagnostics,
} from "../../../app/jobs/workers/catalog-facts/diagnostic-reconciler";
import { runInventoryStateReconcileStep } from "../../../app/jobs/workers/catalog-facts/catalog-sync";
import { applyParsedJsonlBatch } from "../../../app/lib/catalog-facts/ingest/apply-batch";
import { executionStrategyForJobType } from "../../../app/sync/execution-strategy.server";
import {
  completeInventoryItemData,
  completeInventoryLevelData,
  completeLocationData,
  completeProductData,
  completeVariantData,
  eightQuantities,
  resetF3Rows,
  setupF3Database,
} from "./pr5-f3-test-helpers";

type Authority = Awaited<ReturnType<typeof setupF3Database>>["authority"];
const NOW = new Date("2026-09-05T12:00:00Z");

describe("PR5-F3 bounded inventory reconcile and health honesty", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let authority: Authority;

  beforeAll(async () => {
    ({ prisma, shopAId, authority } = await setupF3Database());
  }, 120_000);

  beforeEach(async () => {
    delete process.env.FEATURE_PR5_ABSENCE_TOMBSTONE;
    await resetF3Rows(prisma);
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await prisma?.$disconnect();
  });

  async function seedLevel(input?: {
    available?: number | null;
    projection?: "PROJECTION_PENDING" | "HEALTHY" | "DEGRADED";
    diagnostic?: string | null;
  }) {
    await prisma.shopifyProductFact.create({
      data: completeProductData({ id: "1", shopId: shopAId }),
    });
    await prisma.shopifyVariantFact.create({
      data: completeVariantData({ id: "2", shopId: shopAId }),
    });
    await prisma.shopifyInventoryItemFact.create({
      data: completeInventoryItemData({ id: "3", shopId: shopAId }),
    });
    await prisma.shopifyLocationFact.create({
      data: completeLocationData({ id: "5", shopId: shopAId }),
    });
    await prisma.shopifyInventoryLevelFact.create({
      data: completeInventoryLevelData({
        shopId: shopAId,
        available: input && "available" in input ? input.available : 5,
        compatibilityProjectionState: input?.projection ?? "HEALTHY",
        existenceDiagnosticState: input?.diagnostic ?? null,
        sourceKind: "RECONCILE",
      }),
    });
  }

  async function successfulRun() {
    return prisma.syncRun.create({
      data: {
        shopId: shopAId,
        syncDomain: "inventory_levels",
        source: "inventory-state-reconcile",
        correlationId: "reconcile",
        status: "SUCCEEDED",
        completedAt: NOW,
      },
    });
  }

  it("declares inventory-state-reconcile rebuildable and bounded by PR4 lifecycle", () => {
    expect(executionStrategyForJobType("inventory-state-reconcile")).toBe(
      "REBUILDABLE_IDEMPOTENT",
    );
  });

  it("unknown authoritative available quantity degrades health", async () => {
    await seedLevel({ available: null });
    await successfulRun();
    const result = await reconcileCatalogDiagnostics(
      authority,
      "inventory_levels",
    );
    expect(result.evidence.unknownAuthoritativeQuantityCount).toBe(1);
    expect(result.healthState).toBe("DEGRADED");
  });

  it("true canonical zero is not counted as unknown", async () => {
    await seedLevel({ available: 0 });
    const evidence = await readCatalogHealthEvidence(
      authority,
      "inventory_levels",
    );
    expect(evidence.unknownAuthoritativeQuantityCount).toBe(0);
  });

  it("projection pending and projection failure are distinct evidence", async () => {
    await seedLevel({ projection: "PROJECTION_PENDING" });
    let evidence = await readCatalogHealthEvidence(
      authority,
      "inventory_levels",
    );
    expect(evidence).toMatchObject({
      projectionPendingCount: 1,
      projectionFailedCount: 0,
    });
    await prisma.shopifyInventoryLevelFact.update({
      where: { id: "level" },
      data: { compatibilityProjectionState: "DEGRADED" },
    });
    evidence = await readCatalogHealthEvidence(authority, "inventory_levels");
    expect(evidence).toMatchObject({
      projectionPendingCount: 0,
      projectionFailedCount: 1,
    });
  });

  it("diagnostic reconciler recreates a missing DataIssue after a crash boundary", async () => {
    await seedLevel({ projection: "DEGRADED" });
    expect(await prisma.dataIssue.count()).toBe(0);
    await reconcileCatalogDiagnostics(authority, "inventory_levels");
    expect(
      await prisma.dataIssue.count({
        where: {
          reasonCode: "COMPATIBILITY_PROJECTION_FAILED",
          status: "OPEN",
        },
      }),
    ).toBe(1);
  });

  it("diagnostic reconciler closes the issue after merchant state recovers", async () => {
    await seedLevel({ projection: "DEGRADED" });
    await reconcileCatalogDiagnostics(authority, "inventory_levels");
    await prisma.shopifyInventoryLevelFact.update({
      where: { id: "level" },
      data: { compatibilityProjectionState: "HEALTHY" },
    });
    await reconcileCatalogDiagnostics(authority, "inventory_levels");
    expect(
      await prisma.dataIssue.count({
        where: {
          reasonCode: "COMPATIBILITY_PROJECTION_FAILED",
          status: "RESOLVED",
        },
      }),
    ).toBe(1);
  });

  it("flag OFF keeps deletion reconciliation non-healthy after a succeeded run", async () => {
    await seedLevel({ available: 1 });
    await successfulRun();
    const result = await reconcileCatalogDiagnostics(
      authority,
      "inventory_levels",
    );
    expect(result.evidence.absenceUncertaintyCount).toBeGreaterThan(0);
    expect(result.healthState).toBe("DEGRADED");
  });

  it("disabled processing outranks all other health states", async () => {
    await seedLevel({ projection: "DEGRADED" });
    await prisma.shop.update({
      where: { id: shopAId },
      data: { processingEnabled: false },
    });
    const result = await reconcileCatalogDiagnostics(
      authority,
      "inventory_levels",
    );
    expect(result.healthState).toBe("DISABLED");
  });

  it("defers reconcile before Shopify I/O while webhook-class work is pending", async () => {
    await prisma.durableJob.create({
      data: {
        shopId: shopAId,
        jobType: "webhook:inventory_levels/update",
        source: "webhook:inventory_levels/update",
        queueName: "stocky-webhooks",
        payloadSchemaVersion: "webhook-projection-inventory-levels-update-v1",
        sanitizedPayload: {},
        payloadDigest: "a".repeat(64),
        idempotencyKey: "webhook-backlog",
        correlationId: "webhook-backlog",
        authorityVersion: "tenant-job-envelope-v3",
        executionStrategy: "ATOMIC_APPLICATION_RECEIPT",
      },
    });
    let calls = 0;
    const mockAdmin: CatalogAdminReadClient = {
      async graphql() {
        calls += 1;
        throw new Error("must not call Shopify while deferred");
      },
    };
    const result = await runInventoryStateReconcileStep({
      authority,
      admin: mockAdmin,
      durableJobId: "reconcile-job",
      correlationId: "reconcile-job",
      canonicalBatchSize: 32,
      canonicalConcurrency: 50,
    });
    expect(result).toMatchObject({
      status: "CONTINUE",
      reason: "webhook_backlog_preferred",
    });
    expect(calls).toBe(0);
  });

  async function applyLevelJsonl(quantities: ReturnType<typeof eightQuantities>) {
    return applyParsedJsonlBatch({
      authority,
      domain: "inventory_levels",
      batch: {
        startLineOrdinal: 1,
        endLineOrdinal: 1,
        lines: [
          {
            ordinal: 1,
            resourceKind: "InventoryLevel",
            root: false,
            value: {
              id: "gid://shopify/InventoryLevel/4",
              item: { id: "gid://shopify/InventoryItem/3" },
              location: { id: "gid://shopify/Location/5" },
              isActive: true,
              createdAt: "2026-09-01T00:00:00Z",
              updatedAt: "2026-09-05T10:00:00Z",
              quantities,
            },
          },
        ],
      },
      syncRunId: "reconcile-run",
      bulkOperationGid: "gid://shopify/BulkOperation/rec",
      fenceGeneration: 10n,
      durableJobId: "reconcile-job",
      observedAt: NOW,
      currencyCode: "USD",
      unitCostAccess: "QUERY_ERROR_ISOLATED",
      unitCostSelected: false,
      canonicalIdentitiesPerTransaction: 32,
      configuredWorstCaseConcurrentCanonicalTransactions: 50,
      assertProcessingEnabled: async () => undefined,
    });
  }

  it("FX-REC-001 reconcile/bulk corrects committed without an inventory_levels/update webhook", async () => {
    await seedLevel({ available: 5 });
    await applyLevelJsonl(eightQuantities({ available: 5, committed: 42 }));
    const level = await prisma.shopifyInventoryLevelFact.findFirstOrThrow();
    expect(level.committedQuantity).toBe(42);
    expect(level.availableQuantity).toBe(5);
  });

  it("FX-REC-002 keeps available, on_hand, and incoming as distinct quantities", async () => {
    await seedLevel();
    await applyLevelJsonl(
      eightQuantities({ available: 11, onHand: 22, incoming: 33, committed: 4 }),
    );
    const level = await prisma.shopifyInventoryLevelFact.findFirstOrThrow();
    expect(level.availableQuantity).toBe(11);
    expect(level.onHandQuantity).toBe(22);
    expect(level.incomingQuantity).toBe(33);
  });

  it("FX-REC-003 stale reconcile older per-name updatedAt does not rewind", async () => {
    await seedLevel();
    await applyLevelJsonl(
      eightQuantities({
        available: 8,
        committed: 9,
        updatedAt: "2026-09-05T12:00:00Z",
        committedUpdatedAt: "2026-09-05T12:00:00Z",
      }),
    );
    await applyLevelJsonl(
      eightQuantities({
        available: 1,
        committed: 1,
        updatedAt: "2026-09-01T00:00:00Z",
        committedUpdatedAt: "2026-09-01T00:00:00Z",
      }),
    );
    const level = await prisma.shopifyInventoryLevelFact.findFirstOrThrow();
    expect(level.availableQuantity).toBe(8);
    expect(level.committedQuantity).toBe(9);
  });

  it("FX-REC-004 inventory reconcile Shopify reads are O(bulk operations), not O(variants×locations)", async () => {
    await seedLevel();
    await prisma.shopifyLocationFact.create({
      data: {
        ...completeLocationData({
          id: "6",
          shopId: shopAId,
          compatibilityProjectionState: "HEALTHY",
        }),
        id: "l2",
        name: "L2",
        sourceKind: "RECONCILE",
      },
    });
    await prisma.syncRun.create({
      data: {
        shopId: shopAId,
        syncDomain: "inventory_levels",
        source: "catalog-facts-v1",
        status: "RUNNING",
        correlationId: "fx-rec-004",
        startedAt: NOW,
        bulkOperationGid: "gid://shopify/BulkOperation/rec004",
        fenceGeneration: 10n,
      },
    });
    const jsonl = [
      JSON.stringify({ id: "gid://shopify/InventoryItem/3" }),
      JSON.stringify({
        id: "gid://shopify/InventoryLevel/4",
        item: { id: "gid://shopify/InventoryItem/3" },
        location: { id: "gid://shopify/Location/5" },
        isActive: true,
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-05T10:00:00Z",
        quantities: eightQuantities({ available: 5, committed: 7 }),
      }),
      JSON.stringify({
        id: "gid://shopify/InventoryLevel/5",
        item: { id: "gid://shopify/InventoryItem/3" },
        location: { id: "gid://shopify/Location/6" },
        isActive: true,
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-05T10:00:00Z",
        quantities: eightQuantities({ available: 6, committed: 8 }),
      }),
    ].join("\n") + "\n";
    const queries: string[] = [];
    vi.stubGlobal("fetch", async () => new Response(jsonl, { status: 200 }));
    const mockAdmin: CatalogAdminReadClient = {
      async graphql(query) {
        queries.push(query);
        return {
          async json() {
            if (query.includes("query CatalogFactBulkOperation(")) {
              return {
                data: {
                  bulkOperation: {
                    id: "gid://shopify/BulkOperation/rec004",
                    status: "COMPLETED",
                    errorCode: null,
                    objectCount: "3",
                    rootObjectCount: "1",
                    url: "https://example.test/levels.jsonl",
                    partialDataUrl: null,
                    createdAt: "2026-09-05T12:00:00Z",
                    completedAt: "2026-09-05T12:01:00Z",
                  },
                },
              };
            }
            throw new Error(`unexpected ${query.slice(0, 80)}`);
          },
        };
      },
    };
    const result = await runInventoryStateReconcileStep({
      authority,
      admin: mockAdmin,
      durableJobId: "reconcile-job",
      correlationId: "fx-rec-004",
      canonicalBatchSize: 32,
      canonicalConcurrency: 50,
    });
    expect(result.status).toBe("SUCCEEDED");
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain("query CatalogFactBulkOperation(");
    expect(queries.join("\n")).not.toMatch(/\bcurrentBulkOperation\b/);
    expect(await prisma.shopifyInventoryLevelFact.count()).toBe(2);
  });
});
