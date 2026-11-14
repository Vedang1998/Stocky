import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { submitOnEnter } from "../lib/submit-on-enter";
import { listSuppliers } from "../services/purchasing/suppliers.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";

const MAX_PAGE = 10_000;

function readPage(value: string | null): number {
  if (!value || !/^\d{1,5}$/.test(value)) return 1;
  const page = Number(value);
  return page >= 1 && page <= MAX_PAGE ? page : 1;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { db } = await requireAdminTenant({ request });
  const url = new URL(request.url);
  const archived = url.searchParams.get("status") === "archived";
  const search = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const list = await listSuppliers(db, {
    status: archived ? "ARCHIVED" : "ACTIVE",
    search,
    page: readPage(url.searchParams.get("page")),
  });
  return { ...list, archived, search };
};

function listHref(archived: boolean, search: string, page = 1): string {
  const params = new URLSearchParams();
  if (archived) params.set("status", "archived");
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/app/suppliers?${query}` : "/app/suppliers";
}

function leadTime(days: number | null, measured: number | null): string {
  if (days !== null) return `${days} ${days === 1 ? "day" : "days"}`;
  if (measured !== null) return `${measured.toFixed(1)} days measured`;
  return "—";
}

export default function Suppliers() {
  const { suppliers, page, hasNextPage, archived, search } =
    useLoaderData<typeof loader>();

  return (
    <s-page heading="Suppliers">
      <s-button
        slot="primary-action"
        variant="primary"
        href="/app/suppliers/new"
      >
        Add supplier
      </s-button>

      <s-section>
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="small-200">
            <s-button
              href={listHref(false, search)}
              variant={archived ? "tertiary" : "primary"}
            >
              Active
            </s-button>
            <s-button
              href={listHref(true, search)}
              variant={archived ? "primary" : "tertiary"}
            >
              Archived
            </s-button>
          </s-stack>

          <Form method="get" onKeyDown={submitOnEnter}>
            {archived && <input type="hidden" name="status" value="archived" />}
            <s-stack direction="inline" gap="small-200" alignItems="end">
              <s-search-field
                label="Search suppliers"
                labelAccessibilityVisibility="exclusive"
                name="q"
                value={search}
                placeholder="Name, account number or contact"
              />
              <s-button type="submit">Search</s-button>
              {search && (
                <s-button href={listHref(archived, "")} variant="tertiary">
                  Clear
                </s-button>
              )}
            </s-stack>
          </Form>

          {suppliers.length === 0 ? (
            <s-paragraph>
              {search
                ? `No ${archived ? "archived" : "active"} suppliers match “${search}”.`
                : archived
                  ? "No archived suppliers."
                  : "No suppliers yet. Add the companies you buy stock from, then create purchase orders for them."}
            </s-paragraph>
          ) : (
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Supplier</s-table-header>
                <s-table-header listSlot="secondary">Contact</s-table-header>
                <s-table-header>Currency</s-table-header>
                <s-table-header format="numeric">Products</s-table-header>
                <s-table-header format="numeric">Open orders</s-table-header>
                <s-table-header>Lead time</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {suppliers.map((supplier) => (
                  <s-table-row key={supplier.id}>
                    <s-table-cell>
                      <s-link href={`/app/suppliers/${supplier.id}`}>
                        {supplier.name}
                      </s-link>
                    </s-table-cell>
                    <s-table-cell>
                      {[supplier.contactName, supplier.contactEmail]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </s-table-cell>
                    <s-table-cell>{supplier.currency}</s-table-cell>
                    <s-table-cell>{supplier.productCount}</s-table-cell>
                    <s-table-cell>{supplier.openOrderCount}</s-table-cell>
                    <s-table-cell>
                      {leadTime(
                        supplier.defaultLeadTimeDays,
                        supplier.measuredLeadTimeDays,
                      )}
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          )}

          {(page > 1 || hasNextPage) && (
            <s-stack direction="inline" gap="small-200" alignItems="center">
              {page > 1 && (
                <s-button href={listHref(archived, search, page - 1)}>
                  Previous
                </s-button>
              )}
              <s-text color="subdued">Page {page}</s-text>
              {hasNextPage && (
                <s-button href={listHref(archived, search, page + 1)}>
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
