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
import { requireActivePlanSnapshot } from "../billing/entitlements.server";
import { ActionFeedback } from "../components/ActionFeedback";
import { PlanRequiredBanner } from "../components/PlanRequiredBanner";
import { isInventoryWriteEnabled } from "../lib/feature-flags.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import {
  requireAdminTenantWithActor,
  STAFF_REQUIRED_MESSAGE,
} from "../services/inventory-writes/actor.server";
import { readFormId } from "../services/inventory-writes/form-values";
import { listSyncedLocations } from "../services/inventory-writes/locations.server";
import { planAllowsChanges } from "../services/inventory-writes/plan-access.server";
import { readShopTimeZone } from "../services/inventory-writes/shop-clock.server";
import { formatShopTime } from "../services/inventory-writes/shop-time";
import { readPageNumber } from "../services/stocktakes/stocktake-read.server";
import { createTransfer } from "../services/transfers/transfer.server";
import {
  listTransfers,
  readTransferListView,
  type TransferListEntry,
  type TransferListView,
} from "../services/transfers/transfer-read.server";
import {
  transferReference,
  transferStatusBadge,
  unitCount,
} from "../services/transfers/transfer-display";
import { MAX_TRANSFER_NOTES_LENGTH } from "../services/transfers/transfer-quantities";
import { SYNC_CATALOG_HINT } from "../lib/sync-copy";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { db, tenant } = await requireAdminTenant({ request });
  const params = new URL(request.url).searchParams;
  const view = readTransferListView(params.get("view"));
  const page = readPageNumber(params.get("page"));

  const [{ transfers, hasMore }, locations, planActive, timeZone] =
    await Promise.all([
      listTransfers(db, { view, page }),
      listSyncedLocations(db),
      planAllowsChanges(db),
      readShopTimeZone(tenant),
    ]);
  return {
    transfers,
    hasMore,
    view,
    page,
    locations,
    planActive,
    timeZone,
    writesEnabled: isInventoryWriteEnabled("transferWrites"),
  };
};

interface CreateValues {
  sourceLocationId: string;
  destinationLocationId: string;
  notes: string;
}

const text = (value: FormDataEntryValue | null): string =>
  typeof value === "string" ? value : "";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { tenant, db, actor } = await requireAdminTenantWithActor({ request });
  await requireActivePlanSnapshot(db);
  const form = await request.formData();
  if (form.get("intent") !== "create") {
    return { error: "That action is not available." };
  }

  const values: CreateValues = {
    sourceLocationId: text(form.get("sourceLocationId")),
    destinationLocationId: text(form.get("destinationLocationId")),
    notes: text(form.get("notes")).slice(0, MAX_TRANSFER_NOTES_LENGTH + 1),
  };
  // Refused with what was entered, so the form is not emptied.
  if (!actor) return { error: STAFF_REQUIRED_MESSAGE, values };
  const result = await createTransfer(db, {
    shop: tenant.myshopifyDomain,
    sourceLocationId: readFormId(values.sourceLocationId) ?? "",
    destinationLocationId: readFormId(values.destinationLocationId) ?? "",
    notes: values.notes,
    actor,
  });
  if (!result.ok) return { error: result.error, values };
  return redirect(`/app/transfers/${result.transferId}`);
};

/** Marks the option a select should start on; Polaris ignores a `value` attribute in server-rendered markup. */
const chosen = (isChosen: boolean) => (isChosen ? { selected: true } : {});

function listHref(view: TransferListView, page: number): string {
  const params = new URLSearchParams();
  if (view !== "open") params.set("view", view);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/app/transfers${query ? `?${query}` : ""}`;
}

/** Where a transfer's units stand, in one line for the list. */
function unitsSummary({ status, totals }: TransferListEntry): string {
  if (totals.lineCount === 0) return "No items yet";
  switch (status) {
    case "DRAFT":
      return `${unitCount(totals.shipUnits)} to ship`;
    case "CANCELLED":
      return `${unitCount(totals.requestedUnits)} requested`;
    case "IN_TRANSIT":
      return `${totals.receivedUnits.toLocaleString("en-US")} of ${unitCount(totals.shipUnits)} received`;
    case "RECEIVED": {
      const parts = [
        `${totals.receivedUnits.toLocaleString("en-US")} of ${unitCount(totals.shipUnits)} received`,
      ];
      if (totals.rejectedUnits > 0) {
        parts.push(`${totals.rejectedUnits.toLocaleString("en-US")} rejected`);
      }
      if (totals.returnedUnits > 0) {
        parts.push(`${totals.returnedUnits.toLocaleString("en-US")} returned`);
      }
      if (totals.writtenOffUnits > 0) {
        parts.push(
          `${totals.writtenOffUnits.toLocaleString("en-US")} written off`,
        );
      }
      return parts.join(", ");
    }
  }
}

export default function Transfers() {
  const {
    transfers,
    hasMore,
    view,
    page,
    locations,
    planActive,
    timeZone,
    writesEnabled,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  // Nothing is submitted twice, and nothing at all without an active plan.
  const locked = useNavigation().state !== "idle" || !planActive;

  const values: Partial<CreateValues> =
    actionData && "values" in actionData ? (actionData.values ?? {}) : {};
  const activeLocations = locations.filter((location) => location.isActive);
  const locationName = (id: string) =>
    locations.find((location) => location.id === id)?.name ??
    "Location no longer in Shopify";

  return (
    <s-page heading="Transfers">
      {!planActive && <PlanRequiredBanner records="Transfers" />}
      {!writesEnabled && (
        <s-banner
          tone="warning"
          heading="Stock changes from transfers are switched off"
        >
          <s-paragraph>
            Transfers can be drafted and their items edited. Shipping and
            receiving, which change stock in Shopify, stay unavailable until
            they are switched on for this app.
          </s-paragraph>
        </s-banner>
      )}
      <ActionFeedback data={actionData} errorHeading="Transfer issue" />

      <s-section heading="New transfer">
        {activeLocations.length < 2 ? (
          <s-paragraph>
            A transfer moves stock between two locations, and fewer than two
            active locations are synced. {SYNC_CATALOG_HINT}, then create a
            transfer.
          </s-paragraph>
        ) : (
          <Form method="post">
            <input type="hidden" name="intent" value="create" />
            <s-stack direction="block" gap="base">
              <s-grid
                gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))"
                gap="base"
              >
                <s-select label="From" name="sourceLocationId" required>
                  {activeLocations.map((location, index) => (
                    <s-option
                      key={location.id}
                      value={location.id}
                      {...chosen(
                        values.sourceLocationId
                          ? values.sourceLocationId === location.id
                          : index === 0,
                      )}
                    >
                      {location.name}
                    </s-option>
                  ))}
                </s-select>
                <s-select label="To" name="destinationLocationId" required>
                  {activeLocations.map((location, index) => (
                    <s-option
                      key={location.id}
                      value={location.id}
                      {...chosen(
                        values.destinationLocationId
                          ? values.destinationLocationId === location.id
                          : index === 1,
                      )}
                    >
                      {location.name}
                    </s-option>
                  ))}
                </s-select>
                <s-text-field
                  label="Notes"
                  name="notes"
                  maxLength={MAX_TRANSFER_NOTES_LENGTH}
                  value={values.notes ?? ""}
                />
              </s-grid>
              <s-stack direction="inline" gap="base" alignItems="center">
                <s-button
                  type="submit"
                  variant="primary"
                  {...(locked ? { disabled: true } : {})}
                >
                  Create draft
                </s-button>
                <s-text color="subdued">
                  Items are added on the next page. Nothing changes in Shopify
                  until the transfer is shipped.
                </s-text>
              </s-stack>
            </s-stack>
          </Form>
        )}
      </s-section>

      <s-section
        heading={view === "open" ? "Open transfers" : "Closed transfers"}
      >
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base">
            {view === "open" ? (
              <s-link href={listHref("closed", 1)}>
                Show received and cancelled transfers
              </s-link>
            ) : (
              <s-link href={listHref("open", 1)}>Show open transfers</s-link>
            )}
          </s-stack>

          {transfers.length === 0 ? (
            <s-paragraph>
              {page > 1
                ? "No more transfers."
                : view === "open"
                  ? "No transfer is being drafted or is in transit."
                  : "No transfer has been received or cancelled yet."}
            </s-paragraph>
          ) : (
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Transfer</s-table-header>
                <s-table-header>From</s-table-header>
                <s-table-header>To</s-table-header>
                <s-table-header listSlot="secondary">Status</s-table-header>
                <s-table-header>Units</s-table-header>
                <s-table-header>Created</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {transfers.map((transfer) => {
                  const badge = transferStatusBadge(
                    transfer.status,
                    transfer.totals,
                  );
                  return (
                    <s-table-row key={transfer.id}>
                      <s-table-cell>
                        <s-link href={`/app/transfers/${transfer.id}`}>
                          {transferReference(transfer.id)}
                        </s-link>
                      </s-table-cell>
                      <s-table-cell>
                        {locationName(transfer.sourceLocationId)}
                      </s-table-cell>
                      <s-table-cell>
                        {locationName(transfer.destinationLocationId)}
                      </s-table-cell>
                      <s-table-cell>
                        <s-badge tone={badge.tone}>{badge.label}</s-badge>
                      </s-table-cell>
                      <s-table-cell>{unitsSummary(transfer)}</s-table-cell>
                      <s-table-cell>
                        {formatShopTime(transfer.createdAt, timeZone)}
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
                <s-link href={listHref(view, page - 1)}>Newer transfers</s-link>
              )}
              {hasMore && (
                <s-link href={listHref(view, page + 1)}>Older transfers</s-link>
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
