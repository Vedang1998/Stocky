import prisma from "../app/db.server";
import { normalizeShopDomain } from "../app/lib/shop-domain";

/**
 * Optional demo data for local development.
 * Run: npm run db:seed
 *
 * Phase 1 PR 1: upserts canonical Shop, continues writing legacy `shop`,
 * and sets matching nullable `shopId` for seeded records only.
 * This is not runtime-access conversion.
 */
async function main() {
  const shopRaw = process.env.SEED_SHOP ?? "stocky-dev.myshopify.com";
  const normalized = normalizeShopDomain(shopRaw);
  if (!normalized.ok) {
    throw new Error(
      `SEED_SHOP failed phase1-shop-domain-v1 normalization: ${normalized.reason}`,
    );
  }
  const shop = normalized.normalized;

  const canonicalShop = await prisma.shop.upsert({
    where: { myshopifyDomain: shop },
    create: {
      myshopifyDomain: shop,
      updatedAt: new Date(),
    },
    update: {
      updatedAt: new Date(),
    },
  });

  await prisma.shopSettings.upsert({
    where: { shop },
    create: {
      shop,
      shopId: canonicalShop.id,
      subscriptionActive: true,
      subscriptionPlan: "dev",
      defaultLookbackDays: 30,
      targetDaysOfStock: 14,
    },
    update: {
      shopId: canonicalShop.id,
      subscriptionActive: true,
      subscriptionPlan: "dev",
    },
  });

  const supplier = await prisma.supplier.upsert({
    where: { id: "seed-supplier-1" },
    create: {
      id: "seed-supplier-1",
      shop,
      shopId: canonicalShop.id,
      name: "Southern Glazer's Wine & Spirits",
      accountNumber: "SG-10042",
      contactEmail: "orders@example.com",
      currency: "USD",
      vendorNotes: "Order cutoff 2pm EST. Deliveries Tue/Thu.",
      leadTimeDays: 5,
    },
    update: {
      shopId: canonicalShop.id,
    },
  });

  console.log(
    `Seeded Shop ${canonicalShop.id} (${shop}), settings, and supplier "${supplier.name}"`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
