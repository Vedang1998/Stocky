import { config as loadEnv } from "dotenv";
import { prisma } from "../lib/prisma";

loadEnv({ path: ".env", override: true });

/**
 * Demo seed for Prisma Postgres setup verification.
 * Run via: npx prisma db seed
 *
 * Uses existing Stocky models (Shop / ShopSettings / Supplier).
 */
async function main() {
  const shopDomain = process.env.SEED_SHOP ?? "stocky-dev.myshopify.com";

  const shop = await prisma.shop.upsert({
    where: { myshopifyDomain: shopDomain },
    create: {
      myshopifyDomain: shopDomain,
      updatedAt: new Date(),
    },
    update: {
      updatedAt: new Date(),
    },
  });

  await prisma.shopSettings.upsert({
    where: { shop: shopDomain },
    create: {
      shop: shopDomain,
      shopId: shop.id,
      subscriptionActive: true,
      subscriptionPlan: "dev",
      defaultLookbackDays: 30,
      targetDaysOfStock: 14,
    },
    update: {
      shopId: shop.id,
      subscriptionActive: true,
      subscriptionPlan: "dev",
    },
  });

  const supplier = await prisma.supplier.upsert({
    where: { id: "seed-supplier-1" },
    create: {
      id: "seed-supplier-1",
      shop: shopDomain,
      shopId: shop.id,
      name: "Southern Glazer's Wine & Spirits",
      accountNumber: "SG-10042",
      contactEmail: "orders@example.com",
      currency: "USD",
      vendorNotes: "Order cutoff 2pm EST. Deliveries Tue/Thu.",
      leadTimeDays: 5,
    },
    update: {
      shopId: shop.id,
      name: "Southern Glazer's Wine & Spirits",
    },
  });

  const supplierTwo = await prisma.supplier.upsert({
    where: { id: "seed-supplier-2" },
    create: {
      id: "seed-supplier-2",
      shop: shopDomain,
      shopId: shop.id,
      name: "Breakthru Beverage",
      accountNumber: "BB-20418",
      contactEmail: "purchasing@example.com",
      currency: "USD",
      leadTimeDays: 3,
    },
    update: {
      shopId: shop.id,
    },
  });

  console.log(
    `Seeded Shop ${shop.id} (${shopDomain}), settings, and suppliers "${supplier.name}", "${supplierTwo.name}"`,
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
