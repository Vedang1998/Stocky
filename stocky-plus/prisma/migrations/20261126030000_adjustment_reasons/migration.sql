-- Merchant-defined adjustment reasons (feature matrix F-072, "Adjustment
-- reason library"; PRD 3.10 "reason code").
-- Additive only: one new merchant table and one new nullable column.
-- "AdjustmentReason" holds the reasons a shop adds to the built-in list. Each
-- names the Shopify reason code that is sent with the quantity change.
-- "InventoryOperation"."reasonLabel" keeps the merchant's name for the reason
-- as it was when the adjustment was recorded, so renaming or removing a
-- reason later does not rewrite history. It is null for every existing row
-- and for every operation recorded with a built-in reason. Tenant RLS, the
-- shopId immutability trigger and runtime grants for the new table are
-- applied by tenant:enforcement:apply from the manifest, as for every
-- merchant table.
--
-- Rollback: restore stocky_inventory_operation_guard() from migration
-- 20261110220000_inventory_operation_ledger, drop the column, then drop the
-- table. That loses the merchants' own reasons and their names on recorded
-- adjustments; the Shopify reason code of every operation is untouched.

-- CreateTable
CREATE TABLE "AdjustmentReason" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "nameKey" VARCHAR(191) NOT NULL,
    "shopifyReason" VARCHAR(64) NOT NULL,
    "createdByUserId" VARCHAR(64),
    "updatedByUserId" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdjustmentReason_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AdjustmentReason_name_not_blank"
      CHECK (btrim("name") <> '' AND btrim("nameKey") <> ''),
    CONSTRAINT "AdjustmentReason_shopifyReason_not_blank"
      CHECK (btrim("shopifyReason") <> '')
);

-- CreateIndex
CREATE UNIQUE INDEX "AdjustmentReason_shopId_id_key" ON "AdjustmentReason"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AdjustmentReason_shopId_nameKey_key" ON "AdjustmentReason"("shopId", "nameKey");

-- AddForeignKey
ALTER TABLE "AdjustmentReason" ADD CONSTRAINT "AdjustmentReason_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AlterTable
ALTER TABLE "InventoryOperation" ADD COLUMN "reasonLabel" VARCHAR(60);

ALTER TABLE "InventoryOperation"
  ADD CONSTRAINT "InventoryOperation_reasonLabel_not_blank"
  CHECK ("reasonLabel" IS NULL OR btrim("reasonLabel") <> '');

-- The ledger guard, unchanged except that "reasonLabel" joins the request
-- columns that never change after insert. The rest of the body is the one
-- from 20261110220000_inventory_operation_ledger, line for line.
CREATE OR REPLACE FUNCTION stocky_inventory_operation_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME = 'InventoryOperation' THEN
    IF NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
       OR NEW."payloadDigest" IS DISTINCT FROM OLD."payloadDigest"
       OR NEW."kind" IS DISTINCT FROM OLD."kind"
       OR NEW."writeCapability" IS DISTINCT FROM OLD."writeCapability"
       OR NEW."sourceType" IS DISTINCT FROM OLD."sourceType"
       OR NEW."sourceId" IS DISTINCT FROM OLD."sourceId"
       OR NEW."reason" IS DISTINCT FROM OLD."reason"
       OR NEW."reasonLabel" IS DISTINCT FROM OLD."reasonLabel"
       OR NEW."quantityName" IS DISTINCT FROM OLD."quantityName"
       OR NEW."referenceDocumentUri" IS DISTINCT FROM OLD."referenceDocumentUri"
       OR NEW."actorShopifyUserId" IS DISTINCT FROM OLD."actorShopifyUserId"
       OR NEW."actorDisplayName" IS DISTINCT FROM OLD."actorDisplayName"
       OR NEW."actorChannel" IS DISTINCT FROM OLD."actorChannel"
       OR NEW."note" IS DISTINCT FROM OLD."note"
       OR NEW."reversesOperationId" IS DISTINCT FROM OLD."reversesOperationId"
       OR NEW."lineCount" IS DISTINCT FROM OLD."lineCount"
       OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
      RAISE EXCEPTION 'inventory_operation_request_immutable'
        USING ERRCODE = '23514';
    END IF;
    IF OLD."status" IN ('APPLIED', 'PARTIALLY_APPLIED', 'FAILED')
       AND (NEW."status" IS DISTINCT FROM OLD."status"
            OR NEW."appliedLineCount" IS DISTINCT FROM OLD."appliedLineCount"
            OR NEW."failedLineCount" IS DISTINCT FROM OLD."failedLineCount"
            OR NEW."conflictLineCount" IS DISTINCT FROM OLD."conflictLineCount"
            OR NEW."completedAt" IS DISTINCT FROM OLD."completedAt") THEN
      RAISE EXCEPTION 'inventory_operation_terminal_status_immutable'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW."operationId" IS DISTINCT FROM OLD."operationId"
       OR NEW."lineNumber" IS DISTINCT FROM OLD."lineNumber"
       OR NEW."inventoryItemGid" IS DISTINCT FROM OLD."inventoryItemGid"
       OR NEW."variantGid" IS DISTINCT FROM OLD."variantGid"
       OR NEW."locationGid" IS DISTINCT FROM OLD."locationGid"
       OR NEW."delta" IS DISTINCT FROM OLD."delta"
       OR NEW."changeFromQuantity" IS DISTINCT FROM OLD."changeFromQuantity"
       OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
      RAISE EXCEPTION 'inventory_operation_line_request_immutable'
        USING ERRCODE = '23514';
    END IF;
    IF OLD."status" IN ('APPLIED', 'FAILED', 'CONFLICT')
       AND (NEW."status" IS DISTINCT FROM OLD."status"
            OR NEW."batchKey" IS DISTINCT FROM OLD."batchKey"
            OR NEW."shopifyAdjustmentGroupGid" IS DISTINCT FROM OLD."shopifyAdjustmentGroupGid"
            OR NEW."quantityAfterChange" IS DISTINCT FROM OLD."quantityAfterChange"
            OR NEW."errorCode" IS DISTINCT FROM OLD."errorCode"
            OR NEW."errorMessage" IS DISTINCT FROM OLD."errorMessage"
            OR NEW."appliedAt" IS DISTINCT FROM OLD."appliedAt") THEN
      RAISE EXCEPTION 'inventory_operation_line_terminal_status_immutable'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION stocky_inventory_operation_guard() FROM PUBLIC;
