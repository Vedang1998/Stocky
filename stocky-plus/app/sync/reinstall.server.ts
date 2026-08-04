/**
 * Verified reinstall reactivation — only when disabled reason was UNINSTALLED.
 */
import type { Shop } from "@prisma/client";
import { normalizeShopDomain } from "../tenant/shop-domain";
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

  const updated = await prisma.shop.update({
    where: { id: shop.id },
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

  return { shop: updated, reactivated: true };
}
