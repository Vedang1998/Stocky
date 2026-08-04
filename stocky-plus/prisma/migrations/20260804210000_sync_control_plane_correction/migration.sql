-- Phase 1 PR 4 correction migration (D-043) — additive only.
-- Do NOT edit 20260804180000_sync_control_plane.
-- Production execution is NOT AUTHORIZED.

-- ─── Enum extensions ─────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TYPE "WebhookDeliveryState" ADD VALUE IF NOT EXISTS 'CONFLICT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "WebhookDeliveryState" ADD VALUE IF NOT EXISTS 'QUARANTINED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "JobAttemptOutcome" ADD VALUE IF NOT EXISTS 'ABANDONED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "JobAttemptOutcome" ADD VALUE IF NOT EXISTS 'LEASE_EXPIRED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "JobAttemptOutcome" ADD VALUE IF NOT EXISTS 'WORKER_LOST';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "JobDispatchState" AS ENUM (
    'PENDING_ENQUEUE',
    'ENQUEUED',
    'OBSERVED',
    'STARTED',
    'COMPLETED',
    'FAILED',
    'SUPERSEDED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "JobExecutionStrategy" AS ENUM (
    'ATOMIC_APPLICATION_RECEIPT',
    'REBUILDABLE_IDEMPOTENT',
    'NO_AUTOMATIC_RETRY',
    'CONTROL_ONLY'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── WebhookDelivery conflict / nullable Shopify webhook ID ──────────────────

ALTER TABLE "WebhookDelivery" ALTER COLUMN "shopifyWebhookId" DROP NOT NULL;

ALTER TABLE "WebhookDelivery"
  ADD COLUMN IF NOT EXISTS "payloadDigestMismatchCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastConflictingDigest" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "firstMismatchAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastMismatchAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "quarantineReason" VARCHAR(128);

-- Replace full unique with partial unique for non-null Shopify webhook IDs.
DROP INDEX IF EXISTS "WebhookDelivery_shopId_shopifyWebhookId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookDelivery_shopId_shopifyWebhookId_nonnull_key"
  ON "WebhookDelivery" ("shopId", "shopifyWebhookId")
  WHERE "shopifyWebhookId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "WebhookDelivery_shopId_state_quarantine_idx"
  ON "WebhookDelivery" ("shopId", "state", "receivedAt");

-- ─── DurableJob execution strategy + active dispatch sequence ────────────────

ALTER TABLE "DurableJob"
  ADD COLUMN IF NOT EXISTS "executionStrategy" "JobExecutionStrategy" NOT NULL DEFAULT 'ATOMIC_APPLICATION_RECEIPT',
  ADD COLUMN IF NOT EXISTS "activeDispatchSequence" INTEGER;

-- Eligible-job partial indexes for index-supported claim (F-PR4-11).
CREATE INDEX IF NOT EXISTS "DurableJob_eligible_pending_idx"
  ON "DurableJob" ("nextEligibleAt" ASC, "createdAt" ASC, "id")
  WHERE "state" = 'PENDING';

CREATE INDEX IF NOT EXISTS "DurableJob_eligible_retry_wait_idx"
  ON "DurableJob" ("nextEligibleAt" ASC, "createdAt" ASC, "id")
  WHERE "state" = 'RETRY_WAIT';

CREATE INDEX IF NOT EXISTS "DurableJob_shop_eligible_pending_idx"
  ON "DurableJob" ("shopId", "nextEligibleAt" ASC, "createdAt" ASC)
  WHERE "state" = 'PENDING';

CREATE INDEX IF NOT EXISTS "DurableJob_shop_eligible_retry_wait_idx"
  ON "DurableJob" ("shopId", "nextEligibleAt" ASC, "createdAt" ASC)
  WHERE "state" = 'RETRY_WAIT';

CREATE INDEX IF NOT EXISTS "DurableJob_running_lease_idx"
  ON "DurableJob" ("leaseExpiresAt")
  WHERE "state" = 'RUNNING' AND "leaseExpiresAt" IS NOT NULL;

-- ─── JobDispatch (append-only dispatch identity) ─────────────────────────────

CREATE TABLE IF NOT EXISTS "JobDispatch" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "durableJobId" TEXT NOT NULL,
  "dispatchSequence" INTEGER NOT NULL,
  "queueName" VARCHAR(64) NOT NULL,
  "queueJobId" VARCHAR(256) NOT NULL,
  "state" "JobDispatchState" NOT NULL DEFAULT 'PENDING_ENQUEUE',
  "leaseOwner" VARCHAR(128),
  "leaseExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "enqueuedAt" TIMESTAMP(3),
  "observedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failureCode" VARCHAR(64),
  "failureSummary" VARCHAR(512),
  "payloadDigest" VARCHAR(64) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobDispatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "JobDispatch_durableJobId_dispatchSequence_key"
  ON "JobDispatch" ("durableJobId", "dispatchSequence");

CREATE UNIQUE INDEX IF NOT EXISTS "JobDispatch_queueName_queueJobId_key"
  ON "JobDispatch" ("queueName", "queueJobId");

CREATE UNIQUE INDEX IF NOT EXISTS "JobDispatch_shopId_id_key"
  ON "JobDispatch" ("shopId", "id");

CREATE INDEX IF NOT EXISTS "JobDispatch_shopId_durableJobId_createdAt_idx"
  ON "JobDispatch" ("shopId", "durableJobId", "createdAt");

CREATE INDEX IF NOT EXISTS "JobDispatch_state_leaseExpiresAt_idx"
  ON "JobDispatch" ("state", "leaseExpiresAt");

DO $$ BEGIN
  ALTER TABLE "JobDispatch" ADD CONSTRAINT "JobDispatch_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "JobDispatch" ADD CONSTRAINT "JobDispatch_durableJobId_fkey"
    FOREIGN KEY ("durableJobId") REFERENCES "DurableJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── JobAttempt lease / heartbeat / dispatch binding ─────────────────────────

ALTER TABLE "JobAttempt"
  ADD COLUMN IF NOT EXISTS "leaseOwner" VARCHAR(128),
  ADD COLUMN IF NOT EXISTS "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "heartbeatAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "jobDispatchId" TEXT;

DO $$ BEGIN
  ALTER TABLE "JobAttempt" ADD CONSTRAINT "JobAttempt_jobDispatchId_fkey"
    FOREIGN KEY ("jobDispatchId") REFERENCES "JobDispatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Database-enforced single active attempt per durable job (F-PR4-04).
CREATE UNIQUE INDEX IF NOT EXISTS "JobAttempt_one_active_per_durable_job"
  ON "JobAttempt" ("durableJobId")
  WHERE "finishedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "JobAttempt_lease_expiry_idx"
  ON "JobAttempt" ("leaseExpiresAt")
  WHERE "finishedAt" IS NULL AND "leaseExpiresAt" IS NOT NULL;

-- ─── SyncApplicationReceipt (merchant-domain exactly-once marker) ────────────

CREATE TABLE IF NOT EXISTS "SyncApplicationReceipt" (
  "id" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "applicationKey" VARCHAR(256) NOT NULL,
  "sourceJobType" VARCHAR(128) NOT NULL,
  "rootDurableJobId" TEXT NOT NULL,
  "firstApplyingDurableJobId" TEXT NOT NULL,
  "payloadDigest" VARCHAR(64) NOT NULL,
  "applicationSchemaVersion" VARCHAR(64) NOT NULL,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resultMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncApplicationReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SyncApplicationReceipt_shopId_applicationKey_key"
  ON "SyncApplicationReceipt" ("shopId", "applicationKey");

CREATE UNIQUE INDEX IF NOT EXISTS "SyncApplicationReceipt_shopId_id_key"
  ON "SyncApplicationReceipt" ("shopId", "id");

CREATE INDEX IF NOT EXISTS "SyncApplicationReceipt_shopId_rootDurableJobId_idx"
  ON "SyncApplicationReceipt" ("shopId", "rootDurableJobId");

CREATE INDEX IF NOT EXISTS "SyncApplicationReceipt_shopId_appliedAt_idx"
  ON "SyncApplicationReceipt" ("shopId", "appliedAt");

DO $$ BEGIN
  ALTER TABLE "SyncApplicationReceipt" ADD CONSTRAINT "SyncApplicationReceipt_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Merchant-domain RLS: ENABLE+FORCE here; exact tenant policies + grants are
-- applied by tenant-enforcement when SyncApplicationReceipt is in MERCHANT_TABLES.
-- No control-plane role DML is granted on this table.
ALTER TABLE "SyncApplicationReceipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncApplicationReceipt" FORCE ROW LEVEL SECURITY;

-- ─── DurableJob legal transition trigger (F-PR4-05) ─────────────────────────

CREATE OR REPLACE FUNCTION stocky_durable_job_transition_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  legal boolean := false;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF OLD."state" IS NOT DISTINCT FROM NEW."state" THEN
    RETURN NEW;
  END IF;

  legal := (OLD."state", NEW."state") IN (
    ('PENDING', 'DISPATCH_LEASED'),
    ('PENDING', 'CANCELLED'),
    ('DISPATCH_LEASED', 'ENQUEUED'),
    ('DISPATCH_LEASED', 'PENDING'),
    ('DISPATCH_LEASED', 'CANCELLED'),
    ('ENQUEUED', 'RUNNING'),
    ('ENQUEUED', 'CANCELLED'),
    ('RUNNING', 'SUCCEEDED'),
    ('RUNNING', 'RETRY_WAIT'),
    ('RUNNING', 'FAILED'),
    ('RUNNING', 'CANCELLED'),
    ('RETRY_WAIT', 'DISPATCH_LEASED'),
    ('RETRY_WAIT', 'CANCELLED'),
    ('FAILED', 'DEAD_LETTERED')
  );

  IF NOT legal THEN
    RAISE EXCEPTION 'illegal_job_transition:%->%', OLD."state", NEW."state"
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stocky_durable_job_transition_guard_trg ON "DurableJob";
CREATE TRIGGER stocky_durable_job_transition_guard_trg
  BEFORE UPDATE OF "state" ON "DurableJob"
  FOR EACH ROW
  EXECUTE FUNCTION stocky_durable_job_transition_guard();

REVOKE ALL ON FUNCTION stocky_durable_job_transition_guard() FROM PUBLIC;

-- ─── Control-plane RLS defense-in-depth (F-PR4-06) ───────────────────────────
-- ENABLE + FORCE RLS on all platform control-plane tables.
-- Explicit policy only for stocky_control_plane (global cross-shop access).
-- No policy for stocky_runtime → denied. Migration/maintenance documented.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'WebhookDelivery', 'DurableJob', 'JobAttempt', 'DeadLetter', 'JobReplay',
    'SyncRun', 'SyncCursor', 'ReconciliationRun', 'DataIssue', 'SyncHealth',
    'JobDispatch'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Control-plane role policies (created when role exists).
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'WebhookDelivery', 'DurableJob', 'JobAttempt', 'DeadLetter', 'JobReplay',
    'SyncRun', 'SyncCursor', 'ReconciliationRun', 'DataIssue', 'SyncHealth',
    'JobDispatch'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stocky_control_plane') THEN
    RETURN;
  END IF;
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL TO stocky_control_plane USING (true) WITH CHECK (true)',
        t || '_control_plane_all',
        t
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO stocky_control_plane',
      t
    );
  END LOOP;
END $$;

-- Document: table owners / superusers used for migrations bypass FORCE RLS only
-- when BYPASSRLS is set. Production migration owners must be non-BYPASSRLS and
-- either hold an explicit maintenance policy or run DDL outside FORCE-sensitive
-- DML paths. Disposable CI uses a privileged migration URL for schema apply only.

COMMENT ON TABLE "JobDispatch" IS
  'PR4 correction: append-only dispatch identity; queue job ID = durableJobId:dispatchSequence';
COMMENT ON TABLE "SyncApplicationReceipt" IS
  'PR4 correction: merchant-domain exactly-once application receipt; RLS + processing gate';
COMMENT ON FUNCTION stocky_durable_job_transition_guard() IS
  'Rejects illegal DurableJob.state transitions for every writer including raw SQL';

-- Narrow boolean probe for control-plane RUNNING recovery (no merchant DML).
CREATE OR REPLACE FUNCTION stocky_has_application_receipt(
  p_shop_id text,
  p_application_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."SyncApplicationReceipt" r
    WHERE r."shopId" = p_shop_id
      AND r."applicationKey" = p_application_key
  );
$$;

REVOKE ALL ON FUNCTION stocky_has_application_receipt(text, text) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stocky_control_plane') THEN
    GRANT EXECUTE ON FUNCTION stocky_has_application_receipt(text, text) TO stocky_control_plane;
  END IF;
END $$;
