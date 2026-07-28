import prisma from "../app/db.server";

/**
 * Optional demo data for local development.
 * Run: npm run db:seed
 */
async function main() {
  const shop = process.env.SEED_SHOP ?? "stocky-dev.myshopify.com";

  await prisma.shopSettings.upsert({
    where: { shop },
    create: {
      shop,
      subscriptionActive: true,
      subscriptionPlan: "dev",
      defaultLookbackDays: 30,
      targetDaysOfStock: 14,
    },
    update: {
      subscriptionActive: true,
      subscriptionPlan: "dev",
    },
  });

  const supplier = await prisma.supplier.upsert({
    where: { id: "seed-supplier-1" },
    create: {
      id: "seed-supplier-1",
      shop,
      name: "Southern Glazer's Wine & Spirits",
      accountNumber: "SG-10042",
      contactEmail: "orders@example.com",
      currency: "USD",
      vendorNotes: "Order cutoff 2pm EST. Deliveries Tue/Thu.",
      leadTimeDays: 5,
    },
    update: {},
  });

  console.log(`Seeded shop settings and supplier "${supplier.name}" for ${shop}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
