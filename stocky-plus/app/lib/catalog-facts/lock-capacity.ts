/**
 * PR5 canonical advisory-lock capacity evaluator (F-CLAUDE-PR5C8-01 / F-CLAUDE-PR5IE-03).
 *
 * Arithmetic alone does not prove production safety. R-161 remains OPEN.
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
  effectiveCanonicalIdentitiesPerTransaction: number;
};

function requirePositiveInt(name: string, value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

function requirePositiveBatch(name: string, value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be an integer >= 1`);
  }
  return value;
}

export function evaluateCanonicalLockCapacity(
  settings: LockCapacitySettings,
  request: LockCapacityRequest = {},
): LockCapacityEvaluation {
  const maxLocksPerTransaction = requirePositiveInt(
    "maxLocksPerTransaction",
    settings.maxLocksPerTransaction,
  );
  const maxConnections = requirePositiveInt(
    "maxConnections",
    settings.maxConnections,
  );
  const maxPreparedTransactions = requirePositiveInt(
    "maxPreparedTransactions",
    settings.maxPreparedTransactions,
  );
  const requestedBatch = requirePositiveBatch(
    "requestedCanonicalIdentitiesPerTransaction",
    request.requestedCanonicalIdentitiesPerTransaction ??
      PR5_DEFAULT_CANONICAL_IDENTITIES_PER_TRANSACTION,
  );
  const concurrency = requirePositiveBatch(
    "configuredWorstCaseConcurrentCanonicalTransactions",
    request.configuredWorstCaseConcurrentCanonicalTransactions ??
      PR5_DEFAULT_WORST_CASE_CONCURRENT_CANONICAL_TRANSACTIONS,
  );

  const sharedLockObjectBudget =
    maxLocksPerTransaction * (maxConnections + maxPreparedTransactions);
  const conditionACap = Math.floor(maxLocksPerTransaction / 2);
  const conditionBBudget = Math.floor(sharedLockObjectBudget * 0.25);
  const conditionBCap = Math.floor(conditionBBudget / concurrency);

  const requestedAcceptedByConditionA = requestedBatch <= conditionACap;
  const requestedAcceptedByConditionB =
    requestedBatch * concurrency <= conditionBBudget;

  const uncappedEffective = Math.min(
    requestedBatch,
    conditionACap,
    conditionBCap,
  );
  // Never automatically raise the requested batch. Never reduce below one identity.
  const effectiveCanonicalIdentitiesPerTransaction = Math.max(
    1,
    Number.isFinite(uncappedEffective) ? uncappedEffective : 1,
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
    effectiveCanonicalIdentitiesPerTransaction,
  };
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
  return {
    maxLocksPerTransaction: Number(row.max_locks_per_transaction),
    maxConnections: Number(row.max_connections),
    maxPreparedTransactions: Number(row.max_prepared_transactions),
  };
}
