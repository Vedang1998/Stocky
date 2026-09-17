import { Prisma } from "@prisma/client";
import { applyOrderFactsWithRetry } from "../apply";
import {
  persistIncompleteObservation,
} from "../apply/fencing";
import {
  acquireReceiptApplicationKeyLock,
  loadReceipt,
  shortCircuitIfApplied,
  type ReceiptLookup,
} from "../apply/receipts";
import {
  OrderApplyReceiptDigestConflictError,
  OrderApplyReceiptNotCertifiableError,
} from "../apply/errors";
import type {
  DirectOrderObservation,
  FullSyncOrderObservation,
  OrderApplyReceiptInput,
} from "../apply/types";
import type { OrderApplyDb } from "../apply/sql";
import { SyncControlPlaneError } from "../../../sync/errors";
import {
  APPLICATION_ALREADY_APPLIED,
  APPLICATION_DIGEST_CONFLICT,
  APPLICATION_OUTCOME_UNCERTAIN,
} from "../../../sync/execution-strategy.server";
import { isLegacyOrderWebhookTopic } from "./constants";
import { OrderFactsSyncError } from "./errors";
import { abandonActiveObservation } from "./observations";
import {
  isOrderFactsMerchantHost,
  type LegacyWebhookRunner,
  type OrderFactsTxnClient,
  type OrderFactsWebhookResult,
} from "./types";

export type OrderFactsTxnHost = OrderFactsTxnClient & {
  $transaction: <T>(
    fn: (tx: OrderFactsTxnClient) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    },
  ) => Promise<T>;
};

export function asApplyDb(db: OrderFactsTxnClient): OrderApplyDb {
  if (typeof db.$queryRaw !== "function") {
    throw new OrderFactsSyncError(
      "order_facts_apply_view_missing",
      "C apply requires the transaction-scoped $queryRaw view",
    );
  }
  return { $queryRaw: db.$queryRaw };
}

function isRetryableSerializationFailure(error: unknown): boolean {
  if (error == null || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  if (code === "P2034" || code === "40001") return true;
  const meta =
    "meta" in error ? (error as { meta?: { code?: unknown } }).meta : undefined;
  if (meta != null && String(meta.code) === "40001") return true;
  const message = error instanceof Error ? error.message : String(error);
  return /could not serialize access|40001/i.test(message);
}

async function withRepeatableReadRetry<T>(
  db: OrderFactsTxnHost,
  fn: (tx: OrderFactsTxnClient) => Promise<T>,
): Promise<T> {
  const maxAttempts = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      });
    } catch (error) {
      lastError = error;
      if (isRetryableSerializationFailure(error) && attempt < maxAttempts) {
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function lookupApplicationReceipt(
  db: OrderFactsTxnHost,
  shopId: string,
  applicationKey: string,
): Promise<ReceiptLookup | null> {
  return withRepeatableReadRetry(db, async (tx) =>
    loadReceipt(asApplyDb(tx), shopId, applicationKey),
  );
}

export async function probeReceiptBeforeShopifyIo(
  db: OrderFactsTxnHost,
  shopId: string,
  receipt: OrderApplyReceiptInput,
): Promise<"already_applied" | "proceed"> {
  try {
    return await withRepeatableReadRetry(db, async (tx) => {
      const applyDb = asApplyDb(tx);
      await acquireReceiptApplicationKeyLock(
        applyDb,
        shopId,
        receipt.applicationKey,
      );
      const probed = await shortCircuitIfApplied(applyDb, shopId, receipt);
      return probed === "already_applied" ? "already_applied" : "proceed";
    });
  } catch (error) {
    mapApplyError(error);
  }
}

function mapApplyError(error: unknown): never {
  if (error instanceof OrderApplyReceiptDigestConflictError) {
    throw new SyncControlPlaneError(
      APPLICATION_DIGEST_CONFLICT,
      error.message,
    );
  }
  if (
    error instanceof OrderApplyReceiptNotCertifiableError ||
    (error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "order_apply_receipt_uncertain")
  ) {
    throw new SyncControlPlaneError(
      APPLICATION_OUTCOME_UNCERTAIN,
      error.message,
    );
  }
  throw error;
}

function resultGids(observation: DirectOrderObservation | FullSyncOrderObservation): {
  orderGid: string | null;
  refundGid: string | null;
} {
  return {
    orderGid:
      observation.identity.resourceKind === "Order"
        ? observation.identity.shopifyGid
        : observation.refund?.shopifyOrderGid ?? null,
    refundGid:
      observation.identity.resourceKind === "Refund"
        ? observation.identity.shopifyGid
        : null,
  };
}

export async function applyCanonicalAndLegacy(input: {
  db: OrderFactsTxnHost;
  shopId: string;
  observation: DirectOrderObservation | FullSyncOrderObservation;
  receipt: OrderApplyReceiptInput;
  topic: string;
  projection: Record<string, unknown>;
  runLegacy?: LegacyWebhookRunner;
  requestedCanonicalIdentitiesPerTransaction?: number;
  configuredWorstCaseConcurrentCanonicalTransactions?: number;
  throwOnApplyAlreadyApplied?: boolean;
}): Promise<OrderFactsWebhookResult> {
  const runApply = async (receipt: OrderApplyReceiptInput | undefined) =>
    applyOrderFactsWithRetry(
      (apply) =>
        withRepeatableReadRetry(input.db, async (tx) => {
            const batch = await apply(asApplyDb(tx));
            // C allowlists terminal_first_confirmation as a receipt-success
            // noop. D must not commit that receipt or merchant effects: the
            // first LIVE confirmation is pending work, not a finished application.
            if (
              receipt != null &&
              batch.results.some(
                (result) => result.reason === "terminal_first_confirmation",
              )
            ) {
              throw new OrderApplyReceiptNotCertifiableError(
                "Receipt-bound apply outcomes are not terminal-accepted: noop:terminal_first_confirmation",
              );
            }
            // Frozen v1 effects commit only with the success receipt.
            if (
              receipt != null &&
              batch.receiptStatus === "applied" &&
              isLegacyOrderWebhookTopic(input.topic) &&
              input.runLegacy
            ) {
              if (!isOrderFactsMerchantHost(tx)) {
                throw new OrderFactsSyncError(
                  "order_facts_legacy_host_invalid",
                  "Frozen v1 legacy effects require the authenticated TenantDb transaction, not a query-only view",
                );
              }
              await input.runLegacy(
                input.topic,
                tx,
                input.projection,
              );
            }
            if (
              batch.receiptStatus === "already_applied" &&
              input.observation.observationKind === "direct"
            ) {
              await abandonActiveObservation(asApplyDb(tx), {
                shopId: input.shopId,
                token: input.observation.observationToken,
                requestGen: input.observation.observationRequestGen,
                responseGen: input.observation.observationResponseGen,
                failureCode: "already_applied",
              });
            }
            return batch;
          }),
      {
        shopId: input.shopId,
        observations: [input.observation],
        receipt,
        requestedCanonicalIdentitiesPerTransaction:
          input.requestedCanonicalIdentitiesPerTransaction,
        configuredWorstCaseConcurrentCanonicalTransactions:
          input.configuredWorstCaseConcurrentCanonicalTransactions,
      },
    );

  try {
    const applyResult = await runApply(input.receipt);

    if (applyResult.receiptStatus === "already_applied") {
      if (input.throwOnApplyAlreadyApplied) {
        throw new SyncControlPlaneError(
          APPLICATION_ALREADY_APPLIED,
          "Concurrent SyncApplicationReceipt insert won; aborting duplicate application",
        );
      }
      return {
        status: "already_applied",
        apply: applyResult,
        reason: "already_applied",
        ...resultGids(input.observation),
      };
    }
    if (applyResult.receiptStatus === "none") {
      throw new OrderApplyReceiptNotCertifiableError(
        "Receipt-bound apply returned receiptStatus none",
      );
    }
    return {
      status: "applied",
      apply: applyResult,
      reason: applyResult.results[0]?.reason ?? "applied",
      ...resultGids(input.observation),
    };
  } catch (error) {
    if (
      error instanceof OrderApplyReceiptNotCertifiableError &&
      error.message.includes("terminal_first_confirmation")
    ) {
      const applyResult = await runApply(undefined);
      return {
        status: "first_confirmation_pending",
        apply: applyResult,
        reason: "terminal_first_confirmation",
        ...resultGids(input.observation),
      };
    }
    mapApplyError(error);
  }
}

export async function persistIncompleteWithoutReceipt(input: {
  db: OrderFactsTxnHost;
  shopId: string;
  token: string;
  requestGen: bigint;
  responseGen: bigint;
}): Promise<void> {
  await input.db.$transaction(async (tx) => {
    await persistIncompleteObservation(
      asApplyDb(tx),
      input.shopId,
      input.token,
      input.requestGen,
      input.responseGen,
    );
  });
}
