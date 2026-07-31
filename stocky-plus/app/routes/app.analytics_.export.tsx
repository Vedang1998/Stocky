import type { LoaderFunctionArgs } from "react-router";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import {
  getDeadStock,
  getInventoryValuation,
} from "../services/forecasting.server";

function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { db } = await requireAdminTenant(request);
  const report = new URL(request.url).searchParams.get("report");

  if (report === "valuation") {
    const { lines } = await getInventoryValuation(db);
    const csv = toCsv(
      ["Variant", "Location", "Quantity", "Unit landed cost", "Value"],
      lines.map((l) => [
        l.title,
        l.locationId,
        l.quantity,
        l.unitCost.toFixed(4),
        l.value.toFixed(2),
      ]),
    );
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="valuation-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
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
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="deadstock-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return new Response("Unknown report", { status: 400 });
};
