/**
 * Populated enforcement concurrency evidence (F-PR3C-08).
 *
 * Fixture: 50 shops, 100k Supplier, 100k POLineItem. Merchant traffic uses
 * the restricted runtime role with transaction-local tenant context.
 * Timings are environment-specific observations, never production guarantees.
 */
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyEnforcement } from "../apply";
import { getMigrationClient } from "../connection";
import { TENANT_ENFORCEMENT_ADVISORY_LOCK_KEY } from "../manifest";
import { provisionRoles, assertSafeRuntimeAccess } from "../roles";
import { verifyEnforcement } from "../verify";
import { ensureEnforcementTestEnv } from "./helpers";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const SHOP_COUNT = 50;
const SUPPLIERS_PER_SHOP = 2000; // 100_000 total
const POLINES_PER_SHOP = 2000; // 100_000 total

type LockSample = {
  blockedPid: number | null;
  blockingPid: number | null;
  lockMode: string | null;
  waitEventType: string | null;
  waitEvent: string | null;
};

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

describe("PR3 populated enforcement concurrency", () => {
  let prisma: PrismaClient | undefined;
  const evidence: {
    applyOk: boolean;
    maxLockHoldMs: number;
    p50: number;
    p95: number;
    max: number;
    unsafe: boolean | "unknown";
    resumeOk: boolean;
    merchantQuery: {
      samples: number;
      p50Ms: number;
      p95Ms: number;
      maxMs: number;
      errors: number;
      successfulOperations: string[];
    };
    lockSnapshots: number;
    lockSamples: LockSample[];
    inducedFault: {
      kind: string;
      classifiedAs: string;
      unsafeRuntimeAccess: boolean | "unknown";
      recovered: boolean;
    } | null;
  } = {
    applyOk: false,
    maxLockHoldMs: 0,
    p50: 0,
    p95: 0,
    max: 0,
    unsafe: true,
    resumeOk: false,
    merchantQuery: {
      samples: 0,
      p50Ms: 0,
      p95Ms: 0,
      maxMs: 0,
      errors: 0,
      successfulOperations: [],
    },
    lockSnapshots: 0,
    lockSamples: [],
    inducedFault: null,
  };

  afterAll(async () => {
    await prisma?.$disconnect();
    // Emit structured evidence for the correction report (not a pass claim alone)
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        event: "tenant_populated_enforcement_evidence",
        fixture: {
          shops: SHOP_COUNT,
          suppliers: SHOP_COUNT * SUPPLIERS_PER_SHOP,
          polineItems: SHOP_COUNT * POLINES_PER_SHOP,
        },
        ...evidence,
        classification: "populated-scale",
        emptySmokeClaim: false,
        evidenceScope:
          "environment-specific observation; not a production latency or lock-hold guarantee",
      }),
    );
  });

  it("runs restricted runtime DML, lock sampling, a deliberate fault, and clean resume", async () => {
    const url = ensureEnforcementTestEnv();
    prisma = new PrismaClient({ datasources: { db: { url } } });
    await prisma.$executeRawUnsafe(`DROP SCHEMA public CASCADE`);
    await prisma.$executeRawUnsafe(`CREATE SCHEMA public`);
    await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO public`);
    await prisma.$executeRawUnsafe(
      `GRANT ALL ON SCHEMA public TO CURRENT_USER`,
    );
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      cwd: APP_ROOT,
      env: { ...process.env, DATABASE_URL: url },
      stdio: "pipe",
    });
    execFileSync("npm", ["run", "tenant:indexes:apply", "--", "--apply"], {
      cwd: APP_ROOT,
      env: {
        ...process.env,
        DATABASE_URL: url,
        TENANT_MAINTENANCE_DATABASE_URL: url,
      },
      stdio: "pipe",
    });

    // Establish the restricted runtime/RLS contract before generating any
    // merchant traffic. Seeding remains a migration-owner operation.
    const initialMigration = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const prepared = await provisionRoles(initialMigration, {
        apply: true,
        phase: "prepare",
      });
      expect(prepared.ok).toBe(true);
      const initialApply = await applyEnforcement(initialMigration, {
        apply: true,
      });
      expect(initialApply.ok).toBe(true);
      expect(initialApply.unsafe_runtime_access).toBe(false);
    } finally {
      await initialMigration.end();
    }

    // Seed populated fixture with same-tenant relationships
    const shopIds: string[] = [];
    for (let i = 1; i <= SHOP_COUNT; i++) {
      const shop = await prisma.shop.create({
        data: { myshopifyDomain: `pop-shop-${i}.myshopify.com` },
      });
      shopIds.push(shop.id);
    }

    // Bulk insert via raw SQL for speed
    const clientSeed = new Client({ connectionString: url });
    await clientSeed.connect();
    try {
      await clientSeed.query("BEGIN");
      for (let s = 0; s < SHOP_COUNT; s++) {
        const shopId = shopIds[s];
        const domain = `pop-shop-${s + 1}.myshopify.com`;
        const supplierValues: string[] = [];
        for (let i = 0; i < SUPPLIERS_PER_SHOP; i++) {
          const sid = `s${s}_${i}`;
          supplierValues.push(
            `('${sid}','${domain}','${shopId}','n${i}',NOW(),NOW())`,
          );
        }
        // Insert suppliers in chunks
        for (let c = 0; c < supplierValues.length; c += 500) {
          const chunk = supplierValues.slice(c, c + 500);
          await clientSeed.query(
            `INSERT INTO "Supplier" (id, shop, "shopId", name, "createdAt", "updatedAt")
               VALUES ${chunk.join(",")}`,
          );
        }
        // One PO per shop + POLINES_PER_SHOP lines pointing at it
        const poId = `po${s}`;
        const supplierId = `s${s}_0`;
        await clientSeed.query(
          `INSERT INTO "PurchaseOrder" (id, shop, "shopId", "supplierId", "locationId", status, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, 'loc1', 'DRAFT', NOW(), NOW())`,
          [poId, domain, shopId, supplierId],
        );
        const lineChunkValues: string[] = [];
        for (let i = 0; i < POLINES_PER_SHOP; i++) {
          lineChunkValues.push(
            `('pl${s}_${i}','${shopId}','${poId}','var${i}',1,0,1.0000)`,
          );
        }
        for (let c = 0; c < lineChunkValues.length; c += 500) {
          const chunk = lineChunkValues.slice(c, c + 500);
          await clientSeed.query(
            `INSERT INTO "POLineItem" (id, "shopId", "purchaseOrderId", "shopifyVariantId", "orderedQty", "receivedQty", "unitCost")
               VALUES ${chunk.join(",")}`,
          );
        }
      }
      await clientSeed.query("COMMIT");
    } catch (err) {
      await clientSeed.query("ROLLBACK");
      throw err;
    } finally {
      await clientSeed.end();
    }

    const counts = await prisma.$queryRawUnsafe<
      { suppliers: string; lines: string }[]
    >(
      `SELECT
           (SELECT COUNT(*)::text FROM "Supplier") AS suppliers,
           (SELECT COUNT(*)::text FROM "POLineItem") AS lines`,
    );
    expect(Number(counts[0].suppliers)).toBe(SHOP_COUNT * SUPPLIERS_PER_SHOP);
    expect(Number(counts[0].lines)).toBe(SHOP_COUNT * POLINES_PER_SHOP);

    // Deliberately induce one classified fault: advisory-lock contention.
    // This is deterministic and proves the early-return safety measurement
    // before the populated resume run.
    const faultHolder = new Client({ connectionString: url });
    const faultContender = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    await faultHolder.connect();
    try {
      const held = await faultHolder.query<{ acquired: boolean }>(
        `SELECT pg_try_advisory_lock($1) AS acquired`,
        [TENANT_ENFORCEMENT_ADVISORY_LOCK_KEY],
      );
      expect(held.rows[0].acquired).toBe(true);
      const fault = await applyEnforcement(faultContender, { apply: true });
      expect(fault.ok).toBe(false);
      expect(fault.steps[0].error).toBe("advisory_lock_unavailable");
      expect(fault.unsafe_runtime_access).toBe(false);
      evidence.inducedFault = {
        kind: "advisory_lock_contention",
        classifiedAs: fault.steps[0].error ?? "unclassified",
        unsafeRuntimeAccess: fault.unsafe_runtime_access,
        recovered: false,
      };
    } finally {
      await faultHolder.query(`SELECT pg_advisory_unlock($1)`, [
        TENANT_ENFORCEMENT_ADVISORY_LOCK_KEY,
      ]);
      await faultHolder.end();
      await faultContender.end();
    }

    const merchantDurationsMs: number[] = [];
    const successfulOperations = new Set<string>();
    let merchantErrors = 0;
    let stop = false;
    let trafficReadyResolve!: () => void;
    const trafficReady = new Promise<void>((resolve) => {
      trafficReadyResolve = resolve;
    });

    const traffic = (async () => {
      const trafficClient = new Client({
        connectionString: process.env.DATABASE_RUNTIME_URL!,
      });
      await trafficClient.connect();
      let sequence = 0;
      const timed = async (
        operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE",
        query: () => Promise<unknown>,
      ) => {
        const started = performance.now();
        try {
          await query();
          successfulOperations.add(operation);
          if (successfulOperations.size === 4) trafficReadyResolve();
        } finally {
          merchantDurationsMs.push(performance.now() - started);
        }
      };

      try {
        while (!stop) {
          const shopIndex = sequence % SHOP_COUNT;
          const shopId = shopIds[shopIndex];
          const domain = `pop-shop-${shopIndex + 1}.myshopify.com`;
          const transientId = `runtime_traffic_${sequence++}`;
          try {
            await trafficClient.query("BEGIN");
            await trafficClient.query(
              `SELECT set_config('stocky.current_shop_id', $1, true)`,
              [shopId],
            );
            await trafficClient.query(
              `SELECT set_config(
                   'stocky.tenant_context_version',
                   'phase1-db-tenant-context-v1',
                   true
                 )`,
            );
            await timed("SELECT", () =>
              trafficClient.query(
                `SELECT id FROM public."Supplier"
                   WHERE "shopId" = $1
                   ORDER BY id
                   LIMIT 1`,
                [shopId],
              ),
            );
            await timed("INSERT", () =>
              trafficClient.query(
                `INSERT INTO public."Supplier"
                     (id, shop, "shopId", name, "createdAt", "updatedAt")
                   VALUES ($1, $2, $3, 'runtime traffic', NOW(), NOW())`,
                [transientId, domain, shopId],
              ),
            );
            await timed("UPDATE", () =>
              trafficClient.query(
                `UPDATE public."Supplier"
                   SET name = 'runtime traffic updated', "updatedAt" = NOW()
                   WHERE id = $1`,
                [transientId],
              ),
            );
            await timed("DELETE", () =>
              trafficClient.query(
                `DELETE FROM public."Supplier" WHERE id = $1`,
                [transientId],
              ),
            );
            await trafficClient.query("COMMIT");
          } catch {
            merchantErrors += 1;
            await trafficClient.query("ROLLBACK").catch(() => undefined);
          }
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      } finally {
        await trafficClient.end();
      }
    })();

    const lockObserver = (async () => {
      const observer = new Client({ connectionString: url });
      await observer.connect();
      try {
        while (!stop) {
          const sample = await observer.query<{
            blocked_pid: number | null;
            blocking_pid: number | null;
            lock_mode: string | null;
            wait_event_type: string | null;
            wait_event: string | null;
          }>(
            `SELECT
                 a.pid AS blocked_pid,
                 (pg_blocking_pids(a.pid))[1] AS blocking_pid,
                 l.mode AS lock_mode,
                 a.wait_event_type,
                 a.wait_event
               FROM pg_stat_activity a
               LEFT JOIN pg_locks l ON l.pid = a.pid
               WHERE a.datname = current_database()
                 AND a.pid <> pg_backend_pid()
               ORDER BY
                 (a.wait_event_type = 'Lock') DESC,
                 l.granted ASC NULLS LAST,
                 a.pid
               LIMIT 25`,
          );
          evidence.lockSnapshots += 1;
          for (const row of sample.rows) {
              if (evidence.lockSamples.length >= 20) break;
            evidence.lockSamples.push({
              blockedPid: row.blocked_pid,
              blockingPid: row.blocking_pid,
              lockMode: row.lock_mode,
              waitEventType: row.wait_event_type,
              waitEvent: row.wait_event,
            });
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      } finally {
        await observer.end();
      }
    })();

    const mig = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      await Promise.race([
        trafficReady,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("restricted runtime DML did not start")),
            10_000,
          ),
        ),
      ]);

      const apply = await applyEnforcement(mig, { apply: true });
      evidence.resumeOk = apply.ok;
      if (evidence.inducedFault) evidence.inducedFault.recovered = apply.ok;

      stop = true;
      await Promise.all([traffic, lockObserver]);

      evidence.applyOk = apply.ok;
      evidence.maxLockHoldMs = apply.maxObservedLockHoldMs;
      evidence.p50 = apply.stepDurationsMs?.p50 ?? 0;
      evidence.p95 = apply.stepDurationsMs?.p95 ?? 0;
      evidence.max = apply.stepDurationsMs?.max ?? 0;
      evidence.unsafe = apply.unsafe_runtime_access;
      evidence.merchantQuery = {
        samples: merchantDurationsMs.length,
        p50Ms: percentile(merchantDurationsMs, 50),
        p95Ms: percentile(merchantDurationsMs, 95),
        maxMs: percentile(merchantDurationsMs, 100),
        errors: merchantErrors,
        successfulOperations: [...successfulOperations].sort(),
      };

      const safety = await assertSafeRuntimeAccess(mig);
      expect(safety.unsafe_runtime_access).toBe(false);
      expect(apply.ok).toBe(true);
      expect(apply.unsafe_runtime_access).toBe(false);
      expect(evidence.merchantQuery.samples).toBeGreaterThan(0);
      expect(evidence.merchantQuery.successfulOperations).toEqual([
        "DELETE",
        "INSERT",
        "SELECT",
        "UPDATE",
      ]);
      expect(evidence.lockSnapshots).toBeGreaterThan(0);
      expect(evidence.inducedFault?.recovered).toBe(true);
      expect((await verifyEnforcement(mig)).ok).toBe(true);
    } finally {
      stop = true;
      await Promise.allSettled([traffic, lockObserver]);
      await mig.end();
    }
  }, 900_000);
});
