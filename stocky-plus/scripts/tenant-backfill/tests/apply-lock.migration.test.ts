import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { acquireApplyLock, requireMaintenanceDatabaseUrl } from "../apply-lock";
import { runTenantBackfill } from "../engine";
import { TENANT_BACKFILL_ADVISORY_LOCK_KEY } from "../tables";
import {
  createMigrationPrisma,
  DATABASE_URL,
  prepareEmptyDatabase,
  prismaGenerate,
  setMaintenanceDatabaseUrl,
} from "./helpers";

describe("apply advisory lock backend identity (R4)", () => {
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

  it("records acquiring backend PID and release executes on the same PID", async () => {
    const handle = await acquireApplyLock();
    expect(handle.backendPid).toBeGreaterThan(0);
    const live = await handle.client.query<{ pid: number }>(
      `SELECT pg_backend_pid() AS pid`,
    );
    expect(live.rows[0]?.pid).toBe(handle.backendPid);
    await handle.release();
  });

  it("two apply calls in one process: one success and one denial", async () => {
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
    expect(String(rejected[0]!.reason)).toMatch(
      /Concurrent tenant backfill apply is denied/,
    );
  }, 180_000);

  it("separately held lock denies apply; successful and failed backfills release for recovery", async () => {
    await prepareEmptyDatabase(prisma);
    await seedMinimal();

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

    const success = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
    });
    expect(success.status).toBe("COMPLETED");

    // Failed backfill still releases (finally).
    const failed = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
      throwAfterBatchCommit: true,
    });
    expect(failed.status).toBe("FAILED");

    const recovery = await runTenantBackfill({
      prisma,
      mode: "apply",
      batchSize: 10,
    });
    expect(recovery.status).toBe("COMPLETED");
  }, 180_000);

  it("manual unlock before handle.release makes release fail (unlock false)", async () => {
    const handle = await acquireApplyLock();
    const unlocked = await handle.client.query<{ unlocked: boolean }>(
      `SELECT pg_advisory_unlock($1) AS unlocked`,
      [TENANT_BACKFILL_ADVISORY_LOCK_KEY],
    );
    expect(unlocked.rows[0]?.unlocked).toBe(true);

    await expect(handle.release()).rejects.toThrow(/unlock returned false/);

    // Client must be closed; no advisory lock remains.
    const probe = new Client({ connectionString: DATABASE_URL });
    await probe.connect();
    const lockCheck = await probe.query<{ locked: boolean }>(
      `SELECT pg_try_advisory_lock($1) AS locked`,
      [TENANT_BACKFILL_ADVISORY_LOCK_KEY],
    );
    expect(lockCheck.rows[0]?.locked).toBe(true);
    await probe.query(`SELECT pg_advisory_unlock($1)`, [
      TENANT_BACKFILL_ADVISORY_LOCK_KEY,
    ]);
    await probe.end();
  });

  it("rejects pooler / unstable maintenance URL before apply", () => {
    const previous = process.env.TENANT_MAINTENANCE_DATABASE_URL;
    try {
      process.env.TENANT_MAINTENANCE_DATABASE_URL =
        "postgresql://stocky:stocky@pooler.example:5432/db";
      expect(() => requireMaintenanceDatabaseUrl()).toThrow(/pooler/i);
    } finally {
      process.env.TENANT_MAINTENANCE_DATABASE_URL = previous;
    }
  });

  it("no advisory lock remains after successful client close", async () => {
    const handle = await acquireApplyLock();
    await handle.release();

    const probe = new Client({ connectionString: DATABASE_URL });
    await probe.connect();
    const lockCheck = await probe.query<{ locked: boolean }>(
      `SELECT pg_try_advisory_lock($1) AS locked`,
      [TENANT_BACKFILL_ADVISORY_LOCK_KEY],
    );
    expect(lockCheck.rows[0]?.locked).toBe(true);
    await probe.query(`SELECT pg_advisory_unlock($1)`, [
      TENANT_BACKFILL_ADVISORY_LOCK_KEY,
    ]);
    await probe.end();
  });
});
