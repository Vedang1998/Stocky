import { useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getShopEntitlements, requireCapability } from "../billing/entitlements.server";
import {
  LineDetailModal,
  type LineDetailContext,
} from "../components/replenishment/LineDetailModal";
import { OrderPanel } from "../components/replenishment/OrderPanel";
import type {
  PreviewFormValues,
  WorksheetActionResult,
} from "../components/replenishment/types";
import { WorksheetTable } from "../components/replenishment/WorksheetTable";
import { AnalyticsPrerequisiteError } from "../lib/analytics/errors";
import { localDateOf } from "../lib/analytics/shop-calendar";
import { SHOP_SCOPE } from "../lib/replenishment/scope";
import { getReplenishmentDefaults } from "../lib/replenishment/settings.server";
import {
  INCOMING_SOURCE_LABELS,
  MAX_QUANTITY,
  PARITY_METHOD_LABELS,
} from "../lib/replenishment/types";
import {
  describeMethod,
  describeSelection,
  formatInstant,
  formatLocalDate,
} from "../lib/replenishment/worksheet/describe";
import { WorksheetError } from "../lib/replenishment/worksheet/generate.server";
import { loadSetupOptions } from "../lib/replenishment/worksheet/options.server";
import { checkPurchaseOrderAllowance } from "../lib/replenishment/worksheet/order-limit.server";
import { createDraftOrders, getOrderGroups } from "../lib/replenishment/worksheet/orders.server";
import { previewLineSuggestion } from "../lib/replenishment/worksheet/preview.server";
import {
  draftOrderPort,
  purchasingSources,
} from "../lib/replenishment/worksheet/purchasing.server";
import {
  parseMethodParameters,
  setupFormFromSettings,
} from "../lib/replenishment/worksheet/settings";
import {
  getWorksheet,
  getWorksheetLine,
  getWorksheetTotals,
  loadWorksheetPage,
  setFinalQuantity,
  WorksheetEditError,
  type WorksheetHeader,
  type WorksheetLine,
} from "../lib/replenishment/worksheet/store.server";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZES,
  parseWorksheetView,
  WORKSHEET_SHOW,
  WORKSHEET_SHOW_LABELS,
  worksheetViewSearch,
  type WorksheetShow,
} from "../lib/replenishment/worksheet/view";
import { requirePurchasingContext } from "../services/purchasing/actor.server";
import { PurchasingError } from "../services/purchasing/errors";
import { readShopReportingProfile } from "../tenant/bootstrap.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import type { TenantDb } from "../tenant/tenant-db.server";

const NOT_FOUND =
  "That worksheet no longer exists. It may have been deleted, or replaced by newer worksheets.";

async function requireWorksheet(db: TenantDb, worksheetId: string | undefined) {
  const worksheet = worksheetId ? await getWorksheet(db, worksheetId) : null;
  if (!worksheet) {
    throw new Response(NOT_FOUND, {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return worksheet;
}

function describeRounding(worksheet: WorksheetHeader): string {
  const rounding = worksheet.settings?.rounding;
  if (!rounding) return "";
  const rules = [
    rounding.applyMinimumOrderQuantity ? "raised to supplier minimums" : null,
    rounding.roundUpToPackSize ? "rounded up to full packs" : null,
  ].filter((rule): rule is string => rule != null);
  return rules.length > 0 ? `Suggestions ${rules.join(" and ")}` : "No supplier rules applied";
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, db } = await requireAdminTenant({ request, params });
  requireCapability(await getShopEntitlements({ admin, db }), "core.replenishment");
  const worksheet = await requireWorksheet(db, params.worksheetId);
  const view = parseWorksheetView(new URL(request.url).searchParams);
  const selection = worksheet.settings?.selection ?? null;

  const [page, totals, orders, options, defaults, suppliers] = await Promise.all([
    loadWorksheetPage(db, worksheet.id, view),
    getWorksheetTotals(db, worksheet.id),
    getOrderGroups(db, worksheet.id),
    loadSetupOptions(db),
    getReplenishmentDefaults(db),
    selection?.supplierId ? purchasingSources.listSuppliers(db) : [],
  ]);

  const { summary, settings } = worksheet;
  const scopeLocation = options.locations.find((location) => location.gid === worksheet.scopeKey);
  const previewDefaults: PreviewFormValues | null = settings
    ? (({ method, sampleDays, suggestDays, startDate, endDate, targetQuantity }) => ({
        method,
        sampleDays,
        suggestDays,
        startDate,
        endDate,
        targetQuantity,
      }))(setupFormFromSettings(settings, defaults))
    : null;

  return {
    worksheet: {
      id: worksheet.id,
      generatedAt: formatInstant(worksheet.generatedAt, worksheet.timeZone),
      method: settings ? describeMethod(settings.params) : PARITY_METHOD_LABELS[worksheet.method],
      scope: worksheet.scopeName ?? "All locations together",
      selection: selection
        ? describeSelection(
            selection,
            selection.supplierId
              ? (suppliers.find((supplier) => supplier.id === selection.supplierId)?.name ??
                "Removed supplier")
              : null,
          )
        : "",
      incoming: settings ? INCOMING_SOURCE_LABELS[settings.incomingSource] : "",
      rounding: describeRounding(worksheet),
      readable: settings != null,
    },
    summary: summary && {
      currencyCode: summary.currencyCode,
      salesPeriod: `${formatLocalDate(summary.salesWindow.start)} to ${formatLocalDate(summary.salesWindow.end)}`,
      coverage: summary.coverage.kind,
      historyStart: summary.historyStartLocalDate
        ? formatLocalDate(summary.historyStartLocalDate)
        : null,
      notStockedAtLocation: summary.notStockedAtLocation,
      excludedOrders: summary.excludedOrders,
    },
    view: { ...view, page: page.page },
    lines: page.lines,
    matching: page.matching,
    pageCount: page.pageCount,
    totals,
    orders,
    // A worksheet for one location delivers there; its orders can't go elsewhere.
    destination:
      worksheet.scopeKey === SHOP_SCOPE
        ? null
        : { gid: worksheet.scopeKey, name: scopeLocation?.name ?? worksheet.scopeName ?? "" },
    locations: options.locations,
    previewDefaults,
  };
};

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** An empty quantity clears the merchant's number and returns to the suggestion. */
function parseQuantity(text: string): number | null | "invalid" {
  if (text === "") return null;
  if (!/^\d{1,8}$/.test(text)) return "invalid";
  return Number(text);
}

export const action = async ({
  request,
  params,
}: ActionFunctionArgs): Promise<WorksheetActionResult> => {
  const { admin, tenant, db, actor } = await requirePurchasingContext({ request, params });
  const entitlements = await getShopEntitlements({ admin, db });
  requireCapability(entitlements, "core.replenishment");
  const worksheet = await requireWorksheet(db, params.worksheetId);
  const form = await request.formData();
  const intent = field(form, "intent");
  const lineId = field(form, "lineId");

  if (intent === "setQuantity") {
    const quantity = parseQuantity(field(form, "quantity"));
    if (quantity === "invalid") {
      return {
        intent,
        lineId,
        ok: false,
        message: `Enter a whole number from 0 to ${MAX_QUANTITY.toLocaleString("en-US")}.`,
      };
    }
    try {
      const saved = await setFinalQuantity(db, { worksheetId: worksheet.id, lineId, quantity });
      return { intent, lineId, ok: true, ...saved };
    } catch (error) {
      if (error instanceof WorksheetEditError) {
        return { intent, lineId, ok: false, message: error.message };
      }
      throw error;
    }
  }

  if (intent === "preview") {
    const { settings, summary } = worksheet;
    if (!settings) {
      return {
        intent,
        lineId,
        ok: false,
        errors: {},
        message:
          "This worksheet was saved by another version of the app and can't be recalculated. Generate a new worksheet to try other periods.",
      };
    }
    const parsed = parseMethodParameters(form, worksheet.asOfLocalDate);
    if (!parsed.ok) return { intent, lineId, ok: false, errors: parsed.errors };
    const line = await getWorksheetLine(db, worksheet.id, lineId);
    if (!line) {
      return {
        intent,
        lineId,
        ok: false,
        errors: {},
        message: "That row is no longer on this worksheet.",
      };
    }
    try {
      const profile = await readShopReportingProfile(tenant);
      const suggestion = await previewLineSuggestion(db, {
        worksheet: {
          asOfLocalDate: worksheet.asOfLocalDate,
          timeZone: worksheet.timeZone,
          settings,
          currencyCode: summary?.currencyCode ?? profile.currencyCode,
        },
        line,
        params: parsed.params,
        installedAt: profile.installedAt,
      });
      return { intent, lineId, ok: true, suggestion };
    } catch (error) {
      if (error instanceof AnalyticsPrerequisiteError) {
        return {
          intent,
          lineId,
          ok: false,
          errors: {},
          message:
            "Your store's time zone and currency have not synced from Shopify yet. Try again in a few minutes.",
        };
      }
      throw error;
    }
  }

  if (intent === "createOrders") {
    const supplierIds = form
      .getAll("supplierId")
      .filter((value): value is string => typeof value === "string" && value !== "");
    const now = new Date();
    try {
      const port = draftOrderPort(db, {
        actor,
        admin,
        today: localDateOf(now, worksheet.timeZone),
      });
      const { groups } = await getOrderGroups(db, worksheet.id);
      const requested = groups
        .filter((group) => supplierIds.includes(group.supplierId))
        .reduce((count, group) => count + Math.ceil(group.lines / port.maxLinesPerOrder), 0);
      if (requested > 0) {
        const allowance = await checkPurchaseOrderAllowance(db, entitlements, requested, now);
        if (!allowance.allowed) return { intent, ok: false, message: allowance.message };
      }
      const orders = await createDraftOrders(db, port, {
        worksheet: { id: worksheet.id, scopeKey: worksheet.scopeKey },
        supplierIds,
        locationGid: field(form, "locationGid") || null,
      });
      return { intent, ok: true, orders };
    } catch (error) {
      if (error instanceof WorksheetError || error instanceof PurchasingError) {
        return { intent, ok: false, message: error.message };
      }
      throw error;
    }
  }

  throw new Response("Unknown action.", {
    status: 400,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};

const DETAIL_MODAL_ID = "worksheet-line-detail";

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <s-stack direction="block" gap="none">
      <s-text color="subdued">{label}</s-text>
      <s-text type="strong">{value.toLocaleString("en-US")}</s-text>
    </s-stack>
  );
}

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
}

export default function Worksheet() {
  const data = useLoaderData<typeof loader>();
  const { worksheet, summary, view, lines, matching, pageCount, totals } = data;
  const navigate = useNavigate();
  const [selected, setSelected] = useState<WorksheetLine | null>(null);

  const path = `/app/replenishment/${worksheet.id}`;
  const to = (changes: Parameters<typeof worksheetViewSearch>[1]) => {
    const search = worksheetViewSearch(view, changes).toString();
    return search ? `${path}?${search}` : path;
  };
  const exportSearch = worksheetViewSearch(view, { page: 1 }).toString();

  // The open row follows the loaded page, so an edit shows up in the detail.
  const detailLine = selected
    ? (lines.find((line) => line.id === selected.id) ?? selected)
    : null;
  const detailContext: LineDetailContext = {
    currencyCode: summary?.currencyCode ?? null,
    salesPeriod: summary?.salesPeriod ?? "",
    incomingLabel: worksheet.incoming,
  };

  const first = matching === 0 ? 0 : (view.page - 1) * view.pageSize + 1;
  const last = Math.min(matching, view.page * view.pageSize);
  const excluded = summary?.excludedOrders;
  const unreadableSales = excluded ? excluded.inconsistentUnits + excluded.missingSalesRecords : 0;

  return (
    <s-page heading="Replenishment worksheet" inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app/replenishment">
        Replenishment
      </s-link>
      <s-button
        slot="secondary-actions"
        href={`${path}/export${exportSearch ? `?${exportSearch}` : ""}`}
        target="_blank"
      >
        Export CSV
      </s-button>
      <s-button slot="secondary-actions" href={`/app/replenishment?from=${worksheet.id}`}>
        Generate again
      </s-button>

      {!worksheet.readable && (
        <s-banner tone="warning" heading="This worksheet can't be recalculated">
          <s-paragraph>
            It was saved by another version of the app. The quantities are shown as saved; generate
            a new worksheet to change the method or period.
          </s-paragraph>
        </s-banner>
      )}
      {summary?.coverage === "NONE" && (
        <s-banner tone="warning" heading="No sales history for this period">
          <s-paragraph>
            {summary.historyStart
              ? `The app's order history starts on ${summary.historyStart}, after the sales period (${summary.salesPeriod}).`
              : `The app has no order history yet for the sales period (${summary.salesPeriod}).`}{" "}
            Sales figures are blank rather than zero, and nothing is suggested from sales.
          </s-paragraph>
        </s-banner>
      )}
      {summary?.coverage === "PARTIAL" && (
        <s-banner tone="warning" heading="Sales history covers only part of this period">
          <s-paragraph>
            The app's order history starts on {summary.historyStart ?? "a later date"}, inside the
            sales period ({summary.salesPeriod}). Sales before that date are not counted, so
            suggestions may be low.
          </s-paragraph>
        </s-banner>
      )}
      {unreadableSales > 0 && (
        <s-banner tone="warning" heading="Some orders could not be counted">
          <s-paragraph>
            {plural(unreadableSales, "order", "orders")} in the sales period{" "}
            {unreadableSales === 1 ? "has" : "have"} sales records that are missing or don't add
            up, so {unreadableSales === 1 ? "its" : "their"} units are left out. They are picked up
            once the order sync has caught up.
          </s-paragraph>
        </s-banner>
      )}

      <s-section heading={`Generated ${worksheet.generatedAt}`}>
        <s-stack direction="block" gap="base">
          <s-stack direction="block" gap="small-200">
            <s-text>{worksheet.method}</s-text>
            <s-text color="subdued">
              {[
                `Stock: ${worksheet.scope}`,
                worksheet.selection,
                worksheet.incoming ? `Incoming: ${worksheet.incoming}` : "",
                worksheet.rounding,
              ]
                .filter(Boolean)
                .join(" · ")}
            </s-text>
            {summary && (
              <s-text color="subdued">
                {[
                  `Sales period: ${summary.salesPeriod}`,
                  excluded && excluded.test > 0
                    ? `${plural(excluded.test, "test order", "test orders")} left out`
                    : "",
                  excluded && excluded.cancelled > 0
                    ? `${plural(excluded.cancelled, "cancelled order", "cancelled orders")} left out`
                    : "",
                  summary.notStockedAtLocation > 0
                    ? `${plural(summary.notStockedAtLocation, "variant", "variants")} not stocked at this location left out`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </s-text>
            )}
          </s-stack>
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(130px, 1fr))" gap="base">
            <Metric label="Variants" value={totals.variants} />
            <Metric label="Rows to order" value={totals.toOrder} />
            <Metric label="Units to order" value={totals.unitsToOrder} />
            <Metric label="Low or out of stock" value={totals.lowStock} />
            <Metric label="With warnings" value={totals.withWarnings} />
            <Metric label="Edited by you" value={totals.edited} />
            <Metric label="On purchase orders" value={totals.ordered} />
          </s-grid>
        </s-stack>
      </s-section>

      <s-section heading="Variants">
        <s-stack direction="block" gap="base">
          <Form
            method="get"
            onKeyDown={(event) => {
              // Polaris text fields do not submit their form on Enter.
              if (event.key !== "Enter") return;
              event.preventDefault();
              event.currentTarget.requestSubmit();
            }}
          >
            {view.show !== "ALL" && <input type="hidden" name="show" value={view.show} />}
            {(view.sort.key !== "product" || view.sort.direction !== "asc") && (
              <>
                <input type="hidden" name="sort" value={view.sort.key} />
                <input type="hidden" name="dir" value={view.sort.direction} />
              </>
            )}
            {view.pageSize !== DEFAULT_PAGE_SIZE && <input type="hidden" name="perPage" value={view.pageSize} />}
            <s-grid gridTemplateColumns="1fr auto auto auto" gap="base" alignItems="end">
              <s-search-field
                label="Search"
                labelAccessibilityVisibility="exclusive"
                name="q"
                placeholder="Search by product, SKU, barcode or supplier SKU"
                value={view.query}
              />
              <s-button type="submit">Search</s-button>
              <s-select
                label="Show"
                labelAccessibilityVisibility="exclusive"
                value={view.show}
                onChange={(event) =>
                  navigate(to({ show: event.currentTarget.value as WorksheetShow }))
                }
              >
                {WORKSHEET_SHOW.map((value) => (
                  <s-option key={value} value={value}>
                    {WORKSHEET_SHOW_LABELS[value]}
                  </s-option>
                ))}
              </s-select>
              <s-select
                label="Rows per page"
                labelAccessibilityVisibility="exclusive"
                value={String(view.pageSize)}
                onChange={(event) => navigate(to({ pageSize: Number(event.currentTarget.value) }))}
              >
                {PAGE_SIZES.map((size) => (
                  <s-option key={size} value={String(size)}>
                    {size} per page
                  </s-option>
                ))}
              </s-select>
            </s-grid>
          </Form>

          {lines.length === 0 ? (
            <s-stack direction="block" gap="small-200">
              <s-paragraph>
                {view.query || view.show !== "ALL"
                  ? "No variants match this search and filter."
                  : "This worksheet has no variants."}
              </s-paragraph>
              {(view.query || view.show !== "ALL") && (
                <s-link href={to({ query: "", show: "ALL" })}>Show all variants</s-link>
              )}
            </s-stack>
          ) : (
            <>
              <WorksheetTable
                lines={lines}
                view={view}
                path={path}
                detailModalId={DETAIL_MODAL_ID}
                onOpenDetail={setSelected}
              />
              <s-stack direction="inline" gap="base" alignItems="center">
                <s-text color="subdued">
                  {first.toLocaleString("en-US")} to {last.toLocaleString("en-US")} of{" "}
                  {plural(matching, "variant", "variants")}
                </s-text>
                <s-button
                  href={to({ page: view.page - 1 })}
                  accessibilityLabel="Previous page"
                  {...(view.page <= 1 ? { disabled: true } : {})}
                >
                  Previous
                </s-button>
                <s-button
                  href={to({ page: view.page + 1 })}
                  accessibilityLabel="Next page"
                  {...(view.page >= pageCount ? { disabled: true } : {})}
                >
                  Next
                </s-button>
              </s-stack>
            </>
          )}
        </s-stack>
      </s-section>

      <OrderPanel
        groups={data.orders.groups}
        linesWithoutSupplier={data.orders.linesWithoutSupplier}
        destination={data.destination}
        locations={data.locations}
      />

      <LineDetailModal
        id={DETAIL_MODAL_ID}
        line={detailLine}
        context={detailContext}
        previewDefaults={data.previewDefaults}
      />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
