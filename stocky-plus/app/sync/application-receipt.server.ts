/**
 * Merchant-domain SyncApplicationReceipt helpers (F-PR4-01).
 * Receipt insert is the FINAL write inside the tenant transaction.
 */
import type { Prisma, SyncApplicationReceipt } from "@prisma/client";
import type { TenantDb } from "../tenant/tenant-db.server";
import { SyncControlPlaneError } from "./errors";
import {
  APPLICATION_ALREADY_APPLIED,
  APPLICATION_DIGEST_CONFLICT,
} from "./execution-strategy.server";

export const APPLICATION_SCHEMA_VERSION = "sync-application-receipt-v1" as const;

export type ApplyWithReceiptInput = {
  applicationKey: string;
  sourceJobType: string;
  rootDurableJobId: string;
  applyingDurableJobId: string;
  payloadDigest: string;
  applicationSchemaVersion?: string;
};

export type ApplyWithReceiptResult<T> =
  | {
      status: "applied";
      receipt: SyncApplicationReceipt;
      result: T;
    }
  | {
      status: "already_applied";
      receipt: SyncApplicationReceipt;
      result: null;
    };

/**
 * Atomically apply merchant writes guarded by SyncApplicationReceipt.
 *
 * Order (required):
 * 1. Lock/check application key
 * 2. Same digest → already applied (no merchant writes)
 * 3. Different digest → fail closed
 * 4. Perform merchant writes via `apply`
 * 5. Insert receipt as final write
 * 6. Commit (caller owns the TenantDb.$transaction boundary)
 */
export async function applyWithApplicationReceipt<T>(
  db: TenantDb,
  input: ApplyWithReceiptInput,
  apply: (db: TenantDb) => Promise<T>,
): Promise<ApplyWithReceiptResult<T>> {
  const existing = await db.syncApplicationReceipt.findUnique({
    where: {
      shopId_applicationKey: {
        shopId: db.authority.shopId,
        applicationKey: input.applicationKey,
      },
    },
  });

  if (existing) {
    if (existing.payloadDigest !== input.payloadDigest) {
      throw new SyncControlPlaneError(
        APPLICATION_DIGEST_CONFLICT,
        "SyncApplicationReceipt exists with a different payload digest",
      );
    }
    return {
      status: "already_applied",
      receipt: existing,
      result: null,
    };
  }

  const result = await apply(db);

  try {
    const receipt = await db.syncApplicationReceipt.create({
      data: {
        shopId: db.authority.shopId,
        applicationKey: input.applicationKey,
        sourceJobType: input.sourceJobType,
        rootDurableJobId: input.rootDurableJobId,
        firstApplyingDurableJobId: input.applyingDurableJobId,
        payloadDigest: input.payloadDigest,
        applicationSchemaVersion:
          input.applicationSchemaVersion ?? APPLICATION_SCHEMA_VERSION,
        resultMetadata: {
          outcome: "applied",
        } as Prisma.InputJsonValue,
      },
    });
    return { status: "applied", receipt, result };
  } catch (err) {
    // Concurrent insert won — re-read and treat as already-applied if digest matches.
    const raced = await db.syncApplicationReceipt.findUnique({
      where: {
        shopId_applicationKey: {
          shopId: db.authority.shopId,
          applicationKey: input.applicationKey,
        },
      },
    });
    if (raced && raced.payloadDigest === input.payloadDigest) {
      // Merchant writes from this loser transaction must not commit.
      // Caller must run this helper inside a transaction that will roll back
      // when we throw after detecting a lost race with side effects.
      throw new SyncControlPlaneError(
        APPLICATION_ALREADY_APPLIED,
        "Concurrent SyncApplicationReceipt insert won; aborting duplicate application",
      );
    }
    if (raced && raced.payloadDigest !== input.payloadDigest) {
      throw new SyncControlPlaneError(
        APPLICATION_DIGEST_CONFLICT,
        "SyncApplicationReceipt exists with a different payload digest",
      );
    }
    throw err;
  }
}
