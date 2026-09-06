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
      },
    }),
    prisma.shop.create({
      data: {
        myshopifyDomain: SHOP_B,
        processingEnabled: true,
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
      "ShopifyVariantCache", "InventorySnapshot",
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

export function completeVariantData(input: {
  id: string;
  shopId: string;
  productId?: string;
  compatibilityProjectionState?: "PROJECTION_PENDING" | "HEALTHY" | "DEGRADED";
}) {
  const now = new Date("2026-09-05T00:00:00Z");
  const productId = input.productId ?? "1";
  return {
    id: input.id,
    shopId: input.shopId,
    shopifyGid: `gid://shopify/ProductVariant/${input.id}`,
    shopifyProductGid: `gid://shopify/Product/${productId}`,
    title: `Variant ${input.id}`,
    selectedOptions: [{ name: "Title", value: input.id }],
    priceAmount: "1.000000",
    currencyCode: "USD",
    existenceState: "LIVE" as const,
    existenceKind: "LIVE_REFETCH" as const,
    existenceObservedAt: now,
    existenceRequestGen: 3n,
    existenceResponseGen: 4n,
    attributeRequestGen: 3n,
    attributeResponseGen: 4n,
    attributeFreshnessState: "ORDERED" as const,
    compatibilityProjectionState:
      input.compatibilityProjectionState ?? "PROJECTION_PENDING",
    absenceNominationState: "NONE" as const,
    sourceKind: "INCREMENTAL_REFETCH" as const,
    createdAt: now,
    updatedAt: now,
  };
}

export function completeInventoryItemData(input: {
  id: string;
  shopId: string;
  variantId?: string;
  compatibilityProjectionState?: "PROJECTION_PENDING" | "HEALTHY" | "DEGRADED";
}) {
  const now = new Date("2026-09-05T00:00:00Z");
  return {
    id: input.id,
    shopId: input.shopId,
    shopifyGid: `gid://shopify/InventoryItem/${input.id}`,
    shopifyVariantGid: `gid://shopify/ProductVariant/${input.variantId ?? "2"}`,
    tracked: true,
    requiresShipping: true,
    unitCostAccess: "NULL" as const,
    existenceState: "LIVE" as const,
    existenceKind: "LIVE_REFETCH" as const,
    existenceObservedAt: now,
    existenceRequestGen: 5n,
    existenceResponseGen: 6n,
    attributeRequestGen: 5n,
    attributeResponseGen: 6n,
    attributeFreshnessState: "ORDERED" as const,
    compatibilityProjectionState:
      input.compatibilityProjectionState ?? "PROJECTION_PENDING",
    absenceNominationState: "NONE" as const,
    sourceKind: "INCREMENTAL_REFETCH" as const,
    createdAt: now,
    updatedAt: now,
  };
}

export function completeLocationData(input: {
  id: string;
  shopId: string;
  compatibilityProjectionState?: "PROJECTION_PENDING" | "HEALTHY" | "DEGRADED";
  requestGen?: bigint;
}) {
  const now = new Date("2026-09-05T00:00:00Z");
  const gen = input.requestGen ?? 7n;
  return {
    id: input.id,
    shopId: input.shopId,
    shopifyGid: `gid://shopify/Location/${input.id}`,
    name: `Location ${input.id}`,
    isActive: true,
    fulfillsOnlineOrders: true,
    shipsInventory: true,
    isFulfillmentService: false,
    hasActiveInventory: true,
    existenceState: "LIVE" as const,
    existenceKind: "LIVE_REFETCH" as const,
    existenceObservedAt: now,
    existenceRequestGen: gen,
    existenceResponseGen: gen + 1n,
    attributeRequestGen: gen,
    attributeResponseGen: gen + 1n,
    attributeFreshnessState: "ORDERED" as const,
    compatibilityProjectionState:
      input.compatibilityProjectionState ?? "PROJECTION_PENDING",
    absenceNominationState: "NONE" as const,
    sourceKind: "INCREMENTAL_REFETCH" as const,
    createdAt: now,
    updatedAt: now,
  };
}

export function completeInventoryLevelData(input: {
  id?: string;
  shopId: string;
  itemId?: string;
  locationId?: string;
  available?: number | null;
  compatibilityProjectionState?: "PROJECTION_PENDING" | "HEALTHY" | "DEGRADED";
  existenceDiagnosticState?: string | null;
  sourceKind?: "INCREMENTAL_REFETCH" | "RECONCILE" | "FULL_SYNC";
}) {
  const now = new Date("2026-09-05T00:00:00Z");
  const itemId = input.itemId ?? "3";
  const locationId = input.locationId ?? "5";
  return {
    id: input.id ?? "level",
    shopId: input.shopId,
    inventoryItemGid: `gid://shopify/InventoryItem/${itemId}`,
    locationGid: `gid://shopify/Location/${locationId}`,
    isActive: true,
    availableQuantity: input.available === undefined ? 5 : input.available,
    existenceState: "LIVE" as const,
    existenceKind: "LIVE_REFETCH" as const,
    existenceObservedAt: now,
    existenceRequestGen: 9n,
    existenceResponseGen: 10n,
    attributeRequestGen: 9n,
    attributeResponseGen: 10n,
    attributeFreshnessState: "ORDERED" as const,
    compatibilityProjectionState:
      input.compatibilityProjectionState ?? "PROJECTION_PENDING",
    existenceDiagnosticState: input.existenceDiagnosticState ?? null,
    absenceNominationState: "NONE" as const,
    sourceKind: input.sourceKind ?? ("INCREMENTAL_REFETCH" as const),
    createdAt: now,
    updatedAt: now,
  };
}

export function catalogProductJsonl(id: number): string {
  return JSON.stringify({
    id: `gid://shopify/Product/${id}`,
    legacyResourceId: String(id),
    title: `Product ${id}`,
    handle: `product-${id}`,
    vendor: "Vendor",
    productType: "Type",
    tags: [],
    status: "ACTIVE",
    featuredMedia: null,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-02T00:00:00Z",
  });
}

export function eightQuantities(input?: {
  available?: number | null;
  onHand?: number;
  incoming?: number;
  committed?: number;
  updatedAt?: string | null;
  committedUpdatedAt?: string | null;
}) {
  const updatedAt = input?.updatedAt ?? "2026-09-05T10:00:00Z";
  return [
    ["available", input?.available ?? 0],
    ["on_hand", input?.onHand ?? 1],
    ["incoming", input?.incoming ?? 2],
    ["committed", input?.committed ?? 3],
    ["reserved", 4],
    ["damaged", 5],
    ["safety_stock", 6],
    ["quality_control", 7],
  ].map(([name, quantity]) => ({
    name,
    quantity,
    updatedAt:
      name === "committed"
        ? (input?.committedUpdatedAt ?? updatedAt)
        : updatedAt,
  }));
}
