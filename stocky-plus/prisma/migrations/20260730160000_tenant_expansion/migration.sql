-- Phase 1 PR 1 — Tenant expansion (additive only)
-- Adds: Shop, backfill control tables, nullable shopId columns.
-- Does NOT: enforce NOT NULL, RLS, foreign keys to Shop, composite child FKs,
--           or remove/rename legacy shop columns.
-- Safe default: no shopId → Shop.id FK (quarantine must remain possible).

SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- ── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "TenantBackfillMode" AS ENUM ('DRY_RUN', 'APPLY');
CREATE TYPE "TenantBackfillRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "TenantBackfillCheckpointStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');
CREATE TYPE "TenantOwnershipIssueStatus" AS ENUM ('OPEN', 'RESOLVED');

-- ── Canonical Shop ───────────────────────────────────────────────────────────

CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "myshopifyDomain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Shop_myshopifyDomain_key" ON "Shop"("myshopifyDomain");

-- ── Backfill control tables ──────────────────────────────────────────────────

CREATE TABLE "TenantBackfillRun" (
    "id" TEXT NOT NULL,
    "normalizationVersion" TEXT NOT NULL,
    "mode" "TenantBackfillMode" NOT NULL,
    "status" "TenantBackfillRunStatus" NOT NULL DEFAULT 'PENDING',
    "batchSize" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "sourceMainSha" TEXT,
    "schemaVersion" TEXT,
    "beforeCounts" JSONB,
    "examinedCounts" JSONB,
    "updatedCounts" JSONB,
    "unchangedCounts" JSONB,
    "unresolvedCounts" JSONB,
    "checksums" JSONB,
    "failureSummary" TEXT,
    "resumeMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantBackfillRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TenantBackfillRun_status_createdAt_idx"
  ON "TenantBackfillRun"("status", "createdAt");

CREATE TABLE "TenantBackfillCheckpoint" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "lastProcessedId" TEXT,
    "examinedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "unchangedCount" INTEGER NOT NULL DEFAULT 0,
    "unresolvedCount" INTEGER NOT NULL DEFAULT 0,
    "checksum" TEXT,
    "status" "TenantBackfillCheckpointStatus" NOT NULL DEFAULT 'PENDING',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantBackfillCheckpoint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantBackfillCheckpoint_runId_tableName_key"
  ON "TenantBackfillCheckpoint"("runId", "tableName");
CREATE INDEX "TenantBackfillCheckpoint_tableName_status_idx"
  ON "TenantBackfillCheckpoint"("tableName", "status");

CREATE TABLE "TenantOwnershipIssue" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "firstDetectedRunId" TEXT NOT NULL,
    "lastDetectedRunId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "currentOwnershipEvidence" JSONB,
    "conflictingOwnershipEvidence" JSONB,
    "parentLineage" JSONB,
    "sourceShopValues" JSONB,
    "proposedCanonicalShop" TEXT,
    "status" "TenantOwnershipIssueStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionEvidence" JSONB,
    "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantOwnershipIssue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantOwnershipIssue_fingerprint_key"
  ON "TenantOwnershipIssue"("fingerprint");
CREATE INDEX "TenantOwnershipIssue_tableName_status_idx"
  ON "TenantOwnershipIssue"("tableName", "status");
CREATE INDEX "TenantOwnershipIssue_reasonCode_status_idx"
  ON "TenantOwnershipIssue"("reasonCode", "status");
CREATE INDEX "TenantOwnershipIssue_rowId_tableName_idx"
  ON "TenantOwnershipIssue"("rowId", "tableName");

ALTER TABLE "TenantBackfillCheckpoint"
  ADD CONSTRAINT "TenantBackfillCheckpoint_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "TenantBackfillRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantOwnershipIssue"
  ADD CONSTRAINT "TenantOwnershipIssue_firstDetectedRunId_fkey"
  FOREIGN KEY ("firstDetectedRunId") REFERENCES "TenantBackfillRun"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TenantOwnershipIssue"
  ADD CONSTRAINT "TenantOwnershipIssue_lastDetectedRunId_fkey"
  FOREIGN KEY ("lastDetectedRunId") REFERENCES "TenantBackfillRun"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Nullable shopId columns (no defaults, no NOT NULL, no FK to Shop) ────────

ALTER TABLE "Supplier" ADD COLUMN "shopId" TEXT;
ALTER TABLE "SupplierSkuMapping" ADD COLUMN "shopId" TEXT;
ALTER TABLE "VolumePriceTier" ADD COLUMN "shopId" TEXT;
ALTER TABLE "LeadTimeSnapshot" ADD COLUMN "shopId" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "shopId" TEXT;
ALTER TABLE "POLineItem" ADD COLUMN "shopId" TEXT;
ALTER TABLE "ShopifyVariantCache" ADD COLUMN "shopId" TEXT;
ALTER TABLE "InventorySnapshot" ADD COLUMN "shopId" TEXT;
ALTER TABLE "VariantAbcClass" ADD COLUMN "shopId" TEXT;
ALTER TABLE "ForecastOverride" ADD COLUMN "shopId" TEXT;
ALTER TABLE "SalesDailyAggregate" ADD COLUMN "shopId" TEXT;
ALTER TABLE "ShopSettings" ADD COLUMN "shopId" TEXT;
ALTER TABLE "TransferOrder" ADD COLUMN "shopId" TEXT;
ALTER TABLE "TransferLineItem" ADD COLUMN "shopId" TEXT;
ALTER TABLE "Stocktake" ADD COLUMN "shopId" TEXT;
ALTER TABLE "StocktakeLineItem" ADD COLUMN "shopId" TEXT;
ALTER TABLE "BomComponent" ADD COLUMN "shopId" TEXT;
ALTER TABLE "LowStockAlert" ADD COLUMN "shopId" TEXT;

-- Session intentionally unchanged (Shopify Prisma session-storage adapter).

RESET lock_timeout;
RESET statement_timeout;
