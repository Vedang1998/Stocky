-- PR7 dispatcher / §7.9 ForShop path: migrate-only catalogs must expose
-- stocky_shop_canonical_domain. Additive. Does not rewrite
-- 20261004180000_pr7_participating_write_guard.
-- Empty namespace remains writable. Production ownership, extra principal
-- GRANTs, and FORCE RLS remain tenant-enforcement apply (CREATE OR REPLACE).
-- Recovery: unused function may remain until a separately authorized reverse
-- migration.

SET lock_timeout = '5s';
SET statement_timeout = '120s';

CREATE OR REPLACE FUNCTION public.stocky_shop_canonical_domain(
  p_shop_id text,
  p_declared_domain text
) RETURNS text
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_domain text;
  n int;
BEGIN
  IF p_shop_id IS NULL OR p_shop_id = '' THEN
    RAISE EXCEPTION 'customer_write_namespace_missing' USING ERRCODE = 'P0001';
  END IF;
  SELECT COUNT(DISTINCT d.domain), MIN(d.domain) INTO n, v_domain
  FROM (
    SELECT g."canonicalDomain" AS domain
    FROM public."ShopInstallGeneration" g
    WHERE g."targetShopId" = p_shop_id OR g."shopRowId" = p_shop_id
    UNION
    SELECT s."myshopifyDomain"
    FROM public."Shop" s
    WHERE s.id = p_shop_id
  ) d;
  IF n = 0 OR v_domain IS NULL THEN
    RAISE EXCEPTION 'customer_write_namespace_missing' USING ERRCODE = 'P0001';
  END IF;
  IF n > 1 THEN
    RAISE EXCEPTION 'customer_write_namespace_ambiguous' USING ERRCODE = 'P0001';
  END IF;
  IF p_declared_domain IS NOT NULL AND p_declared_domain IS DISTINCT FROM v_domain THEN
    RAISE EXCEPTION 'customer_write_namespace_mismatch' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_domain;
END;
$$;

REVOKE ALL ON FUNCTION public.stocky_shop_canonical_domain(text, text) FROM PUBLIC;

-- 20261004180000 revoked PUBLIC execute on the participating-write trio and
-- did not GRANT stocky_control_plane. Dispatcher uses that role in CI.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stocky_runtime') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.stocky_shop_canonical_domain(text, text) TO stocky_runtime';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.stocky_participating_write_guard(text) TO stocky_runtime';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.stocky_generation_writable(text) TO stocky_runtime';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.stocky_lifecycle_shared_lock(text) TO stocky_runtime';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stocky_control_plane') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.stocky_shop_canonical_domain(text, text) TO stocky_control_plane';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.stocky_participating_write_guard(text) TO stocky_control_plane';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.stocky_generation_writable(text) TO stocky_control_plane';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.stocky_lifecycle_shared_lock(text) TO stocky_control_plane';
  END IF;
END $$;
