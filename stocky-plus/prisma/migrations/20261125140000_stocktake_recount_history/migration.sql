-- History of recount requests on a count (PRD 3.11, "recount and
-- verification" and "immutable history").
-- Additive only: one enum, one new merchant table and one trigger function.
-- "StocktakeRecountEvent" has one row for every time a recount was asked for,
-- answered by counting again, or taken back. No existing table or row is
-- altered, and counts that were recounted before this migration get no rows:
-- their lines keep the first count they already show. Tenant RLS, the shopId
-- immutability trigger and runtime grants are applied by
-- tenant:enforcement:apply from the manifest, as for every merchant table.
--
-- Rollback: drop the table, then the function, then the enum. That loses the
-- recorded history and nothing else; the lines of a count are not touched.

-- CreateEnum
CREATE TYPE "StocktakeRecountEventKind" AS ENUM ('REQUESTED', 'COUNTED', 'KEPT');

-- CreateTable
CREATE TABLE "StocktakeRecountEvent" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "stocktakeId" TEXT NOT NULL,
    "lineItemId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "kind" "StocktakeRecountEventKind" NOT NULL,
    "questionedQty" INTEGER NOT NULL,
    "countedQty" INTEGER,
    "countSource" "StocktakeCountSource",
    "byUserId" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StocktakeRecountEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StocktakeRecountEvent_questionedQty_nonnegative"
      CHECK ("questionedQty" >= 0),
    CONSTRAINT "StocktakeRecountEvent_countedQty_nonnegative"
      CHECK ("countedQty" IS NULL OR "countedQty" >= 0),
    -- Only a recount says how the line was counted again, and a line that
    -- waits for a recount is never zero-filled.
    CONSTRAINT "StocktakeRecountEvent_count_only_when_counted"
      CHECK (
        CASE WHEN "kind" = 'COUNTED'
          THEN "countSource" IS NOT NULL AND "countSource" <> 'ZERO_FILL'
          ELSE "countSource" IS NULL AND "countedQty" IS NULL
        END
      )
);

-- CreateIndex
CREATE INDEX "StocktakeRecountEvent_shopId_stocktakeId_createdAt_idx" ON "StocktakeRecountEvent"("shopId", "stocktakeId", "createdAt");

-- CreateIndex
CREATE INDEX "StocktakeRecountEvent_stocktakeId_idx" ON "StocktakeRecountEvent"("stocktakeId");

-- CreateIndex
CREATE UNIQUE INDEX "StocktakeRecountEvent_shopId_id_key" ON "StocktakeRecountEvent"("shopId", "id");

-- AddForeignKey
ALTER TABLE "StocktakeRecountEvent" ADD CONSTRAINT "StocktakeRecountEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "StocktakeRecountEvent" ADD CONSTRAINT "StocktakeRecountEvent_stocktakeId_fkey" FOREIGN KEY ("stocktakeId") REFERENCES "Stocktake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The record is written once: every UPDATE is refused, whoever issues it.
-- Rows go only with their count (cascade) or with the shop (erasure).
-- An INSERT is refused unless the count belongs to the same shop as the row.
-- "Stocktake" predates the (shopId, id) key that a composite foreign key
-- would need at migration time, so the trigger holds that rule instead.
CREATE OR REPLACE FUNCTION stocky_stocktake_recount_event_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'stocktake_recount_event_immutable'
      USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public."Stocktake" s
     WHERE s."id" = NEW."stocktakeId"
       AND s."shopId" = NEW."shopId"
  ) THEN
    RAISE EXCEPTION 'stocktake_recount_event_wrong_shop'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION stocky_stocktake_recount_event_guard() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_StocktakeRecountEvent_guard ON "StocktakeRecountEvent";
CREATE TRIGGER trg_StocktakeRecountEvent_guard
  BEFORE INSERT OR UPDATE ON "StocktakeRecountEvent"
  FOR EACH ROW
  EXECUTE FUNCTION stocky_stocktake_recount_event_guard();
