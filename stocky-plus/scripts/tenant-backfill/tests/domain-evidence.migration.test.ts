/**
 * F-F02 — bounded, redacted, budgeted domain-discovery evidence.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { runTenantBackfill } from "../engine";
import { captureStartingEvidence } from "../starting-snapshot";
import {
  createMigrationPrisma,
  prepareEmptyDatabase,
  prismaGenerate,
  setMaintenanceDatabaseUrl,
} from "./helpers";

const BUDGET_ENVS = [
  "TENANT_EVIDENCE_MAX_NORMALIZED_DOMAINS",
  "TENANT_EVIDENCE_MAX_SHOPS",
  "TENANT_EVIDENCE_MAX_DISCOVERY_ISSUES",
  "TENANT_EVIDENCE_MAX_SAMPLES_PER_SOURCE",
  "TENANT_EVIDENCE_MAX_SERIALIZED_BYTES",
] as const;

describe("bounded domain-discovery evidence (F-F02)", () => {
  const prisma = createMigrationPrisma();

  beforeAll(() => {
    prismaGenerate();
    setMaintenanceDatabaseUrl();
  }, 120_000);

  afterEach(() => {
    for (const env of BUDGET_ENVS) {
      delete process.env[env];
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const RAW_VALID_FIXTURE = "UPPER-A.MYSHOPIFY.COM";
  const RAW_CORRUPT_FIXTURE = "not a domain @@1";

  async function seedMixed() {
    await prisma.session.create({
      data: {
        id: "sess-dom",
        shop: RAW_VALID_FIXTURE,
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    await prisma.supplier.create({
      data: {
        id: "sup-dom-valid",
        shop: RAW_VALID_FIXTURE,
        name: "V",
      },
    });
    await prisma.supplier.create({
      data: {
        id: "sup-dom-corrupt",
        shop: RAW_CORRUPT_FIXTURE,
        name: "C",
      },
    });
  }

  it("raw legacy domains never appear in persisted resumeMetadata", async () => {
    await prepareEmptyDatabase(prisma);
    await seedMixed();

    const result = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
    });
    expect(result.status).toBe("COMPLETED_WITH_ISSUES");

    const run = await prisma.tenantBackfillRun.findUniqueOrThrow({
      where: { id: result.runId },
    });
    const serialized = JSON.stringify(run.resumeMetadata);
    // Raw legacy spellings must be absent from durable evidence.
    expect(serialized).not.toContain(RAW_VALID_FIXTURE);
    expect(serialized).not.toContain(RAW_CORRUPT_FIXTURE);
    // Canonical normalized domain (required by the backfill) is allowed.
    expect(serialized).toContain("upper-a.myshopify.com");
    // No unbounded raw-array structure remains.
    expect(serialized).not.toContain("directOwnerRawShops");
    expect(serialized).not.toContain("invalidCandidates");

    const meta = run.resumeMetadata as {
      startingEvidence?: {
        domainDiscovery?: {
          perSource?: Record<
            string,
            {
              distinctRawShopCount: number;
              invalidValueCount: number;
              samples: Array<{
                length: number;
                sha256Prefix: string;
                normalization: string;
                normalizedDomain?: string;
              }>;
            }
          >;
          invalidDomains?: { totalDetected: number };
          validDomains?: { count: number; domains: string[] };
        };
        shopSnapshot?: { domainToShopId?: Record<string, string> };
      };
    };
    const discovery = meta.startingEvidence?.domainDiscovery;
    expect(discovery?.perSource?.Supplier?.distinctRawShopCount).toBe(2);
    expect(discovery?.perSource?.Supplier?.invalidValueCount).toBe(1);
    expect(discovery?.perSource?.Session?.distinctRawShopCount).toBe(1);
    expect(discovery?.invalidDomains?.totalDetected).toBe(1);
    expect(discovery?.validDomains?.domains).toEqual([
      "upper-a.myshopify.com",
    ]);
    for (const sample of discovery?.perSource?.Supplier?.samples ?? []) {
      expect(sample.sha256Prefix).toHaveLength(16);
      if (sample.normalization !== "valid") {
        expect(sample.normalizedDomain).toBeUndefined();
      }
    }

    // The invalid value still produced a durable, redacted issue record.
    const issues = await prisma.tenantOwnershipIssue.findMany({
      where: { reasonCode: "INVALID_SHOP_DOMAIN" },
    });
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(issues)).not.toContain(RAW_CORRUPT_FIXTURE);
  }, 180_000);

  it("aggregate counts and digests are deterministic across captures", async () => {
    await prepareEmptyDatabase(prisma);
    await seedMixed();

    const first = await captureStartingEvidence(prisma, { batchSize: 10 });
    const second = await captureStartingEvidence(prisma, { batchSize: 10 });

    expect(second.evidence.domainDiscovery.validDomains.digest).toBe(
      first.evidence.domainDiscovery.validDomains.digest,
    );
    expect(second.evidence.domainDiscovery.invalidDomains.digest).toBe(
      first.evidence.domainDiscovery.invalidDomains.digest,
    );
    expect(second.evidence.domainDiscovery.validDomains.count).toBe(
      first.evidence.domainDiscovery.validDomains.count,
    );
    for (const source of Object.keys(
      first.evidence.domainDiscovery.perSource,
    )) {
      expect(
        second.evidence.domainDiscovery.perSource[source]!
          .redactedEvidenceDigest,
      ).toBe(
        first.evidence.domainDiscovery.perSource[source]!
          .redactedEvidenceDigest,
      );
    }
  }, 180_000);

  it("sample truncation flags and omitted counts are accurate", async () => {
    process.env.TENANT_EVIDENCE_MAX_SAMPLES_PER_SOURCE = "5";
    await prepareEmptyDatabase(prisma);
    await prisma.session.create({
      data: {
        id: "sess-trunc",
        shop: "trunc.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    // 12 distinct corrupt + 3 distinct valid = 15 distinct raw values.
    for (let i = 0; i < 12; i += 1) {
      await prisma.supplier.create({
        data: {
          id: `sup-trunc-bad-${String(i).padStart(2, "0")}`,
          shop: `bad value @@${i}`,
          name: `B${i}`,
        },
      });
    }
    for (let i = 0; i < 3; i += 1) {
      await prisma.supplier.create({
        data: {
          id: `sup-trunc-good-${i}`,
          shop: `good-${i}.myshopify.com`,
          name: `G${i}`,
        },
      });
    }

    const { evidence } = await captureStartingEvidence(prisma, {
      batchSize: 10,
    });
    const supplier = evidence.domainDiscovery.perSource.Supplier!;
    expect(supplier.distinctRawShopCount).toBe(15);
    expect(supplier.invalidValueCount).toBe(12);
    expect(supplier.distinctValidNormalizedCount).toBe(3);
    expect(supplier.samples).toHaveLength(5);
    expect(supplier.samplesTruncated).toBe(true);
    expect(supplier.omittedCount).toBe(10);
    expect(evidence.evidenceBudget.maxSamplesPerSource).toBe(5);
  }, 180_000);

  it("serialized evidence-size ceiling fails closed before merchant ownership mutation", async () => {
    process.env.TENANT_EVIDENCE_MAX_SERIALIZED_BYTES = "65536";
    await prepareEmptyDatabase(prisma);
    await prisma.session.create({
      data: {
        id: "sess-size",
        shop: "size.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Supplier" (id, shop, name, "createdAt", "updatedAt")
      SELECT
        'sup-size-' || lpad(g::text, 6, '0'),
        'bulk-' || g || '.myshopify.com',
        'S' || g,
        NOW(),
        NOW()
      FROM generate_series(1, 3500) AS g
    `);

    const result = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 100,
    });
    expect(result.status).toBe("FAILED");
    expect(result.failureSummary).toMatch(/Evidence capacity exceeded/i);
    expect(result.failureSummary).toMatch(/serialized_bytes/);

    // The failure is durable and no mutation occurred.
    const run = await prisma.tenantBackfillRun.findUniqueOrThrow({
      where: { id: result.runId },
    });
    expect(run.status).toBe("FAILED");
    expect(run.failureSummary).toMatch(/serialized_bytes/);
    const mutated = await prisma.supplier.count({
      where: { shopId: { not: null } },
    });
    expect(mutated).toBe(0);
    expect(await prisma.shop.count()).toBe(0);
  }, 300_000);

  it("issue-capacity overflow fails closed with total detected count and cannot produce COMPLETED", async () => {
    process.env.TENANT_EVIDENCE_MAX_DISCOVERY_ISSUES = "10";
    await prepareEmptyDatabase(prisma);
    await prisma.session.create({
      data: {
        id: "sess-cap",
        shop: "cap.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    for (let i = 0; i < 25; i += 1) {
      await prisma.supplier.create({
        data: {
          id: `sup-cap-${String(i).padStart(2, "0")}`,
          shop: `broken @@${i}`,
          name: `X${i}`,
        },
      });
    }

    const result = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
    });
    expect(result.status).toBe("FAILED");
    expect(result.failureSummary).toMatch(/Evidence capacity exceeded/i);
    expect(result.failureSummary).toMatch(/discovery_issues/);
    expect(result.failureSummary).toMatch(/detected=25/);
    expect(result.failureSummary).toMatch(/ceiling=10/);

    const run = await prisma.tenantBackfillRun.findUniqueOrThrow({
      where: { id: result.runId },
    });
    expect(run.status).toBe("FAILED");
    // Fail closed: no partial issue set that could make a later run look clean.
    expect(await prisma.tenantOwnershipIssue.count()).toBe(0);
    const mutated = await prisma.supplier.count({
      where: { shopId: { not: null } },
    });
    expect(mutated).toBe(0);
  }, 300_000);

  it("shop ceiling fails closed before loading Shop rows", async () => {
    process.env.TENANT_EVIDENCE_MAX_SHOPS = "1";
    await prepareEmptyDatabase(prisma);
    await prisma.shop.create({
      data: { id: "shop-cap-1", myshopifyDomain: "cap-1.myshopify.com" },
    });
    await prisma.shop.create({
      data: { id: "shop-cap-2", myshopifyDomain: "cap-2.myshopify.com" },
    });
    await prisma.session.create({
      data: {
        id: "sess-shopcap",
        shop: "cap-1.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });

    const result = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
    });
    expect(result.status).toBe("FAILED");
    expect(result.failureSummary).toMatch(/Evidence capacity exceeded/i);
    expect(result.failureSummary).toMatch(/shops/);
  }, 180_000);

  it("resume fails closed when evidence limits differ and succeeds with original limits", async () => {
    await prepareEmptyDatabase(prisma);
    await prisma.session.create({
      data: {
        id: "sess-budget",
        shop: "budget.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    await prisma.supplier.create({
      data: {
        id: "sup-budget-a",
        shop: "budget.myshopify.com",
        name: "A",
      },
    });

    const interrupted = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 1,
      stopAfterBatches: 1,
    });
    expect(interrupted.status).toBe("INTERRUPTED");

    process.env.TENANT_EVIDENCE_MAX_NORMALIZED_DOMAINS = "4999";
    const mismatched = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
      resumeRunId: interrupted.runId,
    });
    expect(mismatched.status).toBe("FAILED");
    expect(mismatched.failureSummary).toMatch(
      /evidence budget limit maxNormalizedDomains/i,
    );

    delete process.env.TENANT_EVIDENCE_MAX_NORMALIZED_DOMAINS;
    const resumed = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
      resumeRunId: interrupted.runId,
    });
    expect(resumed.status).toBe("COMPLETED");
  }, 300_000);
});
