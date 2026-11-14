/* eslint-disable @typescript-eslint/no-explicit-any -- TenantDb opaque delegates */
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import { getLowStockAlerts } from "../services/forecasting.server";
import { loadSetupGuide } from "../services/setup-guide.server";
import { enqueueCatalogSync } from "../jobs/queue.server";
import { SetupGuide } from "../components/SetupGuide";
import { SyncAttentionBanner, SyncStatus } from "../components/SyncStatus";
import { buildSyncStatusView } from "../lib/sync-status";
import { useRevalidateWhile } from "../lib/use-revalidate-while";
import { readCatalogSyncStatus } from "../sync/sync-status.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { tenant, db } = await requireAdminTenant({ request });
  const shop = tenant.myshopifyDomain;

  const [settings, alerts, openPOs, supplierCount, cachedVariants] =
    await Promise.all([
      db.shopSettings.upsert({
        where: { shop },
        create: { shop },
        update: {},
      }),
      getLowStockAlerts(db),
      // The same orders as the Open view of the purchase-order list.
      db.purchaseOrder.count({
        where: {
          archivedAt: null,
          status: { in: ["DRAFT", "SENT", "ORDERED", "PARTIAL"] },
        },
      }),
      db.supplier.count({ where: { status: "ACTIVE" } }),
      db.shopifyVariantCache.count({ where: {} }),
    ]);
  const [setupGuide, syncDomains] = await Promise.all([
    loadSetupGuide(db),
    readCatalogSyncStatus(tenant),
  ]);

  return {
    settings,
    alerts: alerts.slice(0, 10),
    openPOs,
    supplierCount,
    cachedVariants,
    setupGuide,
    syncStatus: buildSyncStatusView(
      syncDomains.map((domain) => ({
        ...domain,
        lastSucceededAt: domain.lastSucceededAt?.toISOString() ?? null,
      })),
    ),
    now: Date.now(),
  };
};

const SYNC_REFRESH = { intervalMs: 5000, maxMs: 15 * 60 * 1000 };

export const action = async ({ request }: ActionFunctionArgs) => {
  const { tenant, db } = await requireAdminTenant({ request });
  const form = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "syncCatalog") {
    // Does nothing when a sync for this shop is already queued or running.
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
  const {
    settings,
    alerts,
    openPOs,
    supplierCount,
    cachedVariants,
    setupGuide,
    syncStatus,
    now,
  } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const syncing =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "syncCatalog";
  // A first sync takes from seconds to several minutes; follow it so the
  // status and the setup guide update on their own.
  useRevalidateWhile(syncStatus.inProgress, SYNC_REFRESH);

  return (
    <s-page heading="Home">
      {syncStatus.attention && (
        <SyncAttentionBanner attention={syncStatus.attention} />
      )}
      {!setupGuide.complete && (
        <SetupGuide guide={setupGuide} syncing={syncing} />
      )}

      <s-section heading="Overview">
        <s-query-container>
          <s-grid
            gridTemplateColumns="@container (inline-size > 480px) 1fr 1fr 1fr 1fr, 1fr 1fr"
            gap="base"
          >
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-heading>{supplierCount}</s-heading>
              <s-paragraph>Suppliers</s-paragraph>
            </s-box>
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-heading>{openPOs}</s-heading>
              <s-paragraph>Open purchase orders</s-paragraph>
            </s-box>
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-heading>{cachedVariants}</s-heading>
              <s-paragraph>Variants synced</s-paragraph>
            </s-box>
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-heading>{alerts.length}</s-heading>
              <s-paragraph>Low stock alerts</s-paragraph>
            </s-box>
          </s-grid>
        </s-query-container>
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

      <SyncStatus status={syncStatus} now={now} submitting={syncing} />

      <s-section slot="aside" heading="Quick links">
        <s-unordered-list>
          <s-list-item>
            <s-link href="/app/buying-table">Replenishment</s-link>
          </s-list-item>
          <s-list-item>
            <s-link href="/app/purchase-orders">Purchase orders</s-link>
          </s-list-item>
          <s-list-item>
            <s-link href="/app/warehouse">Receiving</s-link>
          </s-list-item>
          <s-list-item>
            <s-link href="/app/inventory">Look up stock</s-link>
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section slot="aside" heading="On the shop floor">
        <s-paragraph>
          Staff can check stock from Shopify POS. In the POS app, open the
          smart grid, tap Add tile, choose App, then ProPo inventory. Stock
          also appears on each product’s screen in POS.
        </s-paragraph>
        <s-paragraph>
          On a phone, open Inventory in the Shopify app and scan with the
          camera.
        </s-paragraph>
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
