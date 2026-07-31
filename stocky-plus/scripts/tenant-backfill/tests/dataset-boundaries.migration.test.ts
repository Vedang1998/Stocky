/**
 * R10 — deterministic dataset boundaries and membership checksums.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { issueFingerprint } from "../checksum";
import { runTenantBackfill } from "../engine";
import {
  createMigrationPrisma,
  prepareEmptyDatabase,
  prismaGenerate,
  setMaintenanceDatabaseUrl,
} from "./helpers";

describe("dataset boundaries and membership checksums (R10)", () => {
  const prisma = createMigrationPrisma();

  beforeAll(() => {
    prismaGenerate();
    setMaintenanceDatabaseUrl();
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedBase() {
    await prisma.session.create({
      data: {
        id: "sess-bound",
        shop: "bound-a.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    await prisma.supplier.create({
      data: {
        id: "sup-bound-a",
        shop: "bound-a.myshopify.com",
        name: "A",
      },
    });
    await prisma.supplier.create({
      data: {
        id: "sup-bound-b",
        shop: "bound-a.myshopify.com",
        name: "B",
      },
    });
  }

  it("row inserted above the boundary during the run does not alter counts or checksums", async () => {
    await prepareEmptyDatabase(prisma);
    await seedBase();

    const interrupted = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 1,
      onBatchCommitted: async () => {
        const existing = await prisma.supplier.findUnique({
          where: { id: "sup-bound-zzz-above" },
        });
        if (!existing) {
          await prisma.supplier.create({
            data: {
              id: "sup-bound-zzz-above",
              shop: "bound-a.myshopify.com",
              name: "Above",
            },
          });
        }
      },
      stopAfterBatches: 1,
    });
    expect(interrupted.status).toBe("INTERRUPTED");

    const resumed = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
      resumeRunId: interrupted.runId,
    });
    expect(resumed.status).toBe("COMPLETED");
    expect(resumed.examinedCounts.Supplier).toBe(2);
    expect(resumed.unresolvedCounts.Supplier ?? 0).toBe(0);

    const run = await prisma.tenantBackfillRun.findUniqueOrThrow({
      where: { id: resumed.runId },
    });
    const meta = run.resumeMetadata as {
      datasetBoundaries?: Record<
        string,
        { rowCount: number; membershipChecksum: string; highWaterMark: string | null }
      >;
    };
    expect(meta.datasetBoundaries?.Supplier?.rowCount).toBe(2);

    const above = await prisma.supplier.findUnique({
      where: { id: "sup-bound-zzz-above" },
    });
    expect(above).not.toBeNull();
    expect(above!.shopId).toBeNull();
  }, 180_000);

  it("row deleted inside the boundary fails closed as dataset drift", async () => {
    await prepareEmptyDatabase(prisma);
    await seedBase();

    const result = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 1,
      onBatchCommitted: async () => {
        await prisma.supplier.delete({ where: { id: "sup-bound-b" } });
      },
    });
    expect(result.status).toBe("FAILED");
    expect(result.failureSummary).toMatch(/Dataset drift/i);
  }, 180_000);

  it("row inserted lexically inside the boundary fails closed as dataset drift", async () => {
    await prepareEmptyDatabase(prisma);
    await seedBase();

    const result = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 1,
      onBatchCommitted: async () => {
        const existing = await prisma.supplier.findUnique({
          where: { id: "sup-bound-a1-inside" },
        });
        if (!existing) {
          await prisma.supplier.create({
            data: {
              id: "sup-bound-a1-inside",
              shop: "bound-a.myshopify.com",
              name: "Inside",
            },
          });
        }
      },
    });
    expect(result.status).toBe("FAILED");
    expect(result.failureSummary).toMatch(/Dataset drift/i);
  }, 180_000);

  it("empty starting table keeps empty boundary despite later inserts", async () => {
    await prepareEmptyDatabase(prisma);
    await prisma.session.create({
      data: {
        id: "sess-empty-lt",
        shop: "empty-lt.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    await prisma.supplier.create({
      data: {
        id: "sup-empty-lt",
        shop: "empty-lt.myshopify.com",
        name: "Has rows",
      },
    });
    await prisma.purchaseOrder.create({
      data: {
        id: "po-empty-lt",
        shop: "empty-lt.myshopify.com",
        supplierId: "sup-empty-lt",
        status: "DRAFT",
        currency: "USD",
        locationId: "loc-1",
      },
    });

    const result = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
      onBatchCommitted: async ({ tableName }) => {
        if (tableName === "Supplier") {
          const existing = await prisma.leadTimeSnapshot.findUnique({
            where: { id: "lt-late" },
          });
          if (!existing) {
            await prisma.leadTimeSnapshot.create({
              data: {
                id: "lt-late",
                supplierId: "sup-empty-lt",
                purchaseOrderId: "po-empty-lt",
                leadTimeDays: 3,
              },
            });
          }
        }
      },
    });
    expect(result.status).toBe("COMPLETED");
    expect(result.examinedCounts.LeadTimeSnapshot).toBe(0);

    const late = await prisma.leadTimeSnapshot.findUnique({
      where: { id: "lt-late" },
    });
    expect(late).not.toBeNull();
    expect(late!.shopId).toBeNull();
  }, 180_000);

  it("interrupted after diagnostic checkpoint resume matches uninterrupted evidence", async () => {
    await prepareEmptyDatabase(prisma);
    await prisma.session.create({
      data: {
        id: "sess-diag",
        shop: "diag-a.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    await prisma.session.create({
      data: {
        id: "sess-diag-b",
        shop: "diag-b.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    await prisma.supplier.create({
      data: {
        id: "sup-diag-a",
        shop: "diag-a.myshopify.com",
        name: "A",
      },
    });
    await prisma.purchaseOrder.create({
      data: {
        id: "po-diag-1",
        shop: "diag-b.myshopify.com",
        supplierId: "sup-diag-a",
        status: "DRAFT",
        currency: "USD",
        locationId: "loc-1",
      },
    });

    const uninterrupted = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 50,
    });
    expect(uninterrupted.status).toBe("COMPLETED_WITH_ISSUES");

    await prepareEmptyDatabase(prisma);
    await prisma.session.create({
      data: {
        id: "sess-diag",
        shop: "diag-a.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    await prisma.session.create({
      data: {
        id: "sess-diag-b",
        shop: "diag-b.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    await prisma.supplier.create({
      data: {
        id: "sup-diag-a",
        shop: "diag-a.myshopify.com",
        name: "A",
      },
    });
    await prisma.purchaseOrder.create({
      data: {
        id: "po-diag-1",
        shop: "diag-b.myshopify.com",
        supplierId: "sup-diag-a",
        status: "DRAFT",
        currency: "USD",
        locationId: "loc-1",
      },
    });

    const interrupted = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 50,
      throwAfterDiagnosticPhase: "diagnostic:po_supplier",
    });
    expect(interrupted.status).toBe("FAILED");

    const resumed = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 50,
      resumeRunId: interrupted.runId,
    });
    expect(resumed.status).toBe("COMPLETED_WITH_ISSUES");
    expect(resumed.examinedCounts.PurchaseOrder).toBe(
      uninterrupted.examinedCounts.PurchaseOrder,
    );
    expect(resumed.unresolvedCounts.PurchaseOrder ?? 0).toBeGreaterThan(0);
    expect(resumed.currentRunDetectedIssueCount).toBeGreaterThan(0);

    const fp = issueFingerprint({
      tableName: "PurchaseOrder",
      rowId: "po-diag-1",
      reasonCode: "PURCHASE_ORDER_SUPPLIER_SHOP_MISMATCH",
    });
    const detections = await prisma.tenantOwnershipIssueDetection.count({
      where: { runId: resumed.runId, fingerprint: fp },
    });
    expect(detections).toBe(1);

    const runMeta = await prisma.tenantBackfillRun.findUniqueOrThrow({
      where: { id: resumed.runId },
    });
    const boundaries = (
      runMeta.resumeMetadata as {
        datasetBoundaries?: Record<string, { membershipChecksum: string }>;
      }
    ).datasetBoundaries;
    expect(boundaries?.PurchaseOrder?.membershipChecksum).toBeTruthy();
  }, 180_000);
});
