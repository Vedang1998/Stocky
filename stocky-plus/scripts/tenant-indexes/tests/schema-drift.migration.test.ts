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
      expect(TENANT_COMPATIBILITY_INDEXES.length).toBe(28);
    } finally {
      await client.end();
    }

    const diff = runPrismaSchemaDriftDiff(DATABASE_URL);
    expect(diff.exitCode).toBe(2);
    expect(() => assertNoPrismaSchemaDrift(DATABASE_URL)).toThrow(/drift/i);
  }, 300_000);
});
