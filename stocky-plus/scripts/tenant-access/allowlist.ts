/**
 * Exact-file approved exceptions for Phase 1 PR 2 tenant-access architecture audit.
 * Directory-wide and wildcard paths are rejected by the scanner.
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
  /** Exact relative path — never a directory glob. */
  path: string;
  category: ExceptionCategory;
  reason: string;
  permittedModelsOrOperations: string[];
  productionRuntime: "yes" | "no" | "maintenance_only";
  owner: string;
  expirationPhaseOrRemovalCondition: string;
};

const BACKFILL_FILES = [
  "scripts/tenant-backfill/apply-lock.ts",
  "scripts/tenant-backfill/boundaries.ts",
  "scripts/tenant-backfill/checksum.ts",
  "scripts/tenant-backfill/cli.ts",
  "scripts/tenant-backfill/diagnose.ts",
  "scripts/tenant-backfill/engine.ts",
  "scripts/tenant-backfill/evidence-budget.ts",
  "scripts/tenant-backfill/reason-codes.ts",
  "scripts/tenant-backfill/starting-snapshot.ts",
  "scripts/tenant-backfill/status.ts",
  "scripts/tenant-backfill/subject-evidence.ts",
  "scripts/tenant-backfill/subject-manifest.ts",
  "scripts/tenant-backfill/tables.ts",
  "scripts/tenant-backfill/tests/helpers.ts",
  "scripts/tenant-backfill/tests/affected-row-concurrency.migration.test.ts",
  "scripts/tenant-backfill/tests/allowlist.migration.test.ts",
  "scripts/tenant-backfill/tests/apply-lock.migration.test.ts",
  "scripts/tenant-backfill/tests/batch-atomicity.migration.test.ts",
  "scripts/tenant-backfill/tests/cross-domain-blocking.migration.test.ts",
  "scripts/tenant-backfill/tests/dataset-boundaries.migration.test.ts",
  "scripts/tenant-backfill/tests/detection-history.migration.test.ts",
  "scripts/tenant-backfill/tests/domain-evidence.migration.test.ts",
  "scripts/tenant-backfill/tests/domain-normalization.unit.test.ts",
  "scripts/tenant-backfill/tests/dry-run-apply-equivalence.migration.test.ts",
  "scripts/tenant-backfill/tests/engine-races.migration.test.ts",
  "scripts/tenant-backfill/tests/issue-reopen-counts.migration.test.ts",
  "scripts/tenant-backfill/tests/resume-before-counts.migration.test.ts",
  "scripts/tenant-backfill/tests/snapshot-readonly.migration.test.ts",
  "scripts/tenant-backfill/tests/snapshot-timeout.unit.test.ts",
  "scripts/tenant-backfill/tests/subject-evidence.migration.test.ts",
  "scripts/tenant-backfill/tests/subject-memory.migration.test.ts",
  "scripts/tenant-backfill/tests/tenant-expansion.migration.test.ts",
] as const;

const INDEX_FILES = [
  "scripts/tenant-indexes/apply.ts",
  "scripts/tenant-indexes/classify.ts",
  "scripts/tenant-indexes/cli.ts",
  "scripts/tenant-indexes/connection.ts",
  "scripts/tenant-indexes/drift-lib.ts",
  "scripts/tenant-indexes/drift.ts",
  "scripts/tenant-indexes/inspect.ts",
  "scripts/tenant-indexes/manifest.ts",
  "scripts/tenant-indexes/plan.ts",
  "scripts/tenant-indexes/timeouts.ts",
  "scripts/tenant-indexes/verify.ts",
  "scripts/tenant-indexes/tests/classify.unit.test.ts",
  "scripts/tenant-indexes/tests/drift-redaction.unit.test.ts",
  "scripts/tenant-indexes/tests/indexes.migration.test.ts",
  "scripts/tenant-indexes/tests/maintenance-url.unit.test.ts",
  "scripts/tenant-indexes/tests/schema-drift.migration.test.ts",
  "scripts/tenant-indexes/tests/timeouts.unit.test.ts",
] as const;

const TEST_FILES = [
  "app/tenant/__tests__/helpers.ts",
  "app/tenant/__tests__/authority.test.ts",
  "app/tenant/__tests__/bootstrap.test.ts",
  "app/tenant/__tests__/job-envelope.test.ts",
  "app/tenant/__tests__/tenant-db.test.ts",
  "app/tenant/__tests__/nullable-ownership.test.ts",
  "app/tenant/__tests__/relation-isolation.test.ts",
  "app/tenant/__tests__/nested-writes.test.ts",
  "app/tenant/__tests__/client-hints.test.ts",
  "app/tenant/__tests__/queue-redis.test.ts",
] as const;

function backfillExceptions(): AccessException[] {
  return BACKFILL_FILES.map((path, i) => ({
    id: `EX-BF-${String(i + 1).padStart(3, "0")}`,
    path,
    category: "pr1_maintenance_backfill" as const,
    reason: "PR 1 ownership backfill / diagnose / status tooling (exact file)",
    permittedModelsOrOperations: [
      "Merchant models for backfill only",
      "TenantBackfill*",
      "Shop",
      "PrismaClient construction / raw SQL in maintenance tooling",
    ],
    productionRuntime: "maintenance_only" as const,
    owner: "phase-1-tenant-ownership",
    expirationPhaseOrRemovalCondition:
      "Retire after operational backfill complete and PR 3 enforcement live (Phase 1 PR 3+)",
  }));
}

function indexExceptions(): AccessException[] {
  return INDEX_FILES.map((path, i) => ({
    id: `EX-IDX-${String(i + 1).padStart(3, "0")}`,
    path,
    category: "pr1_compatibility_indexes" as const,
    reason: "PR 1 compatibility index apply/verify/drift tooling (exact file)",
    permittedModelsOrOperations: [
      "pg Client DDL/inspect",
      "PrismaClient in migration tests",
    ],
    productionRuntime: "maintenance_only" as const,
    owner: "phase-1-tenant-ownership",
    expirationPhaseOrRemovalCondition:
      "Retained as ops tooling until superseded; review at PR 3 RLS cutover",
  }));
}

function testExceptions(): AccessException[] {
  return TEST_FILES.map((path, i) => ({
    id: `EX-TEST-${String(i + 1).padStart(3, "0")}`,
    path,
    category: "migration_tests" as const,
    reason:
      "PR 2 tenant-access PostgreSQL/Redis integration harness (exact file)",
    permittedModelsOrOperations: [
      "PrismaClient construction for test DB lifecycle",
      "Shop / Session fixture setup",
      "TenantDb exercise of merchant models",
    ],
    productionRuntime: "no" as const,
    owner: "phase-1-pr2-tenant-access",
    expirationPhaseOrRemovalCondition:
      "Retain while PR 2/3 isolation tests require disposable PostgreSQL fixtures",
  }));
}

export const ACCESS_EXCEPTIONS: AccessException[] = [
  {
    id: "EX-RAW-001",
    path: "app/db.server.ts",
    category: "raw_prisma_construction",
    reason: "Single approved low-level PrismaClient construction module",
    permittedModelsOrOperations: [
      "PrismaClient construction",
      "default export for approved infrastructure only",
    ],
    productionRuntime: "yes",
    owner: "platform-db",
    expirationPhaseOrRemovalCondition:
      "Retained as the sole construction point; never imported by routes/services/workers",
  },
  {
    id: "EX-BOOT-001",
    path: "app/tenant/bootstrap.server.ts",
    category: "restricted_bootstrap",
    reason: "Session + Shop bootstrap and session-storage adapter",
    permittedModelsOrOperations: ["Session", "Shop", "PrismaSessionStorage"],
    productionRuntime: "yes",
    owner: "phase-1-pr2-tenant-access",
    expirationPhaseOrRemovalCondition:
      "Review if bootstrap needs expansion; must never gain merchant delegates",
  },
  {
    id: "EX-TDB-001",
    path: "app/tenant/tenant-db.server.ts",
    category: "tenant_bound_access",
    reason: "Tenant-bound DB contract wraps raw client; never returns it to callers",
    permittedModelsOrOperations: [
      "All 18 merchant-owned models via scoped delegates",
    ],
    productionRuntime: "yes",
    owner: "phase-1-pr2-tenant-access",
    expirationPhaseOrRemovalCondition:
      "Core PR 2 contract — retained until superseded by equivalent enforcement",
  },
  {
    id: "EX-SEED-001",
    path: "prisma/seed.ts",
    category: "dev_seed",
    reason: "Development seed creates Shop/ShopSettings/Supplier for local demos",
    permittedModelsOrOperations: ["Shop", "ShopSettings", "Supplier"],
    productionRuntime: "no",
    owner: "devex",
    expirationPhaseOrRemovalCondition:
      "Replace with tenant-bound seed helper before any shared staging seed",
  },
  ...backfillExceptions(),
  ...indexExceptions(),
  ...testExceptions(),
];

function assertExactAllowlistShape(): void {
  for (const ex of ACCESS_EXCEPTIONS) {
    if (
      ex.path.includes("*") ||
      ex.path.includes("?") ||
      ex.path.endsWith("/") ||
      ex.path.includes("/**")
    ) {
      throw new Error(
        `Allowlist entry ${ex.id} uses forbidden wildcard/directory path: ${ex.path}`,
      );
    }
  }
}

assertExactAllowlistShape();

export function exceptionForPath(relPath: string): AccessException | undefined {
  const normalized = relPath.replace(/\\/g, "/");
  return ACCESS_EXCEPTIONS.find(
    (ex) => normalized === ex.path || normalized.endsWith(`/${ex.path}`),
  );
}

/** Maintenance modules that must never be imported by runtime app surfaces. */
export const MAINTENANCE_MODULE_PREFIXES = [
  "scripts/tenant-backfill/",
  "scripts/tenant-indexes/",
] as const;
