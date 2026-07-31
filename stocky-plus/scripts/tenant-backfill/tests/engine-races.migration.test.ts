/**
 * R11 — full-engine affected-row races via separate PostgreSQL sessions.
 */
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { issueFingerprint } from "../checksum";
import { runTenantBackfill } from "../engine";
import {
  createMigrationPrisma,
  DATABASE_URL,
  prepareEmptyDatabase,
  prismaGenerate,
  setMaintenanceDatabaseUrl,
} from "./helpers";

describe("full-engine affected-row races (R11)", () => {
  const prisma = createMigrationPrisma();

  beforeAll(() => {
    prismaGenerate();
    setMaintenanceDatabaseUrl();
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedRaceRow() {
    await prisma.session.create({
      data: {
        id: "sess-race",
        shop: "race-a.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    await prisma.session.create({
      data: {
        id: "sess-race-b",
        shop: "race-b.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    // Materialize shops first.
    await runTenantBackfill({ prisma, mode: "apply", batchSize: 10 });
    await prisma.supplier.create({
      data: {
        id: "sup-race-null",
        shop: "race-a.myshopify.com",
        name: "Race",
        shopId: null,
      },
    });
    const shops = await prisma.shop.findMany({
      select: { id: true, myshopifyDomain: true },
    });
    const expected = shops.find((s) => s.myshopifyDomain === "race-a.myshopify.com");
    const other = shops.find((s) => s.myshopifyDomain === "race-b.myshopify.com");
    if (!expected || !other) throw new Error("shops missing");
    return { expectedShopId: expected.id, otherShopId: other.id };
  }

  it("matching race: concurrently_resolved, unchanged count, no issue", async () => {
    await prepareEmptyDatabase(prisma);
    const { expectedShopId } = await seedRaceRow();

    const raceClient = new Client({ connectionString: DATABASE_URL });
    await raceClient.connect();
    await raceClient.query(`SET lock_timeout = '5s'`);
    await raceClient.query(`SET statement_timeout = '30s'`);
    try {
      const result = await runTenantBackfill({
        prisma,
        mode: "apply",
        batchSize: 10,
        onBeforeShopIdUpdate: async ({ table, rowId, expectedShopId: expected }) => {
          if (table === "Supplier" && rowId === "sup-race-null") {
            await raceClient.query(
              `UPDATE "Supplier" SET "shopId" = $1 WHERE id = $2 AND "shopId" IS NULL`,
              [expected, rowId],
            );
            expect(expected).toBe(expectedShopId);
          }
        },
      });

      expect(result.status).toBe("COMPLETED");
      expect(result.updatedCounts.Supplier ?? 0).toBe(0);
      expect(result.unchangedCounts.Supplier ?? 0).toBeGreaterThanOrEqual(1);
      expect(result.unresolvedCounts.Supplier ?? 0).toBe(0);

      const issues = await prisma.tenantOwnershipIssue.findMany({
        where: { tableName: "Supplier", rowId: "sup-race-null" },
      });
      expect(issues).toHaveLength(0);

      const row = await prisma.supplier.findUnique({
        where: { id: "sup-race-null" },
      });
      expect(row?.shopId).toBe(expectedShopId);
    } finally {
      await raceClient.end();
    }
  }, 180_000);

  it("conflicting race: CONCURRENT_SHOP_ID_CONFLICT persisted with detection", async () => {
    await prepareEmptyDatabase(prisma);
    const { otherShopId } = await seedRaceRow();

    const raceClient = new Client({ connectionString: DATABASE_URL });
    await raceClient.connect();
    await raceClient.query(`SET lock_timeout = '5s'`);
    await raceClient.query(`SET statement_timeout = '30s'`);
    try {
      const result = await runTenantBackfill({
        prisma,
        mode: "apply",
        batchSize: 10,
        onBeforeShopIdUpdate: async ({ table, rowId }) => {
          if (table === "Supplier" && rowId === "sup-race-null") {
            await raceClient.query(
              `UPDATE "Supplier" SET "shopId" = $1 WHERE id = $2 AND "shopId" IS NULL`,
              [otherShopId, rowId],
            );
          }
        },
      });

      expect(result.status).toBe("COMPLETED_WITH_ISSUES");
      expect(result.unresolvedCounts.Supplier ?? 0).toBeGreaterThanOrEqual(1);
      expect(result.updatedCounts.Supplier ?? 0).toBe(0);

      const fp = issueFingerprint({
        tableName: "Supplier",
        rowId: "sup-race-null",
        reasonCode: "CONCURRENT_SHOP_ID_CONFLICT",
      });
      const issue = await prisma.tenantOwnershipIssue.findUnique({
        where: { fingerprint: fp },
      });
      expect(issue).not.toBeNull();
      expect(issue!.reasonCode).toBe("CONCURRENT_SHOP_ID_CONFLICT");
      expect(issue!.status).toBe("OPEN");

      const detection = await prisma.tenantOwnershipIssueDetection.findUnique({
        where: {
          runId_fingerprint: { runId: result.runId, fingerprint: fp },
        },
      });
      expect(detection).not.toBeNull();

      const second = await runTenantBackfill({
        prisma,
        mode: "dry-run",
        batchSize: 10,
      });
      expect(second.status).toBe("COMPLETED_WITH_ISSUES");
      const detectionsForFirstRun =
        await prisma.tenantOwnershipIssueDetection.count({
          where: { runId: result.runId, fingerprint: fp },
        });
      expect(detectionsForFirstRun).toBe(1);
      // Second run sees the already-assigned conflicting shopId via a different
      // reason code; CONCURRENT fingerprint must not be duplicated on run 1.
      expect(issue!.reasonCode).toBe("CONCURRENT_SHOP_ID_CONFLICT");
    } finally {
      await raceClient.end();
    }
  }, 180_000);

  it("deletion race fails the batch without advancing past the deleted row", async () => {
    await prepareEmptyDatabase(prisma);
    await seedRaceRow();
    await prisma.supplier.create({
      data: {
        id: "sup-race-keep",
        shop: "race-a.myshopify.com",
        name: "Keep",
        shopId: null,
      },
    });

    const raceClient = new Client({ connectionString: DATABASE_URL });
    await raceClient.connect();
    await raceClient.query(`SET lock_timeout = '5s'`);
    await raceClient.query(`SET statement_timeout = '30s'`);
    try {
      const result = await runTenantBackfill({
        prisma,
        mode: "apply",
        batchSize: 1,
        onBeforeShopIdUpdate: async ({ table, rowId }) => {
          if (table === "Supplier" && rowId === "sup-race-null") {
            await raceClient.query(`DELETE FROM "Supplier" WHERE id = $1`, [
              rowId,
            ]);
          }
        },
      });

      expect(result.status).toBe("FAILED");
      expect(result.failureSummary).toMatch(/no longer exists|Missing row/i);

      const checkpoint = await prisma.tenantBackfillCheckpoint.findUnique({
        where: {
          runId_tableName: {
            runId: result.runId,
            tableName: "Supplier",
          },
        },
      });
      // Failed batch rolls back — checkpoint must not advance to the deleted id.
      expect(checkpoint?.lastProcessedId === "sup-race-null").toBe(false);
    } finally {
      await raceClient.end();
    }
  }, 180_000);
});
