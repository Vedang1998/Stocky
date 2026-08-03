/**
 * Application-runtime connected identity gate (F-PR3C-01).
 *
 * These tests exercise the singleton used by app/db.server.ts, not only the
 * maintenance pg helper. A privileged connection must be rejected before a
 * merchant model delegate can run.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import appPrisma, {
  assertSafeRuntimeConnectedIdentity,
  getVerifiedRuntimePrisma,
} from "../../../app/db.server";
import {
  pgClientAsIdentityClient,
  resetVerifiedPrismaSingletonForTests,
} from "../../../app/db/runtime-identity.server";
import { getMigrationClient } from "../connection";
import { quoteIdent } from "../sql";
import {
  ensureEnforcementTestEnv,
  resetSchemaAndApplyEnforcement,
} from "./helpers";

const URL_ENV_KEYS = [
  "DATABASE_RUNTIME_URL",
  "DATABASE_MIGRATION_URL",
  "TENANT_MAINTENANCE_DATABASE_URL",
  "DATABASE_URL",
] as const;

async function withRuntimeEnvironment<T>(
  runtimeUrl: string,
  options: { hideMigrationUrls?: boolean } = {},
  fn: () => Promise<T>,
): Promise<T> {
  const saved = Object.fromEntries(
    URL_ENV_KEYS.map((key) => [key, process.env[key]]),
  ) as Record<(typeof URL_ENV_KEYS)[number], string | undefined>;
  const savedRequireRuntime = process.env.STOCKY_REQUIRE_RUNTIME_DB_URL;
  await resetVerifiedPrismaSingletonForTests();
  try {
    process.env.DATABASE_RUNTIME_URL = runtimeUrl;
    process.env.STOCKY_REQUIRE_RUNTIME_DB_URL = "1";
    if (options.hideMigrationUrls) {
      delete process.env.DATABASE_MIGRATION_URL;
      delete process.env.TENANT_MAINTENANCE_DATABASE_URL;
      delete process.env.DATABASE_URL;
    }
    return await fn();
  } finally {
    await resetVerifiedPrismaSingletonForTests();
    for (const key of URL_ENV_KEYS) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (savedRequireRuntime === undefined) {
      delete process.env.STOCKY_REQUIRE_RUNTIME_DB_URL;
    } else {
      process.env.STOCKY_REQUIRE_RUNTIME_DB_URL = savedRequireRuntime;
    }
  }
}

function migrationUrl(): string {
  return (
    process.env.DATABASE_MIGRATION_URL ||
    process.env.TENANT_MAINTENANCE_DATABASE_URL ||
    process.env.DATABASE_URL!
  );
}

function aliasedUrl(url: string): string {
  let alias = url.replace(/^postgresql:/, "postgres:");
  alias = alias.replace("localhost", "127.0.0.1");
  alias += alias.includes("?") ? "&schema=public" : "?schema=public";
  return alias;
}

async function tableOwner(client: Client): Promise<string> {
  const owner = await client.query<{ owner: string }>(
    `SELECT r.rolname AS owner
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_roles r ON r.oid = c.relowner
     WHERE n.nspname = 'public'
       AND c.relname = 'Supplier'
       AND c.relkind = 'r'`,
  );
  return owner.rows[0].owner;
}

describe.sequential(
  "application runtime connected-identity verification",
  () => {
    let prisma: PrismaClient;

    beforeAll(async () => {
      ensureEnforcementTestEnv();
      ({ prisma } = await resetSchemaAndApplyEnforcement());
      await resetVerifiedPrismaSingletonForTests();
    }, 300_000);

    afterAll(async () => {
      await resetVerifiedPrismaSingletonForTests();
      await prisma?.$disconnect();
    });

    it("accepts the restricted stocky_runtime identity before merchant SELECT", async () => {
      const client = await getVerifiedRuntimePrisma();

      // The exported application proxy gates this merchant delegate on the same
      // verified singleton before Prisma can issue its SELECT.
      const rows = await appPrisma.supplier.findMany({ take: 1 });
      expect(rows).toEqual([]);
      expect(client).toBe(await getVerifiedRuntimePrisma());

      // Also prove the configured role's identity directly using the shared gate.
      const runtime = new Client({
        connectionString: process.env.DATABASE_RUNTIME_URL!,
      });
      await runtime.connect();
      try {
        const connected = await assertSafeRuntimeConnectedIdentity(
          pgClientAsIdentityClient(runtime),
        );
        expect(connected.currentUser).toBe("stocky_runtime");
        expect(connected.rolbypassrls).toBe(false);
      } finally {
        await runtime.end();
      }
    });

    it("rejects the configured migration-owner URL", async () => {
      await expect(
        withRuntimeEnvironment(migrationUrl(), {}, () =>
          getVerifiedRuntimePrisma(),
        ),
      ).rejects.toThrow(/semantic identity|runtime_identity_rejected/i);
    });

    it("rejects a connected BYPASSRLS runtime role", async () => {
      const migration = await getMigrationClient({
        requireExplicitMigrationUrl: true,
      });
      try {
        await migration.query(`ALTER ROLE stocky_runtime BYPASSRLS`);
        await resetVerifiedPrismaSingletonForTests();
        await expect(getVerifiedRuntimePrisma()).rejects.toThrow(
          /runtime_identity_rejected:.*runtime_connected_bypassrls/i,
        );
      } finally {
        await migration.query(`ALTER ROLE stocky_runtime NOBYPASSRLS`);
        await migration.end();
        await resetVerifiedPrismaSingletonForTests();
      }
    });

    it("rejects direct membership in the table-owner role", async () => {
      const migration = await getMigrationClient({
        requireExplicitMigrationUrl: true,
      });
      const owner = await tableOwner(migration);
      try {
        await migration.query(
          `GRANT ${quoteIdent(owner)} TO ${quoteIdent("stocky_runtime")}`,
        );
        await resetVerifiedPrismaSingletonForTests();
        await expect(getVerifiedRuntimePrisma()).rejects.toThrow(
          /runtime_identity_rejected:.*runtime_has_role_membership/i,
        );
      } finally {
        await migration.query(
          `REVOKE ${quoteIdent(owner)} FROM ${quoteIdent("stocky_runtime")}`,
        );
        await migration.end();
        await resetVerifiedPrismaSingletonForTests();
      }
    });

    it("rejects transitive membership in the table-owner role", async () => {
      const migration = await getMigrationClient({
        requireExplicitMigrationUrl: true,
      });
      const owner = await tableOwner(migration);
      try {
        await migration.query(
          `CREATE ROLE stocky_runtime_identity_mid NOLOGIN`,
        );
        await migration.query(
          `GRANT ${quoteIdent(owner)} TO stocky_runtime_identity_mid`,
        );
        await migration.query(
          `GRANT stocky_runtime_identity_mid TO stocky_runtime`,
        );
        await resetVerifiedPrismaSingletonForTests();
        await expect(getVerifiedRuntimePrisma()).rejects.toThrow(
          /runtime_identity_rejected:.*runtime_has_role_membership/i,
        );
      } finally {
        await migration.query(
          `REVOKE stocky_runtime_identity_mid FROM stocky_runtime`,
        );
        await migration.query(
          `REVOKE ${quoteIdent(owner)} FROM stocky_runtime_identity_mid`,
        );
        await migration.query(`DROP ROLE stocky_runtime_identity_mid`);
        await migration.end();
        await resetVerifiedPrismaSingletonForTests();
      }
    });

    it("shares one verified client across concurrent first initialization", async () => {
      await resetVerifiedPrismaSingletonForTests();
      const clients = await Promise.all(
        Array.from({ length: 24 }, () => getVerifiedRuntimePrisma()),
      );
      expect(new Set(clients).size).toBe(1);
      expect(clients[0]).toBe(global.prismaGlobal);
      expect(global.prismaIdentityVerifiedUrl).toBe(
        process.env.DATABASE_RUNTIME_URL,
      );
    });

    it("re-verifies after reset and rejects a privileged URL", async () => {
      expect(await getVerifiedRuntimePrisma()).toBe(global.prismaGlobal);
      await withRuntimeEnvironment(
        migrationUrl(),
        { hideMigrationUrls: true },
        async () => {
          await expect(
            appPrisma.supplier.findMany({ take: 1 }),
          ).rejects.toThrow(/runtime_identity_rejected/i);
          expect(global.prismaGlobal).toBeUndefined();
          expect(global.prismaIdentityVerifiedUrl).toBeUndefined();
        },
      );
    });

    it("rejects privileged URL aliases through connected identity when migration URLs are absent", async () => {
      await withRuntimeEnvironment(
        aliasedUrl(migrationUrl()),
        { hideMigrationUrls: true },
        async () => {
          await expect(
            appPrisma.supplier.findMany({ take: 1 }),
          ).rejects.toThrow(
            /runtime_identity_rejected:.*runtime_(user|session_user)_mismatch/i,
          );
          expect(global.prismaGlobal).toBeUndefined();
        },
      );
    });
  },
);
