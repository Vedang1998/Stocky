import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { acquireApplyLock } from "../apply-lock";
import { runTenantBackfill } from "../engine";
import { TENANT_BACKFILL_ADVISORY_LOCK_KEY } from "../tables";
import {
  createMigrationPrisma,
  DATABASE_URL,
  prepareEmptyDatabase,
  prismaGenerate,
  setMaintenanceDatabaseUrl,
} from "./helpers";

describe("apply advisory lock", () => {
  const prisma = createMigrationPrisma();

  beforeAll(() => {
    prismaGenerate();
    setMaintenanceDatabaseUrl();
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedMinimal() {
    await prisma.session.create({
      data: {
        id: "sess-lock",
        shop: "lock-a.myshopify.com",
        state: "s",
        accessToken: "tok",
        isOnline: false,
      },
    });
    await prisma.supplier.create({
      data: {
        id: "sup-lock",
        shop: "lock-a.myshopify.com",
        name: "Lock",
      },
    });
  }

  it("denies concurrent apply in-process and on a held pg session; releases after success", async () => {
    await prepareEmptyDatabase(prisma);
    await seedMinimal();

    const concurrent = await Promise.allSettled([
      runTenantBackfill({ prisma, mode: "apply", batchSize: 10 }),
      runTenantBackfill({ prisma, mode: "apply", batchSize: 10 }),
    ]);
    const fulfilled = concurrent.filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof runTenantBackfill>>> =>
        r.status === "fulfilled",
    );
    const rejected = concurrent.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(fulfilled[0]!.value.status).toBe("COMPLETED");
    const rejectReason = rejected[0]!.reason;
    const rejectMessage =
      rejectReason instanceof Error
        ? rejectReason.message
        : String(rejectReason);
    expect(rejectMessage).toMatch(/Concurrent tenant backfill apply is denied/);

    const external = new Client({ connectionString: DATABASE_URL });
    await external.connect();
    const held = await external.query<{ locked: boolean }>(
      `SELECT pg_try_advisory_lock($1) AS locked`,
      [TENANT_BACKFILL_ADVISORY_LOCK_KEY],
    );
    expect(held.rows[0]?.locked).toBe(true);

    await expect(
      runTenantBackfill({ prisma, mode: "apply", batchSize: 10 }),
    ).rejects.toThrow(/Concurrent tenant backfill apply is denied/);

    await external.query(`SELECT pg_advisory_unlock($1)`, [
      TENANT_BACKFILL_ADVISORY_LOCK_KEY,
    ]);
    await external.end();

    const afterUnlock = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
    });
    expect(afterUnlock.status).toBe("COMPLETED");

    const lock = await acquireApplyLock();
    await lock.release();
    const lockAgain = await acquireApplyLock();
    await lockAgain.release();
  }, 180_000);
});
