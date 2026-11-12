-- Inventory control: stocktake workflow (full and partial counts, scanning,
-- missed items, movement review, cancellation).
-- Additive only: three enums and nullable or defaulted columns on "Stocktake"
-- and "StocktakeLineItem". No existing column, row, constraint or index is
-- changed, and existing counts keep their behaviour (basis AVAILABLE).
-- Rollback: DROP the columns below, then the three enums.

-- CreateEnum
CREATE TYPE "StocktakeScope" AS ENUM ('FULL', 'PARTIAL');

-- CreateEnum
CREATE TYPE "StocktakeQuantityBasis" AS ENUM ('AVAILABLE', 'ON_HAND');

-- CreateEnum
CREATE TYPE "StocktakeCountSource" AS ENUM ('MANUAL', 'SCAN', 'ZERO_FILL');

-- AlterTable
ALTER TABLE "Stocktake"
    ADD COLUMN "scope" "StocktakeScope" NOT NULL DEFAULT 'FULL',
    ADD COLUMN "quantityBasis" "StocktakeQuantityBasis" NOT NULL DEFAULT 'AVAILABLE',
    ADD COLUMN "blind" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "startedByUserId" VARCHAR(64),
    ADD COLUMN "completedByUserId" VARCHAR(64),
    ADD COLUMN "cancelledAt" TIMESTAMP(3),
    ADD COLUMN "cancelledByUserId" VARCHAR(64);

-- AlterTable
ALTER TABLE "StocktakeLineItem"
    ADD COLUMN "countSource" "StocktakeCountSource",
    ADD COLUMN "countedAt" TIMESTAMP(3),
    ADD COLUMN "countedByUserId" VARCHAR(64),
    ADD COLUMN "movementDetectedQty" INTEGER,
    ADD COLUMN "movementBaselineQty" INTEGER,
    ADD COLUMN "movementReviewedAt" TIMESTAMP(3);

-- A count is never negative, and a movement baseline only exists once the
-- movement has been reviewed. NOT VALID keeps the migration from failing on
-- rows written before these rules; new and updated rows are checked.
ALTER TABLE "StocktakeLineItem"
    ADD CONSTRAINT "StocktakeLineItem_countedQty_nonnegative"
    CHECK ("countedQty" IS NULL OR "countedQty" >= 0) NOT VALID;
ALTER TABLE "StocktakeLineItem"
    ADD CONSTRAINT "StocktakeLineItem_movement_baseline_reviewed"
    CHECK ("movementBaselineQty" IS NULL OR "movementReviewedAt" IS NOT NULL) NOT VALID;

-- CreateIndex: the count page lists one stocktake's lines by variant.
CREATE INDEX "StocktakeLineItem_shopId_stocktakeId_shopifyVariantId_idx"
    ON "StocktakeLineItem"("shopId", "stocktakeId", "shopifyVariantId");
