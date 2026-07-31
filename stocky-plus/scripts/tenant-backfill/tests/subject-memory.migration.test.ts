/**
 * F-N07 — large-table subject capture under constrained heap (no full ID materialization).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { captureStartingEvidence } from "../starting-snapshot";
import { recomputeSubjectEvidence } from "../subject-evidence";
import {
  createMigrationPrisma,
  prepareEmptyDatabase,
  prismaGenerate,
  setMaintenanceDatabaseUrl,
} from "./helpers";

const LARGE_ROW_COUNT = 25_000;
const BATCH_SIZE = 250;

describe("constrained-heap subject evidence (F-N07)", () => {
  const prisma = createMigrationPrisma();

  beforeAll(() => {
    prismaGenerate();
    setMaintenanceDatabaseUrl();
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("streams InventorySnapshot boundary without OOM under 256MB heap", async () => {
    // CI/local should launch this file with NODE_OPTIONS=--max-old-space-size=256
    await prepareEmptyDatabase(prisma);
    await prisma.session.create({
      data: {
        id: "sess-mem",
        shop: "mem.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });

    const started = Date.now();
    await prisma.$executeRawUnsafe(`
      INSERT INTO "InventorySnapshot" (
        id, shop, "shopifyVariantId", "locationId", "quantityAvailable", "snapshotDate"
      )
      SELECT
        'inv-mem-' || lpad(g::text, 8, '0'),
        'mem.myshopify.com',
        'var-' || g,
        'loc-1',
        1,
        DATE '2026-01-01'
      FROM generate_series(1, ${LARGE_ROW_COUNT}) AS g
    `);

    const beforeMem = process.memoryUsage().heapUsed;
    const { evidence } = await captureStartingEvidence(prisma, {
      batchSize: BATCH_SIZE,
    });
    const afterMem = process.memoryUsage().heapUsed;

    expect(evidence.tables.InventorySnapshot.rowCount).toBe(LARGE_ROW_COUNT);
    expect(evidence.tables.InventorySnapshot.highWaterMark).toBe(
      `inv-mem-${String(LARGE_ROW_COUNT).padStart(8, "0")}`,
    );

    const verified = await recomputeSubjectEvidence(
      prisma,
      "InventorySnapshot",
      evidence.tables.InventorySnapshot.highWaterMark,
      BATCH_SIZE,
    );
    expect(verified.subjectDigest).toBe(
      evidence.tables.InventorySnapshot.subjectDigest,
    );
    expect(verified.rowCount).toBe(LARGE_ROW_COUNT);

    const elapsedMs = Date.now() - started;
    const peakDeltaMb = (afterMem - beforeMem) / (1024 * 1024);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        event: "tenant_subject_evidence_memory",
        fixtureRows: LARGE_ROW_COUNT,
        batchSize: BATCH_SIZE,
        elapsedMs,
        heapUsedBeforeMb: beforeMem / (1024 * 1024),
        heapUsedAfterMb: afterMem / (1024 * 1024),
        heapDeltaMb: peakDeltaMb,
        maxOldSpaceHintMb: 256,
      }),
    );

    // Full materialization of 25k UUID-like strings repeatedly would typically
    // exceed a tight heap when combined with Prisma client; streaming must finish.
    expect(elapsedMs).toBeLessThan(180_000);
    expect(evidence.tables.InventorySnapshot.subjectDigest.length).toBe(64);
  }, 300_000);

  it("high-cardinality corrupt domain discovery stays bounded under 256MB heap (F-F02)", async () => {
    const CORRUPT_ROWS = 20_000;
    process.env.TENANT_EVIDENCE_MAX_DISCOVERY_ISSUES = "30000";
    try {
      await prepareEmptyDatabase(prisma);
      await prisma.session.create({
        data: {
          id: "sess-hc",
          shop: "hc.myshopify.com",
          state: "s",
          accessToken: "tok",
          isOnline: false,
        },
      });
      // Distinct-value count approaches row count — every shop value corrupt
      // and unique.
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Supplier" (id, shop, name, "createdAt", "updatedAt")
        SELECT
          'sup-hc-' || lpad(g::text, 8, '0'),
          'CORRUPT@@ value ' || g,
          'H' || g,
          NOW(),
          NOW()
        FROM generate_series(1, ${CORRUPT_ROWS}) AS g
      `);

      const beforeMem = process.memoryUsage().heapUsed;
      const started = Date.now();
      const first = await captureStartingEvidence(prisma, {
        batchSize: BATCH_SIZE,
      });
      const elapsedMs = Date.now() - started;
      const afterMem = process.memoryUsage().heapUsed;

      const supplier = first.evidence.domainDiscovery.perSource.Supplier!;
      expect(supplier.distinctRawShopCount).toBe(CORRUPT_ROWS);
      expect(supplier.invalidValueCount).toBe(CORRUPT_ROWS);
      expect(supplier.samples.length).toBeLessThanOrEqual(
        first.evidence.evidenceBudget.maxSamplesPerSource,
      );
      expect(supplier.samplesTruncated).toBe(true);
      expect(supplier.omittedCount).toBe(
        CORRUPT_ROWS - supplier.samples.length,
      );
      expect(first.evidence.domainDiscovery.invalidDomains.totalDetected).toBe(
        CORRUPT_ROWS,
      );
      expect(first.discoveryIssueDrafts.length).toBe(CORRUPT_ROWS);

      // No raw corrupt value in serialized evidence.
      const serialized = JSON.stringify(first.evidence);
      expect(serialized).not.toContain("CORRUPT@@");
      expect(serialized).not.toContain("CORRUPT@@ value 1");

      // Deterministic digests across captures.
      const second = await captureStartingEvidence(prisma, {
        batchSize: BATCH_SIZE,
      });
      expect(
        second.evidence.domainDiscovery.perSource.Supplier!
          .redactedEvidenceDigest,
      ).toBe(supplier.redactedEvidenceDigest);
      expect(second.evidence.domainDiscovery.invalidDomains.digest).toBe(
        first.evidence.domainDiscovery.invalidDomains.digest,
      );

      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({
          event: "tenant_domain_evidence_memory",
          fixtureRows: CORRUPT_ROWS,
          batchSize: BATCH_SIZE,
          elapsedMs,
          heapUsedBeforeMb: beforeMem / (1024 * 1024),
          heapUsedAfterMb: afterMem / (1024 * 1024),
          heapDeltaMb: (afterMem - beforeMem) / (1024 * 1024),
          maxOldSpaceHintMb: 256,
        }),
      );
    } finally {
      delete process.env.TENANT_EVIDENCE_MAX_DISCOVERY_ISSUES;
    }
  }, 300_000);
});
