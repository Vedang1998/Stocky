import { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import type { TenantAuthority } from "../../../app/tenant/authority.server";
import { resolveAuthorityAfterVerifiedAuth } from "../../../app/tenant/bootstrap.server";
import { getRuntimeClient } from "../connection";
import { ENFORCEMENT_CONTEXT_VERSION } from "../manifest";
import { resetSchemaAndApplyEnforcement } from "./helpers";

export const SHOP_A = "f3-a.myshopify.com";
export const SHOP_B = "f3-b.myshopify.com";

export async function setupF3Database(): Promise<{
  prisma: PrismaClient;
  shopAId: string;
  shopBId: string;
  authority: TenantAuthority;
}> {
  const { prisma } = await resetSchemaAndApplyEnforcement();
  const [shopA, shopB] = await Promise.all([
    prisma.shop.create({
      data: {
        myshopifyDomain: SHOP_A,
        processingEnabled: true,
        tenantContextVersion: ENFORCEMENT_CONTEXT_VERSION,
      },
    }),
    prisma.shop.create({
      data: {
        myshopifyDomain: SHOP_B,
        processingEnabled: true,
        tenantContextVersion: ENFORCEMENT_CONTEXT_VERSION,
      },
    }),
  ]);
  const { tenant } = await resolveAuthorityAfterVerifiedAuth({
    verifiedDomain: SHOP_A,
    source: "verified_scheduler",
    correlationId: "f3-test",
    createIfMissing: false,
  });
  return {
    prisma,
    shopAId: shopA.id,
    shopBId: shopB.id,
    authority: tenant,
  };
}

export async function resetF3Rows(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "DataIssue", "SyncHealth", "SyncCursor", "SyncRun",
      "CatalogObservationInFlight",
      "ShopifyProductCollectionMembership",
      "ShopifyInventoryLevelFact", "ShopifyInventoryItemFact",
      "ShopifyVariantFact", "ShopifyLocationFact", "ShopifyProductFact",
      "SyncApplicationReceipt", "DeadLetter", "JobReplay", "JobAttempt",
      "JobDispatch", "WebhookDelivery", "DurableJob", "DispatchReadyShop"
    CASCADE
  `);
  await prisma.shop.updateMany({ data: { processingEnabled: true } });
}

export async function runtimeClientForShop(shopId: string): Promise<Client> {
  const client = await getRuntimeClient();
  await client.query("BEGIN");
  await client.query(`SELECT set_config('stocky.current_shop_id', $1, true)`, [
    shopId,
  ]);
  await client.query(
    `SELECT set_config('stocky.tenant_context_version', $1, true)`,
    [ENFORCEMENT_CONTEXT_VERSION],
  );
  return client;
}

export async function rollbackAndClose(client: Client): Promise<void> {
  await client.query("ROLLBACK").catch(() => undefined);
  await client.end();
}

export function completeProductData(input: {
  id: string;
  shopId: string;
  title?: string;
  updatedAt?: Date;
  compatibilityProjectionState?: "PROJECTION_PENDING" | "HEALTHY" | "DEGRADED";
}) {
  const now = input.updatedAt ?? new Date("2026-09-05T00:00:00Z");
  return {
    id: input.id,
    shopId: input.shopId,
    shopifyGid: `gid://shopify/Product/${input.id}`,
    title: input.title ?? "Product",
    handle: `product-${input.id}`,
    vendor: null,
    productType: null,
    tags: [],
    status: "ACTIVE" as const,
    featuredMediaUrl: null,
    shopifyCreatedAt: now,
    shopifyUpdatedAt: now,
    existenceState: "LIVE" as const,
    existenceKind: "LIVE_REFETCH" as const,
    existenceObservedAt: now,
    existenceRequestGen: 1n,
    existenceResponseGen: 2n,
    attributeRequestGen: 1n,
    attributeResponseGen: 2n,
    attributeFreshnessState: "ORDERED" as const,
    compatibilityProjectionState:
      input.compatibilityProjectionState ?? "PROJECTION_PENDING",
    absenceNominationState: "NONE" as const,
    sourceKind: "INCREMENTAL_REFETCH" as const,
    createdAt: now,
    updatedAt: now,
  };
}
