import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { isInventoryWriteEnabled } from "../lib/feature-flags.server";
import { RECEIVING_OFF_MESSAGE } from "../lib/po-display";
import { formatDay } from "../lib/purchasing/display";
import { STATUS_LABELS, STATUS_TONES } from "../lib/purchasing/status";
import { submitOnEnter } from "../lib/submit-on-enter";
import { listLocations } from "../services/purchasing/locations.server";
import { listPurchaseOrders } from "../services/purchasing/purchase-order-list.server";
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
  const search = (url.searchParams.get("q") ?? "").trim().slice(0, 100);

  const [profile, locations] = await Promise.all([
    readShopProfile(admin),
    listLocations(db, admin),
  ]);
  // Only a location this shop has narrows the list; anything else shows all.
  const requestedLocation = url.searchParams.get("location") ?? "";
  const location = locations.some((l) => l.gid === requestedLocation)
    ? requestedLocation
    : "";

  const list = await listPurchaseOrders(db, {
    view: "incoming",
    search,
    locationGid: location || null,
    page: readPage(url.searchParams.get("page")),
    today: profile.today,
  });

  return {
    orders: list.items.map((po) => ({
      id: po.id,
      poNumber: po.poNumber,
      status: po.status,
      supplierName: po.supplierName,
      locationName:
        locations.find((l) => l.gid === po.locationGid)?.name ??
        "Unknown location",
      expectedOn: po.expectedOn,
      overdue: po.overdue,
      orderedUnits: po.orderedUnits,
      receivedUnits: po.receivedUnits,
      remainingUnits: po.remainingUnits,
    })),
    page: list.page,
    hasNextPage: list.hasNextPage,
    search,
    location,
    locations: locations.map((l) => ({ gid: l.gid, name: l.name })),
    receivingEnabled: isInventoryWriteEnabled("receiptWrites"),
  };
};

function listHref(search: string, location: string, page = 1): string {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (location) params.set("location", location);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/app/warehouse?${query}` : "/app/warehouse";
}

function units(value: number): string {
  return `${value} ${value === 1 ? "unit" : "units"}`;
}

export default function Warehouse() {
  const {
    orders,
    page,
    hasNextPage,
    search,
    location,
    locations,
    receivingEnabled,
  } = useLoaderData<typeof loader>();
  const filtered = Boolean(search || location);

  return (
    <s-page heading="Receiving">
      {!receivingEnabled && (
        <s-banner tone="info" heading="Receiving is turned off for this store">
          <s-paragraph>{RECEIVING_OFF_MESSAGE}</s-paragraph>
        </s-banner>
      )}

      <s-section>
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Purchase orders sent to suppliers that still have units to
            receive. Open one to count the delivery, scan barcodes and print
            labels for what arrived.
          </s-paragraph>

          <Form method="get" onKeyDown={submitOnEnter}>
            <s-stack direction="inline" gap="small-200" alignItems="end">
              <s-search-field
                label="Search incoming orders"
                labelAccessibilityVisibility="exclusive"
                name="q"
                value={search}
                placeholder="PO number, supplier, supplier order or invoice number"
              />
              {locations.length > 1 && (
                <s-select label="Destination" name="location" value={location}>
                  <s-option value="">All locations</s-option>
                  {locations.map((l) => (
                    <s-option key={l.gid} value={l.gid}>
                      {l.name}
                    </s-option>
                  ))}
                </s-select>
              )}
              <s-button type="submit">Search</s-button>
              {filtered && (
                <s-button href="/app/warehouse" variant="tertiary">
                  Clear
                </s-button>
              )}
            </s-stack>
          </Form>

          {orders.length === 0 ? (
            <s-paragraph>
              {filtered
                ? "No incoming purchase orders match."
                : "Nothing to receive. Purchase orders appear here once they are sent to the supplier."}
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
                <s-table-header format="numeric">Still to receive</s-table-header>
                <s-table-header>Receive</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {orders.map((po) => (
                  <s-table-row key={po.id}>
                    <s-table-cell>
                      <s-link href={`/app/purchase-orders/${po.id}`}>
                        {po.poNumber}
                      </s-link>
                    </s-table-cell>
                    <s-table-cell>{po.supplierName}</s-table-cell>
                    <s-table-cell>
                      <s-badge tone={STATUS_TONES[po.status]}>
                        {STATUS_LABELS[po.status]}
                      </s-badge>
                    </s-table-cell>
                    <s-table-cell>{po.locationName}</s-table-cell>
                    <s-table-cell>
                      <s-stack direction="inline" gap="small-200">
                        <s-text>{formatDay(po.expectedOn)}</s-text>
                        {po.overdue && (
                          <s-badge tone="critical">Overdue</s-badge>
                        )}
                      </s-stack>
                    </s-table-cell>
                    <s-table-cell>
                      {units(po.remainingUnits)} ({po.receivedUnits} of{" "}
                      {po.orderedUnits} received)
                    </s-table-cell>
                    <s-table-cell>
                      <s-button
                        href={`/app/purchase-orders/${po.id}/receive`}
                        variant="primary"
                        accessibilityLabel={`Receive ${po.poNumber}`}
                      >
                        Receive
                      </s-button>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          )}

          {(page > 1 || hasNextPage) && (
            <s-stack direction="inline" gap="small-200" alignItems="center">
              {page > 1 && (
                <s-button href={listHref(search, location, page - 1)}>
                  Previous
                </s-button>
              )}
              <s-text color="subdued">Page {page}</s-text>
              {hasNextPage && (
                <s-button href={listHref(search, location, page + 1)}>
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
