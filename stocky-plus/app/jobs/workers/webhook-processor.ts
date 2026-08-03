import type { Job } from "bullmq";
import { unauthenticated } from "../../shopify.server";
import type { WebhookJobData } from "../queue.server";
import {
  enqueueAbcAnalysisForShop,
} from "../queue.server";
import {
  computeForecast,
  runAbcAnalysis,
} from "../../services/forecasting.server";
import {
  processBomSale,
  startCatalogSync,
} from "../../services/shopify-sync.server";
import {
  resolveTenantJobContext,
  type TenantJobContext,
} from "../../tenant/job-envelope.server";
import { planPerShopSchedulerJobs } from "../../tenant/scheduler.server";
import type { TenantDb } from "../../tenant/tenant-db.server";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function handleOrderCreate(
  db: TenantDb,
  payload: Record<string, unknown>,
) {
  const shop = db.authority.myshopifyDomain;
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

    await db.salesDailyAggregate.upsert({
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

    const bomComponents = await processBomSale(db, variantGid, item.quantity);
    if (bomComponents.length > 0) {
      for (const comp of bomComponents) {
        await db.salesDailyAggregate.upsert({
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
  db: TenantDb,
  payload: Record<string, unknown>,
) {
  const shop = db.authority.myshopifyDomain;
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

    const existing = await db.salesDailyAggregate.findUnique({
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
      await db.salesDailyAggregate.update({
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
  db: TenantDb,
  payload: Record<string, unknown>,
) {
  const shop = db.authority.myshopifyDomain;
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

    const existing = await db.salesDailyAggregate.findUnique({
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
      await db.salesDailyAggregate.update({
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
  db: TenantDb,
  payload: Record<string, unknown>,
) {
  const shop = db.authority.myshopifyDomain;
  const inv = payload as {
    inventory_item_id: number;
    location_id: number;
    available: number | null;
  };

  const variantGid = await resolveVariantFromInventoryItem(
    db,
    inv.inventory_item_id,
  );
  if (!variantGid) return;

  const locationGid = `gid://shopify/Location/${inv.location_id}`;
  const today = startOfDay(new Date());

  await db.inventorySnapshot.upsert({
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

  const forecast = await computeForecast(db, {
    variantId: variantGid,
    locationId: locationGid,
  });

  const abc = await db.variantAbcClass.findFirst({
    where: { shopifyVariantId: variantGid },
  });

  if (abc?.abcClass === "A" && forecast.onHand < forecast.reorderPoint) {
    await db.lowStockAlert.create({
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
  db: TenantDb,
  inventoryItemId: number,
): Promise<string | null> {
  const cache = await db.shopifyVariantCache.findFirst({
    where: {
      inventoryItemId: `gid://shopify/InventoryItem/${inventoryItemId}`,
    },
  });
  return cache?.shopifyVariantId ?? null;
}

async function requireJobContext(
  rawTenant: unknown,
  options?: { payloadShop?: string; expectedJobNameOrTopic?: string },
): Promise<TenantJobContext> {
  // Merchant access is forbidden until envelope validation succeeds.
  return resolveTenantJobContext(rawTenant, options);
}

export async function processWebhookJob(job: Job<WebhookJobData>) {
  const { topic, payload, payloadShop, tenant: envelope } = job.data;

  const { db } = await requireJobContext(envelope, {
    payloadShop,
    expectedJobNameOrTopic: topic,
  });

  switch (topic) {
    case "orders/create":
      await handleOrderCreate(db, payload);
      break;
    case "orders/cancelled":
      await handleOrderCancelled(db, payload);
      break;
    case "refunds/create":
      await handleRefundCreate(db, payload);
      break;
    case "inventory_levels/update":
      await handleInventoryUpdate(db, payload);
      break;
    default:
      console.warn(`Unhandled webhook topic: ${topic}`);
  }
}

export async function processCronJob(job: Job) {
  if (job.name === "abc-analysis") {
    // Control-plane tick: enumerate canonical Shops and enqueue per-shop jobs.
    const planned = await planPerShopSchedulerJobs();
    for (const item of planned) {
      await enqueueAbcAnalysisForShop(item.tenant);
    }
    return;
  }

  if (job.name === "abc-analysis-shop") {
    const { tenant: envelope } = job.data as { tenant: unknown };
    const { db } = await requireJobContext(envelope, {
      expectedJobNameOrTopic: "abc-analysis-shop",
    });
    await runAbcAnalysis(db, "REVENUE");
    await runAbcAnalysis(db, "VOLUME");
    return;
  }

  if (job.name === "catalog-sync") {
    const { tenant: envelope } = job.data as { tenant: unknown };
    const { db, tenant } = await requireJobContext(envelope, {
      expectedJobNameOrTopic: "catalog-sync",
    });
    const { admin } = await unauthenticated.admin(tenant.myshopifyDomain);
    const count = await startCatalogSync(db, admin);
    console.log(
      `Catalog sync for ${tenant.myshopifyDomain}: ${count} variants cached`,
    );
  }
}
