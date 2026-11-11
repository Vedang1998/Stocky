/* eslint-disable @typescript-eslint/no-explicit-any -- TenantDb opaque delegates */
import type { LoaderFunctionArgs } from "react-router";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import {
  getDeadStock,
  getInventoryValuation,
} from "../services/forecasting.server";
import { fetchLocations } from "../services/shopify-gql.server";
import { csvDownloadResponse, toCsv } from "../lib/csv.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, db } = await requireAdminTenant({ request });
  const report = new URL(request.url).searchParams.get("report");

  if (report === "valuation") {
    const [{ lines }, locations] = await Promise.all([
      getInventoryValuation(db),
      fetchLocations(admin),
    ]);
    // Merchants read locations by name; the GID is kept only when Shopify no
    // longer returns the location (deleted, or beyond the fetched page).
    const locationNames = new Map(
      locations.map((location) => [location.id, location.name]),
    );
    const csv = toCsv(
      ["Variant", "Location", "Quantity", "Unit landed cost", "Value"],
      lines.map((l) => [
        l.title,
        locationNames.get(l.locationId) ?? l.locationId,
        l.quantity,
        l.unitCost.toFixed(4),
        l.value.toFixed(2),
      ]),
    );
    return csvDownloadResponse(
      csv,
      `valuation-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  }

  if (report === "deadstock") {
    const deadStock = await getDeadStock(db, 120);
    const csv = toCsv(
      ["Variant", "Quantity", "Avg landed cost", "Tied-up capital"],
      deadStock.map((d) => [
        d.title,
        d.quantity,
        d.avgCost.toFixed(4),
        d.tiedUpCapital.toFixed(2),
      ]),
    );
    return csvDownloadResponse(
      csv,
      `deadstock-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  }

  return new Response("Unknown report", { status: 400 });
};
