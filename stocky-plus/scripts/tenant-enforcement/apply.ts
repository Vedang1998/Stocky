/**
 * Low-lock enforcement apply — step-aware, resumable, requires --apply.
 *
 * Security invariant (F-PR3-02):
 *   At every externally observable failure boundary,
 *   runtime must never have unrestricted merchant-table access.
 *
 * Preferred sequence (F-PR3-01/02/12):
 *   roles_prepared (no merchant DML) → constraints → per-table RLS/policies/triggers
 *   → verify definitions → runtime grants → final verify
 *
 * Does not guess ownership. Requires successful preflight before mutation.
 */
import type { Client } from "pg";
import {
  COMPOSITE_FOREIGN_KEYS,
  COMPOSITE_FK_SUPPORTING_INDEXES,
  COMPOSITE_PARENT_KEYS,
  MERCHANT_SQL_TABLES,
  TENANT_ENFORCEMENT_ADVISORY_LOCK_KEY,
  shopIdFkToShopName,
  shopIdNotNullCheckName,
} from "./manifest";
import {
  helperFunctionsSql,
  immutabilityTriggerSql,
  quoteIdent,
  rlsEnableSql,
  rlsPoliciesSql,
} from "./sql";
import { defaultRuntimeRoleName } from "./connection";
import { runPreflight } from "./preflight";
import {
  assertSafeRuntimeAccess,
  provisionRoles,
  revokeMerchantDml,
} from "./roles";
import { fkActionCode } from "./catalog-expect";
import { readFkCatalogDefinition, verifyEnforcement } from "./verify";

export type EnforcementStep = {
  id: string;
  description: string;
  expectedLockMode: string;
  status: "pending" | "completed" | "failed" | "skipped";
  error?: string;
  lockHoldMs?: number;
  attempts?: number;
};

export type EnforcementApplyResult = {
  event: "tenant_enforcement_apply";
  ok: boolean;
  applied: boolean;
  steps: EnforcementStep[];
  preflightOk: boolean;
  maxObservedLockHoldMs: number;
  unsafe_runtime_access: boolean;
  recoveryHint?: string;
  stepDurationsMs?: {
    p50: number;
    p95: number;
    max: number;
  };
};

const MAX_DEADLOCK_RETRIES = 5;

function isRetryableLockError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("deadlock detected") ||
    m.includes("lock timeout") ||
    m.includes("canceling statement due to lock timeout") ||
    m.includes("canceling statement due to statement timeout")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number): number {
  const base = Math.min(2000, 50 * 2 ** attempt);
  const jitter = Math.floor(Math.random() * 50);
  return base + jitter;
}

async function tryAdvisoryLock(client: Client): Promise<{
  acquired: boolean;
  backendPid: number;
}> {
  const pid = await client.query<{ pid: number }>(`SELECT pg_backend_pid() AS pid`);
  const lock = await client.query<{ ok: boolean }>(
    `SELECT pg_try_advisory_lock($1) AS ok`,
    [TENANT_ENFORCEMENT_ADVISORY_LOCK_KEY],
  );
  return {
    acquired: Boolean(lock.rows[0]?.ok),
    backendPid: pid.rows[0].pid,
  };
}

async function releaseAdvisoryLock(client: Client): Promise<void> {
  const res = await client.query<{ ok: boolean }>(
    `SELECT pg_advisory_unlock($1) AS ok`,
    [TENANT_ENFORCEMENT_ADVISORY_LOCK_KEY],
  );
  if (!res.rows[0]?.ok) {
    throw new Error("advisory_unlock_failed");
  }
}

async function indexExists(
  client: Client,
  name: string,
): Promise<{ exists: boolean; valid: boolean; def: string | null }> {
  const res = await client.query<{ indisvalid: boolean; indexdef: string }>(
    `SELECT i.indisvalid, pg_get_indexdef(c.oid) AS indexdef
     FROM pg_class c
     JOIN pg_index i ON i.indexrelid = c.oid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = $1`,
    [name],
  );
  if ((res.rowCount ?? 0) === 0) {
    return { exists: false, valid: false, def: null };
  }
  return {
    exists: true,
    valid: res.rows[0].indisvalid,
    def: res.rows[0].indexdef,
  };
}

async function createUniqueIndexConcurrently(
  client: Client,
  name: string,
  table: string,
  columns: string[],
): Promise<void> {
  const colList = columns.map(quoteIdent).join(", ");
  const existing = await indexExists(client, name);
  if (existing.exists) {
    if (!existing.valid) {
      throw new Error(`index_invalid:${name}`);
    }
    const cols = await client.query<{ attname: string }>(
      `SELECT a.attname
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indexrelid
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
       WHERE c.relname = $1
       ORDER BY array_position(i.indkey, a.attnum)`,
      [name],
    );
    const gotCols = cols.rows.map((r) => r.attname);
    if (
      gotCols.length !== columns.length ||
      gotCols.some((c, i) => c !== columns[i])
    ) {
      throw new Error(
        `index_wrong_definition:${name}:expected:${columns.join(",")}:got:${gotCols.join(",")}`,
      );
    }
    return;
  }

  await client.query(
    `CREATE UNIQUE INDEX CONCURRENTLY ${quoteIdent(name)} ON ${quoteIdent(table)} (${colList})`,
  );
}

async function createIndexConcurrently(
  client: Client,
  name: string,
  table: string,
  columns: string[],
  unique: boolean,
): Promise<void> {
  if (unique) {
    await createUniqueIndexConcurrently(client, name, table, columns);
    return;
  }
  const existing = await indexExists(client, name);
  if (existing.exists) {
    if (!existing.valid) throw new Error(`index_invalid:${name}`);
    return;
  }
  const colList = columns.map(quoteIdent).join(", ");
  await client.query(
    `CREATE INDEX CONCURRENTLY ${quoteIdent(name)} ON ${quoteIdent(table)} (${colList})`,
  );
}

async function constraintExists(
  client: Client,
  name: string,
): Promise<boolean> {
  const res = await client.query(
    `SELECT 1 FROM pg_constraint WHERE conname = $1`,
    [name],
  );
  return (res.rowCount ?? 0) > 0;
}

async function addNotValidNotNullCheck(
  client: Client,
  table: string,
): Promise<void> {
  const name = shopIdNotNullCheckName(table);
  if (await constraintExists(client, name)) {
    const validated = await client.query<{ convalidated: boolean }>(
      `SELECT convalidated FROM pg_constraint WHERE conname = $1`,
      [name],
    );
    if ((validated.rowCount ?? 0) > 0) return;
  }
  await client.query(
    `ALTER TABLE ${quoteIdent(table)}
     ADD CONSTRAINT ${quoteIdent(name)}
     CHECK (${quoteIdent("shopId")} IS NOT NULL) NOT VALID`,
  );
}

async function validateConstraint(client: Client, name: string): Promise<void> {
  const res = await client.query<{ relname: string; convalidated: boolean }>(
    `SELECT t.relname, c.convalidated
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     WHERE c.conname = $1`,
    [name],
  );
  if ((res.rowCount ?? 0) === 0) {
    throw new Error(`constraint_missing:${name}`);
  }
  if (res.rows[0].convalidated) return;
  await client.query(
    `ALTER TABLE ${quoteIdent(res.rows[0].relname)} VALIDATE CONSTRAINT ${quoteIdent(name)}`,
  );
}

async function setShopIdNotNull(client: Client, table: string): Promise<void> {
  const col = await client.query<{ is_nullable: string }>(
    `SELECT is_nullable FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'shopId'`,
    [table],
  );
  if (col.rows[0]?.is_nullable === "NO") return;
  await client.query(
    `ALTER TABLE ${quoteIdent(table)} ALTER COLUMN ${quoteIdent("shopId")} SET NOT NULL`,
  );
}

function fkMatchesSpec(
  got: NonNullable<Awaited<ReturnType<typeof readFkCatalogDefinition>>>,
  expected: {
    childTable: string;
    parentTable: string;
    childColumns: readonly string[];
    parentColumns: readonly string[];
    onDelete: string;
    onUpdate: string;
  },
): boolean {
  return (
    got.childTable === expected.childTable &&
    got.parentTable === expected.parentTable &&
    got.childColumns.length === expected.childColumns.length &&
    got.childColumns.every((c, i) => c === expected.childColumns[i]) &&
    got.parentColumns.length === expected.parentColumns.length &&
    got.parentColumns.every((c, i) => c === expected.parentColumns[i]) &&
    got.onDelete === fkActionCode(expected.onDelete) &&
    got.onUpdate === fkActionCode(expected.onUpdate)
  );
}

async function addShopFk(client: Client, table: string): Promise<void> {
  const name = shopIdFkToShopName(table);
  const expected = {
    childTable: table,
    parentTable: "Shop",
    childColumns: ["shopId"] as const,
    parentColumns: ["id"] as const,
    onDelete: "RESTRICT",
    onUpdate: "NO ACTION",
  };
  const existing = await readFkCatalogDefinition(client, name);
  if (existing) {
    if (!fkMatchesSpec(existing, expected)) {
      throw new Error(
        `fk_wrong_definition:${name}:refuse_silent_accept`,
      );
    }
    return;
  }
  await client.query(
    `ALTER TABLE ${quoteIdent(table)}
     ADD CONSTRAINT ${quoteIdent(name)}
     FOREIGN KEY (${quoteIdent("shopId")}) REFERENCES ${quoteIdent("Shop")}(id)
     ON DELETE RESTRICT ON UPDATE NO ACTION
     NOT VALID`,
  );
}

async function addCompositeFk(
  client: Client,
  fk: (typeof COMPOSITE_FOREIGN_KEYS)[number],
): Promise<void> {
  const existing = await readFkCatalogDefinition(client, fk.name);
  if (existing) {
    if (
      !fkMatchesSpec(existing, {
        childTable: fk.childTable,
        parentTable: fk.parentTable,
        childColumns: fk.childColumns,
        parentColumns: fk.parentColumns,
        onDelete: fk.onDelete,
        onUpdate: fk.onUpdate,
      })
    ) {
      throw new Error(
        `fk_wrong_definition:${fk.name}:refuse_silent_accept`,
      );
    }
    return;
  }
  const childCols = fk.childColumns.map(quoteIdent).join(", ");
  const parentCols = fk.parentColumns.map(quoteIdent).join(", ");
  await client.query(
    `ALTER TABLE ${quoteIdent(fk.childTable)}
     ADD CONSTRAINT ${quoteIdent(fk.name)}
     FOREIGN KEY (${childCols})
     REFERENCES ${quoteIdent(fk.parentTable)} (${parentCols})
     ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}
     NOT VALID`,
  );
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx];
}

export async function planEnforcement(client: Client): Promise<{
  event: "tenant_enforcement_plan";
  steps: EnforcementStep[];
  preflightOk: boolean;
}> {
  const preflight = await runPreflight(client, { mode: "resume" });
  const steps = buildStepList();
  for (const step of steps) {
    step.status = "pending";
  }
  return {
    event: "tenant_enforcement_plan",
    steps,
    preflightOk: preflight.ok,
  };
}

/**
 * Deterministic object/table ordering across all enforcement operations.
 * MERCHANT_SQL_TABLES and COMPOSITE_FOREIGN_KEYS are already stable arrays.
 */
function buildStepList(): EnforcementStep[] {
  const steps: EnforcementStep[] = [
    {
      id: "helpers",
      description: "Create tenant context + immutability helper functions",
      expectedLockMode: "ShareUpdateExclusive (function replace)",
      status: "pending",
    },
    {
      id: "roles_prepared",
      description:
        "Provision restricted runtime role attributes; revoke merchant DML",
      expectedLockMode: "none (catalog)",
      status: "pending",
    },
  ];

  for (const idx of COMPOSITE_FK_SUPPORTING_INDEXES) {
    steps.push({
      id: `index:${idx.name}`,
      description: `Supporting index ${idx.name}`,
      expectedLockMode: "ShareUpdateExclusive (CREATE INDEX CONCURRENTLY)",
      status: "pending",
    });
  }

  for (const key of COMPOSITE_PARENT_KEYS) {
    steps.push({
      id: `composite_key:${key.name}`,
      description: `Unique (${key.columns.join(",")}) on ${key.table}`,
      expectedLockMode: "ShareUpdateExclusive (CREATE UNIQUE INDEX CONCURRENTLY)",
      status: "pending",
    });
  }

  // Deterministic table order for constraints
  for (const table of MERCHANT_SQL_TABLES) {
    steps.push({
      id: `not_null_check:${table}`,
      description: `ADD CHECK shopId IS NOT NULL NOT VALID on ${table}`,
      expectedLockMode: "AccessExclusive (brief metadata)",
      status: "pending",
    });
    steps.push({
      id: `not_null_validate:${table}`,
      description: `VALIDATE NOT NULL check on ${table}`,
      expectedLockMode: "ShareUpdateExclusive",
      status: "pending",
    });
    steps.push({
      id: `not_null_set:${table}`,
      description: `SET shopId NOT NULL on ${table}`,
      expectedLockMode: "AccessExclusive (optimized when check validated)",
      status: "pending",
    });
    steps.push({
      id: `shop_fk:${table}`,
      description: `ADD shopId→Shop FK NOT VALID on ${table}`,
      expectedLockMode: "ShareUpdateExclusive / AccessExclusive (brief)",
      status: "pending",
    });
    steps.push({
      id: `shop_fk_validate:${table}`,
      description: `VALIDATE shopId→Shop FK on ${table}`,
      expectedLockMode: "ShareUpdateExclusive",
      status: "pending",
    });
  }

  // Composite FKs ordered by child then parent name for lock consistency
  const sortedFks = [...COMPOSITE_FOREIGN_KEYS].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const fk of sortedFks) {
    steps.push({
      id: `cfk:${fk.name}`,
      description: `ADD composite FK ${fk.name} NOT VALID`,
      expectedLockMode: "ShareUpdateExclusive / AccessExclusive (brief)",
      status: "pending",
    });
    steps.push({
      id: `cfk_validate:${fk.name}`,
      description: `VALIDATE composite FK ${fk.name}`,
      expectedLockMode: "ShareUpdateExclusive",
      status: "pending",
    });
  }

  // Per-table RLS — never one giant multi-table transaction (F-PR3-12)
  for (const table of MERCHANT_SQL_TABLES) {
    steps.push({
      id: `rls:${table}`,
      description: `ENABLE/FORCE RLS + policies + immutability trigger on ${table}`,
      expectedLockMode: "AccessExclusive (brief per table)",
      status: "pending",
    });
  }

  steps.push({
    id: "definitions_verified",
    description: "Verify exact policy/FK/trigger/constraint definitions",
    expectedLockMode: "none (catalog read)",
    status: "pending",
  });

  steps.push({
    id: "runtime_grants_applied",
    description: "Grant runtime merchant DML after verified RLS",
    expectedLockMode: "none (catalog)",
    status: "pending",
  });

  steps.push({
    id: "final_verified",
    description: "Final enforcement + privilege verification",
    expectedLockMode: "none (catalog read)",
    status: "pending",
  });

  return steps;
}

async function failSafe(
  client: Client,
  steps: EnforcementStep[],
  preflightOk: boolean,
  maxObservedLockHoldMs: number,
  durations: number[],
): Promise<EnforcementApplyResult> {
  // Always revoke merchant DML on failure unless exact RLS is verified.
  try {
    const runtimeRole = defaultRuntimeRoleName();
    const roleExists = await client.query(
      `SELECT 1 FROM pg_roles WHERE rolname = $1`,
      [runtimeRole],
    );
    if ((roleExists.rowCount ?? 0) > 0) {
      const rlsVerify = await verifyEnforcement(client).catch(() => null);
      if (!rlsVerify?.ok) {
        await revokeMerchantDml(client, runtimeRole);
      }
    }
  } catch {
    // Best-effort revoke; still report invariant failure below.
  }

  const safety = await assertSafeRuntimeAccess(client).catch(() => ({
    ok: false,
    unsafe_runtime_access: true,
    detail: ["safety_check_failed"],
  }));

  if (safety.unsafe_runtime_access) {
    try {
      await revokeMerchantDml(client, defaultRuntimeRoleName());
    } catch {
      /* ignore */
    }
  }

  const sorted = [...durations].sort((a, b) => a - b);
  return {
    event: "tenant_enforcement_apply",
    ok: false,
    applied: true,
    steps,
    preflightOk,
    maxObservedLockHoldMs,
    unsafe_runtime_access: safety.unsafe_runtime_access,
    recoveryHint: safety.unsafe_runtime_access
      ? "CRITICAL: revoke runtime merchant DML and re-run apply; do not grant DML until verify passes"
      : "Re-run tenant:enforcement:apply -- --apply; prior verified steps remain; resume preflight accepts partial enforcement",
    stepDurationsMs: {
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      max: percentile(sorted, 100),
    },
  };
}

export async function applyEnforcement(
  client: Client,
  options: { apply: boolean },
): Promise<EnforcementApplyResult> {
  const steps = buildStepList();
  let maxObservedLockHoldMs = 0;
  const durations: number[] = [];

  if (!options.apply) {
    return {
      event: "tenant_enforcement_apply",
      ok: false,
      applied: false,
      steps,
      preflightOk: false,
      maxObservedLockHoldMs: 0,
      unsafe_runtime_access: false,
    };
  }

  let preflight;
  try {
    preflight = await runPreflight(client, { mode: "resume" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      event: "tenant_enforcement_apply",
      ok: false,
      applied: false,
      steps: steps.map((s) => ({
        ...s,
        status: "failed" as const,
        error: `preflight_exception:${message}`,
      })),
      preflightOk: false,
      maxObservedLockHoldMs: 0,
      unsafe_runtime_access: false,
      recoveryHint:
        "Preflight failed with structured exception; fix lock/timeout contention and re-run",
    };
  }

  if (!preflight.ok) {
    return {
      event: "tenant_enforcement_apply",
      ok: false,
      applied: false,
      steps: steps.map((s) => ({
        ...s,
        status: "failed" as const,
        error: `preflight_failed:${[
          ...preflight.globalFailures,
          ...preflight.tables.flatMap((t) =>
            t.failures.map((f) => `${t.table}:${f}`),
          ),
        ].join("|")}`,
      })),
      preflightOk: false,
      maxObservedLockHoldMs: 0,
      unsafe_runtime_access: false,
      recoveryHint: preflight.recoveryHint,
    };
  }

  const lock = await tryAdvisoryLock(client);
  if (!lock.acquired) {
    steps[0].status = "failed";
    steps[0].error = "advisory_lock_unavailable";
    return {
      event: "tenant_enforcement_apply",
      ok: false,
      applied: false,
      steps,
      preflightOk: true,
      maxObservedLockHoldMs: 0,
      unsafe_runtime_access: false,
      recoveryHint: "Another enforcement apply holds the advisory lock; retry later",
    };
  }

  const mark = async (
    id: string,
    fn: () => Promise<void>,
  ): Promise<boolean> => {
    const step = steps.find((s) => s.id === id);
    if (!step) throw new Error(`unknown_step:${id}`);
    let attempt = 0;
    while (true) {
      attempt += 1;
      const started = Date.now();
      try {
        await fn();
        const held = Date.now() - started;
        step.status = "completed";
        step.lockHoldMs = held;
        step.attempts = attempt;
        maxObservedLockHoldMs = Math.max(maxObservedLockHoldMs, held);
        durations.push(held);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const held = Date.now() - started;
        maxObservedLockHoldMs = Math.max(maxObservedLockHoldMs, held);
        durations.push(held);
        if (
          isRetryableLockError(message) &&
          attempt < MAX_DEADLOCK_RETRIES
        ) {
          await sleep(backoffMs(attempt));
          continue;
        }
        step.status = "failed";
        step.error = message;
        step.lockHoldMs = held;
        step.attempts = attempt;
        return false;
      }
    }
  };

  try {
    if (
      !(await mark("helpers", async () => {
        await client.query(helperFunctionsSql());
      }))
    ) {
      return failSafe(client, steps, true, maxObservedLockHoldMs, durations);
    }

    if (
      !(await mark("roles_prepared", async () => {
        const result = await provisionRoles(client, {
          apply: true,
          phase: "prepare",
        });
        if (!result.ok) {
          throw new Error(`roles_prepare_failed:${result.errors.join(",")}`);
        }
      }))
    ) {
      return failSafe(client, steps, true, maxObservedLockHoldMs, durations);
    }

    for (const idx of COMPOSITE_FK_SUPPORTING_INDEXES) {
      if (
        !(await mark(`index:${idx.name}`, async () => {
          await createIndexConcurrently(
            client,
            idx.name,
            idx.table,
            idx.columns,
            idx.unique,
          );
        }))
      ) {
        return failSafe(client, steps, true, maxObservedLockHoldMs, durations);
      }
    }

    for (const key of COMPOSITE_PARENT_KEYS) {
      if (
        !(await mark(`composite_key:${key.name}`, async () => {
          await createUniqueIndexConcurrently(
            client,
            key.name,
            key.table,
            [...key.columns],
          );
        }))
      ) {
        return failSafe(client, steps, true, maxObservedLockHoldMs, durations);
      }
    }

    for (const table of MERCHANT_SQL_TABLES) {
      if (
        !(await mark(`not_null_check:${table}`, async () => {
          await addNotValidNotNullCheck(client, table);
        }))
      ) {
        return failSafe(client, steps, true, maxObservedLockHoldMs, durations);
      }
      if (
        !(await mark(`not_null_validate:${table}`, async () => {
          await validateConstraint(client, shopIdNotNullCheckName(table));
        }))
      ) {
        return failSafe(client, steps, true, maxObservedLockHoldMs, durations);
      }
      if (
        !(await mark(`not_null_set:${table}`, async () => {
          await setShopIdNotNull(client, table);
        }))
      ) {
        return failSafe(client, steps, true, maxObservedLockHoldMs, durations);
      }
      if (
        !(await mark(`shop_fk:${table}`, async () => {
          await addShopFk(client, table);
        }))
      ) {
        return failSafe(client, steps, true, maxObservedLockHoldMs, durations);
      }
      if (
        !(await mark(`shop_fk_validate:${table}`, async () => {
          await validateConstraint(client, shopIdFkToShopName(table));
        }))
      ) {
        return failSafe(client, steps, true, maxObservedLockHoldMs, durations);
      }
    }

    const sortedFks = [...COMPOSITE_FOREIGN_KEYS].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const fk of sortedFks) {
      if (
        !(await mark(`cfk:${fk.name}`, async () => {
          await addCompositeFk(client, fk);
        }))
      ) {
        return failSafe(client, steps, true, maxObservedLockHoldMs, durations);
      }
      if (
        !(await mark(`cfk_validate:${fk.name}`, async () => {
          await validateConstraint(client, fk.name);
        }))
      ) {
        return failSafe(client, steps, true, maxObservedLockHoldMs, durations);
      }
    }

    const runtimeRole = defaultRuntimeRoleName();
    for (const table of MERCHANT_SQL_TABLES) {
      if (
        !(await mark(`rls:${table}`, async () => {
          // Per-table statements — each mark() is its own unit; do not wrap
          // all tables in one multi-statement implicit transaction.
          await client.query(rlsEnableSql(table));
          await client.query(rlsPoliciesSql(table, runtimeRole));
          await client.query(immutabilityTriggerSql(table));
        }))
      ) {
        return failSafe(client, steps, true, maxObservedLockHoldMs, durations);
      }
    }

    if (
      !(await mark("definitions_verified", async () => {
        const verify = await verifyEnforcement(client);
        if (!verify.ok) {
          throw new Error(
            `definitions_verify_failed:${verify.issues.map((i) => i.code).join(",")}`,
          );
        }
      }))
    ) {
      return failSafe(client, steps, true, maxObservedLockHoldMs, durations);
    }

    if (
      !(await mark("runtime_grants_applied", async () => {
        const result = await provisionRoles(client, {
          apply: true,
          phase: "grants",
        });
        if (!result.ok || !result.merchantDmlGranted) {
          throw new Error(
            `runtime_grants_failed:${result.errors.join(",")}`,
          );
        }
      }))
    ) {
      return failSafe(client, steps, true, maxObservedLockHoldMs, durations);
    }

    if (
      !(await mark("final_verified", async () => {
        const verify = await verifyEnforcement(client);
        if (!verify.ok) {
          throw new Error(
            `final_verify_failed:${verify.issues.map((i) => i.code).join(",")}`,
          );
        }
        const safety = await assertSafeRuntimeAccess(client);
        if (safety.unsafe_runtime_access) {
          throw new Error(
            `unsafe_runtime_access:${safety.detail.join(",")}`,
          );
        }
      }))
    ) {
      return failSafe(client, steps, true, maxObservedLockHoldMs, durations);
    }

    const safety = await assertSafeRuntimeAccess(client);
    const sorted = [...durations].sort((a, b) => a - b);
    return {
      event: "tenant_enforcement_apply",
      ok: steps.every((s) => s.status === "completed") && !safety.unsafe_runtime_access,
      applied: true,
      steps,
      preflightOk: true,
      maxObservedLockHoldMs,
      unsafe_runtime_access: safety.unsafe_runtime_access,
      stepDurationsMs: {
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        max: percentile(sorted, 100),
      },
    };
  } finally {
    try {
      await releaseAdvisoryLock(client);
    } catch {
      // Unlock failure is reported via thrown error in release; swallow in finally
      // only if client already closed — apply caller still has step result.
    }
  }
}
