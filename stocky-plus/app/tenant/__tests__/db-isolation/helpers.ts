/**
 * Shared helpers for PR 3 database-isolation tests.
 * Uses migration-owner for schema setup and restricted runtime for TenantDb.
 */
import { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyEnforcement } from "../../../../scripts/tenant-enforcement/apply";
import {
  defaultRuntimeRoleName,
  getMigrationClient,
  resolveMigrationDatabaseUrl,
  resolveRuntimeDatabaseUrl,
} from "../../../../scripts/tenant-enforcement/connection";
import { provisionRoles } from "../../../../scripts/tenant-enforcement/roles";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

export const SHOP_A_DOMAIN = "phase1-pr3-shop-a.myshopify.com";
export const SHOP_B_DOMAIN = "phase1-pr3-shop-b.myshopify.com";
export const SHARED_EXTERNAL_ID = "gid://shopify/ProductVariant/pr3-999001";

export function requireMigrationUrl(): string {
  return resolveMigrationDatabaseUrl({ requireExplicit: false });
}

function requireRuntimeRolePassword(): string {
  const password = process.env.STOCKY_RUNTIME_ROLE_PASSWORD?.trim();
  if (!password) {
    throw new Error(
      "STOCKY_RUNTIME_ROLE_PASSWORD is required for database-isolation tests",
    );
  }
  return password;
}

export function requireRuntimeUrl(): string {
  // Isolation suite always requires an explicit runtime URL.
  process.env.STOCKY_REQUIRE_RUNTIME_DB_URL = "1";
  return resolveRuntimeDatabaseUrl({ requireRuntime: true });
}

export function createMigrationPrisma(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: requireMigrationUrl() } },
  });
}

export function createRuntimePrisma(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: requireRuntimeUrl() } },
  });
}

export async function resetAndEnforce(): Promise<{
  migrationPrisma: PrismaClient;
  runtimePrisma: PrismaClient;
}> {
  const migrationUrl = requireMigrationUrl();
  // Ensure TENANT_MAINTENANCE / MIGRATION URL set for mutating tools
  if (!process.env.TENANT_MAINTENANCE_DATABASE_URL) {
    process.env.TENANT_MAINTENANCE_DATABASE_URL = migrationUrl;
  }
  if (!process.env.DATABASE_MIGRATION_URL) {
    process.env.DATABASE_MIGRATION_URL = migrationUrl;
  }
  // Disposable fixture tests may edit allowlisted harness files after the
  // checked-in PR2 inventory was generated; CI still enforces inventory freshness.
  process.env.STOCKY_PREFLIGHT_SKIP_ACCESS_INVENTORY = "1";
  const runtimePassword = requireRuntimeRolePassword();

  const migrationPrisma = createMigrationPrisma();
  await migrationPrisma.$executeRawUnsafe(`DROP SCHEMA public CASCADE`);
  await migrationPrisma.$executeRawUnsafe(`CREATE SCHEMA public`);
  await migrationPrisma.$executeRawUnsafe(
    `GRANT ALL ON SCHEMA public TO public`,
  );
  await migrationPrisma.$executeRawUnsafe(
    `GRANT ALL ON SCHEMA public TO CURRENT_USER`,
  );

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: APP_ROOT,
    env: { ...process.env, DATABASE_URL: migrationUrl },
    stdio: "pipe",
  });

  execFileSync("npm", ["run", "tenant:indexes:apply", "--", "--apply"], {
    cwd: APP_ROOT,
    env: {
      ...process.env,
      DATABASE_URL: migrationUrl,
      TENANT_MAINTENANCE_DATABASE_URL: migrationUrl,
    },
    stdio: "pipe",
  });

  const client = await getMigrationClient({
    requireExplicitMigrationUrl: true,
  });
  try {
    const roles = await provisionRoles(client, {
      apply: true,
      phase: "prepare",
    });
    if (!roles.ok) {
      throw new Error(`role provision failed: ${roles.errors.join(",")}`);
    }

    // Build runtime URL if not set (CI/local disposable).
    if (!process.env.DATABASE_RUNTIME_URL) {
      const runtimeRole = defaultRuntimeRoleName();
      const u = new URL(migrationUrl);
      u.username = runtimeRole;
      u.password = runtimePassword;
      process.env.DATABASE_RUNTIME_URL = u.toString();
    }

    const apply = await applyEnforcement(client, { apply: true });
    if (!apply.ok) {
      const failed = apply.steps.filter((s) => s.status === "failed");
      throw new Error(
        `enforcement apply failed: preflightOk=${apply.preflightOk}; failed=${failed
          .map((s) => `${s.id}:${s.error}`)
          .join(";")}; steps=${apply.steps
          .map((s) => `${s.id}:${s.status}`)
          .slice(0, 5)
          .join(",")}`,
      );
    }
  } finally {
    await client.end();
  }

  return {
    migrationPrisma,
    runtimePrisma: createRuntimePrisma(),
  };
}

export async function seedTwoShops(prisma: PrismaClient) {
  const shopA = await prisma.shop.create({
    data: { myshopifyDomain: SHOP_A_DOMAIN },
  });
  const shopB = await prisma.shop.create({
    data: { myshopifyDomain: SHOP_B_DOMAIN },
  });
  return { shopA, shopB };
}

export async function withRuntimePg<T>(
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: requireRuntimeUrl() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function withMigrationPg<T>(
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: requireMigrationUrl() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
