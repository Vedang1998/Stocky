/**
 * Narrow approved exceptions for Phase 1 PR 2 tenant-access architecture audit.
 * Globs must remain path-exact or narrowly prefixed — never app/** or scripts/**.
 */

export type ExceptionCategory =
  | "raw_prisma_construction"
  | "restricted_bootstrap"
  | "tenant_bound_access"
  | "pr1_maintenance_backfill"
  | "pr1_compatibility_indexes"
  | "migration_tests"
  | "dev_seed";

export type AccessException = {
  id: string;
  path: string;
  category: ExceptionCategory;
  reason: string;
  permittedModelsOrOperations: string[];
  productionRuntime: "yes" | "no" | "maintenance_only";
  removalOrReviewCondition: string;
};

export const ACCESS_EXCEPTIONS: AccessException[] = [
  {
    id: "EX-RAW-001",
    path: "app/db.server.ts",
    category: "raw_prisma_construction",
    reason: "Single approved low-level PrismaClient construction module",
    permittedModelsOrOperations: ["PrismaClient construction", "default export for approved infrastructure only"],
    productionRuntime: "yes",
    removalOrReviewCondition: "Retained as the sole construction point; never imported by routes/services/workers",
  },
  {
    id: "EX-BOOT-001",
    path: "app/tenant/bootstrap.server.ts",
    category: "restricted_bootstrap",
    reason: "Session + Shop bootstrap and session-storage adapter",
    permittedModelsOrOperations: ["Session", "Shop", "PrismaSessionStorage"],
    productionRuntime: "yes",
    removalOrReviewCondition: "Review if bootstrap needs expansion; must never gain merchant delegates",
  },
  {
    id: "EX-TDB-001",
    path: "app/tenant/tenant-db.server.ts",
    category: "tenant_bound_access",
    reason: "Tenant-bound DB contract wraps raw client; never returns it to callers",
    permittedModelsOrOperations: ["All 18 merchant-owned models via scoped delegates"],
    productionRuntime: "yes",
    removalOrReviewCondition: "Core PR 2 contract — retained until superseded by equivalent enforcement",
  },
  {
    id: "EX-BF-001",
    path: "scripts/tenant-backfill/",
    category: "pr1_maintenance_backfill",
    reason: "PR 1 ownership backfill / diagnose / status tooling",
    permittedModelsOrOperations: [
      "Merchant models for backfill only",
      "TenantBackfill*",
      "Shop",
      "PrismaClient in CLI/diagnose/status/tests",
    ],
    productionRuntime: "maintenance_only",
    removalOrReviewCondition: "Retire after operational backfill complete and PR 3 enforcement live",
  },
  {
    id: "EX-IDX-001",
    path: "scripts/tenant-indexes/",
    category: "pr1_compatibility_indexes",
    reason: "PR 1 compatibility index apply/verify/drift tooling",
    permittedModelsOrOperations: ["pg Client DDL/inspect", "PrismaClient in migration tests"],
    productionRuntime: "maintenance_only",
    removalOrReviewCondition: "Retained as ops tooling; not app runtime",
  },
  {
    id: "EX-SEED-001",
    path: "prisma/seed.ts",
    category: "dev_seed",
    reason: "Development seed creates Shop/ShopSettings/Supplier for local demos",
    permittedModelsOrOperations: ["Shop", "ShopSettings", "Supplier"],
    productionRuntime: "no",
    removalOrReviewCondition: "Replace with tenant-bound seed helper before any shared staging seed",
  },
  {
    id: "EX-TEST-001",
    path: "app/tenant/__tests__/",
    category: "migration_tests",
    reason:
      "PR 2 tenant-access PostgreSQL integration harness — raw Prisma only for schema reset and Shop seed fixtures",
    permittedModelsOrOperations: [
      "PrismaClient construction for test DB lifecycle",
      "Shop / Session fixture setup",
      "TenantDb exercise of all 18 merchant models",
    ],
    productionRuntime: "no",
    removalOrReviewCondition: "Retain while PR 2/3 isolation tests require disposable PostgreSQL fixtures",
  },
];

export function exceptionForPath(relPath: string): AccessException | undefined {
  const normalized = relPath.replace(/\\/g, "/");
  return ACCESS_EXCEPTIONS.find((ex) => {
    if (ex.path.endsWith("/")) {
      return normalized.startsWith(ex.path) || normalized.includes(`/${ex.path}`);
    }
    return (
      normalized === ex.path ||
      normalized.endsWith(`/${ex.path}`) ||
      normalized.endsWith(ex.path)
    );
  });
}
