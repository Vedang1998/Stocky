/**
 * Writes and prunes a shop's daily stock history.
 *
 * A snapshot is the stock of every tracked variant at every location, as the
 * app's Shopify facts held it when the day was captured, with the variant's
 * cost and price of that moment. Shopify does not serve past inventory
 * levels, so a day that is not captured cannot be filled in later.
 */
import type { TenantDb } from "../../tenant/tenant-db.server";
import type { LocalDate } from "../analytics/shop-calendar";
import { oldestRetainedDate, type SnapshotDay } from "./snapshot-day";

/**
 * A day of a very large catalog is hundreds of thousands of rows, written or
 * deleted in one statement; Prisma's default of 5 s is not enough for that.
 */
const TRANSACTION_OPTIONS = { timeout: 120_000, maxWait: 10_000 } as const;

/** TenantDb exposes tagged `$queryRaw` only inside an open transaction. */
type TenantTransaction = TenantDb & {
  $queryRaw: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<Array<{ levelCount: number }>>;
};

export type CaptureResult =
  | { captured: true; levelCount: number }
  /** The day already has a snapshot; nothing was written. */
  | { captured: false };

export async function hasStockSnapshot(
  db: TenantDb,
  localDate: LocalDate,
): Promise<boolean> {
  const snapshot: { id: string } | null =
    await db.dailyStockSnapshot.findFirst({
      where: { localDate },
      select: { id: true },
    });
  return snapshot !== null;
}

/**
 * Captures one day in a single statement, so every quantity comes from the
 * same instant and the day is either written whole or not at all. A day that
 * already has a snapshot is left as it is, which makes a repeated or
 * concurrent run harmless.
 *
 * Listed are the rows the stock on hand report lists: live, active levels of
 * tracked items whose variant, product and location still exist. Should the
 * facts ever hold two live items for one variant, one of them is taken, the
 * same one every time, rather than failing the whole day.
 */
export async function captureStockSnapshot(
  db: TenantDb,
  input: { day: SnapshotDay; timeZone: string; capturedAt: Date },
): Promise<CaptureResult> {
  const shopId = db.authority.shopId;
  const { localDate } = input.day;
  const dayEndedAt = input.day.dayEndedAt.toISOString();
  const capturedAt = input.capturedAt.toISOString();

  return db.$transaction(
    async (tx) => {
      const rows = await (tx as TenantTransaction).$queryRaw`
        WITH source AS MATERIALIZED (
          SELECT DISTINCT ON (item."shopifyVariantGid", lvl."locationGid")
            item."shopifyVariantGid" AS "variantGid",
            lvl."locationGid",
            lvl."availableQuantity",
            lvl."onHandQuantity",
            CASE WHEN item."unitCostCurrencyCode" IS NOT NULL
              THEN item."unitCostAmount" END AS "unitCostAmount",
            CASE WHEN item."unitCostAmount" IS NOT NULL
              THEN item."unitCostCurrencyCode" END AS "unitCostCurrencyCode",
            variant."priceAmount",
            variant."currencyCode" AS "priceCurrencyCode"
          FROM "ShopifyInventoryLevelFact" lvl
          JOIN "ShopifyLocationFact" loc
            ON loc."shopId" = lvl."shopId"
           AND loc."shopifyGid" = lvl."locationGid"
          JOIN "ShopifyInventoryItemFact" item
            ON item."shopId" = lvl."shopId"
           AND item."shopifyGid" = lvl."inventoryItemGid"
          JOIN "ShopifyVariantFact" variant
            ON variant."shopId" = item."shopId"
           AND variant."shopifyGid" = item."shopifyVariantGid"
          JOIN "ShopifyProductFact" product
            ON product."shopId" = variant."shopId"
           AND product."shopifyGid" = variant."shopifyProductGid"
          WHERE lvl."shopId" = ${shopId}
            AND lvl."existenceState" = 'LIVE'
            AND lvl."isActive"
            AND loc."existenceState" = 'LIVE'
            AND item."existenceState" = 'LIVE'
            AND item."tracked"
            AND variant."existenceState" = 'LIVE'
            AND product."existenceState" = 'LIVE'
          ORDER BY item."shopifyVariantGid", lvl."locationGid", item."shopifyGid"
        ),
        snapshot AS (
          INSERT INTO "DailyStockSnapshot" (
            "id", "shopId", "localDate", "timeZone",
            "dayEndedAt", "capturedAt", "levelCount"
          )
          SELECT
            gen_random_uuid()::text, ${shopId}, ${localDate}, ${input.timeZone},
            ${dayEndedAt}::timestamptz AT TIME ZONE 'UTC',
            ${capturedAt}::timestamptz AT TIME ZONE 'UTC',
            (SELECT count(*) FROM source)
          ON CONFLICT ("shopId", "localDate") DO NOTHING
          RETURNING "levelCount"
        ),
        levels AS (
          INSERT INTO "DailyStockLevel" (
            "id", "shopId", "localDate", "variantGid", "locationGid",
            "availableQuantity", "onHandQuantity",
            "unitCostAmount", "unitCostCurrencyCode",
            "priceAmount", "priceCurrencyCode"
          )
          SELECT
            gen_random_uuid()::text, ${shopId}, ${localDate},
            source."variantGid", source."locationGid",
            source."availableQuantity", source."onHandQuantity",
            source."unitCostAmount", source."unitCostCurrencyCode",
            source."priceAmount", source."priceCurrencyCode"
          FROM source
          WHERE EXISTS (SELECT 1 FROM snapshot)
        )
        SELECT "levelCount" FROM snapshot
      `;
      return rows.length === 0
        ? { captured: false }
        : { captured: true, levelCount: rows[0].levelCount };
    },
    TRANSACTION_OPTIONS,
  );
}

/**
 * Deletes the days that fall out of the retention period once `newest` has
 * been captured; their levels go with them. Returns the number of days
 * removed.
 */
export async function pruneStockSnapshots(
  db: TenantDb,
  newest: LocalDate,
): Promise<number> {
  const removed: { count: number } = await db.$transaction(
    (tx) =>
      tx.dailyStockSnapshot.deleteMany({
        where: { localDate: { lt: oldestRetainedDate(newest) } },
      }),
    TRANSACTION_OPTIONS,
  );
  return removed.count;
}
