import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import {
  getDeadStock,
  getInventoryValuation,
  getLowStockAlerts,
  runAbcAnalysis,
} from "../services/forecasting.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { db } = await requireAdminTenant(request);

  const [deadStock, valuation, alerts] = await Promise.all([
    getDeadStock(db, 120),
    getInventoryValuation(db),
    getLowStockAlerts(db),
  ]);

  return {
    deadStock: deadStock.slice(0, 50),
    deadStockCapital: deadStock.reduce((s, d) => s + d.tiedUpCapital, 0),
    valuationTotal: valuation.totalValue,
    valuationCount: valuation.lines.length,
    alerts,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { db } = await requireAdminTenant(request);
  const form = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "runAbc") {
    await runAbcAnalysis(db, "REVENUE");
    await runAbcAnalysis(db, "VOLUME");
    return { ok: true };
  }

  if (intent === "ackAlert") {
    await db.lowStockAlert.updateMany({
      where: { id: form.get("alertId") as string },
      data: { acknowledged: true },
    });
    return { ok: true };
  }

  return { ok: false };
};

export default function Analytics() {
  const { deadStock, deadStockCapital, valuationTotal, valuationCount, alerts } =
    useLoaderData<typeof loader>();

  return (
    <s-page heading="Analytics">
      <s-section heading="Inventory valuation">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            <s-text type="strong">
              ${valuationTotal.toFixed(2)}
            </s-text>{" "}
            across {valuationCount} variant-locations (quantity on hand ×
            average landed cost).
          </s-paragraph>
          <s-button
            href="/app/analytics/export?report=valuation"
            target="_blank"
            variant="secondary"
          >
            Download valuation CSV
          </s-button>
        </s-stack>
      </s-section>

      <s-section heading="Dead stock (no sales in 120 days)">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            <s-text type="strong">${deadStockCapital.toFixed(2)}</s-text> in
            tied-up capital across {deadStock.length} SKUs.
          </s-paragraph>
          {deadStock.length > 0 && (
            <s-table>
              <s-table-header-row>
                <s-table-header>Variant</s-table-header>
                <s-table-header format="numeric">On hand</s-table-header>
                <s-table-header format="currency">Avg landed cost</s-table-header>
                <s-table-header format="currency">Tied-up capital</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {deadStock.map((d) => (
                  <s-table-row key={d.variantId}>
                    <s-table-cell>{d.title}</s-table-cell>
                    <s-table-cell>{d.quantity}</s-table-cell>
                    <s-table-cell>${d.avgCost.toFixed(2)}</s-table-cell>
                    <s-table-cell>${d.tiedUpCapital.toFixed(2)}</s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          )}
          <s-button
            href="/app/analytics/export?report=deadstock"
            target="_blank"
            variant="secondary"
          >
            Download dead stock CSV
          </s-button>
        </s-stack>
      </s-section>

      <s-section heading="Low stock alerts (Class A below reorder point)">
        {alerts.length === 0 ? (
          <s-paragraph>No unacknowledged alerts.</s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Variant</s-table-header>
              <s-table-header format="numeric">Current</s-table-header>
              <s-table-header format="numeric">Reorder point</s-table-header>
              <s-table-header>Raised</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {alerts.map((a: any) => (
                <s-table-row key={a.id}>
                  <s-table-cell>{a.shopifyVariantId}</s-table-cell>
                  <s-table-cell>{a.currentStock}</s-table-cell>
                  <s-table-cell>{a.reorderPoint}</s-table-cell>
                  <s-table-cell>
                    {new Date(a.createdAt).toLocaleDateString()}
                  </s-table-cell>
                  <s-table-cell>
                    <Form method="post">
                      <input type="hidden" name="intent" value="ackAlert" />
                      <input type="hidden" name="alertId" value={a.id} />
                      <s-button type="submit" variant="tertiary">
                        Acknowledge
                      </s-button>
                    </Form>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      <s-section slot="aside" heading="ABC analysis">
        <s-paragraph>
          ABC classes recalculate automatically every Sunday at 2 AM. Trigger a
          manual run after large data changes.
        </s-paragraph>
        <Form method="post">
          <input type="hidden" name="intent" value="runAbc" />
          <s-button type="submit" variant="secondary">
            Run ABC analysis now
          </s-button>
        </Form>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
