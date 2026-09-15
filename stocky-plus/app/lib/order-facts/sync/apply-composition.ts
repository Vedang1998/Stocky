import { Prisma } from "@prisma/client";
import { applyOrderFactsWithRetry } from "../apply";
import {
  persistIncompleteObservation,
} from "../apply/fencing";
import {
  acquireReceiptApplicationKeyLock,
  shortCircuitIfApplied,
} from "../apply/receipts";
import {
  OrderApplyReceiptDigestConflictError,
  OrderApplyReceiptNotCertifiableError,
} from "../apply/errors";
import type { DirectOrderObservation, OrderApplyReceiptInput } from "../apply/types";
import type { OrderApplyDb } from "../apply/sql";
import { SyncControlPlaneError } from "../../../sync/errors";
import {
  APPLICATION_DIGEST_CONFLICT,
  APPLICATION_OUTCOME_UNCERTAIN,
} from "../../../sync/execution-strategy.server";
import { isLegacyOrderWebhookTopic } from "./constants";
import { abandonActiveObservation } from "./observations";
import type { LegacyWebhookRunner, OrderFactsWebhookResult } from "./types";

export type OrderFactsTxnHost = OrderApplyDb & {
  $transaction: <T>(
    fn: (tx: OrderFactsTxnHost) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    },
  ) => Promise<T>;
};

function asApplyDb(db: OrderApplyDb): OrderApplyDb {
  // Do not rebind $queryRaw onto the TenantDb proxy — Prisma's tagged
  // template is already bound to the transaction client.
  return { $queryRaw: db.$queryRaw };
}

export async function probeReceiptBeforeShopifyIo(
  db: OrderFactsTxnHost,
  shopId: string,
  receipt: OrderApplyReceiptInput,
): Promise<"already_applied" | "proceed"> {
  try {
    return await db.$transaction(
      async (tx) => {
        const applyDb = asApplyDb(tx);
        await acquireReceiptApplicationKeyLock(
          applyDb,
          shopId,
          receipt.applicationKey,
        );
        const probed = await shortCircuitIfApplied(
          applyDb,
          shopId,
          receipt,
        );
        return probed === "already_applied" ? "already_applied" : "proceed";
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
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

function resultGids(observation: DirectOrderObservation): {
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
  observation: DirectOrderObservation;
  receipt: OrderApplyReceiptInput;
  topic: string;
  projection: Record<string, unknown>;
  runLegacy?: LegacyWebhookRunner;
  requestedCanonicalIdentitiesPerTransaction?: number;
  configuredWorstCaseConcurrentCanonicalTransactions?: number;
}): Promise<OrderFactsWebhookResult> {
  const runApply = async (receipt: OrderApplyReceiptInput | undefined) =>
    applyOrderFactsWithRetry(
      (apply) =>
        input.db.$transaction(
          async (tx) => {
            const batch = await apply(asApplyDb(tx));
            if (
              batch.receiptStatus === "applied" &&
              isLegacyOrderWebhookTopic(input.topic) &&
              input.runLegacy
            ) {
              await input.runLegacy(
                input.topic,
                asApplyDb(tx),
                input.projection,
              );
            }
            if (batch.receiptStatus === "already_applied") {
              await abandonActiveObservation(asApplyDb(tx), {
                shopId: input.shopId,
                token: input.observation.observationToken,
                requestGen: input.observation.observationRequestGen,
                responseGen: input.observation.observationResponseGen,
                failureCode: "already_applied",
              });
            }
            return batch;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
        ),
      {
        shopId: input.shopId,
        observations: [input.observation],
        receipt,
        // Do not default to 1: refunds lock Order+Refund. Omit so C uses
        // identities.length, then the lock-capacity evaluator caps it.
        requestedCanonicalIdentitiesPerTransaction:
          input.requestedCanonicalIdentitiesPerTransaction,
        configuredWorstCaseConcurrentCanonicalTransactions:
          input.configuredWorstCaseConcurrentCanonicalTransactions,
      },
    );

  try {
    const applyResult = await runApply(input.receipt);

    if (applyResult.receiptStatus === "already_applied") {
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
    // C records the first LIVE confirmation with diagnostic
    // TERMINAL_IDENTITY_REVIVAL_CONFLICT:<gens>, which it classifies as
    // outcome "conflict" and therefore will not certify a receipt. C's own
    // revival tests apply without a receipt. Retry once without a receipt so
    // the confirmation commits and the retry budget is not consumed.
    if (
      error instanceof OrderApplyReceiptNotCertifiableError &&
      error.message.includes("terminal_first_confirmation")
    ) {
      const applyResult = await runApply(undefined);
      return {
        status: "applied",
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
