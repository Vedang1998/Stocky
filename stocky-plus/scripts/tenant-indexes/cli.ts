#!/usr/bin/env tsx
/**
 * Tenant compatibility index CLI — Phase 1 PR 1 (D-024).
 *
 *   npm run tenant:indexes:plan
 *   npm run tenant:indexes:apply -- --apply
 *   npm run tenant:indexes:verify
 */
import { getMaintenanceClient } from "./connection";
import { runApplyWithPlan } from "./apply";
import { formatPlanReport, planIndexes, summarizePlan } from "./plan";
import { verifyIndexes } from "./verify";

type Mode = "plan" | "apply" | "verify";

function parseMode(argv: string[]): Mode {
  const positional = argv.filter((a) => !a.startsWith("-"));
  const mode = positional[0];
  if (mode === "plan" || mode === "apply" || mode === "verify") {
    return mode;
  }
  printHelp();
  process.exit(1);
}

function hasApplyFlag(argv: string[]): boolean {
  return argv.includes("--apply");
}

function printHelp() {
  console.log(`Usage:
  tsx scripts/tenant-indexes/cli.ts plan
  tsx scripts/tenant-indexes/cli.ts apply --apply
  tsx scripts/tenant-indexes/cli.ts verify

Plan/verify may use TENANT_MAINTENANCE_DATABASE_URL or DATABASE_URL (direct PostgreSQL).
Mutating apply requires an explicit TENANT_MAINTENANCE_DATABASE_URL (no DATABASE_URL fallback).
Pooler/PgBouncer URL string patterns are rejected as a guardrail only — operators remain
responsible for supplying a genuinely direct PostgreSQL endpoint in a later deployment plan.
Never run apply against production without a reviewed deployment plan.
`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }

  const mode = parseMode(argv);
  const requireExplicitMaintenanceUrl = mode === "apply";
  const client = await getMaintenanceClient({ requireExplicitMaintenanceUrl });

  try {
    if (mode === "plan") {
      const plan = await planIndexes(client);
      console.log(formatPlanReport(plan));
      console.log(JSON.stringify({ event: "tenant_indexes_plan", summary: summarizePlan(plan) }));
      const hasProblems = plan.some((row) => row.status !== "valid_exact");
      if (hasProblems) {
        process.exitCode = 1;
      }
      return;
    }

    if (mode === "apply") {
      if (!hasApplyFlag(argv)) {
        console.error("apply mode requires --apply");
        process.exitCode = 1;
        return;
      }
      const result = await runApplyWithPlan(client);
      console.log(JSON.stringify({ event: "tenant_indexes_apply", ...result }));
      return;
    }

    if (mode === "verify") {
      const result = await verifyIndexes(client);
      console.log(JSON.stringify({ event: "tenant_indexes_verify", ...result }));
      if (!result.ok) {
        process.exitCode = 1;
      }
      return;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
