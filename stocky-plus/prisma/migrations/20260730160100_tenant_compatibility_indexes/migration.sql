-- Phase 1 PR 1 — Compatibility indexes
--
-- DEVIATION (tooling): Prisma Migrate 6.19 applies each migration inside a
-- transaction. PostgreSQL rejects CREATE INDEX CONCURRENTLY in a transaction
-- (SQLSTATE 25001 / Prisma P3018). Evidence recorded in the implementation
-- report. This migration therefore uses CREATE INDEX / CREATE UNIQUE INDEX
-- with IF NOT EXISTS, explicit lock_timeout, and statement_timeout.
--
-- Production large-table path (runbook): build the same index names with
-- CREATE INDEX CONCURRENTLY via psql / `prisma db execute` outside Migrate,
-- then mark verified. Interrupted concurrent builds may leave INVALID indexes;
-- DROP INDEX CONCURRENTLY IF EXISTS <name> and recreate.
--
-- No RLS. No composite child foreign keys. No NOT NULL enforcement.
-- Safe failure on lock timeout (migration aborts; data intact).

SET lock_timeout = '5s';
SET statement_timeout = '30min';

-- Direct shopId indexes on every merchant-owned model
CREATE INDEX IF NOT EXISTS "Supplier_shopId_idx" ON "Supplier"("shopId");
CREATE INDEX IF NOT EXISTS "SupplierSkuMapping_shopId_idx" ON "SupplierSkuMapping"("shopId");
CREATE INDEX IF NOT EXISTS "VolumePriceTier_shopId_idx" ON "VolumePriceTier"("shopId");
CREATE INDEX IF NOT EXISTS "LeadTimeSnapshot_shopId_idx" ON "LeadTimeSnapshot"("shopId");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_shopId_idx" ON "PurchaseOrder"("shopId");
CREATE INDEX IF NOT EXISTS "POLineItem_shopId_idx" ON "POLineItem"("shopId");
CREATE INDEX IF NOT EXISTS "ShopifyVariantCache_shopId_idx" ON "ShopifyVariantCache"("shopId");
CREATE INDEX IF NOT EXISTS "InventorySnapshot_shopId_idx" ON "InventorySnapshot"("shopId");
CREATE INDEX IF NOT EXISTS "VariantAbcClass_shopId_idx" ON "VariantAbcClass"("shopId");
CREATE INDEX IF NOT EXISTS "ForecastOverride_shopId_idx" ON "ForecastOverride"("shopId");
CREATE INDEX IF NOT EXISTS "SalesDailyAggregate_shopId_idx" ON "SalesDailyAggregate"("shopId");
CREATE INDEX IF NOT EXISTS "ShopSettings_shopId_idx" ON "ShopSettings"("shopId");
CREATE INDEX IF NOT EXISTS "TransferOrder_shopId_idx" ON "TransferOrder"("shopId");
CREATE INDEX IF NOT EXISTS "TransferLineItem_shopId_idx" ON "TransferLineItem"("shopId");
CREATE INDEX IF NOT EXISTS "Stocktake_shopId_idx" ON "Stocktake"("shopId");
CREATE INDEX IF NOT EXISTS "StocktakeLineItem_shopId_idx" ON "StocktakeLineItem"("shopId");
CREATE INDEX IF NOT EXISTS "BomComponent_shopId_idx" ON "BomComponent"("shopId");
CREATE INDEX IF NOT EXISTS "LowStockAlert_shopId_idx" ON "LowStockAlert"("shopId");

-- Parent composite unique indexes for future composite FKs (PR 3)
CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_shopId_id_key" ON "Supplier"("shopId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_shopId_id_key" ON "PurchaseOrder"("shopId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "TransferOrder_shopId_id_key" ON "TransferOrder"("shopId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "Stocktake_shopId_id_key" ON "Stocktake"("shopId", "id");

-- Child-side compatibility indexes (shopId + parent id)
CREATE INDEX IF NOT EXISTS "SupplierSkuMapping_shopId_supplierId_idx"
  ON "SupplierSkuMapping"("shopId", "supplierId");
CREATE INDEX IF NOT EXISTS "VolumePriceTier_shopId_supplierId_idx"
  ON "VolumePriceTier"("shopId", "supplierId");
CREATE INDEX IF NOT EXISTS "LeadTimeSnapshot_shopId_supplierId_idx"
  ON "LeadTimeSnapshot"("shopId", "supplierId");
CREATE INDEX IF NOT EXISTS "POLineItem_shopId_purchaseOrderId_idx"
  ON "POLineItem"("shopId", "purchaseOrderId");
CREATE INDEX IF NOT EXISTS "TransferLineItem_shopId_transferOrderId_idx"
  ON "TransferLineItem"("shopId", "transferOrderId");
CREATE INDEX IF NOT EXISTS "StocktakeLineItem_shopId_stocktakeId_idx"
  ON "StocktakeLineItem"("shopId", "stocktakeId");

RESET lock_timeout;
RESET statement_timeout;
