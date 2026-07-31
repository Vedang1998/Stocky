import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import { getLowStockAlerts } from "../services/forecasting.server";
import { enqueueCatalogSync } from "../jobs/queue.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { tenant, db } = await requireAdminTenant(request);
  const shop = tenant.myshopifyDomain;

  const [settings, alerts, openPOs, supplierCount, cachedVariants] =
    await Promise.all([
      db.shopSettings.upsert({
        where: { shop },
        create: { shop },
        update: {},
      }),
      getLowStockAlerts(db),
      db.purchaseOrder.count({
        where: { status: { in: ["ORDERED", "PARTIAL"] } },
      }),
      db.supplier.count({ where: {} }),
      db.shopifyVariantCache.count({ where: {} }),
    ]);

  return {
    settings,
    alerts: alerts.slice(0, 10),
    openPOs,
    supplierCount,
    cachedVariants,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { tenant, db } = await requireAdminTenant(request);
  const form = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "syncCatalog") {
    await enqueueCatalogSync(tenant);
    return { synced: true };
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

export default function Dashboard() {
  const { settings, alerts, openPOs, supplierCount, cachedVariants } =
    useLoaderData<typeof loader>();
  const navigation = useNavigation();

  return (
    <s-page heading="Inventory platform">
      {cachedVariants === 0 && (
        <s-banner tone="warning" heading="Catalog not synced yet">
          <s-paragraph>
            Run a catalog sync to pull your products, variants, and barcodes
            from Shopify via a bulk operation. The background worker must be
            running (`npm run worker`).
          </s-paragraph>
        </s-banner>
      )}

      <s-section heading="Overview">
        <s-stack direction="inline" gap="large-100">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-heading>{supplierCount}</s-heading>
            <s-paragraph>Suppliers</s-paragraph>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-heading>{openPOs}</s-heading>
            <s-paragraph>Open POs</s-paragraph>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-heading>{cachedVariants}</s-heading>
            <s-paragraph>Cached variants</s-paragraph>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-heading>{alerts.length}</s-heading>
            <s-paragraph>Low stock alerts</s-paragraph>
          </s-box>
        </s-stack>
      </s-section>

      {alerts.length > 0 && (
        <s-section heading="Low stock alerts (Class A)">
          <s-table>
            <s-table-header-row>
              <s-table-header>Variant</s-table-header>
              <s-table-header format="numeric">Current</s-table-header>
              <s-table-header format="numeric">Reorder point</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {alerts.map((alert: any) => (
                <s-table-row key={alert.id}>
                  <s-table-cell>{alert.shopifyVariantId}</s-table-cell>
                  <s-table-cell>{alert.currentStock}</s-table-cell>
                  <s-table-cell>{alert.reorderPoint}</s-table-cell>
                  <s-table-cell>
                    <Form method="post">
                      <input type="hidden" name="intent" value="ackAlert" />
                      <input type="hidden" name="alertId" value={alert.id} />
                      <s-button type="submit" variant="tertiary">
                        Acknowledge
                      </s-button>
                    </Form>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}

      <s-section slot="aside" heading="Catalog sync">
        <s-paragraph>
          {cachedVariants > 0
            ? `${cachedVariants} variants cached. Re-sync after adding products.`
            : "Sync your Shopify catalog to begin."}
        </s-paragraph>
        <Form method="post">
          <input type="hidden" name="intent" value="syncCatalog" />
          <s-button
            type="submit"
            variant="primary"
            {...(navigation.state === "submitting" ? { loading: true } : {})}
          >
            Sync catalog (bulk operation)
          </s-button>
        </Form>
      </s-section>

      <s-section slot="aside" heading="Quick links">
        <s-unordered-list>
          <s-list-item>
            <s-link href="/app/buying-table">Buying Table</s-link>
          </s-list-item>
          <s-list-item>
            <s-link href="/app/purchase-orders">Purchase Orders</s-link>
          </s-list-item>
          <s-list-item>
            <s-link href="/app/warehouse">Scan & Receive</s-link>
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section slot="aside" heading="Plan">
        <s-paragraph>
          {settings.subscriptionActive
            ? `Active: ${settings.subscriptionPlan ?? "subscribed"}`
            : "Free tier — Buying Table locked"}
        </s-paragraph>
        <s-link href="/app/billing">Manage billing</s-link>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
