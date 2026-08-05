/**
 * Merchant-domain SyncApplicationReceipt helpers (F-PR4-01 / D-044 residual).
 * Receipt insert is the FINAL write inside the tenant transaction.
 *
 * Concurrent conflict uses INSERT … ON CONFLICT DO NOTHING RETURNING so a
 * failed unique insert never leaves the transaction aborted (25P02).
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
 * 5. Insert receipt as final write (ON CONFLICT DO NOTHING)
 * 6. If insert lost the race → throw APPLICATION_ALREADY_APPLIED so the
 *    caller rolls back merchant writes; outer path verifies the winner.
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

  const schemaVersion =
    input.applicationSchemaVersion ?? APPLICATION_SCHEMA_VERSION;
  const inserted = await db.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "SyncApplicationReceipt" (
      id,
      "shopId",
      "applicationKey",
      "sourceJobType",
      "rootDurableJobId",
      "firstApplyingDurableJobId",
      "payloadDigest",
      "applicationSchemaVersion",
      "resultMetadata",
      "appliedAt"
    ) VALUES (
      concat('c', substr(md5(random()::text || clock_timestamp()::text), 1, 24)),
      ${db.authority.shopId},
      ${input.applicationKey},
      ${input.sourceJobType},
      ${input.rootDurableJobId},
      ${input.applyingDurableJobId},
      ${input.payloadDigest},
      ${schemaVersion},
      ${{ outcome: "applied" }}::jsonb,
      NOW()
    )
    ON CONFLICT ("shopId", "applicationKey") DO NOTHING
    RETURNING id
  `;

  if (inserted.length > 0) {
    const receipt = await db.syncApplicationReceipt.findUniqueOrThrow({
      where: { id: inserted[0].id },
    });
    return { status: "applied", receipt, result };
  }

  // Lost race — transaction is still usable (no aborted SQL state).
  // Abort merchant writes from this loser by throwing; caller rolls back.
  const raced = await db.syncApplicationReceipt.findUnique({
    where: {
      shopId_applicationKey: {
        shopId: db.authority.shopId,
        applicationKey: input.applicationKey,
      },
    },
  });
  if (raced && raced.payloadDigest === input.payloadDigest) {
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
  throw new SyncControlPlaneError(
    APPLICATION_ALREADY_APPLIED,
    "SyncApplicationReceipt conflict without readable winner row",
  );
}
