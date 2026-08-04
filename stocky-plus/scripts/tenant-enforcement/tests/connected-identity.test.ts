/**
 * Runtime/migration connected-identity separation tests (F-PR3-06).
 */
import { describe, expect, it } from "vitest";
import {
  assertSafeRuntimeConnectedIdentity,
  resolveRuntimeDatabaseUrl,
} from "../connection";
import { databaseUrlsSemanticallyEqual } from "../catalog-expect";
import { Client } from "pg";
import { ensureEnforcementTestEnv } from "./helpers";

describe("PR3 runtime connected-identity separation", () => {
  it("rejects semantically equivalent privileged URLs", () => {
    ensureEnforcementTestEnv();
    const migration =
      process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL!;
    const variants = [
      migration.replace(/\/?$/, "/"),
      migration.includes("?")
        ? `${migration}&schema=public`
        : `${migration}?schema=public`,
      migration.replace("localhost", "127.0.0.1"),
      migration.replace("postgresql://", "postgres://"),
      migration.replace("://", "://").includes("5432")
        ? migration.replace(":5432", "")
        : migration,
    ];

    for (const runtime of variants) {
      const prev = process.env.DATABASE_RUNTIME_URL;
      const prevReq = process.env.STOCKY_REQUIRE_RUNTIME_DB_URL;
      try {
        process.env.STOCKY_REQUIRE_RUNTIME_DB_URL = "1";
        process.env.DATABASE_RUNTIME_URL = runtime;
        expect(() =>
          resolveRuntimeDatabaseUrl({ requireRuntime: true }),
        ).toThrow(/semantic identity|malformed/i);
      } finally {
        process.env.DATABASE_RUNTIME_URL = prev;
        process.env.STOCKY_REQUIRE_RUNTIME_DB_URL = prevReq;
      }
    }
  });

  it("normalize treats host/scheme/slash/query aliases as equal", () => {
    // Synthetic identity fixtures — not the live DATABASE_URL secret.
    const user = "owner_role";
    const pass = "owner_pass"; // pragma: allowlist secret
    const db = "app_db";
    const base = `postgresql://${user}:${pass}@localhost:5432/${db}`; // pragma: allowlist secret
    expect(
      databaseUrlsSemanticallyEqual(
        base,
        `postgres://${user}:${pass}@127.0.0.1:5432/${db}/`, // pragma: allowlist secret
      ),
    ).toBe(true);
    expect(
      databaseUrlsSemanticallyEqual(
        base,
        `postgresql://${user}:${pass}@localhost:5432/${db}?schema=public`, // pragma: allowlist secret
      ),
    ).toBe(true);
    expect(
      databaseUrlsSemanticallyEqual(
        base,
        `postgresql://runtime_role:x@localhost:5432/${db}`, // pragma: allowlist secret
      ),
    ).toBe(false);
  });

  it("rejects runtime connection when connected as migration owner", async () => {
    ensureEnforcementTestEnv();
    const migrationUrl =
      process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL!;
    const client = new Client({ connectionString: migrationUrl });
    await client.connect();
    try {
      await expect(
        assertSafeRuntimeConnectedIdentity(client, "stocky_runtime"),
      ).rejects.toThrow(/runtime_identity_rejected/);
    } finally {
      await client.end();
    }
  });

  it("accepts connected restricted runtime role after enforcement", async () => {
    ensureEnforcementTestEnv();
    // Ensure enforcement applied in a prior suite or apply lightly via roles verify path
    const runtimeUrl = process.env.DATABASE_RUNTIME_URL!;
    const client = new Client({ connectionString: runtimeUrl });
    await client.connect();
    try {
      // May fail if role missing — create via prepare in this process
      const { getMigrationClient } = await import("../connection");
      const { provisionRoles } = await import("../roles");
      const mig = await getMigrationClient({
        requireExplicitMigrationUrl: true,
      });
      try {
        await provisionRoles(mig, { apply: true, phase: "prepare" });
      } finally {
        await mig.end();
      }
      // Reconnect after role ensure
      await client.end();
      const runtime = new Client({ connectionString: runtimeUrl });
      await runtime.connect();
      try {
        const identity = await assertSafeRuntimeConnectedIdentity(
          runtime,
          "stocky_runtime",
        );
        expect(identity.currentUser).toBe("stocky_runtime");
        expect(identity.rolsuper).toBe(false);
        expect(identity.rolbypassrls).toBe(false);
        expect(identity.ownedMerchantTables).toEqual([]);
      } finally {
        await runtime.end();
      }
    } catch (err) {
      await client.end().catch(() => undefined);
      throw err;
    }
  });
});
