#!/usr/bin/env tsx
import { assertNoPrismaSchemaDrift } from "./drift-lib";

/**
 * Complete Prisma schema drift check against the live database.
 *
 * Prerequisites (CI / runbook): migrate deploy → indexes apply → indexes verify,
 * then this command. Manifest verification remains `tenant:indexes:verify`.
 *
 * Uses --from-schema-datasource with DATABASE_URL in the child environment
 * (connection URL is not placed on argv).
 */
async function main() {
  assertNoPrismaSchemaDrift();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
