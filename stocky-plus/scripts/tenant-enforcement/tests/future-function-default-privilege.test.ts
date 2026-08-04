/**
 * Future-function default privilege safety (F-NEW-02).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getMigrationClient } from "../connection";
import {
  collectDefaultAclFailures,
  establishSafeFunctionDefaultPrivileges,
  provisionRoles,
  readEffectiveDefaultAcl,
  verifyFutureFunctionDefaultsWithProbe,
  verifyRoles,
} from "../roles";
import { quoteIdent } from "../sql";
import { verifyEnforcement } from "../verify";
import { resetSchemaAndApplyEnforcement } from "./helpers";

describe.sequential("future-function default privileges", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("treats absent function defacl as unsafe and secures future probes", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const ownerRes = await client.query<{ owner: string }>(
        `SELECT current_user::text AS owner`,
      );
      const owner = ownerRes.rows[0].owner;

      // Fresh role with no pg_default_acl row — proves absent ≠ safe.
      const probeRole = `stocky_fn_defacl_${Date.now().toString(36)}`;
      await client.query(`CREATE ROLE ${probeRole} NOLOGIN`);
      const absentEffective = await readEffectiveDefaultAcl(
        client,
        probeRole,
        "f",
      );
      expect(absentEffective.absent).toBe(true);
      expect(absentEffective.source).toBe("acldefault");
      expect(
        absentEffective.grants.some((g) => g.grantee === "public"),
      ).toBe(true);

      await establishSafeFunctionDefaultPrivileges(client, probeRole);
      const secured = await readEffectiveDefaultAcl(client, probeRole, "f");
      expect(secured.absent).toBe(false);
      expect(secured.grants.some((g) => g.grantee === "public")).toBe(false);

      // Session owner: probe future function after clean enforcement.
      const probe = await verifyFutureFunctionDefaultsWithProbe(
        client,
        "stocky_runtime",
      );
      expect(probe.ok).toBe(true);

      // Explicit unsafe grants still require repair mode.
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(owner)} IN SCHEMA public
           GRANT EXECUTE ON FUNCTIONS TO stocky_runtime`,
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(owner)} IN SCHEMA public
           GRANT EXECUTE ON FUNCTIONS TO PUBLIC`,
      );
      const failures = await collectDefaultAclFailures(client, "stocky_runtime");
      expect(
        failures.some((f) => f.startsWith("unsafe_default_function_priv:")),
      ).toBe(true);
      expect((await verifyRoles(client)).ok).toBe(false);

      const refused = await provisionRoles(client, {
        apply: true,
        phase: "prepare",
      });
      expect(refused.ok).toBe(false);
      expect(
        refused.errors.some((e) => e.includes("dangerous_default_acl_drift")),
      ).toBe(true);

      const repaired = await provisionRoles(client, {
        apply: true,
        phase: "prepare",
        repairDangerousDefaultPrivileges: true,
      });
      expect(repaired.ok).toBe(true);
      expect(
        repaired.repairedDrift.some((d) => d.includes("probe=ok")),
      ).toBe(true);
      expect((await verifyEnforcement(client)).ok).toBe(true);
      expect(
        (await verifyRoles(client, { requireMerchantDml: false })).ok,
      ).toBe(true);
      const grants = await provisionRoles(client, {
        apply: true,
        phase: "grants",
      });
      expect(grants.ok).toBe(true);
      expect((await verifyRoles(client)).ok).toBe(true);
    } finally {
      try {
        // Drop default-ACL dependency before DROP ROLE.
        const roles = await client.query<{ rolname: string }>(
          `SELECT rolname FROM pg_roles WHERE rolname LIKE 'stocky_fn_defacl_%'`,
        );
        for (const row of roles.rows) {
          await client.query(
            `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(row.rolname)} IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM ${quoteIdent(row.rolname)}`,
          );
          await client.query(
            `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(row.rolname)} REVOKE ALL ON FUNCTIONS FROM ${quoteIdent(row.rolname)}`,
          );
          await client.query(`DROP ROLE IF EXISTS ${quoteIdent(row.rolname)}`);
        }
        await client.query(`DROP ROLE IF EXISTS stocky_fn_defacl_probe`);
      } catch {
        // best-effort cleanup
      }
      await client.end();
    }
  }, 300_000);
});
