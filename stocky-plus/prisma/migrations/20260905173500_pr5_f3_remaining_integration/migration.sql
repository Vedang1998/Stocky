-- PR5-F3 remaining-integration schema, stage 2.
--
-- Additive only. No production execution or backfill is authorized.
-- Existing canonical rows retain their current projection state. New rows and
-- future canonical changes begin PROJECTION_PENDING until the post-commit
-- compatibility projector proves the derived rows match.
--
-- Recovery: disable F3 producers, retain nullable SyncRun evidence, and
-- forward-fix. If code rollback is separately authorized, restore the five
-- column defaults to HEALTHY only after proving no F3 writer remains active.
-- Indexes and nullable checkpoint columns may remain safely unused.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE "SyncRun"
  ADD COLUMN "bulkOperationGid" VARCHAR(512),
  ADD COLUMN "jsonlCommittedLineOrdinal" INTEGER,
  ADD COLUMN "bulkSubmitIntentAt" TIMESTAMP(3),
  ADD COLUMN "bulkQueryFingerprint" VARCHAR(64),
  ADD COLUMN "bulkObjectCount" VARCHAR(32),
  ADD COLUMN "bulkRootObjectCount" VARCHAR(32),
  ADD COLUMN "streamedObjectCount" VARCHAR(32),
  ADD COLUMN "streamedRootObjectCount" VARCHAR(32);

ALTER TABLE "SyncRun"
  ADD CONSTRAINT "SyncRun_jsonlCommittedLineOrdinal_check"
  CHECK (
    "jsonlCommittedLineOrdinal" IS NULL
    OR "jsonlCommittedLineOrdinal" >= 1
  ) NOT VALID;

ALTER TABLE "SyncRun"
  VALIDATE CONSTRAINT "SyncRun_jsonlCommittedLineOrdinal_check";

CREATE INDEX IF NOT EXISTS "SyncRun_shopId_bulkOperationGid_idx"
  ON "SyncRun" ("shopId", "bulkOperationGid");

ALTER TABLE "ShopifyProductFact"
  ALTER COLUMN "compatibilityProjectionState"
  SET DEFAULT 'PROJECTION_PENDING';
ALTER TABLE "ShopifyVariantFact"
  ALTER COLUMN "compatibilityProjectionState"
  SET DEFAULT 'PROJECTION_PENDING';
ALTER TABLE "ShopifyInventoryItemFact"
  ALTER COLUMN "compatibilityProjectionState"
  SET DEFAULT 'PROJECTION_PENDING';
ALTER TABLE "ShopifyLocationFact"
  ALTER COLUMN "compatibilityProjectionState"
  SET DEFAULT 'PROJECTION_PENDING';
ALTER TABLE "ShopifyInventoryLevelFact"
  ALTER COLUMN "compatibilityProjectionState"
  SET DEFAULT 'PROJECTION_PENDING';

CREATE INDEX IF NOT EXISTS "ShopifyProductFact_shopId_ingestBatchId_idx"
  ON "ShopifyProductFact" ("shopId", "ingestBatchId");
CREATE INDEX IF NOT EXISTS "ShopifyVariantFact_shopId_ingestBatchId_idx"
  ON "ShopifyVariantFact" ("shopId", "ingestBatchId");
CREATE INDEX IF NOT EXISTS "ShopifyInventoryItemFact_shopId_ingestBatchId_idx"
  ON "ShopifyInventoryItemFact" ("shopId", "ingestBatchId");
CREATE INDEX IF NOT EXISTS "ShopifyLocationFact_shopId_ingestBatchId_idx"
  ON "ShopifyLocationFact" ("shopId", "ingestBatchId");
CREATE INDEX IF NOT EXISTS "ShopifyInventoryLevelFact_shopId_ingestBatchId_idx"
  ON "ShopifyInventoryLevelFact" ("shopId", "ingestBatchId");
