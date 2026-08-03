/**
 * Advisory lock release failure surfacing (F-PR3C-14).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { Client } from "pg";
import { applyEnforcement } from "../apply";
import { getMigrationClient } from "../connection";
import { TENANT_ENFORCEMENT_ADVISORY_LOCK_KEY } from "../manifest";
import { verifyEnforcement } from "../verify";
import { resetSchemaAndApplyEnforcement } from "./helpers";

function forceUnlockWhenNotHeld(client: Client): {
  client: Client;
  wasForced: () => boolean;
} {
  let forced = false;
  const proxy = new Proxy(client, {
    get(target, property) {
      if (property === "query") {
        return async (...args: unknown[]) => {
          const sql = String(args[0]);
          if (!forced && sql.includes("pg_advisory_unlock")) {
            forced = true;
            // First call releases the lock apply actually holds. The second
            // call is the deliberate "unlock when not held" failure.
            await Reflect.apply(target.query, target, args);
            return Reflect.apply(target.query, target, args);
          }
          return Reflect.apply(target.query, target, args);
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { client: proxy as Client, wasForced: () => forced };
}

describe.sequential("advisory unlock failure", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    ({ prisma } = await resetSchemaAndApplyEnforcement());
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("surfaces lockReleaseFailed and never reports overall clean success", async () => {
    const migration = await getMigrationClient({
      requireExplicitMigrationUrl: true,
    });
    try {
      const forced = forceUnlockWhenNotHeld(migration);
      const result = await applyEnforcement(forced.client, { apply: true });

      expect(forced.wasForced()).toBe(true);
      expect(result.lockReleaseFailed).toBe(true);
      expect(result.lockReleaseDetail).toContain("advisory_unlock_failed");
      expect(result.advisoryLockBackendPid).toBeTypeOf("number");
      expect(result.ok).toBe(false);
      expect(result.recoveryHint).toContain("advisory_unlock_failed");
      expect(result.steps.every((step) => step.status === "completed")).toBe(
        true,
      );
      expect(result.unsafe_runtime_access).toBe(false);
      expect((await verifyEnforcement(migration)).ok).toBe(true);

      const lockState = await migration.query<{ acquired: boolean }>(
        `SELECT pg_try_advisory_lock($1) AS acquired`,
        [TENANT_ENFORCEMENT_ADVISORY_LOCK_KEY],
      );
      expect(lockState.rows[0].acquired).toBe(true);
      await migration.query(`SELECT pg_advisory_unlock($1)`, [
        TENANT_ENFORCEMENT_ADVISORY_LOCK_KEY,
      ]);
    } finally {
      await migration.end();
    }
  });
});
