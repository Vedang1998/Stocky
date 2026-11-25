/**
 * Security lane round 8: a shop's stored plan snapshot survived uninstall and
 * reinstall. Shopify cancels the app's subscription at uninstall, but only
 * Billing and Replenishment rewrote the snapshot, so the snapshot-gated routes
 * (stocktakes, transfers, Buying Table and others) let a reinstalled shop make
 * changes with no plan until one of those pages was opened.
 *
 * Runs the afterAuth steps in order against the real database: bootstrap,
 * then the plan refresh the hook now does.
 */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { PrismaClient } from "@prisma/client";
import { Session } from "@shopify/shopify-api";
import {
  refreshPlanSnapshotAfterAuth,
  requireActivePlanSnapshot,
} from "../../billing/entitlements.server";
import { runAfterAuthTenantBootstrap } from "../../tenant/after-auth.server";
import { createTenantDb } from "../../tenant/tenant-db.server";
import type { AdminGraphQLClient } from "../../services/shopify-gql.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";
import { processUninstall } from "../uninstall.server";

const SHOP = "reinstall-plan-snapshot.myshopify.com";

function session(): Session {
  return new Session({
    id: `offline_${SHOP}`,
    shop: SHOP,
    state: "state",
    isOnline: false,
  });
}

/** Shopify after the uninstall: the installation lists no subscription. */
function adminWithNoSubscription(): AdminGraphQLClient {
  return {
    graphql: async () =>
      new Response(
        JSON.stringify({
          data: { currentAppInstallation: { activeSubscriptions: [] } },
        }),
      ),
  } as unknown as AdminGraphQLClient;
}

function adminThatFails(): AdminGraphQLClient {
  return {
    graphql: async () => {
      throw new Error("Shopify unavailable");
    },
  } as unknown as AdminGraphQLClient;
}

/** The afterAuth hook's steps, as `app/shopify.server.ts` runs them. */
async function reinstall(admin: AdminGraphQLClient) {
  const { tenant, reactivated } = await runAfterAuthTenantBootstrap(session());
  await refreshPlanSnapshotAfterAuth({
    admin,
    db: createTenantDb(tenant),
    reactivated,
  });
  return { tenant, reactivated };
}

async function gateStatus(tenant: Parameters<typeof createTenantDb>[0]) {
  try {
    await requireActivePlanSnapshot(createTenantDb(tenant));
    return 200;
  } catch (error) {
    if (error instanceof Response) return error.status;
    throw error;
  }
}

describe("plan snapshot across uninstall and reinstall", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK = "1";
    await resetControlPlanePrismaForTests();
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await resetControlPlanePrismaForTests();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetControlPlanePrismaForTests();
    vi.restoreAllMocks();
    const old = await prisma.shop.findUnique({
      where: { myshopifyDomain: SHOP },
      select: { id: true },
    });
    if (old) {
      await prisma.webhookDelivery.deleteMany({ where: { shopId: old.id } });
    }
    await prisma.session.deleteMany({ where: { shop: SHOP } });
    await prisma.shopSettings.deleteMany({ where: { shop: SHOP } });
    await prisma.shop.deleteMany({ where: { myshopifyDomain: SHOP } });
  });

  /** Installed on Growth, then uninstalled through the real webhook path. */
  async function uninstalledShopThatWasOnGrowth(): Promise<void> {
    const shop = await prisma.shop.create({ data: { myshopifyDomain: SHOP } });
    await prisma.shopSettings.create({
      data: {
        shop: SHOP,
        shopId: shop.id,
        subscriptionActive: true,
        subscriptionPlan: "growth",
      },
    });
    await processUninstall({
      verifiedShop: SHOP,
      webhookId: `${SHOP}-uninstalled`,
      apiVersion: "2026-07",
    });
  }

  it("refuses changes after a reinstall until the shop has a plan again", async () => {
    await uninstalledShopThatWasOnGrowth();

    const { tenant, reactivated } = await reinstall(adminWithNoSubscription());

    expect(reactivated).toBe(true);
    expect(await gateStatus(tenant)).toBe(403);
    const settings = await prisma.shopSettings.findUnique({
      where: { shop: SHOP },
    });
    expect(settings).toMatchObject({
      subscriptionActive: false,
      subscriptionPlan: null,
    });
  });

  it("refuses changes when Shopify cannot be read during the reinstall", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await uninstalledShopThatWasOnGrowth();

    const { tenant } = await reinstall(adminThatFails());

    expect(await gateStatus(tenant)).toBe(403);
  });
});
