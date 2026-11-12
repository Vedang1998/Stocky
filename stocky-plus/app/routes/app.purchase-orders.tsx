import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { formatMoney } from "../lib/decimal-format";
import { formatDay } from "../lib/purchasing/display";
import { STATUS_LABELS, STATUS_TONES } from "../lib/purchasing/status";
import { submitOnEnter } from "../lib/submit-on-enter";
import { listLocations } from "../services/purchasing/locations.server";
import {
  isPurchaseOrderView,
  listPurchaseOrders,
  PURCHASE_ORDER_VIEW_LABELS,
  PURCHASE_ORDER_VIEWS,
} from "../services/purchasing/purchase-order-list.server";
import { readShopProfile } from "../services/purchasing/shop-profile.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";

const MAX_PAGE = 10_000;

function readPage(value: string | null): number {
  if (!value || !/^\d{1,5}$/.test(value)) return 1;
  const page = Number(value);
  return page >= 1 && page <= MAX_PAGE ? page : 1;
}

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
  const list = await listPurchaseOrders(db, {
    view,
    search,
    page: readPage(url.searchParams.get("page")),
    today: profile.today,
  });

  return {
    list,
    search,
    views: PURCHASE_ORDER_VIEWS.map((key) => ({
      key,
      label: PURCHASE_ORDER_VIEW_LABELS[key],
      count: list.counts[key],
    })),
    locationNames: Object.fromEntries(locations.map((l) => [l.gid, l.name])),
  };
};

function listHref(view: string, search: string, page = 1): string {
  const params = new URLSearchParams({ view });
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  return `/app/purchase-orders?${params.toString()}`;
}

export default function PurchaseOrders() {
  const { list, search, views, locationNames } = useLoaderData<typeof loader>();
  const viewLabel = PURCHASE_ORDER_VIEW_LABELS[list.view].toLowerCase();

  return (
    <s-page heading="Purchase orders">
      <s-button
        slot="primary-action"
        variant="primary"
        href="/app/purchase-orders/new"
      >
        Create purchase order
      </s-button>

      <s-section>
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="small-200">
            {views.map((view) => (
              <s-button
                key={view.key}
                href={listHref(view.key, search)}
                variant={view.key === list.view ? "primary" : "tertiary"}
              >
                {view.label} ({view.count})
              </s-button>
            ))}
          </s-stack>

          <Form method="get" onKeyDown={submitOnEnter}>
            <input type="hidden" name="view" value={list.view} />
            <s-stack direction="inline" gap="small-200" alignItems="end">
              <s-search-field
                label="Search purchase orders"
                labelAccessibilityVisibility="exclusive"
                name="q"
                value={search}
                placeholder="PO number, supplier, supplier order or invoice number"
              />
              <s-button type="submit">Search</s-button>
              {search && (
                <s-button href={listHref(list.view, "")} variant="tertiary">
                  Clear
                </s-button>
              )}
            </s-stack>
          </Form>

          {list.items.length === 0 ? (
            <s-paragraph>
              {search
                ? `No ${viewLabel} purchase orders match “${search}”.`
                : list.view === "open"
                  ? "No open purchase orders. Create one to order stock from a supplier."
                  : `No ${viewLabel} purchase orders.`}
            </s-paragraph>
          ) : (
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">
                  Purchase order
                </s-table-header>
                <s-table-header>Supplier</s-table-header>
                <s-table-header listSlot="secondary">Status</s-table-header>
                <s-table-header>Destination</s-table-header>
                <s-table-header>Expected</s-table-header>
                <s-table-header format="numeric">Received</s-table-header>
                <s-table-header format="currency">Total</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {list.items.map((po) => (
                  <s-table-row key={po.id}>
                    <s-table-cell>
                      <s-link href={`/app/purchase-orders/${po.id}`}>
                        {po.poNumber}
                      </s-link>
                    </s-table-cell>
                    <s-table-cell>{po.supplierName}</s-table-cell>
                    <s-table-cell>
                      <s-stack direction="inline" gap="small-200">
                        <s-badge tone={STATUS_TONES[po.status]}>
                          {STATUS_LABELS[po.status]}
                        </s-badge>
                        {po.archived && <s-badge>Archived</s-badge>}
                      </s-stack>
                    </s-table-cell>
                    <s-table-cell>
                      {locationNames[po.locationGid] ?? "Unknown location"}
                    </s-table-cell>
                    <s-table-cell>
                      <s-stack direction="inline" gap="small-200">
                        <s-text>{formatDay(po.expectedOn)}</s-text>
                        {po.overdue && (
                          <s-badge tone="critical">Overdue</s-badge>
                        )}
                      </s-stack>
                    </s-table-cell>
                    <s-table-cell>
                      {po.receivedUnits} of {po.orderedUnits}
                    </s-table-cell>
                    <s-table-cell>
                      {formatMoney(po.total, po.currency)}
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          )}

          {(list.page > 1 || list.hasNextPage) && (
            <s-stack direction="inline" gap="small-200" alignItems="center">
              {list.page > 1 && (
                <s-button href={listHref(list.view, search, list.page - 1)}>
                  Previous
                </s-button>
              )}
              <s-text color="subdued">Page {list.page}</s-text>
              {list.hasNextPage && (
                <s-button href={listHref(list.view, search, list.page + 1)}>
                  Next
                </s-button>
              )}
            </s-stack>
          )}
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
