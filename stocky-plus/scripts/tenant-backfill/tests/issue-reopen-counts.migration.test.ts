import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { issueFingerprint } from "../checksum";
import { runTenantBackfill } from "../engine";
import {
  createMigrationPrisma,
  prepareEmptyDatabase,
  prismaGenerate,
  setMaintenanceDatabaseUrl,
} from "./helpers";

describe("issue reopen + run status count fields", () => {
  const prisma = createMigrationPrisma();

  beforeAll(() => {
    prismaGenerate();
    setMaintenanceDatabaseUrl();
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("reopens RESOLVED issues on re-detect with reopenCount and reopenedAt", async () => {
    await prepareEmptyDatabase(prisma);
    await prisma.session.create({
      data: {
        id: "sess-reopen",
        shop: "reopen-a.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    await prisma.supplier.create({
      data: {
        id: "sup-reopen-bad",
        shop: "bad-reopen.example",
        name: "Bad",
      },
    });

    const first = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
    });
    expect(first.status).toBe("COMPLETED_WITH_ISSUES");

    const fp = issueFingerprint({
      tableName: "Supplier",
      rowId: "sup-reopen-bad",
      reasonCode: "INVALID_SHOP_DOMAIN",
    });
    await prisma.tenantOwnershipIssue.update({
      where: { fingerprint: fp },
      data: { status: "RESOLVED", resolutionEvidence: { manual: true } },
    });

    const second = await runTenantBackfill({
      prisma,
      mode: "dry-run",
      batchSize: 10,
    });
    expect(second.status).toBe("COMPLETED_WITH_ISSUES");

    const reopened = await prisma.tenantOwnershipIssue.findUnique({
      where: { fingerprint: fp },
    });
    expect(reopened?.status).toBe("OPEN");
    expect(reopened?.reopenedAt).not.toBeNull();
    expect(reopened!.reopenCount).toBeGreaterThanOrEqual(1);
  }, 180_000);

  it("exposes distinct COMPLETED, COMPLETED_WITH_ISSUES, and FAILED count fields", async () => {
    await prepareEmptyDatabase(prisma);
    await prisma.session.create({
      data: {
        id: "sess-clean",
        shop: "clean-only.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    await prisma.supplier.create({
      data: {
        id: "sup-clean",
        shop: "clean-only.myshopify.com",
        name: "Clean",
      },
    });

    const completed = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
    });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.blockingIssueCount).toBe(0);
    expect(completed.currentRunDetectedIssueCount).toBe(0);
    expect(completed.currentRunOpenIssueCount).toBe(0);
    expect(completed.globalOpenIssueCount).toBe(0);

    await prepareEmptyDatabase(prisma);
    await prisma.session.create({
      data: {
        id: "sess-issues",
        shop: "issues-only.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    await prisma.supplier.create({
      data: {
        id: "sup-issues",
        shop: "not-a-shop",
        name: "Issues",
      },
    });

    const withIssues = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
    });
    expect(withIssues.status).toBe("COMPLETED_WITH_ISSUES");
    expect(withIssues.blockingIssueCount).toBeGreaterThan(0);
    expect(withIssues.currentRunDetectedIssueCount).toBeGreaterThan(0);
    expect(withIssues.currentRunOpenIssueCount).toBeGreaterThan(0);
    expect(withIssues.globalOpenIssueCount).toBeGreaterThan(0);
    expect(withIssues.blockingIssueCount).toBe(withIssues.globalOpenIssueCount);

    await prepareEmptyDatabase(prisma);
    await prisma.session.create({
      data: {
        id: "sess-fail",
        shop: "fail-a.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    await prisma.supplier.create({
      data: {
        id: "sup-fail",
        shop: "fail-a.myshopify.com",
        name: "Fail path",
      },
    });

    const failed = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 1,
      throwAfterBatchCommit: true,
    });
    expect(failed.status).toBe("FAILED");
    expect(failed.failureSummary).toBeTruthy();

    const failedRun = await prisma.tenantBackfillRun.findUnique({
      where: { id: failed.runId },
    });
    expect(failedRun?.status).toBe("FAILED");
    const failedCheckpoint = await prisma.tenantBackfillCheckpoint.findFirst({
      where: { runId: failed.runId, tableName: "Supplier" },
    });
    expect(failedCheckpoint?.examinedCount).toBeGreaterThanOrEqual(1);
  }, 180_000);
});
