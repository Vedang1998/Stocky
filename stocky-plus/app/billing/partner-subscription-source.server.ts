/**
 * Subscription state from the Partner API's activeSubscription query, which
 * Shopify documents as the record for App Pricing
 * (https://shopify.dev/docs/api/partner/active-subscription).
 *
 * The access token belongs to the Partner organization, not to a shop. It is
 * read from the environment, sent only to partners.shopify.com and kept out
 * of every log line and error.
 */
import type { SubscriptionRecord } from "./entitlements";
import type { SubscriptionSource } from "./subscription-source.server";

const PARTNER_API_VERSION = "2026-07";
const REQUEST_TIMEOUT_MS = 10_000;

const ENV_NAMES = [
  "SHOPIFY_PARTNER_ORG_ID",
  "SHOPIFY_PARTNER_API_ACCESS_TOKEN",
  "SHOPIFY_APP_GID",
] as const;

const APP_GID = /^gid:\/\/shopify\/App\/\d+$/;
const SHOP_GID = /^gid:\/\/shopify\/Shop\/\d+$/;

export interface PartnerApiConfig {
  organizationId: string;
  accessToken: string;
  appGid: string;
}

export class PartnerApiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartnerApiConfigError";
  }
}

export type PartnerApiErrorCode =
  | "request_failed"
  | "http_error"
  | "graphql_error"
  | "malformed_response"
  | "shop_mismatch";

export class PartnerApiError extends Error {
  constructor(
    readonly code: PartnerApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PartnerApiError";
  }
}

/**
 * Null when no Partner API setting is present. A partial or malformed set is
 * a configuration error, not a reason to fall back to another source.
 */
export function loadPartnerApiConfig(
  env: NodeJS.ProcessEnv = process.env,
): PartnerApiConfig | null {
  const [organizationId, accessToken, appGid] = ENV_NAMES.map(
    (name) => env[name]?.trim() ?? "",
  );
  const missing = ENV_NAMES.filter((name) => !env[name]?.trim());
  if (missing.length === ENV_NAMES.length) return null;
  if (missing.length > 0) {
    throw new PartnerApiConfigError(
      `Partner API settings are incomplete: ${missing.join(", ")} not set`,
    );
  }
  if (!/^\d+$/.test(organizationId)) {
    throw new PartnerApiConfigError(
      "SHOPIFY_PARTNER_ORG_ID must be the Partner ID, the number in the Partner Dashboard URL",
    );
  }
  if (!APP_GID.test(appGid)) {
    throw new PartnerApiConfigError(
      "SHOPIFY_APP_GID must look like gid://shopify/App/<number>",
    );
  }
  return { organizationId, accessToken, appGid };
}

const ACTIVE_SUBSCRIPTION_QUERY = `query StockyActiveSubscription($appId: ID!, $shopId: ID!) {
  activeSubscription(appId: $appId, shopId: $shopId) {
    shop {
      id
    }
    billingPeriod
    cancelAtEndOfCycle
    trialEndsAt
    currentBillingCycle {
      endTime
    }
    items {
      handle
      description
      price {
        __typename
        currency
        ... on FlatRatePrice {
          amount
        }
      }
      discount {
        remainingDiscountCycles
      }
    }
    legacySubscriptionId
  }
}`;

interface PartnerSubscriptionItem {
  /** Nullable in Shopify's schema; an item without one cannot be the plan. */
  handle: string | null;
  description: string | null;
  price: { __typename: string; currency: string; amount?: string } | null;
  discount: unknown;
}

export interface PartnerActiveSubscription {
  shop: { id: string };
  billingPeriod: string;
  cancelAtEndOfCycle: boolean;
  trialEndsAt: string | null;
  currentBillingCycle: { endTime: string } | null;
  items: PartnerSubscriptionItem[];
  legacySubscriptionId: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseItem(value: unknown): PartnerSubscriptionItem | null {
  if (!isRecord(value)) return null;
  if (value.handle !== null && typeof value.handle !== "string") return null;
  const price = value.price;
  return {
    handle: value.handle,
    description: stringOrNull(value.description),
    price:
      isRecord(price) &&
      typeof price.__typename === "string" &&
      typeof price.currency === "string"
        ? {
            __typename: price.__typename,
            currency: price.currency,
            ...(typeof price.amount === "string"
              ? { amount: price.amount }
              : {}),
          }
        : null,
    discount: value.discount ?? null,
  };
}

function parseActiveSubscription(
  value: unknown,
): PartnerActiveSubscription | null {
  if (!isRecord(value)) return null;
  const { shop, items, currentBillingCycle } = value;
  if (!isRecord(shop) || typeof shop.id !== "string") return null;
  if (!Array.isArray(items)) return null;
  const parsedItems = items.map(parseItem);
  if (parsedItems.some((item) => item === null)) return null;
  if (
    currentBillingCycle != null &&
    !(isRecord(currentBillingCycle) &&
      typeof currentBillingCycle.endTime === "string")
  ) {
    return null;
  }
  return {
    shop: { id: shop.id },
    billingPeriod: stringOrNull(value.billingPeriod) ?? "",
    cancelAtEndOfCycle: value.cancelAtEndOfCycle === true,
    trialEndsAt: stringOrNull(value.trialEndsAt),
    currentBillingCycle: isRecord(currentBillingCycle)
      ? { endTime: currentBillingCycle.endTime as string }
      : null,
    items: parsedItems as PartnerSubscriptionItem[],
    legacySubscriptionId: stringOrNull(value.legacySubscriptionId),
  };
}

/**
 * The Partner API returns a subscription only while its contract is active,
 * so the record's status is always ACTIVE. The plan is the flat-rate item
 * with a handle; its handle is matched against the plan catalog by the
 * entitlement logic.
 */
export function partnerSubscriptionRecord(
  subscription: PartnerActiveSubscription,
): SubscriptionRecord {
  const named = subscription.items.filter((candidate) => candidate.handle);
  const item =
    named.find((candidate) => candidate.price?.__typename === "FlatRatePrice") ??
    named[0] ??
    null;
  const price = item?.price ?? null;
  const interval = subscription.billingPeriod;

  return {
    id:
      subscription.legacySubscriptionId ??
      `${subscription.shop.id}/ActiveSubscription`,
    name: item?.description?.trim() || item?.handle || "",
    status: "ACTIVE",
    planHandle: item?.handle ?? null,
    createdAt: null,
    trialEndsAt: subscription.trialEndsAt,
    currentPeriodEnd: subscription.currentBillingCycle?.endTime ?? null,
    endsAtPeriodEnd: subscription.cancelAtEndOfCycle,
    billingInterval:
      interval === "EVERY_30_DAYS" || interval === "ANNUAL" ? interval : null,
    // A discounted subscription is not charged the list price, so the charge
    // is left unstated rather than shown wrong.
    price:
      price?.__typename === "FlatRatePrice" &&
      price.amount !== undefined &&
      !item?.discount
        ? { amount: price.amount, currencyCode: price.currency }
        : null,
  };
}

function graphqlErrorSummary(errors: unknown): string {
  if (!Array.isArray(errors)) return "unreadable error list";
  return errors
    .map((error) =>
      isRecord(error) && typeof error.message === "string"
        ? error.message
        : "error without a message",
    )
    .join("; ")
    .slice(0, 300);
}

export function partnerApiSubscriptionSource({
  config,
  resolveShopGid,
  fetchImpl = fetch,
}: {
  config: PartnerApiConfig;
  /** The shop to ask about, taken from the authenticated shop's own client. */
  resolveShopGid: () => Promise<string>;
  fetchImpl?: typeof fetch;
}): SubscriptionSource {
  const endpoint = `https://partners.shopify.com/${config.organizationId}/api/${PARTNER_API_VERSION}/graphql.json`;

  return {
    kind: "partner_api",
    async listSubscriptions() {
      const shopGid = await resolveShopGid();
      if (!SHOP_GID.test(shopGid)) {
        throw new PartnerApiError(
          "malformed_response",
          "The shop id for the Partner API query is not a Shop GID",
        );
      }

      let response: Response;
      try {
        response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": config.accessToken,
          },
          body: JSON.stringify({
            query: ACTIVE_SUBSCRIPTION_QUERY,
            variables: { appId: config.appGid, shopId: shopGid },
          }),
          redirect: "error",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (error) {
        // The cause is not attached: a fetch failure can echo request details.
        const reason =
          error instanceof Error && error.name === "TimeoutError"
            ? "timed out"
            : "could not be sent";
        throw new PartnerApiError(
          "request_failed",
          `Partner API request ${reason}`,
        );
      }

      if (!response.ok) {
        throw new PartnerApiError(
          "http_error",
          `Partner API responded with HTTP ${response.status}`,
        );
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new PartnerApiError(
          "malformed_response",
          "Partner API response was not JSON",
        );
      }
      if (!isRecord(body)) {
        throw new PartnerApiError(
          "malformed_response",
          "Partner API response was not an object",
        );
      }
      // A throttled or failed query must not read as "no subscription".
      if (body.errors !== undefined && body.errors !== null) {
        throw new PartnerApiError(
          "graphql_error",
          `Partner API returned errors: ${graphqlErrorSummary(body.errors)}`,
        );
      }
      if (!isRecord(body.data) || !("activeSubscription" in body.data)) {
        throw new PartnerApiError(
          "malformed_response",
          "Partner API response has no activeSubscription field",
        );
      }

      const raw = body.data.activeSubscription;
      if (raw === null) return [];

      const subscription = parseActiveSubscription(raw);
      if (!subscription) {
        throw new PartnerApiError(
          "malformed_response",
          "Partner API returned a subscription in an unexpected shape",
        );
      }
      if (subscription.shop.id !== shopGid) {
        throw new PartnerApiError(
          "shop_mismatch",
          "Partner API returned a subscription for a different shop",
        );
      }
      return [partnerSubscriptionRecord(subscription)];
    },
  };
}
