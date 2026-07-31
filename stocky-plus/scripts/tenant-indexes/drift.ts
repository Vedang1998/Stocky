#!/usr/bin/env tsx
import { assertNoPrismaSchemaDrift } from "./drift-lib";
import { resolveMaintenanceDatabaseUrl } from "./connection";

/**
 * Complete Prisma schema drift check against the live database.
 *
 * Prerequisites (CI / runbook): migrate deploy → indexes apply → indexes verify,
 * then this command. Manifest verification remains `tenant:indexes:verify`.
 */
async function main() {
  const url = resolveMaintenanceDatabaseUrl();
  assertNoPrismaSchemaDrift(url);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
