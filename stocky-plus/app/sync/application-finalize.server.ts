/**
 * Shared v2/v3 post-rollback application finalization (NEW-PR4-SC01 / D-045).
 *
 * Never finalizes SUCCEEDED from an error code alone. Always verifies the
 * SyncApplicationReceipt in a new tenant-scoped transaction after rollback.
 */
import type { TenantDb } from "../tenant/tenant-db.server";
import { verifyApplicationReceiptAfterRollback } from "./application-receipt.server";
import {
  APPLICATION_DIGEST_CONFLICT,
  APPLICATION_OUTCOME_UNCERTAIN,
} from "./execution-strategy.server";
import {
  completeAttemptFail,
  completeAttemptSuccess,
} from "./lifecycle.server";

export type FinalizeVerifiedApplicationInput = {
  db: TenantDb;
  applicationKey: string;
  expectedPayloadDigest: string;
  durableJobId: string;
  shopId: string;
  attemptId: string;
  workerId: string;
};

export type FinalizeVerifiedApplicationResult =
  | { outcome: "succeeded"; applicationStatus: string }
  | { outcome: "dead_lettered"; errorCode: string };

/**
 * After the merchant application transaction has rolled back, verify the
 * receipt and finalize the durable attempt accordingly.
 */
export async function finalizeApplicationAfterRollback(
  input: FinalizeVerifiedApplicationInput,
): Promise<FinalizeVerifiedApplicationResult> {
  const verification = await verifyApplicationReceiptAfterRollback(input.db, {
    applicationKey: input.applicationKey,
    expectedPayloadDigest: input.expectedPayloadDigest,
  });

  if (verification.status === "verified") {
    await completeAttemptSuccess({
      durableJobId: input.durableJobId,
      shopId: input.shopId,
      attemptId: input.attemptId,
      workerId: input.workerId,
      resultMetadata: {
        applicationStatus: "already_applied_verified_after_rollback",
        receiptId: verification.receiptId,
      },
    });
    return {
      outcome: "succeeded",
      applicationStatus: "already_applied_verified_after_rollback",
    };
  }

  if (verification.status === "digest_conflict") {
    await completeAttemptFail({
      durableJobId: input.durableJobId,
      shopId: input.shopId,
      attemptId: input.attemptId,
      errorCode: APPLICATION_DIGEST_CONFLICT,
      failureSummary:
        "SyncApplicationReceipt digest mismatch after rollback verification",
    });
    return {
      outcome: "dead_lettered",
      errorCode: APPLICATION_DIGEST_CONFLICT,
    };
  }

  // missing | verification_failed
  await completeAttemptFail({
    durableJobId: input.durableJobId,
    shopId: input.shopId,
    attemptId: input.attemptId,
    errorCode: APPLICATION_OUTCOME_UNCERTAIN,
    failureSummary:
      verification.status === "missing"
        ? "APPLICATION_ALREADY_APPLIED without verifiable receipt after rollback"
        : `Receipt verification failed: ${verification.reason}`,
  });
  return {
    outcome: "dead_lettered",
    errorCode: APPLICATION_OUTCOME_UNCERTAIN,
  };
}
