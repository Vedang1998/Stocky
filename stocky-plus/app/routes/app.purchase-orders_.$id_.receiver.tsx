import type { LoaderFunctionArgs } from "react-router";
import {
  pdfResponse,
  purchaseOrderFilename,
  receivingSheetPdf,
} from "../services/purchasing/documents.server";
import { PurchasingError } from "../services/purchasing/errors";
import { getPurchaseOrderView } from "../services/purchasing/purchase-order-view.server";
import { readShopProfile } from "../services/purchasing/shop-profile.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";

/**
 * Resource route: the receiving sheet warehouse staff count a delivery
 * against. It shows retail prices and deliberately leaves out costs.
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, db } = await requireAdminTenant({ request, params });
  const profile = await readShopProfile(admin);
  const order = await getPurchaseOrderView(db, params.id ?? "", {
    admin,
    today: profile.today,
    shopCurrency: profile.currencyCode,
  }).catch((error: unknown) => {
    if (error instanceof PurchasingError && error.code === "not_found") {
      throw new Response("Purchase order not found", { status: 404 });
    }
    throw error;
  });

  return pdfResponse(
    await receivingSheetPdf(order, profile.currencyCode),
    purchaseOrderFilename(order, "-receiving", "pdf"),
  );
};
