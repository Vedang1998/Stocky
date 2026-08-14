import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resetPrismaSingletonForTests } from "../../db.server";
import {
  defaultRuntimeRoleName,
  getMigrationClient,
} from "../../../scripts/tenant-enforcement/connection";
import { provisionRoles } from "../../../scripts/tenant-enforcement/roles";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

export const SHOP_A_DOMAIN = "phase1-pr2-shop-a.myshopify.com";
export const SHOP_B_DOMAIN = "phase1-pr2-shop-b.myshopify.com";
export const SHARED_EXTERNAL_ID = "gid://shopify/ProductVariant/999001";

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required for tenant-access integration tests",
    );
  }
  return url;
}

function requireRuntimeRolePassword(): string {
  const password = process.env.STOCKY_RUNTIME_ROLE_PASSWORD?.trim();
  if (!password) {
    throw new Error(
      "STOCKY_RUNTIME_ROLE_PASSWORD is required for tenant-access integration tests",
    );
  }
  return password;
}

export function createPrisma(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: requireDatabaseUrl() } },
  });
}

/**
 * Re-grant the restricted runtime role after a schema wipe.
 *
 * CI sets DATABASE_RUNTIME_URL to stocky_runtime. DROP SCHEMA CASCADE +
 * migrate deploy recreates merchant tables without those grants (and default
 * privileges intentionally do not auto-grant to the runtime role). TenantDb /
 * bootstrap use the runtime URL via db.server, so grants must be restored.
 *
 * Does NOT re-apply FORCE RLS / NOT NULL / composite enforcement — PR 2
 * tenant-access suites (nullable ownership, legacy normalization) require a
 * current-schema catalog where shopId may still be null. PR 3 isolation
 * suites use db-isolation/helpers.resetAndEnforce for full enforcement.
 */
async function regrantRuntimeRoleAfterSchemaReset(
  migrationUrl: string,
): Promise<void> {
  const runtimeConfigured =
    Boolean(process.env.DATABASE_RUNTIME_URL?.trim()) ||
    Boolean(process.env.STOCKY_RUNTIME_ROLE?.trim());
  if (!runtimeConfigured) {
    return;
  }

  if (!process.env.TENANT_MAINTENANCE_DATABASE_URL) {
    process.env.TENANT_MAINTENANCE_DATABASE_URL = migrationUrl;
  }
  if (!process.env.DATABASE_MIGRATION_URL) {
    process.env.DATABASE_MIGRATION_URL = migrationUrl;
  }

  const client = await getMigrationClient({
    requireExplicitMigrationUrl: false,
  });
  try {
    const password = requireRuntimeRolePassword();
    // PR2 tenant-access harness intentionally runs without FORCE RLS; grant
    // merchant DML only under the disposable-test escape hatch.
    process.env.STOCKY_ALLOW_UNRESTRICTED_RUNTIME_GRANTS = "1";
    const roles = await provisionRoles(client, {
      apply: true,
      phase: "test_harness_unrestricted",
    });
    if (!roles.ok) {
      throw new Error(
        `tenant-access harness role provision failed: ${roles.errors.join(",")}`,
      );
    }

    if (!process.env.DATABASE_RUNTIME_URL?.trim()) {
      const runtimeRole = defaultRuntimeRoleName();
      const u = new URL(migrationUrl);
      u.username = runtimeRole;
      u.password = password;
      process.env.DATABASE_RUNTIME_URL = u.toString();
    }
  } finally {
    await client.end();
  }
}

export async function resetPublicSchema(prisma: PrismaClient): Promise<void> {
  // Drop tables and enum/composite types so migrate deploy is clean.
  // Prisma $executeRawUnsafe allows one statement per call.
  await prisma.$executeRawUnsafe(`DROP SCHEMA public CASCADE`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA public`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO public`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO CURRENT_USER`);

  const migrationUrl = requireDatabaseUrl();
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: APP_ROOT,
    env: { ...process.env, DATABASE_URL: migrationUrl },
    stdio: "pipe",
  });

  await regrantRuntimeRoleAfterSchemaReset(migrationUrl);
  // Pooled runtime connections may still target the destroyed catalog.
  await resetPrismaSingletonForTests();
}

export async function wipeSyncControlPlaneTables(
  prisma: PrismaClient,
): Promise<void> {
  // Control-plane FKs to Shop are ON DELETE RESTRICT — clear them before shop.deleteMany.
  // DispatchReadyShop must be included: D-049 fail-safe readiness intentionally leaves
  // readiness rows when DurableJob rows are truncated/deleted, so omitting it blocks
  // shop.deleteMany via DispatchReadyShop_shopId_fkey (tenant queue/Redis CI).
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "DataIssue", "ReconciliationRun", "SyncHealth", "SyncCursor", "SyncRun",
      "JobReplay", "DeadLetter", "JobAttempt", "JobDispatch", "WebhookDelivery",
      "DurableJob", "DispatchReadyShop"
    CASCADE
  `);
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
