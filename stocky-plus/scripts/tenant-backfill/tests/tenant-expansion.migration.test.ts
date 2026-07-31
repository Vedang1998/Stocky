/**
 * Phase 1 PR 1 — real PostgreSQL migration + backfill integration tests.
 * Requires DATABASE_URL / TENANT_MIGRATION_DATABASE_URL on disposable PostgreSQL 16.
 */
import { execFileSync } from "node:child_process";
import { renameSync, existsSync, mkdirSync } from "node:fs";
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
 * Apply only the historical main init migration, then restore PR 1 migrations
 * so `migrate deploy` applies expansion + indexes on top.
 * Park folders OUTSIDE prisma/migrations — Prisma treats every subdirectory
 * there as a migration (empty dirs cause P3015).
 */
function migrateInitOnlyThenRest(): { initOut: string; restOut: string } {
  const expansion = join(MIGRATIONS_DIR, "20260730160000_tenant_expansion");
  const indexes = join(
    MIGRATIONS_DIR,
    "20260730160100_tenant_compatibility_indexes",
  );
  const correction = join(
    MIGRATIONS_DIR,
    "20260730210000_tenant_backfill_correction",
  );
  const parked = join(APP_ROOT, ".tmp-parked-migrations");
  mkdirSync(parked, { recursive: true });
  const expansionPark = join(parked, "20260730160000_tenant_expansion");
  const indexesPark = join(
    parked,
    "20260730160100_tenant_compatibility_indexes",
  );
  const correctionPark = join(
    parked,
    "20260730210000_tenant_backfill_correction",
  );

  try {
    if (existsSync(expansion)) renameSync(expansion, expansionPark);
    if (existsSync(indexes)) renameSync(indexes, indexesPark);
    if (existsSync(correction)) renameSync(correction, correctionPark);
    const initOut = migrateDeploy();
    renameSync(expansionPark, expansion);
    renameSync(indexesPark, indexes);
    renameSync(correctionPark, correction);
    const restOut = migrateDeploy();
    return { initOut, restOut };
  } catch (error) {
    if (existsSync(expansionPark) && !existsSync(expansion)) {
      renameSync(expansionPark, expansion);
    }
    if (existsSync(indexesPark) && !existsSync(indexes)) {
      renameSync(indexesPark, indexes);
    }
    if (existsSync(correctionPark) && !existsSync(correction)) {
      renameSync(correctionPark, correction);
    }
    throw error;
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
    const { initOut, restOut } = migrateInitOnlyThenRest();
    expect(initOut).toContain("20260728000000_init_stocky_plus");
    expect(initOut).not.toContain("20260730160000_tenant_expansion");
    expect(restOut).toContain("20260730160000_tenant_expansion");
    expect(restOut).toContain("20260730160100_tenant_compatibility_indexes");
    expect(restOut).toContain("20260730210000_tenant_backfill_correction");
  }, 180_000);

  it("preserves legacy shop, Session shape, nullable shopId, indexes; no RLS/composite FKs; flags OFF", async () => {
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

    const rls = await prisma.$queryRawUnsafe<Array<{ relname: string }>>(
      `SELECT c.relname FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true`,
    );
    expect(rls.length).toBe(0);

    const policies = await prisma.$queryRawUnsafe<Array<{ policyname: string }>>(
      `SELECT policyname FROM pg_policies WHERE schemaname='public'`,
    );
    expect(policies.length).toBe(0);

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
