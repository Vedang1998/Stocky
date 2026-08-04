/**
 * Phase 1 PR 1 — tenant compatibility index CONCURRENTLY tooling tests (R2/R3).
 * Requires DATABASE_URL / TENANT_MAINTENANCE_DATABASE_URL on disposable PostgreSQL 16.
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import { applyIndexes, recoveryInstruction } from "../apply";
import { classifyIndex } from "../classify";
import { getMaintenanceClient } from "../connection";
import { inspectIndex } from "../inspect";
import { normalizeIndexDef, TENANT_COMPATIBILITY_INDEXES } from "../manifest";
import { planIndexes } from "../plan";
import { verifyIndexes } from "../verify";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, "..", "..", "..");

const DATABASE_URL =
  process.env.TENANT_MAINTENANCE_DATABASE_URL ??
  process.env.TENANT_MIGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://stocky:stocky@localhost:5432/stocky_plus_migrations";

/** Concurrent-write acceptance threshold during CONCURRENTLY index build. */
const CONCURRENT_WRITE_THRESHOLD_MS = 15_000;
/** Populated fixture — large enough that CIC remains observable under RR holders. */
const CONCURRENT_INDEX_ROW_COUNT = 100_000;
/** Larger fixture for observable active build/validation scan phases (F-F03). */
const ACTIVE_PHASE_ROW_COUNT = 400_000;

function run(cmd: string, args: string[]) {
  return execFileSync(cmd, args, {
    cwd: APP_ROOT,
    env: {
      ...process.env,
      DATABASE_URL,
      TENANT_MAINTENANCE_DATABASE_URL: DATABASE_URL,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function resetPublicSchema(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`DROP SCHEMA public CASCADE`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA public`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO stocky`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO public`);
}

async function dropAllManifestIndexes(client: Client) {
  for (const entry of [...TENANT_COMPATIBILITY_INDEXES].reverse()) {
    await client.query(`DROP INDEX IF EXISTS "${entry.name}"`);
  }
}

async function withMaintenanceClient<T>(
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  process.env.TENANT_MAINTENANCE_DATABASE_URL = DATABASE_URL;
  const client = await getMaintenanceClient({
    requireExplicitMaintenanceUrl: true,
  });
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

describe("tenant compatibility index manifest", () => {
  it("lists 44 expected indexes", () => {
    expect(TENANT_COMPATIBILITY_INDEXES).toHaveLength(44);
  });

  it("normalizeIndexDef lowercases and collapses whitespace", () => {
    expect(normalizeIndexDef("  CREATE   INDEX  foo  ")).toBe(
      "create index foo",
    );
  });
});

describe("tenant compatibility indexes on PostgreSQL", () => {
  const prisma = new PrismaClient({
    datasources: { db: { url: DATABASE_URL } },
  });

  beforeAll(() => {
    run("npx", ["prisma", "generate"]);
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("reports all missing after migrate deploy without apply", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      const plan = await planIndexes(client);
      expect(plan.every((row) => row.status === "missing")).toBe(true);
      const verify = await verifyIndexes(client);
      expect(verify.ok).toBe(false);
    });
  }, 180_000);

  it("valid exact after apply; rerun idempotency skips all", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      const first = await applyIndexes(client, { apply: true });
      expect(first.created).toHaveLength(44);
      expect(first.skipped).toHaveLength(0);

      const plan = await planIndexes(client);
      expect(plan.every((row) => row.status === "valid_exact")).toBe(true);

      const verify = await verifyIndexes(client);
      expect(verify.ok).toBe(true);

      const second = await applyIndexes(client, { apply: true });
      expect(second.created).toHaveLength(0);
      expect(second.skipped).toHaveLength(44);
    });
  }, 300_000);

  it("classifies missing explicitly", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);
    await withMaintenanceClient(async (client) => {
      const entry = TENANT_COMPATIBILITY_INDEXES.find(
        (e) => e.name === "Supplier_shopId_idx",
      )!;
      const inspected = await inspectIndex(client, entry.name);
      expect(classifyIndex(entry, inspected)).toBe("missing");
    });
  }, 180_000);

  it("wrong-table collision: plan wrong_table; apply/verify fail-closed; no auto-drop", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      await client.query(
        `CREATE INDEX "Supplier_shopId_idx" ON "ShopSettings" ("shopId")`,
      );

      const entry = TENANT_COMPATIBILITY_INDEXES.find(
        (e) => e.name === "Supplier_shopId_idx",
      )!;
      const inspected = await inspectIndex(client, entry.name);
      expect(classifyIndex(entry, inspected)).toBe("wrong_table");

      const plan = await planIndexes(client);
      expect(
        plan.find((p) => p.entry.name === "Supplier_shopId_idx")?.status,
      ).toBe("wrong_table");

      await expect(applyIndexes(client, { apply: true })).rejects.toThrow(
        /DROP INDEX CONCURRENTLY/i,
      );

      const stillThere = await inspectIndex(client, "Supplier_shopId_idx");
      expect(stillThere.status).toBe("present");
      if (stillThere.status === "present") {
        expect(stillThere.table).toBe("ShopSettings");
      }

      const verify = await verifyIndexes(client);
      expect(verify.ok).toBe(false);
    });
  }, 180_000);

  it("wrong uniqueness classification and fail-closed apply", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      await client.query(
        `CREATE UNIQUE INDEX "Supplier_shopId_idx" ON "Supplier" ("shopId")`,
      );
      const entry = TENANT_COMPATIBILITY_INDEXES.find(
        (e) => e.name === "Supplier_shopId_idx",
      )!;
      const inspected = await inspectIndex(client, entry.name);
      expect(classifyIndex(entry, inspected)).toBe("wrong_uniqueness");
      await expect(applyIndexes(client, { apply: true })).rejects.toThrow(
        /invalid or mismatched/i,
      );
      const verify = await verifyIndexes(client);
      expect(verify.ok).toBe(false);
    });
  }, 180_000);

  it("wrong ordered columns / same name wrong definition", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      await client.query(
        `CREATE INDEX "Supplier_shopId_idx" ON "Supplier" ("name")`,
      );
      const entry = TENANT_COMPATIBILITY_INDEXES.find(
        (e) => e.name === "Supplier_shopId_idx",
      )!;
      const inspected = await inspectIndex(client, entry.name);
      expect(classifyIndex(entry, inspected)).toBe("wrong_definition");

      await expect(applyIndexes(client, { apply: true })).rejects.toThrow(
        /invalid or mismatched/i,
      );
    });
  }, 180_000);

  it("genuine failed CREATE UNIQUE INDEX CONCURRENTLY leaves invalid index; no silent repair", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      // Two rows sharing shopId so UNIQUE(shopId) cannot complete.
      await client.query(`
        INSERT INTO "Supplier" (id, shop, name, "shopId", "createdAt", "updatedAt")
        VALUES
          ('sup-dup-a', 'dup-a.myshopify.com', 'A', 'shared-shop-id', NOW(), NOW()),
          ('sup-dup-b', 'dup-b.myshopify.com', 'B', 'shared-shop-id', NOW(), NOW())
      `);

      await expect(
        client.query(
          `CREATE UNIQUE INDEX CONCURRENTLY "Supplier_shopId_idx" ON "Supplier" ("shopId")`,
        ),
      ).rejects.toThrow();

      const inspected = await inspectIndex(client, "Supplier_shopId_idx");
      expect(inspected.status).toBe("present");
      if (inspected.status !== "present") {
        throw new Error("expected invalid index remnant");
      }
      expect(inspected.indisvalid === false || inspected.indisready === false).toBe(
        true,
      );

      const entry = TENANT_COMPATIBILITY_INDEXES.find(
        (e) => e.name === "Supplier_shopId_idx",
      )!;
      expect(classifyIndex(entry, inspected)).toBe("invalid");

      const plan = await planIndexes(client);
      expect(
        plan.find((p) => p.entry.name === "Supplier_shopId_idx")?.status,
      ).toBe("invalid");

      await expect(applyIndexes(client, { apply: true })).rejects.toThrow(
        /explicitly authorized/i,
      );
      expect(recoveryInstruction("Supplier_shopId_idx")).toMatch(
        /DROP INDEX CONCURRENTLY/i,
      );

      const still = await inspectIndex(client, "Supplier_shopId_idx");
      expect(still.status).toBe("present");

      const verify = await verifyIndexes(client);
      expect(verify.ok).toBe(false);
    });
  }, 180_000);

  it("statement timeout failure leaves data intact with clear recovery path", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await clientPopulateSuppliers(prisma, 5_000);

    const client = await getMaintenanceClient({
      requireExplicitMaintenanceUrl: true,
      statementTimeoutMs: 1,
    });
    try {
      await expect(
        client.query(
          `CREATE INDEX CONCURRENTLY "Supplier_shopId_idx" ON "Supplier" ("shopId")`,
        ),
      ).rejects.toThrow(/canceling statement due to statement timeout|timeout/i);
    } finally {
      await client.end();
    }

    // Verify on a fresh session (the timed-out session keeps the 1ms bound).
    const verifyClient = await getMaintenanceClient({
      requireExplicitMaintenanceUrl: true,
    });
    try {
      const count = await verifyClient.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM "Supplier"`,
      );
      expect(Number(count.rows[0]!.c)).toBeGreaterThanOrEqual(5_000);

      const inspected = await inspectIndex(verifyClient, "Supplier_shopId_idx");
      if (inspected.status === "present") {
        expect(recoveryInstruction("Supplier_shopId_idx")).toMatch(
          /DROP INDEX CONCURRENTLY/i,
        );
      }
    } finally {
      await verifyClient.end();
    }
  }, 300_000);

  it("deterministic REPEATABLE READ overlap: ShareUpdateExclusiveLock, no AccessExclusiveLock, 10 iterations", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      await applyIndexes(client, { apply: true });
    });

    await clientPopulateSuppliers(prisma, CONCURRENT_INDEX_ROW_COUNT);

    const allIterationEvidence: Array<Record<string, unknown>> = [];

    for (let iteration = 1; iteration <= 10; iteration += 1) {
      await withMaintenanceClient(async (client) => {
        await client.query(
          `DROP INDEX CONCURRENTLY IF EXISTS "Supplier_shopId_idx"`,
        );
      });

      const builder = await getMaintenanceClient({
        requireExplicitMaintenanceUrl: true,
      });
      const writer = new Client({ connectionString: DATABASE_URL });
      await writer.connect();
      const observer = new Client({ connectionString: DATABASE_URL });
      await observer.connect();

      // Holder: REPEATABLE READ READ ONLY with positively retained backend_xmin.
      const holder = new Client({ connectionString: DATABASE_URL });
      await holder.connect();
      await holder.query(
        "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
      );
      await holder.query(`SELECT COUNT(*) FROM "Supplier"`);
      const holderPidRes = await holder.query<{ pid: number }>(
        `SELECT pg_backend_pid() AS pid`,
      );
      const holderPid = holderPidRes.rows[0]!.pid;
      const holderStatus = await observer.query<{
        state: string | null;
        backend_xmin: string | null;
      }>(
        `SELECT state, backend_xmin::text AS backend_xmin
         FROM pg_stat_activity WHERE pid = $1`,
        [holderPid],
      );
      expect(holderStatus.rows[0]?.state).toBe("idle in transaction");
      expect(holderStatus.rows[0]?.backend_xmin).toBeTruthy();
      const holderBackendXmin = holderStatus.rows[0]!.backend_xmin;

      const evidence: Record<string, unknown> = {
        iteration,
        rowCount: CONCURRENT_INDEX_ROW_COUNT,
        writeThresholdMs: CONCURRENT_WRITE_THRESHOLD_MS,
        holderPid,
        holderBackendXmin,
        environment: {
          node: process.version,
          platform: process.platform,
          databaseUrlHost: new URL(DATABASE_URL).host,
          supersededPriorR9Head:
            "fb04345f129b8664566c5947f2ad75f57102269b",
          note: "Prior R9 READ COMMITTED holder evidence rejected and superseded",
        },
      };

      try {
        const pidResult = await builder.query<{ pid: number }>(
          `SELECT pg_backend_pid() AS pid`,
        );
        const builderPid = pidResult.rows[0]!.pid;
        evidence.builderPid = builderPid;

        let buildSettled = false;
        let buildError: unknown;
        let buildSettledAtNs: bigint | null = null;
        const buildStartedAtNs = process.hrtime.bigint();
        evidence.buildStartedAtNs = buildStartedAtNs.toString();

        const buildPromise = builder
          .query(
            `CREATE INDEX CONCURRENTLY "Supplier_shopId_idx" ON "Supplier" ("shopId")`,
          )
          .then(
            (r) => {
              buildSettledAtNs = process.hrtime.bigint();
              buildSettled = true;
              return r;
            },
            (e) => {
              buildSettledAtNs = process.hrtime.bigint();
              buildSettled = true;
              buildError = e;
              throw e;
            },
          );

        type ProgressObs = { phase: string | null };
        type LockObs = { mode: string; granted: boolean };
        let progressObs: ProgressObs[] = [];
        let lockObs: LockObs[] = [];
        let waitingForSnapshot = false;
        const deadline = Date.now() + 120_000;

        while (Date.now() < deadline) {
          if (buildSettled) {
            throw new Error(
              `Iteration ${iteration}: CREATE INDEX CONCURRENTLY settled before positive overlap observation (waitingForOlderSnapshots=${waitingForSnapshot})`,
            );
          }

          const progress = await observer.query<{
            phase: string | null;
            relid: string;
          }>(
            `SELECT p.phase::text AS phase, p.relid::text AS relid
             FROM pg_stat_progress_create_index p
             JOIN pg_class c ON c.oid = p.relid
             WHERE p.pid = $1 AND c.relname = 'Supplier'`,
            [builderPid],
          );
          const locks = await observer.query<{
            mode: string;
            granted: boolean;
          }>(
            `
            SELECT l.mode, l.granted
            FROM pg_locks l
            JOIN pg_class c ON c.oid = l.relation
            WHERE l.pid = $1
              AND l.locktype = 'relation'
              AND c.relname = 'Supplier'
              AND l.granted = true
            `,
            [builderPid],
          );

          if (progress.rows.length > 0) {
            progressObs = progress.rows.map((r) => ({ phase: r.phase }));
            waitingForSnapshot = progress.rows.some((r) =>
              /waiting for old snapshots/i.test(r.phase ?? ""),
            );
          }
          if (locks.rows.length > 0) {
            lockObs = locks.rows;
          }

          // Require target-relation progress AND granted ShareUpdateExclusiveLock
          // AND the waiting-for-older-snapshots phase (proves RR holder is active).
          if (
            waitingForSnapshot &&
            lockObs.length > 0 &&
            lockObs.some((l) => l.mode === "ShareUpdateExclusiveLock")
          ) {
            break;
          }
          await new Promise((r) => setTimeout(r, 20));
        }

        if (!waitingForSnapshot) {
          throw new Error(
            `Iteration ${iteration}: timed out without observing waiting for old snapshots ` +
              `(progress=${JSON.stringify(progressObs)} locks=${JSON.stringify(lockObs)} buildSettled=${buildSettled})`,
          );
        }

        const activeObservedAtNs = process.hrtime.bigint();
        evidence.activeObservedAtNs = activeObservedAtNs.toString();
        evidence.progressPhase = progressObs.map((p) => p.phase);
        evidence.targetTableLockModes = lockObs.map((l) => l.mode);
        evidence.waitingForOlderSnapshots = waitingForSnapshot;

        expect(buildSettled).toBe(false);
        expect(progressObs.length).toBeGreaterThan(0);
        expect(lockObs.length).toBeGreaterThan(0);
        expect(
          lockObs.some((l) => l.mode === "ShareUpdateExclusiveLock"),
        ).toBe(true);
        expect(
          lockObs.every((l) => l.mode !== "AccessExclusiveLock"),
        ).toBe(true);
        expect(
          lockObs.some((l) => l.mode === "AccessExclusiveLock"),
        ).toBe(false);

        const writeWindows: Array<{
          op: string;
          startNs: string;
          endNs: string;
          durationMs: number;
        }> = [];

        const timedWrite = async (
          op: string,
          fn: () => Promise<unknown>,
        ): Promise<void> => {
          expect(buildSettled).toBe(false);
          const startNs = process.hrtime.bigint();
          expect(startNs > activeObservedAtNs).toBe(true);
          await fn();
          const endNs = process.hrtime.bigint();
          expect(buildSettled).toBe(false);
          expect(buildSettledAtNs).toBeNull();
          const durationMs = Number(endNs - startNs) / 1e6;
          writeWindows.push({
            op,
            startNs: startNs.toString(),
            endNs: endNs.toString(),
            durationMs,
          });
          expect(durationMs).toBeLessThan(CONCURRENT_WRITE_THRESHOLD_MS);
        };

        await timedWrite("insert", () =>
          writer.query(
            `INSERT INTO "Supplier" (id, shop, name, "createdAt", "updatedAt")
             VALUES ('sup-concurrent-ins', 'write-probe.myshopify.com', 'W', NOW(), NOW())`,
          ),
        );
        await timedWrite("update", () =>
          writer.query(
            `UPDATE "Supplier" SET name = 'W2' WHERE id = 'sup-concurrent-ins'`,
          ),
        );
        await timedWrite("delete", () =>
          writer.query(
            `DELETE FROM "Supplier" WHERE id = 'sup-concurrent-ins'`,
          ),
        );

        evidence.writeWindows = writeWindows;

        // Holder must remain open through all representative writes.
        const holderStill = await observer.query<{
          state: string | null;
          backend_xmin: string | null;
        }>(
          `SELECT state, backend_xmin::text AS backend_xmin
           FROM pg_stat_activity WHERE pid = $1`,
          [holderPid],
        );
        expect(holderStill.rows[0]?.state).toBe("idle in transaction");
        expect(holderStill.rows[0]?.backend_xmin).toBeTruthy();

        await holder.query("COMMIT");
        await holder.end();

        await buildPromise;
        expect(buildSettledAtNs).not.toBeNull();
        const settledAt = buildSettledAtNs!;
        evidence.buildSettledAtNs = settledAt.toString();
        evidence.buildDurationMs = Number(settledAt - buildStartedAtNs) / 1e6;
        if (buildError) throw buildError;

        for (const w of writeWindows) {
          const start = BigInt(w.startNs);
          const end = BigInt(w.endNs);
          expect(start > activeObservedAtNs).toBe(true);
          expect(end < settledAt).toBe(true);
          expect(start < settledAt).toBe(true);
        }

        const entry = TENANT_COMPATIBILITY_INDEXES.find(
          (e) => e.name === "Supplier_shopId_idx",
        )!;
        const inspected = await inspectIndex(builder, entry.name);
        expect(classifyIndex(entry, inspected)).toBe("valid_exact");
        if (inspected.status === "present") {
          expect(inspected.indisvalid).toBe(true);
          expect(inspected.indisready).toBe(true);
        }
        evidence.indexVerification = "valid_exact";

        allIterationEvidence.push(evidence);
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify({
            event: "tenant_index_concurrent_write_evidence_v2",
            ...evidence,
          }),
        );
      } finally {
        try {
          await holder.query("ROLLBACK");
        } catch {
          // already closed
        }
        try {
          await holder.end();
        } catch {
          // ignore
        }
        await builder.end();
        await writer.end();
        await observer.end();
      }
    }

    expect(allIterationEvidence).toHaveLength(10);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        event: "tenant_index_concurrent_write_evidence_v2_summary",
        iterations: allIterationEvidence.length,
        supersededPriorR9Head:
          "fb04345f129b8664566c5947f2ad75f57102269b",
      }),
    );
  }, 900_000);

  it("DML overlaps active build-scan and validation-scan phases (F-F03), 3 iterations", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      await applyIndexes(client, { apply: true });
    });

    await clientPopulateSuppliers(prisma, ACTIVE_PHASE_ROW_COUNT);

    const iterationEvidence: Array<Record<string, unknown>> = [];

    for (let iteration = 1; iteration <= 3; iteration += 1) {
      await withMaintenanceClient(async (client) => {
        await client.query(
          `DROP INDEX CONCURRENTLY IF EXISTS "Supplier_shopId_idx"`,
        );
      });

      const builder = await getMaintenanceClient({
        requireExplicitMaintenanceUrl: true,
      });
      const writer = new Client({ connectionString: DATABASE_URL });
      await writer.connect();
      const observer = new Client({ connectionString: DATABASE_URL });
      await observer.connect();

      // Writer-gate transactions make phase entry deterministic: CREATE INDEX
      // CONCURRENTLY parks at "waiting for writers before build" until gate1
      // commits and at "waiting for writers before validation" until gate2
      // commits, so each active phase starts exactly when we release it.
      const gate1 = new Client({ connectionString: DATABASE_URL });
      await gate1.connect();
      const gate2 = new Client({ connectionString: DATABASE_URL });
      await gate2.connect();

      const evidence: Record<string, unknown> = {
        iteration,
        rowCount: ACTIVE_PHASE_ROW_COUNT,
        writeThresholdMs: CONCURRENT_WRITE_THRESHOLD_MS,
        environment: {
          node: process.version,
          platform: process.platform,
          databaseUrlHost: new URL(DATABASE_URL).host,
        },
      };

      try {
        // Deterministically lengthen the active phases: no parallel workers
        // and a tiny sort budget force long external build and validation scans.
        await builder.query(`SET max_parallel_maintenance_workers = 0`);
        await builder.query(`SET maintenance_work_mem = '1MB'`);

        const pidResult = await builder.query<{ pid: number }>(
          `SELECT pg_backend_pid() AS pid`,
        );
        const builderPid = pidResult.rows[0]!.pid;
        evidence.builderPid = builderPid;

        // Gate 1 open before the build starts — first WaitForLockers waits on it.
        await gate1.query("BEGIN");
        await gate1.query(
          `INSERT INTO "Supplier" (id, shop, name, "createdAt", "updatedAt")
           VALUES ('sup-gate1-${iteration}', 'gate.myshopify.com', 'G1', NOW(), NOW())`,
        );

        let buildSettled = false;
        let buildError: unknown;
        let buildSettledAtNs: bigint | null = null;
        const buildStartedAtNs = process.hrtime.bigint();
        evidence.buildStartedAtNs = buildStartedAtNs.toString();

        const buildPromise = builder
          .query(
            `CREATE INDEX CONCURRENTLY "Supplier_shopId_idx" ON "Supplier" ("shopId")`,
          )
          .then(
            (r) => {
              buildSettledAtNs = process.hrtime.bigint();
              buildSettled = true;
              return r;
            },
            (e) => {
              buildSettledAtNs = process.hrtime.bigint();
              buildSettled = true;
              buildError = e;
              throw e;
            },
          );

        type PhaseWrites = {
          phaseAtStart: string;
          relid: string;
          schema: string;
          lockModes: string[];
          writeWindows: Array<{
            op: string;
            startNs: string;
            endNs: string;
            durationMs: number;
          }>;
        };
        const phasesSeen = new Set<string>();

        const waitForPhase = async (
          target: string,
          deadlineMs: number,
        ): Promise<{ phase: string; relid: string; schema: string }> => {
          const deadline = Date.now() + deadlineMs;
          for (;;) {
            if (buildSettled) {
              throw new Error(
                `Iteration ${iteration}: build settled before phase "${target}" was observed ` +
                  `(phasesSeen=${JSON.stringify([...phasesSeen])})`,
              );
            }
            if (Date.now() > deadline) {
              throw new Error(
                `Iteration ${iteration}: timed out waiting for phase "${target}" ` +
                  `(phasesSeen=${JSON.stringify([...phasesSeen])})`,
              );
            }
            const progress = await observer.query<{
              phase: string | null;
              relid: string;
              schema: string;
            }>(
              `SELECT p.phase::text AS phase, p.relid::text AS relid,
                      n.nspname AS schema
               FROM pg_stat_progress_create_index p
               JOIN pg_class c ON c.oid = p.relid
               JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE p.pid = $1 AND c.relname = 'Supplier'`,
              [builderPid],
            );
            const row = progress.rows[0];
            if (row?.phase) {
              phasesSeen.add(row.phase);
              if (row.phase === target) {
                return { phase: row.phase, relid: row.relid, schema: row.schema };
              }
            }
          }
        };

        const grantedTargetLocks = async (): Promise<string[]> => {
          const locks = await observer.query<{ mode: string }>(
            `SELECT l.mode
             FROM pg_locks l
             JOIN pg_class c ON c.oid = l.relation
             WHERE l.pid = $1
               AND l.locktype = 'relation'
               AND c.relname = 'Supplier'
               AND l.granted = true`,
            [builderPid],
          );
          return locks.rows.map((l) => l.mode);
        };

        const timedWritesDuringPhase = async (
          observedPhase: { phase: string; relid: string; schema: string },
          lockModes: string[],
          idSuffix: string,
        ): Promise<PhaseWrites> => {
          const windows: PhaseWrites["writeWindows"] = [];
          const rowId = `sup-active-${idSuffix}`;
          const ops: Array<{ op: string; sql: string }> = [
            {
              op: "insert",
              sql: `INSERT INTO "Supplier" (id, shop, name, "createdAt", "updatedAt")
                    VALUES ('${rowId}', 'active-probe.myshopify.com', 'A', NOW(), NOW())`,
            },
            {
              op: "update",
              sql: `UPDATE "Supplier" SET name = 'A2' WHERE id = '${rowId}'`,
            },
            {
              op: "delete",
              sql: `DELETE FROM "Supplier" WHERE id = '${rowId}'`,
            },
          ];
          for (const { op, sql } of ops) {
            expect(buildSettled).toBe(false);
            const startNs = process.hrtime.bigint();
            await writer.query(sql);
            const endNs = process.hrtime.bigint();
            expect(buildSettled).toBe(false);
            expect(buildSettledAtNs).toBeNull();
            const durationMs = Number(endNs - startNs) / 1e6;
            expect(durationMs).toBeLessThan(CONCURRENT_WRITE_THRESHOLD_MS);
            windows.push({
              op,
              startNs: startNs.toString(),
              endNs: endNs.toString(),
              durationMs,
            });
          }
          return {
            phaseAtStart: observedPhase.phase,
            relid: observedPhase.relid,
            schema: observedPhase.schema,
            lockModes,
            writeWindows: windows,
          };
        };

        // Deterministic build gate: CIC parks until gate1 commits.
        await waitForPhase("waiting for writers before build", 60_000);
        // Gate 2 opens while CIC is parked — it is outside the first locker
        // snapshot but inside the validation locker snapshot.
        await gate2.query("BEGIN");
        await gate2.query(
          `INSERT INTO "Supplier" (id, shop, name, "createdAt", "updatedAt")
           VALUES ('sup-gate2-${iteration}', 'gate.myshopify.com', 'G2', NOW(), NOW())`,
        );
        await gate1.query("COMMIT");

        // PostgreSQL 16 reports the btree build sub-phase in the phase text.
        const buildPhase = await waitForPhase(
          "building index: scanning table",
          120_000,
        );
        const buildLocks = await grantedTargetLocks();
        expect(buildLocks.length).toBeGreaterThan(0);
        expect(buildLocks).toContain("ShareUpdateExclusiveLock");
        expect(buildLocks).not.toContain("AccessExclusiveLock");
        const buildScanWrites = await timedWritesDuringPhase(
          buildPhase,
          buildLocks,
          `build-${iteration}`,
        );

        // Deterministic validation gate: CIC parks until gate2 commits.
        await waitForPhase("waiting for writers before validation", 120_000);
        await gate2.query("COMMIT");

        const validationPhase = await waitForPhase(
          "index validation: scanning table",
          120_000,
        );
        const validationLocks = await grantedTargetLocks();
        expect(validationLocks.length).toBeGreaterThan(0);
        expect(validationLocks).toContain("ShareUpdateExclusiveLock");
        expect(validationLocks).not.toContain("AccessExclusiveLock");
        const validationScanWrites = await timedWritesDuringPhase(
          validationPhase,
          validationLocks,
          `validate-${iteration}`,
        );

        await buildPromise;
        expect(buildSettledAtNs).not.toBeNull();
        const settledAt = buildSettledAtNs!;
        evidence.buildSettledAtNs = settledAt.toString();
        evidence.buildDurationMs = Number(settledAt - buildStartedAtNs) / 1e6;
        if (buildError) throw buildError;

        evidence.phasesSeen = [...phasesSeen];
        evidence.buildScanWrites = buildScanWrites;
        evidence.validationScanWrites = validationScanWrites;

        expect(buildScanWrites.phaseAtStart).toBe(
          "building index: scanning table",
        );
        expect(validationScanWrites.phaseAtStart).toBe(
          "index validation: scanning table",
        );

        for (const phaseWrites of [buildScanWrites, validationScanWrites]) {
          expect(phaseWrites.schema).toBe("public");
          expect(phaseWrites.lockModes).toContain("ShareUpdateExclusiveLock");
          expect(phaseWrites.lockModes).not.toContain("AccessExclusiveLock");
          expect(phaseWrites.writeWindows).toHaveLength(3);
          for (const w of phaseWrites.writeWindows) {
            expect(BigInt(w.startNs) > buildStartedAtNs).toBe(true);
            expect(BigInt(w.endNs) < settledAt).toBe(true);
            expect(w.durationMs).toBeLessThan(CONCURRENT_WRITE_THRESHOLD_MS);
          }
        }

        // Remove committed gate rows so later iterations start identically.
        await writer.query(
          `DELETE FROM "Supplier" WHERE id IN ('sup-gate1-${iteration}', 'sup-gate2-${iteration}')`,
        );

        const entry = TENANT_COMPATIBILITY_INDEXES.find(
          (e) => e.name === "Supplier_shopId_idx",
        )!;
        const inspected = await inspectIndex(builder, entry.name);
        expect(classifyIndex(entry, inspected)).toBe("valid_exact");
        if (inspected.status === "present") {
          expect(inspected.indisvalid).toBe(true);
          expect(inspected.indisready).toBe(true);
        }
        evidence.indexVerification = "valid_exact";

        iterationEvidence.push(evidence);
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify({
            event: "tenant_index_active_phase_write_evidence",
            ...evidence,
          }),
        );
      } finally {
        for (const gate of [gate1, gate2]) {
          try {
            await gate.query("ROLLBACK");
          } catch {
            // already committed or closed
          }
          try {
            await gate.end();
          } catch {
            // ignore
          }
        }
        await builder.end();
        await writer.end();
        await observer.end();
      }
    }

    expect(iterationEvidence).toHaveLength(3);
  }, 900_000);

  it("verify fails when indexes were dropped after apply", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      await applyIndexes(client, { apply: true });
      await dropAllManifestIndexes(client);
      const verify = await verifyIndexes(client);
      expect(verify.ok).toBe(false);
      expect(verify.mismatches.length).toBeGreaterThan(0);
    });
  }, 300_000);
});

async function clientPopulateSuppliers(
  prisma: PrismaClient,
  count: number,
): Promise<void> {
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Supplier" (id, shop, name, "createdAt", "updatedAt")
    SELECT
      'sup-bulk-' || g,
      'bulk.myshopify.com',
      'Name-' || g,
      NOW(),
      NOW()
    FROM generate_series(1, ${count}) AS g
  `);
}
