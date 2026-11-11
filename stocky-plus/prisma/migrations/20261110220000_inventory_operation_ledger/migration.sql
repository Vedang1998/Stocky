-- Inventory control: operation ledger for app-initiated Shopify inventory writes.
-- Additive only: two new merchant tables, their enums, CHECK constraints and an
-- immutability guard. No existing table, column or row is touched.
-- RLS, shopId immutability triggers and runtime grants are applied afterwards
-- by tenant:enforcement:apply from scripts/tenant-enforcement/manifest.ts.
-- Rollback: DROP TRIGGER/FUNCTION below, DROP TABLE "InventoryOperationLine",
-- "InventoryOperation", then the four enums (no other object depends on them).

-- CreateEnum
CREATE TYPE "InventoryOperationKind" AS ENUM ('ADJUSTMENT', 'STOCKTAKE', 'RECEIPT', 'TRANSFER', 'REVERSAL');

-- CreateEnum
CREATE TYPE "InventoryOperationStatus" AS ENUM ('PENDING', 'APPLYING', 'RETRY_PENDING', 'BLOCKED', 'APPLIED', 'PARTIALLY_APPLIED', 'FAILED');

-- CreateEnum
CREATE TYPE "InventoryOperationLineStatus" AS ENUM ('PENDING', 'IN_FLIGHT', 'APPLIED', 'FAILED', 'CONFLICT');

-- CreateEnum
CREATE TYPE "InventoryActorChannel" AS ENUM ('ADMIN', 'POS', 'SYSTEM');

-- CreateTable
CREATE TABLE "InventoryOperation" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "payloadDigest" VARCHAR(64) NOT NULL,
    "kind" "InventoryOperationKind" NOT NULL,
    "writeCapability" VARCHAR(64) NOT NULL,
    "sourceType" VARCHAR(64) NOT NULL,
    "sourceId" VARCHAR(191) NOT NULL,
    "reason" VARCHAR(64) NOT NULL,
    "quantityName" VARCHAR(32) NOT NULL,
    "referenceDocumentUri" VARCHAR(512),
    "actorShopifyUserId" VARCHAR(64),
    "actorDisplayName" VARCHAR(255),
    "actorChannel" "InventoryActorChannel" NOT NULL,
    "note" VARCHAR(2000),
    "reversesOperationId" TEXT,
    "status" "InventoryOperationStatus" NOT NULL DEFAULT 'PENDING',
    "lineCount" INTEGER NOT NULL,
    "appliedLineCount" INTEGER NOT NULL DEFAULT 0,
    "failedLineCount" INTEGER NOT NULL DEFAULT 0,
    "conflictLineCount" INTEGER NOT NULL DEFAULT 0,
    "batchSequence" INTEGER NOT NULL DEFAULT 0,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "leaseOwner" VARCHAR(64),
    "leaseExpiresAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "lastErrorCode" VARCHAR(64),
    "lastErrorMessage" VARCHAR(1000),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryOperationLine" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "inventoryItemGid" VARCHAR(256) NOT NULL,
    "variantGid" VARCHAR(256),
    "locationGid" VARCHAR(256) NOT NULL,
    "delta" INTEGER NOT NULL,
    "changeFromQuantity" INTEGER,
    "status" "InventoryOperationLineStatus" NOT NULL DEFAULT 'PENDING',
    "batchKey" VARCHAR(128),
    "shopifyAdjustmentGroupGid" VARCHAR(256),
    "quantityAfterChange" INTEGER,
    "errorCode" VARCHAR(64),
    "errorMessage" VARCHAR(1000),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryOperationLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryOperation_shopId_sourceType_sourceId_idx" ON "InventoryOperation"("shopId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "InventoryOperation_shopId_status_createdAt_idx" ON "InventoryOperation"("shopId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryOperation_shopId_createdAt_idx" ON "InventoryOperation"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryOperation_shopId_reversesOperationId_idx" ON "InventoryOperation"("shopId", "reversesOperationId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryOperation_shopId_id_key" ON "InventoryOperation"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryOperation_shopId_idempotencyKey_key" ON "InventoryOperation"("shopId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "InventoryOperationLine_shopId_operationId_status_idx" ON "InventoryOperationLine"("shopId", "operationId", "status");

-- CreateIndex
CREATE INDEX "InventoryOperationLine_shopId_inventoryItemGid_locationGid_idx" ON "InventoryOperationLine"("shopId", "inventoryItemGid", "locationGid");

-- CreateIndex
CREATE INDEX "InventoryOperationLine_shopId_batchKey_idx" ON "InventoryOperationLine"("shopId", "batchKey");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryOperationLine_shopId_id_key" ON "InventoryOperationLine"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryOperationLine_shopId_operationId_lineNumber_key" ON "InventoryOperationLine"("shopId", "operationId", "lineNumber");

-- AddForeignKey
ALTER TABLE "InventoryOperation" ADD CONSTRAINT "InventoryOperation_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "InventoryOperationLine" ADD CONSTRAINT "InventoryOperationLine_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "InventoryOperationLine" ADD CONSTRAINT "InventoryOperationLine_shopId_operationId_fkey" FOREIGN KEY ("shopId", "operationId") REFERENCES "InventoryOperation"("shopId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;


-- Request shape invariants.
ALTER TABLE "InventoryOperation"
  ADD CONSTRAINT "InventoryOperation_line_count_check"
  CHECK ("lineCount" BETWEEN 1 AND 5000);

ALTER TABLE "InventoryOperation"
  ADD CONSTRAINT "InventoryOperation_result_counts_check"
  CHECK (
    "appliedLineCount" >= 0
    AND "failedLineCount" >= 0
    AND "conflictLineCount" >= 0
    AND "appliedLineCount" + "failedLineCount" + "conflictLineCount" <= "lineCount"
  );

ALTER TABLE "InventoryOperation"
  ADD CONSTRAINT "InventoryOperation_counters_nonnegative_check"
  CHECK ("batchSequence" >= 0 AND "attemptCount" >= 0);

ALTER TABLE "InventoryOperation"
  ADD CONSTRAINT "InventoryOperation_completed_at_check"
  CHECK (
    ("status" IN ('APPLIED', 'PARTIALLY_APPLIED', 'FAILED')) = ("completedAt" IS NOT NULL)
  );

ALTER TABLE "InventoryOperation"
  ADD CONSTRAINT "InventoryOperation_reversal_link_check"
  CHECK (("kind" = 'REVERSAL') = ("reversesOperationId" IS NOT NULL));

ALTER TABLE "InventoryOperationLine"
  ADD CONSTRAINT "InventoryOperationLine_line_number_check"
  CHECK ("lineNumber" >= 1);

ALTER TABLE "InventoryOperationLine"
  ADD CONSTRAINT "InventoryOperationLine_delta_nonzero_check"
  CHECK ("delta" <> 0);

ALTER TABLE "InventoryOperationLine"
  ADD CONSTRAINT "InventoryOperationLine_applied_at_check"
  CHECK (("status" = 'APPLIED') = ("appliedAt" IS NOT NULL));

ALTER TABLE "InventoryOperationLine"
  ADD CONSTRAINT "InventoryOperationLine_in_flight_key_check"
  CHECK ("status" <> 'IN_FLIGHT' OR "batchKey" IS NOT NULL);

-- Ledger immutability: request columns never change after insert, terminal
-- statuses never change, and an applied line's Shopify evidence is frozen.
-- shopId immutability is enforced separately by stocky_prevent_shop_id_mutation.
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

DROP TRIGGER IF EXISTS trg_InventoryOperation_guard ON "InventoryOperation";
CREATE TRIGGER trg_InventoryOperation_guard
  BEFORE UPDATE ON "InventoryOperation"
  FOR EACH ROW
  EXECUTE FUNCTION stocky_inventory_operation_guard();

DROP TRIGGER IF EXISTS trg_InventoryOperationLine_guard ON "InventoryOperationLine";
CREATE TRIGGER trg_InventoryOperationLine_guard
  BEFORE UPDATE ON "InventoryOperationLine"
  FOR EACH ROW
  EXECUTE FUNCTION stocky_inventory_operation_guard();
