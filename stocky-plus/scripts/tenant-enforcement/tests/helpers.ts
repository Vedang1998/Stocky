/**
 * Shared helpers for PR 3 correction adversarial tests.
 */
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyEnforcement } from "../apply";
import { getMigrationClient, resolveMigrationDatabaseUrl } from "../connection";
import { provisionRoles } from "../roles";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

export function requireRuntimeRolePassword(): string {
  const password = process.env.STOCKY_RUNTIME_ROLE_PASSWORD?.trim();
  if (!password) {
    throw new Error(
      "STOCKY_RUNTIME_ROLE_PASSWORD is required for enforcement tests (no hardcoded fallback)",
    );
  }
  return password;
}

export function ensureEnforcementTestEnv(): string {
  const url = resolveMigrationDatabaseUrl({ requireExplicit: false });
  const runtimePassword = requireRuntimeRolePassword();
  process.env.TENANT_MAINTENANCE_DATABASE_URL =
    process.env.TENANT_MAINTENANCE_DATABASE_URL || url;
  process.env.DATABASE_MIGRATION_URL =
    process.env.DATABASE_MIGRATION_URL || url;
  process.env.DATABASE_URL = process.env.DATABASE_URL || url;
  process.env.STOCKY_PREFLIGHT_SKIP_ACCESS_INVENTORY = "1";
  // F-PR3C-17: never invent a password — require explicit env (CI supplies it).
  if (!process.env.DATABASE_RUNTIME_URL) {
    const u = new URL(url);
    u.username = process.env.STOCKY_RUNTIME_ROLE || "stocky_runtime";
    u.password = runtimePassword;
    process.env.DATABASE_RUNTIME_URL = u.toString();
  }
  return url;
}

export async function resetSchemaAndApplyEnforcement(options?: {
  acknowledgeDangerousDriftRepair?: boolean;
}): Promise<{
  prisma: PrismaClient;
}> {
  const url = ensureEnforcementTestEnv();
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  await prisma.$executeRawUnsafe(`DROP SCHEMA public CASCADE`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA public`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO public`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO CURRENT_USER`);
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

  const client = await getMigrationClient({
    requireExplicitMigrationUrl: true,
  });
  try {
    const prep = await provisionRoles(client, {
      apply: true,
      phase: "prepare",
    });
    if (!prep.ok) {
      throw new Error(`prepare failed: ${prep.errors.join(",")}`);
    }
    const apply = await applyEnforcement(client, {
      apply: true,
      acknowledgeDangerousDriftRepair:
        options?.acknowledgeDangerousDriftRepair === true,
    });
    if (!apply.ok) {
      throw new Error(
        `apply failed: ${apply.steps
          .filter((s) => s.status === "failed")
          .map((s) => `${s.id}:${s.error}`)
          .join(";")}`,
      );
    }
  } finally {
    await client.end();
  }
  return { prisma };
}
