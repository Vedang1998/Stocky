-- Phase 1 PR 4 second correction (D-044 / NEW-PR4-C01 / NEW-PR4-C08)
-- Additive only. Empty-DB and upgrade-from-0697a287 compatible. Repeat deploy no-op.

-- ─── NEW-PR4-C01: stranded ENQUEUED recovery legal edge ──────────────────────
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
    ('ENQUEUED', 'RETRY_WAIT'),
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

COMMENT ON FUNCTION stocky_durable_job_transition_guard() IS
  'D-044: legal DurableJob transitions including ENQUEUED→RETRY_WAIT stranded-dispatch recovery';

-- Index supporting stranded-ENQUEUED recovery scans (age + unfinished attempt absence).
CREATE INDEX IF NOT EXISTS "DurableJob_stranded_enqueued_idx"
  ON "DurableJob" ("enqueuedAt")
  WHERE state = 'ENQUEUED';

-- ─── NEW-PR4-C08: revoke EXECUTE until restricted owner is provisioned ───────
-- Function body remains; ownership transfer + least-privilege grants are applied
-- by sync:roles:provision. Until then, stocky_control_plane must not EXECUTE a
-- superuser-owned SECURITY DEFINER probe.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'stocky_has_application_receipt'
      AND pg_get_function_identity_arguments(p.oid) = 'text, text'
  ) THEN
    REVOKE ALL ON FUNCTION public.stocky_has_application_receipt(text, text) FROM PUBLIC;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stocky_control_plane') THEN
      REVOKE ALL ON FUNCTION public.stocky_has_application_receipt(text, text)
        FROM stocky_control_plane;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stocky_runtime') THEN
      REVOKE ALL ON FUNCTION public.stocky_has_application_receipt(text, text)
        FROM stocky_runtime;
    END IF;
  END IF;
END $$;
