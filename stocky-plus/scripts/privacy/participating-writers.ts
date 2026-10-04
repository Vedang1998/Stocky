/**
 * PR7 participating-writer source discovery (GW-02).
 *
 * Completeness is independent source-derived required-symbol presence
 * reconciled against this inventory. Unknown production write files block.
 * Seven named symbols remain a regression floor only.
 *
 * Disposable SQL ParticipatingWriterInventory is not a production Prisma model.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export type RequiredWriter = {
  source_identity: string;
  path: string;
  symbol: string;
  guard: string;
};

/** Named §7.9 + W-derived hosts actually present in application source. */
export const REQUIRED_WRITER_INVENTORY: readonly RequiredWriter[] = [
  {
    source_identity: "after-auth.server.ts:runAfterAuthTenantBootstrap",
    path: "app/tenant/after-auth.server.ts",
    symbol: "runAfterAuthTenantBootstrap",
    guard: "assertNoErasureFence",
  },
  {
    source_identity: "bootstrap.server.ts:upsertCanonicalShop",
    path: "app/tenant/bootstrap.server.ts",
    symbol: "upsertCanonicalShop",
    guard: "assertParticipatingWriteGuard",
  },
  {
    source_identity: "db-context.server.ts:withTenantBoundTransaction",
    path: "app/tenant/db-context.server.ts",
    symbol: "withTenantBoundTransaction",
    guard: "assertParticipatingWriteGuard",
  },
  {
    source_identity: "tenant-db.server.ts:withTenantBoundTransactionState",
    path: "app/tenant/tenant-db.server.ts",
    symbol: "withTenantBoundTransactionState",
    guard: "assertParticipatingWriteGuard",
  },
  {
    source_identity: "original-admin-capture.server.ts:captureOriginalAdminCommand",
    path: "app/tenant/original-admin-capture.server.ts",
    symbol: "captureOriginalAdminCommand",
    guard: "stocky_capture_original_admin_command",
  },
  {
    source_identity: "writer-admission.server.ts:recordWriterAdmission",
    path: "app/sync/writer-admission.server.ts",
    symbol: "recordWriterAdmission",
    guard: "stocky_record_writer_admission",
  },
  {
    source_identity: "bound-effect.server.ts:applyBoundCustomerEffect",
    path: "app/tenant/bound-effect.server.ts",
    symbol: "applyBoundCustomerEffect",
    guard: "stocky_apply_bound_customer_effect",
  },
  {
    source_identity: "uninstall.server.ts:processUninstall",
    path: "app/sync/uninstall.server.ts",
    symbol: "processUninstall",
    guard: "assertParticipatingWriteGuard",
  },
  {
    source_identity: "reinstall.server.ts:reactivateShopAfterVerifiedReinstall",
    path: "app/sync/reinstall.server.ts",
    symbol: "reactivateShopAfterVerifiedReinstall",
    guard: "assertParticipatingWriteGuard",
  },
  {
    source_identity: "dispatcher.server.ts:ensureDispatchRecord",
    path: "app/sync/dispatcher.server.ts",
    symbol: "ensureDispatchRecord",
    guard: "assertParticipatingWriteGuardForShop",
  },
  {
    source_identity: "dispatcher.server.ts:dispatcher_disabled_shop_path",
    path: "app/sync/dispatcher.server.ts",
    symbol: "enqueueWithDispatch",
    guard: "assertParticipatingWriteGuardForShop",
  },
  {
    source_identity: "dispatcher.server.ts:recoverExpiredDispatchLeases",
    path: "app/sync/dispatcher.server.ts",
    symbol: "recoverExpiredDispatchLeases",
    guard: "assertParticipatingWriteGuardForShop",
  },
  {
    source_identity: "dispatcher.server.ts:recoverStrandedEnqueuedJobs",
    path: "app/sync/dispatcher.server.ts",
    symbol: "recoverStrandedEnqueuedJobs",
    guard: "assertParticipatingWriteGuardForShop",
  },
  {
    source_identity: "lifecycle.server.ts:claimAttempt",
    path: "app/sync/lifecycle.server.ts",
    symbol: "claimAttempt",
    guard: "assertParticipatingWriteGuardForShop",
  },
  {
    source_identity: "lifecycle.server.ts:completeAttemptRetry",
    path: "app/sync/lifecycle.server.ts",
    symbol: "completeAttemptRetry",
    guard: "assertParticipatingWriteGuardForShop",
  },
  {
    source_identity: "lifecycle.server.ts:completeAttemptSuccess",
    path: "app/sync/lifecycle.server.ts",
    symbol: "completeAttemptSuccess",
    guard: "assertParticipatingWriteGuardForShop",
  },
  {
    source_identity: "lifecycle.server.ts:completeAttemptFail",
    path: "app/sync/lifecycle.server.ts",
    symbol: "completeAttemptFail",
    guard: "assertParticipatingWriteGuardForShop",
  },
  {
    source_identity: "lifecycle.server.ts:completeAttemptDeadLetter",
    path: "app/sync/lifecycle.server.ts",
    symbol: "completeAttemptDeadLetter",
    guard: "assertParticipatingWriteGuardForShop",
  },
  {
    source_identity: "lifecycle.server.ts:recoverExpiredRunningAttempts",
    path: "app/sync/lifecycle.server.ts",
    symbol: "recoverExpiredRunningAttempts",
    guard: "assertParticipatingWriteGuardForShop",
  },
  {
    source_identity: "lifecycle.server.ts:renewAttemptHeartbeat",
    path: "app/sync/lifecycle.server.ts",
    symbol: "renewAttemptHeartbeat",
    guard: "assertParticipatingWriteGuardForShop",
  },
  {
    source_identity: "replay.server.ts:replayDeadLetter",
    path: "app/sync/replay.server.ts",
    symbol: "replayDeadLetter",
    guard: "assertParticipatingWriteGuardForShop",
  },
  {
    source_identity: "health.server.ts:computeSyncHealth",
    path: "app/sync/health.server.ts",
    symbol: "computeSyncHealth",
    guard: "assertParticipatingWriteGuardForShop",
  },
  {
    source_identity: "writers.ts:requireProcessingEnabled",
    path: "app/lib/order-facts/apply/writers.ts",
    symbol: "requireProcessingEnabled",
    guard: "stocky_participating_write_guard",
  },
  {
    source_identity: "checkpoint.ts:lockSyncRun",
    path: "app/lib/catalog-facts/ingest/checkpoint.ts",
    symbol: "lockSyncRun",
    guard: "assertParticipatingWriteGuardForShop",
  },
  {
    source_identity: "queue.server.ts:drainOrdinaryQueueJobsForShop",
    path: "app/jobs/queue.server.ts",
    symbol: "drainOrdinaryQueueJobsForShop",
    guard: "job.remove",
  },
  {
    source_identity: "execute.server.ts:processPrivacyRequest",
    path: "app/privacy/execute.server.ts",
    symbol: "processPrivacyRequest",
    guard: "stocky_privacy_enumerate_targets",
  },
];

export const REQUIRED_IDENTITY_KEYS = [
  "dispatcher.server.ts:dispatcher_disabled_shop_path",
  "lifecycle.server.ts:completeAttemptRetry",
  "dispatcher.server.ts:recoverExpiredDispatchLeases",
  "health.server.ts:computeSyncHealth",
] as const;

export const REGRESSION_FLOOR_SYMBOLS = [
  "runAfterAuthTenantBootstrap",
  "upsertCanonicalShop",
  "withTenantBoundTransaction",
  "processUninstall",
  "ensureDispatchRecord",
  "completeAttemptRetry",
  "computeSyncHealth",
] as const;

const SKIP_DIR = new Set([
  "node_modules",
  "build",
  "dist",
  ".git",
  "generated",
  "migrations",
]);

const WRITE_RE =
  /\.(create|update|upsert|delete|createMany|updateMany|deleteMany)\s*\(/;
const RAW_WRITE_RE =
  /\$(executeRaw|queryRaw|executeRawUnsafe|queryRawUnsafe)\s*(?:<[^>]+>)?\s*(?:`[\s\S]{0,400}?(INSERT|UPDATE|DELETE)|`)/i;

export type ScannedFile = {
  path: string;
  classification: "WRITE" | "UNREACHABLE_TEST";
};

function walk(dir: string, acc: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIR.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (entry.name.endsWith(".d.ts")) continue;
    acc.push(full);
  }
}

function repoRel(abs: string): string {
  return path.relative(APP_ROOT, abs).replace(/\\/g, "/");
}

function isTestPath(rel: string): boolean {
  return (
    rel.includes("/__tests__/") ||
    /\.test\.(ts|tsx)$/.test(rel) ||
    /\.spec\.(ts|tsx)$/.test(rel) ||
    rel.includes("/tests/")
  );
}

export function scanParticipatingWriteFiles(): ScannedFile[] {
  const files: string[] = [];
  walk(path.join(APP_ROOT, "app"), files);
  walk(path.join(APP_ROOT, "scripts"), files);
  const out: ScannedFile[] = [];
  for (const abs of files) {
    const rel = repoRel(abs);
    const text = fs.readFileSync(abs, "utf8");
    if (!WRITE_RE.test(text) && !RAW_WRITE_RE.test(text) && !text.includes("$executeRaw")) {
      continue;
    }
    out.push({
      path: rel,
      classification: isTestPath(rel) ? "UNREACHABLE_TEST" : "WRITE",
    });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export type CompletenessResult = {
  complete: boolean;
  scannedWriteFiles: number;
  requiredPresent: number;
  missingRequired: string[];
  missingGuards: string[];
  missingFloor: string[];
  missingIdentities: string[];
  unknownWrites: string[];
};

const INVENTORIED_PATHS = new Set(REQUIRED_WRITER_INVENTORY.map((row) => row.path));

/** Production write files covered by TenantDb or named CP/privacy hosts. */
const ALLOWED_WRITE_PATH_PREFIXES = [
  "app/audit/",
  "app/privacy/",
  "app/rbac/",
  "app/routes/webhooks.compliance.tsx",
  "app/routes/app.platform.",
  "app/sync/",
  "app/tenant/",
  "app/jobs/",
  "app/lib/order-facts/",
  "app/lib/catalog-facts/",
  "scripts/privacy/",
  "scripts/tenant-enforcement/",
  "scripts/sync-control-plane/",
  "scripts/tenant-access/",
  "scripts/tenant-backfill/",
  "scripts/tenant-indexes/",
];

function isAllowedWritePath(rel: string): boolean {
  if (INVENTORIED_PATHS.has(rel)) return true;
  return ALLOWED_WRITE_PATH_PREFIXES.some(
    (prefix) => rel === prefix || rel.startsWith(prefix),
  );
}

export function evaluateWriterCompleteness(
  inventory: readonly RequiredWriter[] = REQUIRED_WRITER_INVENTORY,
): CompletenessResult {
  const missingRequired: string[] = [];
  const missingGuards: string[] = [];
  for (const row of inventory) {
    const abs = path.join(APP_ROOT, row.path);
    if (!fs.existsSync(abs)) {
      missingRequired.push(row.source_identity);
      continue;
    }
    const text = fs.readFileSync(abs, "utf8");
    if (!text.includes(row.symbol)) {
      missingRequired.push(row.source_identity);
      continue;
    }
    if (!text.includes(row.guard)) {
      missingGuards.push(row.source_identity);
    }
  }

  const missingFloor: string[] = [];
  const inventoryText = inventory.map((row) => row.symbol).join("\n");
  for (const symbol of REGRESSION_FLOOR_SYMBOLS) {
    if (!inventoryText.includes(symbol)) missingFloor.push(symbol);
  }
  const missingIdentities: string[] = [];
  const identities = new Set(inventory.map((row) => row.source_identity));
  for (const key of REQUIRED_IDENTITY_KEYS) {
    if (!identities.has(key)) missingIdentities.push(key);
  }

  const scanned = scanParticipatingWriteFiles();
  const unknownWrites = scanned
    .filter((row) => row.classification === "WRITE" && !isAllowedWritePath(row.path))
    .map((row) => row.path);

  return {
    complete:
      missingRequired.length === 0 &&
      missingGuards.length === 0 &&
      missingFloor.length === 0 &&
      missingIdentities.length === 0 &&
      unknownWrites.length === 0,
    scannedWriteFiles: scanned.filter((row) => row.classification === "WRITE").length,
    requiredPresent: inventory.length - missingRequired.length,
    missingRequired,
    missingGuards,
    missingFloor,
    missingIdentities,
    unknownWrites,
  };
}

export function assertWriterInventoryComplete(): CompletenessResult {
  const result = evaluateWriterCompleteness();
  if (!result.complete) {
    throw new Error(
      `participating_writer_inventory_incomplete ${JSON.stringify({
        missingRequired: result.missingRequired,
        missingGuards: result.missingGuards,
        missingFloor: result.missingFloor,
        missingIdentities: result.missingIdentities,
        unknownWrites: result.unknownWrites,
      })}`,
    );
  }
  return result;
}
