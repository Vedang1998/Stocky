-- Daily stock history (F-098, historical stock on hand).
-- Additive only: two new merchant tables and one trigger function.
-- "DailyStockSnapshot" has one row per shop and calendar day in the shop's
-- time zone; "DailyStockLevel" has that day's quantities, one row per tracked
-- variant and location. No existing table or row is altered. Tenant RLS, the
-- shopId immutability trigger and runtime grants are applied by
-- tenant:enforcement:apply from the manifest, as for every merchant table.
--
-- Recovery: the tables hold history that cannot be read back from Shopify.
-- Dropping them (and then the function) loses the captured days and nothing
-- else; capture starts again from the next day.

-- CreateTable
CREATE TABLE "DailyStockSnapshot" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "localDate" VARCHAR(10) NOT NULL,
    "timeZone" VARCHAR(64) NOT NULL,
    "dayEndedAt" TIMESTAMP(3) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "levelCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyStockSnapshot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DailyStockSnapshot_local_date_check"
      CHECK ("localDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
    -- A day is captured after it has ended, never while it is still running.
    CONSTRAINT "DailyStockSnapshot_captured_after_day_check"
      CHECK ("capturedAt" >= "dayEndedAt"),
    CONSTRAINT "DailyStockSnapshot_level_count_check"
      CHECK ("levelCount" >= 0)
);

-- CreateTable
CREATE TABLE "DailyStockLevel" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "localDate" VARCHAR(10) NOT NULL,
    "variantGid" VARCHAR(256) NOT NULL,
    "locationGid" VARCHAR(256) NOT NULL,
    "availableQuantity" INTEGER,
    "onHandQuantity" INTEGER,
    "unitCostAmount" DECIMAL(20,6),
    "unitCostCurrencyCode" VARCHAR(8),
    "priceAmount" DECIMAL(20,6) NOT NULL,
    "priceCurrencyCode" VARCHAR(8) NOT NULL,

    CONSTRAINT "DailyStockLevel_pkey" PRIMARY KEY ("id"),
    -- A cost is an amount in a currency, or it is absent.
    CONSTRAINT "DailyStockLevel_unit_cost_check"
      CHECK (("unitCostAmount" IS NULL) = ("unitCostCurrencyCode" IS NULL))
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyStockSnapshot_shopId_id_key" ON "DailyStockSnapshot"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStockSnapshot_shopId_localDate_key" ON "DailyStockSnapshot"("shopId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStockLevel_shopId_id_key" ON "DailyStockLevel"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStockLevel_shopId_localDate_variantGid_locationGid_key" ON "DailyStockLevel"("shopId", "localDate", "variantGid", "locationGid");

-- AddForeignKey
ALTER TABLE "DailyStockSnapshot" ADD CONSTRAINT "DailyStockSnapshot_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DailyStockLevel" ADD CONSTRAINT "DailyStockLevel_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DailyStockLevel" ADD CONSTRAINT "DailyStockLevel_shopId_localDate_fkey" FOREIGN KEY ("shopId", "localDate") REFERENCES "DailyStockSnapshot"("shopId", "localDate") ON DELETE CASCADE ON UPDATE NO ACTION;

-- History is written once. A captured day is never corrected in place: rows
-- are inserted by the capture and removed by retention or shop erasure, and
-- every UPDATE is refused, whoever issues it.
CREATE OR REPLACE FUNCTION stocky_daily_stock_history_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'daily_stock_history_immutable'
    USING ERRCODE = '23514';
END;
$$;

REVOKE ALL ON FUNCTION stocky_daily_stock_history_guard() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_DailyStockSnapshot_guard ON "DailyStockSnapshot";
CREATE TRIGGER trg_DailyStockSnapshot_guard
  BEFORE UPDATE ON "DailyStockSnapshot"
  FOR EACH ROW
  EXECUTE FUNCTION stocky_daily_stock_history_guard();

DROP TRIGGER IF EXISTS trg_DailyStockLevel_guard ON "DailyStockLevel";
CREATE TRIGGER trg_DailyStockLevel_guard
  BEFORE UPDATE ON "DailyStockLevel"
  FOR EACH ROW
  EXECUTE FUNCTION stocky_daily_stock_history_guard();
