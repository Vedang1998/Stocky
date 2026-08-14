-- D-044 / NEW-PR4-C08 follow-up: revoke EXECUTE using oidvectortypes matching.
-- PostgreSQL returns named identity args (p_shop_id text, …); the prior
-- second-correction REVOKE filter used bare 'text, text' and could no-op.
-- Additive. Empty-DB and upgrade compatible. Repeat deploy no-op.
-- Ownership transfer remains the responsibility of sync:roles:provision.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'stocky_has_application_receipt'
      AND oidvectortypes(p.proargtypes) = 'text, text'
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

COMMENT ON FUNCTION public.stocky_has_application_receipt(text, text) IS
  'D-044: existence-only receipt probe. EXECUTE revoked until sync:roles:provision transfers ownership to stocky_receipt_probe_owner and re-grants stocky_control_plane.';
