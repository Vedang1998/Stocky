-- Purchasing ledger, stage 2: supplier profiles, PO ledger fields, PO charges
-- and the purchasing audit trail.
--
-- Additive only. New columns are nullable or carry defaults that preserve the
-- meaning of existing rows (MOQ/pack size 1 = no rule, version 1, position 0,
-- no cancelled quantity). Legacy PurchaseOrder.freightCost/customsCost stay in
-- place and are read as charges by the application until a PO's charges are
-- edited; no merchant data is transformed here.
--
-- CHECK constraints on pre-existing columns are added NOT VALID: they bind every
-- new or updated row without scanning or rejecting historical rows.
--
-- PurchaseOrderCharge and PurchasingEvent are merchant tables. shopId NOT NULL,
-- the (shopId, purchaseOrderId) composite foreign key, RLS and the shopId
-- immutability trigger are applied by tenant enforcement tooling (manifest).
--
-- Recovery: forward-fix preferred. Emergency rollback may drop the two new
-- tables, the three new enum types and the new columns once no writer uses them.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "SupplierContactMethod" AS ENUM ('EMAIL', 'PHONE', 'PORTAL', 'OTHER');
CREATE TYPE "PurchaseOrderChargeKind" AS ENUM ('SHIPPING', 'DUTY', 'FEE', 'DISCOUNT', 'OTHER');

ALTER TABLE "Supplier"
  ADD COLUMN "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "website" VARCHAR(512),
  ADD COLUMN "addressLine1" VARCHAR(255),
  ADD COLUMN "addressLine2" VARCHAR(255),
  ADD COLUMN "city" VARCHAR(128),
  ADD COLUMN "region" VARCHAR(128),
  ADD COLUMN "postalCode" VARCHAR(32),
  ADD COLUMN "countryCode" VARCHAR(2),
  ADD COLUMN "paymentTerms" VARCHAR(255),
  ADD COLUMN "shippingTerms" VARCHAR(255),
  ADD COLUMN "defaultTaxRatePercent" DECIMAL(7,4),
  ADD COLUMN "defaultLeadTimeDays" INTEGER,
  ADD COLUMN "defaultRestockDays" INTEGER,
  ADD COLUMN "minimumOrderValue" DECIMAL(12,2),
  ADD COLUMN "preferredContactMethod" "SupplierContactMethod";

ALTER TABLE "Supplier"
  ADD CONSTRAINT "Supplier_defaultTaxRatePercent_check"
    CHECK ("defaultTaxRatePercent" IS NULL OR ("defaultTaxRatePercent" >= 0 AND "defaultTaxRatePercent" <= 100)),
  ADD CONSTRAINT "Supplier_defaultLeadTimeDays_check"
    CHECK ("defaultLeadTimeDays" IS NULL OR "defaultLeadTimeDays" >= 0),
  ADD CONSTRAINT "Supplier_defaultRestockDays_check"
    CHECK ("defaultRestockDays" IS NULL OR "defaultRestockDays" >= 0),
  ADD CONSTRAINT "Supplier_minimumOrderValue_check"
    CHECK ("minimumOrderValue" IS NULL OR "minimumOrderValue" >= 0);

ALTER TABLE "SupplierSkuMapping"
  ALTER COLUMN "vendorSku" DROP NOT NULL,
  ADD COLUMN "isPreferred" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "supplierCost" DECIMAL(12,4),
  ADD COLUMN "leadTimeDaysOverride" INTEGER,
  ADD COLUMN "orderUnit" VARCHAR(64);

ALTER TABLE "SupplierSkuMapping"
  ADD CONSTRAINT "SupplierSkuMapping_supplierCost_check"
    CHECK ("supplierCost" IS NULL OR "supplierCost" >= 0),
  ADD CONSTRAINT "SupplierSkuMapping_leadTimeDaysOverride_check"
    CHECK ("leadTimeDaysOverride" IS NULL OR "leadTimeDaysOverride" >= 0);

ALTER TABLE "SupplierSkuMapping"
  ADD CONSTRAINT "SupplierSkuMapping_moq_check" CHECK ("moq" >= 1) NOT VALID,
  ADD CONSTRAINT "SupplierSkuMapping_packSize_check" CHECK ("packSize" >= 1) NOT VALID;

ALTER TABLE "VolumePriceTier"
  ADD CONSTRAINT "VolumePriceTier_minQty_check" CHECK ("minQty" >= 1) NOT VALID,
  ADD CONSTRAINT "VolumePriceTier_maxQty_check" CHECK ("maxQty" IS NULL OR "maxQty" >= "minQty") NOT VALID,
  ADD CONSTRAINT "VolumePriceTier_unitCost_check" CHECK ("unitCost" >= 0) NOT VALID;

ALTER TABLE "PurchaseOrder"
  ADD COLUMN "poSequence" INTEGER,
  ADD COLUMN "creationKey" VARCHAR(128),
  ADD COLUMN "supplierOrderNumber" VARCHAR(128),
  ADD COLUMN "invoiceNumber" VARCHAR(128),
  ADD COLUMN "issuedOn" DATE,
  ADD COLUMN "expectedOn" DATE,
  ADD COLUMN "shipOn" DATE,
  ADD COLUMN "cancelOn" DATE,
  ADD COLUMN "invoiceOn" DATE,
  ADD COLUMN "paymentDueOn" DATE,
  ADD COLUMN "paymentTerms" VARCHAR(255),
  ADD COLUMN "shippingTerms" VARCHAR(255),
  ADD COLUMN "shipToAddress" VARCHAR(2000),
  ADD COLUMN "billToAddress" VARCHAR(2000),
  ADD COLUMN "buyerName" VARCHAR(255),
  ADD COLUMN "supplierNotes" VARCHAR(4000),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "sentVersion" INTEGER,
  ADD COLUMN "sentAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "createdByUserId" VARCHAR(64);

ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_poSequence_check"
    CHECK ("poSequence" IS NULL OR "poSequence" >= 1),
  ADD CONSTRAINT "PurchaseOrder_version_check" CHECK ("version" >= 1),
  ADD CONSTRAINT "PurchaseOrder_sentVersion_check"
    CHECK ("sentVersion" IS NULL OR ("sentVersion" >= 1 AND "sentVersion" <= "version"));

ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_exchangeRate_check"
    CHECK ("exchangeRate" IS NULL OR "exchangeRate" > 0) NOT VALID;

ALTER TABLE "POLineItem"
  ADD COLUMN "productTitle" VARCHAR(512),
  ADD COLUMN "variantTitle" VARCHAR(512),
  ADD COLUMN "sku" VARCHAR(255),
  ADD COLUMN "barcode" VARCHAR(255),
  ADD COLUMN "inventoryItemGid" VARCHAR(256),
  ADD COLUMN "cancelledQty" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "discountPercent" DECIMAL(7,4),
  ADD COLUMN "taxRatePercent" DECIMAL(7,4),
  ADD COLUMN "packSize" INTEGER,
  ADD COLUMN "orderUnit" VARCHAR(64),
  ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "note" VARCHAR(1000),
  ADD COLUMN "allocatedChargesTotal" DECIMAL(12,2);

ALTER TABLE "POLineItem"
  ADD CONSTRAINT "POLineItem_cancelledQty_check" CHECK ("cancelledQty" >= 0),
  ADD CONSTRAINT "POLineItem_discountPercent_check"
    CHECK ("discountPercent" IS NULL OR ("discountPercent" >= 0 AND "discountPercent" <= 100)),
  ADD CONSTRAINT "POLineItem_taxRatePercent_check"
    CHECK ("taxRatePercent" IS NULL OR ("taxRatePercent" >= 0 AND "taxRatePercent" <= 100)),
  ADD CONSTRAINT "POLineItem_packSize_check" CHECK ("packSize" IS NULL OR "packSize" >= 1),
  ADD CONSTRAINT "POLineItem_position_check" CHECK ("position" >= 0);

ALTER TABLE "POLineItem"
  ADD CONSTRAINT "POLineItem_orderedQty_check" CHECK ("orderedQty" >= 0) NOT VALID,
  ADD CONSTRAINT "POLineItem_receivedQty_check" CHECK ("receivedQty" >= 0) NOT VALID,
  ADD CONSTRAINT "POLineItem_unitCost_check" CHECK ("unitCost" >= 0) NOT VALID;

CREATE TABLE "PurchaseOrderCharge" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "kind" "PurchaseOrderChargeKind" NOT NULL,
    "description" VARCHAR(255),
    "amount" DECIMAL(12,2) NOT NULL,
    "allocate" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderCharge_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PurchaseOrderCharge_amount_check" CHECK ("amount" >= 0),
    CONSTRAINT "PurchaseOrderCharge_position_check" CHECK ("position" >= 0)
);

CREATE TABLE "PurchasingEvent" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "subjectType" VARCHAR(32) NOT NULL,
    "subjectId" VARCHAR(64) NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "actorType" VARCHAR(16) NOT NULL,
    "actorId" VARCHAR(64),
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchasingEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PurchaseOrderCharge_shopId_purchaseOrderId_idx" ON "PurchaseOrderCharge"("shopId", "purchaseOrderId");
CREATE UNIQUE INDEX "PurchaseOrderCharge_shopId_id_key" ON "PurchaseOrderCharge"("shopId", "id");
CREATE INDEX "PurchasingEvent_shopId_subjectType_subjectId_createdAt_idx" ON "PurchasingEvent"("shopId", "subjectType", "subjectId", "createdAt");
CREATE UNIQUE INDEX "PurchasingEvent_shopId_id_key" ON "PurchasingEvent"("shopId", "id");

-- Tenant-bearing selector for supplier product upserts (issue #75). The
-- existing (supplierId, shopifyVariantId) unique already guarantees these rows
-- are distinct, so the wider index cannot conflict with historical data.
CREATE UNIQUE INDEX "SupplierSkuMapping_shopId_supplierId_shopifyVariantId_key" ON "SupplierSkuMapping"("shopId", "supplierId", "shopifyVariantId");

-- PurchaseOrder is small; poSequence and creationKey are NULL for existing rows
-- and poNumber was never written by earlier code, so these unique indexes
-- cannot conflict with historical data.
CREATE INDEX "PurchaseOrder_shopId_status_expectedOn_idx" ON "PurchaseOrder"("shopId", "status", "expectedOn");
CREATE UNIQUE INDEX "PurchaseOrder_shopId_poSequence_key" ON "PurchaseOrder"("shopId", "poSequence");
CREATE UNIQUE INDEX "PurchaseOrder_shopId_creationKey_key" ON "PurchaseOrder"("shopId", "creationKey");
CREATE UNIQUE INDEX "PurchaseOrder_shopId_poNumber_key" ON "PurchaseOrder"("shopId", "poNumber");

ALTER TABLE "PurchaseOrderCharge" ADD CONSTRAINT "PurchaseOrderCharge_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "PurchaseOrderCharge" ADD CONSTRAINT "PurchaseOrderCharge_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchasingEvent" ADD CONSTRAINT "PurchasingEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

RESET statement_timeout;
RESET lock_timeout;
