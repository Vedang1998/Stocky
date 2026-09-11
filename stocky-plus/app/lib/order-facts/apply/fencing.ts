/**
 * OrderFactObservationInFlight fencing. Lease validity uses PostgreSQL
 * clock_timestamp() only. No Shopify I/O.
 */
import {
  OrderApplyAbandonedTokenError,
  OrderApplyError,
  OrderApplyLeaseInvalidError,
  OrderApplyMissingTokenError,
  OrderApplyRequestGenerationMismatchError,
} from "./errors";
import {
  asBigInt,
  asBigIntOrNull,
  asBool,
  asDate,
  queryRows,
  type OrderApplyDb,
} from "./sql";
import type { OrderApplyIdentity } from "./types";
import { DIAGNOSTIC } from "./types";

export type ObservationRow = {
  id: string;
  lifecycleState: string;
  observationRequestGen: bigint;
  observationResponseGen: bigint | null;
  leaseExpiresAt: Date;
  terminalOutcome: string | null;
};

export async function lockObservationRows(
  db: OrderApplyDb,
  shopId: string,
  identity: OrderApplyIdentity,
): Promise<ObservationRow[]> {
  const rows = await queryRows<{
    id: string;
    lifecycleState: string;
    observationRequestGen: unknown;
    observationResponseGen: unknown;
    leaseExpiresAt: unknown;
    terminalOutcome: string | null;
  }>(db)`SELECT id, "lifecycleState", "observationRequestGen", "observationResponseGen",
            "leaseExpiresAt", "terminalOutcome"
     FROM "OrderFactObservationInFlight"
     WHERE "shopId" = ${shopId}
       AND "resourceKind" = ${identity.resourceKind}::"OrderResourceKind"
       AND "shopifyGid" = ${identity.shopifyGid}
     ORDER BY "observationRequestGen" ASC, id ASC
     FOR UPDATE`;
  return rows.map((row) => ({
    id: String(row.id),
    lifecycleState: String(row.lifecycleState),
    observationRequestGen: asBigInt(
      row.observationRequestGen,
      "observationRequestGen",
    ),
    observationResponseGen: asBigIntOrNull(
      row.observationResponseGen,
      "observationResponseGen",
    ),
    leaseExpiresAt: asDate(row.leaseExpiresAt) ?? new Date(0),
    terminalOutcome: row.terminalOutcome,
  }));
}

export async function fenceDirectObservation(
  db: OrderApplyDb,
  shopId: string,
  token: string,
  identity: OrderApplyIdentity,
  expectedRequestGen: bigint,
): Promise<ObservationRow> {
  if (!token) {
    throw new OrderApplyMissingTokenError();
  }
  const rows = await queryRows<{
    id: string;
    lifecycleState: string;
    observationRequestGen: unknown;
    observationResponseGen: unknown;
    leaseExpiresAt: unknown;
    leaseValid: boolean;
    terminalOutcome: string | null;
  }>(db)`SELECT id, "lifecycleState", "observationRequestGen", "observationResponseGen",
            "leaseExpiresAt", "terminalOutcome",
            (clock_timestamp() < "leaseExpiresAt") AS "leaseValid"
     FROM "OrderFactObservationInFlight"
     WHERE "shopId" = ${shopId}
       AND id = ${token}
       AND "resourceKind" = ${identity.resourceKind}::"OrderResourceKind"
       AND "shopifyGid" = ${identity.shopifyGid}
     FOR UPDATE`;
  if (rows.length === 0) {
    throw new OrderApplyMissingTokenError(
      "Observation token is missing; fail closed",
    );
  }
  if (rows.length !== 1) {
    throw new OrderApplyMissingTokenError(
      "Observation token matched more than one row; fail closed",
    );
  }
  const row = rows[0];
  const mapped: ObservationRow = {
    id: String(row.id),
    lifecycleState: String(row.lifecycleState),
    observationRequestGen: asBigInt(
      row.observationRequestGen,
      "observationRequestGen",
    ),
    observationResponseGen: asBigIntOrNull(
      row.observationResponseGen,
      "observationResponseGen",
    ),
    leaseExpiresAt: asDate(row.leaseExpiresAt) ?? new Date(0),
    terminalOutcome: row.terminalOutcome,
  };
  if (mapped.observationRequestGen !== expectedRequestGen) {
    throw new OrderApplyRequestGenerationMismatchError();
  }
  if (mapped.lifecycleState === "ABANDONED") {
    throw new OrderApplyAbandonedTokenError();
  }
  if (mapped.lifecycleState !== "ACTIVE") {
    throw new OrderApplyLeaseInvalidError(
      `Observation lifecycle ${mapped.lifecycleState} is not ACTIVE`,
    );
  }
  if (mapped.observationResponseGen != null) {
    throw new OrderApplyLeaseInvalidError(
      "ACTIVE observation must remain resultless",
    );
  }
  if (!asBool(row.leaseValid, false)) {
    throw new OrderApplyLeaseInvalidError();
  }
  return mapped;
}

export async function loadExpiredActiveResultlessBlockers(
  db: OrderApplyDb,
  shopId: string,
  identity: OrderApplyIdentity,
  options: {
    currentToken?: string | null;
    maxRequestGen?: bigint | null;
  } = {},
): Promise<ObservationRow[]> {
  const currentToken = options.currentToken ?? null;
  const maxRequestGen = options.maxRequestGen ?? null;
  const rows = await queryRows<{
    id: string;
    lifecycleState: string;
    observationRequestGen: unknown;
    observationResponseGen: unknown;
    leaseExpiresAt: unknown;
    terminalOutcome: string | null;
  }>(db)`SELECT id, "lifecycleState", "observationRequestGen", "observationResponseGen",
            "leaseExpiresAt", "terminalOutcome"
     FROM "OrderFactObservationInFlight"
     WHERE "shopId" = ${shopId}
       AND "resourceKind" = ${identity.resourceKind}::"OrderResourceKind"
       AND "shopifyGid" = ${identity.shopifyGid}
       AND "lifecycleState" = 'ACTIVE'
       AND "observationResponseGen" IS NULL
       AND clock_timestamp() >= "leaseExpiresAt"
       AND (${currentToken}::text IS NULL OR id <> ${currentToken})
       AND (${maxRequestGen == null ? null : maxRequestGen.toString()}::bigint IS NULL
            OR "observationRequestGen" <= ${maxRequestGen == null ? null : maxRequestGen.toString()}::bigint)
     ORDER BY "observationRequestGen" ASC, id ASC`;
  return rows.map((row) => ({
    id: String(row.id),
    lifecycleState: String(row.lifecycleState),
    observationRequestGen: asBigInt(
      row.observationRequestGen,
      "observationRequestGen",
    ),
    observationResponseGen: asBigIntOrNull(
      row.observationResponseGen,
      "observationResponseGen",
    ),
    leaseExpiresAt: asDate(row.leaseExpiresAt) ?? new Date(0),
    terminalOutcome: row.terminalOutcome,
  }));
}

async function abandonExpiredResultlessRow(
  db: OrderApplyDb,
  shopId: string,
  rowId: string,
): Promise<string | null> {
  const updated = await queryRows<{ id: string }>(db)`UPDATE "OrderFactObservationInFlight"
     SET "lifecycleState" = 'ABANDONED',
         "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId}
       AND id = ${rowId}
       AND "lifecycleState" = 'ACTIVE'
       AND "observationResponseGen" IS NULL
       AND clock_timestamp() >= "leaseExpiresAt"
     RETURNING id`;
  return updated[0]?.id ? String(updated[0].id) : null;
}

export async function abandonExpiredResultlessRows(
  db: OrderApplyDb,
  shopId: string,
  rows: ObservationRow[],
): Promise<string[]> {
  const abandoned: string[] = [];
  for (const row of rows) {
    const abandonedId = await abandonExpiredResultlessRow(db, shopId, row.id);
    if (abandonedId) abandoned.push(abandonedId);
  }
  return abandoned;
}

export async function loadActiveUnexpiredBlockers(
  db: OrderApplyDb,
  shopId: string,
  identity: OrderApplyIdentity,
  currentToken: string | null,
  currentInterval: { requestGen: bigint; responseGen: bigint },
): Promise<ObservationRow[]> {
  const rows = await queryRows<{
    id: string;
    lifecycleState: string;
    observationRequestGen: unknown;
    observationResponseGen: unknown;
    leaseExpiresAt: unknown;
    terminalOutcome: string | null;
  }>(db)`SELECT id, "lifecycleState", "observationRequestGen", "observationResponseGen",
            "leaseExpiresAt", "terminalOutcome"
     FROM "OrderFactObservationInFlight"
     WHERE "shopId" = ${shopId}
       AND "resourceKind" = ${identity.resourceKind}::"OrderResourceKind"
       AND "shopifyGid" = ${identity.shopifyGid}
       AND "lifecycleState" = 'ACTIVE'
       AND "observationResponseGen" IS NULL
       AND clock_timestamp() < "leaseExpiresAt"
       AND (${currentToken}::text IS NULL OR id <> ${currentToken})
       AND "observationRequestGen" <= ${currentInterval.requestGen.toString()}::bigint
     ORDER BY "observationRequestGen" ASC, id ASC`;
  return rows.map((row) => ({
    id: String(row.id),
    lifecycleState: String(row.lifecycleState),
    observationRequestGen: asBigInt(
      row.observationRequestGen,
      "observationRequestGen",
    ),
    observationResponseGen: asBigIntOrNull(
      row.observationResponseGen,
      "observationResponseGen",
    ),
    leaseExpiresAt: asDate(row.leaseExpiresAt) ?? new Date(0),
    terminalOutcome: row.terminalOutcome,
  }));
}

export async function loadActiveUnexpiredBlockersForFullSync(
  db: OrderApplyDb,
  shopId: string,
  identity: OrderApplyIdentity,
): Promise<ObservationRow[]> {
  const rows = await queryRows<{
    id: string;
    lifecycleState: string;
    observationRequestGen: unknown;
    observationResponseGen: unknown;
    leaseExpiresAt: unknown;
    terminalOutcome: string | null;
  }>(db)`SELECT id, "lifecycleState", "observationRequestGen", "observationResponseGen",
            "leaseExpiresAt", "terminalOutcome"
     FROM "OrderFactObservationInFlight"
     WHERE "shopId" = ${shopId}
       AND "resourceKind" = ${identity.resourceKind}::"OrderResourceKind"
       AND "shopifyGid" = ${identity.shopifyGid}
       AND "lifecycleState" = 'ACTIVE'
       AND "observationResponseGen" IS NULL
       AND clock_timestamp() < "leaseExpiresAt"
     ORDER BY "observationRequestGen" ASC, id ASC`;
  return rows.map((row) => ({
    id: String(row.id),
    lifecycleState: String(row.lifecycleState),
    observationRequestGen: asBigInt(
      row.observationRequestGen,
      "observationRequestGen",
    ),
    observationResponseGen: asBigIntOrNull(
      row.observationResponseGen,
      "observationResponseGen",
    ),
    leaseExpiresAt: asDate(row.leaseExpiresAt) ?? new Date(0),
    terminalOutcome: row.terminalOutcome,
  }));
}

export async function loadCompletedOverlappingIntervals(
  db: OrderApplyDb,
  shopId: string,
  identity: OrderApplyIdentity,
  currentToken: string | null,
  currentInterval: { requestGen: bigint; responseGen: bigint },
): Promise<Array<{ requestGen: bigint; responseGen: bigint }>> {
  const rows = await queryRows<{
    observationRequestGen: unknown;
    observationResponseGen: unknown;
  }>(db)`SELECT "observationRequestGen", "observationResponseGen"
     FROM "OrderFactObservationInFlight"
     WHERE "shopId" = ${shopId}
       AND "resourceKind" = ${identity.resourceKind}::"OrderResourceKind"
       AND "shopifyGid" = ${identity.shopifyGid}
       AND "lifecycleState" = 'COMPLETED'
       AND "observationResponseGen" IS NOT NULL
       AND (${currentToken}::text IS NULL OR id <> ${currentToken})
       AND "observationRequestGen" <= ${currentInterval.responseGen.toString()}::bigint
       AND ${currentInterval.requestGen.toString()}::bigint <= "observationResponseGen"`;
  return rows.map((row) => ({
    requestGen: asBigInt(row.observationRequestGen, "observationRequestGen"),
    responseGen: asBigInt(row.observationResponseGen, "observationResponseGen"),
  }));
}

export async function completeObservation(
  db: OrderApplyDb,
  shopId: string,
  token: string,
  expectedRequestGen: bigint,
  responseGen: bigint,
  terminalOutcome: string | null = null,
): Promise<void> {
  if (responseGen <= expectedRequestGen) {
    throw new OrderApplyError(
      "order_apply_interval_invalid",
      "observationResponseGen must be greater than the durable observationRequestGen",
    );
  }
  const rows = await queryRows<{ id: string }>(db)`UPDATE "OrderFactObservationInFlight"
     SET "lifecycleState" = 'COMPLETED',
         "observationResponseGen" = ${responseGen.toString()}::bigint,
         "terminalOutcome" = ${terminalOutcome},
         "failureCode" = ${terminalOutcome === DIAGNOSTIC.SNAPSHOT_INCOMPLETE ? DIAGNOSTIC.SNAPSHOT_INCOMPLETE : null},
         "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId}
       AND id = ${token}
       AND "lifecycleState" = 'ACTIVE'
       AND "observationResponseGen" IS NULL
       AND "observationRequestGen" = ${expectedRequestGen.toString()}::bigint
       AND ${responseGen.toString()}::bigint > "observationRequestGen"
       AND clock_timestamp() < "leaseExpiresAt"
     RETURNING id`;
  if (rows.length !== 1) {
    throw new OrderApplyLeaseInvalidError(
      "Final observation completion fence failed",
    );
  }
}

export async function abandonOwnExpiredObservation(
  db: OrderApplyDb,
  shopId: string,
  token: string,
  expectedRequestGen: bigint,
  responseGen: bigint | null,
): Promise<void> {
  await queryRows(db)`UPDATE "OrderFactObservationInFlight"
     SET "lifecycleState" = 'ABANDONED',
         "observationResponseGen" = ${responseGen?.toString() ?? null}::bigint,
         "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${shopId}
       AND id = ${token}
       AND "lifecycleState" = 'ACTIVE'
       AND "observationRequestGen" = ${expectedRequestGen.toString()}::bigint`;
}

export async function persistIncompleteObservation(
  db: OrderApplyDb,
  shopId: string,
  token: string,
  expectedRequestGen: bigint,
  responseGen: bigint,
): Promise<void> {
  await completeObservation(
    db,
    shopId,
    token,
    expectedRequestGen,
    responseGen,
    DIAGNOSTIC.SNAPSHOT_INCOMPLETE,
  );
}
