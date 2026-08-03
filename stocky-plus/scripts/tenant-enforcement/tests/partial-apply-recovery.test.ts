/**
 * Unsafe partial-apply recovery + interruption/resume tests (F-PR3-01/02).
 *
 * Injects failure after each major checkpoint, asserts no unrestricted
 * merchant access, then resumes apply to a fully verified final state.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyEnforcement,
  majorInterruptionCheckpoints,
} from "../apply";
import { getMigrationClient } from "../connection";
import { runPreflight } from "../preflight";
import {
  assertSafeRuntimeAccess,
  provisionRoles,
  revokeMerchantDml,
} from "../roles";
import { verifyEnforcement } from "../verify";
import { MERCHANT_SQL_TABLES } from "../manifest";
import { ensureEnforcementTestEnv } from "./helpers";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

async function resetBare(): Promise<PrismaClient> {
  const url = ensureEnforcementTestEnv();
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  await prisma.$executeRawUnsafe(`DROP SCHEMA public CASCADE`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA public`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO public`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO CURRENT_USER`);
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
  return prisma;
}

describe("PR3 unsafe partial-apply recovery and interruption/resume", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = await resetBare();
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("resume preflight allows partial enforcement after NOT NULL divergence", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      await provisionRoles(client, { apply: true, phase: "prepare" });
      await client.query(
        `ALTER TABLE "Supplier" ALTER COLUMN "shopId" SET NOT NULL`,
      );
      const preflight = await runPreflight(client, { mode: "resume" });
      expect(preflight.ok).toBe(true);
      expect(
        preflight.progress.partial || preflight.progress.notNullCount > 0,
      ).toBe(true);
      const apply = await applyEnforcement(client, { apply: true });
      expect(apply.ok).toBe(true);
      expect(apply.unsafe_runtime_access).toBe(false);
      expect((await verifyEnforcement(client)).ok).toBe(true);
    } finally {
      await client.end();
    }
  });

  it("failure before RLS keeps runtime without merchant DML", async () => {
    await prisma.$disconnect();
    prisma = await resetBare();
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      await provisionRoles(client, { apply: true, phase: "prepare" });
      const apply = await applyEnforcement(client, { apply: true });
      expect(apply.ok).toBe(true);

      for (const table of MERCHANT_SQL_TABLES) {
        await client.query(
          `ALTER TABLE "${table}" NO FORCE ROW LEVEL SECURITY`,
        );
        await client.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
      }
      let safety = await assertSafeRuntimeAccess(client);
      expect(safety.unsafe_runtime_access).toBe(true);

      const preflight = await runPreflight(client, { mode: "resume" });
      expect(preflight.ok).toBe(true);

      const recovered = await applyEnforcement(client, { apply: true });
      expect(recovered.ok).toBe(true);
      expect(recovered.unsafe_runtime_access).toBe(false);
      safety = await assertSafeRuntimeAccess(client);
      expect(safety.unsafe_runtime_access).toBe(false);
    } finally {
      await client.end();
    }
  });

  it("failSafe revokes merchant DML when definitions incomplete", async () => {
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      await client.query(
        `DROP POLICY IF EXISTS "Supplier_tenant_select" ON "Supplier"`,
      );
      await revokeMerchantDml(client, "stocky_runtime");
      await client.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Supplier" TO stocky_runtime`,
      );
      const apply = await applyEnforcement(client, { apply: true });
      const safety = await assertSafeRuntimeAccess(client);
      expect(safety.unsafe_runtime_access).toBe(false);
      if (!apply.ok) {
        expect(apply.recoveryHint).toBeTruthy();
      } else {
        expect((await verifyEnforcement(client)).ok).toBe(true);
      }
    } finally {
      await client.end();
    }
  });

  for (const checkpoint of majorInterruptionCheckpoints()) {
    it(
      `interrupt after ${checkpoint} stays safe and resumes to final verify`,
      async () => {
        await prisma.$disconnect();
        prisma = await resetBare();
        const client = await getMigrationClient({
          requireExplicitMigrationUrl: true,
        });
        try {
          await provisionRoles(client, { apply: true, phase: "prepare" });

          const interrupted = await applyEnforcement(client, {
            apply: true,
            failAfterStepId: checkpoint,
          });
          expect(interrupted.ok).toBe(false);
          expect(interrupted.unsafe_runtime_access).toBe(false);
          const safetyAfterInterrupt = await assertSafeRuntimeAccess(client);
          expect(safetyAfterInterrupt.unsafe_runtime_access).toBe(false);

          const interruptedStep = interrupted.steps.find(
            (s) => s.id === checkpoint,
          );
          expect(interruptedStep?.status).toBe("completed");
          expect(interruptedStep?.error).toContain(
            `injected_interrupt_after:${checkpoint}`,
          );

          const remainingPending = interrupted.steps.filter(
            (s) => s.status === "pending",
          );
          // final_verified interrupt: no pending remaining
          if (checkpoint !== "final_verified") {
            expect(remainingPending.length).toBeGreaterThan(0);
          }

          const resumePreflight = await runPreflight(client, {
            mode: "resume",
          });
          expect(resumePreflight.ok).toBe(true);

          const resumed = await applyEnforcement(client, { apply: true });
          expect(resumed.ok).toBe(true);
          expect(resumed.unsafe_runtime_access).toBe(false);
          expect(
            resumed.steps.every((s) => s.status === "completed"),
          ).toBe(true);
          expect((await verifyEnforcement(client)).ok).toBe(true);
        } finally {
          await client.end();
        }
      },
      300_000,
    );
  }
});
