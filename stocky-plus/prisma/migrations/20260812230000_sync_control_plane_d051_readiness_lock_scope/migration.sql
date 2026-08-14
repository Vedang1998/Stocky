-- D-051: replace the D-050 global readiness advisory lock with per-shop
-- transaction-scoped advisory locks. Additive; does not edit the reviewed
-- D-050 migration 20260811190000_sync_control_plane_d050_split_claim_statement_triggers.
-- FALSE POSITIVES ARE ACCEPTABLE. FALSE NEGATIVES ARE NOT.
--
-- Root cause (F-CLAUDE-D050-01): D-050 took
--   pg_advisory_xact_lock(hashtextextended('stocky_dispatch_ready_shop_maintain', 0))
-- once for every readiness-changing statement, held until COMMIT, for every
-- merchant. Unrelated shops serialized on a mutex they do not share.
--
-- Replacement: per-shop key
--   hashtextextended('stocky_dispatch_ready_shop_maintain:' || shop_id, 0)
-- acquired in shopId ASC inside each statement trigger. Unrelated merchants
-- no longer share a lock.
--
-- Transaction-wide deadlock freedom:
-- * CORRECTNESS BASIS: the currently audited runtime transaction-shape
--   invariant prevents a supported runtime transaction from taking readiness
--   advisory locks for different shops in separate statements in a dangerous
--   order. Multi-shop writers are single-statement (expired-lease recovery,
--   bulk processingEnabled, multi-row INSERT/UPDATE) and the trigger iterates
--   shopId ASC. Multi-statement readiness writers are single-shop.
-- * ORDER BY shopId ASC inside one statement is not by itself a
--   transaction-wide deadlock proof. Opposite-order multi-statement
--   transactions (T1: B then A; T2: A then B) can still ABBA on per-shop
--   xact locks / DispatchReadyShop row locks.
-- * DEFENSE-IN-DEPTH: transaction-local stocky.ready_lock_max_shop
--   (set_config is_local=true) can fail closed for ordinary descending
--   acquisition with SQLSTATE P0001 / message prefix
--   stocky_dispatch_ready_lock_order rather than waiting into 40P01.
--   It is bypassable/clearable by stocky_control_plane and is therefore
--   NOT a security or correctness enforcement boundary (F-CLAUDE-D051-01).
--   It is NOT a user-settable multi-shop allowance GUC
--   (F-CLAUDE-D049-03 stays closed).
-- * Dispatcher claim does not take these advisory locks (SKIP LOCKED on
--   jobs; ReadyShop row locks only). Lock order vs writers remains
--   DurableJob → advisory(shop) → ReadyShop for writers, ReadyShop-only
--   for the dispatcher.
--
-- Privilege model unchanged: bodies remain INLINE (no nested helper).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) DurableJob INSERT statement trigger — per-shop advisory lock
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION stocky_dispatch_ready_shop_maintain_insert_stmt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  rec record;
  shop_enabled boolean;
  max_held text;
BEGIN
  -- Advisory lock is taken ONLY when readiness work exists (inside the loop).
  -- Lease CAS / non-eligible DurableJob UPDATEs must not acquire it while the
  -- dispatcher already holds DispatchReadyShop row locks — that deadlocks with
  -- Shop.processingEnabled statement triggers that lock ReadyShop after the
  -- advisory (observed under D-050 processingEnabled bulk + dispatch stress).
  FOR rec IN
    SELECT n."shopId" AS shop_id, MIN(n."nextEligibleAt") AS hint_at
    FROM new_rows n
    WHERE n.state IN ('PENDING', 'RETRY_WAIT')
    GROUP BY n."shopId"
    ORDER BY n."shopId" ASC
  LOOP
    max_held := nullif(current_setting('stocky.ready_lock_max_shop', true), '');
    IF max_held IS NOT NULL AND rec.shop_id < max_held THEN
      RAISE EXCEPTION
        'stocky_dispatch_ready_lock_order: cannot lock shop % after higher shop % already locked in this transaction',
        rec.shop_id, max_held
        USING ERRCODE = 'P0001';
    END IF;

    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        'stocky_dispatch_ready_shop_maintain:' || rec.shop_id,
        0
      )
    );

    IF max_held IS NULL OR rec.shop_id > max_held THEN
      PERFORM set_config('stocky.ready_lock_max_shop', rec.shop_id, true);
    END IF;

    SELECT s."processingEnabled" INTO shop_enabled
    FROM public."Shop" s WHERE s.id = rec.shop_id;
    IF shop_enabled IS NULL THEN
      shop_enabled := false;
    END IF;

    INSERT INTO public."DispatchReadyShop" (
      "shopId",
      "earliestEligibleAt",
      "nextDispatchAt",
      "lastServedAt",
      "processingEnabled",
      "createdAt",
      "updatedAt"
    ) VALUES (
      rec.shop_id,
      rec.hint_at,
      rec.hint_at,
      NULL,
      shop_enabled,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("shopId") DO UPDATE SET
      "earliestEligibleAt" = LEAST(
        public."DispatchReadyShop"."earliestEligibleAt",
        EXCLUDED."earliestEligibleAt"
      ),
      -- Scheduling key: create/pull-earlier only for future-eligibility windows.
      -- Urgent-arrival anti-reset: never delay a due arrival beyond the approved
      -- 1-second maximum (D-050 / F-CLAUDE-D049-05 contract).
      "nextDispatchAt" = CASE
        WHEN public."DispatchReadyShop"."earliestEligibleAt" > clock_timestamp()
             AND EXCLUDED."nextDispatchAt" < public."DispatchReadyShop"."nextDispatchAt"
        THEN EXCLUDED."nextDispatchAt"
        WHEN EXCLUDED."nextDispatchAt" <= clock_timestamp()
             AND public."DispatchReadyShop"."nextDispatchAt"
                 > clock_timestamp() + interval '1 second'
        THEN EXCLUDED."nextDispatchAt"
        ELSE public."DispatchReadyShop"."nextDispatchAt"
      END,
      "processingEnabled" = EXCLUDED."processingEnabled",
      "updatedAt" = CURRENT_TIMESTAMP;
  END LOOP;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION stocky_dispatch_ready_shop_maintain_insert_stmt() IS
  'D-051: statement-level monotonic readiness upsert on DurableJob INSERT (per-shop advisory, shopId ASC, inline)';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) DurableJob UPDATE statement trigger — per-shop advisory lock
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION stocky_dispatch_ready_shop_maintain_update_stmt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  rec record;
  shop_enabled boolean;
  max_held text;
BEGIN
  -- Eligible arrivals / earlier schedules only. Terminal/removal/later
  -- transitions do not move readiness later (fail-safe false positives).
  -- Filter replaces UPDATE OF state, nextEligibleAt (incompatible with
  -- transition tables on PostgreSQL).
  -- Advisory lock only inside the work loop (see INSERT trigger comment).
  FOR rec IN
    SELECT n."shopId" AS shop_id, MIN(n."nextEligibleAt") AS hint_at
    FROM new_rows n
    INNER JOIN old_rows o ON o.id = n.id
    WHERE n.state IN ('PENDING', 'RETRY_WAIT')
      AND (
        -- Newly eligible (state entered PENDING/RETRY_WAIT)
        (o.state IS DISTINCT FROM n.state AND o.state NOT IN ('PENDING', 'RETRY_WAIT'))
        -- Or already-eligible with earlier schedule
        OR (o.state IN ('PENDING', 'RETRY_WAIT') AND n."nextEligibleAt" < o."nextEligibleAt")
        -- Or state changed between PENDING and RETRY_WAIT
        OR (o.state IN ('PENDING', 'RETRY_WAIT') AND o.state IS DISTINCT FROM n.state)
      )
    GROUP BY n."shopId"
    ORDER BY n."shopId" ASC
  LOOP
    max_held := nullif(current_setting('stocky.ready_lock_max_shop', true), '');
    IF max_held IS NOT NULL AND rec.shop_id < max_held THEN
      RAISE EXCEPTION
        'stocky_dispatch_ready_lock_order: cannot lock shop % after higher shop % already locked in this transaction',
        rec.shop_id, max_held
        USING ERRCODE = 'P0001';
    END IF;

    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        'stocky_dispatch_ready_shop_maintain:' || rec.shop_id,
        0
      )
    );

    IF max_held IS NULL OR rec.shop_id > max_held THEN
      PERFORM set_config('stocky.ready_lock_max_shop', rec.shop_id, true);
    END IF;

    SELECT s."processingEnabled" INTO shop_enabled
    FROM public."Shop" s WHERE s.id = rec.shop_id;
    IF shop_enabled IS NULL THEN
      shop_enabled := false;
    END IF;

    INSERT INTO public."DispatchReadyShop" (
      "shopId",
      "earliestEligibleAt",
      "nextDispatchAt",
      "lastServedAt",
      "processingEnabled",
      "createdAt",
      "updatedAt"
    ) VALUES (
      rec.shop_id,
      rec.hint_at,
      rec.hint_at,
      NULL,
      shop_enabled,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("shopId") DO UPDATE SET
      "earliestEligibleAt" = LEAST(
        public."DispatchReadyShop"."earliestEligibleAt",
        EXCLUDED."earliestEligibleAt"
      ),
      "nextDispatchAt" = CASE
        WHEN public."DispatchReadyShop"."earliestEligibleAt" > clock_timestamp()
             AND EXCLUDED."nextDispatchAt" < public."DispatchReadyShop"."nextDispatchAt"
        THEN EXCLUDED."nextDispatchAt"
        WHEN EXCLUDED."nextDispatchAt" <= clock_timestamp()
             AND public."DispatchReadyShop"."nextDispatchAt"
                 > clock_timestamp() + interval '1 second'
        THEN EXCLUDED."nextDispatchAt"
        ELSE public."DispatchReadyShop"."nextDispatchAt"
      END,
      "processingEnabled" = EXCLUDED."processingEnabled",
      "updatedAt" = CURRENT_TIMESTAMP;
  END LOOP;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION stocky_dispatch_ready_shop_maintain_update_stmt() IS
  'D-051: statement-level monotonic readiness upsert on DurableJob UPDATE (per-shop advisory, shopId ASC, inline)';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3) Shop.processingEnabled statement trigger — same per-shop lock protocol
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION stocky_dispatch_ready_shop_sync_enabled_stmt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  rec record;
  max_held text;
BEGIN
  -- Same per-shop readiness-maintain advisory lock as DurableJob upserts so
  -- bulk Shop.processingEnabled updates cannot deadlock with job writers.
  -- Taken inside the loop so no-op statements (no processingEnabled change)
  -- do not serialize against unrelated dispatch work.
  FOR rec IN
    SELECT n.id AS shop_id, n."processingEnabled" AS enabled
    FROM new_rows n
    INNER JOIN old_rows o ON o.id = n.id
    WHERE o."processingEnabled" IS DISTINCT FROM n."processingEnabled"
    ORDER BY n.id ASC
  LOOP
    max_held := nullif(current_setting('stocky.ready_lock_max_shop', true), '');
    IF max_held IS NOT NULL AND rec.shop_id < max_held THEN
      RAISE EXCEPTION
        'stocky_dispatch_ready_lock_order: cannot lock shop % after higher shop % already locked in this transaction',
        rec.shop_id, max_held
        USING ERRCODE = 'P0001';
    END IF;

    PERFORM pg_advisory_xact_lock(
      hashtextextended(
        'stocky_dispatch_ready_shop_maintain:' || rec.shop_id,
        0
      )
    );

    IF max_held IS NULL OR rec.shop_id > max_held THEN
      PERFORM set_config('stocky.ready_lock_max_shop', rec.shop_id, true);
    END IF;

    UPDATE public."DispatchReadyShop"
    SET
      "processingEnabled" = rec.enabled,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "shopId" = rec.shop_id;
  END LOOP;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION stocky_dispatch_ready_shop_sync_enabled_stmt() IS
  'D-051: statement-level processingEnabled denormalization (per-shop advisory, shopId ASC)';

REVOKE ALL ON FUNCTION stocky_dispatch_ready_shop_maintain_insert_stmt() FROM PUBLIC;
REVOKE ALL ON FUNCTION stocky_dispatch_ready_shop_maintain_update_stmt() FROM PUBLIC;
REVOKE ALL ON FUNCTION stocky_dispatch_ready_shop_sync_enabled_stmt() FROM PUBLIC;
