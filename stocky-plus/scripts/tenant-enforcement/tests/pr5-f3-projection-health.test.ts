import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  writeCompatibilityProjectionState,
  type CanonicalApplyDb,
} from "../../../app/lib/catalog-facts";
import { createTenantDb } from "../../../app/tenant/tenant-db.server";
import {
  MIN_PRODUCT_REVIVAL_OBSERVATION_CYCLES,
  projectAppliedCanonicalFacts,
  recoverPendingCompatibilityProjection,
  shouldRetryCompatibilityProjection,
} from "../../../app/jobs/workers/catalog-facts/projection";
import {
  readCatalogHealthEvidence,
  reconcileCatalogDiagnostics,
} from "../../../app/jobs/workers/catalog-facts/diagnostic-reconciler";
import {
  completeProductData,
  resetF3Rows,
  setupF3Database,
} from "./pr5-f3-test-helpers";

type Authority = Awaited<ReturnType<typeof setupF3Database>>["authority"];
const NOW = new Date("2026-09-05T12:00:00Z");

describe("PR5-F3 projection pending/retry/health PostgreSQL integration", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let shopBId: string;
  let authority: Authority;

  beforeAll(async () => {
    ({ prisma, shopAId, shopBId, authority } = await setupF3Database());
  }, 120_000);

  beforeEach(async () => {
    await resetF3Rows(prisma);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function seedProduct(
    state: "PROJECTION_PENDING" | "HEALTHY" | "DEGRADED" = "PROJECTION_PENDING",
  ) {
    return prisma.shopifyProductFact.create({
      data: completeProductData({
        id: "1",
        shopId: shopAId,
        compatibilityProjectionState: state,
      }),
    });
  }

  const identity = () => ({
    shopId: shopAId,
    resourceKind: "Product" as const,
    shopifyGid: "gid://shopify/Product/1",
  });

  it("database default is PROJECTION_PENDING, never false HEALTHY", async () => {
    const data = completeProductData({ id: "1", shopId: shopAId });
    delete (data as { compatibilityProjectionState?: unknown })
      .compatibilityProjectionState;
    const row = await prisma.shopifyProductFact.create({ data });
    expect(row.compatibilityProjectionState).toBe("PROJECTION_PENDING");
  });

  it("writes HEALTHY only through the canonical advisory-lock state writer", async () => {
    await seedProduct();
    const db = createTenantDb(authority);
    await db.$transaction((tx) =>
      writeCompatibilityProjectionState(tx as unknown as CanonicalApplyDb, {
        shopId: shopAId,
        identities: [identity()],
        state: "HEALTHY",
      }),
    );
    expect(
      (await prisma.shopifyProductFact.findFirstOrThrow())
        .compatibilityProjectionState,
    ).toBe("HEALTHY");
  });

  it("fails closed if projection state targets a missing canonical identity", async () => {
    const db = createTenantDb(authority);
    await expect(
      db.$transaction((tx) =>
        writeCompatibilityProjectionState(tx as unknown as CanonicalApplyDb, {
          shopId: shopAId,
          identities: [identity()],
          state: "HEALTHY",
        }),
      ),
    ).rejects.toThrow("projection_state_fact_missing");
  });

  it("rejects a cross-shop identity before any state write", async () => {
    await seedProduct();
    const db = createTenantDb(authority);
    await expect(
      db.$transaction((tx) =>
        writeCompatibilityProjectionState(tx as unknown as CanonicalApplyDb, {
          shopId: shopAId,
          identities: [{ ...identity(), shopId: shopBId }],
          state: "HEALTHY",
        }),
      ),
    ).rejects.toThrow("projection_state_shop_mismatch");
    expect(
      (await prisma.shopifyProductFact.findFirstOrThrow())
        .compatibilityProjectionState,
    ).toBe("PROJECTION_PENDING");
  });

  it("a Product with no legacy-dependent children becomes healthy after successful projection", async () => {
    await seedProduct();
    const result = await projectAppliedCanonicalFacts({
      authority,
      canonicalIdentities: [identity()],
    });
    expect(result).toBeNull();
    expect(
      (await prisma.shopifyProductFact.findFirstOrThrow())
        .compatibilityProjectionState,
    ).toBe("HEALTHY");
  });

  it("parent-ABSENT / variant-LIVE projection fails retryably and persists DEGRADED", async () => {
    await prisma.shopifyProductFact.create({
      data: {
        ...completeProductData({
          id: "1",
          shopId: shopAId,
          compatibilityProjectionState: "HEALTHY",
        }),
        existenceState: "ABSENT",
        existenceKind: "ABSENT_CONFIRMED_QUERY",
        deletedAt: NOW,
        deletionSource: "CONFIRMED_QUERY",
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
        sourceKind: "INCREMENTAL_REFETCH",
        compatibilityProjectionState: "PROJECTION_PENDING",
      },
    });
    const result = await projectAppliedCanonicalFacts({
      authority,
      canonicalIdentities: [
        {
          shopId: shopAId,
          resourceKind: "ProductVariant",
          shopifyGid: "gid://shopify/ProductVariant/2",
        },
      ],
      completedObservationCycles: 0,
    });
    expect(result).toMatchObject({
      status: "FAILED",
      retryable: true,
      failure: { code: "canonical_product_not_live" },
    });
    expect(
      (await prisma.shopifyVariantFact.findFirstOrThrow())
        .compatibilityProjectionState,
    ).toBe("DEGRADED");
  });

  it("diagnostic lag repair recreates projection failure issue and DEGRADED health", async () => {
    await seedProduct("DEGRADED");
    const result = await reconcileCatalogDiagnostics(authority, "catalog");
    expect(result.healthState).toBe("DEGRADED");
    expect(
      await prisma.dataIssue.count({
        where: {
          reasonCode: "COMPATIBILITY_PROJECTION_FAILED",
          status: "OPEN",
        },
      }),
    ).toBe(1);
  });

  it("pending state is independently visible from failure state", async () => {
    await seedProduct("PROJECTION_PENDING");
    const evidence = await readCatalogHealthEvidence(authority, "catalog");
    expect(evidence.projectionPendingCount).toBe(1);
    expect(evidence.projectionFailedCount).toBe(0);
  });

  it("bounded recovery processes pending identities without canonical reapply", async () => {
    const before = await seedProduct("PROJECTION_PENDING");
    const result = await recoverPendingCompatibilityProjection({
      authority,
      completedObservationCycles: 0,
      limit: 1,
    });
    const after = await prisma.shopifyProductFact.findFirstOrThrow();
    expect(result).toEqual({ attempted: 1, failed: false });
    expect(after.title).toBe(before.title);
    expect(after.existenceResponseGen).toBe(before.existenceResponseGen);
    expect(after.compatibilityProjectionState).toBe("HEALTHY");
  });

  it("empty projection recovery is a no-op", async () => {
    expect(
      await recoverPendingCompatibilityProjection({
        authority,
        completedObservationCycles: 0,
      }),
    ).toEqual({ attempted: 0, failed: false });
  });

  it("processing disabled prevents projection writes", async () => {
    await seedProduct();
    await prisma.shop.update({
      where: { id: shopAId },
      data: { processingEnabled: false },
    });
    await expect(
      projectAppliedCanonicalFacts({
        authority,
        canonicalIdentities: [identity()],
      }),
    ).rejects.toThrow("shop_processing_disabled");
    expect(
      (await prisma.shopifyProductFact.findFirstOrThrow())
        .compatibilityProjectionState,
    ).toBe("PROJECTION_PENDING");
  });

  it.each([
    [0, true],
    [1, true],
    [MIN_PRODUCT_REVIVAL_OBSERVATION_CYCLES, false],
  ] as const)(
    "terminal Product retry cycle %i has expected continuation %s",
    (cycles, expected) => {
      expect(
        shouldRetryCompatibilityProjection(
          "canonical_product_not_live",
          cycles,
        ),
      ).toBe(expected);
    },
  );
});
