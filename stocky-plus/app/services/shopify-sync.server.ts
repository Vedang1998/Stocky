import type { TenantDb } from "../tenant/tenant-db.server";
import {
  pollBulkOperation,
  runBulkProductSync,
  shopifyGraphQL,
  type AdminGraphQLClient,
} from "./shopify-gql.server";

interface BulkVariantRow {
  id: string;
  title: string;
  sku?: string;
  barcode?: string;
  inventoryItem?: {
    id: string;
    measurement?: { weight?: { value: number; unit: string } | null } | null;
  };
  image?: { url: string } | null;
  __parentId?: string;
}

interface BulkProductRow {
  id: string;
  title: string;
}

export async function ingestBulkVariantCache(
  db: TenantDb,
  jsonlUrl: string,
): Promise<number> {
  const shop = db.authority.myshopifyDomain;
  const response = await fetch(jsonlUrl);
  const text = await response.text();
  const lines = text.trim().split("\n").filter(Boolean);

  const products = new Map<string, string>();
  const variants: BulkVariantRow[] = [];

  for (const line of lines) {
    const row = JSON.parse(line) as BulkVariantRow | BulkProductRow;
    if (row.id.includes("/Product/")) {
      products.set(row.id, (row as BulkProductRow).title);
    } else if (row.id.includes("/ProductVariant/")) {
      variants.push(row as BulkVariantRow);
    }
  }

  let count = 0;
  for (const variant of variants) {
    const productTitle = variant.__parentId
      ? products.get(variant.__parentId)
      : undefined;

    const fields = {
      title: productTitle
        ? `${productTitle} — ${variant.title}`
        : variant.title,
      sku: variant.sku,
      barcode: variant.barcode,
      inventoryItemId: variant.inventoryItem?.id,
      imageUrl: variant.image?.url,
      weight: variant.inventoryItem?.measurement?.weight?.value,
      weightUnit: variant.inventoryItem?.measurement?.weight?.unit,
    };

    await db.shopifyVariantCache.upsert({
      where: {
        shop_shopifyVariantId: { shop, shopifyVariantId: variant.id },
      },
      create: {
        shop,
        shopifyVariantId: variant.id,
        shopifyProductId: variant.__parentId,
        ...fields,
      },
      update: fields,
    });
    count++;
  }

  return count;
}

export async function startCatalogSync(
  db: TenantDb,
  admin: AdminGraphQLClient,
) {
  await runBulkProductSync(admin);

  let attempts = 0;
  while (attempts < 60) {
    await new Promise((r) => setTimeout(r, 5000));
    const op = await pollBulkOperation(admin);
    if (!op) break;
    if (op.status === "COMPLETED" && op.url) {
      return ingestBulkVariantCache(db, op.url);
    }
    if (op.status === "FAILED") {
      throw new Error(`Bulk sync failed: ${op.errorCode}`);
    }
    attempts++;
  }
  throw new Error("Bulk sync timed out");
}

export async function adjustShopifyInventory(
  admin: AdminGraphQLClient,
  inventoryItemId: string,
  locationId: string,
  delta: number,
  reason = "correction",
) {
  const result = await shopifyGraphQL(
    admin,
    `#graphql
      mutation StockyAdjustInventory($input: InventoryAdjustQuantitiesInput!) {
        inventoryAdjustQuantities(input: $input) {
          inventoryAdjustmentGroup {
            reason
          }
          userErrors {
            message
          }
        }
      }`,
    {
      input: {
        reason,
        name: "available",
        changes: [
          {
            inventoryItemId,
            locationId,
            delta,
          },
        ],
      },
    },
  );

  const errors = (
    result.data as {
      inventoryAdjustQuantities?: {
        userErrors: Array<{ message: string }>;
      };
    }
  )?.inventoryAdjustQuantities?.userErrors;

  if (errors?.length) {
    throw new Error(errors.map((e) => e.message).join("; "));
  }
}

export async function createShopifyTransfer(
  admin: AdminGraphQLClient,
  sourceLocationId: string,
  destinationLocationId: string,
  lineItems: Array<{ inventoryItemId: string; quantity: number }>,
) {
  const result = await shopifyGraphQL<{
    inventoryTransferCreate: {
      inventoryTransfer: { id: string } | null;
      userErrors: Array<{ message: string }>;
    };
  }>(
    admin,
    `#graphql
      mutation StockyCreateTransfer($input: InventoryTransferCreateInput!) {
        inventoryTransferCreate(input: $input) {
          inventoryTransfer {
            id
            status
          }
          userErrors {
            message
          }
        }
      }`,
    {
      input: {
        sourceLocationId,
        destinationLocationId,
        lineItems: lineItems.map((li) => ({
          inventoryItemId: li.inventoryItemId,
          quantity: li.quantity,
        })),
      },
    },
  );

  const payload = result.data?.inventoryTransferCreate;
  if (payload?.userErrors?.length) {
    throw new Error(payload.userErrors.map((e) => e.message).join("; "));
  }
  return payload?.inventoryTransfer;
}

export async function markShopifyTransferReadyToShip(
  admin: AdminGraphQLClient,
  transferId: string,
) {
  const result = await shopifyGraphQL<{
    inventoryTransferMarkAsReadyToShip: {
      inventoryTransfer: { id: string; status: string } | null;
      userErrors: Array<{ message: string }>;
    };
  }>(
    admin,
    `#graphql
      mutation StockyTransferReadyToShip($id: ID!) {
        inventoryTransferMarkAsReadyToShip(id: $id) {
          inventoryTransfer {
            id
            status
          }
          userErrors {
            message
          }
        }
      }`,
    { id: transferId },
  );

  const payload = result.data?.inventoryTransferMarkAsReadyToShip;
  if (payload?.userErrors?.length) {
    throw new Error(payload.userErrors.map((e) => e.message).join("; "));
  }
  return payload?.inventoryTransfer;
}

/**
 * Native Shopify transfer receive/complete is not available as
 * `inventoryTransferComplete` on Admin API 2025-10.
 *
 * Documented 2025-10 transfer mutations cover create, edit, set/remove items,
 * mark ready to ship, cancel, and duplicate — not a complete/receive mutation.
 * Do not invent a mutation name. Keep FEATURE_TRANSFER_WRITES OFF until a
 * supported receive workflow is approved (Phase 5).
 */
export class UnsupportedShopifyOperationError extends Error {
  readonly code = "UNSUPPORTED_SHOPIFY_OPERATION" as const;

  constructor(operation: string, detail: string) {
    super(`${operation} is unsupported: ${detail}`);
    this.name = "UnsupportedShopifyOperationError";
  }
}

export async function completeShopifyTransfer(
  admin: AdminGraphQLClient,
  transferId: string,
): Promise<never> {
  void admin;
  void transferId;
  throw new UnsupportedShopifyOperationError(
    "completeShopifyTransfer",
    "Admin GraphQL 2025-10 has no inventoryTransferComplete (or equivalent receive) mutation. Transfer receive remains disabled.",
  );
}

export async function processBomSale(
  db: TenantDb,
  bundleVariantId: string,
  quantitySold: number,
) {
  const components = await db.bomComponent.findMany({
    where: { bundleVariantId },
  });

  return components.map(
    (c: { componentVariantId: string; quantity: { toString(): string } | number }) => ({
      componentVariantId: c.componentVariantId,
      quantityToDecrement: Number(c.quantity) * quantitySold,
    }),
  );
}

export async function checkSubscriptionGate(db: TenantDb): Promise<boolean> {
  const settings = await db.shopSettings.findUnique({
    where: { shop: db.authority.myshopifyDomain },
  });
  return settings?.subscriptionActive ?? false;
}

export async function createAppSubscription(
  admin: AdminGraphQLClient,
  planName: string,
  price: number,
  returnUrl: string,
) {
  const result = await shopifyGraphQL<{
    appSubscriptionCreate: {
      appSubscription: { id: string } | null;
      confirmationUrl: string | null;
      userErrors: Array<{ message: string }>;
    };
  }>(
    admin,
    `#graphql
      mutation StockyCreateSubscription($name: String!, $returnUrl: URL!, $test: Boolean, $lineItems: [AppSubscriptionLineItemInput!]!) {
        appSubscriptionCreate(name: $name, returnUrl: $returnUrl, test: $test, lineItems: $lineItems) {
          appSubscription {
            id
          }
          confirmationUrl
          userErrors {
            message
          }
        }
      }`,
    {
      name: planName,
      returnUrl,
      test: process.env.NODE_ENV !== "production",
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: { amount: price, currencyCode: "USD" },
              interval: "EVERY_30_DAYS",
            },
          },
        },
      ],
    },
  );

  const payload = result.data?.appSubscriptionCreate;
  if (payload?.userErrors?.length) {
    throw new Error(payload.userErrors.map((e) => e.message).join("; "));
  }
  return payload;
}
