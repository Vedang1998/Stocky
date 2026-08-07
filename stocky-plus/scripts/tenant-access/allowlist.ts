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
  | "pr3_database_enforcement"
  | "pr4_sync_control_plane"
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
  "app/tenant/__tests__/nested-selector-auth.test.ts",
  "app/tenant/__tests__/legacy-normalization.test.ts",
  "app/tenant/__tests__/partial-select-update.test.ts",
  "app/tenant/__tests__/write-atomicity.test.ts",
  "app/tenant/__tests__/client-hints.test.ts",
  "app/tenant/__tests__/large-payload-hints.test.ts",
  "app/tenant/__tests__/queue-redis.test.ts",
  "app/tenant/__tests__/top-level-unique-selectors.test.ts",
  "app/tenant/__tests__/tenant-scope-scale.test.ts",
  "app/tenant/__tests__/mixed-relation-ownership.test.ts",
  "app/tenant/__tests__/connect-or-create-merge.test.ts",
  "app/tenant/__tests__/normalization-consistency.test.ts",
  "app/tenant/__tests__/lead-time-partial-select.test.ts",
  "app/tenant/__tests__/client-hint-byte-limits.test.ts",
  "app/tenant/__tests__/legacy-evidence-overflow.test.ts",
  "app/tenant/__tests__/tenant-bearing-unique-selectors.test.ts",
  "app/tenant/__tests__/legacy-normalization-equivalence.test.ts",
  "app/tenant/__tests__/legacy-normalization-bulk-mutations.test.ts",
  "app/tenant/__tests__/legacy-normalization-relations.test.ts",
  "app/tenant/__tests__/legacy-unique-selector-resolution.test.ts",
  "app/tenant/__tests__/legacy-normalization-candidate-superset.test.ts",
  "app/tenant/__tests__/legacy-overflow-operation-matrix.test.ts",
  "app/tenant/__tests__/db-isolation/helpers.ts",
  "app/tenant/__tests__/db-isolation/isolation.test.ts",
  "app/tenant/__tests__/db-isolation/worker-surfaces.test.ts",
  "scripts/tenant-access/__tests__/authority-issuer-scanner.test.ts",
] as const;

const ENFORCEMENT_FILES = [
  "scripts/tenant-enforcement/apply.ts",
  "scripts/tenant-enforcement/cli.ts",
  "scripts/tenant-enforcement/connection.ts",
  "scripts/tenant-enforcement/inventory-check.ts",
  "scripts/tenant-enforcement/inventory.ts",
  "scripts/tenant-enforcement/manifest.ts",
  "scripts/tenant-enforcement/preflight.ts",
  "scripts/tenant-enforcement/roles.ts",
  "scripts/tenant-enforcement/sql.ts",
  "scripts/tenant-enforcement/timeouts.ts",
  "scripts/tenant-enforcement/verify.ts",
  "scripts/tenant-enforcement/tests/enforcement.migration.test.ts",
  // PR 3 correction adversarial suites (exact-file exceptions; disposable fixtures only)
  "scripts/tenant-enforcement/tests/helpers.ts",
  "scripts/tenant-enforcement/tests/partial-apply-recovery.test.ts",
  "scripts/tenant-enforcement/tests/populated-concurrency.test.ts",
  "scripts/tenant-enforcement/tests/connected-identity.test.ts",
  "scripts/tenant-enforcement/tests/role-membership.test.ts",
  "scripts/tenant-enforcement/tests/definition-drift.test.ts",
  "scripts/tenant-enforcement/tests/composite-definition-drift.test.ts",
  "scripts/tenant-enforcement/tests/immutability-trigger-drift.test.ts",
  "scripts/tenant-enforcement/tests/exact-privilege-allowlist.test.ts",
  "scripts/tenant-enforcement/tests/runtime-connected-identity-app.test.ts",
  "scripts/tenant-enforcement/tests/default-privilege-drift.test.ts",
  "scripts/tenant-enforcement/tests/verifier-readonly.test.ts",
  "scripts/tenant-enforcement/tests/deadlock-timeout-recovery.test.ts",
  "scripts/tenant-enforcement/tests/sequence-privilege.test.ts",
  "scripts/tenant-enforcement/tests/exact-privilege-complete-matrix.test.ts",
  "scripts/tenant-enforcement/tests/resume-preflight-drift.test.ts",
  "scripts/tenant-enforcement/tests/catalog-qualification.test.ts",
  "scripts/tenant-enforcement/tests/advisory-unlock-failure.test.ts",
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

function enforcementExceptions(): AccessException[] {
  return ENFORCEMENT_FILES.map((path, i) => ({
    id: `EX-ENF-${String(i + 1).padStart(3, "0")}`,
    path,
    category: "pr3_database_enforcement" as const,
    reason:
      "PR 3 database enforcement preflight/roles/RLS/apply/verify tooling (exact file)",
    permittedModelsOrOperations: [
      "pg Client DDL/DCL/inspect",
      "PrismaClient in enforcement migration tests",
      "merchant table catalog metadata only",
    ],
    productionRuntime: "maintenance_only" as const,
    owner: "phase-1-pr3-database-enforcement",
    expirationPhaseOrRemovalCondition:
      "Retained as enforcement ops tooling; production apply remains separately authorized",
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

function syncControlPlaneExceptions(): AccessException[] {
  const files = [
    "app/sync/control-plane-db.server.ts",
    "app/sync/intake.server.ts",
    "app/sync/lifecycle.server.ts",
    "app/sync/replay.server.ts",
    "app/sync/uninstall.server.ts",
    "app/sync/dispatcher.server.ts",
    "app/sync/fair-claim-query.server.ts",
  ] as const;
  return files.map((path, i) => ({
    id: `EX-SYNC-${String(i + 1).padStart(3, "0")}`,
    path,
    category: "pr4_sync_control_plane" as const,
    reason:
      "Phase 1 PR 4 durable sync control-plane uses dedicated control-plane Prisma + $transaction (not merchant TenantDb)",
    permittedModelsOrOperations: [
      "WebhookDelivery",
      "DurableJob",
      "JobAttempt",
      "DeadLetter",
      "JobReplay",
      "SyncRun",
      "SyncCursor",
      "ReconciliationRun",
      "DataIssue",
      "SyncHealth",
      "Shop lifecycle fields",
      "PrismaClient via DATABASE_CONTROL_PLANE_URL only",
    ],
    productionRuntime: "yes" as const,
    owner: "phase-1-pr4-sync-control-plane",
    expirationPhaseOrRemovalCondition:
      "Retained while durable sync control-plane remains the DB system of record for intake/dispatch",
  }));
}

export const ACCESS_EXCEPTIONS: AccessException[] = [
  {
    id: "EX-RAW-002",
    path: "app/db/runtime-identity.server.ts",
    category: "raw_prisma_construction",
    reason:
      "Shared runtime connected-identity verification (F-PR3C-01); constructs verified Prisma clients and runs catalog identity queries before merchant processing",
    permittedModelsOrOperations: [
      "PrismaClient construction for verified runtime init",
      "Catalog-only $queryRawUnsafe for role/identity assertions (no merchant row access)",
    ],
    productionRuntime: "yes",
    owner: "platform-db",
    expirationPhaseOrRemovalCondition:
      "Retained while application runtime must fail closed on privileged connected identity",
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
      "All 19 merchant-owned models via scoped delegates",
    ],
    productionRuntime: "yes",
    owner: "phase-1-pr2-tenant-access",
    expirationPhaseOrRemovalCondition:
      "Core PR 2 contract — retained until superseded by equivalent enforcement",
  },
  {
    id: "EX-TDB-002",
    path: "app/tenant/db-context.server.ts",
    category: "tenant_bound_access",
    reason:
      "Transaction-local tenant context setter (set_config is_local=true) for RLS",
    permittedModelsOrOperations: [
      "set_config / current_setting on transaction client only",
      "No merchant-table DML",
    ],
    productionRuntime: "yes",
    owner: "phase-1-pr3-database-enforcement",
    expirationPhaseOrRemovalCondition:
      "Core PR 3 context contract — retained with TenantDb",
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
  {
    id: "EX-SYNC-TEST-001",
    path: "app/sync/__tests__/sync-control-plane.integration.test.ts",
    category: "migration_tests",
    reason:
      "PR 4 sync control-plane disposable PostgreSQL/Redis integration harness",
    permittedModelsOrOperations: [
      "PrismaClient construction for test DB lifecycle",
      "Shop / Session fixture setup",
      "Control-plane table exercise",
      "Restricted-role grant verification via raw SQL",
    ],
    productionRuntime: "no",
    owner: "phase-1-pr4-sync-control-plane",
    expirationPhaseOrRemovalCondition:
      "Retain while PR 4 sync-integration suite requires disposable fixtures",
  },
  {
    id: "EX-SYNC-TEST-002",
    path: "app/sync/__tests__/sync-exactly-once.test.ts",
    category: "migration_tests",
    reason: "PR 4 D-043 F-PR4-01 exactly-once disposable harness",
    permittedModelsOrOperations: [
      "PrismaClient construction for test DB lifecycle",
      "SyncApplicationReceipt / SalesDailyAggregate fixture assertions",
      "TRUNCATE via raw SQL in beforeEach",
    ],
    productionRuntime: "no",
    owner: "phase-1-pr4-sync-control-plane",
    expirationPhaseOrRemovalCondition:
      "Retain while PR 4 correction suite requires disposable fixtures",
  },
  {
    id: "EX-SYNC-TEST-003",
    path: "app/sync/__tests__/sync-dispatch-recovery.test.ts",
    category: "migration_tests",
    reason: "PR 4 D-043 F-PR4-02 dispatch recovery disposable harness",
    permittedModelsOrOperations: [
      "PrismaClient construction for test DB lifecycle",
      "TRUNCATE via raw SQL in beforeEach",
    ],
    productionRuntime: "no",
    owner: "phase-1-pr4-sync-control-plane",
    expirationPhaseOrRemovalCondition:
      "Retain while PR 4 correction suite requires disposable fixtures",
  },
  {
    id: "EX-SYNC-TEST-004",
    path: "app/sync/__tests__/sync-uninstall.test.ts",
    category: "migration_tests",
    reason: "PR 4 D-043 F-PR4-03 uninstall disposable harness",
    permittedModelsOrOperations: [
      "PrismaClient construction for test DB lifecycle",
      "TRUNCATE via raw SQL in beforeEach",
    ],
    productionRuntime: "no",
    owner: "phase-1-pr4-sync-control-plane",
    expirationPhaseOrRemovalCondition:
      "Retain while PR 4 correction suite requires disposable fixtures",
  },
  {
    id: "EX-SYNC-TEST-005",
    path: "app/sync/__tests__/sync-attempt-recovery.test.ts",
    category: "migration_tests",
    reason: "PR 4 D-043 F-PR4-04 attempt recovery disposable harness",
    permittedModelsOrOperations: [
      "PrismaClient construction for test DB lifecycle",
      "TRUNCATE via raw SQL in beforeEach",
    ],
    productionRuntime: "no",
    owner: "phase-1-pr4-sync-control-plane",
    expirationPhaseOrRemovalCondition:
      "Retain while PR 4 correction suite requires disposable fixtures",
  },
  {
    id: "EX-SYNC-TEST-006",
    path: "app/sync/__tests__/sync-intake-corrections.test.ts",
    category: "migration_tests",
    reason: "PR 4 D-043 intake correction disposable harness",
    permittedModelsOrOperations: [
      "PrismaClient construction for test DB lifecycle",
      "TRUNCATE via raw SQL in beforeEach",
    ],
    productionRuntime: "no",
    owner: "phase-1-pr4-sync-control-plane",
    expirationPhaseOrRemovalCondition:
      "Retain while PR 4 correction suite requires disposable fixtures",
  },
  {
    id: "EX-SYNC-TEST-007",
    path: "app/sync/__tests__/sync-performance.test.ts",
    category: "migration_tests",
    reason: "PR 4 D-043 F-PR4-11/13 performance disposable harness",
    permittedModelsOrOperations: [
      "PrismaClient construction for test DB lifecycle",
      "Bulk seed / EXPLAIN via raw SQL",
    ],
    productionRuntime: "no",
    owner: "phase-1-pr4-sync-control-plane",
    expirationPhaseOrRemovalCondition:
      "Retain while PR 4 correction suite requires disposable fixtures",
  },
  {
    id: "EX-SYNC-TEST-008",
    path: "app/sync/__tests__/test-state-helpers.ts",
    category: "migration_tests",
    reason: "PR 4 D-043 legal DurableJob transition helpers for tests",
    permittedModelsOrOperations: ["PrismaClient updates / raw SQL transitions"],
    productionRuntime: "no",
    owner: "phase-1-pr4-sync-control-plane",
    expirationPhaseOrRemovalCondition:
      "Retain while PR 4 correction suite requires disposable fixtures",
  },
  {
    id: "EX-SYNC-TEST-009",
    path: "scripts/sync-control-plane/tests/sync-role-isolation.test.ts",
    category: "migration_tests",
    reason: "PR 4 D-043 F-PR4-06 role isolation disposable harness",
    permittedModelsOrOperations: [
      "PrismaClient construction for RLS/trigger assertions",
    ],
    productionRuntime: "no",
    owner: "phase-1-pr4-sync-control-plane",
    expirationPhaseOrRemovalCondition:
      "Retain while PR 4 correction suite requires disposable fixtures",
  },
  {
    id: "EX-SYNC-TEST-010",
    path: "scripts/sync-control-plane/tests/sync-inventory-audit.test.ts",
    category: "migration_tests",
    reason: "PR 4 D-043 F-PR4-07 inventory scanner negative fixtures",
    permittedModelsOrOperations: ["Planted scanner fixtures"],
    productionRuntime: "no",
    owner: "phase-1-pr4-sync-control-plane",
    expirationPhaseOrRemovalCondition:
      "Retain while PR 4 correction suite requires disposable fixtures",
  },
  {
    id: "EX-SYNC-TEST-011",
    path: "app/sync/__tests__/sync-envelope-fail-closed.test.ts",
    category: "migration_tests",
    reason: "PR 4 D-044 NEW-PR4-C04 envelope fail-closed disposable harness",
    permittedModelsOrOperations: [
      "PrismaClient construction for test DB lifecycle",
      "SyncApplicationReceipt / SalesDailyAggregate fixture assertions",
      "TRUNCATE via raw SQL in beforeEach",
    ],
    productionRuntime: "no",
    owner: "phase-1-pr4-sync-control-plane",
    expirationPhaseOrRemovalCondition:
      "Retain while PR 4 second-correction suite requires disposable fixtures",
  },
  {
    id: "EX-SYNC-TEST-012",
    path: "app/sync/__tests__/sync-final-correction.test.ts",
    category: "migration_tests",
    reason: "PR 4 D-045 NEW-PR4-SC02…SC08 final-correction disposable harness",
    permittedModelsOrOperations: [
      "PrismaClient construction for test DB lifecycle",
      "BullMQ Queue construct/obliterate for presence and stranded tests",
      "TRUNCATE via raw SQL in beforeEach",
      "DurableJob / JobAttempt / DataIssue / SyncHealth fixture assertions",
    ],
    productionRuntime: "no",
    owner: "phase-1-pr4-sync-control-plane",
    expirationPhaseOrRemovalCondition:
      "Retain while PR 4 final-correction suite requires disposable fixtures",
  },
  {
    id: "EX-SYNC-TEST-013",
    path: "app/sync/__tests__/sync-d046-worker-finalize.test.ts",
    category: "migration_tests",
    reason:
      "PR 4 D-046 NEW-CLAUDE-D045-02 genuine v2/v3 processWebhookJob catch-path disposable harness",
    permittedModelsOrOperations: [
      "PrismaClient construction for test DB lifecycle",
      "TRUNCATE via raw SQL in beforeEach",
      "createTenantDb test-local owner shim forwarding transaction options",
      "SyncApplicationReceipt / SalesDailyAggregate / DurableJob / JobAttempt / DeadLetter fixture assertions",
      "JobDispatch fixture for v3 envelope identity",
    ],
    productionRuntime: "no",
    owner: "phase-1-pr4-sync-control-plane",
    expirationPhaseOrRemovalCondition:
      "Retain while PR 4 D-046 worker-finalize suite requires disposable fixtures",
  },
  {
    id: "EX-SYNC-TEST-014",
    path: "app/sync/__tests__/dispatch-ready-shop.test.ts",
    category: "migration_tests",
    reason:
      "PR 4 D-048 DispatchReadyShop readiness lifecycle disposable harness",
    permittedModelsOrOperations: [
      "PrismaClient construction for test DB lifecycle",
      "TRUNCATE via raw SQL in beforeEach",
      "DispatchReadyShop / DurableJob readiness trigger assertions via raw SQL",
    ],
    productionRuntime: "no",
    owner: "phase-1-pr4-sync-control-plane",
    expirationPhaseOrRemovalCondition:
      "Retain while PR 4 D-048 readiness suite requires disposable fixtures",
  },
  ...syncControlPlaneExceptions(),
  ...backfillExceptions(),
  ...indexExceptions(),
  ...enforcementExceptions(),
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

/**
 * Resolve an allowlist exception for a repository-root-relative path.
 *
 * Production matching is exact only (F-PR2C-11). Fixture scans must pass
 * paths already normalized relative to their explicit scan root so they
 * compare equal to configured exception paths — never via workspace suffix.
 */
export function exceptionForPath(relPath: string): AccessException | undefined {
  const normalized = relPath.replace(/\\/g, "/").replace(/^\.\//, "");
  return ACCESS_EXCEPTIONS.find((ex) => normalized === ex.path);
}

/** Exported for tests that must exercise the real shape guard. */
export function assertAllowlistPathsAreExact(
  entries: ReadonlyArray<{ id: string; path: string }>,
): void {
  for (const ex of entries) {
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

/** Maintenance modules that must never be imported by runtime app surfaces. */
export const MAINTENANCE_MODULE_PREFIXES = [
  "scripts/tenant-backfill/",
  "scripts/tenant-indexes/",
] as const;
