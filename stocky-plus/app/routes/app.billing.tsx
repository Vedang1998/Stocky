import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import {
  shopifyGraphQL,
  type AdminGraphQLClient,
} from "../services/shopify-gql.server";
import type { PlanUsage } from "../billing/entitlements";
import { getShopEntitlements } from "../billing/entitlements.server";
import {
  annualPriceLabel,
  describeBillingTerms,
  monthlyPriceLabel,
  planTermRows,
  type BillingTerms,
} from "../billing/plan-display";
import { buildPlanSelectionUrl } from "../billing/plan-selection";
import {
  SELF_SERVE_PLANS,
  TRIAL_DAYS,
  findSelfServePlan,
  type SelfServePlan,
  type SelfServePlanHandle,
} from "../billing/plans";
import { getPlanUsage } from "../billing/usage.server";

const PLAN_SELECTION_UNAVAILABLE =
  "Plan selection is temporarily unavailable. Please try again later.";

/**
 * Shopify's hosted plan selection page for this shop. Returns null, after
 * logging the configuration error, when the URL cannot be built.
 */
function planSelectionUrl(shopDomain: string): string | null {
  const appHandle = process.env.SHOPIFY_APP_HANDLE;
  if (!appHandle) {
    console.error(
      "[billing] SHOPIFY_APP_HANDLE is not set; merchants cannot reach plan selection",
    );
    return null;
  }
  const result = buildPlanSelectionUrl(shopDomain, appHandle);
  if (!result.ok) {
    console.error(
      `[billing] Cannot build the plan selection URL: ${result.reason}`,
    );
    return null;
  }
  return result.url;
}

async function fetchShopTimeZone(admin: AdminGraphQLClient): Promise<string> {
  const result = await shopifyGraphQL<{ shop: { ianaTimezone: string } }>(
    admin,
    `#graphql
      query StockyShopTimeZone {
        shop {
          ianaTimezone
        }
      }`,
  );
  const timeZone = result.data?.shop.ianaTimezone;
  if (!timeZone) throw new Error("Admin API returned no shop time zone");
  return timeZone;
}

type CurrentPlan =
  | {
      state: "active";
      planHandle: SelfServePlanHandle;
      terms: BillingTerms;
      usage: PlanUsage;
    }
  | { state: "unrecognized_plan"; subscriptionName: string }
  | { state: "no_subscription" };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, tenant, db } = await requireAdminTenant({ request });
  const planSelectionAvailable =
    planSelectionUrl(tenant.myshopifyDomain) !== null;

  const entitlements = await getShopEntitlements({ admin, db });

  let current: CurrentPlan = { state: "no_subscription" };
  if (entitlements.state === "active") {
    const now = new Date();
    const [timeZone, usage] = await Promise.all([
      fetchShopTimeZone(admin),
      getPlanUsage(db, entitlements.subscription, now),
    ]);
    current = {
      state: "active",
      planHandle: entitlements.plan.handle,
      terms: describeBillingTerms(entitlements.subscription, timeZone, now),
      usage,
    };
  } else if (entitlements.state === "unrecognized_plan") {
    current = {
      state: "unrecognized_plan",
      subscriptionName: entitlements.subscription.name,
    };
  }

  return { current, planSelectionAvailable };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { tenant, redirect } = await requireAdminTenant({ request });
  const url = planSelectionUrl(tenant.myshopifyDomain);
  if (!url || !redirect) return { error: PLAN_SELECTION_UNAVAILABLE };

  // Plan selection is hosted by Shopify, outside the embedded app iframe.
  return redirect(url, { target: "_top" });
};

function CurrentPlanDetails({
  plan,
  terms,
  usage,
}: {
  plan: SelfServePlan;
  terms: BillingTerms;
  usage: PlanUsage;
}) {
  return (
    <s-stack direction="block" gap="base">
      <s-stack direction="inline" gap="small-200" alignItems="center">
        <s-heading>{plan.displayName}</s-heading>
        {terms.trialEndsOn ? (
          <s-badge tone="info">Free trial</s-badge>
        ) : (
          <s-badge tone="success">Active</s-badge>
        )}
      </s-stack>

      <s-stack direction="block" gap="small-200">
        {terms.charge && <s-paragraph>{terms.charge}</s-paragraph>}
        {terms.trialEndsOn && (
          <s-paragraph>Free trial ends on {terms.trialEndsOn}.</s-paragraph>
        )}
        {terms.renewsOn && (
          <s-paragraph>Renews on {terms.renewsOn}.</s-paragraph>
        )}
      </s-stack>

      <s-table>
        <s-table-header-row>
          <s-table-header listSlot="primary">Included in your plan</s-table-header>
          <s-table-header listSlot="secondary">Limit and usage</s-table-header>
        </s-table-header-row>
        <s-table-body>
          {planTermRows(plan, usage).map((row) => (
            <s-table-row key={row.key}>
              <s-table-cell>{row.label}</s-table-cell>
              <s-table-cell>
                <s-stack direction="inline" gap="small-200" alignItems="center">
                  <s-text>{row.value}</s-text>
                  {row.overLimit && (
                    <s-badge tone="critical">Over limit</s-badge>
                  )}
                </s-stack>
              </s-table-cell>
            </s-table-row>
          ))}
        </s-table-body>
      </s-table>
    </s-stack>
  );
}

function PlanCard({
  plan,
  isCurrent,
}: {
  plan: SelfServePlan;
  isCurrent: boolean;
}) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-heading>{plan.displayName}</s-heading>
          {plan.recommended && <s-badge tone="info">Recommended</s-badge>}
          {isCurrent && <s-badge tone="success">Current plan</s-badge>}
        </s-stack>
        <s-stack direction="block" gap="small-200">
          <s-text type="strong">{monthlyPriceLabel(plan)}</s-text>
          <s-text color="subdued">or {annualPriceLabel(plan)}</s-text>
        </s-stack>
        <s-unordered-list>
          {planTermRows(plan).map((row) => (
            <s-list-item key={row.key}>
              {row.label}: {row.value}
            </s-list-item>
          ))}
        </s-unordered-list>
      </s-stack>
    </s-box>
  );
}

export default function Billing() {
  const { current, planSelectionAvailable } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const activePlan =
    current.state === "active" ? findSelfServePlan(current.planHandle) : null;
  const selectionError =
    actionData?.error ??
    (planSelectionAvailable ? null : PLAN_SELECTION_UNAVAILABLE);

  return (
    <s-page heading="Plans & Billing">
      {selectionError && (
        <s-banner tone="critical" heading="Plan selection unavailable">
          <s-paragraph>{selectionError}</s-paragraph>
        </s-banner>
      )}

      <s-section heading="Current plan">
        <s-stack direction="block" gap="base">
          {current.state === "active" && activePlan && (
            <CurrentPlanDetails
              plan={activePlan}
              terms={current.terms}
              usage={current.usage}
            />
          )}
          {current.state === "unrecognized_plan" && (
            <s-banner tone="warning" heading="Subscription not recognized">
              <s-paragraph>
                Your subscription “{current.subscriptionName}” does not match a
                current ProPo plan, so plan features are unavailable. Choose a
                plan to continue.
              </s-paragraph>
            </s-banner>
          )}
          {current.state === "no_subscription" && (
            <s-paragraph>
              This store does not have an active ProPo plan. Choose a plan to
              get started. New subscriptions include a {TRIAL_DAYS}-day free
              trial.
            </s-paragraph>
          )}
          <Form method="post">
            <s-button
              type="submit"
              variant="primary"
              {...(planSelectionAvailable ? {} : { disabled: true })}
              {...(navigation.state === "submitting" ? { loading: true } : {})}
            >
              {current.state === "active" ? "Change plan" : "Choose plan"}
            </s-button>
          </Form>
        </s-stack>
      </s-section>

      <s-section heading="Compare plans">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Every plan includes the complete purchasing, receiving, stocktake
            and transfer workflow. Prices are in USD.
          </s-paragraph>
          <s-grid
            gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))"
            gap="base"
          >
            {SELF_SERVE_PLANS.map((plan) => (
              <PlanCard
                key={plan.handle}
                plan={plan}
                isCurrent={plan.handle === activePlan?.handle}
              />
            ))}
          </s-grid>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="How billing works">
        <s-paragraph>
          ProPo is billed through Shopify, so charges appear on your Shopify
          bill. You can upgrade or downgrade at any time. Plan changes are
          reviewed and approved on Shopify&apos;s plan selection page.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
