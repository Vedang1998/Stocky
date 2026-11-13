import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ActionFeedback } from "../components/ActionFeedback";
import { isInventoryWriteEnabled } from "../lib/feature-flags.server";
import { submitOnEnter } from "../lib/submit-on-enter";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import { requireAdminTenantWithActor } from "../services/inventory-writes/actor.server";
import { readFormId } from "../services/inventory-writes/form-values";
import { listSyncedLocations } from "../services/inventory-writes/locations.server";
import {
  listStocktakes,
  readListView,
  readPageNumber,
  type StocktakeListView,
} from "../services/stocktakes/stocktake-read.server";
import { createStocktake } from "../services/stocktakes/stocktake.server";
import { MAX_STOCKTAKE_NAME_LENGTH } from "../services/stocktakes/stocktake-limits";
import {
  formatUtc,
  STOCKTAKE_SCOPE_LABEL,
  STOCKTAKE_STATUS_BADGE,
} from "../services/stocktakes/stocktake-display";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { db } = await requireAdminTenant({ request });
  const params = new URL(request.url).searchParams;
  const view = readListView(params.get("view"));
  const page = readPageNumber(params.get("page"));

  const [{ stocktakes, hasMore }, locations] = await Promise.all([
    listStocktakes(db, { view, page }),
    listSyncedLocations(db),
  ]);
  return {
    stocktakes,
    hasMore,
    view,
    page,
    locations,
    writesEnabled: isInventoryWriteEnabled("stocktakeInventoryWrites"),
  };
};

interface CreateValues {
  name: string;
  locationId: string;
  scope: string;
  blind: string;
}

const text = (value: FormDataEntryValue | null): string =>
  typeof value === "string" ? value : "";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { tenant, db, actor } = await requireAdminTenantWithActor({ request });
  const form = await request.formData();
  if (form.get("intent") !== "create") {
    return { error: "That action is not available." };
  }

  const values: CreateValues = {
    name: text(form.get("name")).slice(0, MAX_STOCKTAKE_NAME_LENGTH + 1),
    locationId: text(form.get("locationId")),
    scope: text(form.get("scope")),
    blind: text(form.get("blind")),
  };
  const result = await createStocktake(db, {
    shop: tenant.myshopifyDomain,
    locationId: readFormId(values.locationId),
    name: values.name,
    scope: values.scope || "FULL",
    blind: values.blind === "hide",
    actor,
  });
  if (!result.ok) return { error: result.error, values };
  return redirect(`/app/stocktakes/${result.stocktakeId}`);
};

/** Marks the option a select should start on; Polaris ignores a `value` attribute in server-rendered markup. */
const chosen = (isChosen: boolean) => (isChosen ? { selected: true } : {});

function listHref(view: StocktakeListView, page: number): string {
  const params = new URLSearchParams();
  if (view !== "open") params.set("view", view);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/app/stocktakes${query ? `?${query}` : ""}`;
}

export default function Stocktakes() {
  const { stocktakes, hasMore, view, page, locations, writesEnabled } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";

  const values: Partial<CreateValues> =
    actionData && "values" in actionData ? (actionData.values ?? {}) : {};
  const activeLocations = locations.filter((location) => location.isActive);
  const locationName = (id: string) =>
    locations.find((location) => location.id === id)?.name ??
    "Location no longer in Shopify";

  return (
    <s-page heading="Stocktakes">
      {!writesEnabled && (
        <s-banner
          tone="warning"
          heading="Stock changes from counts are switched off"
        >
          <s-paragraph>
            Counts can be started and counted. Completing a count, which changes
            stock in Shopify, stays unavailable until it is switched on for this
            app.
          </s-paragraph>
        </s-banner>
      )}
      <ActionFeedback data={actionData} errorHeading="Stocktake issue" />

      <s-section heading="Start a count">
        {activeLocations.length === 0 ? (
          <s-paragraph>
            No active locations are synced yet. Run a sync from the dashboard,
            then start a count.
          </s-paragraph>
        ) : (
          <Form method="post" onKeyDown={submitOnEnter}>
            <input type="hidden" name="intent" value="create" />
            <s-stack direction="block" gap="base">
              <s-grid
                gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))"
                gap="base"
              >
                <s-text-field
                  label="Name"
                  name="name"
                  placeholder="Monthly count"
                  maxLength={MAX_STOCKTAKE_NAME_LENGTH}
                  value={values.name ?? ""}
                />
                <s-select label="Location" name="locationId" required>
                  {activeLocations.map((location) => (
                    <s-option
                      key={location.id}
                      value={location.id}
                      {...chosen(values.locationId === location.id)}
                    >
                      {location.name}
                    </s-option>
                  ))}
                </s-select>
                <s-select label="What to count" name="scope">
                  <s-option
                    value="FULL"
                    {...chosen(values.scope !== "PARTIAL")}
                  >
                    Everything stocked at the location
                  </s-option>
                  <s-option
                    value="PARTIAL"
                    {...chosen(values.scope === "PARTIAL")}
                  >
                    Only the items scanned or added
                  </s-option>
                </s-select>
                <s-select label="Expected quantities" name="blind">
                  <s-option value="show" {...chosen(values.blind !== "hide")}>
                    Show while counting
                  </s-option>
                  <s-option value="hide" {...chosen(values.blind === "hide")}>
                    Hide while counting (blind count)
                  </s-option>
                </s-select>
              </s-grid>
              <s-stack direction="inline" gap="base" alignItems="center">
                <s-button
                  type="submit"
                  variant="primary"
                  {...(busy ? { disabled: true } : {})}
                >
                  Start count
                </s-button>
                <s-text color="subdued">
                  Expected quantities are frozen from Shopify&apos;s on-hand
                  stock at the location when the count starts.
                </s-text>
              </s-stack>
            </s-stack>
          </Form>
        )}
      </s-section>

      <s-section heading={view === "open" ? "Open counts" : "Closed counts"}>
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base">
            {view === "open" ? (
              <s-link href={listHref("closed", 1)}>
                Show completed and cancelled counts
              </s-link>
            ) : (
              <s-link href={listHref("open", 1)}>Show open counts</s-link>
            )}
          </s-stack>

          {stocktakes.length === 0 ? (
            <s-paragraph>
              {view === "open"
                ? "No count is in progress."
                : page > 1
                  ? "No more counts."
                  : "No count has been completed or cancelled yet."}
            </s-paragraph>
          ) : (
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Count</s-table-header>
                <s-table-header>Location</s-table-header>
                <s-table-header listSlot="secondary">Status</s-table-header>
                <s-table-header>Type</s-table-header>
                <s-table-header>Counted</s-table-header>
                <s-table-header>Started</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {stocktakes.map((stocktake) => {
                  const badge = STOCKTAKE_STATUS_BADGE[stocktake.status];
                  return (
                    <s-table-row key={stocktake.id}>
                      <s-table-cell>
                        <s-link href={`/app/stocktakes/${stocktake.id}`}>
                          {stocktake.name}
                        </s-link>
                      </s-table-cell>
                      <s-table-cell>
                        {locationName(stocktake.locationId)}
                      </s-table-cell>
                      <s-table-cell>
                        <s-badge tone={badge.tone}>{badge.label}</s-badge>
                      </s-table-cell>
                      <s-table-cell>
                        {STOCKTAKE_SCOPE_LABEL[stocktake.scope]}
                        {stocktake.blind ? ", blind" : ""}
                      </s-table-cell>
                      <s-table-cell>
                        {stocktake.countedCount.toLocaleString("en-US")} of{" "}
                        {stocktake.lineCount.toLocaleString("en-US")}
                      </s-table-cell>
                      <s-table-cell>
                        {formatUtc(stocktake.startedAt ?? stocktake.createdAt)}
                      </s-table-cell>
                    </s-table-row>
                  );
                })}
              </s-table-body>
            </s-table>
          )}

          {(page > 1 || hasMore) && (
            <s-stack direction="inline" gap="base">
              {page > 1 && (
                <s-link href={listHref(view, page - 1)}>Newer counts</s-link>
              )}
              {hasMore && (
                <s-link href={listHref(view, page + 1)}>Older counts</s-link>
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
