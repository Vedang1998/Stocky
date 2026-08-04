/**
 * Exact privilege allowlist tests (F-PR3-09/10) — dedicated file for CI.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getMigrationClient } from "../connection";
import { verifyRoles } from "../roles";
import {
  requireRuntimeRolePassword,
  resetSchemaAndApplyEnforcement,
} from "./helpers";

describe("PR3 exact privilege allowlist", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    // The harness must receive this from CI/local env; it never invents one.
    expect(requireRuntimeRolePassword().length).toBeGreaterThan(0);
    ({ prisma } = await resetSchemaAndApplyEnforcement());
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("detects PUBLIC grants on merchant tables", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      await client.query(`GRANT ALL ON TABLE "Supplier" TO PUBLIC`);
      const verify = await verifyRoles(client);
      expect(verify.ok).toBe(false);
      expect(
        verify.failures.some((f) => f.startsWith("public_grant:Supplier")),
      ).toBe(true);
      await client.query(`REVOKE ALL ON TABLE "Supplier" FROM PUBLIC`);
      expect((await verifyRoles(client)).ok).toBe(true);
    } finally {
      await client.end();
    }
  });

  it("detects excess TRIGGER/TRUNCATE/REFERENCES privileges", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      await client.query(
        `GRANT TRIGGER, TRUNCATE, REFERENCES ON TABLE "Supplier" TO stocky_runtime`,
      );
      const verify = await verifyRoles(client);
      expect(verify.ok).toBe(false);
      expect(
        verify.failures.some(
          (f) =>
            f.includes("excess_priv:Supplier:TRIGGER") ||
            f.includes("excess_priv:Supplier:TRUNCATE") ||
            f.includes("excess_priv:Supplier:REFERENCES"),
        ),
      ).toBe(true);
      await client.query(
        `REVOKE TRIGGER, TRUNCATE, REFERENCES ON TABLE "Supplier" FROM stocky_runtime`,
      );
      expect((await verifyRoles(client)).ok).toBe(true);
    } finally {
      await client.end();
    }
  });
});
