/**
 * Centralized entitlement service (§6). Routes and workers ask this module
 * what a shop may do; they never compare plan names or prices themselves.
 */
import { Prisma } from "@prisma/client";
import type { AdminGraphQLClient } from "../services/shopify-gql.server";
import type { TenantDb } from "../tenant/tenant-db.server";
import {
  entitlementSnapshot,
  hasCapability,
  resolveEntitlements,
  type EntitlementSnapshot,
  type ShopEntitlements,
} from "./entitlements";
import type { CapabilityKey } from "./plans";
import { adminApiSubscriptionSource } from "./subscription-source.server";

export { checkLimit, hasCapability } from "./entitlements";
export type { LimitCheck, ShopEntitlements } from "./entitlements";

/**
 * Read the shop's subscriptions from Shopify, resolve entitlements and store
 * the snapshot on ShopSettings. Unknown plans resolve to no capabilities.
 */
export async function getShopEntitlements({
  admin,
  db,
}: {
  admin: AdminGraphQLClient;
  db: TenantDb;
}): Promise<ShopEntitlements> {
  const source = adminApiSubscriptionSource(admin);
  const entitlements = resolveEntitlements(await source.listSubscriptions());

  if (entitlements.state === "unrecognized_plan") {
    console.warn(
      "[billing] Active subscription matches no plan in the catalog; capabilities withheld",
      {
        shopId: db.authority.shopId,
        source: source.kind,
        catalogVersion: entitlements.catalogVersion,
        subscriptionName: entitlements.subscription.name,
        planHandle: entitlements.subscription.planHandle,
      },
    );
  }

  await persistEntitlementSnapshot(db, entitlementSnapshot(entitlements));
  return entitlements;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * Write-if-changed. Creating the row is conflict-safe: when a concurrent
 * request creates ShopSettings first, the unique violation on `shop` falls
 * back to an update instead of surfacing as a 500.
 */
export async function persistEntitlementSnapshot(
  db: TenantDb,
  snapshot: EntitlementSnapshot,
): Promise<void> {
  const shop = db.authority.myshopifyDomain;
  const current: EntitlementSnapshot | null = await db.shopSettings.findUnique({
    where: { shop },
    select: { subscriptionActive: true, subscriptionPlan: true },
  });

  if (current) {
    if (
      current.subscriptionActive === snapshot.subscriptionActive &&
      current.subscriptionPlan === snapshot.subscriptionPlan
    ) {
      return;
    }
    await db.shopSettings.update({ where: { shop }, data: snapshot });
    return;
  }

  try {
    await db.shopSettings.create({ data: { shop, ...snapshot } });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    await db.shopSettings.update({ where: { shop }, data: snapshot });
  }
}

const NO_ACTIVE_PLAN_MESSAGE =
  "An active ProPo plan is required for this feature. You can choose a plan from Billing.";
const CAPABILITY_NOT_INCLUDED_MESSAGE =
  "Your current ProPo plan does not include this feature. You can change your plan from Billing.";

/**
 * Server-side capability gate for loaders and actions. Throws a 403 Response;
 * hiding a button is not authorization. Messages are static because the
 * embedded-app error boundary renders the response body as HTML.
 */
export function requireCapability(
  entitlements: ShopEntitlements,
  capability: CapabilityKey,
): void {
  if (hasCapability(entitlements, capability)) return;

  throw new Response(
    entitlements.state === "active"
      ? CAPABILITY_NOT_INCLUDED_MESSAGE
      : NO_ACTIVE_PLAN_MESSAGE,
    {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    },
  );
}
