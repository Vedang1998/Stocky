/**
 * Where subscription state comes from.
 *
 * Shopify App Pricing sends no subscription webhooks and no charge_id, so
 * status is always read on demand. Shopify documents the Partner API as the
 * record for App Pricing; that source is used when its credentials are set
 * (partner-subscription-source.server.ts). Without them the Admin API is
 * read instead, and whether it lists App Pricing subscriptions has not been
 * observed on a real store.
 */
import {
  shopifyGraphQL,
  type AdminGraphQLClient,
} from "../services/shopify-gql.server";
import type { SubscriptionRecord } from "./entitlements";
import {
  loadPartnerApiConfig,
  partnerApiSubscriptionSource,
} from "./partner-subscription-source.server";

export interface SubscriptionSource {
  readonly kind: "admin_api" | "partner_api";
  listSubscriptions(): Promise<SubscriptionRecord[]>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

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

/** The Admin API gives the trial as a day count from the creation time. */
function trialEnd(createdAt: string, trialDays: number): string | null {
  if (!(trialDays > 0)) return null;
  const start = Date.parse(createdAt);
  if (Number.isNaN(start)) return null;
  return new Date(start + trialDays * DAY_MS).toISOString();
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
    trialEndsAt: trialEnd(subscription.createdAt, subscription.trialDays),
    currentPeriodEnd: subscription.currentPeriodEnd,
    // The Admin API reports a cancelled subscription by its status, not ahead
    // of time.
    endsAtPeriodEnd: false,
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

const SHOP_ID_QUERY = `#graphql
  query StockyShopId {
    shop {
      id
    }
  }`;

async function fetchShopGid(admin: AdminGraphQLClient): Promise<string> {
  const result = await shopifyGraphQL<{ shop: { id: string } }>(
    admin,
    SHOP_ID_QUERY,
  );
  const shopGid = result.data?.shop?.id;
  if (!shopGid) throw new Error("Admin API returned no shop id");
  return shopGid;
}

let warnedAboutAdminSource = false;

/**
 * The source for one shop. `admin` must be the authenticated shop's own
 * client: the Partner API is asked about the shop that client reports, never
 * about one named by a request.
 */
export function subscriptionSourceFor(
  admin: AdminGraphQLClient,
  env: NodeJS.ProcessEnv = process.env,
): SubscriptionSource {
  const config = loadPartnerApiConfig(env);
  if (config) {
    return partnerApiSubscriptionSource({
      config,
      resolveShopGid: () => fetchShopGid(admin),
    });
  }
  if (env.NODE_ENV === "production" && !warnedAboutAdminSource) {
    warnedAboutAdminSource = true;
    console.warn(
      "[billing] Partner API credentials are not set; subscription status is read from the Admin API, which Shopify does not document for App Pricing",
    );
  }
  return adminApiSubscriptionSource(admin);
}
