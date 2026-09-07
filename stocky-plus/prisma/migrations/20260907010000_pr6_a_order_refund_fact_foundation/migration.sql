-- PR6-A order / refund fact foundation.
-- Additive only. Does not edit prior migrations. Does not transform merchant data.
-- Does not execute production DML. Does not create ShopifyOrderShippingLineFact.
-- Refund shipping money is columns on ShopifyOrderRefundFact (§5.7).
-- Shop.ianaTimezone / Shop.currencyCode are nullable-first with no UTC or
-- server-local default. Authoritative Admin values are non-null; missing later
-- apply input fails closed in PR6-C, not here.
--
-- Recovery: leave new objects unused. PR6-B/C/D are not authorized. Emergency
-- rollback may DROP the new tables/enums/functions/columns after confirming no
-- production writer exists (production is not authorized in this slice).
-- Forward recovery is preferred.
--
-- Observation generations reuse platform sequence stocky_catalog_observation_gen_seq.
-- Do not create a second sequence. Do not add a generation counter to Shop.

-- Alter populated Shop with explicit low-lock / time-limit conventions (D-024).
SET lock_timeout = '5s';
SET statement_timeout = '15s';
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "ianaTimezone" VARCHAR(64);
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "currencyCode" VARCHAR(8);
RESET statement_timeout;
RESET lock_timeout;

-- CreateEnum
CREATE TYPE "OrderExistenceState" AS ENUM ('LIVE', 'ABSENT');

-- CreateEnum
CREATE TYPE "OrderExistenceKind" AS ENUM ('LIVE_REFETCH', 'LIVE_FULL_SYNC_PRESENT', 'ABSENT_CONFIRMED_QUERY', 'INACCESSIBLE_HISTORY_WINDOW', 'ABSENT_SIGNALLED_DELETE_UNVERIFIED');

-- CreateEnum
CREATE TYPE "OrderAttributeFreshnessState" AS ENUM ('ORDERED', 'DEGRADED');

-- CreateEnum
CREATE TYPE "OrderAbsenceNominationState" AS ENUM ('NONE', 'CANDIDATE', 'CIRCUIT_BREAKER_HELD');

-- CreateEnum
CREATE TYPE "OrderObservationLifecycleState" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "OrderResourceKind" AS ENUM ('Order', 'OrderLine', 'Refund', 'RefundLine');

-- CreateEnum
CREATE TYPE "OrderSourceKind" AS ENUM ('FULL_SYNC', 'INCREMENTAL_REFETCH', 'DELETE_WEBHOOK', 'RECONCILE', 'TRANSACTION_WEBHOOK');

-- CreateEnum
CREATE TYPE "OrderDeletionSource" AS ENUM ('WEBHOOK', 'CONFIRMED_QUERY');


-- CreateTable
CREATE TABLE "ShopifyOrderFact" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopifyGid" VARCHAR(256) NOT NULL,
    "name" TEXT NOT NULL,
    "shopifyCreatedAt" TIMESTAMP(3),
    "shopifyUpdatedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMPTZ(3),
    "processedAtShopify" VARCHAR(64),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" VARCHAR(64),
    "closed" BOOLEAN NOT NULL,
    "closedAt" TIMESTAMP(3),
    "edited" BOOLEAN NOT NULL,
    "test" BOOLEAN NOT NULL,
    "confirmed" BOOLEAN NOT NULL,
    "shopCurrencyCode" VARCHAR(8) NOT NULL,
    "presentmentCurrencyCode" VARCHAR(8),
    "taxesIncluded" BOOLEAN NOT NULL,
    "displayFinancialStatus" VARCHAR(64),
    "displayFulfillmentStatus" VARCHAR(64),
    "sourceName" VARCHAR(64),
    "retailLocationGid" VARCHAR(256),
    "currentSubtotalLineItemsQuantity" INTEGER,
    "subtotalLineItemsQuantity" INTEGER,
    "originalTotalShopAmount" DECIMAL(20,6),
    "originalTotalShopCurrencyCode" VARCHAR(8),
    "originalTotalPresentmentAmount" DECIMAL(20,6),
    "originalTotalPresentmentCurrencyCode" VARCHAR(8),
    "currentTotalShopAmount" DECIMAL(20,6),
    "currentTotalShopCurrencyCode" VARCHAR(8),
    "currentTotalPresentmentAmount" DECIMAL(20,6),
    "currentTotalPresentmentCurrencyCode" VARCHAR(8),
    "currentSubtotalShopAmount" DECIMAL(20,6),
    "currentSubtotalShopCurrencyCode" VARCHAR(8),
    "currentSubtotalPresentmentAmount" DECIMAL(20,6),
    "currentSubtotalPresentmentCurrencyCode" VARCHAR(8),
    "currentTotalDiscountsShopAmount" DECIMAL(20,6),
    "currentTotalDiscountsShopCurrencyCode" VARCHAR(8),
    "currentTotalDiscountsPresentmentAmount" DECIMAL(20,6),
    "currentTotalDiscountsPresentmentCurrencyCode" VARCHAR(8),
    "currentTotalTaxShopAmount" DECIMAL(20,6),
    "currentTotalTaxShopCurrencyCode" VARCHAR(8),
    "currentTotalTaxPresentmentAmount" DECIMAL(20,6),
    "currentTotalTaxPresentmentCurrencyCode" VARCHAR(8),
    "totalRefundedShopAmount" DECIMAL(20,6),
    "totalRefundedShopCurrencyCode" VARCHAR(8),
    "totalRefundedPresentmentAmount" DECIMAL(20,6),
    "totalRefundedPresentmentCurrencyCode" VARCHAR(8),
    "netPaymentShopAmount" DECIMAL(20,6),
    "netPaymentShopCurrencyCode" VARCHAR(8),
    "netPaymentPresentmentAmount" DECIMAL(20,6),
    "netPaymentPresentmentCurrencyCode" VARCHAR(8),
    "refundDiscrepancyShopAmount" DECIMAL(20,6),
    "refundDiscrepancyShopCurrencyCode" VARCHAR(8),
    "refundDiscrepancyPresentmentAmount" DECIMAL(20,6),
    "refundDiscrepancyPresentmentCurrencyCode" VARCHAR(8),
    "cartDiscountShopAmount" DECIMAL(20,6),
    "cartDiscountShopCurrencyCode" VARCHAR(8),
    "cartDiscountPresentmentAmount" DECIMAL(20,6),
    "cartDiscountPresentmentCurrencyCode" VARCHAR(8),
    "currentCartDiscountShopAmount" DECIMAL(20,6),
    "currentCartDiscountShopCurrencyCode" VARCHAR(8),
    "currentCartDiscountPresentmentAmount" DECIMAL(20,6),
    "currentCartDiscountPresentmentCurrencyCode" VARCHAR(8),
    "currentShippingShopAmount" DECIMAL(20,6),
    "currentShippingShopCurrencyCode" VARCHAR(8),
    "currentShippingPresentmentAmount" DECIMAL(20,6),
    "currentShippingPresentmentCurrencyCode" VARCHAR(8),
    "existenceState" "OrderExistenceState" NOT NULL,
    "existenceKind" "OrderExistenceKind" NOT NULL,
    "existenceObservedAt" TIMESTAMP(3) NOT NULL,
    "existenceRequestGen" BIGINT,
    "existenceResponseGen" BIGINT,
    "signalReceivedAt" TIMESTAMP(3),
    "lastSignalTopic" VARCHAR(128),
    "lastSignalDeliveryId" VARCHAR(128),
    "lastSignalTriggeredAt" TIMESTAMP(3),
    "lastSeenFullSyncRunId" TEXT,
    "attributeRequestGen" BIGINT,
    "attributeResponseGen" BIGINT,
    "attributeFreshnessState" "OrderAttributeFreshnessState" NOT NULL DEFAULT 'ORDERED',
    "existenceDiagnosticState" VARCHAR(128),
    "absenceNominationState" "OrderAbsenceNominationState" NOT NULL DEFAULT 'NONE',
    "ingestBatchId" TEXT,
    "moneyDiagnosticState" VARCHAR(128),
    "unitDiagnosticState" VARCHAR(128),
    "historyWindowState" VARCHAR(128),
    "sourceKind" "OrderSourceKind" NOT NULL,
    "lastSyncRunId" TEXT,
    "lastDurableJobId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletionSource" "OrderDeletionSource",
    "shopifyLegacyResourceId" VARCHAR(64),
    "accessScopeSnapshot" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyOrderFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyOrderLineFact" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopifyGid" VARCHAR(256) NOT NULL,
    "shopifyOrderGid" VARCHAR(256) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "currentQuantity" INTEGER NOT NULL,
    "refundableQuantity" INTEGER NOT NULL,
    "unfulfilledQuantity" INTEGER,
    "isGiftCard" BOOLEAN NOT NULL,
    "title" TEXT NOT NULL,
    "variantTitle" TEXT,
    "vendor" TEXT,
    "sku" TEXT,
    "name" TEXT,
    "variantGidAtSale" VARCHAR(256),
    "productGidAtSale" VARCHAR(256),
    "currentVariantGid" VARCHAR(256),
    "currentProductGid" VARCHAR(256),
    "variantLegacyResourceId" VARCHAR(64),
    "orderProcessedAt" TIMESTAMPTZ(3),
    "orderCancelledAt" TIMESTAMP(3),
    "orderTest" BOOLEAN NOT NULL,
    "orderShopCurrencyCode" VARCHAR(8) NOT NULL,
    "originalTotalShopAmount" DECIMAL(20,6),
    "originalTotalShopCurrencyCode" VARCHAR(8),
    "originalTotalPresentmentAmount" DECIMAL(20,6),
    "originalTotalPresentmentCurrencyCode" VARCHAR(8),
    "originalUnitPriceShopAmount" DECIMAL(20,6),
    "originalUnitPriceShopCurrencyCode" VARCHAR(8),
    "originalUnitPricePresentmentAmount" DECIMAL(20,6),
    "originalUnitPricePresentmentCurrencyCode" VARCHAR(8),
    "discountedTotalShopAmount" DECIMAL(20,6),
    "discountedTotalShopCurrencyCode" VARCHAR(8),
    "discountedTotalPresentmentAmount" DECIMAL(20,6),
    "discountedTotalPresentmentCurrencyCode" VARCHAR(8),
    "totalDiscountShopAmount" DECIMAL(20,6),
    "totalDiscountShopCurrencyCode" VARCHAR(8),
    "totalDiscountPresentmentAmount" DECIMAL(20,6),
    "totalDiscountPresentmentCurrencyCode" VARCHAR(8),
    "discountedUnitPriceAfterAllDiscountsShopAmount" DECIMAL(20,6),
    "discountedUnitPriceAfterAllDiscountsShopCurrencyCode" VARCHAR(8),
    "discountedUnitPriceAfterAllDiscountsPresentmentAmount" DECIMAL(20,6),
    "discountedUnitPriceAfterAllDiscountsPresentmentCurrencyCode" VARCHAR(8),
    "existenceState" "OrderExistenceState" NOT NULL,
    "existenceKind" "OrderExistenceKind" NOT NULL,
    "existenceObservedAt" TIMESTAMP(3) NOT NULL,
    "existenceRequestGen" BIGINT,
    "existenceResponseGen" BIGINT,
    "signalReceivedAt" TIMESTAMP(3),
    "lastSignalTopic" VARCHAR(128),
    "lastSignalDeliveryId" VARCHAR(128),
    "lastSignalTriggeredAt" TIMESTAMP(3),
    "lastSeenFullSyncRunId" TEXT,
    "attributeRequestGen" BIGINT,
    "attributeResponseGen" BIGINT,
    "attributeFreshnessState" "OrderAttributeFreshnessState" NOT NULL DEFAULT 'ORDERED',
    "existenceDiagnosticState" VARCHAR(128),
    "absenceNominationState" "OrderAbsenceNominationState" NOT NULL DEFAULT 'NONE',
    "ingestBatchId" TEXT,
    "moneyDiagnosticState" VARCHAR(128),
    "unitDiagnosticState" VARCHAR(128),
    "historyWindowState" VARCHAR(128),
    "sourceKind" "OrderSourceKind" NOT NULL,
    "lastSyncRunId" TEXT,
    "lastDurableJobId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletionSource" "OrderDeletionSource",
    "shopifyLegacyResourceId" VARCHAR(64),
    "accessScopeSnapshot" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyOrderLineFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyOrderRefundFact" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopifyGid" VARCHAR(256) NOT NULL,
    "shopifyOrderGid" VARCHAR(256) NOT NULL,
    "shopifyCreatedAt" TIMESTAMP(3),
    "shopifyUpdatedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMPTZ(3),
    "processedAtShopify" VARCHAR(64),
    "totalRefundedShopAmount" DECIMAL(20,6),
    "totalRefundedShopCurrencyCode" VARCHAR(8),
    "totalRefundedPresentmentAmount" DECIMAL(20,6),
    "totalRefundedPresentmentCurrencyCode" VARCHAR(8),
    "refundShippingLineCount" INTEGER NOT NULL DEFAULT 0,
    "refundShippingSubtotalShopAmount" DECIMAL(20,6),
    "refundShippingSubtotalShopCurrencyCode" VARCHAR(8),
    "refundShippingSubtotalPresentmentAmount" DECIMAL(20,6),
    "refundShippingSubtotalPresentmentCurrencyCode" VARCHAR(8),
    "refundShippingTaxShopAmount" DECIMAL(20,6),
    "refundShippingTaxShopCurrencyCode" VARCHAR(8),
    "refundShippingTaxPresentmentAmount" DECIMAL(20,6),
    "refundShippingTaxPresentmentCurrencyCode" VARCHAR(8),
    "existenceState" "OrderExistenceState" NOT NULL,
    "existenceKind" "OrderExistenceKind" NOT NULL,
    "existenceObservedAt" TIMESTAMP(3) NOT NULL,
    "existenceRequestGen" BIGINT,
    "existenceResponseGen" BIGINT,
    "signalReceivedAt" TIMESTAMP(3),
    "lastSignalTopic" VARCHAR(128),
    "lastSignalDeliveryId" VARCHAR(128),
    "lastSignalTriggeredAt" TIMESTAMP(3),
    "lastSeenFullSyncRunId" TEXT,
    "attributeRequestGen" BIGINT,
    "attributeResponseGen" BIGINT,
    "attributeFreshnessState" "OrderAttributeFreshnessState" NOT NULL DEFAULT 'ORDERED',
    "existenceDiagnosticState" VARCHAR(128),
    "absenceNominationState" "OrderAbsenceNominationState" NOT NULL DEFAULT 'NONE',
    "ingestBatchId" TEXT,
    "moneyDiagnosticState" VARCHAR(128),
    "unitDiagnosticState" VARCHAR(128),
    "historyWindowState" VARCHAR(128),
    "sourceKind" "OrderSourceKind" NOT NULL,
    "lastSyncRunId" TEXT,
    "lastDurableJobId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletionSource" "OrderDeletionSource",
    "shopifyLegacyResourceId" VARCHAR(64),
    "accessScopeSnapshot" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyOrderRefundFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyOrderRefundLineFact" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopifyRefundGid" VARCHAR(256) NOT NULL,
    "shopifyLineItemGid" VARCHAR(256) NOT NULL,
    "refundLineOrdinal" INTEGER NOT NULL,
    "shopifyGid" VARCHAR(256),
    "shopifyOrderGid" VARCHAR(256) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "restockType" VARCHAR(64),
    "restocked" BOOLEAN,
    "restockLocationGid" VARCHAR(256),
    "subtotalShopAmount" DECIMAL(20,6),
    "subtotalShopCurrencyCode" VARCHAR(8),
    "subtotalPresentmentAmount" DECIMAL(20,6),
    "subtotalPresentmentCurrencyCode" VARCHAR(8),
    "totalTaxShopAmount" DECIMAL(20,6),
    "totalTaxShopCurrencyCode" VARCHAR(8),
    "totalTaxPresentmentAmount" DECIMAL(20,6),
    "totalTaxPresentmentCurrencyCode" VARCHAR(8),
    "priceShopAmount" DECIMAL(20,6),
    "priceShopCurrencyCode" VARCHAR(8),
    "pricePresentmentAmount" DECIMAL(20,6),
    "pricePresentmentCurrencyCode" VARCHAR(8),
    "existenceState" "OrderExistenceState" NOT NULL,
    "existenceKind" "OrderExistenceKind" NOT NULL,
    "existenceObservedAt" TIMESTAMP(3) NOT NULL,
    "existenceRequestGen" BIGINT,
    "existenceResponseGen" BIGINT,
    "signalReceivedAt" TIMESTAMP(3),
    "lastSignalTopic" VARCHAR(128),
    "lastSignalDeliveryId" VARCHAR(128),
    "lastSignalTriggeredAt" TIMESTAMP(3),
    "lastSeenFullSyncRunId" TEXT,
    "attributeRequestGen" BIGINT,
    "attributeResponseGen" BIGINT,
    "attributeFreshnessState" "OrderAttributeFreshnessState" NOT NULL DEFAULT 'ORDERED',
    "existenceDiagnosticState" VARCHAR(128),
    "absenceNominationState" "OrderAbsenceNominationState" NOT NULL DEFAULT 'NONE',
    "ingestBatchId" TEXT,
    "moneyDiagnosticState" VARCHAR(128),
    "unitDiagnosticState" VARCHAR(128),
    "historyWindowState" VARCHAR(128),
    "sourceKind" "OrderSourceKind" NOT NULL,
    "lastSyncRunId" TEXT,
    "lastDurableJobId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletionSource" "OrderDeletionSource",
    "shopifyLegacyResourceId" VARCHAR(64),
    "accessScopeSnapshot" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyOrderRefundLineFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyOrderAdjustmentFact" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopifyGid" VARCHAR(256) NOT NULL,
    "shopifyRefundGid" VARCHAR(256) NOT NULL,
    "shopifyOrderGid" VARCHAR(256) NOT NULL,
    "reason" VARCHAR(128),
    "amountShopAmount" DECIMAL(20,6),
    "amountShopCurrencyCode" VARCHAR(8),
    "amountPresentmentAmount" DECIMAL(20,6),
    "amountPresentmentCurrencyCode" VARCHAR(8),
    "taxAmountShopAmount" DECIMAL(20,6),
    "taxAmountShopCurrencyCode" VARCHAR(8),
    "taxAmountPresentmentAmount" DECIMAL(20,6),
    "taxAmountPresentmentCurrencyCode" VARCHAR(8),
    "existenceState" "OrderExistenceState" NOT NULL,
    "existenceKind" "OrderExistenceKind" NOT NULL,
    "existenceObservedAt" TIMESTAMP(3) NOT NULL,
    "existenceRequestGen" BIGINT,
    "existenceResponseGen" BIGINT,
    "signalReceivedAt" TIMESTAMP(3),
    "lastSignalTopic" VARCHAR(128),
    "lastSignalDeliveryId" VARCHAR(128),
    "lastSignalTriggeredAt" TIMESTAMP(3),
    "lastSeenFullSyncRunId" TEXT,
    "attributeRequestGen" BIGINT,
    "attributeResponseGen" BIGINT,
    "attributeFreshnessState" "OrderAttributeFreshnessState" NOT NULL DEFAULT 'ORDERED',
    "existenceDiagnosticState" VARCHAR(128),
    "absenceNominationState" "OrderAbsenceNominationState" NOT NULL DEFAULT 'NONE',
    "ingestBatchId" TEXT,
    "moneyDiagnosticState" VARCHAR(128),
    "unitDiagnosticState" VARCHAR(128),
    "historyWindowState" VARCHAR(128),
    "sourceKind" "OrderSourceKind" NOT NULL,
    "lastSyncRunId" TEXT,
    "lastDurableJobId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletionSource" "OrderDeletionSource",
    "shopifyLegacyResourceId" VARCHAR(64),
    "accessScopeSnapshot" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyOrderAdjustmentFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyOrderAgreementFact" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopifyGid" VARCHAR(256) NOT NULL,
    "shopifyOrderGid" VARCHAR(256) NOT NULL,
    "happenedAt" TIMESTAMP(3) NOT NULL,
    "agreementTypename" VARCHAR(64) NOT NULL,
    "reason" VARCHAR(64),
    "refundGid" VARCHAR(256),
    "existenceState" "OrderExistenceState" NOT NULL,
    "existenceKind" "OrderExistenceKind" NOT NULL,
    "existenceObservedAt" TIMESTAMP(3) NOT NULL,
    "existenceRequestGen" BIGINT,
    "existenceResponseGen" BIGINT,
    "signalReceivedAt" TIMESTAMP(3),
    "lastSignalTopic" VARCHAR(128),
    "lastSignalDeliveryId" VARCHAR(128),
    "lastSignalTriggeredAt" TIMESTAMP(3),
    "lastSeenFullSyncRunId" TEXT,
    "attributeRequestGen" BIGINT,
    "attributeResponseGen" BIGINT,
    "attributeFreshnessState" "OrderAttributeFreshnessState" NOT NULL DEFAULT 'ORDERED',
    "existenceDiagnosticState" VARCHAR(128),
    "absenceNominationState" "OrderAbsenceNominationState" NOT NULL DEFAULT 'NONE',
    "ingestBatchId" TEXT,
    "moneyDiagnosticState" VARCHAR(128),
    "unitDiagnosticState" VARCHAR(128),
    "historyWindowState" VARCHAR(128),
    "sourceKind" "OrderSourceKind" NOT NULL,
    "lastSyncRunId" TEXT,
    "lastDurableJobId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletionSource" "OrderDeletionSource",
    "shopifyLegacyResourceId" VARCHAR(64),
    "accessScopeSnapshot" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyOrderAgreementFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyOrderAgreementSaleFact" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopifyGid" VARCHAR(256) NOT NULL,
    "shopifyAgreementGid" VARCHAR(256) NOT NULL,
    "shopifyOrderGid" VARCHAR(256) NOT NULL,
    "quantity" INTEGER,
    "lineType" VARCHAR(64),
    "actionType" VARCHAR(64),
    "saleTypename" VARCHAR(64) NOT NULL,
    "shopifyLineItemGid" VARCHAR(256),
    "happenedAt" TIMESTAMP(3) NOT NULL,
    "totalAmountShopAmount" DECIMAL(20,6),
    "totalAmountShopCurrencyCode" VARCHAR(8),
    "totalAmountPresentmentAmount" DECIMAL(20,6),
    "totalAmountPresentmentCurrencyCode" VARCHAR(8),
    "existenceState" "OrderExistenceState" NOT NULL,
    "existenceKind" "OrderExistenceKind" NOT NULL,
    "existenceObservedAt" TIMESTAMP(3) NOT NULL,
    "existenceRequestGen" BIGINT,
    "existenceResponseGen" BIGINT,
    "signalReceivedAt" TIMESTAMP(3),
    "lastSignalTopic" VARCHAR(128),
    "lastSignalDeliveryId" VARCHAR(128),
    "lastSignalTriggeredAt" TIMESTAMP(3),
    "lastSeenFullSyncRunId" TEXT,
    "attributeRequestGen" BIGINT,
    "attributeResponseGen" BIGINT,
    "attributeFreshnessState" "OrderAttributeFreshnessState" NOT NULL DEFAULT 'ORDERED',
    "existenceDiagnosticState" VARCHAR(128),
    "absenceNominationState" "OrderAbsenceNominationState" NOT NULL DEFAULT 'NONE',
    "ingestBatchId" TEXT,
    "moneyDiagnosticState" VARCHAR(128),
    "unitDiagnosticState" VARCHAR(128),
    "historyWindowState" VARCHAR(128),
    "sourceKind" "OrderSourceKind" NOT NULL,
    "lastSyncRunId" TEXT,
    "lastDurableJobId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletionSource" "OrderDeletionSource",
    "shopifyLegacyResourceId" VARCHAR(64),
    "accessScopeSnapshot" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyOrderAgreementSaleFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyOrderRefundTransactionFact" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopifyGid" VARCHAR(256) NOT NULL,
    "shopifyRefundGid" VARCHAR(256) NOT NULL,
    "shopifyOrderGid" VARCHAR(256) NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "kind" VARCHAR(64),
    "shopifyCreatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "amountShopAmount" DECIMAL(20,6),
    "amountShopCurrencyCode" VARCHAR(8),
    "amountPresentmentAmount" DECIMAL(20,6),
    "amountPresentmentCurrencyCode" VARCHAR(8),
    "existenceState" "OrderExistenceState" NOT NULL,
    "existenceKind" "OrderExistenceKind" NOT NULL,
    "existenceObservedAt" TIMESTAMP(3) NOT NULL,
    "existenceRequestGen" BIGINT,
    "existenceResponseGen" BIGINT,
    "signalReceivedAt" TIMESTAMP(3),
    "lastSignalTopic" VARCHAR(128),
    "lastSignalDeliveryId" VARCHAR(128),
    "lastSignalTriggeredAt" TIMESTAMP(3),
    "lastSeenFullSyncRunId" TEXT,
    "attributeRequestGen" BIGINT,
    "attributeResponseGen" BIGINT,
    "attributeFreshnessState" "OrderAttributeFreshnessState" NOT NULL DEFAULT 'ORDERED',
    "existenceDiagnosticState" VARCHAR(128),
    "absenceNominationState" "OrderAbsenceNominationState" NOT NULL DEFAULT 'NONE',
    "ingestBatchId" TEXT,
    "moneyDiagnosticState" VARCHAR(128),
    "unitDiagnosticState" VARCHAR(128),
    "historyWindowState" VARCHAR(128),
    "sourceKind" "OrderSourceKind" NOT NULL,
    "lastSyncRunId" TEXT,
    "lastDurableJobId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletionSource" "OrderDeletionSource",
    "shopifyLegacyResourceId" VARCHAR(64),
    "accessScopeSnapshot" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyOrderRefundTransactionFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderFactObservationInFlight" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "resourceKind" "OrderResourceKind" NOT NULL,
    "shopifyGid" VARCHAR(256),
    "shopifyRefundGid" VARCHAR(256),
    "shopifyLineItemGid" VARCHAR(256),
    "refundLineOrdinal" INTEGER,
    "observationRequestGen" BIGINT NOT NULL,
    "observationResponseGen" BIGINT,
    "leaseDurationMs" INTEGER NOT NULL,
    "leaseExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lifecycleState" "OrderObservationLifecycleState" NOT NULL,
    "terminalOutcome" VARCHAR(128),
    "failureCode" VARCHAR(128),
    "failureDetail" VARCHAR(512),
    "accessScopeSnapshot" TEXT[],
    "durableJobId" TEXT,
    "jobAttemptId" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderFactObservationInFlight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopifyOrderFact_shopId_processedAt_idx" ON "ShopifyOrderFact"("shopId", "processedAt");

-- CreateIndex
CREATE INDEX "ShopifyOrderFact_shopId_shopifyUpdatedAt_idx" ON "ShopifyOrderFact"("shopId", "shopifyUpdatedAt");

-- CreateIndex
CREATE INDEX "ShopifyOrderFact_shopId_existenceState_idx" ON "ShopifyOrderFact"("shopId", "existenceState");

-- CreateIndex
CREATE INDEX "ShopifyOrderFact_shopId_lastSeenFullSyncRunId_idx" ON "ShopifyOrderFact"("shopId", "lastSeenFullSyncRunId");

-- CreateIndex
CREATE INDEX "ShopifyOrderFact_shopId_ingestBatchId_idx" ON "ShopifyOrderFact"("shopId", "ingestBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOrderFact_shopId_id_key" ON "ShopifyOrderFact"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOrderFact_shopId_shopifyGid_key" ON "ShopifyOrderFact"("shopId", "shopifyGid");

-- CreateIndex
CREATE INDEX "ShopifyOrderLineFact_shopId_shopifyOrderGid_idx" ON "ShopifyOrderLineFact"("shopId", "shopifyOrderGid");

-- CreateIndex
CREATE INDEX "ShopifyOrderLineFact_shopId_variantGidAtSale_orderProcessed_idx" ON "ShopifyOrderLineFact"("shopId", "variantGidAtSale", "orderProcessedAt");

-- CreateIndex
CREATE INDEX "ShopifyOrderLineFact_shopId_existenceState_idx" ON "ShopifyOrderLineFact"("shopId", "existenceState");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOrderLineFact_shopId_id_key" ON "ShopifyOrderLineFact"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOrderLineFact_shopId_shopifyGid_key" ON "ShopifyOrderLineFact"("shopId", "shopifyGid");

-- CreateIndex
CREATE INDEX "ShopifyOrderRefundFact_shopId_shopifyOrderGid_idx" ON "ShopifyOrderRefundFact"("shopId", "shopifyOrderGid");

-- CreateIndex
CREATE INDEX "ShopifyOrderRefundFact_shopId_shopifyUpdatedAt_idx" ON "ShopifyOrderRefundFact"("shopId", "shopifyUpdatedAt");

-- CreateIndex
CREATE INDEX "ShopifyOrderRefundFact_shopId_existenceState_idx" ON "ShopifyOrderRefundFact"("shopId", "existenceState");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOrderRefundFact_shopId_id_key" ON "ShopifyOrderRefundFact"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOrderRefundFact_shopId_shopifyGid_key" ON "ShopifyOrderRefundFact"("shopId", "shopifyGid");

-- CreateIndex
CREATE INDEX "ShopifyOrderRefundLineFact_shopId_shopifyOrderGid_idx" ON "ShopifyOrderRefundLineFact"("shopId", "shopifyOrderGid");

-- CreateIndex
CREATE INDEX "ShopifyOrderRefundLineFact_shopId_shopifyLineItemGid_idx" ON "ShopifyOrderRefundLineFact"("shopId", "shopifyLineItemGid");

-- CreateIndex
CREATE INDEX "ShopifyOrderRefundLineFact_shopId_shopifyRefundGid_idx" ON "ShopifyOrderRefundLineFact"("shopId", "shopifyRefundGid");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOrderRefundLineFact_shopId_id_key" ON "ShopifyOrderRefundLineFact"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOrderRefundLineFact_refund_line_identity_key" ON "ShopifyOrderRefundLineFact"("shopId", "shopifyRefundGid", "shopifyLineItemGid", "refundLineOrdinal");

-- CreateIndex
CREATE INDEX "ShopifyOrderAdjustmentFact_shopId_shopifyOrderGid_idx" ON "ShopifyOrderAdjustmentFact"("shopId", "shopifyOrderGid");

-- CreateIndex
CREATE INDEX "ShopifyOrderAdjustmentFact_shopId_shopifyRefundGid_idx" ON "ShopifyOrderAdjustmentFact"("shopId", "shopifyRefundGid");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOrderAdjustmentFact_shopId_id_key" ON "ShopifyOrderAdjustmentFact"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOrderAdjustmentFact_shopId_shopifyGid_key" ON "ShopifyOrderAdjustmentFact"("shopId", "shopifyGid");

-- CreateIndex
CREATE INDEX "ShopifyOrderAgreementFact_shopId_shopifyOrderGid_idx" ON "ShopifyOrderAgreementFact"("shopId", "shopifyOrderGid");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOrderAgreementFact_shopId_id_key" ON "ShopifyOrderAgreementFact"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOrderAgreementFact_shopId_shopifyGid_key" ON "ShopifyOrderAgreementFact"("shopId", "shopifyGid");

-- CreateIndex
CREATE INDEX "ShopifyOrderAgreementSaleFact_shopId_shopifyOrderGid_idx" ON "ShopifyOrderAgreementSaleFact"("shopId", "shopifyOrderGid");

-- CreateIndex
CREATE INDEX "ShopifyOrderAgreementSaleFact_shopId_shopifyLineItemGid_idx" ON "ShopifyOrderAgreementSaleFact"("shopId", "shopifyLineItemGid");

-- CreateIndex
CREATE INDEX "ShopifyOrderAgreementSaleFact_shopId_happenedAt_idx" ON "ShopifyOrderAgreementSaleFact"("shopId", "happenedAt");

-- CreateIndex
CREATE INDEX "ShopifyOrderAgreementSaleFact_shopId_shopifyAgreementGid_idx" ON "ShopifyOrderAgreementSaleFact"("shopId", "shopifyAgreementGid");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOrderAgreementSaleFact_shopId_id_key" ON "ShopifyOrderAgreementSaleFact"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOrderAgreementSaleFact_shopId_shopifyGid_key" ON "ShopifyOrderAgreementSaleFact"("shopId", "shopifyGid");

-- CreateIndex
CREATE INDEX "ShopifyOrderRefundTransactionFact_shopId_shopifyRefundGid_idx" ON "ShopifyOrderRefundTransactionFact"("shopId", "shopifyRefundGid");

-- CreateIndex
CREATE INDEX "ShopifyOrderRefundTransactionFact_shopId_shopifyOrderGid_idx" ON "ShopifyOrderRefundTransactionFact"("shopId", "shopifyOrderGid");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOrderRefundTransactionFact_shopId_id_key" ON "ShopifyOrderRefundTransactionFact"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOrderRefundTransactionFact_shopId_shopifyGid_key" ON "ShopifyOrderRefundTransactionFact"("shopId", "shopifyGid");

-- CreateIndex
CREATE INDEX "OrderFactObservationInFlight_shopId_resourceKind_shopifyGid_idx" ON "OrderFactObservationInFlight"("shopId", "resourceKind", "shopifyGid", "lifecycleState");

-- CreateIndex
CREATE INDEX "OrderFactObservationInFlight_shopId_leaseExpiresAt_lifecycl_idx" ON "OrderFactObservationInFlight"("shopId", "leaseExpiresAt", "lifecycleState");

-- CreateIndex
CREATE INDEX "OrderFactObservationInFlight_shopId_observationRequestGen_idx" ON "OrderFactObservationInFlight"("shopId", "observationRequestGen");

-- CreateIndex
CREATE INDEX "OrderFactObservationInFlight_shopId_resourceKind_shopifyRef_idx" ON "OrderFactObservationInFlight"("shopId", "resourceKind", "shopifyRefundGid", "shopifyLineItemGid", "refundLineOrdinal");

-- CreateIndex
CREATE UNIQUE INDEX "OrderFactObservationInFlight_shopId_id_key" ON "OrderFactObservationInFlight"("shopId", "id");

-- AddForeignKey
ALTER TABLE "ShopifyOrderFact" ADD CONSTRAINT "ShopifyOrderFact_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShopifyOrderLineFact" ADD CONSTRAINT "ShopifyOrderLineFact_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShopifyOrderLineFact" ADD CONSTRAINT "ShopifyOrderLineFact_shopId_shopifyOrderGid_fkey" FOREIGN KEY ("shopId", "shopifyOrderGid") REFERENCES "ShopifyOrderFact"("shopId", "shopifyGid") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShopifyOrderRefundFact" ADD CONSTRAINT "ShopifyOrderRefundFact_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShopifyOrderRefundLineFact" ADD CONSTRAINT "ShopifyOrderRefundLineFact_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShopifyOrderRefundLineFact" ADD CONSTRAINT "ShopifyOrderRefundLineFact_shopId_shopifyRefundGid_fkey" FOREIGN KEY ("shopId", "shopifyRefundGid") REFERENCES "ShopifyOrderRefundFact"("shopId", "shopifyGid") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShopifyOrderAdjustmentFact" ADD CONSTRAINT "ShopifyOrderAdjustmentFact_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShopifyOrderAdjustmentFact" ADD CONSTRAINT "ShopifyOrderAdjustmentFact_shopId_shopifyRefundGid_fkey" FOREIGN KEY ("shopId", "shopifyRefundGid") REFERENCES "ShopifyOrderRefundFact"("shopId", "shopifyGid") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShopifyOrderAgreementFact" ADD CONSTRAINT "ShopifyOrderAgreementFact_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShopifyOrderAgreementFact" ADD CONSTRAINT "ShopifyOrderAgreementFact_shopId_shopifyOrderGid_fkey" FOREIGN KEY ("shopId", "shopifyOrderGid") REFERENCES "ShopifyOrderFact"("shopId", "shopifyGid") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShopifyOrderAgreementSaleFact" ADD CONSTRAINT "ShopifyOrderAgreementSaleFact_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShopifyOrderAgreementSaleFact" ADD CONSTRAINT "ShopifyOrderAgreementSaleFact_shopId_shopifyAgreementGid_fkey" FOREIGN KEY ("shopId", "shopifyAgreementGid") REFERENCES "ShopifyOrderAgreementFact"("shopId", "shopifyGid") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShopifyOrderRefundTransactionFact" ADD CONSTRAINT "ShopifyOrderRefundTransactionFact_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShopifyOrderRefundTransactionFact" ADD CONSTRAINT "ShopifyOrderRefundTransactionFact_shopId_shopifyRefundGid_fkey" FOREIGN KEY ("shopId", "shopifyRefundGid") REFERENCES "ShopifyOrderRefundFact"("shopId", "shopifyGid") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrderFactObservationInFlight" ADD CONSTRAINT "OrderFactObservationInFlight_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Observation lifecycle / lease / identity (catalog sibling; new SQL names).
ALTER TABLE "OrderFactObservationInFlight"
  ADD CONSTRAINT "OrderFactObservationInFlight_lifecycle_response_gen_check"
  CHECK (
    ("lifecycleState" = 'ACTIVE' AND "observationResponseGen" IS NULL)
    OR ("lifecycleState" = 'COMPLETED' AND "observationResponseGen" IS NOT NULL)
    OR ("lifecycleState" = 'ABANDONED')
  );

ALTER TABLE "OrderFactObservationInFlight"
  ADD CONSTRAINT "OrderFactObservationInFlight_lease_duration_ms_check"
  CHECK (
    "leaseDurationMs" >= 1
    AND "leaseDurationMs" <= 3600000
  );

ALTER TABLE "OrderFactObservationInFlight"
  ADD CONSTRAINT "OrderFactObservationInFlight_identity_shape_check"
  CHECK (
    (
      "resourceKind" IN ('Order', 'OrderLine', 'Refund')
      AND "shopifyGid" IS NOT NULL
      AND "shopifyRefundGid" IS NULL
      AND "shopifyLineItemGid" IS NULL
      AND "refundLineOrdinal" IS NULL
    )
    OR (
      "resourceKind" = 'RefundLine'
      AND "shopifyRefundGid" IS NOT NULL
      AND "shopifyLineItemGid" IS NOT NULL
      AND "refundLineOrdinal" IS NOT NULL
      AND "refundLineOrdinal" >= 0
    )
  );

ALTER TABLE "ShopifyOrderFact"
  ADD CONSTRAINT "ShopifyOrderFact_processed_at_pair_check"
  CHECK (
    ("processedAtShopify" IS NULL) = ("processedAt" IS NULL)
  );

ALTER TABLE "ShopifyOrderRefundFact"
  ADD CONSTRAINT "ShopifyOrderRefundFact_processed_at_pair_check"
  CHECK (
    ("processedAtShopify" IS NULL) = ("processedAt" IS NULL)
  );

ALTER TABLE "ShopifyOrderRefundLineFact"
  ADD CONSTRAINT "ShopifyOrderRefundLineFact_ordinal_nonnegative_check"
  CHECK ("refundLineOrdinal" >= 0);

CREATE OR REPLACE FUNCTION stocky_order_observation_lifecycle_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF OLD."lifecycleState" IN ('COMPLETED', 'ABANDONED')
     AND NEW."lifecycleState" IS DISTINCT FROM OLD."lifecycleState" THEN
    RAISE EXCEPTION 'order_observation_terminal_transition_forbidden'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION stocky_order_observation_lifecycle_guard() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_OrderFactObservationInFlight_lifecycle_guard
  ON "OrderFactObservationInFlight";
CREATE TRIGGER trg_OrderFactObservationInFlight_lifecycle_guard
  BEFORE UPDATE OF "lifecycleState" ON "OrderFactObservationInFlight"
  FOR EACH ROW
  EXECUTE FUNCTION stocky_order_observation_lifecycle_guard();

CREATE OR REPLACE FUNCTION stocky_order_observation_set_lease()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW."leaseDurationMs" IS NULL
     OR NEW."leaseDurationMs" < 1
     OR NEW."leaseDurationMs" > 3600000 THEN
    RAISE EXCEPTION 'order_observation_lease_duration_invalid'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW."leaseExpiresAt" := clock_timestamp()
      + make_interval(secs => NEW."leaseDurationMs"::double precision / 1000.0);
  ELSIF TG_OP = 'UPDATE' THEN
    NEW."leaseDurationMs" := OLD."leaseDurationMs";
    NEW."leaseExpiresAt" := OLD."leaseExpiresAt";
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION stocky_order_observation_set_lease() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_OrderFactObservationInFlight_set_lease
  ON "OrderFactObservationInFlight";
CREATE TRIGGER trg_OrderFactObservationInFlight_set_lease
  BEFORE INSERT OR UPDATE ON "OrderFactObservationInFlight"
  FOR EACH ROW
  EXECUTE FUNCTION stocky_order_observation_set_lease();
