/**
 * Phase 1 PR 1 — tenant compatibility index CONCURRENTLY tooling tests.
 * Requires DATABASE_URL / TENANT_MAINTENANCE_DATABASE_URL on disposable PostgreSQL 16.
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import { normalizeIndexDef, TENANT_COMPATIBILITY_INDEXES } from "../manifest";
import { inspectIndex } from "../inspect";
import { classifyIndex } from "../classify";
import { planIndexes } from "../plan";
import { applyIndexes } from "../apply";
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

async function dropAllManifestIndexes(client: Client) {
  for (const entry of [...TENANT_COMPATIBILITY_INDEXES].reverse()) {
    await client.query(`DROP INDEX IF EXISTS "${entry.name}"`);
  }
}

async function withMaintenanceClient<T>(
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

describe("tenant compatibility index manifest", () => {
  it("lists 28 expected indexes", () => {
    expect(TENANT_COMPATIBILITY_INDEXES).toHaveLength(28);
  });

  it("normalizeIndexDef lowercases and collapses whitespace", () => {
    expect(normalizeIndexDef("  CREATE   INDEX  foo  ")).toBe(
      "create index foo",
    );
  });
});

describe("tenant compatibility indexes on PostgreSQL", () => {
  const prisma = new PrismaClient({
    datasources: { db: { url: DATABASE_URL } },
  });

  beforeAll(() => {
    run("npx", ["prisma", "generate"]);
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("reports all missing after migrate deploy without apply", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      const plan = await planIndexes(client);
      expect(plan.every((row) => row.status === "missing")).toBe(true);
      const verify = await verifyIndexes(client);
      expect(verify.ok).toBe(false);
    });
  }, 180_000);

  it("apply then verify when all missing; second apply skips", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      const first = await applyIndexes(client, { apply: true });
      expect(first.created).toHaveLength(28);
      expect(first.skipped).toHaveLength(0);

      const verify = await verifyIndexes(client);
      expect(verify.ok).toBe(true);

      const second = await applyIndexes(client, { apply: true });
      expect(second.created).toHaveLength(0);
      expect(second.skipped).toHaveLength(28);
    });
  }, 300_000);

  it("matches pg_get_indexdef normalization for a sample index after apply", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      await applyIndexes(client, { apply: true });
      const entry = TENANT_COMPATIBILITY_INDEXES.find(
        (e) => e.name === "Supplier_shopId_idx",
      )!;
      const inspected = await inspectIndex(client, entry.name);
      expect(inspected.status).toBe("present");
      if (inspected.status === "present") {
        expect(classifyIndex(entry, inspected)).toBe("valid_exact");
      }
    });
  }, 300_000);

  it("apply fails closed when same-name index is invalid", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      await client.query(
        `CREATE INDEX "Supplier_shopId_idx" ON "Supplier" ("shopId")`,
      );
      await client.query(`
        UPDATE pg_index
        SET indisvalid = false
        WHERE indexrelid = '"Supplier_shopId_idx"'::regclass
      `);

      await expect(applyIndexes(client, { apply: true })).rejects.toThrow(
        /invalid or mismatched/i,
      );
    });
  }, 180_000);

  it("apply fails closed on wrong definition (columns)", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      await client.query(
        `CREATE INDEX "Supplier_shopId_idx" ON "Supplier" ("name")`,
      );
      const entry = TENANT_COMPATIBILITY_INDEXES.find(
        (e) => e.name === "Supplier_shopId_idx",
      )!;
      const inspected = await inspectIndex(client, entry.name);
      expect(classifyIndex(entry, inspected)).toBe("wrong_definition");

      await expect(applyIndexes(client, { apply: true })).rejects.toThrow(
        /invalid or mismatched/i,
      );
    });
  }, 180_000);

  it("apply fails closed on wrong uniqueness", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      await client.query(
        `CREATE UNIQUE INDEX "Supplier_shopId_idx" ON "Supplier" ("shopId")`,
      );
      await expect(applyIndexes(client, { apply: true })).rejects.toThrow(
        /invalid or mismatched/i,
      );
    });
  }, 180_000);

  it("verify fails when indexes were dropped after apply", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      await applyIndexes(client, { apply: true });
      await dropAllManifestIndexes(client);
      const verify = await verifyIndexes(client);
      expect(verify.ok).toBe(false);
      expect(verify.mismatches.length).toBeGreaterThan(0);
    });
  }, 300_000);
});
