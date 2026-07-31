/**
 * R5 — zero-row UPDATE re-read classification under concurrent assignment.
 */
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyShopIdUpdate, runTenantBackfill } from "../engine";
import {
  createMigrationPrisma,
  DATABASE_URL,
  prepareEmptyDatabase,
  prismaGenerate,
  setMaintenanceDatabaseUrl,
} from "./helpers";

describe("affected-row concurrency classification (R5)", () => {
  const prisma = createMigrationPrisma();

  beforeAll(() => {
    prismaGenerate();
    setMaintenanceDatabaseUrl();
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedShopsAndNullSupplier() {
    await prisma.session.create({
      data: {
        id: "sess-conc",
        shop: "conc-a.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    await prisma.session.create({
      data: {
        id: "sess-conc-b",
        shop: "conc-b.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    // Materialize Shop rows via dry-run discovery path (apply).
    await runTenantBackfill({ prisma, mode: "apply", batchSize: 10 });

    await prisma.supplier.create({
      data: {
        id: "sup-conc-null",
        shop: "conc-a.myshopify.com",
        name: "Null target",
        shopId: null,
      },
    });

    const shops = await prisma.shop.findMany({
      select: { id: true, myshopifyDomain: true },
    });
    const expected = shops.find((s) => s.myshopifyDomain === "conc-a.myshopify.com");
    const other = shops.find((s) => s.myshopifyDomain === "conc-b.myshopify.com");
    if (!expected || !other) {
      throw new Error("expected shops missing after backfill");
    }
    return { expectedShopId: expected.id, otherShopId: other.id };
  }

  it("concurrent matching assignment → concurrently_resolved; counts as unchanged", async () => {
    await prepareEmptyDatabase(prisma);
    const { expectedShopId } = await seedShopsAndNullSupplier();

    await prisma.$transaction(async (tx) => {
      // Simulate concurrent matching writer winning the nullable row.
      await tx.$executeRawUnsafe(
        `UPDATE "Supplier" SET "shopId" = $1 WHERE id = $2 AND "shopId" IS NULL`,
        expectedShopId,
        "sup-conc-null",
      );

      const result = await applyShopIdUpdate(
        tx as never,
        "Supplier",
        "sup-conc-null",
        expectedShopId,
      );
      expect(result.kind).toBe("concurrently_resolved");
    });

    const row = await prisma.supplier.findUnique({
      where: { id: "sup-conc-null" },
    });
    expect(row?.shopId).toBe(expectedShopId);
  }, 180_000);

  it("concurrent conflicting assignment → unresolved with durable issue", async () => {
    await prepareEmptyDatabase(prisma);
    const { expectedShopId, otherShopId } = await seedShopsAndNullSupplier();

    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `UPDATE "Supplier" SET "shopId" = $1 WHERE id = $2 AND "shopId" IS NULL`,
        otherShopId,
        "sup-conc-null",
      );

      return applyShopIdUpdate(
        tx as never,
        "Supplier",
        "sup-conc-null",
        expectedShopId,
      );
    });
    expect(result.kind).toBe("unresolved");
    if (result.kind !== "unresolved") throw new Error("expected unresolved");
    expect(result.issue.reasonCode).toBe("CONCURRENT_SHOP_ID_CONFLICT");

    // Full apply against final conflicting state: durable issue + unresolved counts.
    const apply = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
    });
    expect(apply.status).toBe("COMPLETED_WITH_ISSUES");
    expect(apply.unresolvedCounts.Supplier ?? 0).toBeGreaterThan(0);

    const issues = await prisma.tenantOwnershipIssue.findMany({
      where: {
        tableName: "Supplier",
        rowId: "sup-conc-null",
      },
    });
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues.some((i) => i.status === "OPEN")).toBe(true);
    expect(
      issues.some(
        (i) =>
          i.reasonCode === "EXISTING_SHOP_ID_MISMATCH" ||
          i.reasonCode === "CONFLICTING_NORMALIZED_DOMAIN" ||
          i.reasonCode === "CONCURRENT_SHOP_ID_CONFLICT",
      ),
    ).toBe(true);

    const detections = await prisma.tenantOwnershipIssueDetection.count({
      where: { runId: apply.runId },
    });
    expect(detections).toBe(apply.currentRunDetectedIssueCount);
  }, 180_000);

  it("row deletion during apply → precise missing-row error", async () => {
    await prepareEmptyDatabase(prisma);
    const { expectedShopId } = await seedShopsAndNullSupplier();

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DELETE FROM "Supplier" WHERE id = $1`,
          "sup-conc-null",
        );
        await applyShopIdUpdate(
          tx as never,
          "Supplier",
          "sup-conc-null",
          expectedShopId,
        );
      }),
    ).rejects.toThrow(/no longer exists|Missing row/i);
  }, 180_000);

  it("unexpected null / no-effect outcome fails closed", async () => {
    await prepareEmptyDatabase(prisma);
    const { expectedShopId } = await seedShopsAndNullSupplier();

    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      // BEFORE UPDATE returning NULL skips the row update → RETURNING empty
      // while the row still exists with shopId null.
      await client.query(`
        CREATE OR REPLACE FUNCTION skip_supplier_shopid_update() RETURNS trigger AS $$
        BEGIN
          RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
      `);
      await client.query(`
        CREATE TRIGGER trg_skip_shopid
        BEFORE UPDATE OF "shopId" ON "Supplier"
        FOR EACH ROW EXECUTE PROCEDURE skip_supplier_shopid_update();
      `);
    } finally {
      await client.end();
    }

    await expect(
      prisma.$transaction(async (tx) => {
        await applyShopIdUpdate(
          tx as never,
          "Supplier",
          "sup-conc-null",
          expectedShopId,
        );
      }),
    ).rejects.toThrow(/remains null|Unexpected UPDATE outcome/i);

    const client2 = new Client({ connectionString: DATABASE_URL });
    await client2.connect();
    try {
      await client2.query(`DROP TRIGGER IF EXISTS trg_skip_shopid ON "Supplier"`);
      await client2.query(
        `DROP FUNCTION IF EXISTS skip_supplier_shopid_update()`,
      );
    } finally {
      await client2.end();
    }
  }, 180_000);
});
