/**
 * Applying enforcement again after a later migration has added a merchant
 * table, on a database that is already enforced and in use.
 *
 * A migration creates a table without row-level policies or runtime grants;
 * `tenant:enforcement:apply` gives it both. Until then enforcement is
 * incomplete again, but only for the new table. The preflight used to judge
 * the whole database by that: it took the runtime role's grants on every
 * table that was already protected for grants made before row-level security,
 * called them dangerous drift and refused to apply without
 * `--acknowledge-dangerous-drift-repair` (SEC-22).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { Client } from "pg";
import { applyEnforcement } from "../apply";
import { getMigrationClient } from "../connection";
import { runPreflight } from "../preflight";
import { verifyEnforcement } from "../verify";
import { resetSchemaAndApplyEnforcement } from "./helpers";

/** The migration that added the two daily stock history tables. */
const LATER_MIGRATION = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../prisma/migrations/20261119210000_daily_stock_snapshots/migration.sql",
);
const NEW_TABLES = ["DailyStockSnapshot", "DailyStockLevel"] as const;
const SUPPLIER_TRIGGER = "trg_Supplier_shopId_immutable";

/**
 * Puts the two tables back to what their migration leaves behind: the tables,
 * their keys and their own guard, and nothing that enforcement adds.
 */
async function recreateAsMigrated(client: Client): Promise<void> {
  await client.query(`DROP TABLE "DailyStockLevel", "DailyStockSnapshot"`);
  await client.query(readFileSync(LATER_MIGRATION, "utf8"));
}

async function runtimeCanSelect(
  client: Client,
  table: string,
): Promise<boolean> {
  const res = await client.query<{ has: boolean }>(
    `SELECT has_table_privilege('stocky_runtime', format('%I.%I', 'public', $1::text), 'SELECT') AS has`,
    [table],
  );
  return res.rows[0].has;
}

async function rlsForced(client: Client, table: string): Promise<boolean> {
  const res = await client.query<{ forced: boolean }>(
    `SELECT c.relrowsecurity AND c.relforcerowsecurity AS forced
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = $1`,
    [table],
  );
  return res.rows[0].forced;
}

describe.sequential("enforcement after a later migration adds a table", () => {
  let prisma: PrismaClient;
  let client: Client;

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
    client = await getMigrationClient({ requireExplicitMigrationUrl: true });
    await recreateAsMigrated(client);
  }, 300_000);

  afterAll(async () => {
    await client?.end();
    await prisma?.$disconnect();
  });

  it("finds the new tables unprotected and unreachable, and the others in use", async () => {
    for (const table of NEW_TABLES) {
      expect(await rlsForced(client, table)).toBe(false);
      expect(await runtimeCanSelect(client, table)).toBe(false);
    }
    expect(await rlsForced(client, "Supplier")).toBe(true);
    expect(await runtimeCanSelect(client, "Supplier")).toBe(true);
  });

  it("does not take the grants on protected tables for dangerous drift", async () => {
    const preflight = await runPreflight(client, { mode: "resume" });

    expect(preflight.progress.complete).toBe(false);
    expect(preflight.dangerousDriftCodes).toBeUndefined();
    expect(preflight.globalFailures).toEqual([]);
    expect(preflight.driftClass).toBe("known_safe_partial_state");
    expect(preflight.ok).toBe(true);
  });

  it("still refuses a grant on a new table that has no policies yet", async () => {
    await client.query(
      `GRANT SELECT ON TABLE "DailyStockSnapshot" TO stocky_runtime`,
    );
    try {
      const preflight = await runPreflight(client, { mode: "resume" });

      expect(preflight.ok).toBe(false);
      expect(preflight.driftClass).toBe("repair_authorization_required");
      expect(preflight.dangerousDriftCodes).toContain(
        "dangerous_privilege_drift:unexpected_merchant_priv_before_rls:DailyStockSnapshot:SELECT",
      );
      expect(
        preflight.dangerousDriftCodes?.filter((code) =>
          code.includes(":Supplier:"),
        ),
      ).toEqual([]);
    } finally {
      await client.query(
        `REVOKE SELECT ON TABLE "DailyStockSnapshot" FROM stocky_runtime`,
      );
    }
  });

  it("still refuses when an object is missing from a table already in use", async () => {
    const definition = await client.query<{ sql: string }>(
      `SELECT pg_get_triggerdef(t.oid) AS sql
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       WHERE c.relname = 'Supplier' AND t.tgname = $1`,
      [SUPPLIER_TRIGGER],
    );
    await client.query(
      `DROP TRIGGER "${SUPPLIER_TRIGGER}" ON public."Supplier"`,
    );
    try {
      const preflight = await runPreflight(client, { mode: "resume" });

      expect(preflight.ok).toBe(false);
      expect(preflight.dangerousDriftCodes).toContain(
        "dangerous_definition_drift:trigger_missing:Supplier",
      );
      // The same object missing from a table nothing can reach yet is only
      // unfinished work.
      expect(
        preflight.dangerousDriftCodes?.filter((code) =>
          NEW_TABLES.some((table) => code.endsWith(`:${table}`)),
        ),
      ).toEqual([]);
    } finally {
      await client.query(definition.rows[0].sql);
    }
    expect((await runPreflight(client, { mode: "resume" })).ok).toBe(true);
  });

  it(
    "applies without an acknowledgement and brings the new tables into use",
    async () => {
      const apply = await applyEnforcement(client, { apply: true });

      expect(apply.preflightOk).toBe(true);
      expect(apply.ok).toBe(true);
      expect((await verifyEnforcement(client)).issues).toEqual([]);
      for (const table of [...NEW_TABLES, "Supplier"]) {
        expect(await rlsForced(client, table)).toBe(true);
        expect(await runtimeCanSelect(client, table)).toBe(true);
      }
      const after = await runPreflight(client, { mode: "resume" });
      expect(after.ok).toBe(true);
      expect(after.driftClass).toBe("clean");
    },
    300_000,
  );
});
