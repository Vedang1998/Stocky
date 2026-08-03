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
 * F-PR3C-01: connected-identity verification runs before merchant processing.
 * URL comparison is an early defence only — not authority.
 * F-PR3-25/26: test reset helper is not a production export path; Proxy binds
 * methods to the real client (not the proxy receiver).
 */
import { PrismaClient } from "@prisma/client";
import {
  getVerifiedRuntimePrisma,
  resetVerifiedPrismaSingletonForTests,
} from "./db/runtime-identity.server";

export {
  resolveRuntimeDatabaseUrl,
  getVerifiedRuntimePrisma,
  assertSafeRuntimeConnectedIdentity,
  databaseUrlsSemanticallyEqual,
  normalizeDatabaseUrlIdentity,
} from "./db/runtime-identity.server";

/**
 * Ensure the runtime Prisma client is connected and identity-verified.
 * Call from workers / startup before merchant processing when an explicit
 * ready-gate is preferred. Ordinary proxy access also awaits the same init.
 */
export async function ensureRuntimePrismaReady(): Promise<PrismaClient> {
  return getVerifiedRuntimePrisma();
}

/**
 * Drop the lazily-cached runtime Prisma client. Test harnesses that
 * DROP SCHEMA / recreate tables must call this so pooled connections and
 * privilege assumptions are not reused against a destroyed catalog.
 * Forbidden in production. After reset, the next access re-verifies identity.
 * Prefer importing from app/test-utils when possible — not a production path.
 */
export async function resetPrismaSingletonForTests(): Promise<void> {
  await resetVerifiedPrismaSingletonForTests();
}

/**
 * Proxy that awaits concurrency-safe identity verification before any
 * client or model-delegate operation. Two concurrent first requests share
 * one init promise; failure rejects waiters and leaves no usable client.
 */
function createVerifiedPrismaProxy(): PrismaClient {
  const handler: ProxyHandler<PrismaClient> = {
    get(_target, prop) {
      // Avoid thenable detection treating the proxy as a Promise.
      if (prop === "then") return undefined;

      if (typeof prop === "symbol") {
        return undefined;
      }

      const propName = prop as string;

      // Top-level PrismaClient methods / fields ($transaction, $queryRaw, …)
      if (propName.startsWith("$") || propName === "constructor") {
        return async (...args: unknown[]) => {
          const client = await getVerifiedRuntimePrisma();
          const value = Reflect.get(client, propName, client);
          if (typeof value === "function") {
            return (value as (...a: unknown[]) => unknown).apply(client, args);
          }
          return value;
        };
      }

      // Model delegates (supplier, purchaseOrder, …) — nested proxy so
      // findMany/create/etc. await verification first.
      return new Proxy(
        {},
        {
          get(_delegateTarget, method) {
            if (typeof method === "symbol") return undefined;
            return async (...args: unknown[]) => {
              const client = await getVerifiedRuntimePrisma();
              const delegate = Reflect.get(client, propName, client) as Record<
                string,
                unknown
              >;
              const fn = delegate?.[method as string];
              if (typeof fn !== "function") {
                return fn;
              }
              return (fn as (...a: unknown[]) => unknown).apply(delegate, args);
            };
          },
        },
      );
    },
  };

  return new Proxy({} as PrismaClient, handler);
}

const prisma = createVerifiedPrismaProxy();

export default prisma;
