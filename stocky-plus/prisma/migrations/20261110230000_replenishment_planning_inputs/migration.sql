-- Replenishment planning inputs (Stocky Parity worksheet).
-- Additive only: two new merchant tables and two enums. No existing table or
-- row is altered. Tenant RLS, the shopId immutability trigger and runtime
-- grants are applied by tenant:enforcement:apply from the manifest, as for
-- every other merchant table.
--
-- Recovery: the tables hold merchant-entered planning values only and are
-- read on demand. Leaving them unused is safe; dropping them loses only those
-- values.

-- CreateEnum
CREATE TYPE "ReplenishmentMethod" AS ENUM ('LAST_X_DAYS', 'CUSTOM_RANGE', 'SAME_PERIOD_LAST_YEAR', 'FILL_SHELVES', 'FILL_SHELVES_IF_BELOW_MIN', 'TARGET_STOCK_LEVEL');

-- CreateEnum
CREATE TYPE "ReplenishmentIncomingSource" AS ENUM ('SHOPIFY_INCOMING', 'APP_PURCHASE_ORDERS', 'NONE');

-- CreateTable
CREATE TABLE "ReplenishmentSettings" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "defaultMethod" "ReplenishmentMethod" NOT NULL DEFAULT 'LAST_X_DAYS',
    "sampleDays" INTEGER NOT NULL DEFAULT 30,
    "suggestDays" INTEGER NOT NULL DEFAULT 30,
    "targetQuantity" INTEGER,
    "incomingSource" "ReplenishmentIncomingSource" NOT NULL DEFAULT 'SHOPIFY_INCOMING',
    "defaultLeadTimeDays" INTEGER,
    "applyMinimumOrderQuantity" BOOLEAN NOT NULL DEFAULT false,
    "roundUpToPackSize" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplenishmentSettings_pkey" PRIMARY KEY ("id"),
    -- A custom date range needs dates, so it can't be a stored default.
    CONSTRAINT "ReplenishmentSettings_default_method_check"
      CHECK ("defaultMethod" <> 'CUSTOM_RANGE'),
    CONSTRAINT "ReplenishmentSettings_sample_days_check"
      CHECK ("sampleDays" BETWEEN 1 AND 730),
    CONSTRAINT "ReplenishmentSettings_suggest_days_check"
      CHECK ("suggestDays" BETWEEN 1 AND 365),
    CONSTRAINT "ReplenishmentSettings_target_quantity_check"
      CHECK ("targetQuantity" IS NULL OR "targetQuantity" BETWEEN 0 AND 10000000),
    CONSTRAINT "ReplenishmentSettings_target_required_check"
      CHECK ("defaultMethod" <> 'TARGET_STOCK_LEVEL' OR "targetQuantity" IS NOT NULL),
    CONSTRAINT "ReplenishmentSettings_default_lead_time_check"
      CHECK ("defaultLeadTimeDays" IS NULL OR "defaultLeadTimeDays" BETWEEN 0 AND 365)
);

-- CreateTable
CREATE TABLE "ReplenishmentVariantRule" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "variantGid" VARCHAR(256) NOT NULL,
    "scopeKey" VARCHAR(256) NOT NULL,
    "minimumQuantity" INTEGER,
    "shelfLimitQuantity" INTEGER,
    "reorderPointQuantity" INTEGER,
    "safetyStockQuantity" INTEGER,
    "leadTimeDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplenishmentVariantRule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReplenishmentVariantRule_variant_gid_check"
      CHECK ("variantGid" ~ '^gid://shopify/ProductVariant/[0-9]+$'),
    CONSTRAINT "ReplenishmentVariantRule_scope_key_check"
      CHECK ("scopeKey" = 'SHOP' OR "scopeKey" ~ '^gid://shopify/Location/[0-9]+$'),
    CONSTRAINT "ReplenishmentVariantRule_quantities_check"
      CHECK (
        ("minimumQuantity" IS NULL OR "minimumQuantity" BETWEEN 0 AND 10000000)
        AND ("shelfLimitQuantity" IS NULL OR "shelfLimitQuantity" BETWEEN 0 AND 10000000)
        AND ("reorderPointQuantity" IS NULL OR "reorderPointQuantity" BETWEEN 0 AND 10000000)
        AND ("safetyStockQuantity" IS NULL OR "safetyStockQuantity" BETWEEN 0 AND 10000000)
      ),
    CONSTRAINT "ReplenishmentVariantRule_lead_time_check"
      CHECK ("leadTimeDays" IS NULL OR "leadTimeDays" BETWEEN 0 AND 365),
    -- An all-empty rule is deleted rather than stored.
    CONSTRAINT "ReplenishmentVariantRule_not_empty_check"
      CHECK (num_nonnulls("minimumQuantity", "shelfLimitQuantity", "reorderPointQuantity", "safetyStockQuantity", "leadTimeDays") > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "ReplenishmentSettings_shopId_id_key" ON "ReplenishmentSettings"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ReplenishmentSettings_shopId_key" ON "ReplenishmentSettings"("shopId");

-- CreateIndex
CREATE INDEX "ReplenishmentVariantRule_shopId_scopeKey_idx" ON "ReplenishmentVariantRule"("shopId", "scopeKey");

-- CreateIndex
CREATE UNIQUE INDEX "ReplenishmentVariantRule_shopId_id_key" ON "ReplenishmentVariantRule"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ReplenishmentVariantRule_shopId_variantGid_scopeKey_key" ON "ReplenishmentVariantRule"("shopId", "variantGid", "scopeKey");

-- AddForeignKey
ALTER TABLE "ReplenishmentSettings" ADD CONSTRAINT "ReplenishmentSettings_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReplenishmentVariantRule" ADD CONSTRAINT "ReplenishmentVariantRule_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
