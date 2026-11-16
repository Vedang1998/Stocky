-- Purchase-order receiving ledger: one row per delivery received against a
-- purchase order, and one row per purchase-order line on that delivery.
--
-- Additive only; no existing table is altered. Stock that was marked received
-- before this migration stays on POLineItem.receivedQty and has no receipt row.
--
-- Both tables are merchant tables. shopId NOT NULL, the composite foreign keys
-- to the purchase order, its line and the receipt, RLS and the shopId
-- immutability trigger are applied by tenant enforcement tooling (manifest).
--
-- inventoryOperationId and reversalOperationId name rows of InventoryOperation
-- without a foreign key: the inventory ledger is keyed by the receipt
-- (sourceType, sourceId) and is never deleted.
--
-- Recovery: forward-fix preferred. Emergency rollback may drop the two tables
-- and the enum type once no writer uses them.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TYPE "PurchaseOrderReceiptStatus" AS ENUM (
  'PENDING',
  'POSTED',
  'PARTIALLY_POSTED',
  'FAILED',
  'REVERSING',
  'REVERSED',
  'PARTIALLY_REVERSED',
  'REVERSAL_FAILED'
);

CREATE TABLE "PurchaseOrderReceipt" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "receiptNumber" INTEGER NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "payloadDigest" CHAR(64) NOT NULL,
    "status" "PurchaseOrderReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "locationGid" VARCHAR(256) NOT NULL,
    "supplierReference" VARCHAR(128),
    "note" VARCHAR(2000),
    "actorChannel" VARCHAR(16) NOT NULL,
    "actorUserId" VARCHAR(64),
    "inventoryOperationId" VARCHAR(64),
    "reversalOperationId" VARCHAR(64),
    "reversalNote" VARCHAR(2000),
    "reversedByUserId" VARCHAR(64),
    "failureCode" VARCHAR(128),
    "failureMessage" VARCHAR(1000),
    "postedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderReceipt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PurchaseOrderReceipt_receiptNumber_check" CHECK ("receiptNumber" >= 1)
);

CREATE TABLE "PurchaseOrderReceiptLine" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "lineItemId" TEXT NOT NULL,
    "shopifyVariantId" VARCHAR(256) NOT NULL,
    "inventoryItemGid" VARCHAR(256),
    "position" INTEGER NOT NULL DEFAULT 0,
    "acceptedQty" INTEGER NOT NULL DEFAULT 0,
    "rejectedQty" INTEGER NOT NULL DEFAULT 0,
    "rejectReason" VARCHAR(255),
    "postedQty" INTEGER NOT NULL DEFAULT 0,
    "reversedQty" INTEGER NOT NULL DEFAULT 0,
    "errorCode" VARCHAR(128),
    "errorMessage" VARCHAR(1000),

    CONSTRAINT "PurchaseOrderReceiptLine_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PurchaseOrderReceiptLine_position_check" CHECK ("position" >= 0),
    CONSTRAINT "PurchaseOrderReceiptLine_quantities_check"
      CHECK ("acceptedQty" >= 0 AND "rejectedQty" >= 0 AND "acceptedQty" + "rejectedQty" >= 1),
    CONSTRAINT "PurchaseOrderReceiptLine_postedQty_check"
      CHECK ("postedQty" >= 0 AND "postedQty" <= "acceptedQty"),
    CONSTRAINT "PurchaseOrderReceiptLine_reversedQty_check"
      CHECK ("reversedQty" >= 0 AND "reversedQty" <= "postedQty"),
    CONSTRAINT "PurchaseOrderReceiptLine_inventoryItem_check"
      CHECK ("acceptedQty" = 0 OR "inventoryItemGid" IS NOT NULL)
);

CREATE UNIQUE INDEX "PurchaseOrderReceipt_shopId_id_key" ON "PurchaseOrderReceipt"("shopId", "id");
CREATE UNIQUE INDEX "PurchaseOrderReceipt_shopId_idempotencyKey_key" ON "PurchaseOrderReceipt"("shopId", "idempotencyKey");
CREATE UNIQUE INDEX "PurchaseOrderReceipt_shopId_purchaseOrderId_receiptNumber_key" ON "PurchaseOrderReceipt"("shopId", "purchaseOrderId", "receiptNumber");
CREATE INDEX "PurchaseOrderReceipt_shopId_status_idx" ON "PurchaseOrderReceipt"("shopId", "status");

CREATE UNIQUE INDEX "PurchaseOrderReceiptLine_shopId_id_key" ON "PurchaseOrderReceiptLine"("shopId", "id");
CREATE UNIQUE INDEX "PurchaseOrderReceiptLine_receiptId_lineItemId_key" ON "PurchaseOrderReceiptLine"("receiptId", "lineItemId");
CREATE INDEX "PurchaseOrderReceiptLine_shopId_receiptId_idx" ON "PurchaseOrderReceiptLine"("shopId", "receiptId");
CREATE INDEX "PurchaseOrderReceiptLine_shopId_lineItemId_idx" ON "PurchaseOrderReceiptLine"("shopId", "lineItemId");

ALTER TABLE "PurchaseOrderReceipt" ADD CONSTRAINT "PurchaseOrderReceipt_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "PurchaseOrderReceipt" ADD CONSTRAINT "PurchaseOrderReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderReceiptLine" ADD CONSTRAINT "PurchaseOrderReceiptLine_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "PurchaseOrderReceiptLine" ADD CONSTRAINT "PurchaseOrderReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PurchaseOrderReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderReceiptLine" ADD CONSTRAINT "PurchaseOrderReceiptLine_lineItemId_fkey" FOREIGN KEY ("lineItemId") REFERENCES "POLineItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

RESET statement_timeout;
RESET lock_timeout;
