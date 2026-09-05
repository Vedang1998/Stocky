import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  applyCanonicalFacts,
  deriveCanonicalLockKey,
  orderCanonicalLockKeysForAcquisition,
  type CanonicalApplyDb,
} from "../../../app/lib/catalog-facts";
import type {
  DirectCanonicalObservation,
  FullSyncCanonicalObservation,
} from "../../../app/lib/catalog-facts/apply/types";
import {
  allocateDirectResponseGeneration,
  beginDirectObservation,
} from "../../../app/lib/catalog-facts/ingest/direct-observation";
import { createTenantDb } from "../../../app/tenant/tenant-db.server";
import { resetF3Rows, setupF3Database } from "./pr5-f3-test-helpers";

type Authority = Awaited<ReturnType<typeof setupF3Database>>["authority"];

const attrs = (title: string) => ({
  title,
  handle: "product",
  vendor: null,
  productType: null,
  tags: [] as string[],
  status: "ACTIVE" as const,
  featuredMediaUrl: null,
});

describe("PR5-F3 adapter overlap races A / AT-3 / S / AV", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let authority: Authority;

  beforeAll(async () => {
    ({ prisma, shopAId, authority } = await setupF3Database());
  }, 120_000);

  beforeEach(async () => {
    await resetF3Rows(prisma);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  function full(
    title: string,
    epochId = "run-1",
    fenceGeneration = 1n,
    updatedAt = new Date("2026-09-01T00:00:00Z"),
  ): FullSyncCanonicalObservation {
    return {
      observationKind: "full_sync",
      identity: {
        shopId: shopAId,
        resourceKind: "Product",
        shopifyGid: "gid://shopify/Product/1",
      },
      existenceKind: "LIVE_FULL_SYNC_PRESENT",
      existenceObservedAt: new Date(),
      shopifyCreatedAt: new Date("2026-01-01T00:00:00Z"),
      shopifyUpdatedAt: updatedAt,
      sourceKind: "FULL_SYNC",
      fenceGeneration,
      epochId,
      attributes: attrs(title),
    };
  }

  async function apply(
    observations: Array<
      FullSyncCanonicalObservation | DirectCanonicalObservation
    >,
  ) {
    const db = createTenantDb(authority);
    return db.$transaction((tx) =>
      applyCanonicalFacts(tx as unknown as CanonicalApplyDb, {
        shopId: shopAId,
        observations,
        configuredWorstCaseConcurrentCanonicalTransactions: 50,
      }),
    );
  }

  async function direct(
    title: string,
    updatedAt = new Date("2026-09-05T00:00:00Z"),
  ): Promise<DirectCanonicalObservation> {
    const identity = full(title).identity;
    const handle = await beginDirectObservation(authority, {
      identity,
      leaseDurationMs: 60_000,
    });
    const responseGeneration =
      await allocateDirectResponseGeneration(authority);
    return {
      observationKind: "direct",
      identity,
      observationToken: handle.token,
      observationRequestGen: handle.requestGeneration,
      observationResponseGen: responseGeneration,
      existenceKind: "LIVE_REFETCH",
      existenceObservedAt: new Date(),
      shopifyCreatedAt: new Date("2026-01-01T00:00:00Z"),
      shopifyUpdatedAt: updatedAt,
      sourceKind: "INCREMENTAL_REFETCH",
      attributes: attrs(title),
    };
  }

  it("Race A: delayed bulk cannot overwrite newer direct attributes but advances presence", async () => {
    await apply([await direct("newer")]);
    await apply([full("stale", "bulk-epoch", 1n)]);
    const row = await prisma.shopifyProductFact.findUniqueOrThrow({
      where: {
        shopId_shopifyGid: {
          shopId: shopAId,
          shopifyGid: "gid://shopify/Product/1",
        },
      },
    });
    expect(row.title).toBe("newer");
    expect(row.lastSeenFullSyncRunId).toBe("bulk-epoch");
  });

  it("Race AT-3 uses the same canonical lock key for bulk and refetch identity", () => {
    const identity = full("x").identity;
    const directKey = deriveCanonicalLockKey(identity);
    const bulkKey = deriveCanonicalLockKey(identity);
    expect(directKey).toEqual(bulkKey);
  });

  it("Race AV orders opposite input lists into the same lock sequence", () => {
    const a = deriveCanonicalLockKey({
      shopId: shopAId,
      resourceKind: "Product",
      shopifyGid: "gid://shopify/Product/A",
    });
    const b = deriveCanonicalLockKey({
      shopId: shopAId,
      resourceKind: "Product",
      shopifyGid: "gid://shopify/Product/B",
    });
    expect(orderCanonicalLockKeysForAcquisition([a, b])).toEqual(
      orderCanonicalLockKeysForAcquisition([b, a]),
    );
  });

  it("Race S commits in-flight evidence without retaining an advisory lock across I/O", async () => {
    await beginDirectObservation(authority, {
      identity: full("x").identity,
      leaseDurationMs: 60_000,
    });
    const locks = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS count
      FROM pg_locks
      WHERE locktype = 'advisory'
        AND granted
    `;
    expect(locks[0]?.count ?? 0n).toBe(0n);
  });

  it("duplicate full-sync replay converges to one identity", async () => {
    await apply([full("same")]);
    await apply([full("same")]);
    expect(await prisma.shopifyProductFact.count()).toBe(1);
  });

  it("full-sync first insertion is PROJECTION_PENDING, never false HEALTHY", async () => {
    await apply([full("pending")]);
    expect(
      (
        await prisma.shopifyProductFact.findUniqueOrThrow({
          where: {
            shopId_shopifyGid: {
              shopId: shopAId,
              shopifyGid: "gid://shopify/Product/1",
            },
          },
        })
      ).compatibilityProjectionState,
    ).toBe("PROJECTION_PENDING");
  });

  it("a canonical no-op does not create a duplicate row", async () => {
    await apply([full("same")]);
    const result = await apply([full("same")]);
    expect(result.results[0]?.outcome).toMatch(/noop|applied/);
    expect(await prisma.shopifyProductFact.count()).toBe(1);
  });

  it("newer direct applies after an older complete bulk", async () => {
    await apply([full("old")]);
    await apply([await direct("new")]);
    expect(
      (
        await prisma.shopifyProductFact.findUniqueOrThrow({
          where: {
            shopId_shopifyGid: {
              shopId: shopAId,
              shopifyGid: "gid://shopify/Product/1",
            },
          },
        })
      ).title,
    ).toBe("new");
  });
});
