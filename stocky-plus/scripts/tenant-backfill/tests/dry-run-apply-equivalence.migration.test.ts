import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runTenantBackfill } from "../engine";
import {
  captureDryRunSnapshot,
  createMigrationPrisma,
  expectSnapshotsEquivalent,
  prepareEmptyDatabase,
  prismaGenerate,
  seedDryRunApplyEquivalenceFixture,
  setMaintenanceDatabaseUrl,
} from "./helpers";

describe("dry-run vs apply classification equivalence", () => {
  const prisma = createMigrationPrisma();

  beforeAll(() => {
    prismaGenerate();
    setMaintenanceDatabaseUrl();
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("matches counts, reason codes, fingerprints; dry-run leaves shopId null, apply sets valid rows", async () => {
    await prepareEmptyDatabase(prisma);
    const ids = await seedDryRunApplyEquivalenceFixture(prisma);

    const dry = await runTenantBackfill({
      prisma,
      mode: "dry-run",
      batchSize: 5,
    });
    expect(dry.status).toBe("COMPLETED_WITH_ISSUES");
    const drySnap = await captureDryRunSnapshot(prisma, dry);

    const goodAfterDry = await prisma.supplier.findUnique({
      where: { id: ids.supplierGoodId },
    });
    expect(goodAfterDry?.shopId).toBeNull();

    const mapAfterDry = await prisma.supplierSkuMapping.findUnique({
      where: { id: "map-good" },
    });
    expect(mapAfterDry?.shopId).toBeNull();

    await prepareEmptyDatabase(prisma);
    await seedDryRunApplyEquivalenceFixture(prisma);

    const applied = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 5,
    });
    expect(applied.status).toBe("COMPLETED_WITH_ISSUES");
    const applySnap = await captureDryRunSnapshot(prisma, applied);

    expectSnapshotsEquivalent(drySnap, applySnap);

    const shopRow = await prisma.shop.findUnique({
      where: { myshopifyDomain: ids.shopA },
    });
    expect(shopRow).not.toBeNull();

    const goodAfterApply = await prisma.supplier.findUnique({
      where: { id: ids.supplierGoodId },
    });
    expect(goodAfterApply?.shopId).toBe(shopRow!.id);

    const badAfterApply = await prisma.supplier.findUnique({
      where: { id: ids.supplierInvalidId },
    });
    expect(badAfterApply?.shopId).toBeNull();

    expect(
      (await prisma.pOLineItem.findUnique({ where: { id: "pol-good" } }))
        ?.shopId,
    ).toBe(shopRow!.id);
    expect(
      (await prisma.transferLineItem.findUnique({ where: { id: "xfl-good" } }))
        ?.shopId,
    ).toBe(shopRow!.id);
    expect(
      (await prisma.stocktakeLineItem.findUnique({ where: { id: "stkl-good" } }))
        ?.shopId,
    ).toBe(shopRow!.id);
    expect(
      (await prisma.supplierSkuMapping.findUnique({ where: { id: "map-good" } }))
        ?.shopId,
    ).toBe(shopRow!.id);
  }, 180_000);
});
