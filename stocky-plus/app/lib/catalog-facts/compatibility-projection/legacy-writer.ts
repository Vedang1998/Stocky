import type { TenantDb } from "../../../tenant/tenant-db.server";
import { CompatibilityProjectionError } from "./errors";
import type {
  LegacyCompatibilityWriter,
  SnapshotProjectionPlan,
  VariantProjectionPlan,
} from "./types";

type TenantDbLike = Pick<
  TenantDb,
  | "authority"
  | "$transaction"
  | "shopifyVariantCache"
  | "inventorySnapshot"
>;

export function createTenantDbLegacyWriter(
  db: TenantDbLike,
): LegacyCompatibilityWriter {
  const shop = db.authority.myshopifyDomain;

  return {
    async applyVariantPlan(plan: VariantProjectionPlan): Promise<void> {
      if (plan.action === "upsert") {
        const { fields } = plan;
        await db.shopifyVariantCache.upsert({
          where: {
            shop_shopifyVariantId: {
              shop,
              shopifyVariantId: fields.shopifyVariantId,
            },
          },
          create: {
            shopifyVariantId: fields.shopifyVariantId,
            shopifyProductId: fields.shopifyProductId,
            title: fields.title,
            sku: fields.sku,
            barcode: fields.barcode,
            imageUrl: fields.imageUrl,
            inventoryItemId: fields.inventoryItemId,
            weight: fields.weight,
            weightUnit: fields.weightUnit,
          },
          update: {
            shopifyProductId: fields.shopifyProductId,
            title: fields.title,
            sku: fields.sku,
            barcode: fields.barcode,
            imageUrl: fields.imageUrl,
            inventoryItemId: fields.inventoryItemId,
            weight: fields.weight,
            weightUnit: fields.weightUnit,
          },
        });
        return;
      }

      await db.$transaction(async (tx) => {
        await tx.shopifyVariantCache.deleteMany({
          where: { shopifyVariantId: plan.shopifyVariantId },
        });
        const locationRows = (await tx.inventorySnapshot.findMany({
          where: { shopifyVariantId: plan.shopifyVariantId },
          select: { locationId: true },
        })) as Array<{ locationId: string }>;
        const locationIds = [
          ...new Set(locationRows.map((row) => row.locationId)),
        ];
        for (const locationId of locationIds) {
          await upsertTodaySnapshot(tx, shop, {
            shopifyVariantId: plan.shopifyVariantId,
            locationId,
            snapshotDate: plan.snapshotDate,
            quantityAvailable: 0,
          });
        }
      });
    },

    async applySnapshotPlan(plan: SnapshotProjectionPlan): Promise<void> {
      await upsertTodaySnapshot(db, shop, plan.fields);
    },
  };
}

async function upsertTodaySnapshot(
  db: TenantDbLike,
  shop: string,
  fields: {
    shopifyVariantId: string;
    locationId: string;
    snapshotDate: Date;
    quantityAvailable: number;
  },
): Promise<void> {
  await db.inventorySnapshot.upsert({
    where: {
      shop_shopifyVariantId_locationId_snapshotDate: {
        shop,
        shopifyVariantId: fields.shopifyVariantId,
        locationId: fields.locationId,
        snapshotDate: fields.snapshotDate,
      },
    },
    create: {
      shopifyVariantId: fields.shopifyVariantId,
      locationId: fields.locationId,
      snapshotDate: fields.snapshotDate,
      quantityAvailable: fields.quantityAvailable,
    },
    update: {
      quantityAvailable: fields.quantityAvailable,
    },
  });
}

export function assertWriter(writer: LegacyCompatibilityWriter): void {
  if (
    typeof writer.applyVariantPlan !== "function" ||
    typeof writer.applySnapshotPlan !== "function"
  ) {
    throw new CompatibilityProjectionError(
      "invalid_writer",
      "Compatibility projection writer is incomplete",
      { retryable: false },
    );
  }
}
