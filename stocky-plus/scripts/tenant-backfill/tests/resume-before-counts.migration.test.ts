import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runTenantBackfill } from "../engine";
import {
  createMigrationPrisma,
  prepareEmptyDatabase,
  prismaGenerate,
  setMaintenanceDatabaseUrl,
} from "./helpers";

describe("resume preserves original beforeCounts", () => {
  const prisma = createMigrationPrisma();

  beforeAll(() => {
    prismaGenerate();
    setMaintenanceDatabaseUrl();
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("uses stored beforeCounts from the interrupted run, not post-partial table counts", async () => {
    await prepareEmptyDatabase(prisma);
    await prisma.session.create({
      data: {
        id: "sess-resume-counts",
        shop: "resume-counts.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    await prisma.supplier.create({
      data: {
        id: "sup-rc-1",
        shop: "resume-counts.myshopify.com",
        name: "One",
      },
    });
    await prisma.supplier.create({
      data: {
        id: "sup-rc-2",
        shop: "resume-counts.myshopify.com",
        name: "Two",
      },
    });

    const interrupted = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 1,
      stopAfterBatches: 1,
    });
    expect(interrupted.status).toBe("INTERRUPTED");
    expect(interrupted.beforeCounts.Supplier).toBe(2);

    await prisma.supplier.create({
      data: {
        id: "sup-rc-extra",
        shop: "resume-counts.myshopify.com",
        name: "Inserted mid-resume",
      },
    });

    const resumed = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
      resumeRunId: interrupted.runId,
    });
    expect(resumed.status).toBe("COMPLETED");
    expect(resumed.beforeCounts).toEqual(interrupted.beforeCounts);
    expect(resumed.beforeCounts.Supplier).toBe(2);
  }, 180_000);
});
