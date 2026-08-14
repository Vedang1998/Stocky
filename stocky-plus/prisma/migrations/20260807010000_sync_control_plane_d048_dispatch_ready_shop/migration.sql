-- D-048: DispatchReadyShop readiness/fairness control plane.
-- Additive only. Does not edit the historical D-047 fair-claim index migration.
-- DurableJob_shop_claim_* indexes remain IF NOT EXISTS no-ops when pre-created
-- concurrently via sync:claim-indexes:apply (see scripts/sync-control-plane/).

CREATE TABLE IF NOT EXISTS "DispatchReadyShop" (
  "shopId" TEXT NOT NULL,
  "earliestEligibleAt" TIMESTAMP(3) NOT NULL,
  "lastServedAt" TIMESTAMP(3),
  "processingEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DispatchReadyShop_pkey" PRIMARY KEY ("shopId")
);

-- Due + fairness selection without joining Shop (processingEnabled denormalized).
CREATE INDEX IF NOT EXISTS "DispatchReadyShop_due_fairness_idx"
  ON "DispatchReadyShop" (
    "processingEnabled",
    "earliestEligibleAt" ASC,
    "lastServedAt" ASC NULLS FIRST,
    "shopId" ASC
  );

DO $$ BEGIN
  ALTER TABLE "DispatchReadyShop"
    ADD CONSTRAINT "DispatchReadyShop_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Fail-safe readiness maintenance: never permanently hide eligible work.
-- False-positive readiness is allowed and self-heals on the next claim cycle.
CREATE OR REPLACE FUNCTION stocky_dispatch_ready_shop_maintain() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  target_shop text;
  earliest timestamp(3);
  shop_enabled boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_shop := OLD."shopId";
  ELSE
    target_shop := NEW."shopId";
  END IF;

  SELECT MIN(j."nextEligibleAt") INTO earliest
  FROM public."DurableJob" j
  WHERE j."shopId" = target_shop
    AND j.state IN ('PENDING', 'RETRY_WAIT');

  IF earliest IS NULL THEN
    DELETE FROM public."DispatchReadyShop" WHERE "shopId" = target_shop;
  ELSE
    SELECT s."processingEnabled" INTO shop_enabled
    FROM public."Shop" s WHERE s.id = target_shop;
    IF shop_enabled IS NULL THEN
      shop_enabled := false;
    END IF;

    INSERT INTO public."DispatchReadyShop" (
      "shopId", "earliestEligibleAt", "lastServedAt", "processingEnabled",
      "createdAt", "updatedAt"
    ) VALUES (
      target_shop, earliest, NULL, shop_enabled,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("shopId") DO UPDATE SET
      "earliestEligibleAt" = EXCLUDED."earliestEligibleAt",
      "processingEnabled" = EXCLUDED."processingEnabled",
      "updatedAt" = CURRENT_TIMESTAMP;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stocky_dispatch_ready_shop_maintain_trg ON "DurableJob";
CREATE TRIGGER stocky_dispatch_ready_shop_maintain_trg
  AFTER INSERT OR DELETE OR UPDATE OF "state", "nextEligibleAt", "shopId"
  ON "DurableJob"
  FOR EACH ROW
  EXECUTE FUNCTION stocky_dispatch_ready_shop_maintain();

-- Keep denormalized processingEnabled in sync with Shop lifecycle.
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

-- Backfill from existing eligible work (including future-due).
INSERT INTO "DispatchReadyShop" (
  "shopId", "earliestEligibleAt", "lastServedAt", "processingEnabled",
  "createdAt", "updatedAt"
)
SELECT
  j."shopId",
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
  "earliestEligibleAt" = EXCLUDED."earliestEligibleAt",
  "processingEnabled" = EXCLUDED."processingEnabled",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Control-plane RLS + grants (same pattern as other platform_control_plane tables).
ALTER TABLE "DispatchReadyShop" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DispatchReadyShop" FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stocky_control_plane') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'DispatchReadyShop'
        AND policyname = 'DispatchReadyShop_control_plane_all'
    ) THEN
      CREATE POLICY "DispatchReadyShop_control_plane_all"
        ON "DispatchReadyShop"
        FOR ALL TO stocky_control_plane
        USING (true) WITH CHECK (true);
    END IF;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "DispatchReadyShop" TO stocky_control_plane;
  END IF;
END $$;
