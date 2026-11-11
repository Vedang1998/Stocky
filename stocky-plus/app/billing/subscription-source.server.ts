/**
 * Where subscription state comes from.
 *
 * Shopify App Pricing sends no subscription webhooks and no charge_id, so
 * status is always read on demand. The Admin API is the current source; a
 * Partner API source (Shopify's canonical record) can implement the same
 * interface without changing entitlement callers.
 */
import {
  shopifyGraphQL,
  type AdminGraphQLClient,
} from "../services/shopify-gql.server";
import type { SubscriptionRecord } from "./entitlements";

export interface SubscriptionSource {
  readonly kind: "admin_api";
  listSubscriptions(): Promise<SubscriptionRecord[]>;
}

const APP_SUBSCRIPTIONS_QUERY = `#graphql
  query StockyAppSubscriptions {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        trialDays
        currentPeriodEnd
        createdAt
        lineItems {
          plan {
            pricingDetails {
              __typename
              ... on AppRecurringPricing {
                interval
                planHandle
                price {
                  amount
                  currencyCode
                }
                discount {
                  remainingDurationInIntervals
                }
              }
            }
          }
        }
      }
    }
  }`;

type PricingDetails =
  | {
      __typename: "AppRecurringPricing";
      interval: string;
      planHandle: string | null;
      price: { amount: string; currencyCode: string };
      discount: { remainingDurationInIntervals: number | null } | null;
    }
  | { __typename: string };

interface AdminAppSubscription {
  id: string;
  name: string;
  status: string;
  trialDays: number;
  currentPeriodEnd: string | null;
  createdAt: string;
  lineItems: Array<{ plan: { pricingDetails: PricingDetails } }>;
}

interface AppSubscriptionsResponse {
  currentAppInstallation: {
    activeSubscriptions: AdminAppSubscription[];
  } | null;
}

function isRecurring(
  details: PricingDetails,
): details is Extract<PricingDetails, { __typename: "AppRecurringPricing" }> {
  return details.__typename === "AppRecurringPricing";
}

export function toSubscriptionRecord(
  subscription: AdminAppSubscription,
): SubscriptionRecord {
  const recurring = subscription.lineItems
    .map((item) => item.plan.pricingDetails)
    .find(isRecurring);
  const interval = recurring?.interval;

  return {
    id: subscription.id,
    name: subscription.name,
    status: subscription.status,
    planHandle: recurring?.planHandle ?? null,
    createdAt: subscription.createdAt,
    currentPeriodEnd: subscription.currentPeriodEnd,
    trialDays: subscription.trialDays,
    billingInterval:
      interval === "EVERY_30_DAYS" || interval === "ANNUAL" ? interval : null,
    // A discounted subscription is not charged the list price, so the charge
    // is left unstated rather than shown wrong.
    price:
      recurring && !recurring.discount
        ? {
            amount: recurring.price.amount,
            currencyCode: recurring.price.currencyCode,
          }
        : null,
  };
}

export function adminApiSubscriptionSource(
  admin: AdminGraphQLClient,
): SubscriptionSource {
  return {
    kind: "admin_api",
    async listSubscriptions() {
      const result = await shopifyGraphQL<AppSubscriptionsResponse>(
        admin,
        APP_SUBSCRIPTIONS_QUERY,
      );
      const installation = result.data?.currentAppInstallation;
      if (!installation) {
        throw new Error(
          "Admin API returned no currentAppInstallation for the subscription query",
        );
      }
      return installation.activeSubscriptions.map(toSubscriptionRecord);
    },
  };
}
