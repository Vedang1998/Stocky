import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { issueFingerprint } from "../checksum";
import { runTenantBackfill } from "../engine";
import {
  createMigrationPrisma,
  prepareEmptyDatabase,
  prismaGenerate,
  setMaintenanceDatabaseUrl,
} from "./helpers";

describe("batch commit atomicity + resume after fault", () => {
  const prisma = createMigrationPrisma();

  beforeAll(() => {
    prismaGenerate();
    setMaintenanceDatabaseUrl();
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedBatchFixture() {
    await prisma.session.create({
      data: {
        id: "sess-batch",
        shop: "batch-a.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    await prisma.supplier.create({
      data: {
        id: "sup-001-unresolved",
        shop: "invalid-batch.example",
        name: "Unresolved first",
      },
    });
    await prisma.supplier.create({
      data: {
        id: "sup-002-good",
        shop: "batch-a.myshopify.com",
        name: "Good second",
      },
    });
  }

  it("commits checkpoint and issues atomically per batch; resume does not skip unresolved rows", async () => {
    await prepareEmptyDatabase(prisma);
    await seedBatchFixture();

    const faulted = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 1,
      throwAfterBatchCommit: true,
    });
    expect(faulted.status).toBe("FAILED");
    expect(faulted.failureSummary).toMatch(/throwAfterBatchCommit/);

    const checkpoint = await prisma.tenantBackfillCheckpoint.findUnique({
      where: {
        runId_tableName: { runId: faulted.runId, tableName: "Supplier" },
      },
    });
    expect(checkpoint).not.toBeNull();
    expect(checkpoint!.lastProcessedId).toBe("sup-001-unresolved");
    expect(checkpoint!.unresolvedCount).toBeGreaterThanOrEqual(1);

    const fp = issueFingerprint({
      tableName: "Supplier",
      rowId: "sup-001-unresolved",
      reasonCode: "INVALID_SHOP_DOMAIN",
    });
    const issue = await prisma.tenantOwnershipIssue.findUnique({
      where: { fingerprint: fp },
    });
    expect(issue).not.toBeNull();
    expect(checkpoint!.examinedCount).toBeGreaterThanOrEqual(1);

    const resumed = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
      resumeRunId: faulted.runId,
    });
    expect(resumed.status).toBe("COMPLETED_WITH_ISSUES");

    const resumedIssues = await prisma.tenantOwnershipIssue.findMany({
      orderBy: [{ tableName: "asc" }, { rowId: "asc" }, { reasonCode: "asc" }],
    });

    await prepareEmptyDatabase(prisma);
    await seedBatchFixture();
    const baseline = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
    });
    expect(baseline.status).toBe("COMPLETED_WITH_ISSUES");

    const cleanIssues = await prisma.tenantOwnershipIssue.findMany({
      orderBy: [{ tableName: "asc" }, { rowId: "asc" }, { reasonCode: "asc" }],
    });

    expect(
      resumedIssues.map((i) => `${i.tableName}:${i.rowId}:${i.reasonCode}`),
    ).toEqual(
      cleanIssues.map((i) => `${i.tableName}:${i.rowId}:${i.reasonCode}`),
    );
    expect(baseline.unresolvedCounts.Supplier).toBe(
      resumed.unresolvedCounts.Supplier,
    );
  }, 180_000);
});
