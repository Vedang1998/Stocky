import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runTenantBackfill } from "../engine";
import {
  createMigrationPrisma,
  prepareEmptyDatabase,
  prismaGenerate,
  setMaintenanceDatabaseUrl,
} from "./helpers";

describe("cross-domain blocking (PO vs supplier shop)", () => {
  const prisma = createMigrationPrisma();

  beforeAll(() => {
    prismaGenerate();
    setMaintenanceDatabaseUrl();
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("resolves direct shopId while flagging PO/supplier mismatch for operators", async () => {
    await prepareEmptyDatabase(prisma);
    const shopA = "cross-a.myshopify.com";
    const shopB = "cross-b.myshopify.com";

    await prisma.session.create({
      data: {
        id: "sess-cross",
        shop: shopA,
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    await prisma.supplier.create({
      data: { id: "sup-cross-a", shop: shopA, name: "A" },
    });
    await prisma.supplier.create({
      data: { id: "sup-cross-b", shop: shopB, name: "B" },
    });
    await prisma.purchaseOrder.create({
      data: {
        id: "po-cross-mismatch",
        shop: shopA,
        supplierId: "sup-cross-b",
        locationId: "loc-1",
      },
    });

    const result = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 20,
    });

    expect(result.status).toBe("COMPLETED_WITH_ISSUES");
    expect(result.blockingIssueCount).toBeGreaterThan(0);
    expect(result.currentRunDetectedIssueCount).toBeGreaterThan(0);
    expect(result.currentRunOpenIssueCount).toBeGreaterThan(0);
    expect(result.globalOpenIssueCount).toBeGreaterThan(0);

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: "po-cross-mismatch" },
    });
    const shopRow = await prisma.shop.findUnique({
      where: { myshopifyDomain: shopA },
    });
    expect(po?.shopId).toBe(shopRow?.id);

    const mismatch = await prisma.tenantOwnershipIssue.findFirst({
      where: {
        reasonCode: "PURCHASE_ORDER_SUPPLIER_SHOP_MISMATCH",
        rowId: "po-cross-mismatch",
        status: "OPEN",
      },
    });
    expect(mismatch).not.toBeNull();
  }, 180_000);
});
