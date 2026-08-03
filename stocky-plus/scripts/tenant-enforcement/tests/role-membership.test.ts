/**
 * Role membership escalation + exact privilege allowlist tests (F-PR3-05/09/10/11).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getMigrationClient } from "../connection";
import { provisionRoles, verifyRoles } from "../roles";
import { resetSchemaAndApplyEnforcement } from "./helpers";

describe("PR3 role membership and exact privilege allowlist", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("detects direct owner membership grant", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const owner = await client.query<{ owner: string }>(
        `SELECT r.rolname AS owner
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_roles r ON r.oid = c.relowner
         WHERE n.nspname = 'public' AND c.relname = 'Supplier'`,
      );
      const ownerRole = owner.rows[0].owner;
      await client.query(`GRANT ${ownerRole} TO stocky_runtime`);
      const verify = await verifyRoles(client);
      expect(verify.ok).toBe(false);
      expect(
        verify.failures.some((f) => f.includes(`member_of:${ownerRole}`)),
      ).toBe(true);
      // SET ROLE must be possible with the bad grant — prove impact then revoke
      const runtimeUrl = process.env.DATABASE_RUNTIME_URL!;
      const { Client } = await import("pg");
      const runtime = new Client({ connectionString: runtimeUrl });
      await runtime.connect();
      try {
        await runtime.query(`SET ROLE ${ownerRole}`);
        expect(true).toBe(true);
      } finally {
        await runtime.end();
      }
      await client.query(`REVOKE ${ownerRole} FROM stocky_runtime`);
      expect((await verifyRoles(client)).ok).toBe(true);
    } finally {
      await client.end();
    }
  });

  it("detects indirect owner membership through intermediary", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const owner = await client.query<{ owner: string }>(
        `SELECT r.rolname AS owner FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_roles r ON r.oid = c.relowner
         WHERE n.nspname = 'public' AND c.relname = 'Supplier'`,
      );
      await client.query(`CREATE ROLE stocky_mid_escalation NOINHERIT`);
      await client.query(
        `GRANT ${owner.rows[0].owner} TO stocky_mid_escalation`,
      );
      await client.query(`GRANT stocky_mid_escalation TO stocky_runtime`);
      const verify = await verifyRoles(client);
      expect(verify.ok).toBe(false);
      expect(
        verify.failures.some((f) => f.includes("member_of:stocky_mid_escalation")),
      ).toBe(true);
      await client.query(`REVOKE stocky_mid_escalation FROM stocky_runtime`);
      await client.query(`DROP ROLE stocky_mid_escalation`);
      expect((await verifyRoles(client)).ok).toBe(true);
    } finally {
      await client.end();
    }
  });

  it("detects ADMIN OPTION membership", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      await client.query(`CREATE ROLE stocky_admin_probe NOLOGIN`);
      await client.query(
        `GRANT stocky_admin_probe TO stocky_runtime WITH ADMIN OPTION`,
      );
      const verify = await verifyRoles(client);
      expect(verify.ok).toBe(false);
      expect(
        verify.failures.some((f) => f.includes("admin_option_on:stocky_admin_probe")),
      ).toBe(true);
      await client.query(`REVOKE stocky_admin_probe FROM stocky_runtime`);
      await client.query(`DROP ROLE stocky_admin_probe`);
    } finally {
      await client.end();
    }
  });

  it("detects PUBLIC grants on merchant tables", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      await client.query(`GRANT ALL ON TABLE "Supplier" TO PUBLIC`);
      const verify = await verifyRoles(client);
      expect(verify.ok).toBe(false);
      expect(verify.failures.some((f) => f.startsWith("public_grant:Supplier"))).toBe(
        true,
      );
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

  it("provision fails closed on BYPASSRLS without repair mode", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      await client.query(`ALTER ROLE stocky_runtime BYPASSRLS`);
      const result = await provisionRoles(client, {
        apply: true,
        phase: "prepare",
      });
      expect(result.ok).toBe(false);
      expect(
        result.detectedDrift.some((d) => d.includes("runtime_has_bypassrls")),
      ).toBe(true);
      expect(result.repairedDrift).toHaveLength(0);
      const repaired = await provisionRoles(client, {
        apply: true,
        phase: "prepare",
        repairDangerousDrift: true,
      });
      expect(repaired.ok).toBe(true);
      expect(
        repaired.repairedDrift.some((d) =>
          d.includes("runtime_has_bypassrls"),
        ),
      ).toBe(true);
      // Re-grant merchant DML after prepare revoked it
      const grants = await provisionRoles(client, {
        apply: true,
        phase: "grants",
      });
      expect(grants.ok).toBe(true);
    } finally {
      await client.end();
    }
  });
});
