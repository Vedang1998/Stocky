import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  confirmAbsenceCandidates,
  nominateAbsenceCandidates,
} from "../../../app/jobs/workers/catalog-facts/absence";
import {
  MIN_PRODUCT_REVIVAL_OBSERVATION_CYCLES,
  shouldRetryCompatibilityProjection,
} from "../../../app/jobs/workers/catalog-facts/projection";
import {
  completeInventoryItemData,
  completeLocationData,
  completeProductData,
  completeVariantData,
  resetF3Rows,
  setupF3Database,
} from "./pr5-f3-test-helpers";
import {
  applyCanonicalFacts,
  type CanonicalApplyDb,
} from "../../../app/lib/catalog-facts";
import { createTenantDb } from "../../../app/tenant/tenant-db.server";
import {
  allocateDirectResponseGeneration,
  beginDirectObservation,
} from "../../../app/lib/catalog-facts/ingest/direct-observation";

type Authority = Awaited<ReturnType<typeof setupF3Database>>["authority"];

describe("PR5-F3 absence nomination, breaker, confirmation, and flag gate", () => {
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

  async function seed(
    id: string,
    options?: { seen?: string | null; requestGen?: bigint | null },
  ) {
    await prisma.shopifyProductFact.create({
      data: {
        ...completeProductData({ id, shopId: shopAId }),
        lastSeenFullSyncRunId: options?.seen ?? null,
        existenceRequestGen:
          options?.requestGen === undefined ? 1n : options.requestGen,
        existenceResponseGen:
          options?.requestGen === undefined ? 2n : options.requestGen + 1n,
      },
    });
    return {
      shopId: shopAId,
      resourceKind: "Product" as const,
      shopifyGid: `gid://shopify/Product/${id}`,
    };
  }

  it("FX-ABS-001 nominates a LIVE identity omitted from a proven owning-domain epoch", async () => {
    await seed("1");
    const result = await nominateAbsenceCandidates({
      authority,
      domain: "catalog",
      epochId: "epoch",
      fenceGeneration: 10n,
    });
    expect(result.nominatedCount).toBe(1);
    expect(
      (await prisma.shopifyProductFact.findFirstOrThrow())
        .absenceNominationState,
    ).toBe("CANDIDATE");
  });

  it("does not nominate a Product observed in the same epoch", async () => {
    await seed("1", { seen: "epoch" });
    const result = await nominateAbsenceCandidates({
      authority,
      domain: "catalog",
      epochId: "epoch",
      fenceGeneration: 10n,
    });
    expect(result.candidateCount).toBe(0);
  });

  it("does not nominate a post-fence LIVE observation", async () => {
    await seed("1", { requestGen: 11n });
    const result = await nominateAbsenceCandidates({
      authority,
      domain: "catalog",
      epochId: "epoch",
      fenceGeneration: 10n,
    });
    expect(result.candidateCount).toBe(0);
  });

  it("FX-LOC-004 / Race V holds every candidate when both breaker thresholds trip", async () => {
    await seed("1");
    await seed("2");
    const result = await nominateAbsenceCandidates({
      authority,
      domain: "catalog",
      epochId: "epoch",
      fenceGeneration: 10n,
      breakerAbsoluteCount: 1,
      breakerProportionBps: 1,
    });
    expect(result.circuitBreakerHeldCount).toBe(2);
    expect(
      await prisma.shopifyProductFact.count({
        where: { absenceNominationState: "CIRCUIT_BREAKER_HELD" },
      }),
    ).toBe(2);
  });

  it("does not trip when only the proportion threshold is exceeded", async () => {
    await seed("1");
    const result = await nominateAbsenceCandidates({
      authority,
      domain: "catalog",
      epochId: "epoch",
      fenceGeneration: 10n,
      breakerAbsoluteCount: 2,
      breakerProportionBps: 1,
    });
    expect(result.nominatedCount).toBe(1);
    expect(result.circuitBreakerHeldCount).toBe(0);
  });

  it("FX-ABS-FLAG-OFF produces zero tombstones even after null confirmation", async () => {
    const identity = await seed("1");
    const apply = vi.fn();
    const result = await confirmAbsenceCandidates({
      authority,
      identities: [identity],
      confirm: async () => "ABSENT",
      applyConfirmedAbsence: apply,
    });
    expect(result).toMatchObject({ tombstoned: 0, heldByFlag: 1 });
    expect(apply).not.toHaveBeenCalled();
    expect(
      (await prisma.shopifyProductFact.findFirstOrThrow()).existenceState,
    ).toBe("LIVE");
  });

  it("FX-ABS-001 LIVE confirmation clears the nomination without a tombstone", async () => {
    const identity = await seed("1");
    await nominateAbsenceCandidates({
      authority,
      domain: "catalog",
      epochId: "epoch",
      fenceGeneration: 10n,
    });
    const result = await confirmAbsenceCandidates({
      authority,
      identities: [identity],
      confirm: async () => "LIVE",
      applyConfirmedAbsence: async () => {
        throw new Error("must not apply absence");
      },
    });
    expect(result.live).toBe(1);
    expect(
      (await prisma.shopifyProductFact.findFirstOrThrow())
        .absenceNominationState,
    ).toBe("NONE");
  });

  it("query failure is not absence and keeps candidate evidence", async () => {
    const identity = await seed("1");
    await nominateAbsenceCandidates({
      authority,
      domain: "catalog",
      epochId: "epoch",
      fenceGeneration: 10n,
    });
    const result = await confirmAbsenceCandidates({
      authority,
      identities: [identity],
      confirm: async () => "FAILED",
      applyConfirmedAbsence: async () => undefined,
    });
    expect(result.failed).toBe(1);
    expect(
      (await prisma.shopifyProductFact.findFirstOrThrow())
        .absenceNominationState,
    ).toBe("CANDIDATE");
  });

  it("authorized-gate seam invokes confirmed absence only after the final check", async () => {
    const identity = await seed("1");
    let gateChecked = false;
    const apply = vi.fn(async () => {
      expect(gateChecked).toBe(true);
    });
    const result = await confirmAbsenceCandidates({
      authority,
      identities: [identity],
      confirm: async () => "ABSENT",
      tombstoneGate: () => {
        gateChecked = true;
        return true;
      },
      applyConfirmedAbsence: apply,
    });
    expect(result.tombstoned).toBe(1);
    expect(apply).toHaveBeenCalledOnce();
  });

  it("FX-ABS-003 inventory-level epoch does not nominate InventoryItem presence", async () => {
    await prisma.shopifyProductFact.create({
      data: completeProductData({ id: "1", shopId: shopAId }),
    });
    await prisma.shopifyVariantFact.create({
      data: completeVariantData({ id: "2", shopId: shopAId }),
    });
    await prisma.shopifyInventoryItemFact.create({
      data: completeInventoryItemData({ id: "3", shopId: shopAId }),
    });
    const result = await nominateAbsenceCandidates({
      authority,
      domain: "inventory_levels",
      epochId: "inventory-epoch",
      fenceGeneration: 10n,
    });
    expect(result.candidateCount).toBe(0);
    expect(
      (
        await prisma.shopifyInventoryItemFact.findFirstOrThrow()
      ).absenceNominationState,
    ).toBe("NONE");
  });

  it("deletion reconciliation never reports healthy from nomination alone", async () => {
    await seed("1");
    const result = await nominateAbsenceCandidates({
      authority,
      domain: "catalog",
      epochId: "epoch",
      fenceGeneration: 10n,
    });
    expect(result.deletionReconciliationHealthy).toBe(false);
  });

  it("NEW-CLAUDE-F2CCM-01 Product retry budget permits at least two full revival cycles", () => {
    expect(MIN_PRODUCT_REVIVAL_OBSERVATION_CYCLES).toBeGreaterThanOrEqual(2);
    expect(
      shouldRetryCompatibilityProjection("canonical_product_not_live", 0),
    ).toBe(true);
    expect(
      shouldRetryCompatibilityProjection("canonical_product_not_live", 1),
    ).toBe(true);
    expect(
      shouldRetryCompatibilityProjection("canonical_product_not_live", 2),
    ).toBe(false);
  });

  it("FX-LOC-002 does not nominate a LIVE location whose existenceRequestGen exceeds the fence", async () => {
    await prisma.shopifyLocationFact.create({
      data: completeLocationData({
        id: "5",
        shopId: shopAId,
        requestGen: 11n,
      }),
    });
    const result = await nominateAbsenceCandidates({
      authority,
      domain: "locations",
      epochId: "locations-epoch",
      fenceGeneration: 10n,
    });
    expect(result.nominatedCount).toBe(0);
    expect(
      (await prisma.shopifyLocationFact.findFirstOrThrow())
        .absenceNominationState,
    ).toBe("NONE");
  });

  it("FX-ABS-002 confirmed Product absence is not revived by an older bulk line", async () => {
    const now = new Date("2026-09-05T00:00:00Z");
    await prisma.shopifyProductFact.create({
      data: {
        ...completeProductData({ id: "1", shopId: shopAId }),
        existenceState: "ABSENT",
        existenceKind: "ABSENT_CONFIRMED_QUERY",
        deletedAt: now,
        deletionSource: "CONFIRMED_QUERY",
        shopifyCreatedAt: new Date("2026-01-01T00:00:00Z"),
        shopifyUpdatedAt: now,
      },
    });
    const db = createTenantDb(authority);
    await db.$transaction((tx) =>
      applyCanonicalFacts(tx as unknown as CanonicalApplyDb, {
        shopId: shopAId,
        observations: [
          {
            observationKind: "full_sync",
            identity: {
              shopId: shopAId,
              resourceKind: "Product",
              shopifyGid: "gid://shopify/Product/1",
            },
            existenceKind: "LIVE_FULL_SYNC_PRESENT",
            existenceObservedAt: now,
            shopifyCreatedAt: new Date("2026-01-01T00:00:00Z"),
            shopifyUpdatedAt: new Date("2026-08-01T00:00:00Z"),
            sourceKind: "FULL_SYNC",
            fenceGeneration: 1n,
            epochId: "stale-bulk",
            attributes: {
              title: "stale bulk",
              handle: "product-1",
              vendor: null,
              productType: null,
              tags: [],
              status: "ACTIVE",
              featuredMediaUrl: null,
            },
          },
        ],
        configuredWorstCaseConcurrentCanonicalTransactions: 50,
      }),
    );
    expect(
      (
        await prisma.shopifyProductFact.findFirstOrThrow()
      ).existenceState,
    ).toBe("ABSENT");
  });

  it("NEW-CLAUDE-F2CCM-01 requires two non-overlapping LIVE confirmations to revive a Product", async () => {
    const now = new Date("2026-09-05T00:00:00Z");
    await prisma.shopifyProductFact.create({
      data: {
        ...completeProductData({ id: "1", shopId: shopAId }),
        existenceState: "ABSENT",
        existenceKind: "ABSENT_CONFIRMED_QUERY",
        deletedAt: now,
        deletionSource: "CONFIRMED_QUERY",
        existenceRequestGen: 1n,
        existenceResponseGen: 2n,
        shopifyCreatedAt: new Date("2026-01-01T00:00:00Z"),
      },
    });
    const identity = {
      shopId: shopAId,
      resourceKind: "Product" as const,
      shopifyGid: "gid://shopify/Product/1",
    };
    // Consume the tombstone interval {1,2} so the first LIVE confirmation is a
    // later non-overlapping observation (NEW-CLAUDE-F2CCM-01 / Race AB).
    await allocateDirectResponseGeneration(authority);
    await allocateDirectResponseGeneration(authority);
    async function liveRefetch(title: string) {
      const handle = await beginDirectObservation(authority, {
        identity,
        leaseDurationMs: 60_000,
      });
      const responseGeneration =
        await allocateDirectResponseGeneration(authority);
      const db = createTenantDb(authority);
      return db.$transaction((tx) =>
        applyCanonicalFacts(tx as unknown as CanonicalApplyDb, {
          shopId: shopAId,
          observations: [
            {
              observationKind: "direct",
              identity,
              observationToken: handle.token,
              observationRequestGen: handle.requestGeneration,
              observationResponseGen: responseGeneration,
              existenceKind: "LIVE_REFETCH",
              existenceObservedAt: now,
              shopifyCreatedAt: new Date("2026-01-01T00:00:00Z"),
              shopifyUpdatedAt: now,
              sourceKind: "INCREMENTAL_REFETCH",
              attributes: {
                title,
                handle: "product-1",
                vendor: null,
                productType: null,
                tags: [],
                status: "ACTIVE",
                featuredMediaUrl: null,
              },
            },
          ],
          configuredWorstCaseConcurrentCanonicalTransactions: 50,
        }),
      );
    }
    await liveRefetch("first confirmation");
    const afterFirst = await prisma.shopifyProductFact.findFirstOrThrow();
    expect(afterFirst.existenceState).toBe("ABSENT");
    expect(afterFirst.existenceDiagnosticState).toMatch(
      /^TERMINAL_IDENTITY_REVIVAL_CONFLICT:/,
    );
    await liveRefetch("second confirmation");
    expect(
      (await prisma.shopifyProductFact.findFirstOrThrow()).existenceState,
    ).toBe("LIVE");
  });
});
