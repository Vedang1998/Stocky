/**
 * Carries out shop/redact requests: erases every row that belongs to the shop,
 * its sessions and its queued jobs, then the shop row itself.
 *
 * The shop is first marked REDACTED, which reinstall can never undo, and the
 * database function refuses any shop that is not marked that way. Deletion
 * runs in bounded batches, so a request may take several runs; it is recorded
 * as done only by the run that finds nothing left.
 */
import type { PrismaClient, PrivacyRequest } from "@prisma/client";
import { getControlPlanePrisma } from "../sync/control-plane-db.server";

/** Rows deleted per database transaction. */
const BATCH_ROWS = 5_000;
/** Batches per request per run; the rest continues on the next run. */
const MAX_BATCHES_PER_RUN = 200;
/** A claimed request is invisible to other workers for this long. */
const CLAIM_LEASE_MS = 10 * 60_000;
const RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  6 * 60 * 60_000,
];

export type ErasureDeps = {
  /** Deletes Shopify sessions (access tokens, staff details) for a domain. */
  deleteSessions: (shopDomain: string) => Promise<number>;
  /** Removes the shop's jobs from the Redis queues. */
  purgeQueuedJobs: (shopId: string) => Promise<number>;
};

export type ShopRedactOutcome =
  | { status: "resolved"; resolution: NonNullable<PrivacyRequest["resolution"]> }
  | { status: "continuing" }
  | { status: "failed"; errorCode: string };

export function retryDelayMs(attempts: number): number {
  const index = Math.min(Math.max(attempts, 1), RETRY_DELAYS_MS.length) - 1;
  return RETRY_DELAYS_MS[index];
}

export function erasureErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("stocky_privacy_erasure_refused")) {
    return "erasure_refused";
  }
  if (message.includes("stocky_privacy_erasure_stalled")) {
    return "erasure_stalled";
  }
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Za-z0-9_]{1,48}$/.test(code)
    ? `error_${code}`
    : "unexpected_error";
}

/**
 * Leases due shop/redact requests to this worker. Rows locked by another
 * worker are skipped, and a leased row stays hidden until its lease runs out.
 */
export async function claimDueShopRedactRequests(
  now: Date,
  limit: number,
): Promise<PrivacyRequest[]> {
  const prisma = getControlPlanePrisma();
  return prisma.$transaction(async (tx) => {
    const due = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "PrivacyRequest"
      WHERE "topic" = 'SHOP_REDACT'
        AND "resolution" IS NULL
        AND "nextAttemptAt" <= ${now}
      ORDER BY "nextAttemptAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;
    if (due.length === 0) return [];
    const ids = due.map((row) => row.id);
    await tx.privacyRequest.updateMany({
      where: { id: { in: ids } },
      data: {
        attempts: { increment: 1 },
        nextAttemptAt: new Date(now.getTime() + CLAIM_LEASE_MS),
      },
    });
    return tx.privacyRequest.findMany({
      where: { id: { in: ids } },
      orderBy: { receivedAt: "asc" },
    });
  });
}

async function resolve(
  prisma: PrismaClient,
  request: PrivacyRequest,
  resolution: NonNullable<PrivacyRequest["resolution"]>,
  now: Date,
  erasedRows?: bigint,
): Promise<ShopRedactOutcome> {
  await prisma.$transaction(async (tx) => {
    await tx.privacyRequest.update({
      where: { id: request.id },
      data: {
        resolution,
        resolvedAt: now,
        lastErrorCode: null,
        ...(erasedRows === undefined ? {} : { erasedRows }),
      },
    });
    // Other open requests for the same shop row are answered by this erasure.
    if (resolution === "SHOP_DATA_ERASED" && request.shopRecordId) {
      await tx.privacyRequest.updateMany({
        where: {
          topic: "SHOP_REDACT",
          resolution: null,
          shopRecordId: request.shopRecordId,
          id: { not: request.id },
        },
        data: { resolution, resolvedAt: now, lastErrorCode: null },
      });
    }
  });
  return { status: "resolved", resolution };
}

async function eraseShop(
  prisma: PrismaClient,
  request: PrivacyRequest,
  shopId: string,
  deps: ErasureDeps,
  now: Date,
): Promise<ShopRedactOutcome> {
  await deps.deleteSessions(request.shopDomain);
  await deps.purgeQueuedJobs(shopId);

  let erased = request.erasedRows ?? 0n;
  let finished = false;
  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch += 1) {
    const rows = await prisma.$queryRaw<{ deleted: bigint }[]>`
      SELECT stocky_privacy_erase_shop_batch(${shopId}, ${BATCH_ROWS}::integer) AS deleted
    `;
    const deleted = BigInt(rows[0]?.deleted ?? 0);
    if (deleted === 0n) {
      finished = true;
      break;
    }
    erased += deleted;
  }

  if (!finished) {
    await prisma.privacyRequest.update({
      where: { id: request.id },
      data: { erasedRows: erased, nextAttemptAt: now, lastErrorCode: null },
    });
    return { status: "continuing" };
  }

  // A reinstall attempt or a job that was running during the erasure may have
  // written a session or left a finished job behind.
  await deps.deleteSessions(request.shopDomain);
  await deps.purgeQueuedJobs(shopId);
  return resolve(prisma, request, "SHOP_DATA_ERASED", now, erased);
}

export async function processShopRedactRequest(
  request: PrivacyRequest,
  deps: ErasureDeps,
  now: Date = new Date(),
): Promise<ShopRedactOutcome> {
  const prisma = getControlPlanePrisma();
  try {
    if (!request.shopRecordId) {
      // No shop row existed when the request arrived, so there was nothing to
      // erase. A row created since then belongs to a later install.
      const current = await prisma.shop.findUnique({
        where: { myshopifyDomain: request.shopDomain },
        select: { id: true },
      });
      if (!current) await deps.deleteSessions(request.shopDomain);
      return await resolve(prisma, request, "NO_SHOP_RECORD", now);
    }

    const shopId = request.shopRecordId;
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { processingEnabled: true },
    });
    if (!shop) return await resolve(prisma, request, "NO_SHOP_RECORD", now);
    if (shop.processingEnabled) {
      return await resolve(prisma, request, "SHOP_ACTIVE", now);
    }

    // Conditional on the shop still being disabled: a reinstall that won the
    // race keeps its data, one that lost it is refused from here on.
    const marked = await prisma.shop.updateMany({
      where: { id: shopId, processingEnabled: false },
      data: { processingDisabledReason: "REDACTED" },
    });
    if (marked.count === 0) {
      const again = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { id: true },
      });
      return await resolve(
        prisma,
        request,
        again ? "SHOP_ACTIVE" : "NO_SHOP_RECORD",
        now,
      );
    }

    return await eraseShop(prisma, request, shopId, deps, now);
  } catch (error) {
    const errorCode = erasureErrorCode(error);
    await prisma.privacyRequest.update({
      where: { id: request.id },
      data: {
        lastErrorCode: errorCode,
        nextAttemptAt: new Date(now.getTime() + retryDelayMs(request.attempts)),
      },
    });
    return { status: "failed", errorCode };
  }
}
