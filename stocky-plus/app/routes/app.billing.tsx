import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  createAppSubscription,
} from "../services/shopify-sync.server";
import { shopifyGraphQL } from "../services/shopify-gql.server";

const PLANS = [
  {
    // Temporary handles — public name and prices pending product approval.
    // Do not treat these strings as the commercial entitlement architecture.
    name: "Essentials",
    price: 29,
    features: [
      "Buying Table with parity forecasting (planned)",
      "ABC/U analysis (planned)",
      "Purchase orders",
      "Landed cost foundation",
    ],
  },
  {
    name: "Growth",
    price: 79,
    features: [
      "Everything in Essentials",
      "Multi-location transfers",
      "Stocktakes & cycle counts",
      "Priority support (planned)",
    ],
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  // Refresh subscription status from Shopify on every visit (handles the
  // return redirect after the merchant approves the charge).
  const result = await shopifyGraphQL<{
    currentAppInstallation: {
      activeSubscriptions: Array<{ id: string; name: string; status: string }>;
    };
  }>(
    admin,
    `#graphql
      query StockyActiveSubscriptions {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
          }
        }
      }`,
  );

  const active = result.data?.currentAppInstallation.activeSubscriptions.find(
    (s) => s.status === "ACTIVE",
  );

  const settings = await prisma.shopSettings.upsert({
    where: { shop },
    create: {
      shop,
      subscriptionActive: Boolean(active),
      subscriptionPlan: active?.name ?? null,
    },
    update: {
      subscriptionActive: Boolean(active),
      subscriptionPlan: active?.name ?? null,
    },
  });

  return { settings, plans: PLANS };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, redirect } = await authenticate.admin(request);
  const form = await request.formData();
  const planName = form.get("plan") as string;
  const plan = PLANS.find((p) => p.name === planName);
  if (!plan) return { error: "Unknown plan" };

  const appUrl = process.env.SHOPIFY_APP_URL ?? "";
  const returnUrl = `${appUrl}/app/billing`;

  const result = await createAppSubscription(
    admin,
    plan.name,
    plan.price,
    returnUrl,
  );

  if (result?.confirmationUrl) {
    // Break out of the iframe so the merchant can approve the charge.
    return redirect(result.confirmationUrl, { target: "_top" });
  }

  return { error: "Could not create subscription" };
};

export default function Billing() {
  const { settings, plans } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Plans & Billing">
      {settings.subscriptionActive ? (
        <s-banner tone="success" heading="Subscription active">
          <s-paragraph>
            You are on {settings.subscriptionPlan ?? "an active plan"}. All
            premium features are unlocked.
          </s-paragraph>
        </s-banner>
      ) : (
        <s-banner tone="info" heading="No active subscription">
          <s-paragraph>
            The Buying Table and forecasting features require a plan.
          </s-paragraph>
        </s-banner>
      )}

      {plans.map((plan) => (
        <s-section key={plan.name} heading={`${plan.name} — $${plan.price}/month`}>
          <s-stack direction="block" gap="base">
            <s-unordered-list>
              {plan.features.map((f) => (
                <s-list-item key={f}>{f}</s-list-item>
              ))}
            </s-unordered-list>
            <Form method="post">
              <input type="hidden" name="plan" value={plan.name} />
              <s-button
                type="submit"
                variant="primary"
                {...(settings.subscriptionPlan === plan.name
                  ? { disabled: true }
                  : {})}
              >
                {settings.subscriptionPlan === plan.name
                  ? "Current plan"
                  : `Subscribe to ${plan.name}`}
              </s-button>
            </Form>
          </s-stack>
        </s-section>
      ))}

      <s-section slot="aside" heading="Test mode">
        <s-paragraph>
          Charges are created with test mode enabled while the app is in
          development, so no real money moves.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
