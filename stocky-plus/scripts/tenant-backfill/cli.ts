#!/usr/bin/env tsx
/**
 * Tenant ownership backfill CLI — Phase 1 PR 1.
 *
 * Default mode is dry-run. Dry-run does not mutate merchant ownership rows,
 * but it writes backfill run, checkpoint, and issue diagnostic records.
 * Mutation of merchant ownership and Shop rows requires --apply.
 */
import { PrismaClient } from "@prisma/client";
import { runTenantBackfill, type BackfillMode } from "./engine";

function parseArgs(argv: string[]) {
  let mode: BackfillMode = "dry-run";
  let batchSize = 500;
  let resumeRunId: string | undefined;
  let sourceMainSha: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--apply") mode = "apply";
    else if (arg === "--dry-run") mode = "dry-run";
    else if (arg === "--batch-size") {
      batchSize = Number(argv[++i]);
    } else if (arg.startsWith("--batch-size=")) {
      batchSize = Number(arg.split("=")[1]);
    } else if (arg === "--resume-run-id") {
      resumeRunId = argv[++i];
    } else if (arg.startsWith("--resume-run-id=")) {
      resumeRunId = arg.split("=")[1];
    } else if (arg === "--source-main-sha") {
      sourceMainSha = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return { mode, batchSize, resumeRunId, sourceMainSha };
}

function printHelp() {
  console.log(`Usage:
  npx tsx scripts/tenant-backfill/cli.ts [--dry-run|--apply] [--batch-size N] [--resume-run-id ID]

Default: --dry-run.
Dry-run does not mutate merchant ownership rows, but it writes backfill run,
checkpoint, and issue diagnostic records.
Apply requires TENANT_MAINTENANCE_DATABASE_URL (non-pooler) and explicit --apply.
Never run --apply against production without a reviewed deployment plan.
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    console.log(
      JSON.stringify({
        event: "tenant_backfill_start",
        mode: args.mode,
        batchSize: args.batchSize,
        normalizationVersion: "phase1-shop-domain-v1",
      }),
    );

    const result = await runTenantBackfill({
      prisma,
      mode: args.mode,
      batchSize: args.batchSize,
      resumeRunId: args.resumeRunId,
      sourceMainSha: args.sourceMainSha,
      schemaVersion: "20260730160100_tenant_compatibility_indexes",
    });

    console.log(JSON.stringify({ event: "tenant_backfill_result", ...result }));

    if (result.status === "FAILED") {
      process.exitCode = 1;
    } else if (result.status === "COMPLETED_WITH_ISSUES") {
      console.log(
        JSON.stringify({
          event: "tenant_backfill_blocking_warning",
          message:
            "Blocking ownership issues and/or unresolved rows remain; blocks later PR 3 enforcement.",
          blockingIssueCount: result.blockingIssueCount,
          globalOpenIssueCount: result.globalOpenIssueCount,
          currentRunOpenIssueCount: result.currentRunOpenIssueCount,
          currentRunDetectedIssueCount: result.currentRunDetectedIssueCount,
          unresolvedCounts: result.unresolvedCounts,
          shopsWouldCreate: result.shopsWouldCreate,
        }),
      );
      process.exitCode = 2;
    } else if (result.status === "COMPLETED") {
      process.exitCode = 0;
    } else if (result.status === "INTERRUPTED") {
      process.exitCode = 0;
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "tenant_backfill_error",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
