/**
 * Phase 1 PR 1 — tenant compatibility index CONCURRENTLY tooling tests (R2/R3).
 * Requires DATABASE_URL / TENANT_MAINTENANCE_DATABASE_URL on disposable PostgreSQL 16.
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import { applyIndexes, recoveryInstruction } from "../apply";
import { classifyIndex } from "../classify";
import { getMaintenanceClient } from "../connection";
import { inspectIndex } from "../inspect";
import { normalizeIndexDef, TENANT_COMPATIBILITY_INDEXES } from "../manifest";
import { planIndexes } from "../plan";
import { verifyIndexes } from "../verify";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, "..", "..", "..");

const DATABASE_URL =
  process.env.TENANT_MAINTENANCE_DATABASE_URL ??
  process.env.TENANT_MIGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://stocky:stocky@localhost:5432/stocky_plus_migrations";

/** Concurrent-write acceptance threshold during CONCURRENTLY index build. */
const CONCURRENT_WRITE_THRESHOLD_MS = 15_000;
const CONCURRENT_INDEX_ROW_COUNT = 20_000;

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
  const client = await getMaintenanceClient();
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

  it("valid exact after apply; rerun idempotency skips all", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      const first = await applyIndexes(client, { apply: true });
      expect(first.created).toHaveLength(28);
      expect(first.skipped).toHaveLength(0);

      const plan = await planIndexes(client);
      expect(plan.every((row) => row.status === "valid_exact")).toBe(true);

      const verify = await verifyIndexes(client);
      expect(verify.ok).toBe(true);

      const second = await applyIndexes(client, { apply: true });
      expect(second.created).toHaveLength(0);
      expect(second.skipped).toHaveLength(28);
    });
  }, 300_000);

  it("classifies missing explicitly", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);
    await withMaintenanceClient(async (client) => {
      const entry = TENANT_COMPATIBILITY_INDEXES.find(
        (e) => e.name === "Supplier_shopId_idx",
      )!;
      const inspected = await inspectIndex(client, entry.name);
      expect(classifyIndex(entry, inspected)).toBe("missing");
    });
  }, 180_000);

  it("wrong-table collision: plan wrong_table; apply/verify fail-closed; no auto-drop", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      await client.query(
        `CREATE INDEX "Supplier_shopId_idx" ON "ShopSettings" ("shopId")`,
      );

      const entry = TENANT_COMPATIBILITY_INDEXES.find(
        (e) => e.name === "Supplier_shopId_idx",
      )!;
      const inspected = await inspectIndex(client, entry.name);
      expect(classifyIndex(entry, inspected)).toBe("wrong_table");

      const plan = await planIndexes(client);
      expect(
        plan.find((p) => p.entry.name === "Supplier_shopId_idx")?.status,
      ).toBe("wrong_table");

      await expect(applyIndexes(client, { apply: true })).rejects.toThrow(
        /DROP INDEX CONCURRENTLY/i,
      );

      const stillThere = await inspectIndex(client, "Supplier_shopId_idx");
      expect(stillThere.status).toBe("present");
      if (stillThere.status === "present") {
        expect(stillThere.table).toBe("ShopSettings");
      }

      const verify = await verifyIndexes(client);
      expect(verify.ok).toBe(false);
    });
  }, 180_000);

  it("wrong uniqueness classification and fail-closed apply", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      await client.query(
        `CREATE UNIQUE INDEX "Supplier_shopId_idx" ON "Supplier" ("shopId")`,
      );
      const entry = TENANT_COMPATIBILITY_INDEXES.find(
        (e) => e.name === "Supplier_shopId_idx",
      )!;
      const inspected = await inspectIndex(client, entry.name);
      expect(classifyIndex(entry, inspected)).toBe("wrong_uniqueness");
      await expect(applyIndexes(client, { apply: true })).rejects.toThrow(
        /invalid or mismatched/i,
      );
      const verify = await verifyIndexes(client);
      expect(verify.ok).toBe(false);
    });
  }, 180_000);

  it("wrong ordered columns / same name wrong definition", async () => {
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

  it("genuine failed CREATE UNIQUE INDEX CONCURRENTLY leaves invalid index; no silent repair", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      // Two rows sharing shopId so UNIQUE(shopId) cannot complete.
      await client.query(`
        INSERT INTO "Supplier" (id, shop, name, "shopId", "createdAt", "updatedAt")
        VALUES
          ('sup-dup-a', 'dup-a.myshopify.com', 'A', 'shared-shop-id', NOW(), NOW()),
          ('sup-dup-b', 'dup-b.myshopify.com', 'B', 'shared-shop-id', NOW(), NOW())
      `);

      await expect(
        client.query(
          `CREATE UNIQUE INDEX CONCURRENTLY "Supplier_shopId_idx" ON "Supplier" ("shopId")`,
        ),
      ).rejects.toThrow();

      const inspected = await inspectIndex(client, "Supplier_shopId_idx");
      expect(inspected.status).toBe("present");
      if (inspected.status !== "present") {
        throw new Error("expected invalid index remnant");
      }
      expect(inspected.indisvalid === false || inspected.indisready === false).toBe(
        true,
      );

      const entry = TENANT_COMPATIBILITY_INDEXES.find(
        (e) => e.name === "Supplier_shopId_idx",
      )!;
      expect(classifyIndex(entry, inspected)).toBe("invalid");

      const plan = await planIndexes(client);
      expect(
        plan.find((p) => p.entry.name === "Supplier_shopId_idx")?.status,
      ).toBe("invalid");

      await expect(applyIndexes(client, { apply: true })).rejects.toThrow(
        /explicitly authorized/i,
      );
      expect(recoveryInstruction("Supplier_shopId_idx")).toMatch(
        /DROP INDEX CONCURRENTLY/i,
      );

      const still = await inspectIndex(client, "Supplier_shopId_idx");
      expect(still.status).toBe("present");

      const verify = await verifyIndexes(client);
      expect(verify.ok).toBe(false);
    });
  }, 180_000);

  it("statement timeout failure leaves data intact with clear recovery path", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await clientPopulateSuppliers(prisma, 5_000);

    const client = await getMaintenanceClient({ statementTimeoutMs: 1 });
    try {
      await expect(
        client.query(
          `CREATE INDEX CONCURRENTLY "Supplier_shopId_idx" ON "Supplier" ("shopId")`,
        ),
      ).rejects.toThrow(/canceling statement due to statement timeout|timeout/i);

      const count = await client.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM "Supplier"`,
      );
      expect(Number(count.rows[0]!.c)).toBeGreaterThanOrEqual(5_000);

      const inspected = await inspectIndex(client, "Supplier_shopId_idx");
      // May be missing or invalid remnant; tool must not auto-drop either way.
      if (inspected.status === "present") {
        expect(recoveryInstruction("Supplier_shopId_idx")).toMatch(
          /DROP INDEX CONCURRENTLY/i,
        );
      }
    } finally {
      await client.end();
    }
  }, 300_000);

  it("concurrent representative writes remain available during CONCURRENTLY index build", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      await applyIndexes(client, { apply: true });
      await client.query(`DROP INDEX CONCURRENTLY IF EXISTS "Supplier_shopId_idx"`);
    });

    await clientPopulateSuppliers(prisma, CONCURRENT_INDEX_ROW_COUNT);

    const builder = await getMaintenanceClient();
    const writer = new Client({ connectionString: DATABASE_URL });
    await writer.connect();

    const evidence: Record<string, unknown> = {
      rowCount: CONCURRENT_INDEX_ROW_COUNT,
      writeThresholdMs: CONCURRENT_WRITE_THRESHOLD_MS,
      environment: {
        node: process.version,
        platform: process.platform,
        databaseUrlHost: new URL(DATABASE_URL).host,
      },
    };

    try {
      const buildStarted = Date.now();
      const buildPromise = builder.query(
        `CREATE INDEX CONCURRENTLY "Supplier_shopId_idx" ON "Supplier" ("shopId")`,
      );

      // Give the concurrent build a moment to take ShareUpdateExclusiveLock.
      await new Promise((r) => setTimeout(r, 50));

      const lockSnapshot = await writer.query<{
        mode: string;
        granted: boolean;
      }>(
        `
        SELECT mode, granted
        FROM pg_locks l
        JOIN pg_class c ON c.oid = l.relation
        WHERE c.relname = 'Supplier'
          AND l.locktype = 'relation'
        `,
      );
      evidence.lockModes = lockSnapshot.rows.map((r) => ({
        mode: r.mode,
        granted: r.granted,
      }));
      expect(
        lockSnapshot.rows.every((r) => r.mode !== "AccessExclusiveLock"),
      ).toBe(true);

      const insertStarted = Date.now();
      await writer.query(
        `INSERT INTO "Supplier" (id, shop, name, "createdAt", "updatedAt")
         VALUES ('sup-concurrent-ins', 'write-probe.myshopify.com', 'W', NOW(), NOW())`,
      );
      const insertMs = Date.now() - insertStarted;

      const updateStarted = Date.now();
      await writer.query(
        `UPDATE "Supplier" SET name = 'W2' WHERE id = 'sup-concurrent-ins'`,
      );
      const updateMs = Date.now() - updateStarted;

      const deleteStarted = Date.now();
      await writer.query(`DELETE FROM "Supplier" WHERE id = 'sup-concurrent-ins'`);
      const deleteMs = Date.now() - deleteStarted;

      evidence.writeDurationsMs = { insertMs, updateMs, deleteMs };
      expect(insertMs).toBeLessThan(CONCURRENT_WRITE_THRESHOLD_MS);
      expect(updateMs).toBeLessThan(CONCURRENT_WRITE_THRESHOLD_MS);
      expect(deleteMs).toBeLessThan(CONCURRENT_WRITE_THRESHOLD_MS);

      await buildPromise;
      evidence.buildDurationMs = Date.now() - buildStarted;

      const entry = TENANT_COMPATIBILITY_INDEXES.find(
        (e) => e.name === "Supplier_shopId_idx",
      )!;
      const inspected = await inspectIndex(builder, entry.name);
      expect(classifyIndex(entry, inspected)).toBe("valid_exact");
      if (inspected.status === "present") {
        expect(inspected.indisvalid).toBe(true);
        expect(inspected.indisready).toBe(true);
      }

      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify({ event: "tenant_index_concurrent_write_evidence", ...evidence }),
      );
    } finally {
      await builder.end();
      await writer.end();
    }
  }, 600_000);

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

async function clientPopulateSuppliers(
  prisma: PrismaClient,
  count: number,
): Promise<void> {
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Supplier" (id, shop, name, "createdAt", "updatedAt")
    SELECT
      'sup-bulk-' || g,
      'bulk.myshopify.com',
      'Name-' || g,
      NOW(),
      NOW()
    FROM generate_series(1, ${count}) AS g
  `);
}
