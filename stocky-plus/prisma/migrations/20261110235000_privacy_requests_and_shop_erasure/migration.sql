-- Privacy compliance: durable request log and shop data erasure.
-- Additive. Safe on an empty database and on upgrade.
--
-- Grants, row-level policies and the function's final owner are applied by
-- `npm run sync:roles:provision` (scripts/sync-control-plane/privacy-erasure.ts).
-- Until that runs, nobody but the migration role can execute the function.

CREATE TYPE "PrivacyRequestTopic" AS ENUM ('CUSTOMERS_DATA_REQUEST', 'CUSTOMERS_REDACT', 'SHOP_REDACT');
CREATE TYPE "PrivacyRequestOrigin" AS ENUM ('SHOPIFY_WEBHOOK', 'RETENTION_SWEEP');
CREATE TYPE "PrivacyRequestResolution" AS ENUM ('NO_CUSTOMER_DATA_HELD', 'SHOP_DATA_ERASED', 'NO_SHOP_RECORD', 'SHOP_ACTIVE');

CREATE TABLE "PrivacyRequest" (
    "id" TEXT NOT NULL,
    "topic" "PrivacyRequestTopic" NOT NULL,
    "origin" "PrivacyRequestOrigin" NOT NULL,
    "shopDomain" VARCHAR(255) NOT NULL,
    "shopRecordId" TEXT,
    "shopifyShopId" VARCHAR(32),
    "shopifyWebhookId" VARCHAR(128),
    "dataRequestId" VARCHAR(32),
    "ordersListed" INTEGER,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastErrorCode" VARCHAR(64),
    "resolution" "PrivacyRequestResolution",
    "resolvedAt" TIMESTAMP(3),
    "erasedRows" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivacyRequest_shopifyWebhookId_key" ON "PrivacyRequest"("shopifyWebhookId");
CREATE INDEX "PrivacyRequest_resolution_nextAttemptAt_idx" ON "PrivacyRequest"("resolution", "nextAttemptAt");
CREATE INDEX "PrivacyRequest_shopRecordId_idx" ON "PrivacyRequest"("shopRecordId");
CREATE INDEX "PrivacyRequest_shopDomain_receivedAt_idx" ON "PrivacyRequest"("shopDomain", "receivedAt");

-- Control-plane RLS + grants (same pattern as other platform_control_plane tables).
ALTER TABLE "PrivacyRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PrivacyRequest" FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stocky_control_plane') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'PrivacyRequest'
        AND policyname = 'PrivacyRequest_control_plane_all'
    ) THEN
      CREATE POLICY "PrivacyRequest_control_plane_all"
        ON "PrivacyRequest"
        FOR ALL TO stocky_control_plane
        USING (true) WITH CHECK (true);
    END IF;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "PrivacyRequest" TO stocky_control_plane;
  END IF;
END $$;

-- Deletes up to p_max_rows rows belonging to one shop and, once none remain,
-- the shop row itself. Returns the number of rows deleted; 0 means nothing is
-- left. Callers repeat the call until it returns 0, so every transaction stays
-- bounded.
--
-- The shop must already be disabled with reason REDACTED: a shop that is in
-- use can never be erased through this function. Tables are discovered from
-- the catalog (every public table with a "shopId" column), so a table added
-- later is covered without changing this function. A parent table whose rows
-- are still referenced is skipped and retried on a later pass.
CREATE FUNCTION stocky_privacy_erase_shop_batch(p_shop_id text, p_max_rows integer)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_enabled boolean;
  v_reason text;
  v_table text;
  v_step bigint;
  v_deleted bigint := 0;
  v_budget bigint;
  v_blocked text := NULL;
BEGIN
  IF p_shop_id IS NULL OR p_shop_id = '' THEN
    RAISE EXCEPTION 'stocky_privacy_erasure_invalid_shop'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_max_rows IS NULL OR p_max_rows < 1 OR p_max_rows > 100000 THEN
    RAISE EXCEPTION 'stocky_privacy_erasure_invalid_batch'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  v_budget := p_max_rows;

  -- One erasure per shop at a time.
  PERFORM pg_advisory_xact_lock(hashtextextended('stocky_privacy_erasure:' || p_shop_id, 0));

  SELECT s."processingEnabled", s."processingDisabledReason"::text
    INTO v_enabled, v_reason
    FROM public."Shop" s
   WHERE s."id" = p_shop_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  IF v_enabled OR v_reason IS DISTINCT FROM 'REDACTED' THEN
    RAISE EXCEPTION 'stocky_privacy_erasure_refused: shop is not marked REDACTED'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  -- Row-level policies for the function owner only match this shop.
  PERFORM set_config('stocky.privacy_erasure_shop_id', p_shop_id, true);

  FOR v_table IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND a.attname = 'shopId'
       AND a.attnum > 0
       AND NOT a.attisdropped
     ORDER BY c.relname
  LOOP
    EXIT WHEN v_budget <= 0;
    BEGIN
      EXECUTE format(
        'DELETE FROM public.%1$I WHERE ctid IN (SELECT ctid FROM public.%1$I WHERE "shopId" = $1 LIMIT $2)',
        v_table
      ) USING p_shop_id, v_budget;
      GET DIAGNOSTICS v_step = ROW_COUNT;
      v_deleted := v_deleted + v_step;
      v_budget := v_budget - v_step;
    EXCEPTION WHEN foreign_key_violation THEN
      v_blocked := v_table;
    END;
  END LOOP;

  IF v_deleted > 0 OR v_budget <= 0 THEN
    RETURN v_deleted;
  END IF;

  IF v_blocked IS NOT NULL THEN
    RAISE EXCEPTION 'stocky_privacy_erasure_stalled: rows in % are still referenced', v_blocked
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  DELETE FROM public."Shop" s WHERE s."id" = p_shop_id;
  RETURN 1;
END;
$$;

REVOKE ALL ON FUNCTION stocky_privacy_erase_shop_batch(text, integer) FROM PUBLIC;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stocky_runtime') THEN
    REVOKE ALL ON FUNCTION stocky_privacy_erase_shop_batch(text, integer) FROM stocky_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stocky_control_plane') THEN
    REVOKE ALL ON FUNCTION stocky_privacy_erase_shop_batch(text, integer) FROM stocky_control_plane;
  END IF;
END $$;

COMMENT ON FUNCTION stocky_privacy_erase_shop_batch(text, integer) IS
  'Shop data erasure in bounded batches. EXECUTE is granted to stocky_control_plane only after sync:roles:provision transfers ownership to stocky_privacy_erasure_owner.';
