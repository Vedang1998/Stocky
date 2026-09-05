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
  completeProductData,
  resetF3Rows,
  setupF3Database,
} from "./pr5-f3-test-helpers";

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
      },
    });
    return {
      shopId: shopAId,
      resourceKind: "Product" as const,
      shopifyGid: `gid://shopify/Product/${id}`,
    };
  }

  it("nominates a LIVE identity omitted from a proven owning-domain epoch", async () => {
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

  it("holds every candidate when both breaker thresholds trip", async () => {
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

  it("flag OFF produces zero tombstones even after null confirmation", async () => {
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

  it("LIVE confirmation clears the nomination without a tombstone", async () => {
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

  it("inventory-level epoch does not nominate InventoryItem presence", async () => {
    await seed("product");
    const result = await nominateAbsenceCandidates({
      authority,
      domain: "inventory_levels",
      epochId: "inventory-epoch",
      fenceGeneration: 10n,
    });
    expect(result.candidateCount).toBe(0);
    expect(
      (await prisma.shopifyProductFact.findFirstOrThrow())
        .absenceNominationState,
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

  it("Product retry budget permits at least two full revival cycles", () => {
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
});
