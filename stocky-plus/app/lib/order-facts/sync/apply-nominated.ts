import { createHash } from "node:crypto";

import type { OrderAdminReadClient, TrustedShopIdentity } from "../admin-read";
import type { OrderApplyReceiptInput } from "../apply/types";
import type { OrderSourceKind } from "../types";
import {
  applyCanonicalAndLegacy,
  persistIncompleteWithoutReceipt,
  type OrderFactsTxnHost,
} from "./apply-composition";
import { ORDER_FACTS_DIRECT_LEASE_MS } from "./constants";
import { recordOrderFactsDataIssue } from "./control-plane";
import { OrderFactsSyncError } from "./errors";
import {
  abandonActiveObservation,
  allocateResponseGeneration,
  beginDirectOrderObservation,
} from "./observations";
import {
  mapOrderReadToObservation,
  persistObservationScopesAndShopMetadata,
  readGrantedAccessScopes,
  readOrderFact,
  readShopTimezoneCurrencyOrThrow,
} from "./refetch";

export type NominatedApplyResult =
  | { status: "applied"; shopifyGid: string }
  | { status: "already_applied"; shopifyGid: string }
  | { status: "incomplete"; shopifyGid: string; reason: string }
  | { status: "blocked"; shopifyGid: string; reason: string }
  | { status: "noop"; shopifyGid: string; reason: string };

export async function applyNominatedOrderGid(input: {
  db: OrderFactsTxnHost;
  admin: OrderAdminReadClient;
  shop: TrustedShopIdentity;
  shopId: string;
  shopifyGid: string;
  sourceKind: OrderSourceKind;
  observedAt: Date;
  receipt: OrderApplyReceiptInput;
  durableJobId?: string | null;
  jobAttemptId?: string | null;
  correlationId?: string | null;
  leaseDurationMs?: number;
  requestedCanonicalIdentitiesPerTransaction?: number;
  configuredWorstCaseConcurrentCanonicalTransactions?: number;
}): Promise<NominatedApplyResult> {
  const handle = await input.db.$transaction((tx) =>
    beginDirectOrderObservation(tx, {
      shopId: input.shopId,
      resourceKind: "Order",
      shopifyGid: input.shopifyGid,
      leaseDurationMs: input.leaseDurationMs ?? ORDER_FACTS_DIRECT_LEASE_MS,
      durableJobId: input.durableJobId,
      jobAttemptId: input.jobAttemptId,
      correlationId: input.correlationId,
    }),
  );
  try {
    const context = { admin: input.admin, shop: input.shop };
    const scopes = await readGrantedAccessScopes(context);
    const shopMetadata = await readShopTimezoneCurrencyOrThrow(context);
    await input.db.$transaction((tx) =>
      persistObservationScopesAndShopMetadata({
        db: tx,
        shopId: input.shopId,
        handle,
        scopes,
        shopMetadata,
      }),
    );
    const read = await readOrderFact(context, input.shopifyGid);
    const mapped = await input.db.$transaction((tx) =>
      mapOrderReadToObservation({
        db: tx,
        shopId: input.shopId,
        handle,
        read,
        scopes,
        sourceKind: input.sourceKind,
        observedAt: input.observedAt,
      }),
    );
    if (mapped.status === "noop") {
      await input.db.$transaction((tx) =>
        abandonActiveObservation(tx, {
          shopId: input.shopId,
          token: handle.token,
          requestGen: handle.requestGen,
          failureCode: mapped.reason,
        }),
      );
      return {
        status: "noop",
        shopifyGid: input.shopifyGid,
        reason: mapped.reason,
      };
    }
    if (mapped.status === "incomplete" || mapped.status === "failure") {
      const responseGen = await input.db.$transaction((tx) =>
        allocateResponseGeneration(tx, handle.requestGen),
      );
      await persistIncompleteWithoutReceipt({
        db: input.db,
        shopId: input.shopId,
        token: handle.token,
        requestGen: handle.requestGen,
        responseGen,
      });
      return {
        status: "incomplete",
        shopifyGid: input.shopifyGid,
        reason: mapped.reason,
      };
    }
    if (mapped.status === "blocked") {
      if (mapped.code === "scope_continuity_denies_absence") {
        await recordOrderFactsDataIssue({
          shopId: input.shopId,
          reasonCode: "order_facts_scope_continuity",
          redactedEvidence: { shopifyGid: input.shopifyGid },
        });
      }
      await input.db.$transaction((tx) =>
        abandonActiveObservation(tx, {
          shopId: input.shopId,
          token: handle.token,
          requestGen: handle.requestGen,
          failureCode: mapped.status,
        }),
      );
      return {
        status: "blocked",
        shopifyGid: input.shopifyGid,
        reason: mapped.reason,
      };
    }
    if (mapped.status !== "observation") {
      throw new OrderFactsSyncError(
        "order_facts_map_status_unknown",
        "Nominated mapper returned an unusable status",
      );
    }
    const applied = await applyCanonicalAndLegacy({
      db: input.db,
      shopId: input.shopId,
      observation: mapped.observation,
      receipt: input.receipt,
      topic: "orders/updated",
      projection: { id: input.shopifyGid },
      requestedCanonicalIdentitiesPerTransaction:
        input.requestedCanonicalIdentitiesPerTransaction ?? 1,
      configuredWorstCaseConcurrentCanonicalTransactions:
        input.configuredWorstCaseConcurrentCanonicalTransactions,
    });
    if (applied.status === "already_applied") {
      return { status: "already_applied", shopifyGid: input.shopifyGid };
    }
    if (applied.status === "applied") {
      return { status: "applied", shopifyGid: input.shopifyGid };
    }
    return {
      status: "incomplete",
      shopifyGid: input.shopifyGid,
      reason: applied.reason,
    };
  } catch (error) {
    await input.db
      .$transaction((tx) =>
        abandonActiveObservation(tx, {
          shopId: input.shopId,
          token: handle.token,
          requestGen: handle.requestGen,
          failureCode:
            error instanceof Error ? error.name : "order_facts_sync_error",
        }),
      )
      .catch(() => undefined);
    throw error;
  }
}

export function nominatedReceipt(input: {
  durableJobId: string;
  shopifyGid: string;
  sourceJobType: string;
  fenceGeneration?: bigint;
}): OrderApplyReceiptInput {
  const digest = createHash("sha256")
    .update(
      `${input.sourceJobType}:${input.durableJobId}:${input.shopifyGid}:${input.fenceGeneration ?? ""}`,
    )
    .digest("hex");
  return {
    applicationKey: `${input.sourceJobType}:${input.durableJobId}:${input.shopifyGid}`,
    sourceJobType: input.sourceJobType,
    rootDurableJobId: input.durableJobId,
    applyingDurableJobId: input.durableJobId,
    payloadDigest: digest,
  };
}
