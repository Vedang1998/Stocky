/**
 * PR5 canonical advisory-lock capacity evaluator (F-CLAUDE-PR5C8-01 / F-CLAUDE-PR5IE-03).
 *
 * Arithmetic alone does not prove production safety. R-161 remains OPEN.
 *
 * If either accepted capacity condition cannot safely accommodate even one
 * canonical identity, the configuration is rejected (F-CLAUDE-PR5F1-05).
 * Callers must not process an identity when both conditions say zero.
 */
import {
  PR5_DEFAULT_CANONICAL_IDENTITIES_PER_TRANSACTION,
  PR5_DEFAULT_WORST_CASE_CONCURRENT_CANONICAL_TRANSACTIONS,
} from "./constants";

export type LockCapacitySettings = {
  maxLocksPerTransaction: number;
  maxConnections: number;
  maxPreparedTransactions: number;
};

export type LockCapacityRequest = {
  requestedCanonicalIdentitiesPerTransaction?: number;
  configuredWorstCaseConcurrentCanonicalTransactions?: number;
};

export type LockCapacityEvaluation = {
  maxLocksPerTransaction: number;
  maxConnections: number;
  maxPreparedTransactions: number;
  requestedBatch: number;
  configuredWorstCaseConcurrentCanonicalTransactions: number;
  sharedLockObjectBudget: number;
  conditionACap: number;
  conditionBCap: number;
  requestedAcceptedByConditionA: boolean;
  requestedAcceptedByConditionB: boolean;
  reduced: boolean;
  capacitySufficient: true;
  effectiveCanonicalIdentitiesPerTransaction: number;
};

export class CanonicalLockCapacityInsufficientError extends Error {
  readonly code = "canonical_lock_capacity_insufficient";
  readonly conditionACap: number;
  readonly conditionBCap: number;
  readonly settings: LockCapacitySettings;

  constructor(
    settings: LockCapacitySettings,
    conditionACap: number,
    conditionBCap: number,
  ) {
    super(
      `Canonical lock capacity is insufficient for one identity (conditionACap=${conditionACap}, conditionBCap=${conditionBCap})`,
    );
    this.name = "CanonicalLockCapacityInsufficientError";
    this.conditionACap = conditionACap;
    this.conditionBCap = conditionBCap;
    this.settings = settings;
  }
}

/**
 * Direct/configured evaluator inputs must be fail-closed (R-162).
 * Number.isInteger accepts 2^53, 2^53+2, and Number.MAX_VALUE; those are
 * not safe integers and can emit precision-loss or Infinity diagnostics.
 */
function requireSafeIntAtLeast(name: string, value: number, min: number): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min
  ) {
    throw new Error(
      `${name} must be a safe integer >= ${min} (rejected ${String(value)})`,
    );
  }
  return value;
}

function multiplySafeIntegers(
  a: number,
  b: number,
  name: string,
): number {
  const product = a * b;
  if (!Number.isSafeInteger(product)) {
    throw new Error(`${name} exceeds the safe integer range`);
  }
  return product;
}

export function evaluateCanonicalLockCapacity(
  settings: LockCapacitySettings,
  request: LockCapacityRequest = {},
): LockCapacityEvaluation {
  const maxLocksPerTransaction = requireSafeIntAtLeast(
    "maxLocksPerTransaction",
    settings.maxLocksPerTransaction,
    1,
  );
  const maxConnections = requireSafeIntAtLeast(
    "maxConnections",
    settings.maxConnections,
    1,
  );
  const maxPreparedTransactions = requireSafeIntAtLeast(
    "maxPreparedTransactions",
    settings.maxPreparedTransactions,
    0,
  );
  const requestedBatch = requireSafeIntAtLeast(
    "requestedCanonicalIdentitiesPerTransaction",
    request.requestedCanonicalIdentitiesPerTransaction ??
      PR5_DEFAULT_CANONICAL_IDENTITIES_PER_TRANSACTION,
    1,
  );
  const concurrency = requireSafeIntAtLeast(
    "configuredWorstCaseConcurrentCanonicalTransactions",
    request.configuredWorstCaseConcurrentCanonicalTransactions ??
      PR5_DEFAULT_WORST_CASE_CONCURRENT_CANONICAL_TRANSACTIONS,
    1,
  );

  const connectionSlots = maxConnections + maxPreparedTransactions;
  if (!Number.isSafeInteger(connectionSlots)) {
    throw new Error("connection slot sum exceeds the safe integer range");
  }
  const sharedLockObjectBudget = multiplySafeIntegers(
    maxLocksPerTransaction,
    connectionSlots,
    "sharedLockObjectBudget",
  );
  const conditionACap = Math.floor(maxLocksPerTransaction / 2);
  const conditionBBudget = Math.floor(sharedLockObjectBudget * 0.25);
  if (!Number.isSafeInteger(conditionBBudget) || conditionBBudget < 0) {
    throw new Error("condition B budget is not a safe integer");
  }
  const conditionBCap = Math.floor(conditionBBudget / concurrency);

  if (conditionACap < 1 || conditionBCap < 1) {
    throw new CanonicalLockCapacityInsufficientError(
      {
        maxLocksPerTransaction,
        maxConnections,
        maxPreparedTransactions,
      },
      conditionACap,
      conditionBCap,
    );
  }

  const requestedAcceptedByConditionA = requestedBatch <= conditionACap;
  const requestedAcceptedByConditionB =
    requestedBatch * concurrency <= conditionBBudget;

  const effectiveCanonicalIdentitiesPerTransaction = Math.min(
    requestedBatch,
    conditionACap,
    conditionBCap,
  );

  return {
    maxLocksPerTransaction,
    maxConnections,
    maxPreparedTransactions,
    requestedBatch,
    configuredWorstCaseConcurrentCanonicalTransactions: concurrency,
    sharedLockObjectBudget,
    conditionACap,
    conditionBCap,
    requestedAcceptedByConditionA,
    requestedAcceptedByConditionB,
    reduced: effectiveCanonicalIdentitiesPerTransaction < requestedBatch,
    capacitySufficient: true,
    effectiveCanonicalIdentitiesPerTransaction,
  };
}

function parsePostgresIntSetting(name: string, raw: unknown): number {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error(`${name} was missing from PostgreSQL settings`);
  }
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new Error(`${name} is not a numeric integer: ${trimmed}`);
  }
  const value = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} is not a finite safe integer: ${trimmed}`);
  }
  return value;
}

export async function readPostgresLockCapacitySettings(query: {
  query: (
    sql: string,
  ) => Promise<{ rows: Array<Record<string, string>> }>;
}): Promise<LockCapacitySettings> {
  const result = await query.query(`
    SELECT
      current_setting('max_locks_per_transaction') AS max_locks_per_transaction,
      current_setting('max_connections') AS max_connections,
      current_setting('max_prepared_transactions') AS max_prepared_transactions
  `);
  const row = result.rows[0];
  if (!row) {
    throw new Error("PostgreSQL lock capacity settings were not returned");
  }
  const settings = {
    maxLocksPerTransaction: parsePostgresIntSetting(
      "max_locks_per_transaction",
      row.max_locks_per_transaction,
    ),
    maxConnections: parsePostgresIntSetting(
      "max_connections",
      row.max_connections,
    ),
    maxPreparedTransactions: parsePostgresIntSetting(
      "max_prepared_transactions",
      row.max_prepared_transactions,
    ),
  };
  requireSafeIntAtLeast(
    "max_locks_per_transaction",
    settings.maxLocksPerTransaction,
    1,
  );
  requireSafeIntAtLeast("max_connections", settings.maxConnections, 1);
  requireSafeIntAtLeast(
    "max_prepared_transactions",
    settings.maxPreparedTransactions,
    0,
  );
  return settings;
}
