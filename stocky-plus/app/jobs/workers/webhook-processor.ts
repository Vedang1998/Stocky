import type { Job } from "bullmq";
import prisma from "../../db.server";
import { unauthenticated } from "../../shopify.server";
import type { WebhookJobData } from "../queue.server";
import { computeForecast, runAbcAnalysis } from "../../services/forecasting.server";
import { processBomSale, startCatalogSync } from "../../services/shopify-sync.server";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function handleOrderCreate(shop: string, payload: Record<string, unknown>) {
  const order = payload as {
    id: number;
    line_items?: Array<{
      variant_id: number | null;
      quantity: number;
      price: string;
      location_id?: number | null;
    }>;
  };

  const today = startOfDay(new Date());
  const locationId = "default";

  for (const item of order.line_items ?? []) {
    if (!item.variant_id) continue;
    const variantGid = `gid://shopify/ProductVariant/${item.variant_id}`;

    await prisma.salesDailyAggregate.upsert({
      where: {
        shop_shopifyVariantId_locationId_date: {
          shop,
          shopifyVariantId: variantGid,
          locationId,
          date: today,
        },
      },
      create: {
        shop,
        shopifyVariantId: variantGid,
        locationId,
        date: today,
        unitsSold: item.quantity,
        revenue: parseFloat(item.price) * item.quantity,
      },
      update: {
        unitsSold: { increment: item.quantity },
        revenue: { increment: parseFloat(item.price) * item.quantity },
      },
    });

    const bomComponents = await processBomSale(shop, variantGid, item.quantity);
    if (bomComponents.length > 0) {
      for (const comp of bomComponents) {
        await prisma.salesDailyAggregate.upsert({
          where: {
            shop_shopifyVariantId_locationId_date: {
              shop,
              shopifyVariantId: comp.componentVariantId,
              locationId,
              date: today,
            },
          },
          create: {
            shop,
            shopifyVariantId: comp.componentVariantId,
            locationId,
            date: today,
            unitsSold: comp.quantityToDecrement,
            revenue: 0,
          },
          update: {
            unitsSold: { increment: comp.quantityToDecrement },
          },
        });
      }
    }
  }
}

async function handleOrderCancelled(
  shop: string,
  payload: Record<string, unknown>,
) {
  const order = payload as {
    line_items?: Array<{
      variant_id: number | null;
      quantity: number;
      price: string;
    }>;
  };

  const today = startOfDay(new Date());
  const locationId = "default";

  for (const item of order.line_items ?? []) {
    if (!item.variant_id) continue;
    const variantGid = `gid://shopify/ProductVariant/${item.variant_id}`;

    const existing = await prisma.salesDailyAggregate.findUnique({
      where: {
        shop_shopifyVariantId_locationId_date: {
          shop,
          shopifyVariantId: variantGid,
          locationId,
          date: today,
        },
      },
    });

    if (existing) {
      await prisma.salesDailyAggregate.update({
        where: { id: existing.id },
        data: {
          unitsSold: Math.max(0, existing.unitsSold - item.quantity),
          revenue: Math.max(
            0,
            Number(existing.revenue) - parseFloat(item.price) * item.quantity,
          ),
        },
      });
    }
  }
}

async function handleRefundCreate(
  shop: string,
  payload: Record<string, unknown>,
) {
  const refund = payload as {
    refund_line_items?: Array<{
      line_item?: { variant_id: number | null; quantity: number; price: string };
      quantity: number;
    }>;
  };

  const today = startOfDay(new Date());
  const locationId = "default";

  for (const item of refund.refund_line_items ?? []) {
    const lineItem = item.line_item;
    if (!lineItem?.variant_id) continue;
    const variantGid = `gid://shopify/ProductVariant/${lineItem.variant_id}`;
    const qty = item.quantity;

    const existing = await prisma.salesDailyAggregate.findUnique({
      where: {
        shop_shopifyVariantId_locationId_date: {
          shop,
          shopifyVariantId: variantGid,
          locationId,
          date: today,
        },
      },
    });

    if (existing) {
      await prisma.salesDailyAggregate.update({
        where: { id: existing.id },
        data: {
          unitsSold: Math.max(0, existing.unitsSold - qty),
          revenue: Math.max(
            0,
            Number(existing.revenue) - parseFloat(lineItem.price) * qty,
          ),
        },
      });
    }
  }
}

async function handleInventoryUpdate(
  shop: string,
  payload: Record<string, unknown>,
) {
  const inv = payload as {
    inventory_item_id: number;
    location_id: number;
    available: number | null;
  };

  const variantGid = await resolveVariantFromInventoryItem(
    shop,
    inv.inventory_item_id,
  );
  if (!variantGid) return;

  const locationGid = `gid://shopify/Location/${inv.location_id}`;
  const today = startOfDay(new Date());

  await prisma.inventorySnapshot.upsert({
    where: {
      shop_shopifyVariantId_locationId_snapshotDate: {
        shop,
        shopifyVariantId: variantGid,
        locationId: locationGid,
        snapshotDate: today,
      },
    },
    create: {
      shop,
      shopifyVariantId: variantGid,
      locationId: locationGid,
      snapshotDate: today,
      quantityAvailable: inv.available ?? 0,
    },
    update: {
      quantityAvailable: inv.available ?? 0,
    },
  });

  const forecast = await computeForecast({
    shop,
    variantId: variantGid,
    locationId: locationGid,
  });

  const abc = await prisma.variantAbcClass.findFirst({
    where: { shop, shopifyVariantId: variantGid },
  });

  if (
    abc?.abcClass === "A" &&
    forecast.onHand < forecast.reorderPoint
  ) {
    await prisma.lowStockAlert.create({
      data: {
        shop,
        shopifyVariantId: variantGid,
        locationId: locationGid,
        reorderPoint: forecast.reorderPoint,
        currentStock: forecast.onHand,
      },
    });
  }
}

async function resolveVariantFromInventoryItem(
  shop: string,
  inventoryItemId: number,
): Promise<string | null> {
  const cache = await prisma.shopifyVariantCache.findFirst({
    where: {
      shop,
      inventoryItemId: `gid://shopify/InventoryItem/${inventoryItemId}`,
    },
  });
  return cache?.shopifyVariantId ?? null;
}

export async function processWebhookJob(job: Job<WebhookJobData>) {
  const { topic, shop, payload } = job.data;

  switch (topic) {
    case "orders/create":
      await handleOrderCreate(shop, payload);
      break;
    case "orders/cancelled":
      await handleOrderCancelled(shop, payload);
      break;
    case "refunds/create":
      await handleRefundCreate(shop, payload);
      break;
    case "inventory_levels/update":
      await handleInventoryUpdate(shop, payload);
      break;
    default:
      console.warn(`Unhandled webhook topic: ${topic}`);
  }
}

export async function processCronJob(job: Job) {
  if (job.name === "abc-analysis") {
    const shops = await prisma.shopSettings.findMany({ select: { shop: true } });
    for (const { shop } of shops) {
      await runAbcAnalysis(shop, "REVENUE");
      await runAbcAnalysis(shop, "VOLUME");
    }
  }

  if (job.name === "catalog-sync") {
    const { shop } = job.data as { shop: string };
    const { admin } = await unauthenticated.admin(shop);
    const count = await startCatalogSync(admin, shop);
    console.log(`Catalog sync for ${shop}: ${count} variants cached`);
  }
}
