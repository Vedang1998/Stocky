/**
 * Retention backstop. Shopify sends shop/redact 48 hours after an uninstall;
 * if that webhook never arrives, an uninstalled shop's data is still erased
 * once it has been uninstalled for the configured number of days.
 */
import { getControlPlanePrisma } from "../sync/control-plane-db.server";
import { PRIVACY_REQUEST_DUE_DAYS } from "./config.server";

const DAY_MS = 24 * 60 * 60 * 1000;
const SHOPS_PER_SWEEP = 50;

/**
 * Marks expired uninstalled shops REDACTED and opens an erasure request for
 * each, in one transaction per shop. The update is conditional, so a shop
 * that was reinstalled in the meantime is left alone. Returns the number of
 * requests opened.
 */
export async function openRetentionErasureRequests(
  retentionDays: number,
  now: Date = new Date(),
): Promise<number> {
  const prisma = getControlPlanePrisma();
  const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
  const expired = {
    processingEnabled: false,
    processingDisabledReason: "UNINSTALLED",
    uninstalledAt: { lte: cutoff },
  } as const;

  const shops = await prisma.shop.findMany({
    where: expired,
    select: { id: true, myshopifyDomain: true },
    orderBy: { uninstalledAt: "asc" },
    take: SHOPS_PER_SWEEP,
  });

  let opened = 0;
  for (const shop of shops) {
    opened += await prisma.$transaction(async (tx) => {
      // Shopify's own shop/redact is already waiting for this shop.
      const pending = await tx.privacyRequest.findFirst({
        where: { topic: "SHOP_REDACT", resolution: null, shopRecordId: shop.id },
        select: { id: true },
      });
      if (pending) return 0;
      const marked = await tx.shop.updateMany({
        where: { id: shop.id, ...expired },
        data: { processingDisabledReason: "REDACTED" },
      });
      if (marked.count === 0) return 0;
      await tx.privacyRequest.create({
        data: {
          topic: "SHOP_REDACT",
          origin: "RETENTION_SWEEP",
          shopDomain: shop.myshopifyDomain,
          shopRecordId: shop.id,
          receivedAt: now,
          dueAt: new Date(now.getTime() + PRIVACY_REQUEST_DUE_DAYS * DAY_MS),
          nextAttemptAt: now,
        },
      });
      return 1;
    });
  }
  return opened;
}
