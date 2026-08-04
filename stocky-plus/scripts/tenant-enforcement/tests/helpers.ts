/**
 * Shared helpers for PR 3 correction adversarial tests.
 */
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { applyEnforcement } from "../apply";
import {
  getBootstrapClient,
  getMigrationClient,
  resolveBootstrapDatabaseUrl,
  resolveMigrationDatabaseUrl,
} from "../connection";
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
  // F-PR3C-17 / P3-b: never invent a password — require explicit env (CI supplies it).
  if (!process.env.DATABASE_RUNTIME_URL) {
    const u = new URL(url);
    u.username = process.env.STOCKY_RUNTIME_ROLE || "stocky_runtime";
    u.password = runtimePassword;
    process.env.DATABASE_RUNTIME_URL = u.toString();
  }
  return url;
}

export type NonSuperuserOwnerFixture = {
  databaseName: string;
  migrationOwner: string;
  migrationPassword: string;
  migrationUrl: string;
  runtimeRole: string;
  runtimePassword: string;
  runtimeUrl: string;
  bootstrapUrl: string;
};

/**
 * Bootstrap a disposable database owned by a non-superuser CREATEROLE
 * migration owner, then disconnect bootstrap authority (F-NEW-01).
 */
export async function createNonSuperuserMigrationOwnerFixture(
  label: string,
): Promise<NonSuperuserOwnerFixture> {
  const runtimePassword = requireRuntimeRolePassword();
  const bootstrapUrl = resolveBootstrapDatabaseUrl();
  const suffix = `${label}_${Date.now().toString(36)}`.replace(
    /[^a-z0-9_]/g,
    "_",
  );
  const databaseName = `stocky_nonsu_${suffix}`.slice(0, 63);
  const migrationOwner = `stocky_mig_${suffix}`.slice(0, 63);
  const migrationPassword = `mig_${suffix}`;
  // Roles are cluster-global — use a fixture-local runtime role so other suites
  // sharing stocky_runtime are not mutated by privileged-attribute drift tests.
  const runtimeRole = `stocky_rt_${suffix}`.slice(0, 63);

  const bootstrap = await getBootstrapClient();
  try {
    await bootstrap.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    await bootstrap.query(
      `CREATE ROLE ${migrationOwner} LOGIN PASSWORD '${migrationPassword.replace(/'/g, "''")}' NOSUPERUSER NOCREATEDB CREATEROLE NOBYPASSRLS NOINHERIT`,
    );
    await bootstrap.query(
      `CREATE DATABASE ${databaseName} OWNER ${migrationOwner}`,
    );
    await bootstrap.query(
      `REVOKE ALL ON DATABASE ${databaseName} FROM PUBLIC`,
    );
    await bootstrap.query(
      `GRANT CONNECT, CREATE, TEMP ON DATABASE ${databaseName} TO ${migrationOwner}`,
    );
  } finally {
    await bootstrap.end();
  }

  // Transfer schema ownership as bootstrap, then stop using bootstrap for apply.
  const bootstrapOnDb = new Client({
    connectionString: (() => {
      const u = new URL(bootstrapUrl);
      u.pathname = `/${databaseName}`;
      return u.toString();
    })(),
  });
  await bootstrapOnDb.connect();
  try {
    await bootstrapOnDb.query(
      `ALTER SCHEMA public OWNER TO ${migrationOwner}`,
    );
    await bootstrapOnDb.query(
      `GRANT ALL ON SCHEMA public TO ${migrationOwner}`,
    );
    await bootstrapOnDb.query(`REVOKE ALL ON SCHEMA public FROM PUBLIC`);
  } finally {
    await bootstrapOnDb.end();
  }

  const migrationUrl = (() => {
    const u = new URL(bootstrapUrl);
    u.username = migrationOwner;
    u.password = migrationPassword;
    u.pathname = `/${databaseName}`;
    return u.toString();
  })();
  const runtimeUrl = (() => {
    const u = new URL(migrationUrl);
    u.username = runtimeRole;
    u.password = runtimePassword;
    return u.toString();
  })();

  return {
    databaseName,
    migrationOwner,
    migrationPassword,
    migrationUrl,
    runtimeRole,
    runtimePassword,
    runtimeUrl,
    bootstrapUrl,
  };
}

export async function destroyNonSuperuserMigrationOwnerFixture(
  fixture: NonSuperuserOwnerFixture,
): Promise<void> {
  const bootstrap = await getBootstrapClient();
  try {
    await bootstrap.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [fixture.databaseName],
    );
    await bootstrap.query(`DROP DATABASE IF EXISTS ${fixture.databaseName}`);
    // Drop fixture-local runtime role after DB drop removes dependencies.
    await bootstrap.query(`DROP ROLE IF EXISTS ${fixture.runtimeRole}`);
    await bootstrap.query(`DROP ROLE IF EXISTS ${fixture.migrationOwner}`);
  } finally {
    await bootstrap.end();
  }
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
