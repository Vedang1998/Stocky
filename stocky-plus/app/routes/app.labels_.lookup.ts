import type { LoaderFunctionArgs } from "react-router";
import { lookupLabelProducts } from "../services/labels/label-products.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";

/**
 * Resource route for the Labels page: resolves a scan or typed text to the
 * products it names in the signed-in shop's catalog.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { db } = await requireAdminTenant({ request });
  const query = new URL(request.url).searchParams.get("q") ?? "";
  return lookupLabelProducts(db, query);
};
