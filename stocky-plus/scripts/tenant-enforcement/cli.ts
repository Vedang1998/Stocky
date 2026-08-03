#!/usr/bin/env tsx
/**
 * Tenant database enforcement CLI — Phase 1 PR 3.
 *
 *   npm run tenant:enforcement:preflight
 *   npm run tenant:enforcement:plan
 *   npm run tenant:enforcement:apply -- --apply
 *   npm run tenant:enforcement:verify
 *   npm run tenant:enforcement:drift
 *   npm run tenant:roles:provision -- --apply
 *   npm run tenant:roles:verify
 *   npm run tenant:rls:verify
 *   npm run tenant:immutability:verify
 */
import { applyEnforcement, planEnforcement } from "./apply";
import { getMigrationClient } from "./connection";
import { runPreflight } from "./preflight";
import { provisionRoles, verifyRoles } from "./roles";
import {
  detectEnforcementDrift,
  verifyEnforcement,
  verifyImmutabilityOnly,
  verifyRlsOnly,
} from "./verify";

type Mode =
  | "preflight"
  | "plan"
  | "apply"
  | "verify"
  | "drift"
  | "roles-provision"
  | "roles-verify"
  | "rls-verify"
  | "immutability-verify";

function parseMode(argv: string[]): Mode {
  const positional = argv.filter((a) => !a.startsWith("-"));
  const mode = positional[0] as Mode | undefined;
  const allowed: Mode[] = [
    "preflight",
    "plan",
    "apply",
    "verify",
    "drift",
    "roles-provision",
    "roles-verify",
    "rls-verify",
    "immutability-verify",
  ];
  if (mode && allowed.includes(mode)) return mode;
  printHelp();
  process.exit(1);
}

function printHelp() {
  console.log(`Usage:
  tsx scripts/tenant-enforcement/cli.ts preflight
  tsx scripts/tenant-enforcement/cli.ts plan
  tsx scripts/tenant-enforcement/cli.ts apply --apply
  tsx scripts/tenant-enforcement/cli.ts verify
  tsx scripts/tenant-enforcement/cli.ts drift
  tsx scripts/tenant-enforcement/cli.ts roles-provision --apply
  tsx scripts/tenant-enforcement/cli.ts roles-verify
  tsx scripts/tenant-enforcement/cli.ts rls-verify
  tsx scripts/tenant-enforcement/cli.ts immutability-verify

Mutating modes require DATABASE_MIGRATION_URL or TENANT_MAINTENANCE_DATABASE_URL.
Production execution is not authorized by PR 3.
`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }

  const mode = parseMode(argv);
  const mutating =
    mode === "apply" || mode === "roles-provision";
  const client = await getMigrationClient({
    requireExplicitMigrationUrl: mutating,
  });

  try {
    if (mode === "preflight") {
      const result = await runPreflight(client);
      console.log(JSON.stringify(result));
      if (!result.ok) process.exitCode = 1;
      return;
    }

    if (mode === "plan") {
      const result = await planEnforcement(client);
      console.log(JSON.stringify(result));
      if (!result.preflightOk) process.exitCode = 1;
      return;
    }

    if (mode === "apply") {
      if (!argv.includes("--apply")) {
        console.error("apply mode requires --apply");
        process.exitCode = 1;
        return;
      }
      const result = await applyEnforcement(client, { apply: true });
      console.log(JSON.stringify(result));
      if (!result.ok) process.exitCode = 1;
      return;
    }

    if (mode === "verify") {
      const result = await verifyEnforcement(client);
      console.log(JSON.stringify(result));
      if (!result.ok) process.exitCode = 1;
      return;
    }

    if (mode === "drift") {
      const result = await detectEnforcementDrift(client);
      console.log(
        JSON.stringify({ ...result, event: "tenant_enforcement_drift" }),
      );
      if (!result.ok) process.exitCode = 1;
      return;
    }

    if (mode === "roles-provision") {
      if (!argv.includes("--apply")) {
        console.error("roles-provision requires --apply");
        process.exitCode = 1;
        return;
      }
      // Default: prepare only (no merchant DML). Merchant DML is applied by
      // enforcement apply after verified RLS, or via --with-merchant-dml when
      // FORCE RLS is already complete.
      const phase = argv.includes("--with-merchant-dml") ? "full" : "prepare";
      const repairDangerousDrift = argv.includes("--repair-dangerous-drift");
      const repairDangerousDefaultPrivileges = argv.includes(
        "--repair-dangerous-default-privileges",
      );
      const result = await provisionRoles(client, {
        apply: true,
        phase,
        repairDangerousDrift,
        repairDangerousDefaultPrivileges,
      });
      console.log(JSON.stringify(result));
      if (!result.ok) process.exitCode = 1;
      return;
    }

    if (mode === "roles-verify") {
      const result = await verifyRoles(client);
      console.log(JSON.stringify(result));
      if (!result.ok) process.exitCode = 1;
      return;
    }

    if (mode === "rls-verify") {
      const result = await verifyRlsOnly(client);
      console.log(JSON.stringify({ ...result, event: "tenant_rls_verify" }));
      if (!result.ok) process.exitCode = 1;
      return;
    }

    if (mode === "immutability-verify") {
      const result = await verifyImmutabilityOnly(client);
      console.log(
        JSON.stringify({ ...result, event: "tenant_immutability_verify" }),
      );
      if (!result.ok) process.exitCode = 1;
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
