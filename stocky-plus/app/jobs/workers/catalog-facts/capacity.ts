import { DEFAULT_DISPATCH_BATCH_SIZE } from "../../../sync/dispatcher.server";
import { getControlPlanePrisma } from "../../../sync/control-plane-db.server";
import { CANONICAL_WRITER_QUEUE_CONCURRENCY_SUM } from "../../worker-concurrency";
import {
  evaluateCanonicalLockCapacity,
  PR5_DEFAULT_CANONICAL_IDENTITIES_PER_TRANSACTION,
  type LockCapacityEvaluation,
} from "../../../lib/catalog-facts";

function positiveSafeInteger(name: string, value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^[0-9]+$/.test(value)
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive safe integer`);
  }
  return parsed;
}

export function deriveCanonicalWriterConcurrency(input: {
  dispatcherProcessCount: number;
  dispatchBatchSize: number;
  aggregateWorkerConcurrency: number;
}): number {
  const processes = positiveSafeInteger(
    "STOCKY_DISPATCHER_PROCESS_COUNT",
    input.dispatcherProcessCount,
  );
  const batch = positiveSafeInteger(
    "STOCKY_DISPATCH_BATCH_SIZE",
    input.dispatchBatchSize,
  );
  const workers = positiveSafeInteger(
    "aggregate canonical-writer worker concurrency",
    input.aggregateWorkerConcurrency,
  );
  const derived = processes * Math.max(batch, workers);
  if (!Number.isSafeInteger(derived)) {
    throw new Error("canonical writer concurrency exceeds safe integer range");
  }
  return derived;
}

export function readCanonicalWriterConfig(
  env: NodeJS.ProcessEnv = process.env,
): {
  requestedCanonicalIdentitiesPerTransaction: number;
  configuredWorstCaseConcurrentCanonicalTransactions: number;
  dispatcherProcessCount: number;
  dispatchBatchSize: number;
  aggregateWorkerConcurrency: number;
} {
  const dispatcherProcessCount = positiveSafeInteger(
    "STOCKY_DISPATCHER_PROCESS_COUNT",
    env.STOCKY_DISPATCHER_PROCESS_COUNT,
  );
  const dispatchBatchSize = positiveSafeInteger(
    "STOCKY_DISPATCH_BATCH_SIZE",
    env.STOCKY_DISPATCH_BATCH_SIZE ?? DEFAULT_DISPATCH_BATCH_SIZE,
  );
  const aggregateWorkerConcurrency = positiveSafeInteger(
    "aggregate canonical-writer worker concurrency",
    CANONICAL_WRITER_QUEUE_CONCURRENCY_SUM,
  );
  const requestedCanonicalIdentitiesPerTransaction = positiveSafeInteger(
    "STOCKY_CANONICAL_IDENTITIES_PER_TRANSACTION",
    env.STOCKY_CANONICAL_IDENTITIES_PER_TRANSACTION ??
      PR5_DEFAULT_CANONICAL_IDENTITIES_PER_TRANSACTION,
  );
  return {
    requestedCanonicalIdentitiesPerTransaction,
    configuredWorstCaseConcurrentCanonicalTransactions:
      deriveCanonicalWriterConcurrency({
        dispatcherProcessCount,
        dispatchBatchSize,
        aggregateWorkerConcurrency,
      }),
    dispatcherProcessCount,
    dispatchBatchSize,
    aggregateWorkerConcurrency,
  };
}

export async function assertCanonicalWriterCapacityAtStartup(
  env: NodeJS.ProcessEnv = process.env,
): Promise<LockCapacityEvaluation> {
  const config = readCanonicalWriterConfig(env);
  const prisma = getControlPlanePrisma();
  const rows = await prisma.$queryRaw<
    Array<{
      max_locks_per_transaction: string;
      max_connections: string;
      max_prepared_transactions: string;
    }>
  >`
    SELECT
      current_setting('max_locks_per_transaction') AS max_locks_per_transaction,
      current_setting('max_connections') AS max_connections,
      current_setting('max_prepared_transactions') AS max_prepared_transactions
  `;
  const row = rows[0];
  if (!row) throw new Error("canonical capacity settings unavailable");
  return evaluateCanonicalLockCapacity(
    {
      maxLocksPerTransaction: Number(row.max_locks_per_transaction),
      maxConnections: Number(row.max_connections),
      maxPreparedTransactions: Number(row.max_prepared_transactions),
    },
    {
      requestedCanonicalIdentitiesPerTransaction:
        config.requestedCanonicalIdentitiesPerTransaction,
      configuredWorstCaseConcurrentCanonicalTransactions:
        config.configuredWorstCaseConcurrentCanonicalTransactions,
    },
  );
}
