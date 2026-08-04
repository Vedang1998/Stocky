/**
 * Future-object default privilege drift (F-PR3C-02).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { applyEnforcement } from "../apply";
import { getMigrationClient } from "../connection";
import { provisionRoles, verifyRoles } from "../roles";
import { quoteIdent } from "../sql";
import { verifyEnforcement } from "../verify";
import { resetSchemaAndApplyEnforcement } from "./helpers";

describe.sequential("default privilege drift", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("reports runtime and PUBLIC defaults and requires explicit dangerous repair", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    const ownerResult = await client.query<{ owner: string }>(
      `SELECT current_user::text AS owner`,
    );
    const owner = quoteIdent(ownerResult.rows[0].owner);
    const expectedPrefixes = [
      "unsafe_default_table_priv:runtime:",
      "unsafe_default_table_priv:public:",
      "unsafe_default_sequence_priv:runtime:",
      "unsafe_default_sequence_priv:public:",
      "unsafe_default_function_priv:runtime:",
      "unsafe_default_function_priv:public:",
    ];

    try {
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public
           GRANT SELECT ON TABLES TO stocky_runtime`,
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public
           GRANT SELECT ON TABLES TO PUBLIC`,
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public
           GRANT USAGE ON SEQUENCES TO stocky_runtime`,
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public
           GRANT USAGE ON SEQUENCES TO PUBLIC`,
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public
           GRANT EXECUTE ON FUNCTIONS TO stocky_runtime`,
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public
           GRANT EXECUTE ON FUNCTIONS TO PUBLIC`,
      );

      const roles = await verifyRoles(client);
      expect(roles.ok).toBe(false);
      for (const prefix of expectedPrefixes) {
        expect(
          roles.failures.some((failure) => failure.startsWith(prefix)),
        ).toBe(true);
      }

      const enforcement = await verifyEnforcement(client);
      expect(enforcement.ok).toBe(false);
      for (const prefix of expectedPrefixes) {
        expect(
          enforcement.issues.some((issue) => issue.code.startsWith(prefix)),
        ).toBe(true);
      }

      const refused = await provisionRoles(client, {
        apply: true,
        phase: "prepare",
      });
      expect(refused.ok).toBe(false);
      expect(
        refused.detectedDrift.some((code) =>
          code.startsWith("unsafe_default_"),
        ),
      ).toBe(true);
      expect(refused.repairedDrift).toHaveLength(0);

      const repaired = await provisionRoles(client, {
        apply: true,
        phase: "prepare",
        repairDangerousDefaultPrivileges: true,
      });
      expect(repaired.ok).toBe(true);
      expect(
        repaired.repairedDrift.some((code) =>
          code.startsWith("repaired_default_acl:"),
        ),
      ).toBe(true);

      const applied = await applyEnforcement(client, { apply: true });
      expect(applied.ok).toBe(true);
      expect((await verifyRoles(client)).ok).toBe(true);
      expect((await verifyEnforcement(client)).ok).toBe(true);

      await client.query(`DROP TABLE IF EXISTS "FutureMerchantTable"`);
      await client.query(
        `CREATE TABLE "FutureMerchantTable" (id text PRIMARY KEY, "shopId" text)`,
      );
      const privileges = await client.query<{
        runtime_select: boolean;
        public_select: boolean;
      }>(
        `SELECT
           has_table_privilege('stocky_runtime', 'public."FutureMerchantTable"', 'SELECT') AS runtime_select,
           has_table_privilege('public', 'public."FutureMerchantTable"', 'SELECT') AS public_select`,
      );
      expect(privileges.rows[0]).toEqual({
        runtime_select: false,
        public_select: false,
      });
    } finally {
      await client.query(`DROP TABLE IF EXISTS "FutureMerchantTable"`);
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public
           REVOKE ALL ON TABLES FROM stocky_runtime`,
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public
           REVOKE ALL ON TABLES FROM PUBLIC`,
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public
           REVOKE ALL ON SEQUENCES FROM stocky_runtime`,
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public
           REVOKE ALL ON SEQUENCES FROM PUBLIC`,
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public
           REVOKE ALL ON FUNCTIONS FROM stocky_runtime`,
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public
           REVOKE ALL ON FUNCTIONS FROM PUBLIC`,
      );
      await client.end();
    }
  });
});
