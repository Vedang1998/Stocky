import { useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getShopEntitlements, requireCapability } from "../billing/entitlements.server";
import { MethodPeriodFields } from "../components/replenishment/MethodPeriodFields";
import { AnalyticsPrerequisiteError, requireShopCurrency } from "../lib/analytics/errors";
import { localDateOf, requireShopTimeZone } from "../lib/analytics/shop-calendar";
import type { FieldErrors } from "../lib/replenishment/form";
import { getReplenishmentDefaults } from "../lib/replenishment/settings.server";
import {
  INCOMING_SOURCES,
  INCOMING_SOURCE_LABELS,
  PARITY_METHODS,
  PARITY_METHOD_LABELS,
  type ParityMethod,
} from "../lib/replenishment/types";
import {
  describeMethod,
  describeSelection,
  formatInstant,
} from "../lib/replenishment/worksheet/describe";
import {
  generateWorksheet,
  MAX_WORKSHEET_VARIANTS,
  WORKSHEETS_KEPT,
  WorksheetError,
} from "../lib/replenishment/worksheet/generate.server";
import { loadSetupOptions } from "../lib/replenishment/worksheet/options.server";
import { purchasingSources } from "../lib/replenishment/worksheet/purchasing.server";
import {
  parseWorksheetSetup,
  setupFormFromDefaults,
  setupFormFromSettings,
} from "../lib/replenishment/worksheet/settings";
import {
  deleteWorksheet,
  getWorksheet,
  listWorksheets,
} from "../lib/replenishment/worksheet/store.server";
import { readShopReportingProfile } from "../tenant/bootstrap.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";

const STORE_DETAILS_MISSING =
  "Your store's time zone and currency have not synced from Shopify yet. Worksheets need both to read sales by day. Try again in a few minutes.";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, tenant, db } = await requireAdminTenant({ request });
  requireCapability(await getShopEntitlements({ admin, db }), "core.replenishment");

  const [profile, defaults, options, suppliers, worksheets] = await Promise.all([
    readShopReportingProfile(tenant),
    getReplenishmentDefaults(db),
    loadSetupOptions(db),
    purchasingSources.listSuppliers(db),
    listWorksheets(db),
  ]);

  // "Generate again" opens the form with an earlier worksheet's choices.
  const fromId = new URL(request.url).searchParams.get("from");
  const source = fromId
    ? (worksheets.find((worksheet) => worksheet.id === fromId) ??
      (await getWorksheet(db, fromId)))
    : null;

  const supplierNames = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
  return {
    form: source?.settings
      ? setupFormFromSettings(source.settings, defaults)
      : setupFormFromDefaults(defaults),
    options,
    suppliers,
    storeDetailsMissing: !profile.ianaTimezone || !profile.currencyCode,
    worksheets: worksheets.map((worksheet) => ({
      id: worksheet.id,
      generatedAt: formatInstant(worksheet.generatedAt, worksheet.timeZone),
      method: worksheet.settings
        ? describeMethod(worksheet.settings.params)
        : PARITY_METHOD_LABELS[worksheet.method],
      scope: worksheet.scopeName ?? "All locations",
      selection: worksheet.settings
        ? describeSelection(
            worksheet.settings.selection,
            worksheet.settings.selection.supplierId
              ? (supplierNames.get(worksheet.settings.selection.supplierId) ?? "Removed supplier")
              : null,
          )
        : "",
      lineCount: worksheet.lineCount,
    })),
  };
};

type ActionResult = { errors?: FieldErrors; formError?: string };

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, tenant, db } = await requireAdminTenant({ request });
  requireCapability(await getShopEntitlements({ admin, db }), "core.replenishment");
  const form = await request.formData();

  if (form.get("intent") === "delete") {
    const worksheetId = form.get("worksheetId");
    if (typeof worksheetId === "string") await deleteWorksheet(db, worksheetId);
    return {} satisfies ActionResult;
  }

  const profile = await readShopReportingProfile(tenant);
  const now = new Date();
  try {
    const timeZone = requireShopTimeZone(profile.ianaTimezone);
    requireShopCurrency(profile.currencyCode);
    const parsed = parseWorksheetSetup(form, localDateOf(now, timeZone));
    if (!parsed.ok) return { errors: parsed.errors } satisfies ActionResult;

    const defaults = await getReplenishmentDefaults(db);
    const worksheet = await generateWorksheet(db, purchasingSources, {
      settings: parsed.settings,
      shop: {
        timeZone,
        currencyCode: profile.currencyCode,
        installedAt: profile.installedAt,
      },
      defaults,
      now,
    });
    return redirect(`/app/replenishment/${worksheet.id}`);
  } catch (error) {
    if (error instanceof WorksheetError) {
      return { formError: error.message } satisfies ActionResult;
    }
    if (error instanceof AnalyticsPrerequisiteError) {
      return { formError: STORE_DETAILS_MISSING } satisfies ActionResult;
    }
    throw error;
  }
};

const DELETE_MODAL_ID = "delete-worksheet";

const METHOD_HELP: Record<ParityMethod, string> = {
  LAST_X_DAYS:
    "Net units sold in the sales period, divided by its days and multiplied by the days to cover, less what is in stock and incoming. Today is left out so a part day does not lower the rate.",
  CUSTOM_RANGE:
    "The same calculation over dates you choose, for example last season. The range can't end after today.",
  SAME_PERIOD_LAST_YEAR:
    "Net units sold in the days to cover, starting on this date last year, less what is in stock and incoming.",
  FILL_SHELVES:
    "Each variant's shelf limit less what is in stock and incoming. Variants without a shelf limit get no suggestion.",
  FILL_SHELVES_IF_BELOW_MIN:
    "The same as fill shelves, but only for variants whose stock is below their minimum.",
  TARGET_STOCK_LEVEL:
    "One target quantity for every variant, less what is in stock and incoming.",
};

export default function Replenishment() {
  const { form, options, suppliers, storeDetailsMissing, worksheets } =
    useLoaderData<typeof loader>();
  const result = useActionData<typeof action>() as ActionResult | undefined;
  const navigation = useNavigation();
  const submit = useSubmit();
  const [method, setMethod] = useState<ParityMethod>(form.method);
  const [pendingDelete, setPendingDelete] = useState<(typeof worksheets)[number] | null>(null);

  const errors = result?.errors ?? {};
  const submitting =
    navigation.state !== "idle" && navigation.formData?.get("intent") === "generate";

  return (
    <s-page heading="Replenishment">
      {storeDetailsMissing && (
        <s-banner tone="warning" heading="Store details are still syncing">
          <s-paragraph>{STORE_DETAILS_MISSING}</s-paragraph>
        </s-banner>
      )}
      {result?.formError && (
        <s-banner tone="critical" heading="The worksheet was not generated">
          <s-paragraph>{result.formError}</s-paragraph>
        </s-banner>
      )}

      <s-section heading="New worksheet">
        <Form method="post">
          <input type="hidden" name="intent" value="generate" />
          <s-stack direction="block" gap="base">
            <s-select
              label="Forecast method"
              name="method"
              value={method}
              error={errors.method}
              onChange={(event) => setMethod(event.currentTarget.value as ParityMethod)}
            >
              {PARITY_METHODS.map((value) => (
                <s-option key={value} value={value}>
                  {PARITY_METHOD_LABELS[value]}
                </s-option>
              ))}
            </s-select>
            <s-text color="subdued">{METHOD_HELP[method]}</s-text>

            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap="base">
              <MethodPeriodFields method={method} values={form} errors={errors} />
              <s-select
                label="Plan stock for"
                name="scopeKey"
                value={form.scopeKey}
                error={errors.scopeKey}
              >
                <s-option value="SHOP">All locations together</s-option>
                {options.locations.map((location) => (
                  <s-option key={location.gid} value={location.gid}>
                    {location.name}
                  </s-option>
                ))}
              </s-select>
              <s-select
                label="Incoming stock"
                name="incomingSource"
                value={form.incomingSource}
                error={errors.incomingSource}
              >
                {INCOMING_SOURCES.map((value) => (
                  <s-option key={value} value={value}>
                    {INCOMING_SOURCE_LABELS[value]}
                  </s-option>
                ))}
              </s-select>
            </s-grid>

            <s-heading>Products</s-heading>
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap="base">
              <s-select label="Vendor" name="vendor" value={form.vendor}>
                <s-option value="">All vendors</s-option>
                {options.vendors.map((vendor) => (
                  <s-option key={vendor} value={vendor}>
                    {vendor}
                  </s-option>
                ))}
              </s-select>
              <s-select label="Product type" name="productType" value={form.productType}>
                <s-option value="">All product types</s-option>
                {options.productTypes.map((productType) => (
                  <s-option key={productType} value={productType}>
                    {productType}
                  </s-option>
                ))}
              </s-select>
              <s-select label="Supplier" name="supplierId" value={form.supplierId}>
                <s-option value="">All suppliers</s-option>
                {suppliers.map((supplier) => (
                  <s-option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </s-option>
                ))}
              </s-select>
            </s-grid>
            <s-text color="subdued">
              A worksheet holds up to {MAX_WORKSHEET_VARIANTS.toLocaleString("en-US")} variants.
              Archived products are left out.
            </s-text>

            <s-heading>Supplier rules</s-heading>
            <s-stack direction="block" gap="small-200">
              <s-checkbox
                label="Raise suggestions to the supplier's minimum order quantity"
                name="applyMinimumOrderQuantity"
                {...(form.applyMinimumOrderQuantity ? { checked: true } : {})}
              />
              <s-checkbox
                label="Round suggestions up to full packs"
                name="roundUpToPackSize"
                {...(form.roundUpToPackSize ? { checked: true } : {})}
              />
              <s-text color="subdued">
                Both are off unless you tick them. The quantity before any rule is always shown
                beside the adjusted one.
              </s-text>
            </s-stack>

            <s-button
              type="submit"
              variant="primary"
              {...(storeDetailsMissing ? { disabled: true } : {})}
              {...(submitting ? { loading: true } : {})}
            >
              Generate worksheet
            </s-button>
          </s-stack>
        </Form>
      </s-section>

      <s-section heading="Saved worksheets">
        {worksheets.length === 0 ? (
          <s-paragraph>
            No worksheets yet. Generate one above to see suggested quantities for your products.
          </s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Generated</s-table-header>
                <s-table-header listSlot="secondary">Method</s-table-header>
                <s-table-header>Stock</s-table-header>
                <s-table-header>Products</s-table-header>
                <s-table-header format="numeric">Variants</s-table-header>
                <s-table-header>Actions</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {worksheets.map((worksheet) => (
                  <s-table-row key={worksheet.id}>
                    <s-table-cell>
                      <s-link href={`/app/replenishment/${worksheet.id}`}>
                        {worksheet.generatedAt}
                      </s-link>
                    </s-table-cell>
                    <s-table-cell>{worksheet.method}</s-table-cell>
                    <s-table-cell>{worksheet.scope}</s-table-cell>
                    <s-table-cell>{worksheet.selection}</s-table-cell>
                    <s-table-cell>{worksheet.lineCount.toLocaleString("en-US")}</s-table-cell>
                    <s-table-cell>
                      <s-button
                        variant="tertiary"
                        tone="critical"
                        commandFor={DELETE_MODAL_ID}
                        command="--show"
                        accessibilityLabel={`Delete the worksheet generated ${worksheet.generatedAt}`}
                        onClick={() => setPendingDelete(worksheet)}
                      >
                        Delete
                      </s-button>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
            <s-text color="subdued">
              The {WORKSHEETS_KEPT} most recent worksheets are kept. Deleting a worksheet does not
              change purchase orders created from it.
            </s-text>
          </s-stack>
        )}
      </s-section>

      <s-modal id={DELETE_MODAL_ID} heading="Delete this worksheet?">
        <s-paragraph>
          {pendingDelete
            ? `The worksheet generated ${pendingDelete.generatedAt} and any quantities you entered on it will be deleted. Purchase orders created from it are kept.`
            : ""}
        </s-paragraph>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          commandFor={DELETE_MODAL_ID}
          command="--hide"
          onClick={() => {
            if (!pendingDelete) return;
            submit({ intent: "delete", worksheetId: pendingDelete.id }, { method: "post" });
          }}
        >
          Delete worksheet
        </s-button>
        <s-button slot="secondary-actions" commandFor={DELETE_MODAL_ID} command="--hide">
          Cancel
        </s-button>
      </s-modal>

      <s-section slot="aside" heading="How a worksheet works">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            A worksheet is a snapshot: stock, sales and supplier terms as they were when you
            generated it. Generate a new one to pick up changes.
          </s-paragraph>
          <s-paragraph>
            Every suggested quantity can be opened to see the numbers behind it, and you can
            replace any of them with your own before creating purchase orders.
          </s-paragraph>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
