import { randomUUID } from "node:crypto";
import { allocateCatalogObservationGeneration } from "../../catalog-facts/observation-generation";
import { queryRows, type OrderApplyDb } from "../apply/sql";
import { ORDER_FACTS_DIRECT_LEASE_MS } from "./constants";
import { OrderFactsSyncError } from "./errors";

export type DirectOrderObservationHandle = {
  token: string;
  requestGen: bigint;
  resourceKind: "Order" | "Refund";
  shopifyGid: string;
};

export async function beginDirectOrderObservation(
  db: OrderApplyDb,
  input: {
    shopId: string;
    resourceKind: "Order" | "Refund";
    shopifyGid: string;
    leaseDurationMs?: number;
    durableJobId?: string | null;
    jobAttemptId?: string | null;
    correlationId?: string | null;
  },
): Promise<DirectOrderObservationHandle> {
  const leaseDurationMs = input.leaseDurationMs ?? ORDER_FACTS_DIRECT_LEASE_MS;
  if (
    !Number.isSafeInteger(leaseDurationMs) ||
    leaseDurationMs < 1 ||
    leaseDurationMs > 3_600_000
  ) {
    throw new OrderFactsSyncError(
      "order_observation_lease_duration_invalid",
      "Order observation leaseDurationMs must be 1..3600000",
    );
  }
  const token = randomUUID();
  const requestGen = await allocateCatalogObservationGeneration(db);
  const rows = await queryRows<{ id: string }>(db)`INSERT INTO "OrderFactObservationInFlight" (
       id, "shopId", "resourceKind", "shopifyGid",
       "observationRequestGen", "leaseDurationMs", "leaseExpiresAt",
       "lifecycleState", "accessScopeSnapshot",
       "durableJobId", "jobAttemptId", "correlationId",
       "createdAt", "updatedAt"
     ) VALUES (
       ${token}, ${input.shopId}, ${input.resourceKind}::"OrderResourceKind", ${input.shopifyGid},
       ${requestGen.toString()}::bigint, ${leaseDurationMs}, TIMESTAMPTZ '1970-01-01',
       'ACTIVE', ARRAY[]::text[],
       ${input.durableJobId ?? null}, ${input.jobAttemptId ?? null}, ${input.correlationId ?? null},
       clock_timestamp(), clock_timestamp()
     )
     RETURNING id`;
  if (rows.length !== 1) {
    throw new OrderFactsSyncError(
      "order_observation_insert_failed",
      "OrderFactObservationInFlight INSERT did not return the token",
    );
  }
  return {
    token,
    requestGen,
    resourceKind: input.resourceKind,
    shopifyGid: input.shopifyGid,
  };
}

export async function updateObservationAccessScopes(
  db: OrderApplyDb,
  input: {
    shopId: string;
    token: string;
    requestGen: bigint;
    accessScopeSnapshot: readonly string[];
  },
): Promise<void> {
  const scopesJson = JSON.stringify([...input.accessScopeSnapshot]);
  const rows = await queryRows<{ id: string }>(db)`UPDATE "OrderFactObservationInFlight"
     SET "accessScopeSnapshot" = ARRAY(SELECT jsonb_array_elements_text(${scopesJson}::jsonb)),
         "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${input.shopId}
       AND id = ${input.token}
       AND "lifecycleState" = 'ACTIVE'
       AND "observationResponseGen" IS NULL
       AND "observationRequestGen" = ${input.requestGen.toString()}::bigint
     RETURNING id`;
  if (rows.length !== 1) {
    throw new OrderFactsSyncError(
      "order_observation_scope_update_failed",
      "Failed to persist observation accessScopeSnapshot",
    );
  }
}

export async function allocateResponseGeneration(
  db: OrderApplyDb,
  requestGen: bigint,
): Promise<bigint> {
  const responseGen = await allocateCatalogObservationGeneration(db);
  if (responseGen <= requestGen) {
    throw new OrderFactsSyncError(
      "order_observation_interval_invalid",
      "observationResponseGen must be greater than observationRequestGen",
    );
  }
  return responseGen;
}

export async function abandonActiveObservation(
  db: OrderApplyDb,
  input: {
    shopId: string;
    token: string;
    requestGen: bigint;
    responseGen?: bigint | null;
    failureCode?: string | null;
  },
): Promise<void> {
  await queryRows(db)`UPDATE "OrderFactObservationInFlight"
     SET "lifecycleState" = 'ABANDONED',
         "observationResponseGen" = ${input.responseGen?.toString() ?? null}::bigint,
         "failureCode" = ${input.failureCode ?? null},
         "updatedAt" = clock_timestamp()
     WHERE "shopId" = ${input.shopId}
       AND id = ${input.token}
       AND "lifecycleState" = 'ACTIVE'
       AND "observationRequestGen" = ${input.requestGen.toString()}::bigint`;
}
