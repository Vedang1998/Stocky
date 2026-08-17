-- PR5-F1 canonical fact foundation.
-- Additive only. Does not drop legacy ShopifyVariantCache / InventorySnapshot.
-- Does not transform merchant data. Does not rewrite existing tables except
-- adding nullable SyncRun fence columns.
--
-- Recovery: leave new objects unused; later apply/ingest lanes are not yet
-- wired. Forward recovery is preferred. Emergency rollback may DROP the new
-- tables/enums/sequence/columns after confirming no production writer exists
-- (production is not authorized in this slice).
--
-- Sequence privileges: REVOKE PUBLIC here. Named USAGE-only grants are applied
-- by tenant role provisioning (stocky_runtime + stocky_control_plane).
-- UPDATE is never granted (setval/reset/reuse forbidden).

-- CreateEnum
CREATE TYPE "CatalogExistenceState" AS ENUM ('LIVE', 'ABSENT');

-- CreateEnum
CREATE TYPE "CatalogExistenceKind" AS ENUM ('LIVE_REFETCH', 'LIVE_FULL_SYNC_PRESENT', 'ABSENT_CONFIRMED_QUERY');

-- CreateEnum
CREATE TYPE "CatalogAttributeFreshnessState" AS ENUM ('ORDERED', 'DEGRADED');

-- CreateEnum
CREATE TYPE "CatalogCompatibilityProjectionState" AS ENUM ('HEALTHY', 'DEGRADED');

-- CreateEnum
CREATE TYPE "CatalogAbsenceNominationState" AS ENUM ('NONE', 'CANDIDATE', 'CIRCUIT_BREAKER_HELD');

-- CreateEnum
CREATE TYPE "CatalogObservationLifecycleState" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "CatalogResourceKind" AS ENUM ('Product', 'ProductVariant', 'InventoryItem', 'Location', 'InventoryLevel');

-- CreateEnum
CREATE TYPE "CatalogSourceKind" AS ENUM ('FULL_SYNC', 'INCREMENTAL_REFETCH', 'DELETE_WEBHOOK', 'DISCONNECT_WEBHOOK', 'RECONCILE');

-- CreateEnum
CREATE TYPE "CatalogDeletionSource" AS ENUM ('WEBHOOK', 'CONFIRMED_QUERY', 'DISCONNECT');

-- CreateEnum
CREATE TYPE "CatalogUnitCostAccess" AS ENUM ('PRESENT', 'NULL', 'OMITTED_NO_PERMISSION', 'QUERY_ERROR_ISOLATED');

-- CreateEnum
CREATE TYPE "ShopifyProductStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DRAFT', 'UNLISTED');


-- AlterTable
ALTER TABLE "SyncRun" ADD COLUMN     "fenceAt" TIMESTAMP(3),
ADD COLUMN     "fenceGeneration" BIGINT;

-- CreateTable
CREATE TABLE "ShopifyProductFact" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopifyGid" VARCHAR(256) NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "vendor" TEXT,
    "productType" TEXT,
    "tags" TEXT[],
    "status" "ShopifyProductStatus" NOT NULL,
    "featuredMediaUrl" TEXT,
    "shopifyCreatedAt" TIMESTAMP(3),
    "shopifyUpdatedAt" TIMESTAMP(3),
    "existenceState" "CatalogExistenceState" NOT NULL,
    "existenceKind" "CatalogExistenceKind" NOT NULL,
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
    "attributeFreshnessState" "CatalogAttributeFreshnessState" NOT NULL DEFAULT 'ORDERED',
    "compatibilityProjectionState" "CatalogCompatibilityProjectionState" NOT NULL DEFAULT 'HEALTHY',
    "existenceDiagnosticState" VARCHAR(128),
    "absenceNominationState" "CatalogAbsenceNominationState" NOT NULL DEFAULT 'NONE',
    "absenceCandidateEpochId" TEXT,
    "absenceCandidateGeneration" BIGINT,
    "ingestBatchId" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "lastRefreshedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "lastSyncRunId" TEXT,
    "lastDurableJobId" TEXT,
    "sourceKind" "CatalogSourceKind" NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletionSource" "CatalogDeletionSource",
    "shopifyLegacyResourceId" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyProductFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyProductCollectionMembership" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopifyProductGid" VARCHAR(256) NOT NULL,
    "shopifyCollectionGid" VARCHAR(256) NOT NULL,
    "collectionTitleSnapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyProductCollectionMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyVariantFact" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopifyGid" VARCHAR(256) NOT NULL,
    "shopifyProductGid" VARCHAR(256) NOT NULL,
    "title" TEXT NOT NULL,
    "displayName" TEXT,
    "selectedOptions" JSONB NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "priceAmount" DECIMAL(20,6) NOT NULL,
    "compareAtPriceAmount" DECIMAL(20,6),
    "currencyCode" VARCHAR(8) NOT NULL,
    "position" INTEGER,
    "shopifyCreatedAt" TIMESTAMP(3),
    "shopifyUpdatedAt" TIMESTAMP(3),
    "existenceState" "CatalogExistenceState" NOT NULL,
    "existenceKind" "CatalogExistenceKind" NOT NULL,
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
    "attributeFreshnessState" "CatalogAttributeFreshnessState" NOT NULL DEFAULT 'ORDERED',
    "compatibilityProjectionState" "CatalogCompatibilityProjectionState" NOT NULL DEFAULT 'HEALTHY',
    "existenceDiagnosticState" VARCHAR(128),
    "absenceNominationState" "CatalogAbsenceNominationState" NOT NULL DEFAULT 'NONE',
    "absenceCandidateEpochId" TEXT,
    "absenceCandidateGeneration" BIGINT,
    "ingestBatchId" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "lastRefreshedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "lastSyncRunId" TEXT,
    "lastDurableJobId" TEXT,
    "sourceKind" "CatalogSourceKind" NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletionSource" "CatalogDeletionSource",
    "shopifyLegacyResourceId" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyVariantFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyInventoryItemFact" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopifyGid" VARCHAR(256) NOT NULL,
    "shopifyVariantGid" VARCHAR(256),
    "sku" TEXT,
    "tracked" BOOLEAN NOT NULL,
    "requiresShipping" BOOLEAN NOT NULL,
    "weightValue" DECIMAL(20,6),
    "weightUnit" VARCHAR(32),
    "unitCostAmount" DECIMAL(20,6),
    "unitCostCurrencyCode" VARCHAR(8),
    "unitCostAccess" "CatalogUnitCostAccess" NOT NULL,
    "shopifyCreatedAt" TIMESTAMP(3),
    "shopifyUpdatedAt" TIMESTAMP(3),
    "existenceState" "CatalogExistenceState" NOT NULL,
    "existenceKind" "CatalogExistenceKind" NOT NULL,
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
    "attributeFreshnessState" "CatalogAttributeFreshnessState" NOT NULL DEFAULT 'ORDERED',
    "compatibilityProjectionState" "CatalogCompatibilityProjectionState" NOT NULL DEFAULT 'HEALTHY',
    "existenceDiagnosticState" VARCHAR(128),
    "absenceNominationState" "CatalogAbsenceNominationState" NOT NULL DEFAULT 'NONE',
    "absenceCandidateEpochId" TEXT,
    "absenceCandidateGeneration" BIGINT,
    "ingestBatchId" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "lastRefreshedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "lastSyncRunId" TEXT,
    "lastDurableJobId" TEXT,
    "sourceKind" "CatalogSourceKind" NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletionSource" "CatalogDeletionSource",
    "shopifyLegacyResourceId" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyInventoryItemFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyLocationFact" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopifyGid" VARCHAR(256) NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "deactivatedAt" TIMESTAMP(3),
    "fulfillsOnlineOrders" BOOLEAN NOT NULL,
    "shipsInventory" BOOLEAN NOT NULL,
    "isFulfillmentService" BOOLEAN NOT NULL,
    "hasActiveInventory" BOOLEAN NOT NULL,
    "address1" TEXT,
    "city" TEXT,
    "provinceCode" VARCHAR(16),
    "countryCode" VARCHAR(8),
    "zip" TEXT,
    "shopifyCreatedAt" TIMESTAMP(3),
    "shopifyUpdatedAt" TIMESTAMP(3),
    "existenceState" "CatalogExistenceState" NOT NULL,
    "existenceKind" "CatalogExistenceKind" NOT NULL,
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
    "attributeFreshnessState" "CatalogAttributeFreshnessState" NOT NULL DEFAULT 'ORDERED',
    "compatibilityProjectionState" "CatalogCompatibilityProjectionState" NOT NULL DEFAULT 'HEALTHY',
    "existenceDiagnosticState" VARCHAR(128),
    "absenceNominationState" "CatalogAbsenceNominationState" NOT NULL DEFAULT 'NONE',
    "absenceCandidateEpochId" TEXT,
    "absenceCandidateGeneration" BIGINT,
    "ingestBatchId" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "lastRefreshedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "lastSyncRunId" TEXT,
    "lastDurableJobId" TEXT,
    "sourceKind" "CatalogSourceKind" NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletionSource" "CatalogDeletionSource",
    "shopifyLegacyResourceId" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyLocationFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyInventoryLevelFact" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "inventoryItemGid" VARCHAR(256) NOT NULL,
    "locationGid" VARCHAR(256) NOT NULL,
    "shopifyInventoryLevelGid" VARCHAR(256),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "availableQuantity" INTEGER,
    "availableQuantityUpdatedAt" TIMESTAMP(3),
    "availableQuantityRequestGen" BIGINT,
    "availableQuantityResponseGen" BIGINT,
    "onHandQuantity" INTEGER,
    "onHandQuantityUpdatedAt" TIMESTAMP(3),
    "onHandQuantityRequestGen" BIGINT,
    "onHandQuantityResponseGen" BIGINT,
    "incomingQuantity" INTEGER,
    "incomingQuantityUpdatedAt" TIMESTAMP(3),
    "incomingQuantityRequestGen" BIGINT,
    "incomingQuantityResponseGen" BIGINT,
    "committedQuantity" INTEGER,
    "committedQuantityUpdatedAt" TIMESTAMP(3),
    "committedQuantityRequestGen" BIGINT,
    "committedQuantityResponseGen" BIGINT,
    "reservedQuantity" INTEGER,
    "reservedQuantityUpdatedAt" TIMESTAMP(3),
    "reservedQuantityRequestGen" BIGINT,
    "reservedQuantityResponseGen" BIGINT,
    "damagedQuantity" INTEGER,
    "damagedQuantityUpdatedAt" TIMESTAMP(3),
    "damagedQuantityRequestGen" BIGINT,
    "damagedQuantityResponseGen" BIGINT,
    "safetyStockQuantity" INTEGER,
    "safetyStockQuantityUpdatedAt" TIMESTAMP(3),
    "safetyStockQuantityRequestGen" BIGINT,
    "safetyStockQuantityResponseGen" BIGINT,
    "qualityControlQuantity" INTEGER,
    "qualityControlQuantityUpdatedAt" TIMESTAMP(3),
    "qualityControlQuantityRequestGen" BIGINT,
    "qualityControlQuantityResponseGen" BIGINT,
    "shopifyCreatedAt" TIMESTAMP(3),
    "shopifyUpdatedAt" TIMESTAMP(3),
    "existenceState" "CatalogExistenceState" NOT NULL,
    "existenceKind" "CatalogExistenceKind" NOT NULL,
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
    "attributeFreshnessState" "CatalogAttributeFreshnessState" NOT NULL DEFAULT 'ORDERED',
    "compatibilityProjectionState" "CatalogCompatibilityProjectionState" NOT NULL DEFAULT 'HEALTHY',
    "existenceDiagnosticState" VARCHAR(128),
    "absenceNominationState" "CatalogAbsenceNominationState" NOT NULL DEFAULT 'NONE',
    "absenceCandidateEpochId" TEXT,
    "absenceCandidateGeneration" BIGINT,
    "ingestBatchId" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "lastRefreshedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "lastSyncRunId" TEXT,
    "lastDurableJobId" TEXT,
    "sourceKind" "CatalogSourceKind" NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletionSource" "CatalogDeletionSource",
    "shopifyLegacyResourceId" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyInventoryLevelFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogObservationInFlight" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "resourceKind" "CatalogResourceKind" NOT NULL,
    "shopifyGid" VARCHAR(256),
    "inventoryItemGid" VARCHAR(256),
    "locationGid" VARCHAR(256),
    "observationRequestGen" BIGINT NOT NULL,
    "observationResponseGen" BIGINT,
    "leaseDurationMs" INTEGER NOT NULL,
    "leaseExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lifecycleState" "CatalogObservationLifecycleState" NOT NULL,
    "durableJobId" TEXT,
    "jobAttemptId" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogObservationInFlight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopifyProductFact_shopId_existenceState_idx" ON "ShopifyProductFact"("shopId", "existenceState");

-- CreateIndex
CREATE INDEX "ShopifyProductFact_shopId_lastSeenFullSyncRunId_idx" ON "ShopifyProductFact"("shopId", "lastSeenFullSyncRunId");

-- CreateIndex
CREATE INDEX "ShopifyProductFact_shopId_handle_idx" ON "ShopifyProductFact"("shopId", "handle");

-- CreateIndex
CREATE INDEX "ShopifyProductFact_shopId_vendor_idx" ON "ShopifyProductFact"("shopId", "vendor");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyProductFact_shopId_id_key" ON "ShopifyProductFact"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyProductFact_shopId_shopifyGid_key" ON "ShopifyProductFact"("shopId", "shopifyGid");

-- CreateIndex
CREATE INDEX "ShopifyProductCollectionMembership_shopId_shopifyCollection_idx" ON "ShopifyProductCollectionMembership"("shopId", "shopifyCollectionGid");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyProductCollectionMembership_shopId_id_key" ON "ShopifyProductCollectionMembership"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyProductCollectionMembership_shopId_shopifyProductGid_key" ON "ShopifyProductCollectionMembership"("shopId", "shopifyProductGid", "shopifyCollectionGid");

-- CreateIndex
CREATE INDEX "ShopifyVariantFact_shopId_shopifyProductGid_idx" ON "ShopifyVariantFact"("shopId", "shopifyProductGid");

-- CreateIndex
CREATE INDEX "ShopifyVariantFact_shopId_existenceState_idx" ON "ShopifyVariantFact"("shopId", "existenceState");

-- CreateIndex
CREATE INDEX "ShopifyVariantFact_shopId_lastSeenFullSyncRunId_idx" ON "ShopifyVariantFact"("shopId", "lastSeenFullSyncRunId");

-- CreateIndex
CREATE INDEX "ShopifyVariantFact_shopId_sku_idx" ON "ShopifyVariantFact"("shopId", "sku");

-- CreateIndex
CREATE INDEX "ShopifyVariantFact_shopId_barcode_idx" ON "ShopifyVariantFact"("shopId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyVariantFact_shopId_id_key" ON "ShopifyVariantFact"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyVariantFact_shopId_shopifyGid_key" ON "ShopifyVariantFact"("shopId", "shopifyGid");

-- CreateIndex
CREATE INDEX "ShopifyInventoryItemFact_shopId_shopifyVariantGid_idx" ON "ShopifyInventoryItemFact"("shopId", "shopifyVariantGid");

-- CreateIndex
CREATE INDEX "ShopifyInventoryItemFact_shopId_existenceState_idx" ON "ShopifyInventoryItemFact"("shopId", "existenceState");

-- CreateIndex
CREATE INDEX "ShopifyInventoryItemFact_shopId_lastSeenFullSyncRunId_idx" ON "ShopifyInventoryItemFact"("shopId", "lastSeenFullSyncRunId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyInventoryItemFact_shopId_id_key" ON "ShopifyInventoryItemFact"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyInventoryItemFact_shopId_shopifyGid_key" ON "ShopifyInventoryItemFact"("shopId", "shopifyGid");

-- CreateIndex
CREATE INDEX "ShopifyLocationFact_shopId_existenceState_idx" ON "ShopifyLocationFact"("shopId", "existenceState");

-- CreateIndex
CREATE INDEX "ShopifyLocationFact_shopId_lastSeenFullSyncRunId_idx" ON "ShopifyLocationFact"("shopId", "lastSeenFullSyncRunId");

-- CreateIndex
CREATE INDEX "ShopifyLocationFact_shopId_isActive_idx" ON "ShopifyLocationFact"("shopId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyLocationFact_shopId_id_key" ON "ShopifyLocationFact"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyLocationFact_shopId_shopifyGid_key" ON "ShopifyLocationFact"("shopId", "shopifyGid");

-- CreateIndex
CREATE INDEX "ShopifyInventoryLevelFact_shopId_locationGid_idx" ON "ShopifyInventoryLevelFact"("shopId", "locationGid");

-- CreateIndex
CREATE INDEX "ShopifyInventoryLevelFact_shopId_inventoryItemGid_idx" ON "ShopifyInventoryLevelFact"("shopId", "inventoryItemGid");

-- CreateIndex
CREATE INDEX "ShopifyInventoryLevelFact_shopId_existenceState_idx" ON "ShopifyInventoryLevelFact"("shopId", "existenceState");

-- CreateIndex
CREATE INDEX "ShopifyInventoryLevelFact_shopId_lastSeenFullSyncRunId_idx" ON "ShopifyInventoryLevelFact"("shopId", "lastSeenFullSyncRunId");

-- CreateIndex
CREATE INDEX "ShopifyInventoryLevelFact_shopId_shopifyInventoryLevelGid_idx" ON "ShopifyInventoryLevelFact"("shopId", "shopifyInventoryLevelGid");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyInventoryLevelFact_shopId_id_key" ON "ShopifyInventoryLevelFact"("shopId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyInventoryLevelFact_shopId_inventoryItemGid_locationG_key" ON "ShopifyInventoryLevelFact"("shopId", "inventoryItemGid", "locationGid");

-- CreateIndex
CREATE INDEX "CatalogObservationInFlight_shopId_resourceKind_shopifyGid_l_idx" ON "CatalogObservationInFlight"("shopId", "resourceKind", "shopifyGid", "lifecycleState");

-- CreateIndex
CREATE INDEX "CatalogObservationInFlight_shopId_resourceKind_inventoryIte_idx" ON "CatalogObservationInFlight"("shopId", "resourceKind", "inventoryItemGid", "locationGid", "lifecycleState");

-- CreateIndex
CREATE INDEX "CatalogObservationInFlight_shopId_leaseExpiresAt_lifecycleS_idx" ON "CatalogObservationInFlight"("shopId", "leaseExpiresAt", "lifecycleState");

-- CreateIndex
CREATE INDEX "CatalogObservationInFlight_shopId_observationRequestGen_idx" ON "CatalogObservationInFlight"("shopId", "observationRequestGen");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogObservationInFlight_shopId_id_key" ON "CatalogObservationInFlight"("shopId", "id");

-- CreateIndex
CREATE INDEX "SyncRun_shopId_fenceGeneration_idx" ON "SyncRun"("shopId", "fenceGeneration");

-- AddForeignKey
ALTER TABLE "ShopifyProductFact" ADD CONSTRAINT "ShopifyProductFact_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShopifyProductCollectionMembership" ADD CONSTRAINT "ShopifyProductCollectionMembership_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShopifyProductCollectionMembership" ADD CONSTRAINT "ShopifyProductCollectionMembership_shopId_shopifyProductGi_fkey" FOREIGN KEY ("shopId", "shopifyProductGid") REFERENCES "ShopifyProductFact"("shopId", "shopifyGid") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShopifyVariantFact" ADD CONSTRAINT "ShopifyVariantFact_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShopifyVariantFact" ADD CONSTRAINT "ShopifyVariantFact_shopId_shopifyProductGid_fkey" FOREIGN KEY ("shopId", "shopifyProductGid") REFERENCES "ShopifyProductFact"("shopId", "shopifyGid") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShopifyInventoryItemFact" ADD CONSTRAINT "ShopifyInventoryItemFact_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShopifyLocationFact" ADD CONSTRAINT "ShopifyLocationFact_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShopifyInventoryLevelFact" ADD CONSTRAINT "ShopifyInventoryLevelFact_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShopifyInventoryLevelFact" ADD CONSTRAINT "ShopifyInventoryLevelFact_shopId_inventoryItemGid_fkey" FOREIGN KEY ("shopId", "inventoryItemGid") REFERENCES "ShopifyInventoryItemFact"("shopId", "shopifyGid") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ShopifyInventoryLevelFact" ADD CONSTRAINT "ShopifyInventoryLevelFact_shopId_locationGid_fkey" FOREIGN KEY ("shopId", "locationGid") REFERENCES "ShopifyLocationFact"("shopId", "shopifyGid") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CatalogObservationInFlight" ADD CONSTRAINT "CatalogObservationInFlight_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;


-- InventoryItem → Variant optional composite FK (MATCH SIMPLE; null variant GID allowed)
ALTER TABLE "ShopifyInventoryItemFact"
  ADD CONSTRAINT "ShopifyInventoryItemFact_shopId_shopifyVariantGid_fkey"
  FOREIGN KEY ("shopId", "shopifyVariantGid")
  REFERENCES "ShopifyVariantFact" ("shopId", "shopifyGid")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Existence-evidence coherence (F-CLAUDE-PR5F1-01 / F-CLAUDE-PR5F1-06).
-- existenceRequestGen / existenceResponseGen are a direct Shopify
-- observation interval only. LIVE_FULL_SYNC_PRESENT carries NULL/NULL;
-- full-sync fence evidence lives on SyncRun.fenceGeneration.
ALTER TABLE "ShopifyProductFact"
  ADD CONSTRAINT "ShopifyProductFact_existence_evidence_coherence_check"
  CHECK (
    (
      "existenceKind" = 'LIVE_FULL_SYNC_PRESENT'
      AND "existenceState" = 'LIVE'
      AND "existenceRequestGen" IS NULL
      AND "existenceResponseGen" IS NULL
      AND "deletedAt" IS NULL
      AND "deletionSource" IS NULL
    )
    OR (
      "existenceKind" = 'LIVE_REFETCH'
      AND "existenceState" = 'LIVE'
      AND "existenceRequestGen" IS NOT NULL
      AND "existenceResponseGen" IS NOT NULL
      AND "existenceRequestGen" < "existenceResponseGen"
      AND "deletedAt" IS NULL
      AND "deletionSource" IS NULL
    )
    OR (
      "existenceKind" = 'ABSENT_CONFIRMED_QUERY'
      AND "existenceState" = 'ABSENT'
      AND "existenceRequestGen" IS NOT NULL
      AND "existenceResponseGen" IS NOT NULL
      AND "existenceRequestGen" < "existenceResponseGen"
      AND "deletedAt" IS NOT NULL
      AND "deletionSource" IS NOT NULL
    )
  );

ALTER TABLE "ShopifyVariantFact"
  ADD CONSTRAINT "ShopifyVariantFact_existence_evidence_coherence_check"
  CHECK (
    (
      "existenceKind" = 'LIVE_FULL_SYNC_PRESENT'
      AND "existenceState" = 'LIVE'
      AND "existenceRequestGen" IS NULL
      AND "existenceResponseGen" IS NULL
      AND "deletedAt" IS NULL
      AND "deletionSource" IS NULL
    )
    OR (
      "existenceKind" = 'LIVE_REFETCH'
      AND "existenceState" = 'LIVE'
      AND "existenceRequestGen" IS NOT NULL
      AND "existenceResponseGen" IS NOT NULL
      AND "existenceRequestGen" < "existenceResponseGen"
      AND "deletedAt" IS NULL
      AND "deletionSource" IS NULL
    )
    OR (
      "existenceKind" = 'ABSENT_CONFIRMED_QUERY'
      AND "existenceState" = 'ABSENT'
      AND "existenceRequestGen" IS NOT NULL
      AND "existenceResponseGen" IS NOT NULL
      AND "existenceRequestGen" < "existenceResponseGen"
      AND "deletedAt" IS NOT NULL
      AND "deletionSource" IS NOT NULL
    )
  );

ALTER TABLE "ShopifyInventoryItemFact"
  ADD CONSTRAINT "ShopifyInventoryItemFact_existence_evidence_coherence_check"
  CHECK (
    (
      "existenceKind" = 'LIVE_FULL_SYNC_PRESENT'
      AND "existenceState" = 'LIVE'
      AND "existenceRequestGen" IS NULL
      AND "existenceResponseGen" IS NULL
      AND "deletedAt" IS NULL
      AND "deletionSource" IS NULL
    )
    OR (
      "existenceKind" = 'LIVE_REFETCH'
      AND "existenceState" = 'LIVE'
      AND "existenceRequestGen" IS NOT NULL
      AND "existenceResponseGen" IS NOT NULL
      AND "existenceRequestGen" < "existenceResponseGen"
      AND "deletedAt" IS NULL
      AND "deletionSource" IS NULL
    )
    OR (
      "existenceKind" = 'ABSENT_CONFIRMED_QUERY'
      AND "existenceState" = 'ABSENT'
      AND "existenceRequestGen" IS NOT NULL
      AND "existenceResponseGen" IS NOT NULL
      AND "existenceRequestGen" < "existenceResponseGen"
      AND "deletedAt" IS NOT NULL
      AND "deletionSource" IS NOT NULL
    )
  );

ALTER TABLE "ShopifyLocationFact"
  ADD CONSTRAINT "ShopifyLocationFact_existence_evidence_coherence_check"
  CHECK (
    (
      "existenceKind" = 'LIVE_FULL_SYNC_PRESENT'
      AND "existenceState" = 'LIVE'
      AND "existenceRequestGen" IS NULL
      AND "existenceResponseGen" IS NULL
      AND "deletedAt" IS NULL
      AND "deletionSource" IS NULL
    )
    OR (
      "existenceKind" = 'LIVE_REFETCH'
      AND "existenceState" = 'LIVE'
      AND "existenceRequestGen" IS NOT NULL
      AND "existenceResponseGen" IS NOT NULL
      AND "existenceRequestGen" < "existenceResponseGen"
      AND "deletedAt" IS NULL
      AND "deletionSource" IS NULL
    )
    OR (
      "existenceKind" = 'ABSENT_CONFIRMED_QUERY'
      AND "existenceState" = 'ABSENT'
      AND "existenceRequestGen" IS NOT NULL
      AND "existenceResponseGen" IS NOT NULL
      AND "existenceRequestGen" < "existenceResponseGen"
      AND "deletedAt" IS NOT NULL
      AND "deletionSource" IS NOT NULL
    )
  );

ALTER TABLE "ShopifyInventoryLevelFact"
  ADD CONSTRAINT "ShopifyInventoryLevelFact_existence_evidence_coherence_check"
  CHECK (
    (
      "existenceKind" = 'LIVE_FULL_SYNC_PRESENT'
      AND "existenceState" = 'LIVE'
      AND "existenceRequestGen" IS NULL
      AND "existenceResponseGen" IS NULL
      AND "deletedAt" IS NULL
      AND "deletionSource" IS NULL
    )
    OR (
      "existenceKind" = 'LIVE_REFETCH'
      AND "existenceState" = 'LIVE'
      AND "existenceRequestGen" IS NOT NULL
      AND "existenceResponseGen" IS NOT NULL
      AND "existenceRequestGen" < "existenceResponseGen"
      AND "deletedAt" IS NULL
      AND "deletionSource" IS NULL
    )
    OR (
      "existenceKind" = 'ABSENT_CONFIRMED_QUERY'
      AND "existenceState" = 'ABSENT'
      AND "existenceRequestGen" IS NOT NULL
      AND "existenceResponseGen" IS NOT NULL
      AND "existenceRequestGen" < "existenceResponseGen"
      AND "deletedAt" IS NOT NULL
      AND "deletionSource" IS NOT NULL
    )
  );


ALTER TABLE "CatalogObservationInFlight"
  ADD CONSTRAINT "CatalogObservationInFlight_lifecycle_response_gen_check"
  CHECK (
    ("lifecycleState" = 'ACTIVE' AND "observationResponseGen" IS NULL)
    OR ("lifecycleState" = 'COMPLETED' AND "observationResponseGen" IS NOT NULL)
    OR ("lifecycleState" = 'ABANDONED')
  );

ALTER TABLE "CatalogObservationInFlight"
  ADD CONSTRAINT "CatalogObservationInFlight_lease_duration_ms_check"
  CHECK (
    "leaseDurationMs" >= 1
    AND "leaseDurationMs" <= 3600000
  );

ALTER TABLE "CatalogObservationInFlight"
  ADD CONSTRAINT "CatalogObservationInFlight_identity_shape_check"
  CHECK (
    (
      "resourceKind" IN ('Product', 'ProductVariant', 'InventoryItem', 'Location')
      AND "shopifyGid" IS NOT NULL
      AND "inventoryItemGid" IS NULL
      AND "locationGid" IS NULL
    )
    OR (
      "resourceKind" = 'InventoryLevel'
      AND "shopifyGid" IS NULL
      AND "inventoryItemGid" IS NOT NULL
      AND "locationGid" IS NOT NULL
    )
  );

CREATE OR REPLACE FUNCTION stocky_catalog_observation_lifecycle_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  -- Terminal states are one-way. Unrelated column updates may keep the
  -- current terminal lifecycleState. A retry is a new observation token.
  IF OLD."lifecycleState" IN ('COMPLETED', 'ABANDONED')
     AND NEW."lifecycleState" IS DISTINCT FROM OLD."lifecycleState" THEN
    RAISE EXCEPTION 'catalog_observation_terminal_transition_forbidden'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION stocky_catalog_observation_lifecycle_guard() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_CatalogObservationInFlight_lifecycle_guard
  ON "CatalogObservationInFlight";
CREATE TRIGGER trg_CatalogObservationInFlight_lifecycle_guard
  BEFORE UPDATE OF "lifecycleState" ON "CatalogObservationInFlight"
  FOR EACH ROW
  EXECUTE FUNCTION stocky_catalog_observation_lifecycle_guard();

-- Absolute lease deadline is computed from PostgreSQL clock_timestamp(),
-- never from an application-node clock (Race AO / §6.F.2.1).
CREATE OR REPLACE FUNCTION stocky_catalog_observation_set_lease()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW."leaseDurationMs" IS NULL
     OR NEW."leaseDurationMs" < 1
     OR NEW."leaseDurationMs" > 3600000 THEN
    RAISE EXCEPTION 'catalog_observation_lease_duration_invalid'
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

REVOKE ALL ON FUNCTION stocky_catalog_observation_set_lease() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_CatalogObservationInFlight_set_lease
  ON "CatalogObservationInFlight";
CREATE TRIGGER trg_CatalogObservationInFlight_set_lease
  BEFORE INSERT OR UPDATE ON "CatalogObservationInFlight"
  FOR EACH ROW
  EXECUTE FUNCTION stocky_catalog_observation_set_lease();

CREATE SEQUENCE public.stocky_catalog_observation_gen_seq
  AS bigint
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  START WITH 1
  CACHE 1
  NO CYCLE;

REVOKE ALL ON SEQUENCE public.stocky_catalog_observation_gen_seq FROM PUBLIC;
