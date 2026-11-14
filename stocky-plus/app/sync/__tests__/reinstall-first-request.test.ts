/**
 * Issue #123: the first page load after a reinstall answered 500. Its loaders
 * authenticate alongside the request that runs the afterAuth hook and reached
 * the database while the shop was still disabled by the uninstall, so tenant
 * reads came back empty and the home loader's ShopSettings upsert was refused
 * by row-level security.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Session } from "@shopify/shopify-api";
import { runAfterAuthTenantBootstrap } from "../../tenant/after-auth.server";
import { requireAdminTenant } from "../../tenant/require-admin-tenant.server";
import { resetControlPlanePrismaForTests } from "../control-plane-db.server";

const SHOP = "reinstall-first-request.myshopify.com";
const FAST_WAIT = { timeoutMs: 3_000, pollMs: 25 };

function session(): Session {
  return new Session({
    id: `offline_${SHOP}`,
    shop: SHOP,
    state: "state",
    isOnline: false,
  });
}

const authenticateAdmin = async () =>
  ({ admin: {}, session: session() }) as unknown as Awaited<
    ReturnType<
      NonNullable<Parameters<typeof requireAdminTenant>[0]["authenticateAdmin"]>
    >
  >;

function adminRequest(): Request {
  return new Request(`https://app.example/app?shop=${SHOP}`);
}

/** What `app/routes/app._index.tsx` does first. */
async function homeLoader(wait = FAST_WAIT) {
  const { db, tenant } = await requireAdminTenant({
    request: adminRequest(),
    authenticateAdmin,
    reinstallWait: wait,
  });
  const settings = await db.shopSettings.upsert({
    where: { shop: tenant.myshopifyDomain },
    create: { shop: tenant.myshopifyDomain, shopId: tenant.shopId },
    update: {},
  });
  const suppliers = await db.supplier.findMany({ select: { name: true } });
  return { settings, suppliers: suppliers.map((s: { name: string }) => s.name) };
}

describe("first request after a reinstall (#123)", () => {
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

  /** An installed shop with settings and a supplier, then uninstalled. */
  async function uninstalledShop(
    reason: "UNINSTALLED" | "REDACTED" | "MANUAL" = "UNINSTALLED",
  ) {
    await prisma.supplier.deleteMany({ where: { shop: SHOP } });
    await prisma.shopSettings.deleteMany({ where: { shop: SHOP } });
    await prisma.shop.deleteMany({ where: { myshopifyDomain: SHOP } });
    const shop = await prisma.shop.create({ data: { myshopifyDomain: SHOP } });
    await prisma.shopSettings.create({ data: { shop: SHOP, shopId: shop.id } });
    await prisma.supplier.create({
      data: { shop: SHOP, shopId: shop.id, name: "North Mill" },
    });
    await prisma.shop.update({
      where: { id: shop.id },
      data: {
        processingEnabled: false,
        processingDisabledReason: reason,
        processingDisabledAt: new Date(),
        uninstalledAt: new Date(),
      },
    });
    return shop;
  }

  beforeEach(async () => {
    await resetControlPlanePrismaForTests();
  });

  it("waits for the afterAuth hook and then sees the shop's own rows", async () => {
    await uninstalledShop();

    // The loader starts first; the hook lands a moment later.
    const loading = homeLoader();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await runAfterAuthTenantBootstrap(session());

    const page = await loading;
    expect(page.suppliers).toEqual(["North Mill"]);
    expect(page.settings.shop).toBe(SHOP);
  });

  it("renders when the hook and the loaders start together", async () => {
    for (let round = 0; round < 5; round += 1) {
      await uninstalledShop();

      const [, layout, home] = await Promise.all([
        runAfterAuthTenantBootstrap(session()),
        homeLoader(),
        homeLoader(),
      ]);

      expect(layout.suppliers).toEqual(["North Mill"]);
      expect(home.suppliers).toEqual(["North Mill"]);
    }
  });

  it("does not switch an uninstalled shop back on by itself", async () => {
    // A request that authenticated with a session stored before the
    // uninstall, with no reinstall behind it.
    const shop = await uninstalledShop();
    const started = Date.now();

    const { db } = await requireAdminTenant({
      request: adminRequest(),
      authenticateAdmin,
      reinstallWait: { timeoutMs: 300, pollMs: 25 },
    });

    expect(Date.now() - started).toBeGreaterThanOrEqual(300);
    expect(await db.supplier.findMany()).toEqual([]);
    const after = await prisma.shop.findUniqueOrThrow({ where: { id: shop.id } });
    expect(after.processingEnabled).toBe(false);
    expect(after.processingDisabledReason).toBe("UNINSTALLED");
  });

  it.each(["REDACTED", "MANUAL"] as const)(
    "does not wait for, or open, a shop disabled as %s",
    async (reason) => {
      const shop = await uninstalledShop(reason);
      const started = Date.now();

      const { db } = await requireAdminTenant({
        request: adminRequest(),
        authenticateAdmin,
        reinstallWait: { timeoutMs: 2_000, pollMs: 25 },
      });

      expect(Date.now() - started).toBeLessThan(1_000);
      expect(await db.supplier.findMany()).toEqual([]);
      const after = await prisma.shop.findUniqueOrThrow({
        where: { id: shop.id },
      });
      expect(after.processingEnabled).toBe(false);
    },
  );
});
