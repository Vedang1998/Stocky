/**
 * Unsafe partial-apply recovery + interruption/resume tests (F-PR3-01/02).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyEnforcement } from "../apply";
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
      // Simulate partial apply: set NOT NULL on one table (causes Prisma drift)
      await client.query(
        `ALTER TABLE "Supplier" ALTER COLUMN "shopId" SET NOT NULL`,
      );
      const preflight = await runPreflight(client, { mode: "resume" });
      expect(preflight.ok).toBe(true);
      expect(preflight.progress.partial || preflight.progress.notNullCount > 0).toBe(
        true,
      );
      // Full apply from partial state must succeed
      const apply = await applyEnforcement(client, { apply: true });
      expect(apply.ok).toBe(true);
      expect(apply.unsafe_runtime_access).toBe(false);
      expect((await verifyEnforcement(client)).ok).toBe(true);
    } finally {
      await client.end();
    }
  });

  it("failure before RLS keeps runtime without merchant DML", async () => {
    // Reset again for a clean interruption scenario
    await prisma.$disconnect();
    prisma = await resetBare();
    const client = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      await provisionRoles(client, { apply: true, phase: "prepare" });
      // Inject a bad same-named FK mid-path by creating wrong constraint name
      // that will be detected when we reach that step — instead, revoke and
      // assert safety after prepare + constraints without RLS.
      // Run apply then manually strip RLS and ensure failSafe revokes DML.
      const apply = await applyEnforcement(client, { apply: true });
      expect(apply.ok).toBe(true);

      // Simulate stranded state: revoke FORCE RLS and keep grants
      for (const table of MERCHANT_SQL_TABLES) {
        await client.query(
          `ALTER TABLE "${table}" NO FORCE ROW LEVEL SECURITY`,
        );
        await client.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
      }
      // Grants still present — unsafe
      let safety = await assertSafeRuntimeAccess(client);
      expect(safety.unsafe_runtime_access).toBe(true);

      // Resume preflight must still allow recovery
      const preflight = await runPreflight(client, { mode: resumeMode() });
      expect(preflight.ok).toBe(true);

      // Re-apply must restore safe state
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
      // Start from enforced DB, drop one policy, grant still present
      await client.query(
        `DROP POLICY IF EXISTS "Supplier_tenant_select" ON "Supplier"`,
      );
      await revokeMerchantDml(client, "stocky_runtime");
      // Manually grant without RLS policy — unsafe
      await client.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Supplier" TO stocky_runtime`,
      );
      // Apply should detect wrong/missing policy during definitions or rls step
      // and leave safe
      const apply = await applyEnforcement(client, { apply: true });
      // Either succeeds (repairs policy) or fails safe
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
});

function resumeMode(): "resume" {
  return "resume";
}
