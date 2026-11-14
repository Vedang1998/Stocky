import type { LoaderFunctionArgs } from "react-router";
import { purchaseOrderListCsv } from "../services/purchasing/documents.server";
import { listLocations } from "../services/purchasing/locations.server";
import {
  exportPurchaseOrders,
  isPurchaseOrderView,
} from "../services/purchasing/purchase-order-list.server";
import { readShopProfile } from "../services/purchasing/shop-profile.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";

/** Resource route: the purchase orders of a list view and search, as CSV. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, db } = await requireAdminTenant({ request });
  const url = new URL(request.url);
  const requestedView = url.searchParams.get("view") ?? "";
  const view = isPurchaseOrderView(requestedView) ? requestedView : "open";
  const search = (url.searchParams.get("q") ?? "").trim().slice(0, 100);

  const [profile, locations] = await Promise.all([
    readShopProfile(admin),
    listLocations(db, admin),
  ]);
  const list = await exportPurchaseOrders(db, {
    view,
    search,
    today: profile.today,
  });

  const date = profile.today ?? new Date().toISOString().slice(0, 10);
  return purchaseOrderListCsv(
    list,
    new Map(locations.map((location) => [location.gid, location.name])),
    `purchase-orders-${view}-${date}${list.truncated ? "-newest" : ""}.csv`,
  );
};
