import { config as loadEnv } from "dotenv";
import { prisma } from "../lib/prisma";

loadEnv({ path: ".env", override: true });

async function main() {
  const shops = await prisma.shop.findMany({
    take: 5,
    select: { id: true, myshopifyDomain: true },
  });

  console.log(`✅ Connected. Shops visible: ${shops.length}`);
  for (const shop of shops) {
    console.log(`  - ${shop.myshopifyDomain}`);
  }
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    const safe = message
      .replace(/(postgres(ql)?|prisma\+postgres):\/\/\S+/gi, "$1://***REDACTED***")
      .replace(/sk_[A-Za-z0-9]+/g, "***REDACTED***");
    console.error("❌ Prisma verify failed:", safe);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
