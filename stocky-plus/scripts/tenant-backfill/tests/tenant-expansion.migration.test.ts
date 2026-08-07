/**
 * Phase 1 PR 1 — real PostgreSQL migration + backfill integration tests.
 * Requires DATABASE_URL / TENANT_MIGRATION_DATABASE_URL on disposable PostgreSQL 16.
 */
import { execFileSync } from "node:child_process";
import {
  renameSync,
  existsSync,
  mkdirSync,
  cpSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { runTenantBackfill } from "../engine";
import { acquireApplyLock } from "../apply-lock";
import { featureFlags } from "../../../app/lib/feature-flags.server";
import { normalizeShopDomain } from "../../../app/lib/shop-domain";
import { Client } from "pg";
import { applyIndexes } from "../../tenant-indexes/apply";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, "..", "..", "..");
const MIGRATIONS_DIR = join(APP_ROOT, "prisma", "migrations");

/** Exact migration folders present on this branch (stable names, not globs). */
const ALL_MIGRATION_NAMES = [
  "20260728000000_init_stocky_plus",
  "20260730160000_tenant_expansion",
  "20260730160100_tenant_compatibility_indexes",
  "20260730210000_tenant_backfill_correction",
  "20260730220000_tenant_ownership_issue_detection",
  "20260803120000_tenant_enforcement_helpers",
  "20260804180000_sync_control_plane",
  "20260804210000_sync_control_plane_correction",
  "20260804220000_sync_control_plane_correction_defaults",
  "20260805120000_sync_control_plane_second_correction",
  "20260805130000_sync_control_plane_receipt_probe_revoke",
  "20260805140000_sync_control_plane_enqueued_failed",
  "20260806220000_sync_control_plane_d047_fair_claim_indexes",
  "20260807010000_sync_control_plane_d048_dispatch_ready_shop",
  "20260807150000_sync_control_plane_d049_dispatch_schedule",
] as const;

/**
 * Control-plane tables that receive stocky_control_plane policies when that
 * role already exists (see 20260804210000_sync_control_plane_correction).
 * SyncApplicationReceipt is intentionally omitted — merchant-domain only.
 * DispatchReadyShop is added by D-048 with the same role-conditional pattern.
 */
const CONTROL_PLANE_POLICY_TABLES = [
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
  "JobDispatch",
  "DispatchReadyShop",
] as const;

function listMigrationDirEntries(): string[] {
  return readdirSync(MIGRATIONS_DIR).sort();
}

async function controlPlaneRoleExists(prisma: PrismaClient): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_roles WHERE rolname = 'stocky_control_plane'
     ) AS exists`,
  );
  return Boolean(rows[0]?.exists);
}

type ControlPlaneRoleSnapshot = {
  exists: boolean;
  canLogin: boolean;
};

async function snapshotControlPlaneRole(
  prisma: PrismaClient,
): Promise<ControlPlaneRoleSnapshot> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ exists: boolean; can_login: boolean | null }>
  >(
    `SELECT
       EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stocky_control_plane') AS exists,
       (SELECT rolcanlogin FROM pg_roles WHERE rolname = 'stocky_control_plane') AS can_login`,
  );
  return {
    exists: Boolean(rows[0]?.exists),
    canLogin: Boolean(rows[0]?.can_login),
  };
}

/** Create stocky_control_plane when absent (NOLOGIN / NOINHERIT; disposable only). */
async function ensureControlPlaneRole(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stocky_control_plane') THEN
        CREATE ROLE stocky_control_plane NOINHERIT NOLOGIN;
      END IF;
    END $$;
  `);
}

/**
 * Drop stocky_control_plane when present. Disposable-DB only — DROP OWNED clears
 * role-conditional grants/policies left after schema resets.
 */
async function dropControlPlaneRole(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stocky_control_plane') THEN
        DROP OWNED BY stocky_control_plane CASCADE;
        DROP ROLE stocky_control_plane;
      END IF;
    END $$;
  `);
}

/**
 * Restore exact prior presence/absence (and LOGIN capability) of
 * stocky_control_plane after a fixture. LOGIN restore uses the disposable
 * STOCKY_CONTROL_PLANE_ROLE_PASSWORD when the prior snapshot was login-capable.
 */
async function restoreControlPlaneRoleState(
  prisma: PrismaClient,
  before: ControlPlaneRoleSnapshot,
): Promise<void> {
  if (!before.exists) {
    await dropControlPlaneRole(prisma);
    return;
  }

  await ensureControlPlaneRole(prisma);

  if (before.canLogin) {
    const password = process.env.STOCKY_CONTROL_PLANE_ROLE_PASSWORD;
    if (!password) {
      throw new Error(
        "STOCKY_CONTROL_PLANE_ROLE_PASSWORD required to restore login-capable stocky_control_plane",
      );
    }
    const escaped = password.replace(/'/g, "''");
    await prisma.$executeRawUnsafe(
      `ALTER ROLE stocky_control_plane LOGIN PASSWORD '${escaped}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `ALTER ROLE stocky_control_plane NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
    );
  }
}

async function assertMigrationRecordedExactlyOnce(
  prisma: PrismaClient,
): Promise<void> {
  const recorded = await prisma.$queryRawUnsafe<
    Array<{ migration_name: string; cnt: bigint }>
  >(
    `SELECT migration_name, COUNT(*)::bigint AS cnt
     FROM _prisma_migrations
     GROUP BY migration_name
     ORDER BY migration_name`,
  );
  expect(recorded.map((r) => r.migration_name)).toEqual([
    ...ALL_MIGRATION_NAMES,
  ]);
  for (const row of recorded) {
    expect(Number(row.cnt)).toBe(1);
  }
}

function assertSecondDeployNoPending(secondDeployOut: string): void {
  // NEW-PR4-C07: reject vacuous `/0/` — require Prisma's real no-pending message.
  expect(secondDeployOut).toMatch(/No pending migrations to apply/i);
}

async function assertControlPlanePoliciesMatchRole(
  prisma: PrismaClient,
): Promise<void> {
  const rolePresent = await controlPlaneRoleExists(prisma);
  const policies = await prisma.$queryRawUnsafe<
    Array<{ tablename: string; policyname: string; roles: string[] }>
  >(
    `SELECT tablename, policyname, roles
     FROM pg_policies
     WHERE schemaname = 'public'
     ORDER BY tablename, policyname`,
  );

  if (!rolePresent) {
    // Role absent → correction migration skips CREATE POLICY.
    expect(policies.length).toBe(0);
    return;
  }

  // Role present (CI after sync:roles:provision) → exactly one policy per
  // control-plane table; SyncApplicationReceipt must remain policy-free here.
  const expected = [...CONTROL_PLANE_POLICY_TABLES]
    .map((t) => ({
      tablename: t,
      policyname: `${t}_control_plane_all`,
      roles: ["stocky_control_plane"],
    }))
    .sort((a, b) => a.tablename.localeCompare(b.tablename));

  expect(policies).toEqual(expected);

  const receiptPolicies = policies.filter(
    (p) => p.tablename === "SyncApplicationReceipt",
  );
  expect(receiptPolicies.length).toBe(0);
}

/** OverlayFS-safe directory move (rename can raise EXDEV). */
function moveDir(from: string, to: string): void {
  try {
    renameSync(from, to);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "EXDEV") throw err;
    cpSync(from, to, { recursive: true });
    rmSync(from, { recursive: true, force: true });
  }
}

const DATABASE_URL =
  process.env.TENANT_MIGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://stocky:stocky@localhost:5432/stocky_plus_migrations";

function run(cmd: string, args: string[]) {
  return execFileSync(cmd, args, {
    cwd: APP_ROOT,
    env: { ...process.env, DATABASE_URL },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function resetPublicSchema(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`DROP SCHEMA public CASCADE`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA public`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO stocky`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO public`);
}

function migrateDeploy(): string {
  return run("npx", ["prisma", "migrate", "deploy"]);
}

async function applyCompatibilityIndexes() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await applyIndexes(client, { apply: true });
  } finally {
    await client.end();
  }
}

/**
 * Apply only the historical main init migration, then restore later migrations
 * so `migrate deploy` applies expansion + indexes + subsequent phases on top.
 * Park folders OUTSIDE prisma/migrations — Prisma treats every subdirectory
 * there as a migration (empty dirs cause P3015).
 *
 * Every migration after init must be parked for the init-only pass; otherwise
 * later additive migrations (e.g. sync control plane ALTER TABLE "Shop") run
 * before tenant_expansion creates Shop.
 */
function migrateInitOnlyThenRest(): { initOut: string; restOut: string } {
  const afterInit = [
    "20260730160000_tenant_expansion",
    "20260730160100_tenant_compatibility_indexes",
    "20260730210000_tenant_backfill_correction",
    "20260730220000_tenant_ownership_issue_detection",
    "20260803120000_tenant_enforcement_helpers",
    "20260804180000_sync_control_plane",
    "20260804210000_sync_control_plane_correction",
    "20260804220000_sync_control_plane_correction_defaults",
    "20260805120000_sync_control_plane_second_correction",
    "20260805130000_sync_control_plane_receipt_probe_revoke",
    "20260805140000_sync_control_plane_enqueued_failed",
    "20260806220000_sync_control_plane_d047_fair_claim_indexes",
    "20260807010000_sync_control_plane_d048_dispatch_ready_shop",
    "20260807150000_sync_control_plane_d049_dispatch_schedule",
  ] as const;

  const parked = join(APP_ROOT, ".tmp-parked-migrations");
  mkdirSync(parked, { recursive: true });
  const parkedPaths = afterInit.map((name) => ({
    name,
    src: join(MIGRATIONS_DIR, name),
    dest: join(parked, name),
  }));

  try {
    for (const p of parkedPaths) {
      if (existsSync(p.src)) moveDir(p.src, p.dest);
    }
    const initOut = migrateDeploy();
    for (const p of parkedPaths) {
      if (existsSync(p.dest)) moveDir(p.dest, p.src);
    }
    const restOut = migrateDeploy();
    return { initOut, restOut };
  } catch (error) {
    for (const p of parkedPaths) {
      if (existsSync(p.dest) && !existsSync(p.src)) {
        moveDir(p.dest, p.src);
      }
    }
    throw error;
  } finally {
    // Always remove the parking root so a failed/partial run cannot leave
    // renamed migration folders or an empty parked tree behind.
    if (existsSync(parked)) {
      for (const p of parkedPaths) {
        if (existsSync(p.dest) && !existsSync(p.src)) {
          moveDir(p.dest, p.src);
        }
      }
      rmSync(parked, { recursive: true, force: true });
    }
  }
}

describe("Phase 1 PR 1 tenant expansion migrations + backfill", () => {
  const prisma = new PrismaClient({
    datasources: { db: { url: DATABASE_URL } },
  });

  beforeAll(() => {
    run("npx", ["prisma", "generate"]);
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("applies migrations from an empty database", async () => {
    await resetPublicSchema(prisma);
    const out = migrateDeploy();
    expect(out).toContain("20260730160000_tenant_expansion");
    expect(out).toContain("20260730160100_tenant_compatibility_indexes");
    expect(out).toContain("20260730210000_tenant_backfill_correction");
  }, 120_000);

  it("applies new migrations on top of current-main init schema", async () => {
    await resetPublicSchema(prisma);
    const beforeDir = listMigrationDirEntries();
    const { initOut, restOut } = migrateInitOnlyThenRest();
    expect(initOut).toContain("20260728000000_init_stocky_plus");
    expect(initOut).not.toContain("20260730160000_tenant_expansion");
    expect(initOut).not.toContain("20260804210000_sync_control_plane_correction");
    expect(initOut).not.toContain(
      "20260804220000_sync_control_plane_correction_defaults",
    );
    expect(restOut).toContain("20260730160000_tenant_expansion");
    expect(restOut).toContain("20260730160100_tenant_compatibility_indexes");
    expect(restOut).toContain("20260730210000_tenant_backfill_correction");
    expect(restOut).toContain("20260804210000_sync_control_plane_correction");
    expect(restOut).toContain(
      "20260804220000_sync_control_plane_correction_defaults",
    );
    expect(listMigrationDirEntries()).toEqual(beforeDir);
  }, 180_000);

  it("NEW-PR4-C07 role-present: parks PR4 migrations, applies once, creates twelve control-plane policies", async () => {
    const beforeDir = listMigrationDirEntries();
    expect(beforeDir).toEqual(
      expect.arrayContaining([
        "20260804180000_sync_control_plane",
        "20260804210000_sync_control_plane_correction",
        "20260804220000_sync_control_plane_correction_defaults",
        "20260805120000_sync_control_plane_second_correction",
        "20260805130000_sync_control_plane_receipt_probe_revoke",
        "20260805140000_sync_control_plane_enqueued_failed",
        "20260806220000_sync_control_plane_d047_fair_claim_indexes",
        "20260807010000_sync_control_plane_d048_dispatch_ready_shop",
        "20260807150000_sync_control_plane_d049_dispatch_schedule",
        "migration_lock.toml",
      ]),
    );

    const roleExistedBefore = await snapshotControlPlaneRole(prisma);
    try {
      await ensureControlPlaneRole(prisma);
      expect(await controlPlaneRoleExists(prisma)).toBe(true);

      await resetPublicSchema(prisma);
      const { initOut, restOut } = migrateInitOnlyThenRest();

      expect(initOut).toContain("20260728000000_init_stocky_plus");
      expect(initOut).not.toContain("20260804180000_sync_control_plane");
      expect(initOut).not.toContain(
        "20260804210000_sync_control_plane_correction",
      );
      expect(initOut).not.toContain(
        "20260804220000_sync_control_plane_correction_defaults",
      );
      expect(initOut).not.toContain(
        "20260805120000_sync_control_plane_second_correction",
      );
      expect(initOut).not.toContain(
        "20260805130000_sync_control_plane_receipt_probe_revoke",
      );
      expect(initOut).not.toContain(
        "20260805140000_sync_control_plane_enqueued_failed",
      );
      expect(initOut).not.toContain(
        "20260806220000_sync_control_plane_d047_fair_claim_indexes",
      );
      expect(initOut).not.toContain(
        "20260807010000_sync_control_plane_d048_dispatch_ready_shop",
      );
      expect(initOut).not.toContain(
        "20260807150000_sync_control_plane_d049_dispatch_schedule",
      );

      expect(restOut).toContain("20260804180000_sync_control_plane");
      expect(restOut).toContain("20260804210000_sync_control_plane_correction");
      expect(restOut).toContain(
        "20260804220000_sync_control_plane_correction_defaults",
      );
      expect(restOut).toContain(
        "20260805120000_sync_control_plane_second_correction",
      );
      expect(restOut).toContain(
        "20260805130000_sync_control_plane_receipt_probe_revoke",
      );
      expect(restOut).toContain(
        "20260805140000_sync_control_plane_enqueued_failed",
      );
      expect(restOut).toContain(
        "20260806220000_sync_control_plane_d047_fair_claim_indexes",
      );
      expect(restOut).toContain(
        "20260807010000_sync_control_plane_d048_dispatch_ready_shop",
      );
      expect(restOut).toContain(
        "20260807150000_sync_control_plane_d049_dispatch_schedule",
      );

      await assertMigrationRecordedExactlyOnce(prisma);

      const second = migrateDeploy();
      assertSecondDeployNoPending(second);
      await assertMigrationRecordedExactlyOnce(prisma);

      expect(await controlPlaneRoleExists(prisma)).toBe(true);
      await assertControlPlanePoliciesMatchRole(prisma);

      expect(listMigrationDirEntries()).toEqual(beforeDir);
      expect(existsSync(join(APP_ROOT, ".tmp-parked-migrations"))).toBe(false);
    } finally {
      await restoreControlPlaneRoleState(prisma, roleExistedBefore);
    }
  }, 180_000);

  it("NEW-PR4-C07 role-absent: parks PR4 migrations, applies once, creates zero control-plane policies", async () => {
    const beforeDir = listMigrationDirEntries();
    const roleExistedBefore = await snapshotControlPlaneRole(prisma);
    try {
      await dropControlPlaneRole(prisma);
      expect(await controlPlaneRoleExists(prisma)).toBe(false);

      await resetPublicSchema(prisma);
      const { initOut, restOut } = migrateInitOnlyThenRest();

      expect(initOut).toContain("20260728000000_init_stocky_plus");
      expect(restOut).toContain("20260804180000_sync_control_plane");
      expect(restOut).toContain("20260804210000_sync_control_plane_correction");
      expect(restOut).toContain(
        "20260805120000_sync_control_plane_second_correction",
      );
      expect(restOut).toContain(
        "20260805130000_sync_control_plane_receipt_probe_revoke",
      );
      expect(restOut).toContain(
        "20260805140000_sync_control_plane_enqueued_failed",
      );
      expect(restOut).toContain(
        "20260806220000_sync_control_plane_d047_fair_claim_indexes",
      );
      expect(restOut).toContain(
        "20260807010000_sync_control_plane_d048_dispatch_ready_shop",
      );
      expect(restOut).toContain(
        "20260807150000_sync_control_plane_d049_dispatch_schedule",
      );

      await assertMigrationRecordedExactlyOnce(prisma);

      const second = migrateDeploy();
      assertSecondDeployNoPending(second);
      await assertMigrationRecordedExactlyOnce(prisma);

      expect(await controlPlaneRoleExists(prisma)).toBe(false);
      await assertControlPlanePoliciesMatchRole(prisma);

      expect(listMigrationDirEntries()).toEqual(beforeDir);
      expect(existsSync(join(APP_ROOT, ".tmp-parked-migrations"))).toBe(false);
    } finally {
      await restoreControlPlaneRoleState(prisma, roleExistedBefore);
    }
  }, 180_000);

  it("NEW-PR4-C07: parking cleanup restores migration tree after injected assertion failure", async () => {
    const beforeDir = listMigrationDirEntries();
    const roleExistedBefore = await snapshotControlPlaneRole(prisma);
    let injectedFailure = false;
    try {
      await ensureControlPlaneRole(prisma);
      await resetPublicSchema(prisma);
      const { initOut } = migrateInitOnlyThenRest();
      expect(initOut).toContain("20260728000000_init_stocky_plus");
      // Intentional assertion failure after parking helper restored folders.
      expect(initOut).toContain("__injected_assertion_failure__");
    } catch (err) {
      injectedFailure = true;
      expect(String(err)).toMatch(/__injected_assertion_failure__/);
    } finally {
      await restoreControlPlaneRoleState(prisma, roleExistedBefore);
    }
    expect(injectedFailure).toBe(true);
    expect(listMigrationDirEntries()).toEqual(beforeDir);
    expect(existsSync(join(APP_ROOT, ".tmp-parked-migrations"))).toBe(false);
  }, 180_000);

  it("preserves legacy shop, Session shape, nullable shopId, indexes; PR4 control-plane RLS only; no composite FKs; flags OFF", async () => {
    await resetPublicSchema(prisma);
    migrateDeploy();
    await applyCompatibilityIndexes();

    const merchantTables = [
      "Supplier",
      "SupplierSkuMapping",
      "VolumePriceTier",
      "LeadTimeSnapshot",
      "PurchaseOrder",
      "POLineItem",
      "ShopifyVariantCache",
      "InventorySnapshot",
      "VariantAbcClass",
      "ForecastOverride",
      "SalesDailyAggregate",
      "ShopSettings",
      "TransferOrder",
      "TransferLineItem",
      "Stocktake",
      "StocktakeLineItem",
      "BomComponent",
      "LowStockAlert",
    ];

    for (const table of merchantTables) {
      const shopId = await prisma.$queryRawUnsafe<
        Array<{ is_nullable: string }>
      >(
        `SELECT is_nullable FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1 AND column_name='shopId'`,
        table,
      );
      expect(shopId[0]?.is_nullable).toBe("YES");
    }

    const legacyShopTables = [
      "Supplier",
      "PurchaseOrder",
      "ShopifyVariantCache",
      "InventorySnapshot",
      "VariantAbcClass",
      "ForecastOverride",
      "SalesDailyAggregate",
      "ShopSettings",
      "TransferOrder",
      "Stocktake",
      "BomComponent",
      "LowStockAlert",
      "Session",
    ];
    for (const table of legacyShopTables) {
      const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1 AND column_name='shop'`,
        table,
      );
      expect(cols.length).toBe(1);
    }

    const sessionShopId = await prisma.$queryRawUnsafe<
      Array<{ column_name: string }>
    >(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='Session' AND column_name='shopId'`,
    );
    expect(sessionShopId.length).toBe(0);

    // D-043 / F-PR4-06: correction migration ENABLE+FORCE RLS on control-plane
    // tables + SyncApplicationReceipt. Other merchant tables remain without
    // migration-applied RLS until tenant-enforcement apply.
    const rls = await prisma.$queryRawUnsafe<Array<{ relname: string }>>(
      `SELECT c.relname FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true
       ORDER BY c.relname`,
    );
    expect(rls.map((r) => r.relname)).toEqual([
      "DataIssue",
      "DeadLetter",
      "DispatchReadyShop",
      "DurableJob",
      "JobAttempt",
      "JobDispatch",
      "JobReplay",
      "ReconciliationRun",
      "SyncApplicationReceipt",
      "SyncCursor",
      "SyncHealth",
      "SyncRun",
      "WebhookDelivery",
    ]);

    // Policies are role-conditional: created only when stocky_control_plane
    // already exists (CI after sync role provisioning). Assert exact set.
    await assertControlPlanePoliciesMatchRole(prisma);

    const indexes = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
      `SELECT indexname FROM pg_indexes WHERE schemaname='public'`,
    );
    const names = indexes.map((i) => i.indexname);
    expect(names).toEqual(
      expect.arrayContaining([
        "Supplier_shopId_idx",
        "Supplier_shopId_id_key",
        "PurchaseOrder_shopId_id_key",
        "TransferOrder_shopId_id_key",
        "Stocktake_shopId_id_key",
        "SupplierSkuMapping_shopId_supplierId_idx",
        "VolumePriceTier_shopId_supplierId_idx",
        "LeadTimeSnapshot_shopId_supplierId_idx",
        "POLineItem_shopId_purchaseOrderId_idx",
        "TransferLineItem_shopId_transferOrderId_idx",
        "StocktakeLineItem_shopId_stocktakeId_idx",
      ]),
    );

    const compositeFks = await prisma.$queryRawUnsafe<
      Array<{ conname: string }>
    >(
      `SELECT conname FROM pg_constraint
       WHERE contype = 'f' AND array_length(conkey, 1) > 1`,
    );
    expect(compositeFks.length).toBe(0);

    delete process.env.FEATURE_STOCKTAKE_INVENTORY_WRITES;
    delete process.env.FEATURE_ADJUSTMENT_WRITES;
    delete process.env.FEATURE_RECEIPT_WRITES;
    delete process.env.FEATURE_COST_SYNC;
    delete process.env.FEATURE_TRANSFER_WRITES;
    expect(featureFlags.stocktakeInventoryWrites()).toBe(false);
    expect(featureFlags.adjustmentWrites()).toBe(false);
    expect(featureFlags.receiptWrites()).toBe(false);
    expect(featureFlags.costSync()).toBe(false);
    expect(featureFlags.transferWrites()).toBe(false);
  }, 120_000);

  it("backfills ownership, quarantines issues, resumes, stays idempotent, denies concurrent apply", async () => {
    await resetPublicSchema(prisma);
    migrateDeploy();
    await applyCompatibilityIndexes();

    process.env.TENANT_MAINTENANCE_DATABASE_URL = DATABASE_URL;

    const shopA = "shop-a.myshopify.com";
    const shopB = "shop-b.myshopify.com";
    const shopAWeird = "  SHOP-A.MYSHOPIFY.COM ";
    const invalidDomain = "https://evil.myshopify.com";

    await prisma.session.create({
      data: {
        id: "sess-a",
        shop: shopA,
        state: "state",
        accessToken: "token-must-not-appear-in-issues",
        isOnline: false,
      },
    });

    const supplierA = await prisma.supplier.create({
      data: { id: "sup-a", shop: shopAWeird, name: "Supplier A" },
    });
    const supplierB = await prisma.supplier.create({
      data: { id: "sup-b", shop: shopB, name: "Supplier B" },
    });

    const preShop = await prisma.shop.create({
      data: {
        id: "shop-pre-b",
        myshopifyDomain: shopB,
        updatedAt: new Date(),
      },
    });
    await prisma.supplier.update({
      where: { id: supplierB.id },
      data: { shopId: preShop.id },
    });

    // Conflicting preexisting shopId (no Shop row for wrong id)
    const conflictSupplier = await prisma.supplier.create({
      data: {
        id: "sup-conflict",
        shop: shopA,
        name: "Conflict",
        shopId: "shop-wrong-id",
      },
    });

    // Wrong Shop domain for CONFLICTING_NORMALIZED_DOMAIN
    await prisma.shop.create({
      data: {
        id: "shop-other",
        myshopifyDomain: "other-store.myshopify.com",
        updatedAt: new Date(),
      },
    });
    await prisma.supplier.create({
      data: {
        id: "sup-domain-conflict",
        shop: shopA,
        name: "Domain conflict",
        shopId: "shop-other",
      },
    });

    await prisma.supplier.create({
      data: { id: "sup-invalid", shop: invalidDomain, name: "Invalid" },
    });

    // Parent with unresolved ownership → child stays null
    const unresolvedParent = await prisma.supplier.create({
      data: {
        id: "sup-unresolved-parent",
        shop: "not-a-shop.example.com",
        name: "Unresolved parent",
      },
    });
    await prisma.supplierSkuMapping.create({
      data: {
        id: "map-unresolved-parent",
        supplierId: unresolvedParent.id,
        shopifyVariantId: "v-unresolved",
        vendorSku: "SKU-U",
      },
    });

    const poA = await prisma.purchaseOrder.create({
      data: {
        id: "po-a",
        shop: shopA,
        supplierId: supplierA.id,
        locationId: "loc-1",
      },
    });

    const poMismatch = await prisma.purchaseOrder.create({
      data: {
        id: "po-mismatch",
        shop: shopA,
        supplierId: supplierB.id,
        locationId: "loc-1",
      },
    });

    const mapping = await prisma.supplierSkuMapping.create({
      data: {
        id: "map-a",
        supplierId: supplierA.id,
        shopifyVariantId: "v1",
        vendorSku: "SKU-1",
      },
    });

    await prisma.$executeRawUnsafe(
      `INSERT INTO "LeadTimeSnapshot" (id, "supplierId", "purchaseOrderId", "leadTimeDays", "recordedAt")
       VALUES ('lt-missing-po', $1, 'po-does-not-exist', 3, now())`,
      supplierA.id,
    );

    await prisma.leadTimeSnapshot.create({
      data: {
        id: "lt-mismatch",
        supplierId: supplierB.id,
        purchaseOrderId: poMismatch.id,
        leadTimeDays: 4,
      },
    });

    await prisma.shopSettings.create({
      data: { id: "settings-1", shop: shopA },
    });
    await prisma.shopSettings.create({
      data: { id: "settings-2", shop: "SHOP-A.MYSHOPIFY.COM" },
    });

    const shopsBefore = await prisma.$queryRawUnsafe<
      Array<{ id: string; shop: string }>
    >(`SELECT id, shop FROM "Supplier" ORDER BY id`);

    const dry = await runTenantBackfill({
      prisma,
      mode: "dry-run",
      batchSize: 2,
    });
    expect(dry.status).toBe("COMPLETED_WITH_ISSUES");
    expect(dry.blockingIssueCount).toBeGreaterThan(0);

    const afterDry = await prisma.supplier.findUnique({
      where: { id: supplierA.id },
    });
    expect(afterDry?.shopId).toBeNull();

    const interrupted = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 1,
      stopAfterBatches: 1,
    });
    expect(interrupted.status).toBe("INTERRUPTED");

    const resumed = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 50,
      resumeRunId: interrupted.runId,
    });
    expect(resumed.status).toBe("COMPLETED_WITH_ISSUES");

    const aAfter = await prisma.supplier.findUnique({
      where: { id: supplierA.id },
    });
    const shopRow = await prisma.shop.findUnique({
      where: { myshopifyDomain: "shop-a.myshopify.com" },
    });
    expect(aAfter?.shopId).toBe(shopRow?.id);
    expect(
      await prisma.shop.count({
        where: { myshopifyDomain: "shop-a.myshopify.com" },
      }),
    ).toBe(1);

    const bAfter = await prisma.supplier.findUnique({
      where: { id: supplierB.id },
    });
    expect(bAfter?.shopId).toBe(preShop.id);

    const conflictAfter = await prisma.supplier.findUnique({
      where: { id: conflictSupplier.id },
    });
    expect(conflictAfter?.shopId).toBe("shop-wrong-id");

    const mapAfter = await prisma.supplierSkuMapping.findUnique({
      where: { id: mapping.id },
    });
    expect(mapAfter?.shopId).toBe(aAfter?.shopId);

    const childUnresolved = await prisma.supplierSkuMapping.findUnique({
      where: { id: "map-unresolved-parent" },
    });
    expect(childUnresolved?.shopId).toBeNull();

    const shopsAfter = await prisma.$queryRawUnsafe<
      Array<{ id: string; shop: string }>
    >(`SELECT id, shop FROM "Supplier" ORDER BY id`);
    expect(shopsAfter).toEqual(shopsBefore);

    const issues = await prisma.tenantOwnershipIssue.findMany({
      where: { status: "OPEN" },
    });
    const reasons = new Set(issues.map((i) => i.reasonCode));
    expect(reasons.has("INVALID_SHOP_DOMAIN")).toBe(true);
    expect(reasons.has("EXISTING_SHOP_ID_MISMATCH")).toBe(true);
    expect(reasons.has("CONFLICTING_NORMALIZED_DOMAIN")).toBe(true);
    expect(reasons.has("PARENT_SHOP_UNRESOLVED")).toBe(true);
    expect(reasons.has("PURCHASE_ORDER_SUPPLIER_SHOP_MISMATCH")).toBe(true);
    expect(reasons.has("LEAD_TIME_PURCHASE_ORDER_MISSING")).toBe(true);
    expect(reasons.has("LEAD_TIME_PURCHASE_ORDER_SHOP_MISMATCH")).toBe(true);
    expect(reasons.has("DUPLICATE_SHOP_SETTINGS_TENANT")).toBe(true);

    const dumped = JSON.stringify(issues);
    expect(dumped).not.toContain("token-must-not-appear-in-issues");
    expect(dumped).not.toContain("accessToken");

    const second = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 50,
    });
    expect(second.status).toBe("COMPLETED_WITH_ISSUES");
    expect(second.checksums.Supplier).toBe(resumed.checksums.Supplier);

    const lock = await acquireApplyLock();
    try {
      await expect(
        runTenantBackfill({ prisma, mode: "apply", batchSize: 10 }),
      ).rejects.toThrow(/Concurrent tenant backfill apply is denied/);
    } finally {
      await lock.release();
    }

    const dry2 = await runTenantBackfill({
      prisma,
      mode: "dry-run",
      batchSize: 50,
    });
    expect(dry2.status).toBe("COMPLETED_WITH_ISSUES");
    expect(dry2.unresolvedCounts.Supplier).toBeGreaterThan(0);

    expect(poA.id).toBe("po-a");
    expect(normalizeShopDomain(shopAWeird)).toEqual({
      ok: true,
      normalized: "shop-a.myshopify.com",
    });
  }, 180_000);
});
