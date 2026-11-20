import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getShopEntitlements, requireCapability } from "../billing/entitlements.server";
import { MAX_LEAD_TIME_DAYS, type FieldErrors } from "../lib/replenishment/form";
import {
  DEFAULTABLE_METHODS,
  getReplenishmentDefaults,
  parseDefaultsForm,
  saveReplenishmentDefaults,
} from "../lib/replenishment/settings.server";
import {
  INCOMING_SOURCES,
  INCOMING_SOURCE_LABELS,
  MAX_QUANTITY,
  MAX_SAMPLE_DAYS,
  MAX_SUGGEST_DAYS,
  PARITY_METHOD_LABELS,
} from "../lib/replenishment/types";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, db } = await requireAdminTenant({ request, params });
  requireCapability(await getShopEntitlements({ admin, db }), "core.replenishment");
  const defaults = await getReplenishmentDefaults(db);
  return {
    methods: DEFAULTABLE_METHODS.map((value) => ({ value, label: PARITY_METHOD_LABELS[value] })),
    form: {
      defaultMethod: defaults.defaultMethod,
      sampleDays: String(defaults.sampleDays),
      suggestDays: String(defaults.suggestDays),
      targetQuantity: defaults.targetQuantity == null ? "" : String(defaults.targetQuantity),
      incomingSource: defaults.incomingSource,
      defaultLeadTimeDays:
        defaults.defaultLeadTimeDays == null ? "" : String(defaults.defaultLeadTimeDays),
      applyMinimumOrderQuantity: defaults.applyMinimumOrderQuantity,
      roundUpToPackSize: defaults.roundUpToPackSize,
    },
  };
};

type ActionResult = { ok: true } | { ok: false; errors: FieldErrors };

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, db } = await requireAdminTenant({ request, params });
  requireCapability(await getShopEntitlements({ admin, db }), "core.replenishment");
  const parsed = parseDefaultsForm(await request.formData());
  if (!parsed.ok) return { ok: false, errors: parsed.errors } satisfies ActionResult;
  await saveReplenishmentDefaults(db, parsed.values);
  return { ok: true } satisfies ActionResult;
};

export default function ReplenishmentSettings() {
  const { form, methods } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>() as ActionResult | undefined;
  const navigation = useNavigation();
  const errors = result && !result.ok ? result.errors : {};
  const saving = navigation.state !== "idle" && navigation.formMethod === "POST";

  return (
    <s-page heading="Replenishment settings">
      <s-link slot="breadcrumb-actions" href="/app/replenishment">
        Replenishment
      </s-link>

      {result?.ok && (
        <s-banner tone="success" heading="Settings saved">
          <s-paragraph>
            New worksheets open with these choices. Worksheets you already generated keep the
            settings they were made with.
          </s-paragraph>
        </s-banner>
      )}
      {result && !result.ok && (
        <s-banner tone="critical" heading="Settings were not saved">
          <s-paragraph>Check the highlighted fields and save again.</s-paragraph>
        </s-banner>
      )}

      <Form method="post">
        <s-stack direction="block" gap="base">
          <s-section heading="What a new worksheet opens with">
            <s-stack direction="block" gap="base">
              <s-text color="subdued">
                These fill in the form on the Replenishment page. You can change any of them for
                one worksheet without changing them here.
              </s-text>
              <s-grid gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap="base">
                <s-select
                  label="Forecast method"
                  name="defaultMethod"
                  value={form.defaultMethod}
                  error={errors.defaultMethod}
                >
                  {methods.map((method) => (
                    <s-option key={method.value} value={method.value}>
                      {method.label}
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
                <s-number-field
                  label="Sales period"
                  name="sampleDays"
                  suffix="days"
                  details="Used by the last X days method."
                  min={1}
                  max={MAX_SAMPLE_DAYS}
                  step={1}
                  value={form.sampleDays}
                  error={errors.sampleDays}
                />
                <s-number-field
                  label="Days to cover"
                  name="suggestDays"
                  suffix="days"
                  details="Used by the methods based on sales."
                  min={1}
                  max={MAX_SUGGEST_DAYS}
                  step={1}
                  value={form.suggestDays}
                  error={errors.suggestDays}
                />
                <s-number-field
                  label="Target quantity"
                  name="targetQuantity"
                  details="Used by the target stock level method."
                  min={0}
                  max={MAX_QUANTITY}
                  step={1}
                  value={form.targetQuantity}
                  error={errors.targetQuantity}
                />
              </s-grid>
            </s-stack>
          </s-section>

          <s-section heading="Lead time">
            <s-stack direction="block" gap="base">
              <s-number-field
                label="Default lead time"
                name="defaultLeadTimeDays"
                suffix="days"
                details="Used for a variant when neither the variant nor its supplier has a lead time. Leave empty if you have no usual lead time."
                min={0}
                max={MAX_LEAD_TIME_DAYS}
                step={1}
                value={form.defaultLeadTimeDays}
                error={errors.defaultLeadTimeDays}
              />
              <s-text color="subdued">
                Lead time sets each variant&apos;s reorder point and its low stock warning. It does
                not change the suggested quantity.
              </s-text>
            </s-stack>
          </s-section>

          <s-section heading="Supplier rules">
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
                Ticking a rule here only ticks it on the form for a new worksheet. Each worksheet
                still shows the quantity before any rule beside the adjusted one.
              </s-text>
            </s-stack>
          </s-section>

          <s-stack direction="inline" gap="base">
            <s-button type="submit" variant="primary" {...(saving ? { loading: true } : {})}>
              Save settings
            </s-button>
          </s-stack>
        </s-stack>
      </Form>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
