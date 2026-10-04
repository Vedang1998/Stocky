/**
 * Prisma migrate-diff schema drift vs independent index-manifest verify (R1).
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import { applyIndexes } from "../apply";
import {
  assertNoPrismaSchemaDrift,
  runPrismaSchemaDriftDiff,
} from "../drift-lib";
import { TENANT_COMPATIBILITY_INDEXES } from "../manifest";
import { verifyIndexes } from "../verify";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, "..", "..", "..");

const DATABASE_URL =
  process.env.TENANT_MAINTENANCE_DATABASE_URL ??
  process.env.TENANT_MIGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://stocky:stocky@localhost:5432/stocky_plus_migrations";

function run(cmd: string, args: string[]) {
  return execFileSync(cmd, args, {
    cwd: APP_ROOT,
    env: {
      ...process.env,
      DATABASE_URL,
      TENANT_MAINTENANCE_DATABASE_URL: DATABASE_URL,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function resetPublicSchema(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`DROP SCHEMA public CASCADE`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA public`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO stocky`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO public`);
}

describe("prisma schema drift check", () => {
  const prisma = new PrismaClient({
    datasources: { db: { url: DATABASE_URL } },
  });

  beforeAll(() => {
    run("npx", ["prisma", "generate"]);
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("complete migrated-and-indexed database passes drift and verify separately", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      await applyIndexes(client, { apply: true });
      const verify = await verifyIndexes(client);
      expect(verify.ok).toBe(true);
    } finally {
      await client.end();
    }

    const diff = runPrismaSchemaDriftDiff(DATABASE_URL);
    expect(diff.exitCode).toBe(0);
    expect(() => assertNoPrismaSchemaDrift(DATABASE_URL)).not.toThrow();

    const typeClient = new Client({ connectionString: DATABASE_URL });
    await typeClient.connect();
    try {
      const types = await typeClient.query<{
        table_name: string;
        column_name: string;
        data_type: string;
        datetime_precision: number | null;
      }>(
        `SELECT table_name, column_name, data_type, datetime_precision
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND (table_name, column_name) IN (
             ('AuditEvent', 'createdAt'),
             ('PrivacyAttempt', 'createdAt'),
             ('PrivacyAttempt', 'updatedAt'),
             ('OriginalAdminCapture', 'capturedAt')
           )
         ORDER BY table_name, column_name`,
      );
      const byCol = Object.fromEntries(
        types.rows.map((r) => [`${r.table_name}.${r.column_name}`, r]),
      );
      expect(byCol["AuditEvent.createdAt"]?.data_type).toBe(
        "timestamp with time zone",
      );
      expect(byCol["AuditEvent.createdAt"]?.datetime_precision).toBe(3);
      expect(byCol["PrivacyAttempt.createdAt"]?.data_type).toBe(
        "timestamp with time zone",
      );
      expect(byCol["OriginalAdminCapture.capturedAt"]?.data_type).toBe(
        "timestamp with time zone",
      );
      expect(byCol["PrivacyAttempt.updatedAt"]?.data_type).toBe(
        "timestamp without time zone",
      );

      const indexes = await typeClient.query<{ relname: string }>(
        `SELECT c.relname
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relkind = 'i'
           AND c.relname IN (
             'OriginalAdminCapture_canonicalDomain_sourceKind_sourceIdent_key',
             'OriginalAdminCapture_canonicalDomain_sourceKind_sourceIdentity_',
             'PrivacyCustomerTargetBarrier_shopId_generationId_targetKind_idx',
             'PrivacyCustomerTargetBarrier_shopId_generationId_targetKind_tar'
           )`,
      );
      const names = indexes.rows.map((r) => r.relname).sort();
      expect(names).toEqual([
        "OriginalAdminCapture_canonicalDomain_sourceKind_sourceIdent_key",
        "PrivacyCustomerTargetBarrier_shopId_generationId_targetKind_idx",
      ]);
    } finally {
      await typeClient.end();
    }
  }, 300_000);

  it("dropping one expected compatibility index fails both verify and prisma drift", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      await applyIndexes(client, { apply: true });
      await client.query(`DROP INDEX "Supplier_shopId_idx"`);

      const verify = await verifyIndexes(client);
      expect(verify.ok).toBe(false);
      expect(
        verify.mismatches.some((m) => m.name === "Supplier_shopId_idx"),
      ).toBe(true);
    } finally {
      await client.end();
    }

    const diff = runPrismaSchemaDriftDiff(DATABASE_URL);
    expect(diff.exitCode).toBe(2);
    expect(() => assertNoPrismaSchemaDrift(DATABASE_URL)).toThrow(/drift/i);
  }, 300_000);

  it("altering another Prisma-declared schema object fails prisma drift while manifest verify can still pass", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      await applyIndexes(client, { apply: true });
      const verifyBefore = await verifyIndexes(client);
      expect(verifyBefore.ok).toBe(true);

      // Drop a non-index Prisma column — independent of compatibility-index manifest.
      await client.query(
        `ALTER TABLE "Supplier" DROP COLUMN IF EXISTS "vendorNotes"`,
      );

      const verifyAfter = await verifyIndexes(client);
      expect(verifyAfter.ok).toBe(true);
      expect(TENANT_COMPATIBILITY_INDEXES.length).toBe(44);
    } finally {
      await client.end();
    }

    const diff = runPrismaSchemaDriftDiff(DATABASE_URL);
    expect(diff.exitCode).toBe(2);
    expect(() => assertNoPrismaSchemaDrift(DATABASE_URL)).toThrow(/drift/i);
  }, 300_000);

  it("reverting a PR7 timestamptz column to timestamp fails prisma drift", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      await applyIndexes(client, { apply: true });
      await client.query(
        `ALTER TABLE "AuditEvent"
         ALTER COLUMN "createdAt" TYPE TIMESTAMP(3)
         USING "createdAt" AT TIME ZONE 'UTC'`,
      );
    } finally {
      await client.end();
    }

    const diff = runPrismaSchemaDriftDiff(DATABASE_URL);
    expect(diff.exitCode).toBe(2);
    expect(() => assertNoPrismaSchemaDrift(DATABASE_URL)).toThrow(/drift/i);
  }, 300_000);
});
