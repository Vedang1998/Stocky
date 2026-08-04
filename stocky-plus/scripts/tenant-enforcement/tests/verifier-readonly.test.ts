/**
 * Verifier read-only guarantees (F-PR3C-03).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getMigrationClient } from "../connection";
import {
  catalogPrivilegeDigest,
  verifyRoles,
  withReadOnlyVerifyTransaction,
} from "../roles";
import { resetSchemaAndApplyEnforcement } from "./helpers";

describe.sequential("role verifier is read-only", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("preserves PUBLIC schema CREATE drift while reporting it", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      await client.query(`GRANT CREATE ON SCHEMA public TO PUBLIC`);
      const beforeDigest = await catalogPrivilegeDigest(client);
      const beforeAcl = await client.query<{ nspacl: string | null }>(
        `SELECT nspacl::text AS nspacl
         FROM pg_namespace
         WHERE nspname = 'public'`,
      );

      const result = await verifyRoles(client);
      expect(result.ok).toBe(false);
      expect(result.failures).toContain("public_schema_create");

      const afterDigest = await catalogPrivilegeDigest(client);
      const afterAcl = await client.query<{ nspacl: string | null }>(
        `SELECT nspacl::text AS nspacl
         FROM pg_namespace
         WHERE nspname = 'public'`,
      );
      expect(afterDigest).toBe(beforeDigest);
      expect(afterAcl.rows[0].nspacl).toBe(beforeAcl.rows[0].nspacl);

      const stillGranted = await client.query<{ has: boolean }>(
        `SELECT has_schema_privilege('public', 'public', 'CREATE') AS has`,
      );
      expect(stillGranted.rows[0].has).toBe(true);
    } finally {
      await client.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC`);
      expect((await verifyRoles(client)).ok).toBe(true);
      await client.end();
    }
  });

  it("rejects DDL inside the read-only verification transaction", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      await expect(
        withReadOnlyVerifyTransaction(client, async () => {
          await client.query(
            `CREATE TABLE "VerifierMustNotMutate" (id integer PRIMARY KEY)`,
          );
        }),
      ).rejects.toThrow(/read-only transaction/i);

      const exists = await client.query<{ exists: boolean }>(
        `SELECT to_regclass('public."VerifierMustNotMutate"') IS NOT NULL AS exists`,
      );
      expect(exists.rows[0].exists).toBe(false);
      expect((await verifyRoles(client)).ok).toBe(true);
    } finally {
      await client.end();
    }
  });
});
