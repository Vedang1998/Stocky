/**
 * Deliberate lock/deadlock/timeout/cancellation recovery (F-PR3C-04).
 *
 * Real PostgreSQL faults are induced first. Their actual driver errors are
 * then delivered at an apply step so retry classification, bounded attempts,
 * fail-safe measurement, and resume behavior are exercised deterministically.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import { applyEnforcement } from "../apply";
import { getMigrationClient } from "../connection";
import { TENANT_ENFORCEMENT_ADVISORY_LOCK_KEY } from "../manifest";
import { verifyEnforcement } from "../verify";
import {
  ensureEnforcementTestEnv,
  resetSchemaAndApplyEnforcement,
} from "./helpers";

type FaultKind =
  | "conflicting_lock"
  | "deadlock"
  | "lock_timeout"
  | "statement_timeout"
  | "backend_cancel";

type CapturedFault = {
  kind: FaultKind;
  error: Error;
  message: string;
  retryableByApply: boolean;
};

function asError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason));
}

async function rawMigrationClient(): Promise<Client> {
  const client = new Client({ connectionString: ensureEnforcementTestEnv() });
  await client.connect();
  return client;
}

async function rollbackAndEnd(client: Client): Promise<void> {
  await client.query("ROLLBACK").catch(() => undefined);
  await client.end();
}

async function captureConflictingLock(): Promise<CapturedFault> {
  const holder = await rawMigrationClient();
  const contender = await rawMigrationClient();
  try {
    await holder.query("BEGIN");
    await holder.query(
      `LOCK TABLE public.enforcement_fault_a IN ACCESS EXCLUSIVE MODE`,
    );
    await contender.query("BEGIN");
    let error: Error;
    try {
      await contender.query(
        `LOCK TABLE public.enforcement_fault_a IN SHARE MODE NOWAIT`,
      );
      throw new Error("expected conflicting lock failure");
    } catch (reason) {
      error = asError(reason);
    }
    expect(error.message).toMatch(/could not obtain lock/i);
    return {
      kind: "conflicting_lock",
      error,
      message: error.message,
      retryableByApply: false,
    };
  } finally {
    await rollbackAndEnd(contender);
    await rollbackAndEnd(holder);
  }
}

async function captureDeadlock(): Promise<CapturedFault> {
  const first = await rawMigrationClient();
  const second = await rawMigrationClient();
  try {
    await first.query("BEGIN");
    await second.query("BEGIN");
    await first.query(`SET LOCAL statement_timeout = '5s'`);
    await second.query(`SET LOCAL statement_timeout = '5s'`);
    await first.query(
      `UPDATE public.enforcement_fault_a SET value = value + 1 WHERE id = 1`,
    );
    await second.query(
      `UPDATE public.enforcement_fault_b SET value = value + 1 WHERE id = 1`,
    );

    const firstWait = first.query(
      `UPDATE public.enforcement_fault_b SET value = value + 1 WHERE id = 1`,
    );
    await new Promise((resolve) => setTimeout(resolve, 75));
    const secondWait = second.query(
      `UPDATE public.enforcement_fault_a SET value = value + 1 WHERE id = 1`,
    );
    const settled = await Promise.allSettled([firstWait, secondWait]);
    const rejection = settled.find(
      (result): result is PromiseRejectedResult =>
        result.status === "rejected" &&
        /deadlock/i.test(asError(result.reason).message),
    );
    expect(rejection).toBeDefined();
    const error = asError(rejection!.reason);
    // This assertion proves PostgreSQL's actual deadlock detector ran.
    expect(error.message).toContain("deadlock");
    return {
      kind: "deadlock",
      error,
      message: error.message,
      retryableByApply: true,
    };
  } finally {
    await rollbackAndEnd(first);
    await rollbackAndEnd(second);
  }
}

async function captureLockTimeout(): Promise<CapturedFault> {
  const holder = await rawMigrationClient();
  const contender = await rawMigrationClient();
  try {
    await holder.query("BEGIN");
    await holder.query(
      `LOCK TABLE public.enforcement_fault_a IN ACCESS EXCLUSIVE MODE`,
    );
    await contender.query("BEGIN");
    await contender.query(`SET LOCAL lock_timeout = '100ms'`);
    let error: Error;
    try {
      await contender.query(
        `LOCK TABLE public.enforcement_fault_a IN SHARE MODE`,
      );
      throw new Error("expected lock timeout");
    } catch (reason) {
      error = asError(reason);
    }
    expect(error.message).toMatch(/lock timeout/i);
    return {
      kind: "lock_timeout",
      error,
      message: error.message,
      retryableByApply: true,
    };
  } finally {
    await rollbackAndEnd(contender);
    await rollbackAndEnd(holder);
  }
}

async function captureStatementTimeout(): Promise<CapturedFault> {
  const client = await rawMigrationClient();
  try {
    await client.query(`SET statement_timeout = '75ms'`);
    let error: Error;
    try {
      await client.query(`SELECT pg_sleep(2)`);
      throw new Error("expected statement timeout");
    } catch (reason) {
      error = asError(reason);
    }
    expect(error.message).toMatch(/statement timeout/i);
    return {
      kind: "statement_timeout",
      error,
      message: error.message,
      retryableByApply: true,
    };
  } finally {
    await client.end();
  }
}

async function captureBackendCancel(): Promise<CapturedFault> {
  const sleeper = await rawMigrationClient();
  const canceller = await rawMigrationClient();
  // pg may emit a client 'error' for 57014 in addition to rejecting the query
  // promise; without a listener Vitest treats that as an unhandled error and
  // fails the suite even when the promise path is asserted correctly.
  const swallowClientCancel = (err: Error) => {
    if (!/canceling statement due to user request/i.test(err.message)) {
      throw err;
    }
  };
  sleeper.on("error", swallowClientCancel);
  try {
    const pid = await sleeper.query<{ pid: number }>(
      `SELECT pg_backend_pid() AS pid`,
    );
    const sleeping = sleeper.query(`SELECT pg_sleep(10)`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const cancel = await canceller.query<{ cancelled: boolean }>(
      `SELECT pg_cancel_backend($1) AS cancelled`,
      [pid.rows[0].pid],
    );
    expect(cancel.rows[0].cancelled).toBe(true);
    let error: Error;
    try {
      await sleeping;
      throw new Error("expected backend cancellation");
    } catch (reason) {
      error = asError(reason);
    }
    expect(error.message).toMatch(/canceling statement due to user request/i);
    return {
      kind: "backend_cancel",
      error,
      message: error.message,
      retryableByApply: false,
    };
  } finally {
    sleeper.off("error", swallowClientCancel);
    await sleeper.end();
    await canceller.end();
  }
}

function injectFaultAtHelpers(
  client: Client,
  fault: CapturedFault,
): { client: Client; wasInjected: () => boolean } {
  let injected = false;
  const proxy = new Proxy(client, {
    get(target, property) {
      if (property === "query") {
        return (...args: unknown[]) => {
          const sql = String(args[0]);
          if (
            !injected &&
            sql.includes("CREATE OR REPLACE FUNCTION") &&
            sql.includes("stocky_current_tenant_id")
          ) {
            injected = true;
            return Promise.reject(fault.error);
          }
          return Reflect.apply(target.query, target, args);
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { client: proxy as Client, wasInjected: () => injected };
}

async function assertApplyRecovery(fault: CapturedFault): Promise<void> {
  const migration = await getMigrationClient({
    requireExplicitMigrationUrl: true,
  });
  try {
    const injected = injectFaultAtHelpers(migration, fault);
    const first = await applyEnforcement(injected.client, { apply: true });
    expect(injected.wasInjected()).toBe(true);
    expect(first.unsafe_runtime_access).toBe(false);
    expect(first.steps.every((step) => (step.attempts ?? 0) <= 5)).toBe(true);

    const helper = first.steps.find((step) => step.id === "helpers");
    expect(helper).toBeDefined();
    if (fault.retryableByApply) {
      expect(first.ok).toBe(true);
      expect(helper?.status).toBe("completed");
      expect(helper?.attempts).toBe(2);
    } else {
      expect(first.ok).toBe(false);
      expect(helper?.status).toBe("failed");
      expect(helper?.attempts).toBe(1);
      expect(helper?.error).toContain(fault.message);
    }

    // Resume is required even after an in-place retry succeeds: this proves
    // idempotent recovery and final clean verification for every fault class.
    const resumed = await applyEnforcement(migration, { apply: true });
    expect(resumed.ok).toBe(true);
    expect(resumed.unsafe_runtime_access).toBe(false);
    expect(resumed.steps.every((step) => (step.attempts ?? 0) <= 5)).toBe(true);
    expect((await verifyEnforcement(migration)).ok).toBe(true);
  } finally {
    await migration.end();
  }
}

describe.sequential(
  "deadlock, timeout, cancellation, and lock recovery",
  () => {
    let prisma: PrismaClient;

    beforeAll(async () => {
      ({ prisma } = await resetSchemaAndApplyEnforcement());
      const migration = await getMigrationClient({
        requireExplicitMigrationUrl: true,
      });
      try {
        await migration.query(`
        DROP TABLE IF EXISTS public.enforcement_fault_a;
        DROP TABLE IF EXISTS public.enforcement_fault_b;
        CREATE TABLE public.enforcement_fault_a (
          id integer PRIMARY KEY,
          value integer NOT NULL
        );
        CREATE TABLE public.enforcement_fault_b (
          id integer PRIMARY KEY,
          value integer NOT NULL
        );
        INSERT INTO public.enforcement_fault_a VALUES (1, 0);
        INSERT INTO public.enforcement_fault_b VALUES (1, 0);
      `);
      } finally {
        await migration.end();
      }
    }, 300_000);

    afterAll(async () => {
      const migration = await getMigrationClient({
        requireExplicitMigrationUrl: true,
      }).catch(() => null);
      if (migration) {
        await migration.query(
          `DROP TABLE IF EXISTS public.enforcement_fault_a, public.enforcement_fault_b`,
        );
        await migration.end();
      }
      await prisma?.$disconnect();
    });

    it("classifies a conflicting lock, fails safely, and resumes", async () => {
      const fault = await captureConflictingLock();
      expect(fault.kind).toBe("conflicting_lock");
      await assertApplyRecovery(fault);
    });

    it("observes a real two-transaction deadlock and retries boundedly", async () => {
      const fault = await captureDeadlock();
      expect(fault.kind).toBe("deadlock");
      expect(fault.message).toContain("deadlock");
      await assertApplyRecovery(fault);
    });

    it("classifies lock_timeout and retries boundedly", async () => {
      const fault = await captureLockTimeout();
      expect(fault.kind).toBe("lock_timeout");
      await assertApplyRecovery(fault);
    });

    it("classifies statement_timeout and retries boundedly", async () => {
      const fault = await captureStatementTimeout();
      expect(fault.kind).toBe("statement_timeout");
      await assertApplyRecovery(fault);
    });

    it("classifies pg_cancel_backend, fails safely, and resumes", async () => {
      const fault = await captureBackendCancel();
      expect(fault.kind).toBe("backend_cancel");
      await assertApplyRecovery(fault);
    });

    it("classifies advisory-lock contention with measured safety and resumes", async () => {
      const holder = await rawMigrationClient();
      const contender = await getMigrationClient({
        requireExplicitMigrationUrl: true,
      });
      try {
        const held = await holder.query<{ acquired: boolean }>(
          `SELECT pg_try_advisory_lock($1) AS acquired`,
          [TENANT_ENFORCEMENT_ADVISORY_LOCK_KEY],
        );
        expect(held.rows[0].acquired).toBe(true);

        const blocked = await applyEnforcement(contender, { apply: true });
        expect(blocked.ok).toBe(false);
        expect(blocked.applied).toBe(false);
        expect(blocked.steps[0].error).toBe("advisory_lock_unavailable");
        expect(blocked.unsafe_runtime_access).toBe(false);

        await holder.query(`SELECT pg_advisory_unlock($1)`, [
          TENANT_ENFORCEMENT_ADVISORY_LOCK_KEY,
        ]);
        const resumed = await applyEnforcement(contender, { apply: true });
        expect(resumed.ok).toBe(true);
        expect(resumed.unsafe_runtime_access).toBe(false);
        expect((await verifyEnforcement(contender)).ok).toBe(true);
      } finally {
        await holder
          .query(`SELECT pg_advisory_unlock_all()`)
          .catch(() => undefined);
        await holder.end();
        await contender.end();
      }
    });
  },
);
