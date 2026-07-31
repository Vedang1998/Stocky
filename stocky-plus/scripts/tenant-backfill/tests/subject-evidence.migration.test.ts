/**
 * F-N02 / F-N03 / F-N04 / F-N07 — coherent subject evidence and bounded discovery.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runTenantBackfill } from "../engine";
import { captureStartingEvidence } from "../starting-snapshot";
import { TENANT_SUBJECT_EVIDENCE_VERSION } from "../subject-manifest";
import {
  createMigrationPrisma,
  prepareEmptyDatabase,
  prismaGenerate,
  setMaintenanceDatabaseUrl,
} from "./helpers";

describe("subject evidence v2 (F-N02/F-N03/F-N04/F-N07)", () => {
  const prisma = createMigrationPrisma();

  beforeAll(() => {
    prismaGenerate();
    setMaintenanceDatabaseUrl();
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedShopA() {
    await prisma.session.create({
      data: {
        id: "sess-subj-a",
        shop: "subj-a.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    await prisma.supplier.create({
      data: {
        id: "sup-subj-a",
        shop: "subj-a.myshopify.com",
        name: "A",
      },
    });
  }

  it("direct-owner domain inserted above boundary does not change shopsWouldCreate", async () => {
    await prepareEmptyDatabase(prisma);
    await seedShopA();

    const interrupted = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 1,
      stopAfterBatches: 1,
    });
    expect(interrupted.shopsWouldCreate).toBe(1);

    await prisma.supplier.create({
      data: {
        id: "sup-subj-zzz-above2",
        shop: "brand-new-above.myshopify.com",
        name: "Above2",
      },
    });
    await prisma.session.create({
      data: {
        id: "sess-subj-late",
        shop: "session-late.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });

    const resumed = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
      resumeRunId: interrupted.runId,
    });
    expect(resumed.status).toBe("COMPLETED");
    expect(resumed.shopsWouldCreate).toBe(1);
    expect(
      await prisma.shop.findUnique({
        where: { myshopifyDomain: "brand-new-above.myshopify.com" },
      }),
    ).toBeNull();
    expect(
      await prisma.shop.findUnique({
        where: { myshopifyDomain: "session-late.myshopify.com" },
      }),
    ).toBeNull();
  }, 180_000);

  it("same-ID direct-owner replacement with changed shop fails closed", async () => {
    await prepareEmptyDatabase(prisma);
    await seedShopA();

    const result = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 1,
      onBatchCommitted: async () => {
        await prisma.$executeRawUnsafe(
          `DELETE FROM "Supplier" WHERE id = 'sup-subj-a'`,
        );
        await prisma.$executeRawUnsafe(
          `INSERT INTO "Supplier" (id, shop, name, "createdAt", "updatedAt")
           VALUES ('sup-subj-a', 'replaced.myshopify.com', 'Replaced', NOW(), NOW())`,
        );
      },
    });
    expect(result.status).toBe("FAILED");
    expect(result.failureSummary).toMatch(/Dataset drift|subject evidence/i);
  }, 180_000);

  it("same-ID child replacement with changed parent fails closed", async () => {
    await prepareEmptyDatabase(prisma);
    await seedShopA();
    await prisma.supplier.create({
      data: {
        id: "sup-subj-b",
        shop: "subj-a.myshopify.com",
        name: "B",
      },
    });
    await prisma.supplierSkuMapping.create({
      data: {
        id: "map-subj-1",
        supplierId: "sup-subj-a",
        shopifyVariantId: "var-1",
        vendorSku: "SKU-1",
      },
    });

    const result = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 50,
      onBatchCommitted: async ({ tableName }) => {
        if (tableName === "SupplierSkuMapping") {
          await prisma.$executeRawUnsafe(
            `DELETE FROM "SupplierSkuMapping" WHERE id = 'map-subj-1'`,
          );
          await prisma.$executeRawUnsafe(
            `INSERT INTO "SupplierSkuMapping" (id, "supplierId", "shopifyVariantId", "vendorSku", moq, "packSize")
             VALUES ('map-subj-1', 'sup-subj-b', 'var-1', 'SKU-1', 1, 1)`,
          );
        }
      },
    });
    expect(result.status).toBe("FAILED");
    expect(result.failureSummary).toMatch(/Dataset drift|subject evidence/i);
  }, 180_000);

  it("same-ID lead-time replacement with changed supplier fails closed", async () => {
    await prepareEmptyDatabase(prisma);
    await seedShopA();
    await prisma.supplier.create({
      data: {
        id: "sup-subj-b",
        shop: "subj-a.myshopify.com",
        name: "B",
      },
    });
    await prisma.purchaseOrder.create({
      data: {
        id: "po-subj-1",
        shop: "subj-a.myshopify.com",
        supplierId: "sup-subj-a",
        status: "DRAFT",
        currency: "USD",
        locationId: "loc-1",
      },
    });
    await prisma.leadTimeSnapshot.create({
      data: {
        id: "lt-subj-1",
        supplierId: "sup-subj-a",
        purchaseOrderId: "po-subj-1",
        leadTimeDays: 2,
      },
    });

    const result = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 50,
      onBatchCommitted: async ({ tableName }) => {
        if (tableName === "LeadTimeSnapshot") {
          await prisma.$executeRawUnsafe(
            `DELETE FROM "LeadTimeSnapshot" WHERE id = 'lt-subj-1'`,
          );
          await prisma.$executeRawUnsafe(
            `INSERT INTO "LeadTimeSnapshot" (id, "supplierId", "purchaseOrderId", "leadTimeDays", "recordedAt")
             VALUES ('lt-subj-1', 'sup-subj-b', 'po-subj-1', 2, NOW())`,
          );
        }
      },
    });
    expect(result.status).toBe("FAILED");
    expect(result.failureSummary).toMatch(/Dataset drift|subject evidence/i);
  }, 180_000);

  it("resume without startingEvidence fails closed", async () => {
    await prepareEmptyDatabase(prisma);
    await seedShopA();
    const interrupted = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 1,
      stopAfterBatches: 1,
    });
    await prisma.tenantBackfillRun.update({
      where: { id: interrupted.runId },
      data: {
        resumeMetadata: {
          datasetBoundaries: {},
          highWaterMarks: {},
        },
      },
    });
    const resumed = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
      resumeRunId: interrupted.runId,
    });
    expect(resumed.status).toBe("FAILED");
    expect(resumed.failureSummary).toMatch(/startingEvidence|failed closed/i);
  }, 180_000);

  it("empty starting boundary remains empty for ownership checksum exclusion", async () => {
    await prepareEmptyDatabase(prisma);
    await prisma.session.create({
      data: {
        id: "sess-empty-inv",
        shop: "empty-inv.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    await prisma.supplier.create({
      data: {
        id: "sup-empty-inv",
        shop: "empty-inv.myshopify.com",
        name: "Has rows",
      },
    });
    const result = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
      onBatchCommitted: async ({ tableName }) => {
        if (tableName === "Supplier") {
          const existing = await prisma.inventorySnapshot.findUnique({
            where: { id: "inv-late" },
          });
          if (!existing) {
            await prisma.inventorySnapshot.create({
              data: {
                id: "inv-late",
                shop: "empty-inv.myshopify.com",
                shopifyVariantId: "v1",
                locationId: "loc",
                quantityAvailable: 1,
                snapshotDate: new Date("2026-01-01"),
              },
            });
          }
        }
      },
    });
    expect(result.status).toBe("COMPLETED");
    expect(result.examinedCounts.InventorySnapshot).toBe(0);
    const late = await prisma.inventorySnapshot.findUnique({
      where: { id: "inv-late" },
    });
    expect(late).not.toBeNull();
    expect(late!.shopId).toBeNull();
  }, 180_000);

  it("captureStartingEvidence records phase1-tenant-subject-v2", async () => {
    await prepareEmptyDatabase(prisma);
    await seedShopA();
    const { evidence } = await captureStartingEvidence(prisma, {
      batchSize: 10,
    });
    expect(evidence.evidenceVersion).toBe(TENANT_SUBJECT_EVIDENCE_VERSION);
    expect(evidence.tables.Supplier.rowCount).toBe(1);
    expect(evidence.tables.Supplier.evidenceColumns).toEqual([
      "id",
      "shop",
      "createdAt",
    ]);
    expect(evidence.sessionEvidence.highWaterMark).toBe("sess-subj-a");
    expect(evidence.postgresSnapshot).toBeTruthy();
    expect(evidence.evidenceBudget.budgetVersion).toBe(
      "phase1-evidence-budget-v1",
    );
    expect(evidence.domainDiscovery.validDomains.domains).toContain(
      "subj-a.myshopify.com",
    );
  }, 120_000);
});
