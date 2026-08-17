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

function requireIntAtLeast(name: string, value: number, min: number): number {
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} must be an integer >= ${min}`);
  }
  return value;
}

export function evaluateCanonicalLockCapacity(
  settings: LockCapacitySettings,
  request: LockCapacityRequest = {},
): LockCapacityEvaluation {
  const maxLocksPerTransaction = requireIntAtLeast(
    "maxLocksPerTransaction",
    settings.maxLocksPerTransaction,
    1,
  );
  const maxConnections = requireIntAtLeast(
    "maxConnections",
    settings.maxConnections,
    1,
  );
  const maxPreparedTransactions = requireIntAtLeast(
    "maxPreparedTransactions",
    settings.maxPreparedTransactions,
    0,
  );
  const requestedBatch = requireIntAtLeast(
    "requestedCanonicalIdentitiesPerTransaction",
    request.requestedCanonicalIdentitiesPerTransaction ??
      PR5_DEFAULT_CANONICAL_IDENTITIES_PER_TRANSACTION,
    1,
  );
  const concurrency = requireIntAtLeast(
    "configuredWorstCaseConcurrentCanonicalTransactions",
    request.configuredWorstCaseConcurrentCanonicalTransactions ??
      PR5_DEFAULT_WORST_CASE_CONCURRENT_CANONICAL_TRANSACTIONS,
    1,
  );

  const sharedLockObjectBudget =
    maxLocksPerTransaction * (maxConnections + maxPreparedTransactions);
  const conditionACap = Math.floor(maxLocksPerTransaction / 2);
  const conditionBBudget = Math.floor(sharedLockObjectBudget * 0.25);
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
  requireIntAtLeast(
    "max_locks_per_transaction",
    settings.maxLocksPerTransaction,
    1,
  );
  requireIntAtLeast("max_connections", settings.maxConnections, 1);
  requireIntAtLeast(
    "max_prepared_transactions",
    settings.maxPreparedTransactions,
    0,
  );
  return settings;
}
