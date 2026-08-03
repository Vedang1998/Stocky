/**
 * Runtime Prisma client construction.
 *
 * Production-like runtime must use DATABASE_RUNTIME_URL (restricted role).
 * DATABASE_URL alone must not silently become a privileged production runtime
 * when STOCKY_REQUIRE_RUNTIME_DB_URL=1 or NODE_ENV=production.
 *
 * Migration/maintenance tooling uses DATABASE_MIGRATION_URL /
 * TENANT_MAINTENANCE_DATABASE_URL via scripts/tenant-enforcement/connection.ts
 * and must never be wired through this module for web/worker processes.
 */
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var prismaRuntimeUrl: string | undefined;
}

function resolveRuntimeDatabaseUrl(): string | undefined {
  const runtime = process.env.DATABASE_RUNTIME_URL?.trim() || "";
  const migration =
    process.env.DATABASE_MIGRATION_URL?.trim() ||
    process.env.TENANT_MAINTENANCE_DATABASE_URL?.trim() ||
    "";
  const fallback = process.env.DATABASE_URL?.trim() || "";
  const requireRuntime =
    process.env.STOCKY_REQUIRE_RUNTIME_DB_URL === "1" ||
    process.env.NODE_ENV === "production";

  if (requireRuntime) {
    if (!runtime) {
      throw new Error(
        "DATABASE_RUNTIME_URL is required for production-like runtime (refusing privileged DATABASE_URL fallback)",
      );
    }
    if (migration && runtime === migration) {
      throw new Error(
        "DATABASE_RUNTIME_URL must not equal the migration/maintenance URL",
      );
    }
    return runtime;
  }

  if (runtime) {
    if (migration && runtime === migration) {
      throw new Error(
        "DATABASE_RUNTIME_URL must not equal the migration/maintenance URL",
      );
    }
    return runtime;
  }

  return fallback || undefined;
}

function createPrismaClient(url: string | undefined): PrismaClient {
  if (url) {
    return new PrismaClient({ datasources: { db: { url } } });
  }
  return new PrismaClient();
}

/**
 * Resolve (and lazily recreate) the runtime Prisma singleton when the
 * effective DATABASE_RUNTIME_URL changes — required for disposable test
 * setups that provision the runtime role after module import.
 */
function getPrisma(): PrismaClient {
  const resolvedUrl = resolveRuntimeDatabaseUrl();
  if (
    process.env.NODE_ENV !== "production" &&
    (!global.prismaGlobal || global.prismaRuntimeUrl !== resolvedUrl)
  ) {
    void global.prismaGlobal?.$disconnect();
    global.prismaGlobal = createPrismaClient(resolvedUrl);
    global.prismaRuntimeUrl = resolvedUrl;
  }
  if (!global.prismaGlobal) {
    global.prismaGlobal = createPrismaClient(resolvedUrl);
    global.prismaRuntimeUrl = resolvedUrl;
  }
  return global.prismaGlobal;
}

const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export default prisma;
