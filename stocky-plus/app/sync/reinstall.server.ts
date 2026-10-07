/**
 * Verified reinstall reactivation — only when disabled reason was UNINSTALLED.
 */
import type { Shop, ShopProcessingDisabledReason } from "@prisma/client";
import { normalizeShopDomain } from "../tenant/shop-domain";
import { assertParticipatingWriteGuard } from "../tenant/participating-write.server";
import { getControlPlanePrisma } from "./control-plane-db.server";
import { SyncControlPlaneError } from "./errors";

export type ReactivateShopResult = {
  shop: Pick<
    Shop,
    | "id"
    | "myshopifyDomain"
    | "processingEnabled"
    | "processingDisabledReason"
    | "reinstalledAt"
  >;
  reactivated: boolean;
};

/**
 * After verified afterAuth reinstall: re-enable processing only if the shop
 * was disabled for UNINSTALLED (not REDACTED / MANUAL).
 */
export async function reactivateShopAfterVerifiedReinstall(input: {
  verifiedDomain: string;
  shopId?: string;
}): Promise<ReactivateShopResult> {
  const prisma = getControlPlanePrisma();
  const norm = normalizeShopDomain(input.verifiedDomain);
  if (!norm.ok) {
    throw new SyncControlPlaneError(
      "shop_missing",
      `Invalid verified domain: ${norm.reason}`,
    );
  }

  let shop = await prisma.shop.findUnique({
    where: { myshopifyDomain: norm.normalized },
    select: {
      id: true,
      myshopifyDomain: true,
      processingEnabled: true,
      processingDisabledReason: true,
      reinstalledAt: true,
    },
  });

  if (!shop && input.shopId) {
    shop = await prisma.shop.findUnique({
      where: { id: input.shopId },
      select: {
        id: true,
        myshopifyDomain: true,
        processingEnabled: true,
        processingDisabledReason: true,
        reinstalledAt: true,
      },
    });
  }

  if (!shop) {
    throw new SyncControlPlaneError("shop_missing", "Shop row missing");
  }

  if (shop.processingEnabled) {
    return { shop, reactivated: false };
  }

  if (shop.processingDisabledReason === "REDACTED") {
    throw new SyncControlPlaneError(
      "reinstall_denied",
      "Cannot reactivate a redacted shop",
    );
  }

  if (shop.processingDisabledReason === "MANUAL") {
    throw new SyncControlPlaneError(
      "reinstall_denied",
      "Cannot auto-reactivate a manually disabled shop",
    );
  }

  if (shop.processingDisabledReason !== "UNINSTALLED") {
    throw new SyncControlPlaneError(
      "reinstall_denied",
      `Cannot reactivate shop disabled for ${shop.processingDisabledReason ?? "unknown"}`,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    await assertParticipatingWriteGuard(tx, shop.myshopifyDomain);
    const locked = await tx.$queryRaw<
      Array<{
        id: string;
        myshopifyDomain: string;
        processingEnabled: boolean;
        processingDisabledReason: ShopProcessingDisabledReason | null;
        reinstalledAt: Date | null;
      }>
    >`
      SELECT id, "myshopifyDomain", "processingEnabled", "processingDisabledReason", "reinstalledAt"
      FROM "Shop"
      WHERE id = ${shop.id}
      FOR UPDATE
    `;
    const live = locked[0];
    if (!live) {
      throw new SyncControlPlaneError("shop_missing", "Shop row missing");
    }
    if (live.processingEnabled) {
      return { shop: live, already: true as const };
    }
    if (live.processingDisabledReason === "REDACTED") {
      throw new SyncControlPlaneError(
        "reinstall_denied",
        "Cannot reactivate a redacted shop",
      );
    }
    if (live.processingDisabledReason === "MANUAL") {
      throw new SyncControlPlaneError(
        "reinstall_denied",
        "Cannot auto-reactivate a manually disabled shop",
      );
    }
    if (live.processingDisabledReason !== "UNINSTALLED") {
      throw new SyncControlPlaneError(
        "reinstall_denied",
        `Cannot reactivate shop disabled for ${live.processingDisabledReason ?? "unknown"}`,
      );
    }
    const row = await tx.shop.update({
      where: { id: live.id },
      data: {
        processingEnabled: true,
        processingDisabledReason: null,
        processingDisabledAt: null,
        reinstalledAt: new Date(),
      },
      select: {
        id: true,
        myshopifyDomain: true,
        processingEnabled: true,
        processingDisabledReason: true,
        reinstalledAt: true,
      },
    });
    return { shop: row, already: false as const };
  });

  if (updated.already) {
    return { shop: updated.shop, reactivated: false };
  }
  return { shop: updated.shop, reactivated: true };
}
