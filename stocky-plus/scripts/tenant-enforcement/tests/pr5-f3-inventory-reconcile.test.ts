import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { CatalogAdminReadClient } from "../../../app/lib/catalog-facts/admin-read";
import {
  readCatalogHealthEvidence,
  reconcileCatalogDiagnostics,
} from "../../../app/jobs/workers/catalog-facts/diagnostic-reconciler";
import { runInventoryStateReconcileStep } from "../../../app/jobs/workers/catalog-facts/catalog-sync";
import { executionStrategyForJobType } from "../../../app/sync/execution-strategy.server";
import { resetF3Rows, setupF3Database } from "./pr5-f3-test-helpers";

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
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function seedLevel(input?: {
    available?: number | null;
    projection?: "PROJECTION_PENDING" | "HEALTHY" | "DEGRADED";
    diagnostic?: string | null;
  }) {
    await prisma.shopifyProductFact.create({
      data: {
        id: "p",
        shopId: shopAId,
        shopifyGid: "gid://shopify/Product/1",
        title: "P",
        handle: "p",
        tags: [],
        status: "ACTIVE",
        existenceState: "LIVE",
        existenceKind: "LIVE_REFETCH",
        existenceObservedAt: NOW,
        sourceKind: "RECONCILE",
      },
    });
    await prisma.shopifyVariantFact.create({
      data: {
        id: "v",
        shopId: shopAId,
        shopifyGid: "gid://shopify/ProductVariant/2",
        shopifyProductGid: "gid://shopify/Product/1",
        title: "V",
        selectedOptions: [{ name: "Title", value: "Default" }],
        priceAmount: "1",
        currencyCode: "USD",
        existenceState: "LIVE",
        existenceKind: "LIVE_REFETCH",
        existenceObservedAt: NOW,
        sourceKind: "RECONCILE",
      },
    });
    await prisma.shopifyInventoryItemFact.create({
      data: {
        id: "i",
        shopId: shopAId,
        shopifyGid: "gid://shopify/InventoryItem/3",
        shopifyVariantGid: "gid://shopify/ProductVariant/2",
        tracked: true,
        requiresShipping: true,
        unitCostAccess: "NULL",
        existenceState: "LIVE",
        existenceKind: "LIVE_REFETCH",
        existenceObservedAt: NOW,
        sourceKind: "RECONCILE",
      },
    });
    await prisma.shopifyLocationFact.create({
      data: {
        id: "l",
        shopId: shopAId,
        shopifyGid: "gid://shopify/Location/5",
        name: "L",
        isActive: true,
        fulfillsOnlineOrders: true,
        shipsInventory: true,
        isFulfillmentService: false,
        hasActiveInventory: true,
        existenceState: "LIVE",
        existenceKind: "LIVE_REFETCH",
        existenceObservedAt: NOW,
        sourceKind: "RECONCILE",
      },
    });
    await prisma.shopifyInventoryLevelFact.create({
      data: {
        id: "level",
        shopId: shopAId,
        inventoryItemGid: "gid://shopify/InventoryItem/3",
        locationGid: "gid://shopify/Location/5",
        isActive: true,
        availableQuantity: input && "available" in input ? input.available : 5,
        existenceState: "LIVE",
        existenceKind: "LIVE_REFETCH",
        existenceObservedAt: NOW,
        sourceKind: "RECONCILE",
        compatibilityProjectionState: input?.projection ?? "HEALTHY",
        existenceDiagnosticState: input?.diagnostic ?? null,
      },
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
});
