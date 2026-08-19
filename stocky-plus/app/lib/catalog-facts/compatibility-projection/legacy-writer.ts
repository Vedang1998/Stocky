import {
  TOMBSTONE_DISTINCT_LOCATION_PAGE_SIZE,
  TOMBSTONE_WRITE_CHUNK_SIZE,
} from "./constants";
import { CompatibilityProjectionError } from "./errors";
import type { TenantDb } from "../../../tenant/tenant-db.server";
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

export type TombstoneLocationObserver = {
  onDistinctLocationPage?: (page: { locationIds: readonly string[] }) => void;
  onWriteChunk?: (chunk: { locationIds: readonly string[] }) => void;
};

export function createTenantDbLegacyWriter(
  db: TenantDbLike,
  options?: { tombstoneObserver?: TombstoneLocationObserver },
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

      await db.shopifyVariantCache.deleteMany({
        where: { shopifyVariantId: plan.shopifyVariantId },
      });
      await zeroTodaySnapshotsForHistoricalLocations({
        db,
        shop,
        shopifyVariantId: plan.shopifyVariantId,
        snapshotDate: plan.snapshotDate,
        observer: options?.tombstoneObserver,
      });
    },

    async applySnapshotPlan(plan: SnapshotProjectionPlan): Promise<void> {
      await upsertTodaySnapshot(db, shop, plan.fields);
    },
  };
}

async function zeroTodaySnapshotsForHistoricalLocations(input: {
  db: TenantDbLike;
  shop: string;
  shopifyVariantId: string;
  snapshotDate: Date;
  observer?: TombstoneLocationObserver;
}): Promise<void> {
  const identity = {
    kind: "ProductVariant" as const,
    shopifyGid: input.shopifyVariantId,
  };
  let afterLocationId: string | undefined;

  for (;;) {
    const locationIds = await readDistinctLocationPage(
      input.db,
      input.shopifyVariantId,
      afterLocationId,
      identity,
    );
    if (locationIds.length === 0) return;

    input.observer?.onDistinctLocationPage?.({ locationIds });

    for (
      let offset = 0;
      offset < locationIds.length;
      offset += TOMBSTONE_WRITE_CHUNK_SIZE
    ) {
      const chunk = locationIds.slice(
        offset,
        offset + TOMBSTONE_WRITE_CHUNK_SIZE,
      );
      input.observer?.onWriteChunk?.({ locationIds: chunk });
      await input.db.$transaction(async (tx) => {
        for (const locationId of chunk) {
          await upsertTodaySnapshot(tx, input.shop, {
            shopifyVariantId: input.shopifyVariantId,
            locationId,
            snapshotDate: input.snapshotDate,
            quantityAvailable: 0,
          });
        }
      });
    }

    const last = locationIds[locationIds.length - 1];
    if (last == null || (afterLocationId != null && last <= afterLocationId)) {
      throw new CompatibilityProjectionError(
        "tombstone_location_cursor_stuck",
        "Tombstone distinct-location keyset did not advance",
        { retryable: false, identity },
      );
    }
    afterLocationId = last;
    if (locationIds.length < TOMBSTONE_DISTINCT_LOCATION_PAGE_SIZE) return;
  }
}

async function readDistinctLocationPage(
  db: TenantDbLike,
  shopifyVariantId: string,
  afterLocationId: string | undefined,
  identity: { kind: "ProductVariant"; shopifyGid: string },
): Promise<string[]> {
  const page = (await db.inventorySnapshot.groupBy({
    by: ["locationId"],
    where: {
      shopifyVariantId,
      ...(afterLocationId ? { locationId: { gt: afterLocationId } } : {}),
    },
    orderBy: { locationId: "asc" },
    take: TOMBSTONE_DISTINCT_LOCATION_PAGE_SIZE,
  })) as Array<{ locationId: unknown }>;

  if (page.length > TOMBSTONE_DISTINCT_LOCATION_PAGE_SIZE) {
    throw new CompatibilityProjectionError(
      "tombstone_location_page_overflow",
      "Tombstone distinct-location page exceeded the engineering bound",
      { retryable: false, identity },
    );
  }

  const locationIds: string[] = [];
  for (const row of page) {
    if (typeof row.locationId !== "string" || row.locationId.length === 0) {
      throw new CompatibilityProjectionError(
        "tombstone_location_identity_invalid",
        "Tombstone distinct-location page contained an empty locationId; F2C will not invent a location",
        { retryable: false, identity },
      );
    }
    locationIds.push(row.locationId);
  }
  return locationIds;
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
