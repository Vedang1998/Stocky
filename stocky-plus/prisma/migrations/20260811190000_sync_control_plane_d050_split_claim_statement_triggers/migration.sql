-- D-050: split claim/reconciliation snapshots + statement-level readiness
-- maintenance. Additive correction after D-049. Does not edit historical
-- D-047/D-048/D-049 migrations.
-- FALSE POSITIVES ARE ACCEPTABLE. FALSE NEGATIVES ARE NOT.
--
-- Removes custom-GUC single-shop correctness boundary
-- (stocky.allow_multi_shop_dispatch_ready / stocky.dispatch_ready_shop_tx).
-- Multi-shop DurableJob / Shop statements are supported via AFTER STATEMENT
-- transition-table triggers that upsert readiness in deterministic shopId ASC
-- order. A transaction-scoped advisory lock serializes readiness upserts to
-- eliminate opposite-order multi-statement deadlocks without custom GUC.
--
-- Privilege model (matches D-049): trigger bodies perform maintenance INLINE.
-- Nested helper calls are forbidden here — REVOKE ALL … FROM PUBLIC plus
-- stocky_runtime writers would otherwise hit 42501 on nested EXECUTE
-- (PostgreSQL does not require EXECUTE to fire a trigger function, but DOES
-- require EXECUTE for functions the trigger body calls).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) Statement-level DurableJob INSERT maintenance (inline upsert)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION stocky_dispatch_ready_shop_maintain_insert_stmt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  rec record;
  shop_enabled boolean;
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
    PERFORM pg_advisory_xact_lock(
      hashtextextended('stocky_dispatch_ready_shop_maintain', 0)
    );

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

DROP TRIGGER IF EXISTS stocky_dispatch_ready_shop_maintain_trg ON "DurableJob";
DROP TRIGGER IF EXISTS stocky_dispatch_ready_shop_maintain_insert_stmt_trg ON "DurableJob";
CREATE TRIGGER stocky_dispatch_ready_shop_maintain_insert_stmt_trg
  AFTER INSERT ON "DurableJob"
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION stocky_dispatch_ready_shop_maintain_insert_stmt();

REVOKE ALL ON FUNCTION stocky_dispatch_ready_shop_maintain_insert_stmt() FROM PUBLIC;

COMMENT ON FUNCTION stocky_dispatch_ready_shop_maintain_insert_stmt() IS
  'D-050: statement-level monotonic readiness upsert on DurableJob INSERT (shopId ASC, inline)';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) Statement-level DurableJob UPDATE (state / nextEligibleAt) maintenance
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION stocky_dispatch_ready_shop_maintain_update_stmt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  rec record;
  shop_enabled boolean;
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
    PERFORM pg_advisory_xact_lock(
      hashtextextended('stocky_dispatch_ready_shop_maintain', 0)
    );

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

-- NOTE: PostgreSQL forbids transition tables on triggers with column lists
-- (ERROR 0A000). Use AFTER UPDATE (all columns) and filter relevant rows inside.
DROP TRIGGER IF EXISTS stocky_dispatch_ready_shop_maintain_update_stmt_trg ON "DurableJob";
CREATE TRIGGER stocky_dispatch_ready_shop_maintain_update_stmt_trg
  AFTER UPDATE ON "DurableJob"
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION stocky_dispatch_ready_shop_maintain_update_stmt();

REVOKE ALL ON FUNCTION stocky_dispatch_ready_shop_maintain_update_stmt() FROM PUBLIC;

COMMENT ON FUNCTION stocky_dispatch_ready_shop_maintain_update_stmt() IS
  'D-050: statement-level monotonic readiness upsert on DurableJob UPDATE (shopId ASC, inline)';

-- Drop obsolete row-level maintain function (replaced by statement triggers).
DROP FUNCTION IF EXISTS stocky_dispatch_ready_shop_maintain() CASCADE;

-- Drop any prior D-050 nested helper (privilege-unsafe under runtime writers).
DROP FUNCTION IF EXISTS stocky_dispatch_ready_shop_monotonic_upsert(text, timestamp(3));

-- ═══════════════════════════════════════════════════════════════════════════
-- 3) Statement-level Shop.processingEnabled sync (deterministic shopId order)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION stocky_dispatch_ready_shop_sync_enabled_stmt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  rec record;
BEGIN
  -- Same readiness-maintain advisory lock as DurableJob upserts so bulk
  -- Shop.processingEnabled updates cannot deadlock with job writers.
  -- Taken inside the loop so no-op statements (no processingEnabled change)
  -- do not serialize against unrelated dispatch work.
  FOR rec IN
    SELECT n.id AS shop_id, n."processingEnabled" AS enabled
    FROM new_rows n
    INNER JOIN old_rows o ON o.id = n.id
    WHERE o."processingEnabled" IS DISTINCT FROM n."processingEnabled"
    ORDER BY n.id ASC
  LOOP
    PERFORM pg_advisory_xact_lock(
      hashtextextended('stocky_dispatch_ready_shop_maintain', 0)
    );

    UPDATE public."DispatchReadyShop"
    SET
      "processingEnabled" = rec.enabled,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "shopId" = rec.shop_id;
  END LOOP;
  RETURN NULL;
END;
$$;

-- NOTE: PostgreSQL forbids transition tables on triggers with column lists.
DROP TRIGGER IF EXISTS stocky_dispatch_ready_shop_sync_enabled_trg ON "Shop";
DROP TRIGGER IF EXISTS stocky_dispatch_ready_shop_sync_enabled_stmt_trg ON "Shop";
CREATE TRIGGER stocky_dispatch_ready_shop_sync_enabled_stmt_trg
  AFTER UPDATE ON "Shop"
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION stocky_dispatch_ready_shop_sync_enabled_stmt();

DROP FUNCTION IF EXISTS stocky_dispatch_ready_shop_sync_enabled() CASCADE;

REVOKE ALL ON FUNCTION stocky_dispatch_ready_shop_sync_enabled_stmt() FROM PUBLIC;

COMMENT ON FUNCTION stocky_dispatch_ready_shop_sync_enabled_stmt() IS
  'D-050: statement-level processingEnabled denormalization in shopId ASC order';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4) Preserve DurableJob.shopId immutability + transition guard (unchanged)
-- ═══════════════════════════════════════════════════════════════════════════
-- stocky_durable_job_transition_guard remains from D-049; no rewrite required.

-- ═══════════════════════════════════════════════════════════════════════════
-- 5) Fail-safe repair: recreate missing readiness for currently eligible work
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO "DispatchReadyShop" (
  "shopId",
  "earliestEligibleAt",
  "nextDispatchAt",
  "lastServedAt",
  "processingEnabled",
  "createdAt",
  "updatedAt"
)
SELECT
  j."shopId",
  MIN(j."nextEligibleAt"),
  MIN(j."nextEligibleAt"),
  NULL,
  COALESCE(bool_and(s."processingEnabled"), false),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "DurableJob" j
INNER JOIN "Shop" s ON s.id = j."shopId"
WHERE j.state IN ('PENDING', 'RETRY_WAIT')
GROUP BY j."shopId"
ORDER BY j."shopId" ASC
ON CONFLICT ("shopId") DO UPDATE SET
  "earliestEligibleAt" = LEAST(
    "DispatchReadyShop"."earliestEligibleAt",
    EXCLUDED."earliestEligibleAt"
  ),
  "nextDispatchAt" = CASE
    WHEN "DispatchReadyShop"."earliestEligibleAt" > clock_timestamp()
         AND EXCLUDED."nextDispatchAt" < "DispatchReadyShop"."nextDispatchAt"
    THEN EXCLUDED."nextDispatchAt"
    WHEN EXCLUDED."nextDispatchAt" <= clock_timestamp()
         AND "DispatchReadyShop"."nextDispatchAt"
             > clock_timestamp() + interval '1 second'
    THEN EXCLUDED."nextDispatchAt"
    ELSE "DispatchReadyShop"."nextDispatchAt"
  END,
  "processingEnabled" = EXCLUDED."processingEnabled",
  "updatedAt" = CURRENT_TIMESTAMP;
