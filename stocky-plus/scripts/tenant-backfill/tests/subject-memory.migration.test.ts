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
    const evidence = await captureStartingEvidence(prisma, {
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
});
