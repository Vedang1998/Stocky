/**
 * Low-lock enforcement apply — checkpointed, idempotent, requires --apply.
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
  compositeKeyName,
  shopIdFkToShopName,
  shopIdNotNullCheckName,
} from "./manifest";
import {
  allMerchantRlsSql,
  helperFunctionsSql,
  quoteIdent,
} from "./sql";
import { defaultRuntimeRoleName } from "./connection";
import { runPreflight } from "./preflight";
import { provisionRoles } from "./roles";

export type EnforcementStep = {
  id: string;
  description: string;
  expectedLockMode: string;
  status: "pending" | "completed" | "failed" | "skipped";
  error?: string;
  lockHoldMs?: number;
};

export type EnforcementApplyResult = {
  event: "tenant_enforcement_apply";
  ok: boolean;
  applied: boolean;
  steps: EnforcementStep[];
  preflightOk: boolean;
  maxObservedLockHoldMs: number;
};

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
  await client.query(`SELECT pg_advisory_unlock($1)`, [
    TENANT_ENFORCEMENT_ADVISORY_LOCK_KEY,
  ]);
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

function normalizeDef(def: string): string {
  return def.trim().replace(/\s+/g, " ").toLowerCase();
}

async function createUniqueIndexConcurrently(
  client: Client,
  name: string,
  table: string,
  columns: string[],
): Promise<void> {
  const colList = columns.map(quoteIdent).join(", ");
  const expected = normalizeDef(
    `CREATE UNIQUE INDEX ${name} ON public.${table} USING btree (${columns.join(", ")})`,
  );
  const existing = await indexExists(client, name);
  if (existing.exists) {
    if (!existing.valid) {
      throw new Error(`index_invalid:${name}`);
    }
    const got = normalizeDef(existing.def ?? "");
    // Compare loosely on column order / unique / table
    if (
      !got.includes("unique") ||
      !got.includes(`on public.${table.toLowerCase()}`) &&
        !got.includes(`on public."${table.toLowerCase()}"`) &&
        !got.includes(`on public."${table}"`)
    ) {
      // Fall through to column check via pg catalog
    }
    const cols = await client.query<{ attname: string; attnum: number }>(
      `SELECT a.attname, a.attnum
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
  void expected;
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
  if (await constraintExists(client, name)) return;
  await client.query(
    `ALTER TABLE ${quoteIdent(table)}
     ADD CONSTRAINT ${quoteIdent(name)}
     CHECK (${quoteIdent("shopId")} IS NOT NULL) NOT VALID`,
  );
}

async function validateConstraint(client: Client, name: string): Promise<void> {
  // Find table for constraint
  const res = await client.query<{ relname: string }>(
    `SELECT t.relname
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     WHERE c.conname = $1`,
    [name],
  );
  if ((res.rowCount ?? 0) === 0) {
    throw new Error(`constraint_missing:${name}`);
  }
  await client.query(
    `ALTER TABLE ${quoteIdent(res.rows[0].relname)} VALIDATE CONSTRAINT ${quoteIdent(name)}`,
  );
}

async function setShopIdNotNull(client: Client, table: string): Promise<void> {
  // After validated CHECK (shopId IS NOT NULL), SET NOT NULL is optimized
  // in modern PostgreSQL (avoids full rewrite when check is validated).
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

async function addShopFk(client: Client, table: string): Promise<void> {
  const name = shopIdFkToShopName(table);
  if (await constraintExists(client, name)) return;
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
  if (await constraintExists(client, fk.name)) return;
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

export async function planEnforcement(client: Client): Promise<{
  event: "tenant_enforcement_plan";
  steps: EnforcementStep[];
  preflightOk: boolean;
}> {
  const preflight = await runPreflight(client);
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

function buildStepList(): EnforcementStep[] {
  const steps: EnforcementStep[] = [
    {
      id: "helpers",
      description: "Create tenant context + immutability helper functions",
      expectedLockMode: "ShareUpdateExclusive (function replace)",
      status: "pending",
    },
    {
      id: "roles",
      description: "Provision restricted runtime role and grants",
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

  for (const fk of COMPOSITE_FOREIGN_KEYS) {
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

  steps.push({
    id: "rls_triggers",
    description: "ENABLE/FORCE RLS, policies, immutability triggers",
    expectedLockMode: "AccessExclusive (brief per table for ENABLE)",
    status: "pending",
  });

  return steps;
}

export async function applyEnforcement(
  client: Client,
  options: { apply: boolean },
): Promise<EnforcementApplyResult> {
  const steps = buildStepList();
  let maxObservedLockHoldMs = 0;

  if (!options.apply) {
    return {
      event: "tenant_enforcement_apply",
      ok: false,
      applied: false,
      steps,
      preflightOk: false,
      maxObservedLockHoldMs: 0,
    };
  }

  const preflight = await runPreflight(client);
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
    };
  }

  const mark = async (
    id: string,
    fn: () => Promise<void>,
  ): Promise<boolean> => {
    const step = steps.find((s) => s.id === id);
    if (!step) throw new Error(`unknown_step:${id}`);
    const started = Date.now();
    try {
      await fn();
      step.status = "completed";
      step.lockHoldMs = Date.now() - started;
      maxObservedLockHoldMs = Math.max(maxObservedLockHoldMs, step.lockHoldMs);
      return true;
    } catch (err) {
      step.status = "failed";
      step.error = err instanceof Error ? err.message : String(err);
      step.lockHoldMs = Date.now() - started;
      maxObservedLockHoldMs = Math.max(maxObservedLockHoldMs, step.lockHoldMs);
      return false;
    }
  };

  try {
    if (!(await mark("helpers", async () => {
      await client.query(helperFunctionsSql());
    }))) {
      return failResult(steps, true, maxObservedLockHoldMs);
    }

    if (!(await mark("roles", async () => {
      const result = await provisionRoles(client, { apply: true });
      if (!result.ok) {
        throw new Error(`roles_provision_failed:${result.errors.join(",")}`);
      }
    }))) {
      return failResult(steps, true, maxObservedLockHoldMs);
    }

    for (const idx of COMPOSITE_FK_SUPPORTING_INDEXES) {
      if (!(await mark(`index:${idx.name}`, async () => {
        await createIndexConcurrently(
          client,
          idx.name,
          idx.table,
          idx.columns,
          idx.unique,
        );
      }))) {
        return failResult(steps, true, maxObservedLockHoldMs);
      }
    }

    for (const key of COMPOSITE_PARENT_KEYS) {
      if (!(await mark(`composite_key:${key.name}`, async () => {
        // PR1 may already have created some — exact verify inside helper
        await createUniqueIndexConcurrently(
          client,
          key.name,
          key.table,
          [...key.columns],
        );
        // Promote unique index to constraint when missing as constraint
        const hasConstraint = await constraintExists(client, key.name);
        if (!hasConstraint) {
          // Unique index with same name can serve as constraint target for FKs
          // in PostgreSQL when it's a unique index — FKs can reference unique indexes.
          // Optionally add PRIMARY/UNIQUE constraint — not required if unique index exists.
          void compositeKeyName;
        }
      }))) {
        return failResult(steps, true, maxObservedLockHoldMs);
      }
    }

    for (const table of MERCHANT_SQL_TABLES) {
      if (!(await mark(`not_null_check:${table}`, async () => {
        await addNotValidNotNullCheck(client, table);
      }))) {
        return failResult(steps, true, maxObservedLockHoldMs);
      }
      if (!(await mark(`not_null_validate:${table}`, async () => {
        await validateConstraint(client, shopIdNotNullCheckName(table));
      }))) {
        return failResult(steps, true, maxObservedLockHoldMs);
      }
      if (!(await mark(`not_null_set:${table}`, async () => {
        await setShopIdNotNull(client, table);
      }))) {
        return failResult(steps, true, maxObservedLockHoldMs);
      }
      if (!(await mark(`shop_fk:${table}`, async () => {
        await addShopFk(client, table);
      }))) {
        return failResult(steps, true, maxObservedLockHoldMs);
      }
      if (!(await mark(`shop_fk_validate:${table}`, async () => {
        await validateConstraint(client, shopIdFkToShopName(table));
      }))) {
        return failResult(steps, true, maxObservedLockHoldMs);
      }
    }

    for (const fk of COMPOSITE_FOREIGN_KEYS) {
      if (!(await mark(`cfk:${fk.name}`, async () => {
        await addCompositeFk(client, fk);
      }))) {
        return failResult(steps, true, maxObservedLockHoldMs);
      }
      if (!(await mark(`cfk_validate:${fk.name}`, async () => {
        await validateConstraint(client, fk.name);
      }))) {
        return failResult(steps, true, maxObservedLockHoldMs);
      }
    }

    if (!(await mark("rls_triggers", async () => {
      const runtimeRole = defaultRuntimeRoleName();
      await client.query(allMerchantRlsSql(runtimeRole));
    }))) {
      return failResult(steps, true, maxObservedLockHoldMs);
    }

    return {
      event: "tenant_enforcement_apply",
      ok: steps.every((s) => s.status === "completed"),
      applied: true,
      steps,
      preflightOk: true,
      maxObservedLockHoldMs,
    };
  } finally {
    await releaseAdvisoryLock(client);
  }
}

function failResult(
  steps: EnforcementStep[],
  preflightOk: boolean,
  maxObservedLockHoldMs: number,
): EnforcementApplyResult {
  return {
    event: "tenant_enforcement_apply",
    ok: false,
    applied: true,
    steps,
    preflightOk,
    maxObservedLockHoldMs,
  };
}
