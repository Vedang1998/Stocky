-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('DRAFT', 'ORDERED', 'PARTIAL', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LandedCostMethod" AS ENUM ('WEIGHT', 'VOLUME', 'COST');

-- CreateEnum
CREATE TYPE "AbcClass" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "AbcMetric" AS ENUM ('REVENUE', 'VOLUME');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('DRAFT', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StocktakeStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountNumber" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "vendorNotes" TEXT,
    "leadTimeDays" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierSkuMapping" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "vendorSku" TEXT NOT NULL,
    "moq" INTEGER NOT NULL DEFAULT 1,
    "packSize" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SupplierSkuMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolumePriceTier" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "minQty" INTEGER NOT NULL,
    "maxQty" INTEGER,
    "unitCost" DECIMAL(10,4) NOT NULL,

    CONSTRAINT "VolumePriceTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadTimeSnapshot" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "leadTimeDays" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadTimeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "poNumber" TEXT,
    "status" "POStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "exchangeRate" DECIMAL(10,6),
    "freightCost" DECIMAL(10,2),
    "customsCost" DECIMAL(10,2),
    "landedCostMethod" "LandedCostMethod" NOT NULL DEFAULT 'COST',
    "notes" TEXT,
    "draftedAt" TIMESTAMP(3),
    "orderedAt" TIMESTAMP(3),
    "fullyReceivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "POLineItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "vendorSku" TEXT,
    "orderedQty" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(10,4) NOT NULL,
    "manualCostOverride" BOOLEAN NOT NULL DEFAULT false,
    "weight" DECIMAL(10,4),
    "volume" DECIMAL(10,4),
    "allocatedLandedCost" DECIMAL(10,4),
    "retailPrice" DECIMAL(10,2),

    CONSTRAINT "POLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyVariantCache" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "shopifyProductId" TEXT,
    "title" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "imageUrl" TEXT,
    "inventoryItemId" TEXT,
    "weight" DECIMAL(10,4),
    "weightUnit" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyVariantCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySnapshot" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantityAvailable" INTEGER NOT NULL,
    "snapshotDate" DATE NOT NULL,

    CONSTRAINT "InventorySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantAbcClass" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL DEFAULT 'all',
    "abcClass" "AbcClass" NOT NULL,
    "metric" "AbcMetric" NOT NULL DEFAULT 'REVENUE',
    "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unitsSold" INTEGER NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VariantAbcClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastOverride" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "lookbackStart" TIMESTAMP(3) NOT NULL,
    "lookbackEnd" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForecastOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesDailyAggregate" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "unitsSold" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "SalesDailyAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopSettings" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "defaultLookbackDays" INTEGER NOT NULL DEFAULT 30,
    "targetDaysOfStock" INTEGER NOT NULL DEFAULT 14,
    "defaultSafetyStock" INTEGER NOT NULL DEFAULT 0,
    "abcMetric" "AbcMetric" NOT NULL DEFAULT 'REVENUE',
    "subscriptionActive" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionPlan" TEXT,

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferOrder" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "sourceLocationId" TEXT NOT NULL,
    "destinationLocationId" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'DRAFT',
    "shopifyTransferId" TEXT,
    "notes" TEXT,
    "shippedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferLineItem" (
    "id" TEXT NOT NULL,
    "transferOrderId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pickedQty" INTEGER NOT NULL DEFAULT 0,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TransferLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stocktake" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "status" "StocktakeStatus" NOT NULL DEFAULT 'DRAFT',
    "name" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stocktake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StocktakeLineItem" (
    "id" TEXT NOT NULL,
    "stocktakeId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "expectedQty" INTEGER NOT NULL,
    "countedQty" INTEGER,

    CONSTRAINT "StocktakeLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomComponent" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "bundleVariantId" TEXT NOT NULL,
    "componentVariantId" TEXT NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL,

    CONSTRAINT "BomComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LowStockAlert" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "reorderPoint" INTEGER NOT NULL,
    "currentStock" INTEGER NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LowStockAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Supplier_shop_idx" ON "Supplier"("shop");

-- CreateIndex
CREATE INDEX "SupplierSkuMapping_shopifyVariantId_idx" ON "SupplierSkuMapping"("shopifyVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierSkuMapping_supplierId_shopifyVariantId_key" ON "SupplierSkuMapping"("supplierId", "shopifyVariantId");

-- CreateIndex
CREATE INDEX "VolumePriceTier_supplierId_variantId_idx" ON "VolumePriceTier"("supplierId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadTimeSnapshot_purchaseOrderId_key" ON "LeadTimeSnapshot"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_shop_status_idx" ON "PurchaseOrder"("shop", "status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE INDEX "POLineItem_purchaseOrderId_idx" ON "POLineItem"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "POLineItem_shopifyVariantId_idx" ON "POLineItem"("shopifyVariantId");

-- CreateIndex
CREATE INDEX "ShopifyVariantCache_shop_barcode_idx" ON "ShopifyVariantCache"("shop", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyVariantCache_shop_shopifyVariantId_key" ON "ShopifyVariantCache"("shop", "shopifyVariantId");

-- CreateIndex
CREATE INDEX "InventorySnapshot_shop_snapshotDate_idx" ON "InventorySnapshot"("shop", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySnapshot_shop_shopifyVariantId_locationId_snapshot_key" ON "InventorySnapshot"("shop", "shopifyVariantId", "locationId", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "VariantAbcClass_shop_shopifyVariantId_locationId_metric_key" ON "VariantAbcClass"("shop", "shopifyVariantId", "locationId", "metric");

-- CreateIndex
CREATE UNIQUE INDEX "ForecastOverride_shop_variantId_locationId_key" ON "ForecastOverride"("shop", "variantId", "locationId");

-- CreateIndex
CREATE INDEX "SalesDailyAggregate_shop_date_idx" ON "SalesDailyAggregate"("shop", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SalesDailyAggregate_shop_shopifyVariantId_locationId_date_key" ON "SalesDailyAggregate"("shop", "shopifyVariantId", "locationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ShopSettings_shop_key" ON "ShopSettings"("shop");

-- CreateIndex
CREATE INDEX "TransferOrder_shop_status_idx" ON "TransferOrder"("shop", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BomComponent_shop_bundleVariantId_componentVariantId_key" ON "BomComponent"("shop", "bundleVariantId", "componentVariantId");

-- CreateIndex
CREATE INDEX "LowStockAlert_shop_acknowledged_idx" ON "LowStockAlert"("shop", "acknowledged");

-- AddForeignKey
ALTER TABLE "SupplierSkuMapping" ADD CONSTRAINT "SupplierSkuMapping_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolumePriceTier" ADD CONSTRAINT "VolumePriceTier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadTimeSnapshot" ADD CONSTRAINT "LeadTimeSnapshot_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POLineItem" ADD CONSTRAINT "POLineItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferLineItem" ADD CONSTRAINT "TransferLineItem_transferOrderId_fkey" FOREIGN KEY ("transferOrderId") REFERENCES "TransferOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StocktakeLineItem" ADD CONSTRAINT "StocktakeLineItem_stocktakeId_fkey" FOREIGN KEY ("stocktakeId") REFERENCES "Stocktake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

