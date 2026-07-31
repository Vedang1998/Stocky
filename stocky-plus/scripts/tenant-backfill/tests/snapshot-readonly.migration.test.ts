/**
 * F-F01 / F-F07 — database-enforced READ ONLY starting snapshot.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runTenantBackfill } from "../engine";
import { captureStartingEvidence } from "../starting-snapshot";
import {
  createMigrationPrisma,
  prepareEmptyDatabase,
  prismaGenerate,
  setMaintenanceDatabaseUrl,
} from "./helpers";

describe("read-only starting snapshot enforcement (F-F01/F-F07)", () => {
  const prisma = createMigrationPrisma();

  beforeAll(() => {
    prismaGenerate();
    setMaintenanceDatabaseUrl();
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seed() {
    await prisma.session.create({
      data: {
        id: "sess-ro",
        shop: "ro-a.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    await prisma.supplier.create({
      data: {
        id: "sup-ro-a",
        shop: "ro-a.myshopify.com",
        name: "A",
      },
    });
  }

  it("capture observes repeatable read + transaction_read_only=on and persists them", async () => {
    await prepareEmptyDatabase(prisma);
    await seed();

    const evidence = await captureStartingEvidence(prisma, { batchSize: 10 });
    expect(evidence.transactionIsolation).toBe("repeatable read");
    expect(evidence.transactionReadOnly).toBe("on");
    expect(evidence.postgresSnapshot).toBeTruthy();
    expect(evidence.capturedAt).toBeTruthy();
    expect(evidence.evidenceVersion).toBe("phase1-tenant-subject-v2");
  }, 120_000);

  it("PostgreSQL rejects a write inside the snapshot with SQLSTATE 25006 and nothing commits", async () => {
    await prepareEmptyDatabase(prisma);
    await seed();

    let writeError: unknown;
    await expect(
      captureStartingEvidence(prisma, {
        batchSize: 10,
        onSnapshotEstablished: async (tx) => {
          try {
            await tx.$executeRawUnsafe(
              `INSERT INTO "Shop" (id, "myshopifyDomain", "createdAt", "updatedAt")
               VALUES ('shop-ro-negative', 'ro-negative.myshopify.com', NOW(), NOW())`,
            );
          } catch (error) {
            writeError = error;
            throw error;
          }
          throw new Error(
            "Write unexpectedly succeeded inside the read-only snapshot",
          );
        },
      }),
    ).rejects.toThrow();

    expect(writeError).toBeTruthy();
    const err = writeError as {
      code?: string;
      meta?: { code?: string; message?: string };
      message?: string;
    };
    const sqlstate = err.meta?.code ?? "";
    const combined = `${err.code ?? ""} ${sqlstate} ${err.meta?.message ?? ""} ${err.message ?? ""}`;
    // PostgreSQL read_only_sql_transaction is SQLSTATE 25006.
    expect(
      sqlstate === "25006" || /25006/.test(combined),
    ).toBe(true);
    expect(combined).toMatch(/read-only/i);

    // The rejected write must not be committed.
    const shop = await prisma.shop.findUnique({
      where: { myshopifyDomain: "ro-negative.myshopify.com" },
    });
    expect(shop).toBeNull();
  }, 120_000);

  it("normal evidence capture still succeeds and resume preserves original snapshot identity", async () => {
    await prepareEmptyDatabase(prisma);
    await seed();

    const interrupted = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 1,
      stopAfterBatches: 1,
    });
    expect(interrupted.status).toBe("INTERRUPTED");

    const originalRun = await prisma.tenantBackfillRun.findUniqueOrThrow({
      where: { id: interrupted.runId },
    });
    const originalEvidence = (
      originalRun.resumeMetadata as {
        startingEvidence?: {
          postgresSnapshot?: string;
          transactionIsolation?: string;
          transactionReadOnly?: string;
        };
      }
    ).startingEvidence;
    expect(originalEvidence?.transactionIsolation).toBe("repeatable read");
    expect(originalEvidence?.transactionReadOnly).toBe("on");
    expect(originalEvidence?.postgresSnapshot).toBeTruthy();

    const resumed = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
      resumeRunId: interrupted.runId,
    });
    expect(resumed.status).toBe("COMPLETED");

    const resumedRun = await prisma.tenantBackfillRun.findUniqueOrThrow({
      where: { id: interrupted.runId },
    });
    const resumedEvidence = (
      resumedRun.resumeMetadata as {
        startingEvidence?: {
          postgresSnapshot?: string;
          transactionIsolation?: string;
          transactionReadOnly?: string;
        };
      }
    ).startingEvidence;
    // Resume must keep the original read-only snapshot identity — no recapture.
    expect(resumedEvidence?.postgresSnapshot).toBe(
      originalEvidence?.postgresSnapshot,
    );
    expect(resumedEvidence?.transactionIsolation).toBe("repeatable read");
    expect(resumedEvidence?.transactionReadOnly).toBe("on");
  }, 180_000);

  it("resume fails closed when read-only enforcement evidence is missing", async () => {
    await prepareEmptyDatabase(prisma);
    await seed();

    const interrupted = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 1,
      stopAfterBatches: 1,
    });
    expect(interrupted.status).toBe("INTERRUPTED");

    const run = await prisma.tenantBackfillRun.findUniqueOrThrow({
      where: { id: interrupted.runId },
    });
    const meta = run.resumeMetadata as Record<string, unknown>;
    const evidence = {
      ...(meta.startingEvidence as Record<string, unknown>),
    };
    delete evidence.transactionReadOnly;
    await prisma.tenantBackfillRun.update({
      where: { id: interrupted.runId },
      data: {
        resumeMetadata: { ...meta, startingEvidence: evidence } as never,
      },
    });

    const resumed = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
      resumeRunId: interrupted.runId,
    });
    expect(resumed.status).toBe("FAILED");
    expect(resumed.failureSummary).toMatch(/transactionReadOnly/i);
  }, 180_000);
});
