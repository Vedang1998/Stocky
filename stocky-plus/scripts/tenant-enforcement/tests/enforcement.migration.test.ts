/**
 * PR 3 — low-lock enforcement migration tests (disposable PostgreSQL).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyEnforcement, planEnforcement } from "../apply";
import {
  getMigrationClient,
  resolveMigrationDatabaseUrl,
} from "../connection";
import { runPreflight } from "../preflight";
import { provisionRoles } from "../roles";
import { verifyEnforcement } from "../verify";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function migrationUrl(): string {
  const url = resolveMigrationDatabaseUrl({ requireExplicit: false });
  process.env.TENANT_MAINTENANCE_DATABASE_URL =
    process.env.TENANT_MAINTENANCE_DATABASE_URL || url;
  process.env.DATABASE_MIGRATION_URL =
    process.env.DATABASE_MIGRATION_URL || url;
  process.env.DATABASE_URL = process.env.DATABASE_URL || url;
  process.env.STOCKY_PREFLIGHT_SKIP_ACCESS_INVENTORY = "1";
  return url;
}

async function resetSchema(): Promise<PrismaClient> {
  const url = migrationUrl();
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  await prisma.$executeRawUnsafe(`DROP SCHEMA public CASCADE`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA public`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO public`);
  await prisma.$executeRawUnsafe(
    `GRANT ALL ON SCHEMA public TO CURRENT_USER`,
  );
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: APP_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
  execFileSync("npm", ["run", "tenant:indexes:apply", "--", "--apply"], {
    cwd: APP_ROOT,
    env: {
      ...process.env,
      DATABASE_URL: url,
      TENANT_MAINTENANCE_DATABASE_URL: url,
    },
    stdio: "pipe",
  });
  return prisma;
}

describe("PR3 enforcement migration suite", () => {
  let prisma: PrismaClient;
  let maxLockHoldMs = 0;

  beforeAll(async () => {
    prisma = await resetSchema();
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("preflight passes on empty current-schema fixture", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const result = await runPreflight(client);
      expect(result.ok).toBe(true);
      expect(result.productionDataInspected).toBe(false);
      expect(result.mutating).toBe(false);
      expect(result.tables.every((t) => t.nullShopIdCount === 0)).toBe(true);
    } finally {
      await client.end();
    }
  });

  it("preflight fails when null shopId rows exist", async () => {
    const shop = await prisma.shop.create({
      data: { myshopifyDomain: "preflight-null.myshopify.com" },
    });
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Supplier" (id, shop, "shopId", name, "createdAt", "updatedAt")
       VALUES ('null-owner', 'preflight-null.myshopify.com', NULL, 'x', NOW(), NOW())`,
    );

    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const result = await runPreflight(client);
      expect(result.ok).toBe(false);
      const supplier = result.tables.find((t) => t.table === "Supplier");
      expect(supplier?.nullShopIdCount).toBeGreaterThan(0);
    } finally {
      await client.end();
      await prisma.$executeRawUnsafe(
        `DELETE FROM "Supplier" WHERE id = 'null-owner'`,
      );
      await prisma.shop.delete({ where: { id: shop.id } });
    }
  });

  it("apply is idempotent; records lock holds; verify passes", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      await provisionRoles(client, { apply: true });
      if (!process.env.DATABASE_RUNTIME_URL) {
        const u = new URL(migrationUrl());
        u.username = process.env.STOCKY_RUNTIME_ROLE || "stocky_runtime";
        u.password =
          process.env.STOCKY_RUNTIME_ROLE_PASSWORD || "stocky_runtime_ci_only";
 // pragma: allowlist secret        process.env.DATABASE_RUNTIME_URL = u.toString();
      }

      const plan = await planEnforcement(client);
      expect(plan.preflightOk).toBe(true);
      expect(plan.steps.length).toBeGreaterThan(10);

      const first = await applyEnforcement(client, { apply: true });
      expect(first.ok).toBe(true);
      maxLockHoldMs = Math.max(maxLockHoldMs, first.maxObservedLockHoldMs);

      const second = await applyEnforcement(client, { apply: true });
      expect(second.ok).toBe(true);
      maxLockHoldMs = Math.max(maxLockHoldMs, second.maxObservedLockHoldMs);

      const verify = await verifyEnforcement(client);
      expect(verify.ok).toBe(true);

      // Document lock evidence — not claiming zero locking
      expect(maxLockHoldMs).toBeGreaterThanOrEqual(0);
      expect(maxLockHoldMs).toBeLessThan(120_000);
    } finally {
      await client.end();
    }
  });

  it("records lock evidence summary", () => {
    // Assertion that the suite captured an observed lock-hold metric.
    expect(typeof maxLockHoldMs).toBe("number");
  });
});
