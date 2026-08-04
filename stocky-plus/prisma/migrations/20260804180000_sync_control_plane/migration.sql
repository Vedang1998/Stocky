-- Phase 1 PR 4 — Synchronization control plane (additive only).
-- Disposable / non-production. Production migration is NOT AUTHORIZED by D-042.

DO $$ BEGIN
  CREATE TYPE "ShopProcessingDisabledReason" AS ENUM ('UNINSTALLED', 'MANUAL', 'REDACTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Shop lifecycle fields for uninstall/reinstall processing control.
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "processingEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "processingDisabledReason" "ShopProcessingDisabledReason";
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "processingDisabledAt" TIMESTAMP(3);
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "uninstalledAt" TIMESTAMP(3);
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "reinstalledAt" TIMESTAMP(3);

DO $$ BEGIN
  CREATE TYPE "WebhookDeliveryState" AS ENUM ('RECEIVED', 'JOB_CREATED', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DurableJobState" AS ENUM (
    'PENDING', 'DISPATCH_LEASED', 'ENQUEUED', 'RUNNING', 'RETRY_WAIT',
    'SUCCEEDED', 'FAILED', 'DEAD_LETTERED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "JobAttemptOutcome" AS ENUM (
    'SUCCEEDED', 'RETRYABLE_FAILURE', 'NON_RETRYABLE_FAILURE', 'CANCELLED', 'DENIED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DeadLetterResolutionState" AS ENUM ('OPEN', 'REPLAYED', 'DISMISSED', 'SUPERSEDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SyncRunStatus" AS ENUM (
    'PENDING', 'RUNNING', 'SUCCEEDED', 'PARTIAL_FAILURE', 'FAILED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SyncHealthState" AS ENUM (
    'NEVER_STARTED', 'RUNNING', 'HEALTHY', 'DEGRADED', 'FAILED', 'DISABLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DataIssueSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DataIssueStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'WONT_FIX');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- DurableJob first so WebhookDelivery can FK to it.
CREATE TABLE IF NOT EXISTS "DurableJob" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "jobType" VARCHAR(128) NOT NULL,
  "source" VARCHAR(128) NOT NULL,
  "queueName" VARCHAR(64) NOT NULL,
  "payloadSchemaVersion" VARCHAR(64) NOT NULL,
  "sanitizedPayload" JSONB NOT NULL,
  "payloadDigest" VARCHAR(64) NOT NULL,
  "idempotencyKey" VARCHAR(256) NOT NULL,
  "correlationId" TEXT NOT NULL,
  "causationId" TEXT,
  "authorityVersion" VARCHAR(64) NOT NULL,
  "state" "DurableJobState" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "nextEligibleAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseOwner" VARCHAR(128),
  "leaseExpiresAt" TIMESTAMP(3),
  "enqueuedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "deadLetteredAt" TIMESTAMP(3),
  "failureCode" VARCHAR(64),
  "failureSummary" VARCHAR(512),
  "webhookDeliveryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DurableJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WebhookDelivery" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "shopifyWebhookId" TEXT NOT NULL,
  "topic" VARCHAR(128) NOT NULL,
  "apiVersionReceived" VARCHAR(32) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payloadSchemaVersion" VARCHAR(64) NOT NULL,
  "sanitizedPayload" JSONB NOT NULL,
  "payloadDigest" VARCHAR(64) NOT NULL,
  "correlationId" TEXT NOT NULL,
  "duplicateCount" INTEGER NOT NULL DEFAULT 0,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "state" "WebhookDeliveryState" NOT NULL DEFAULT 'RECEIVED',
  "durableJobId" TEXT,
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failureCode" VARCHAR(64),
  "failureSummary" VARCHAR(512),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "JobAttempt" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "durableJobId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "workerId" VARCHAR(128) NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "outcome" "JobAttemptOutcome",
  "retryClassification" VARCHAR(64),
  "backoffMs" INTEGER,
  "errorCode" VARCHAR(64),
  "failureSummary" VARCHAR(512),
  "resultMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DeadLetter" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "durableJobId" TEXT NOT NULL,
  "finalAttemptId" TEXT,
  "terminalReason" VARCHAR(128) NOT NULL,
  "deadLetteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolutionState" "DeadLetterResolutionState" NOT NULL DEFAULT 'OPEN',
  "resolutionReason" VARCHAR(512),
  "resolvedAt" TIMESTAMP(3),
  "replayId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeadLetter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "JobReplay" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "originalJobId" TEXT NOT NULL,
  "newJobId" TEXT NOT NULL,
  "deadLetterId" TEXT,
  "replayReason" VARCHAR(512) NOT NULL,
  "correlationId" TEXT NOT NULL,
  "causationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobReplay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SyncRun" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "syncDomain" VARCHAR(64) NOT NULL,
  "source" VARCHAR(128) NOT NULL,
  "status" "SyncRunStatus" NOT NULL DEFAULT 'PENDING',
  "correlationId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "cursorBefore" VARCHAR(512),
  "cursorAfter" VARCHAR(512),
  "examinedCount" INTEGER NOT NULL DEFAULT 0,
  "appliedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "partialFailure" BOOLEAN NOT NULL DEFAULT false,
  "errorCode" VARCHAR(64),
  "failureSummary" VARCHAR(512),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SyncCursor" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "syncDomain" VARCHAR(64) NOT NULL,
  "cursorValue" VARCHAR(512) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncCursor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReconciliationRun" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "domain" VARCHAR(64) NOT NULL,
  "status" "SyncRunStatus" NOT NULL DEFAULT 'PENDING',
  "correlationId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "examinedCount" INTEGER NOT NULL DEFAULT 0,
  "issueCount" INTEGER NOT NULL DEFAULT 0,
  "errorCode" VARCHAR(64),
  "failureSummary" VARCHAR(512),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DataIssue" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "reconciliationRunId" TEXT,
  "syncRunId" TEXT,
  "status" "DataIssueStatus" NOT NULL DEFAULT 'OPEN',
  "severity" "DataIssueSeverity" NOT NULL DEFAULT 'ERROR',
  "reasonCode" VARCHAR(64) NOT NULL,
  "externalResourceType" VARCHAR(64),
  "externalResourceId" VARCHAR(128),
  "redactedEvidence" JSONB,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DataIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SyncHealth" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "syncDomain" VARCHAR(64) NOT NULL,
  "state" "SyncHealthState" NOT NULL DEFAULT 'NEVER_STARTED',
  "detailCode" VARCHAR(64),
  "detailSummary" VARCHAR(512),
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncHealth_pkey" PRIMARY KEY ("id")
);

-- Uniques / indexes
CREATE UNIQUE INDEX IF NOT EXISTS "DurableJob_shopId_idempotencyKey_key" ON "DurableJob"("shopId", "idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "DurableJob_shopId_id_key" ON "DurableJob"("shopId", "id");
CREATE INDEX IF NOT EXISTS "DurableJob_state_nextEligibleAt_createdAt_idx" ON "DurableJob"("state", "nextEligibleAt", "createdAt");
CREATE INDEX IF NOT EXISTS "DurableJob_shopId_state_nextEligibleAt_idx" ON "DurableJob"("shopId", "state", "nextEligibleAt");
CREATE INDEX IF NOT EXISTS "DurableJob_shopId_jobType_createdAt_idx" ON "DurableJob"("shopId", "jobType", "createdAt");
CREATE INDEX IF NOT EXISTS "DurableJob_leaseExpiresAt_idx" ON "DurableJob"("leaseExpiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "WebhookDelivery_shopId_shopifyWebhookId_key" ON "WebhookDelivery"("shopId", "shopifyWebhookId");
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookDelivery_shopId_id_key" ON "WebhookDelivery"("shopId", "id");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_shopId_state_receivedAt_idx" ON "WebhookDelivery"("shopId", "state", "receivedAt");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_shopId_topic_receivedAt_idx" ON "WebhookDelivery"("shopId", "topic", "receivedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "JobAttempt_shopId_durableJobId_attemptNumber_key" ON "JobAttempt"("shopId", "durableJobId", "attemptNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "JobAttempt_shopId_id_key" ON "JobAttempt"("shopId", "id");
CREATE INDEX IF NOT EXISTS "JobAttempt_shopId_durableJobId_startedAt_idx" ON "JobAttempt"("shopId", "durableJobId", "startedAt");
CREATE INDEX IF NOT EXISTS "JobAttempt_durableJobId_attemptNumber_idx" ON "JobAttempt"("durableJobId", "attemptNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "DeadLetter_shopId_id_key" ON "DeadLetter"("shopId", "id");
CREATE INDEX IF NOT EXISTS "DeadLetter_shopId_resolutionState_deadLetteredAt_idx" ON "DeadLetter"("shopId", "resolutionState", "deadLetteredAt");
CREATE INDEX IF NOT EXISTS "DeadLetter_durableJobId_idx" ON "DeadLetter"("durableJobId");
-- Exactly one OPEN dead letter per durable job.
CREATE UNIQUE INDEX IF NOT EXISTS "DeadLetter_one_open_per_job" ON "DeadLetter"("durableJobId") WHERE "resolutionState" = 'OPEN';

CREATE UNIQUE INDEX IF NOT EXISTS "JobReplay_shopId_id_key" ON "JobReplay"("shopId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "JobReplay_shopId_newJobId_key" ON "JobReplay"("shopId", "newJobId");
CREATE INDEX IF NOT EXISTS "JobReplay_shopId_originalJobId_createdAt_idx" ON "JobReplay"("shopId", "originalJobId", "createdAt");
CREATE INDEX IF NOT EXISTS "JobReplay_originalJobId_idx" ON "JobReplay"("originalJobId");

CREATE UNIQUE INDEX IF NOT EXISTS "SyncRun_shopId_id_key" ON "SyncRun"("shopId", "id");
CREATE INDEX IF NOT EXISTS "SyncRun_shopId_syncDomain_createdAt_idx" ON "SyncRun"("shopId", "syncDomain", "createdAt");
CREATE INDEX IF NOT EXISTS "SyncRun_shopId_status_createdAt_idx" ON "SyncRun"("shopId", "status", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "SyncCursor_shopId_syncDomain_key" ON "SyncCursor"("shopId", "syncDomain");
CREATE UNIQUE INDEX IF NOT EXISTS "SyncCursor_shopId_id_key" ON "SyncCursor"("shopId", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "ReconciliationRun_shopId_id_key" ON "ReconciliationRun"("shopId", "id");
CREATE INDEX IF NOT EXISTS "ReconciliationRun_shopId_domain_createdAt_idx" ON "ReconciliationRun"("shopId", "domain", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "DataIssue_shopId_id_key" ON "DataIssue"("shopId", "id");
CREATE INDEX IF NOT EXISTS "DataIssue_shopId_status_severity_detectedAt_idx" ON "DataIssue"("shopId", "status", "severity", "detectedAt");
CREATE INDEX IF NOT EXISTS "DataIssue_shopId_reasonCode_idx" ON "DataIssue"("shopId", "reasonCode");

CREATE UNIQUE INDEX IF NOT EXISTS "SyncHealth_shopId_syncDomain_key" ON "SyncHealth"("shopId", "syncDomain");
CREATE UNIQUE INDEX IF NOT EXISTS "SyncHealth_shopId_id_key" ON "SyncHealth"("shopId", "id");
CREATE INDEX IF NOT EXISTS "SyncHealth_shopId_state_idx" ON "SyncHealth"("shopId", "state");

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "DurableJob" ADD CONSTRAINT "DurableJob_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_durableJobId_fkey"
    FOREIGN KEY ("durableJobId") REFERENCES "DurableJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "JobAttempt" ADD CONSTRAINT "JobAttempt_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "JobAttempt" ADD CONSTRAINT "JobAttempt_durableJobId_fkey"
    FOREIGN KEY ("durableJobId") REFERENCES "DurableJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DeadLetter" ADD CONSTRAINT "DeadLetter_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DeadLetter" ADD CONSTRAINT "DeadLetter_durableJobId_fkey"
    FOREIGN KEY ("durableJobId") REFERENCES "DurableJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "JobReplay" ADD CONSTRAINT "JobReplay_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "JobReplay" ADD CONSTRAINT "JobReplay_originalJobId_fkey"
    FOREIGN KEY ("originalJobId") REFERENCES "DurableJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "JobReplay" ADD CONSTRAINT "JobReplay_newJobId_fkey"
    FOREIGN KEY ("newJobId") REFERENCES "DurableJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SyncCursor" ADD CONSTRAINT "SyncCursor_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ReconciliationRun" ADD CONSTRAINT "ReconciliationRun_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DataIssue" ADD CONSTRAINT "DataIssue_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DataIssue" ADD CONSTRAINT "DataIssue_reconciliationRunId_fkey"
    FOREIGN KEY ("reconciliationRunId") REFERENCES "ReconciliationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DataIssue" ADD CONSTRAINT "DataIssue_syncRunId_fkey"
    FOREIGN KEY ("syncRunId") REFERENCES "SyncRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SyncHealth" ADD CONSTRAINT "SyncHealth_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Processing-enabled helper for merchant RLS gate (uninstall race).
CREATE OR REPLACE FUNCTION stocky_shop_processing_enabled(p_shop_id text)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT s."processingEnabled" FROM public."Shop" s WHERE s."id" = p_shop_id),
    false
  );
$$;

REVOKE ALL ON FUNCTION stocky_shop_processing_enabled(text) FROM PUBLIC;
