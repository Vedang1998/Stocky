-- PR7 participating-write guard helpers required by TenantDb / §7.9 hosts.
-- Additive. Empty namespace remains writable (no ERASING/FINALIZING generation).
-- Production role ownership, PUBLIC revoke refresh, and FORCE RLS remain
-- tenant-enforcement apply (CREATE OR REPLACE). Recovery: unused functions may
-- remain until a separately authorized reverse migration.

SET lock_timeout = '5s';
SET statement_timeout = '120s';

CREATE OR REPLACE FUNCTION public.stocky_lifecycle_lock_key(p_canonical_domain text)
RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$ SELECT hashtext('pr7-life-v1:' || p_canonical_domain); $$;

CREATE OR REPLACE FUNCTION public.stocky_lifecycle_shared_lock(p_canonical_domain text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock_shared(1347573553, public.stocky_lifecycle_lock_key(p_canonical_domain));
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_lifecycle_exclusive_lock(p_canonical_domain text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(1347573553, public.stocky_lifecycle_lock_key(p_canonical_domain));
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_generation_writable(p_canonical_domain text)
RETURNS boolean
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public."ShopInstallGeneration"
    WHERE "canonicalDomain" = p_canonical_domain
      AND fence IN ('ERASING','FINALIZING')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_participating_write_guard(p_canonical_domain text)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM public.stocky_lifecycle_shared_lock(p_canonical_domain);
  IF NOT public.stocky_generation_writable(p_canonical_domain) THEN
    RAISE EXCEPTION 'generation_frozen' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.stocky_lifecycle_lock_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_lifecycle_shared_lock(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_lifecycle_exclusive_lock(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_generation_writable(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_participating_write_guard(text) FROM PUBLIC;
