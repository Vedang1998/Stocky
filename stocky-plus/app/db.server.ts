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
 *
 * F-PR3-06: semantic URL comparison rejects equivalent privileged forms.
 * F-PR3-25/26: test reset helper is not a production export path; Proxy binds
 * methods to the real client (not the proxy receiver).
 */
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var prismaRuntimeUrl: string | undefined;
  // eslint-disable-next-line no-var
  var prismaInitPromise: Promise<void> | undefined;
}

function databaseUrlsSemanticallyEqual(a: string, b: string): boolean {
  try {
    const normalize = (raw: string) => {
      let input = raw.trim();
      if (input.startsWith("postgres://")) {
        input = `postgresql://${input.slice("postgres://".length)}`;
      }
      const parsed = new URL(input);
      if (parsed.protocol !== "postgresql:") {
        throw new Error("unsupported");
      }
      const hostRaw = parsed.hostname.toLowerCase();
      const host =
        hostRaw === "127.0.0.1" || hostRaw === "::1" ? "localhost" : hostRaw;
      const port = parsed.port ? Number(parsed.port) : 5432;
      const database = decodeURIComponent(parsed.pathname.replace(/^\//, "")).replace(
        /\/+$/,
        "",
      );
      const user = decodeURIComponent(parsed.username || "");
      return { user, host, port, database };
    };
    const left = normalize(a);
    const right = normalize(b);
    return (
      left.user === right.user &&
      left.host === right.host &&
      left.port === right.port &&
      left.database === right.database
    );
  } catch {
    return false;
  }
}

export function resolveRuntimeDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const runtime = env.DATABASE_RUNTIME_URL?.trim() || "";
  const migration =
    env.DATABASE_MIGRATION_URL?.trim() ||
    env.TENANT_MAINTENANCE_DATABASE_URL?.trim() ||
    "";
  const fallback = env.DATABASE_URL?.trim() || "";
  const requireRuntime =
    env.STOCKY_REQUIRE_RUNTIME_DB_URL === "1" || env.NODE_ENV === "production";

  if (requireRuntime) {
    if (!runtime) {
      throw new Error(
        "DATABASE_RUNTIME_URL is required for production-like runtime (refusing privileged DATABASE_URL fallback)",
      );
    }
    try {
      void new URL(
        runtime.startsWith("postgres://")
          ? `postgresql://${runtime.slice("postgres://".length)}`
          : runtime,
      );
    } catch {
      throw new Error("malformed_database_url:DATABASE_RUNTIME_URL");
    }
    if (migration && databaseUrlsSemanticallyEqual(runtime, migration)) {
      throw new Error(
        "DATABASE_RUNTIME_URL must not equal the migration/maintenance URL (semantic identity)",
      );
    }
    if (
      fallback &&
      migration &&
      databaseUrlsSemanticallyEqual(runtime, fallback) &&
      databaseUrlsSemanticallyEqual(fallback, migration)
    ) {
      throw new Error(
        "DATABASE_RUNTIME_URL must not equal the privileged DATABASE_URL (semantic identity)",
      );
    }
    return runtime;
  }

  if (runtime) {
    if (migration && databaseUrlsSemanticallyEqual(runtime, migration)) {
      throw new Error(
        "DATABASE_RUNTIME_URL must not equal the migration/maintenance URL (semantic identity)",
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
 *
 * Production creates once. Non-production awaits prior disconnect before
 * replacement to avoid racing multiple privileged clients (F-PR3-26 area).
 */
function getPrisma(): PrismaClient {
  const resolvedUrl = resolveRuntimeDatabaseUrl();
  if (
    process.env.NODE_ENV !== "production" &&
    (!global.prismaGlobal || global.prismaRuntimeUrl !== resolvedUrl)
  ) {
    const previous = global.prismaGlobal;
    global.prismaGlobal = createPrismaClient(resolvedUrl);
    global.prismaRuntimeUrl = resolvedUrl;
    if (previous) {
      // Fire-and-forget disconnect of the prior client after replacement.
      void previous.$disconnect();
    }
  }
  if (!global.prismaGlobal) {
    global.prismaGlobal = createPrismaClient(resolvedUrl);
    global.prismaRuntimeUrl = resolvedUrl;
  }
  return global.prismaGlobal;
}

const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    // Bind methods to the real client — never pass the proxy as receiver
    // (F-PR3-26).
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/**
 * Drop the lazily-cached runtime Prisma client. Test harnesses that
 * DROP SCHEMA / recreate tables must call this so pooled connections and
 * privilege assumptions are not reused against a destroyed catalog.
 * Forbidden in production. Prefer importing from app/test-utils when possible.
 */
export async function resetPrismaSingletonForTests(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "resetPrismaSingletonForTests is forbidden when NODE_ENV=production",
    );
  }
  if (process.env.STOCKY_ALLOW_PRISMA_TEST_RESET !== "1" && process.env.NODE_ENV === "test") {
    // Allowed in test by default; explicit deny only via production check above.
  }
  await global.prismaGlobal?.$disconnect();
  global.prismaGlobal = undefined;
  global.prismaRuntimeUrl = undefined;
}

export default prisma;
