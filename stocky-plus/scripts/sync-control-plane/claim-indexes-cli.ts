#!/usr/bin/env tsx
/**
 * CLI for D-048 concurrent DurableJob shop-claim index pre-creation.
 *
 *   npm run sync:claim-indexes:plan
 *   npm run sync:claim-indexes:apply -- --apply
 *   npm run sync:claim-indexes:verify
 *
 * Requires TENANT_MAINTENANCE_DATABASE_URL (no DATABASE_URL fallback for apply).
 * Production execution is NOT authorized by D-048.
 */
import pg from "pg";
import {
  SYNC_CLAIM_INDEXES,
  applyClaimIndexesConcurrently,
  classifyClaimIndex,
  inspectClaimIndex,
  verifyClaimIndexes,
} from "./claim-indexes";

function maintenanceUrl(): string {
  const url = process.env.TENANT_MAINTENANCE_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TENANT_MAINTENANCE_DATABASE_URL is required for sync:claim-indexes (DATABASE_URL alone is not accepted for mutating index apply)",
    );
  }
  return url;
}

async function withClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: maintenanceUrl() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function plan(): Promise<void> {
  await withClient(async (client) => {
    for (const entry of SYNC_CLAIM_INDEXES) {
      const inspected = await inspectClaimIndex(client, entry.name);
      const status = classifyClaimIndex(entry, inspected);
      console.log(`${entry.name}: ${status}`);
    }
  });
}

async function apply(): Promise<void> {
  if (!process.argv.includes("--apply")) {
    throw new Error("Refusing to apply without --apply");
  }
  const result = await withClient((client) =>
    applyClaimIndexesConcurrently(client, { apply: true }),
  );
  console.log(JSON.stringify(result, null, 2));
}

async function verify(): Promise<void> {
  await withClient((client) => verifyClaimIndexes(client));
  console.log(JSON.stringify({ ok: true, indexes: SYNC_CLAIM_INDEXES.length }));
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (cmd === "plan") await plan();
  else if (cmd === "apply") await apply();
  else if (cmd === "verify") await verify();
  else {
    console.error("Usage: claim-indexes-cli.ts <plan|apply|verify> [--apply]");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
