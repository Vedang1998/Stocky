-- Phase 1 PR 3 — tenant enforcement helpers (transaction-safe).
--
-- Creates fail-closed tenant-context helper functions and the shopId
-- immutability trigger function. RLS policies, FORCE RLS, NOT NULL promotion,
-- composite keys/FKs, and role grants are applied by external low-lock tooling:
--   npm run tenant:enforcement:apply -- --apply
--
-- D-024 pattern: do not create CONCURRENTLY indexes or VALIDATE CONSTRAINT
-- inside Prisma Migrate transactions.
-- Production execution of enforcement apply is NOT authorized by PR 3.

CREATE OR REPLACE FUNCTION stocky_current_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT NULLIF(current_setting('stocky.current_shop_id', true), '');
$$;

CREATE OR REPLACE FUNCTION stocky_current_tenant_context_version()
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT NULLIF(current_setting('stocky.tenant_context_version', true), '');
$$;

CREATE OR REPLACE FUNCTION stocky_prevent_shop_id_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW."shopId" IS DISTINCT FROM OLD."shopId" THEN
    RAISE EXCEPTION 'stocky_tenant_key_immutable: shopId cannot be changed'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- Prisma Postgres uses a restricted superuser that cannot REVOKE.
-- On ordinary PostgreSQL these REVOKEs still apply; on Prisma Postgres they
-- are skipped so migrate/shadow-DB apply can succeed.
DO $$
BEGIN
  BEGIN
    REVOKE ALL ON FUNCTION stocky_current_tenant_id() FROM PUBLIC;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
  BEGIN
    REVOKE ALL ON FUNCTION stocky_current_tenant_context_version() FROM PUBLIC;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
  BEGIN
    REVOKE ALL ON FUNCTION stocky_prevent_shop_id_mutation() FROM PUBLIC;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END $$;
