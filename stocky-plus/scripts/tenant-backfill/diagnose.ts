#!/usr/bin/env tsx
/**
 * Tenant ownership diagnostics — Phase 1 PR 1.
 * Dry-run does not mutate merchant ownership rows, but writes run/checkpoint/issue records.
 */
import { PrismaClient } from "@prisma/client";
import { runTenantBackfill } from "./engine";

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await runTenantBackfill({
      prisma,
      mode: "dry-run",
      batchSize: 500,
      schemaVersion: "20260730160100_tenant_compatibility_indexes",
    });

    const openIssues = await prisma.tenantOwnershipIssue.findMany({
      where: { status: "OPEN" },
      orderBy: [{ tableName: "asc" }, { reasonCode: "asc" }, { rowId: "asc" }],
      select: {
        id: true,
        fingerprint: true,
        tableName: true,
        rowId: true,
        reasonCode: true,
        status: true,
        proposedCanonicalShop: true,
        sourceShopValues: true,
        currentOwnershipEvidence: true,
        conflictingOwnershipEvidence: true,
        parentLineage: true,
        reopenedAt: true,
        reopenCount: true,
      },
    });

    console.log(
      JSON.stringify(
        {
          event: "tenant_diagnose_result",
          runId: result.runId,
          status: result.status,
          blockingIssueCount: result.blockingIssueCount,
          globalOpenIssueCount: result.globalOpenIssueCount,
          currentRunOpenIssueCount: result.currentRunOpenIssueCount,
          currentRunDetectedIssueCount: result.currentRunDetectedIssueCount,
          shopsWouldCreate: result.shopsWouldCreate,
          beforeCounts: result.beforeCounts,
          examinedCounts: result.examinedCounts,
          updatedCounts: result.updatedCounts,
          unchangedCounts: result.unchangedCounts,
          unresolvedCounts: result.unresolvedCounts,
          checksums: result.checksums,
          openIssueCount: openIssues.length,
          openIssues,
        },
        null,
        2,
      ),
    );

    if (result.status === "FAILED") process.exitCode = 1;
    else if (result.status === "COMPLETED_WITH_ISSUES") process.exitCode = 2;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "tenant_diagnose_error",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
