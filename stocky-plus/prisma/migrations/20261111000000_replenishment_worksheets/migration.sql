-- Replenishment worksheets (Stocky Parity).
-- Additive only: two new merchant tables and one enum. A worksheet is a
-- generated snapshot of one run; its lines hold the inputs, the suggestion and
-- the merchant's final quantities. No existing table or row is altered. Tenant
-- RLS, the shopId immutability trigger and runtime grants are applied by
-- tenant:enforcement:apply from the manifest, as for every merchant table.
--
-- Recovery: worksheets are derived data plus the merchant's quantity edits.
-- Dropping the tables loses saved worksheets and edits, nothing else; any
-- worksheet can be generated again from current facts.

-- CreateEnum
CREATE TYPE "ReplenishmentStockStatus" AS ENUM ('OUT_OF_STOCK', 'LOW', 'OK', 'UNKNOWN');

-- CreateTable
CREATE TABLE "ReplenishmentWorksheet" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "method" "ReplenishmentMethod" NOT NULL,
    "scopeKey" VARCHAR(256) NOT NULL,
    "scopeName" TEXT,
    "settings" JSONB NOT NULL,
    "asOfLocalDate" VARCHAR(10) NOT NULL,
    "timeZone" VARCHAR(64) NOT NULL,
    "windowStart" VARCHAR(10),
    "windowEnd" VARCHAR(10),
    "summary" JSONB,
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplenishmentWorksheet_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReplenishmentWorksheet_scope_key_check"
      CHECK ("scopeKey" = 'SHOP' OR "scopeKey" ~ '^gid://shopify/Location/[0-9]+$'),
    CONSTRAINT "ReplenishmentWorksheet_dates_check"
      CHECK (
        "asOfLocalDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        AND ("windowStart" IS NULL OR "windowStart" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
        AND ("windowEnd" IS NULL OR "windowEnd" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
        AND (("windowStart" IS NULL) = ("windowEnd" IS NULL))
        AND ("windowStart" IS NULL OR "windowStart" <= "windowEnd")
      ),
    CONSTRAINT "ReplenishmentWorksheet_line_count_check"
      CHECK ("lineCount" >= 0)
);

-- CreateTable
CREATE TABLE "ReplenishmentWorksheetLine" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "worksheetId" TEXT NOT NULL,
    "variantGid" VARCHAR(256) NOT NULL,
    "productGid" VARCHAR(256) NOT NULL,
    "productTitle" TEXT NOT NULL,
    "variantTitle" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "vendor" TEXT,
    "productType" TEXT,
    "imageUrl" TEXT,
    "priceAmount" DECIMAL(20,6),
    "priceCurrencyCode" VARCHAR(8),
    "unitCostAmount" DECIMAL(20,6),
    "unitCostCurrencyCode" VARCHAR(8),
    "supplierId" TEXT,
    "supplierName" TEXT,
    "vendorSku" TEXT,
    "minimumOrderQuantity" INTEGER,
    "packSize" INTEGER,
    "supplierCount" INTEGER NOT NULL DEFAULT 0,
    "tracked" BOOLEAN NOT NULL,
    "availableQuantity" INTEGER,
    "onHandQuantity" INTEGER,
    "committedQuantity" INTEGER,
    "incomingQuantity" INTEGER,
    "netUnits" INTEGER,
    "distinctOrders" INTEGER,
    "revenueAmount" DECIMAL(20,6),
    "unitsPerDay" DECIMAL(20,4),
    "stockStatus" "ReplenishmentStockStatus" NOT NULL,
    "daysOfStock" DECIMAL(20,1),
    "depletionDate" VARCHAR(10),
    "leadTimeDays" INTEGER,
    "leadTimeSource" VARCHAR(32),
    "reorderPoint" INTEGER,
    "reorderPointSource" VARCHAR(16),
    "forecastDemand" DECIMAL(20,4),
    "parityQuantity" INTEGER,
    "suggestedQuantity" INTEGER,
    "finalQuantity" INTEGER,
    "orderQuantity" INTEGER NOT NULL DEFAULT 0,
    "warningCodes" TEXT[],
    "detail" JSONB NOT NULL,
    "purchaseOrderId" TEXT,
    "purchaseOrderNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplenishmentWorksheetLine_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReplenishmentWorksheetLine_variant_gid_check"
      CHECK ("variantGid" ~ '^gid://shopify/ProductVariant/[0-9]+$'),
    CONSTRAINT "ReplenishmentWorksheetLine_quantities_check"
      CHECK (
        ("parityQuantity" IS NULL OR "parityQuantity" >= 0)
        AND ("suggestedQuantity" IS NULL OR "suggestedQuantity" >= 0)
        AND ("finalQuantity" IS NULL OR "finalQuantity" BETWEEN 0 AND 10000000)
      ),
    -- The quantity to order is the merchant's final quantity when set,
    -- otherwise the suggestion. Kept as a column so it can be sorted and summed.
    CONSTRAINT "ReplenishmentWorksheetLine_order_quantity_check"
      CHECK ("orderQuantity" = COALESCE("finalQuantity", "suggestedQuantity", 0)),
    CONSTRAINT "ReplenishmentWorksheetLine_supplier_terms_check"
      CHECK (
        "supplierCount" >= 0
        AND ("minimumOrderQuantity" IS NULL OR "minimumOrderQuantity" > 0)
        AND ("packSize" IS NULL OR "packSize" > 0)
      )
);

-- CreateIndex
CREATE INDEX "ReplenishmentWorksheet_shopId_createdAt_idx" ON "ReplenishmentWorksheet"("shopId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReplenishmentWorksheet_shopId_id_key" ON "ReplenishmentWorksheet"("shopId", "id");

-- CreateIndex
CREATE INDEX "ReplenishmentWorksheetLine_shopId_worksheetId_orderQuantity_idx" ON "ReplenishmentWorksheetLine"("shopId", "worksheetId", "orderQuantity");

-- CreateIndex
CREATE INDEX "ReplenishmentWorksheetLine_shopId_worksheetId_stockStatus_idx" ON "ReplenishmentWorksheetLine"("shopId", "worksheetId", "stockStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ReplenishmentWorksheetLine_shopId_id_key" ON "ReplenishmentWorksheetLine"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ReplenishmentWorksheetLine_shopId_worksheetId_variantGid_key" ON "ReplenishmentWorksheetLine"("shopId", "worksheetId", "variantGid");

-- AddForeignKey
ALTER TABLE "ReplenishmentWorksheet" ADD CONSTRAINT "ReplenishmentWorksheet_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReplenishmentWorksheetLine" ADD CONSTRAINT "ReplenishmentWorksheetLine_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReplenishmentWorksheetLine" ADD CONSTRAINT "ReplenishmentWorksheetLine_shopId_worksheetId_fkey" FOREIGN KEY ("shopId", "worksheetId") REFERENCES "ReplenishmentWorksheet"("shopId", "id") ON DELETE CASCADE ON UPDATE NO ACTION;
