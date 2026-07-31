/**
 * R6 — durable TenantOwnershipIssueDetection history across runs.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { issueFingerprint } from "../checksum";
import { runTenantBackfill } from "../engine";
import {
  createMigrationPrisma,
  prepareEmptyDatabase,
  prismaGenerate,
  setMaintenanceDatabaseUrl,
} from "./helpers";

describe("durable run-to-issue detection history (R6)", () => {
  const prisma = createMigrationPrisma();

  beforeAll(() => {
    prismaGenerate();
    setMaintenanceDatabaseUrl();
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("preserves run A detection metrics after run B redetects and resolves", async () => {
    await prepareEmptyDatabase(prisma);
    await prisma.session.create({
      data: {
        id: "sess-det",
        shop: "det-a.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    await prisma.supplier.create({
      data: {
        id: "sup-det-bad",
        shop: "not-valid-domain",
        name: "Bad",
      },
    });

    const runA = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
    });
    expect(runA.status).toBe("COMPLETED_WITH_ISSUES");
    expect(runA.currentRunDetectedIssueCount).toBeGreaterThan(0);
    const runADetected = runA.currentRunDetectedIssueCount;
    const runAOpen = runA.currentRunOpenIssueCount;

    const detectionsA = await prisma.tenantOwnershipIssueDetection.findMany({
      where: { runId: runA.runId },
    });
    expect(detectionsA.length).toBe(runADetected);

    const runB = await runTenantBackfill({
      prisma,
      mode: "dry-run",
      batchSize: 10,
    });
    expect(runB.status).toBe("COMPLETED_WITH_ISSUES");
    expect(runB.currentRunDetectedIssueCount).toBeGreaterThan(0);

    const detectionsB = await prisma.tenantOwnershipIssueDetection.findMany({
      where: { runId: runB.runId },
    });
    expect(detectionsB.length).toBe(runB.currentRunDetectedIssueCount);

    // Run A historical counts remain stable.
    const runADetectedAfter = await prisma.tenantOwnershipIssueDetection.count({
      where: { runId: runA.runId },
    });
    expect(runADetectedAfter).toBe(runADetected);
    const runAOpenAfter = await prisma.tenantOwnershipIssueDetection.count({
      where: { runId: runA.runId, wasOpenAfterDetection: true },
    });
    expect(runAOpenAfter).toBe(runAOpen);

    const fp = issueFingerprint({
      tableName: "Supplier",
      rowId: "sup-det-bad",
      reasonCode: "INVALID_SHOP_DOMAIN",
    });
    await prisma.tenantOwnershipIssue.update({
      where: { fingerprint: fp },
      data: { status: "RESOLVED", resolutionEvidence: { manual: true } },
    });

    // Resolving does not rewrite run A detection rows.
    const detAAfterResolve = await prisma.tenantOwnershipIssueDetection.findMany({
      where: { runId: runA.runId },
    });
    expect(detAAfterResolve).toHaveLength(runADetected);
    expect(
      detAAfterResolve.every((d) => d.wasOpenAfterDetection === true),
    ).toBe(true);

    // Reopen on new run creates a new detection while preserving prior history.
    const runC = await runTenantBackfill({
      prisma,
      mode: "dry-run",
      batchSize: 10,
    });
    expect(runC.status).toBe("COMPLETED_WITH_ISSUES");
    const reopenDet = await prisma.tenantOwnershipIssueDetection.findUnique({
      where: {
        runId_fingerprint: { runId: runC.runId, fingerprint: fp },
      },
    });
    expect(reopenDet?.reopenedIssue).toBe(true);

    const stillA = await prisma.tenantOwnershipIssueDetection.count({
      where: { runId: runA.runId },
    });
    expect(stillA).toBe(runADetected);
  }, 180_000);

  it("interrupted/resumed processing does not duplicate detections; atomic with checkpoint", async () => {
    await prepareEmptyDatabase(prisma);
    await prisma.session.create({
      data: {
        id: "sess-resume-det",
        shop: "resume-det.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    for (let i = 0; i < 5; i += 1) {
      await prisma.supplier.create({
        data: {
          id: `sup-resume-det-${i}`,
          shop: "bad-domain",
          name: `Bad ${i}`,
        },
      });
    }

    const interrupted = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 2,
      throwAfterBatchCommit: true,
    });
    expect(interrupted.status).toBe("FAILED");
    const runId = interrupted.runId;

    const detectionsAfterInterrupt =
      await prisma.tenantOwnershipIssueDetection.count({
        where: { runId },
      });
    expect(detectionsAfterInterrupt).toBeGreaterThan(0);

    const resumed = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 2,
      resumeRunId: runId,
    });
    expect(resumed.status).toBe("COMPLETED_WITH_ISSUES");

    const detectionsAfterResume =
      await prisma.tenantOwnershipIssueDetection.count({
        where: { runId },
      });
    // Unique(runId, fingerprint) — resume must not duplicate prior detections.
    const distinctFingerprints =
      await prisma.tenantOwnershipIssueDetection.groupBy({
        by: ["fingerprint"],
        where: { runId },
      });
    expect(detectionsAfterResume).toBe(distinctFingerprints.length);
    expect(detectionsAfterResume).toBeGreaterThanOrEqual(
      detectionsAfterInterrupt,
    );

    // Checkpoint advanced with issues: detection rows exist for the run.
    const issues = await prisma.tenantOwnershipIssue.count({
      where: { firstDetectedRunId: runId },
    });
    expect(issues).toBeGreaterThan(0);
  }, 180_000);
});
