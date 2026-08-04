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

      // Strip function defaults to reproduce the absent-row hole.
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(owner)} IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM ${quoteIdent(owner)}`,
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdent(owner)} REVOKE ALL ON FUNCTIONS FROM ${quoteIdent(owner)}`,
      );

      const effective = await readEffectiveDefaultAcl(client, owner, "f");
      expect(effective.absent).toBe(true);
      expect(effective.grants.some((g) => g.grantee === "public")).toBe(true);

      const failures = await collectDefaultAclFailures(client, "stocky_runtime");
      expect(
        failures.some((f) =>
          f.startsWith("unsafe_default_function_absent_acldefault:"),
        ),
      ).toBe(true);

      const roles = await verifyRoles(client);
      expect(roles.ok).toBe(false);

      await establishSafeFunctionDefaultPrivileges(client, owner);
      const after = await readEffectiveDefaultAcl(client, owner, "f");
      expect(after.absent).toBe(false);
      expect(after.grants.some((g) => g.grantee === "public")).toBe(false);

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
      expect((await verifyRoles(client)).ok).toBe(true);
    } finally {
      await client.end();
    }
  }, 300_000);
});
