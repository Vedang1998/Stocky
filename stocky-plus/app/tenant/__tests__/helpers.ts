import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

export const SHOP_A_DOMAIN = "phase1-pr2-shop-a.myshopify.com";
export const SHOP_B_DOMAIN = "phase1-pr2-shop-b.myshopify.com";
export const SHARED_EXTERNAL_ID = "gid://shopify/ProductVariant/999001";

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for tenant-access integration tests");
  }
  return url;
}

export function createPrisma(): PrismaClient {
  return new PrismaClient({ datasources: { db: { url: requireDatabaseUrl() } } });
}

export async function resetPublicSchema(prisma: PrismaClient): Promise<void> {
  // Drop tables and enum/composite types so migrate deploy is clean.
  // Prisma $executeRawUnsafe allows one statement per call.
  await prisma.$executeRawUnsafe(`DROP SCHEMA public CASCADE`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA public`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO public`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO CURRENT_USER`);

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: APP_ROOT,
    env: { ...process.env, DATABASE_URL: requireDatabaseUrl() },
    stdio: "pipe",
  });
}

export async function seedTwoShops(prisma: PrismaClient) {
  const shopA = await prisma.shop.create({
    data: { myshopifyDomain: SHOP_A_DOMAIN },
  });
  const shopB = await prisma.shop.create({
    data: { myshopifyDomain: SHOP_B_DOMAIN },
  });
  return { shopA, shopB };
}
