import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import { PrismaClient as PrismaClientCtor } from "@prisma/client";
import { Client } from "pg";
import { expect } from "vitest";
import { applyIndexes } from "../../tenant-indexes/apply";
import { BACKFILL_TABLE_ORDER } from "../tables";
import { issueFingerprint } from "../checksum";
import type { BackfillResult } from "../engine";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const APP_ROOT = join(__dirname, "..", "..", "..");

export const DATABASE_URL =
  process.env.TENANT_MIGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://stocky:stocky@localhost:5432/stocky_plus_migrations";

export function cuidLike(): string {
  return `c${randomBytes(12).toString("hex")}`;
}

export function createMigrationPrisma(): PrismaClient {
  return new PrismaClientCtor({
    datasources: { db: { url: DATABASE_URL } },
  });
}

export function setMaintenanceDatabaseUrl(): void {
  process.env.TENANT_MAINTENANCE_DATABASE_URL = DATABASE_URL;
}

function run(cmd: string, args: string[]) {
  return execFileSync(cmd, args, {
    cwd: APP_ROOT,
    env: { ...process.env, DATABASE_URL },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export async function resetPublicSchema(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`DROP SCHEMA public CASCADE`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA public`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO stocky`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO public`);
}

export function migrateDeploy(): string {
  return run("npx", ["prisma", "migrate", "deploy"]);
}

export async function applyCompatibilityIndexes(): Promise<void> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await applyIndexes(client, { apply: true });
  } finally {
    await client.end();
  }
}

/** Fresh schema: migrate deploy + tenant compatibility indexes. */
export async function ensureIndexes(): Promise<void> {
  migrateDeploy();
  await applyCompatibilityIndexes();
}

export async function prepareEmptyDatabase(
  prisma: PrismaClient,
): Promise<void> {
  await resetPublicSchema(prisma);
  await ensureIndexes();
}

export function prismaGenerate(): void {
  run("npx", ["prisma", "generate"]);
}

export type DryRunSnapshot = {
  unresolvedCounts: BackfillResult["unresolvedCounts"];
  updatedCounts: BackfillResult["updatedCounts"];
  unchangedCounts: BackfillResult["unchangedCounts"];
  examinedCounts: BackfillResult["examinedCounts"];
  shopsWouldCreate: number;
  reasonCodes: Set<string>;
  fingerprints: Set<string>;
};

export async function captureDryRunSnapshot(
  prisma: PrismaClient,
  result: BackfillResult,
): Promise<DryRunSnapshot> {
  const issues = await prisma.tenantOwnershipIssue.findMany({
    where: { lastDetectedRunId: result.runId },
    select: { tableName: true, rowId: true, reasonCode: true },
  });
  return {
    unresolvedCounts: { ...result.unresolvedCounts },
    updatedCounts: { ...result.updatedCounts },
    unchangedCounts: { ...result.unchangedCounts },
    examinedCounts: { ...result.examinedCounts },
    shopsWouldCreate: result.shopsWouldCreate,
    reasonCodes: new Set(issues.map((i) => i.reasonCode)),
    fingerprints: new Set(
      issues.map((i) =>
        issueFingerprint({
          tableName: i.tableName,
          rowId: i.rowId,
          reasonCode: i.reasonCode,
        }),
      ),
    ),
  };
}

export function expectSnapshotsEquivalent(
  dry: DryRunSnapshot,
  apply: DryRunSnapshot,
): void {
  expect(dry.unresolvedCounts).toEqual(apply.unresolvedCounts);
  expect(dry.shopsWouldCreate).toBe(apply.shopsWouldCreate);
  expect(dry.reasonCodes).toEqual(apply.reasonCodes);
  expect(dry.fingerprints).toEqual(apply.fingerprints);

  for (const table of BACKFILL_TABLE_ORDER) {
    expect(dry.updatedCounts[table]).toBe(apply.updatedCounts[table]);
    expect(dry.unchangedCounts[table]).toBe(apply.unchangedCounts[table]);
    expect(dry.examinedCounts[table]).toBe(apply.examinedCounts[table]);
  }
}

const SHOP_A = "equiv-a.myshopify.com";
const SHOP_B = "equiv-b.myshopify.com";

/** Fixture for dry-run vs apply equivalence (parent/child pairs + one unresolved). */
export async function seedDryRunApplyEquivalenceFixture(
  prisma: PrismaClient,
): Promise<{
  shopA: string;
  supplierGoodId: string;
  supplierInvalidId: string;
}> {
  await prisma.session.create({
    data: {
      id: "sess-equiv",
      shop: SHOP_A,
      state: "s",
      accessToken: "tok",
      isOnline: false,
    },
  });

  await prisma.supplier.create({
    data: { id: "sup-good", shop: SHOP_A, name: "Good supplier" },
  });
  await prisma.supplier.create({
    data: {
      id: "sup-bad",
      shop: "not-valid-domain.example",
      name: "Bad supplier",
    },
  });
  const supplierB = await prisma.supplier.create({
    data: { id: "sup-b-other", shop: SHOP_B, name: "Other shop supplier" },
  });

  await prisma.supplierSkuMapping.create({
    data: {
      id: "map-good",
      supplierId: "sup-good",
      shopifyVariantId: "v-map",
      vendorSku: "SKU",
    },
  });

  await prisma.purchaseOrder.create({
    data: {
      id: "po-good",
      shop: SHOP_A,
      supplierId: "sup-good",
      locationId: "loc-1",
    },
  });
  await prisma.pOLineItem.create({
    data: {
      id: "pol-good",
      purchaseOrderId: "po-good",
      shopifyVariantId: "v-pol",
      orderedQty: 1,
      unitCost: 1,
    },
  });

  await prisma.purchaseOrder.create({
    data: {
      id: "po-xdomain",
      shop: SHOP_A,
      supplierId: supplierB.id,
      locationId: "loc-1",
    },
  });

  await prisma.transferOrder.create({
    data: {
      id: "xfer-good",
      shop: SHOP_A,
      sourceLocationId: "loc-a",
      destinationLocationId: "loc-b",
    },
  });
  await prisma.transferLineItem.create({
    data: {
      id: "xfl-good",
      transferOrderId: "xfer-good",
      shopifyVariantId: "v-xfer",
      quantity: 2,
    },
  });

  await prisma.stocktake.create({
    data: {
      id: "stk-good",
      shop: SHOP_A,
      locationId: "loc-1",
      name: "Count",
    },
  });
  await prisma.stocktakeLineItem.create({
    data: {
      id: "stkl-good",
      stocktakeId: "stk-good",
      shopifyVariantId: "v-stk",
      expectedQty: 5,
    },
  });

  return {
    shopA: SHOP_A,
    supplierGoodId: "sup-good",
    supplierInvalidId: "sup-bad",
  };
}
