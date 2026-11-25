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
import { subscriptionSourceFor } from "./subscription-source.server";

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
  const source = subscriptionSourceFor(admin);
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

/**
 * Re-reads the plan once afterAuth has bootstrapped the shop: Shopify cancels
 * the subscription at uninstall, and otherwise only Billing and Replenishment
 * rewrite the snapshot. Never throws, so a failed read cannot break the
 * install. If the read fails for a shop that was just reactivated, the stored
 * plan dates from before the uninstall, so it is cleared (fail closed).
 */
export async function refreshPlanSnapshotAfterAuth({
  admin,
  db,
  reactivated,
}: {
  admin: AdminGraphQLClient;
  db: TenantDb;
  reactivated: boolean;
}): Promise<void> {
  const logFailure = (what: string) => (error: unknown) =>
    console.error(`[billing] afterAuth ${what}:`, describeFailure(error), {
      shopId: db.authority.shopId,
      reactivated,
    });

  try {
    await getShopEntitlements({ admin, db });
  } catch (error) {
    logFailure("plan refresh failed")(error);
    if (reactivated) {
      await persistEntitlementSnapshot(db, NO_PLAN_SNAPSHOT).catch(
        logFailure("could not clear the stale plan after a reinstall"),
      );
    }
  }
}

const NO_PLAN_SNAPSHOT: EntitlementSnapshot = {
  subscriptionActive: false,
  subscriptionPlan: null,
};

/** Name and message only; never the whole error, which may carry a request. */
function describeFailure(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : "unknown error";
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/** The write lost to another transaction on the same row, after its retries. */
function isWriteConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

function sameSnapshot(a: EntitlementSnapshot, b: EntitlementSnapshot): boolean {
  return (
    a.subscriptionActive === b.subscriptionActive &&
    a.subscriptionPlan === b.subscriptionPlan
  );
}

async function readSnapshot(
  db: TenantDb,
  shop: string,
): Promise<EntitlementSnapshot | null> {
  return db.shopSettings.findUnique({
    where: { shop },
    select: { subscriptionActive: true, subscriptionPlan: true },
  });
}

/**
 * Requests that arrive together after a plan change all store the same
 * snapshot, and the database lets only some of them write the row. One that
 * lost has nothing left to do once the stored snapshot is the one it was
 * writing. If the row holds anything else the conflict is passed on, so a
 * request never reports a plan as stored that is not.
 */
async function updateSnapshot(
  db: TenantDb,
  shop: string,
  snapshot: EntitlementSnapshot,
): Promise<void> {
  try {
    await db.shopSettings.update({ where: { shop }, data: snapshot });
  } catch (error) {
    if (!isWriteConflict(error)) throw error;
    const current = await readSnapshot(db, shop);
    if (!current || !sameSnapshot(current, snapshot)) throw error;
  }
}

/**
 * Write-if-changed, safe for requests that arrive together. Creating the row:
 * when a concurrent request creates ShopSettings first, the unique violation
 * on `shop` falls back to an update instead of surfacing as a 500. Updating
 * it: see `updateSnapshot`.
 */
export async function persistEntitlementSnapshot(
  db: TenantDb,
  snapshot: EntitlementSnapshot,
): Promise<void> {
  const shop = db.authority.myshopifyDomain;
  const current = await readSnapshot(db, shop);

  if (current) {
    if (sameSnapshot(current, snapshot)) return;
    await updateSnapshot(db, shop, snapshot);
    return;
  }

  try {
    await db.shopSettings.create({ data: { shop, ...snapshot } });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    await updateSnapshot(db, shop, snapshot);
  }
}

const NO_ACTIVE_PLAN_MESSAGE =
  "An active ProPo plan is required for this feature. You can choose a plan from Billing.";
const CAPABILITY_NOT_INCLUDED_MESSAGE =
  "Your current ProPo plan does not include this feature. You can change your plan from Billing.";

function planRequired(message: string): Response {
  return new Response(message, {
    status: 403,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/**
 * Gate for routes that still use the stored snapshot rather than
 * per-capability entitlements: throws a 403 unless the last snapshot recorded
 * an active plan. Actions must call it too; hiding a form is not a gate.
 */
export async function requireActivePlanSnapshot(db: TenantDb): Promise<void> {
  const settings = await db.shopSettings.findUnique({
    where: { shop: db.authority.myshopifyDomain },
    select: { subscriptionActive: true },
  });
  if (settings?.subscriptionActive === true) return;
  throw planRequired(NO_ACTIVE_PLAN_MESSAGE);
}

/**
 * Server-side capability gate for loaders and actions. Throws a 403 Response;
 * hiding a button is not authorization. The app error boundary shows the
 * short plain-text body to the merchant (see lib/route-error.ts).
 */
export function requireCapability(
  entitlements: ShopEntitlements,
  capability: CapabilityKey,
): void {
  if (hasCapability(entitlements, capability)) return;

  throw planRequired(
    entitlements.state === "active"
      ? CAPABILITY_NOT_INCLUDED_MESSAGE
      : NO_ACTIVE_PLAN_MESSAGE,
  );
}
