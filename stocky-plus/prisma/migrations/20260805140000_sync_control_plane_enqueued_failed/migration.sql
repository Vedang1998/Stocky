-- Phase 1 PR 4 D-044 NEW-PR4-C01 mechanical completion
-- Additive: legal ENQUEUED → FAILED for stranded non-retryable / exhausted jobs.
-- Does not edit prior migrations. Empty-DB and upgrade compatible. Repeat deploy no-op.

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
  BEFORE UPDATE OF "state" ON "DurableJob"
  FOR EACH ROW
  EXECUTE FUNCTION stocky_durable_job_transition_guard();

REVOKE ALL ON FUNCTION stocky_durable_job_transition_guard() FROM PUBLIC;

COMMENT ON FUNCTION stocky_durable_job_transition_guard() IS
  'D-044: legal DurableJob transitions including ENQUEUED→RETRY_WAIT and ENQUEUED→FAILED stranded recovery';
