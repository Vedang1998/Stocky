-- D-049: monotonic fail-safe readiness + persisted nextDispatchAt scheduling key.
-- Additive correction after D-048. Does not edit historical D-047/D-048 migrations.
-- FALSE POSITIVES ARE ACCEPTABLE. FALSE NEGATIVES ARE NOT.

-- 1) Persisted scheduling key (index-satisfiable ORDER BY / range predicate).
ALTER TABLE "DispatchReadyShop"
  ADD COLUMN IF NOT EXISTS "nextDispatchAt" TIMESTAMP(3);

-- Backfill from earliestEligibleAt (D-048 column) before enforcing NOT NULL.
UPDATE "DispatchReadyShop"
SET "nextDispatchAt" = "earliestEligibleAt"
WHERE "nextDispatchAt" IS NULL;

ALTER TABLE "DispatchReadyShop"
  ALTER COLUMN "nextDispatchAt" SET NOT NULL;

-- Replace D-048 fairness index: range on earliestEligibleAt + ORDER BY lastServedAt
-- cannot deliver index-ordered bounded access. New leading key matches the
-- production predicate/order: processingEnabled, nextDispatchAt, shopId.
DROP INDEX IF EXISTS "DispatchReadyShop_due_fairness_idx";

CREATE INDEX IF NOT EXISTS "DispatchReadyShop_dispatch_schedule_idx"
  ON "DispatchReadyShop" (
    "processingEnabled",
    "nextDispatchAt" ASC,
    "shopId" ASC
  );

-- 2) DurableJob.shopId immutability (F-D048-04) + preserved state transition guard.
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

  IF NEW."shopId" IS DISTINCT FROM OLD."shopId" THEN
    RAISE EXCEPTION 'stocky_durable_job_shop_id_immutable: shopId cannot be changed'
      USING ERRCODE = 'integrity_constraint_violation';
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
    ('ENQUEUED', 'RETRY_WAIT'),
    ('ENQUEUED', 'FAILED'),
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
  BEFORE UPDATE ON "DurableJob"
  FOR EACH ROW
  EXECUTE FUNCTION stocky_durable_job_transition_guard();

REVOKE ALL ON FUNCTION stocky_durable_job_transition_guard() FROM PUBLIC;

COMMENT ON FUNCTION stocky_durable_job_transition_guard() IS
  'D-049: legal DurableJob state transitions + shopId immutability (F-D048-04)';

-- 3) Monotonic fail-safe readiness maintenance (F-D048-01 / F-D048-05).
-- Never SELECT MIN then overwrite later. Eligible arrivals only create readiness
-- or move hints EARLIER via LEAST. Later/terminal/delete paths leave early/stale
-- false positives for bounded claim-time reconciliation.
-- Multi-shop DurableJob mutations in one transaction are rejected (F-D048-05 B)
-- unless stocky.allow_multi_shop_dispatch_ready = '1' (migration/admin only).
CREATE OR REPLACE FUNCTION stocky_dispatch_ready_shop_maintain() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  target_shop text;
  hint_at timestamp(3);
  shop_enabled boolean;
  locked_shop text;
  allow_multi text;
  should_touch boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Fail-safe: do not delete/recompute readiness on job deletion.
    -- Stale early hints are reconciled by the claim path.
    RETURN OLD;
  END IF;

  target_shop := NEW."shopId";

  IF TG_OP = 'INSERT' THEN
    should_touch := NEW.state IN ('PENDING', 'RETRY_WAIT');
    IF should_touch THEN
      hint_at := NEW."nextEligibleAt";
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.state IN ('PENDING', 'RETRY_WAIT') THEN
      IF OLD.state IS DISTINCT FROM NEW.state
         OR OLD.state NOT IN ('PENDING', 'RETRY_WAIT') THEN
        should_touch := true;
        hint_at := NEW."nextEligibleAt";
      ELSIF NEW."nextEligibleAt" < OLD."nextEligibleAt" THEN
        should_touch := true;
        hint_at := NEW."nextEligibleAt";
      END IF;
    END IF;
  END IF;

  IF NOT should_touch THEN
    RETURN NEW;
  END IF;

  allow_multi := nullif(current_setting('stocky.allow_multi_shop_dispatch_ready', true), '');
  IF allow_multi IS DISTINCT FROM '1' THEN
    locked_shop := nullif(current_setting('stocky.dispatch_ready_shop_tx', true), '');
    IF locked_shop IS NULL THEN
      PERFORM set_config('stocky.dispatch_ready_shop_tx', target_shop, true);
    ELSIF locked_shop IS DISTINCT FROM target_shop THEN
      RAISE EXCEPTION
        'stocky_single_shop_dispatch_ready_tx: multi-shop readiness mutation in one transaction is unsupported'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  SELECT s."processingEnabled" INTO shop_enabled
  FROM public."Shop" s WHERE s.id = target_shop;
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
    target_shop,
    hint_at,
    hint_at,
    NULL,
    shop_enabled,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT ("shopId") DO UPDATE SET
    -- Fail-safe: earliest hint never moves later from a concurrent arrival.
    "earliestEligibleAt" = LEAST(
      public."DispatchReadyShop"."earliestEligibleAt",
      EXCLUDED."earliestEligibleAt"
    ),
    -- Scheduling key: create/pull-earlier only for future-eligibility windows.
    -- Do NOT LEAST a fairness floor (now+1ms) back to an ancient due time —
    -- that would let continuously greedy shops defeat rotation (starvation bound).
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stocky_dispatch_ready_shop_maintain_trg ON "DurableJob";
CREATE TRIGGER stocky_dispatch_ready_shop_maintain_trg
  AFTER INSERT OR UPDATE OF "state", "nextEligibleAt"
  ON "DurableJob"
  FOR EACH ROW
  EXECUTE FUNCTION stocky_dispatch_ready_shop_maintain();

-- Keep denormalized processingEnabled in sync (unchanged semantics).
CREATE OR REPLACE FUNCTION stocky_dispatch_ready_shop_sync_enabled() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  UPDATE public."DispatchReadyShop"
  SET
    "processingEnabled" = NEW."processingEnabled",
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "shopId" = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stocky_dispatch_ready_shop_sync_enabled_trg ON "Shop";
CREATE TRIGGER stocky_dispatch_ready_shop_sync_enabled_trg
  AFTER UPDATE OF "processingEnabled"
  ON "Shop"
  FOR EACH ROW
  WHEN (OLD."processingEnabled" IS DISTINCT FROM NEW."processingEnabled")
  EXECUTE FUNCTION stocky_dispatch_ready_shop_sync_enabled();

REVOKE ALL ON FUNCTION stocky_dispatch_ready_shop_maintain() FROM PUBLIC;
REVOKE ALL ON FUNCTION stocky_dispatch_ready_shop_sync_enabled() FROM PUBLIC;

COMMENT ON FUNCTION stocky_dispatch_ready_shop_maintain() IS
  'D-049: monotonic LEAST readiness upsert; never moves later; single-shop-per-tx enforced';
COMMENT ON FUNCTION stocky_dispatch_ready_shop_sync_enabled() IS
  'D-048/D-049: denormalize Shop.processingEnabled onto DispatchReadyShop';

-- Repair any missing readiness for currently eligible work (fail-safe).
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
