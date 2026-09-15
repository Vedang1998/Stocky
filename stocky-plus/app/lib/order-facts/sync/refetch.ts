import {
  readCurrentAppInstallationAccessScopes,
  readOrderFact,
  readRefundFact,
  readShopTimezoneCurrency,
  type OrderAdminReadContext,
  type OrderReadResult,
  type OrderFactSnapshot,
  type RefundRead,
} from "../admin-read";
import { scopesGrantReadAllOrders } from "../apply/existence";
import type { DirectOrderObservation } from "../apply/types";
import type { OrderSourceKind } from "../types";
import { adjudicateNullObserved } from "./existence-adjudication";
import { mapBOrderReadResult, mapBRefundReadResult } from "./mapper";
import { persistShopTimezoneCurrencyValues } from "./shop-metadata";
import { loadStoredOrderFactExistence } from "./stored-fact";
import type { MapContext, MapOutcome } from "./types";
import type { OrderApplyDb } from "../apply/sql";
import {
  allocateResponseGeneration,
  type DirectOrderObservationHandle,
  updateObservationAccessScopes,
} from "./observations";
import { OrderFactsScopeError, OrderFactsSyncError } from "./errors";

export async function readGrantedAccessScopes(
  context: OrderAdminReadContext,
): Promise<readonly string[]> {
  const result = await readCurrentAppInstallationAccessScopes(context);
  if (result.status !== "complete") {
    throw new OrderFactsScopeError(
      `Granted-scope query ${result.status}: ${"reason" in result ? result.reason : "unknown"}`,
    );
  }
  return result.value.handles;
}

export async function readShopTimezoneCurrencyOrThrow(
  context: OrderAdminReadContext,
): Promise<{ ianaTimezone: string; currencyCode: string }> {
  const read = await readShopTimezoneCurrency(context);
  if (read.status !== "complete") {
    throw new OrderFactsSyncError(
      "order_facts_shop_metadata_incomplete",
      `Shop timezone/currency read ${read.status}: ${"reason" in read ? read.reason : "unknown"}`,
    );
  }
  return {
    ianaTimezone: read.value.ianaTimezone,
    currencyCode: read.value.currencyCode,
  };
}

export async function persistObservationScopesAndShopMetadata(input: {
  db: OrderApplyDb;
  shopId: string;
  handle: DirectOrderObservationHandle;
  scopes: readonly string[];
  shopMetadata: { ianaTimezone: string; currencyCode: string };
}): Promise<void> {
  await updateObservationAccessScopes(input.db, {
    shopId: input.shopId,
    token: input.handle.token,
    requestGen: input.handle.requestGen,
    accessScopeSnapshot: input.scopes,
  });
  await persistShopTimezoneCurrencyValues(
    input.db,
    input.shopId,
    input.shopMetadata,
  );
}

export async function mapOrderReadToObservation(input: {
  db: OrderApplyDb;
  shopId: string;
  handle: DirectOrderObservationHandle;
  read: OrderReadResult<OrderFactSnapshot>;
  scopes: readonly string[];
  sourceKind: OrderSourceKind;
  observedAt: Date;
  deleteWebhook?: boolean;
}): Promise<
  | { status: "observation"; observation: DirectOrderObservation }
  | Extract<
      MapOutcome,
      { status: "incomplete" | "failure" | "blocked" | "noop" }
    >
> {
  const stored = await loadStoredOrderFactExistence(
    input.db,
    input.shopId,
    input.handle.shopifyGid,
  );
  const responseGen = await allocateResponseGeneration(
    input.db,
    input.handle.requestGen,
  );
  const ctx: MapContext = {
    shopId: input.shopId,
    observationToken: input.handle.token,
    observationRequestGen: input.handle.requestGen,
    observationResponseGen: responseGen,
    existenceObservedAt: input.observedAt,
    accessScopeSnapshot: input.scopes,
    lastConfirmedAccessScopes: stored?.accessScopeSnapshot ?? null,
    sourceKind: input.sourceKind,
  };
  const mapped = mapBOrderReadResult(input.read, ctx);
  if (mapped.status !== "mapped" && mapped.status !== "null_observed") {
    return mapped;
  }
  if (mapped.status === "mapped") {
    return {
      status: "observation",
      observation: {
        ...mapped.observation,
        existenceKind: "LIVE_REFETCH",
        sourceKind: input.sourceKind,
      },
    };
  }

  const adjudication = adjudicateNullObserved({
    nullObserved: true,
    queryCompleted: mapped.observation.queryCompleted === true,
    observedAt: input.observedAt,
    processedAt: stored?.processedAt ?? null,
    shopifyCreatedAt: stored?.shopifyCreatedAt ?? null,
    currentScopes: input.scopes,
    lastConfirmedScopes: stored?.accessScopeSnapshot ?? null,
    storedKind: stored?.existenceKind ?? null,
    storedState: stored?.existenceState ?? null,
    storedDeletedAt: stored?.deletedAt ?? null,
    deleteWebhook: Boolean(input.deleteWebhook),
    hasReadAllOrders: scopesGrantReadAllOrders(input.scopes),
  });
  if (!adjudication.apply) {
    if (adjudication.reason === "preserve_established_tombstone") {
      return {
        status: "noop",
        reason: "preserve_established_tombstone",
      };
    }
    if (adjudication.reason === "scope_continuity_denies_absence") {
      return {
        status: "blocked",
        code: "scope_continuity_denies_absence",
        reason: adjudication.diagnostic ?? adjudication.reason,
      };
    }
    throw new OrderFactsSyncError(
      adjudication.reason,
      adjudication.diagnostic ?? adjudication.reason,
    );
  }
  return {
    status: "observation",
    observation: {
      ...mapped.observation,
      existenceKind: adjudication.existenceKind,
      sourceKind: input.sourceKind,
    },
  };
}

export async function mapRefundReadToObservation(input: {
  db: OrderApplyDb;
  shopId: string;
  handle: DirectOrderObservationHandle;
  read: OrderReadResult<RefundRead>;
  scopes: readonly string[];
  sourceKind: OrderSourceKind;
  observedAt: Date;
  enclosingOrderGid: string | null;
}): Promise<
  | { status: "observation"; observation: DirectOrderObservation }
  | Extract<MapOutcome, { status: "incomplete" | "failure" | "blocked" }>
> {
  const responseGen = await allocateResponseGeneration(
    input.db,
    input.handle.requestGen,
  );
  const ctx: MapContext = {
    shopId: input.shopId,
    observationToken: input.handle.token,
    observationRequestGen: input.handle.requestGen,
    observationResponseGen: responseGen,
    existenceObservedAt: input.observedAt,
    accessScopeSnapshot: input.scopes,
    enclosingOrderGid: input.enclosingOrderGid,
    sourceKind: input.sourceKind,
  };
  const mapped = mapBRefundReadResult(input.read, ctx);
  if (mapped.status !== "mapped" && mapped.status !== "null_observed") {
    return mapped;
  }
  if (mapped.status === "mapped") {
    return {
      status: "observation",
      observation: {
        ...mapped.observation,
        existenceKind: "LIVE_REFETCH",
        sourceKind: input.sourceKind,
      },
    };
  }
  throw new OrderFactsSyncError(
    "refund_null_observed_unverified",
    "Refund null_observed is not confirmed absence; refetch the enclosing order",
  );
}

export { readOrderFact, readRefundFact };
