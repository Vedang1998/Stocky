-- PR45 / PR7 disposable PostgreSQL 16 feasibility contract (GW-01/GW-02 / X inventory)
-- TA-01 durable origin binding / TA-02 labeled candidates digest.
-- Transcribed from the proposed final planning contract. Isolated owner: pr45owner.
-- AO-02: host computes pr7-effect-v1 from the frozen write snapshot; no p_actual_digest.
-- AO-03: sight WEBHOOK/PARENT_LINEAGE/MANUAL_REPLAY; key (canonicalDomain, source digest).
-- AO-04: stocky.trusted_work_id is an untrusted locator; host revalidates.
-- AO-05: capture unique (canonicalDomain, commandId); surrogate sha256(domain||NUL||commandId).
-- RE-01: consume/effect re-read uncorrelated non-fresh sightings; eligibility is separate from capture history.
-- RE-02: pr7-source-v1 is distinct from pr7-effect-v1; generated ids are not source identity.
-- search_path locked on every SECURITY DEFINER function. NO hidden GRANT.
-- PUBLIC EXECUTE revoked. No BYPASSRLS. FORCE RLS on merchant tables.

-- PR45 / PR7 disposable PostgreSQL 16 feasibility contract
-- Transcribed from the proposed final planning contract.
-- Isolated owner: pr45owner (setup only). Permission probes use named roles.
-- search_path locked on every SECURITY DEFINER function.
-- NO hidden GRANT. PUBLIC EXECUTE revoked. No BYPASSRLS. FORCE RLS on merchant tables.


-- roles provisioned by tenant-enforcement pr7PrivacyRolesSql()

-- ---------------------------------------------------------------------------
-- V-faithful helpers (names from scripts/tenant-enforcement/manifest.ts + sql.ts)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stocky_current_tenant_id()
RETURNS text
LANGUAGE sql STABLE PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$ SELECT NULLIF(current_setting('stocky.current_shop_id', true), ''); $$;

CREATE OR REPLACE FUNCTION public.stocky_current_tenant_context_version()
RETURNS text
LANGUAGE sql STABLE PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$ SELECT NULLIF(current_setting('stocky.tenant_context_version', true), ''); $$;

REVOKE ALL ON FUNCTION public.stocky_current_tenant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_current_tenant_context_version() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.stocky_current_tenant_id() TO stocky_runtime;
GRANT EXECUTE ON FUNCTION public.stocky_current_tenant_context_version() TO stocky_runtime;

-- Privacy principals get tenant + version helpers, NOT processing_enabled.
GRANT EXECUTE ON FUNCTION public.stocky_current_tenant_id() TO stocky_privacy_reader, stocky_privacy_erasure, stocky_privacy_target_owner, stocky_privacy_capability_owner, stocky_assignment_verifier_owner, stocky_lifecycle_gate_owner, stocky_privacy_finalizer_owner, stocky_control_plane;
GRANT EXECUTE ON FUNCTION public.stocky_current_tenant_context_version() TO stocky_privacy_reader, stocky_privacy_erasure, stocky_privacy_target_owner, stocky_privacy_capability_owner, stocky_assignment_verifier_owner, stocky_lifecycle_gate_owner, stocky_privacy_finalizer_owner, stocky_control_plane;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.stocky_shop_processing_enabled(p_shop_id text)
RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT s."processingEnabled" FROM public."Shop" s WHERE s.id = p_shop_id),
    false
  );
$$;
REVOKE ALL ON FUNCTION public.stocky_shop_processing_enabled(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_shop_processing_enabled(text) TO stocky_runtime;


















-- Target-scoped customer-erasure barrier. Keys are shop/generation + customer/order
-- identities ordinary writers can compute. Not keyed by privacy request id.

-- Minimized post-completion suppression for queued/replayed pre-erasure payloads.
-- Not lifetime suppression of legitimate later customer data (Q-008 OPEN).









-- TA-01 protected WriterAdmissionOrigin (proposed disposable contract only)


ALTER TABLE public."WriterAdmissionOrigin" OWNER TO stocky_admission_origin_owner;
ALTER TABLE public."WriterAdmissionOriginTarget" OWNER TO stocky_admission_origin_owner;
ALTER TABLE public."WriterAdmissionOrigin" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WriterAdmissionOrigin" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."WriterAdmissionOriginTarget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WriterAdmissionOriginTarget" FORCE ROW LEVEL SECURITY;

CREATE POLICY writer_admission_owner_all ON public."WriterAdmissionOrigin"
  FOR ALL TO stocky_admission_origin_owner
  USING (true) WITH CHECK (true);
CREATE POLICY writer_admission_gate_select ON public."WriterAdmissionOrigin"
  FOR SELECT TO stocky_lifecycle_gate_owner
  USING (true);
CREATE POLICY writer_admission_target_owner_all ON public."WriterAdmissionOriginTarget"
  FOR ALL TO stocky_admission_origin_owner
  USING (true) WITH CHECK (true);
CREATE POLICY writer_admission_target_gate_select ON public."WriterAdmissionOriginTarget"
  FOR SELECT TO stocky_lifecycle_gate_owner
  USING (true);

REVOKE ALL ON public."WriterAdmissionOrigin" FROM PUBLIC;
REVOKE ALL ON public."WriterAdmissionOriginTarget" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public."WriterAdmissionOrigin" TO stocky_admission_origin_owner;
GRANT SELECT, INSERT, DELETE ON public."WriterAdmissionOriginTarget" TO stocky_admission_origin_owner;
GRANT SELECT ON public."WriterAdmissionOrigin", public."WriterAdmissionOriginTarget" TO stocky_lifecycle_gate_owner;
GRANT SELECT ON public."Shop", public."ShopInstallGeneration", public."DurableJob" TO stocky_admission_origin_owner;

-- DO-01 authenticated original-admin capture (proposed disposable contract).
-- Not a second general auth subsystem. PostgreSQL does not verify Shopify tokens.
ALTER TABLE public."OriginalAdminSession" OWNER TO stocky_admission_origin_owner;
ALTER TABLE public."OriginalAdminCapture" OWNER TO stocky_admission_origin_owner;
ALTER TABLE public."QueuedWorkSighting" OWNER TO stocky_admission_origin_owner;
ALTER TABLE public."SourceEffectLink" OWNER TO stocky_lifecycle_gate_owner;
ALTER TABLE public."OriginalAdminSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OriginalAdminSession" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."OriginalAdminCapture" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OriginalAdminCapture" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."QueuedWorkSighting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."QueuedWorkSighting" FORCE ROW LEVEL SECURITY;
CREATE POLICY original_admin_session_owner_all ON public."OriginalAdminSession"
  FOR ALL TO stocky_admission_origin_owner USING (true) WITH CHECK (true);
CREATE POLICY original_admin_capture_owner_all ON public."OriginalAdminCapture"
  FOR ALL TO stocky_admission_origin_owner USING (true) WITH CHECK (true);
CREATE POLICY queued_work_sighting_owner_all ON public."QueuedWorkSighting"
  FOR ALL TO stocky_admission_origin_owner USING (true) WITH CHECK (true);
CREATE POLICY queued_work_sighting_gate_select ON public."QueuedWorkSighting"
  FOR SELECT TO stocky_lifecycle_gate_owner USING (true);
CREATE POLICY original_admin_capture_gate_select ON public."OriginalAdminCapture"
  FOR SELECT TO stocky_lifecycle_gate_owner USING (true);
ALTER TABLE public."SourceEffectLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SourceEffectLink" FORCE ROW LEVEL SECURITY;
CREATE POLICY source_effect_link_gate_all ON public."SourceEffectLink"
  FOR ALL TO stocky_lifecycle_gate_owner USING (true) WITH CHECK (true);
REVOKE ALL ON public."OriginalAdminSession" FROM PUBLIC;
REVOKE ALL ON public."OriginalAdminCapture" FROM PUBLIC;
REVOKE ALL ON public."QueuedWorkSighting" FROM PUBLIC;
REVOKE ALL ON public."SourceEffectLink" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public."OriginalAdminSession" TO stocky_admission_origin_owner;
GRANT SELECT, INSERT, UPDATE ON public."OriginalAdminCapture" TO stocky_admission_origin_owner;
GRANT SELECT, INSERT, UPDATE ON public."QueuedWorkSighting" TO stocky_admission_origin_owner;
GRANT SELECT ON public."OriginalAdminCapture" TO stocky_lifecycle_gate_owner;
GRANT SELECT ON public."QueuedWorkSighting" TO stocky_lifecycle_gate_owner;
GRANT SELECT, INSERT, UPDATE ON public."SourceEffectLink" TO stocky_lifecycle_gate_owner;

-- AO-03: serialize capture against non-fresh provenance on (canonicalDomain, source digest).
-- Namespace 1347573587 = ASCII 'PR7S'. Taken after the lifecycle shared lock.
CREATE OR REPLACE FUNCTION public.stocky_source_content_lock(
  p_canonical_domain text,
  p_source_content_digest text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF p_canonical_domain IS NULL OR p_canonical_domain = ''
     OR p_source_content_digest IS NULL OR p_source_content_digest = '' THEN
    RAISE EXCEPTION 'admission_identity_required' USING ERRCODE = 'P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(
    1347573587,
    hashtext('pr7-src-v1:' || p_canonical_domain || E'\n' || p_source_content_digest)
  );
END;
$$;
ALTER FUNCTION public.stocky_source_content_lock(text, text) OWNER TO stocky_admission_origin_owner;
REVOKE ALL ON FUNCTION public.stocky_source_content_lock(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_source_content_lock(text, text) TO stocky_lifecycle_gate_owner;

-- RE-02: source identity excludes generated work/command/effect/retry ids.
CREATE OR REPLACE FUNCTION public.stocky_source_commitment(
  p_canonical_domain text,
  p_shop_id text,
  p_operation text,
  p_kind text,
  p_value text,
  p_source_body text
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  -- PostgreSQL text cannot contain NUL; omitted/NULL inputs are STRICT-rejected.
  -- Empty source_body is the canonical omitted-content encoding.
  RETURN encode(
    sha256(convert_to(
      'pr7-source-v1' || E'\n' ||
      p_canonical_domain || E'\n' ||
      p_shop_id || E'\n' ||
      p_operation || E'\n' ||
      p_kind || E'\n' ||
      p_value || E'\n' ||
      p_source_body,
      'UTF8'
    )),
    'hex'
  );
END;
$$;
ALTER FUNCTION public.stocky_source_commitment(text, text, text, text, text, text) OWNER TO stocky_lifecycle_gate_owner;
REVOKE ALL ON FUNCTION public.stocky_source_commitment(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_source_commitment(text, text, text, text, text, text) TO stocky_runtime, stocky_control_plane, stocky_original_admission, stocky_admin_capture, stocky_admission_origin_owner;

-- RE-01: uncorrelated non-fresh evidence invalidates capture *eligibility* without erasing capture history.
CREATE OR REPLACE FUNCTION public.stocky_mark_uncorrelated_captures_contradicted(
  p_canonical_domain text,
  p_source_content_digest text,
  p_class text,
  p_correlated_capture_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF p_canonical_domain IS NULL OR p_canonical_domain = ''
     OR p_source_content_digest IS NULL OR p_source_content_digest = '' THEN
    RAISE EXCEPTION 'admission_identity_required' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public."OriginalAdminCapture"
     SET "contradictedAt" = COALESCE("contradictedAt", clock_timestamp()),
         "contradictionClass" = COALESCE("contradictionClass", p_class)
   WHERE "canonicalDomain" = p_canonical_domain
     AND "sourceContentDigest" = p_source_content_digest
     AND (p_correlated_capture_id IS NULL OR id IS DISTINCT FROM p_correlated_capture_id);
END;
$$;
ALTER FUNCTION public.stocky_mark_uncorrelated_captures_contradicted(text, text, text, text) OWNER TO stocky_admission_origin_owner;
REVOKE ALL ON FUNCTION public.stocky_mark_uncorrelated_captures_contradicted(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_mark_uncorrelated_captures_contradicted(text, text, text, text)
  TO stocky_original_admission, stocky_control_plane, stocky_lifecycle_gate_owner;

CREATE OR REPLACE FUNCTION public.stocky_admin_source_contradicted(
  p_canonical_domain text,
  p_source_content_digest text,
  p_capture_id text
) RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT COALESCE((
    SELECT true FROM public."OriginalAdminCapture" c
     WHERE c.id = p_capture_id
       AND c."contradictedAt" IS NOT NULL
     LIMIT 1
  ), (
    SELECT true FROM public."QueuedWorkSighting" q
     WHERE q."canonicalDomain" = p_canonical_domain
       AND q."sourceContentDigest" = p_source_content_digest
       AND (q."correlatedCaptureId" IS NULL
            OR q."correlatedCaptureId" IS DISTINCT FROM p_capture_id)
     LIMIT 1
  ), false);
$$;
ALTER FUNCTION public.stocky_admin_source_contradicted(text, text, text) OWNER TO stocky_admission_origin_owner;
REVOKE ALL ON FUNCTION public.stocky_admin_source_contradicted(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_admin_source_contradicted(text, text, text)
  TO stocky_original_admission, stocky_lifecycle_gate_owner, stocky_control_plane;

CREATE OR REPLACE FUNCTION public.stocky_record_writer_admission(
  p_canonical_domain text,
  p_shop_id text,
  p_work_id text,
  p_source_kind text,
  p_source_identity text,
  p_source_content_digest text,
  p_format_policy_version text,
  p_original_admitted_at timestamptz,
  p_evidence_class text,
  p_target_kind text,
  p_target_value text,
  p_parent_work_id text DEFAULT NULL,
  p_durable_job_id text DEFAULT NULL,
  p_link_mode text DEFAULT 'ATOMIC'
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_domain text;
  live_n int;
  live_id text;
  existing public."WriterAdmissionOrigin"%ROWTYPE;
  parent public."WriterAdmissionOrigin"%ROWTYPE;
  v_origin text;
  v_status text;
  v_id text;
  v_mode text;
  cap public."OriginalAdminCapture"%ROWTYPE;
  inst_at timestamptz;
  v_admitted_at timestamptz;
  v_capture_id text;
  v_corr text;
BEGIN
  IF session_user IS DISTINCT FROM 'stocky_original_admission' THEN
    RAISE EXCEPTION 'admission_principal_required' USING ERRCODE = '42501';
  END IF;
  IF p_work_id IS NULL OR p_work_id = '' OR p_source_identity IS NULL OR p_source_identity = ''
     OR p_source_content_digest IS NULL OR p_source_content_digest = '' THEN
    RAISE EXCEPTION 'admission_identity_required' USING ERRCODE = 'P0001';
  END IF;
  v_mode := COALESCE(NULLIF(p_link_mode, ''), 'ATOMIC');
  IF v_mode NOT IN ('ATOMIC', 'BEGIN') THEN
    RAISE EXCEPTION 'admission_link_mode_invalid' USING ERRCODE = 'P0001';
  END IF;
  v_domain := public.stocky_shop_canonical_domain(p_shop_id, p_canonical_domain);
  PERFORM public.stocky_lifecycle_shared_lock(v_domain);
  IF p_target_kind IS NOT NULL AND p_target_value IS NOT NULL THEN
    PERFORM public.stocky_customer_target_lock_shared(v_domain, p_target_kind, p_target_value);
  END IF;
  PERFORM public.stocky_source_content_lock(v_domain, p_source_content_digest);

  -- Re-read LIVE generation AFTER locks. Historical rows are not the current install.
  SELECT count(*), min(id)
    INTO live_n, live_id
  FROM public."ShopInstallGeneration"
  WHERE "canonicalDomain" = v_domain
    AND fence = 'LIVE';

  SELECT * INTO existing
  FROM public."WriterAdmissionOrigin"
  WHERE "canonicalDomain" = v_domain
    AND "sourceKind" = p_source_kind
    AND "sourceIdentity" = p_source_identity
    AND "sourceContentDigest" = p_source_content_digest;
  IF FOUND THEN
    IF existing."workId" IS DISTINCT FROM p_work_id AND existing."workId" IS NOT NULL THEN
      -- same source+digest: retry/coalesce; do not remint
      NULL;
    END IF;
    -- Duplicate-return is not a freshness grant. ADMIN eligibility is re-checked below
    -- when this path is skipped (no row yet) and at the effect host for consumed rows.
    IF p_evidence_class = 'ADMIN_SESSION_CURRENT_INSTALL'
       AND existing."originalCaptureId" IS NOT NULL
       AND public.stocky_admin_source_contradicted(v_domain, p_source_content_digest, existing."originalCaptureId") THEN
      RAISE EXCEPTION 'capture_content_no_longer_fresh' USING ERRCODE = 'P0001';
    END IF;
    RETURN existing.id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public."WriterAdmissionOrigin"
    WHERE "canonicalDomain" = v_domain
      AND "sourceKind" = p_source_kind
      AND "sourceIdentity" = p_source_identity
      AND "sourceContentDigest" IS DISTINCT FROM p_source_content_digest
  ) THEN
    RAISE EXCEPTION 'admission_binding_conflict' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public."WriterAdmissionOrigin"
    WHERE "canonicalDomain" = v_domain AND "workId" = p_work_id
  ) THEN
    RAISE EXCEPTION 'admission_work_conflict' USING ERRCODE = 'P0001';
  END IF;

  -- RE-01: a contradicted ADMIN capture is refused before digest_conflict, so
  -- consume of the issued capture is not closed merely by a competing root.
  IF p_evidence_class = 'ADMIN_SESSION_CURRENT_INSTALL' THEN
    SELECT * INTO cap
    FROM public."OriginalAdminCapture"
    WHERE "canonicalDomain" = v_domain
      AND "shopId" = p_shop_id
      AND "sourceKind" = p_source_kind
      AND "sourceIdentity" = p_source_identity
      AND "sourceContentDigest" = p_source_content_digest;
    IF FOUND AND (
         cap."contradictedAt" IS NOT NULL
         OR public.stocky_admin_source_contradicted(v_domain, p_source_content_digest, cap.id)
       ) THEN
      PERFORM public.stocky_mark_uncorrelated_captures_contradicted(
        v_domain, p_source_content_digest, 'CONSUME_RECHECK', NULL);
      RAISE EXCEPTION 'capture_content_no_longer_fresh' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF p_parent_work_id IS NULL AND EXISTS (
    SELECT 1 FROM public."WriterAdmissionOrigin"
    WHERE "canonicalDomain" = v_domain
      AND "sourceContentDigest" = p_source_content_digest
      AND "parentWorkId" IS NULL
  ) THEN
    RAISE EXCEPTION 'admission_digest_conflict' USING ERRCODE = 'P0001';
  END IF;

  v_admitted_at := p_original_admitted_at;
  IF p_evidence_class = 'ADMIN_SESSION_CURRENT_INSTALL' THEN
    IF live_n <> 1 OR live_id IS NULL THEN
      RAISE EXCEPTION 'admission_generation_ambiguous' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO cap
    FROM public."OriginalAdminCapture"
    WHERE "canonicalDomain" = v_domain
      AND "shopId" = p_shop_id
      AND "sourceKind" = p_source_kind
      AND "sourceIdentity" = p_source_identity
      AND "sourceContentDigest" = p_source_content_digest;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'admission_admin_capture_required' USING ERRCODE = 'P0001';
    END IF;
    IF cap."capturedAt" IS NULL
       OR cap."capturedAt" = '-infinity'::timestamptz
       OR cap."capturedAt" = 'infinity'::timestamptz THEN
      RAISE EXCEPTION 'admission_capture_time_invalid' USING ERRCODE = 'P0001';
    END IF;
    IF cap."capturedAt" > clock_timestamp() THEN
      RAISE EXCEPTION 'admission_capture_time_future' USING ERRCODE = 'P0001';
    END IF;
    IF cap."liveGenerationId" IS DISTINCT FROM live_id THEN
      RAISE EXCEPTION 'admission_capture_epoch_mismatch' USING ERRCODE = 'P0001';
    END IF;
    SELECT g."installedAt" INTO inst_at
    FROM public."ShopInstallGeneration" g
    WHERE g.id = live_id;
    IF inst_at IS NULL OR cap."capturedAt" < inst_at THEN
      RAISE EXCEPTION 'admission_capture_before_install' USING ERRCODE = 'P0001';
    END IF;
    IF (cap."targetKind" IS NOT NULL AND cap."targetKind" IS DISTINCT FROM p_target_kind)
       OR (cap."targetValue" IS NOT NULL AND cap."targetValue" IS DISTINCT FROM p_target_value) THEN
      RAISE EXCEPTION 'admission_capture_target_mismatch' USING ERRCODE = 'P0001';
    END IF;
    IF cap."boundWorkId" IS NOT NULL AND cap."boundWorkId" IS DISTINCT FROM p_work_id THEN
      RAISE EXCEPTION 'admission_capture_consumed' USING ERRCODE = 'P0001';
    END IF;
    -- RE-01: re-read current source-provenance before consuming an already-issued capture.
    IF public.stocky_admin_source_contradicted(v_domain, p_source_content_digest, cap.id)
       OR cap."contradictedAt" IS NOT NULL THEN
      PERFORM public.stocky_mark_uncorrelated_captures_contradicted(
        v_domain, p_source_content_digest, 'CONSUME_RECHECK', NULL);
      RAISE EXCEPTION 'capture_content_no_longer_fresh' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public."OriginalAdminCapture"
      SET "consumedAt" = clock_timestamp(),
          "boundWorkId" = p_work_id
      WHERE id = cap.id
        AND ("boundWorkId" IS NULL OR "boundWorkId" = p_work_id)
        AND "contradictedAt" IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'capture_content_no_longer_fresh' USING ERRCODE = 'P0001';
    END IF;
    v_origin := live_id;
    v_admitted_at := cap."capturedAt";
    v_capture_id := cap.id;
    v_status := CASE WHEN v_mode = 'BEGIN' THEN 'PENDING_LINK' ELSE 'BOUND' END;
  ELSIF p_evidence_class = 'WEBHOOK_PROVIDER_AUTH' THEN
    -- HMAC proves shop/topic, not historical generation of delayed payload.
    v_origin := NULL;
    v_status := CASE WHEN v_mode = 'BEGIN' THEN 'PENDING_LINK' ELSE 'UNATTRIBUTED' END;
  ELSIF p_evidence_class IN ('PARENT_LINEAGE', 'MANUAL_REPLAY') THEN
    IF p_parent_work_id IS NULL OR p_parent_work_id = '' THEN
      RAISE EXCEPTION 'admission_parent_required' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO parent
    FROM public."WriterAdmissionOrigin"
    WHERE "canonicalDomain" = v_domain AND "workId" = p_parent_work_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'admission_parent_missing' USING ERRCODE = 'P0001';
    END IF;
    IF parent."shopId" IS DISTINCT FROM p_shop_id THEN
      RAISE EXCEPTION 'admission_parent_tenant_mismatch' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public."WriterAdmissionOrigin" o
      WHERE o."canonicalDomain" = v_domain
        AND o."sourceContentDigest" = p_source_content_digest
        AND o."parentWorkId" IS NULL
        AND o."workId" IS DISTINCT FROM p_parent_work_id
    ) THEN
      RAISE EXCEPTION 'admission_digest_conflict' USING ERRCODE = 'P0001';
    END IF;
    v_origin := parent."originGenerationId";
    v_status := CASE
      WHEN parent."originStatus" = 'BOUND' AND v_origin IS NOT NULL
           AND p_source_content_digest IS NOT DISTINCT FROM parent."sourceContentDigest" THEN
        CASE WHEN v_mode = 'BEGIN' THEN 'PENDING_LINK' ELSE 'BOUND' END
      ELSE 'UNATTRIBUTED'
    END;
    IF p_evidence_class = 'MANUAL_REPLAY' AND v_origin IS NULL THEN
      v_status := 'UNATTRIBUTED';
    END IF;
  ELSE
    RAISE EXCEPTION 'admission_evidence_unknown' USING ERRCODE = 'P0001';
  END IF;

  v_id := 'wao_' || replace(p_work_id, '-', '_');
  INSERT INTO public."WriterAdmissionOrigin"(
    id, "canonicalDomain", "shopId", "workId", "sourceKind", "sourceIdentity",
    "originalAdmissionId", "originalAdmittedAt", "formatPolicyVersion", "sourceContentDigest",
    "originGenerationId", "originStatus", "parentWorkId", "durableJobId", "acked"
  ) VALUES (
    v_id, v_domain, p_shop_id, p_work_id, p_source_kind, p_source_identity,
    v_id, v_admitted_at, COALESCE(NULLIF(p_format_policy_version,''), 'pr7-origin-v1'),
    p_source_content_digest, v_origin, v_status, NULLIF(p_parent_work_id,''), p_durable_job_id,
    (v_mode = 'ATOMIC')
  );
  IF v_capture_id IS NOT NULL THEN
    UPDATE public."WriterAdmissionOrigin" SET "originalCaptureId" = v_capture_id WHERE id = v_id;
  END IF;
  IF p_evidence_class IN ('WEBHOOK_PROVIDER_AUTH', 'PARENT_LINEAGE', 'MANUAL_REPLAY') THEN
    v_corr := NULL;
    IF p_evidence_class IN ('PARENT_LINEAGE', 'MANUAL_REPLAY') AND p_parent_work_id IS NOT NULL THEN
      -- Correlated only when the parent is the SAME accepted fresh command (BOUND + capture + same source).
      -- Uncorrelated historical content cannot manufacture that relationship.
      IF parent."originalCaptureId" IS NOT NULL
         AND parent."originStatus" = 'BOUND'
         AND parent."acked" IS TRUE
         AND parent."sourceContentDigest" IS NOT DISTINCT FROM p_source_content_digest THEN
        v_corr := parent."originalCaptureId";
      END IF;
    END IF;
    INSERT INTO public."QueuedWorkSighting"(
      "canonicalDomain","shopId","sourceKind","sourceIdentity","sourceContentDigest","sightedClass","sightedAt",
      "parentWorkId","correlatedCaptureId"
    ) VALUES (
      v_domain, p_shop_id, p_source_kind, p_source_identity, p_source_content_digest, p_evidence_class, clock_timestamp(),
      NULLIF(p_parent_work_id,''), v_corr
    ) ON CONFLICT DO NOTHING;
    PERFORM public.stocky_mark_uncorrelated_captures_contradicted(
      v_domain, p_source_content_digest, p_evidence_class, v_corr);
  END IF;

  IF p_target_kind IS NOT NULL AND p_target_value IS NOT NULL THEN
    INSERT INTO public."WriterAdmissionOriginTarget"("originId","targetKind","targetValue")
    VALUES (v_id, p_target_kind, p_target_value);
  END IF;

  IF p_durable_job_id IS NOT NULL AND p_durable_job_id <> '' THEN
    -- Link only. Admission does not mint DurableJob rows (intake remains control-plane).
    UPDATE public."WriterAdmissionOrigin" SET "durableJobId" = p_durable_job_id WHERE id = v_id;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_commit_writer_admission(p_work_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE r public."WriterAdmissionOrigin"%ROWTYPE; n int;
BEGIN
  IF session_user IS DISTINCT FROM 'stocky_original_admission' THEN
    RAISE EXCEPTION 'admission_principal_required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public."WriterAdmissionOrigin" WHERE "workId" = p_work_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'admission_missing' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.stocky_lifecycle_shared_lock(r."canonicalDomain");
  IF r."originStatus" = 'PENDING_LINK' THEN
    UPDATE public."WriterAdmissionOrigin"
      SET "originStatus" = CASE WHEN "originGenerationId" IS NULL THEN 'UNATTRIBUTED' ELSE 'BOUND' END,
          "acked" = true
      WHERE id = r.id AND "originStatus" = 'PENDING_LINK';
  ELSE
    UPDATE public."WriterAdmissionOrigin" SET "acked" = true WHERE id = r.id AND "acked" IS NOT TRUE;
  END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN r.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_recover_writer_admission(p_work_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE r public."WriterAdmissionOrigin"%ROWTYPE; has_job boolean;
BEGIN
  IF session_user IS DISTINCT FROM 'stocky_original_admission' THEN
    RAISE EXCEPTION 'admission_principal_required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public."WriterAdmissionOrigin" WHERE "workId" = p_work_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'admission_missing' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.stocky_lifecycle_shared_lock(r."canonicalDomain");
  has_job := EXISTS (SELECT 1 FROM public."DurableJob" j WHERE j.id = r."durableJobId");
  IF r."originStatus" = 'PENDING_LINK' AND has_job THEN
    RETURN public.stocky_commit_writer_admission(p_work_id);
  END IF;
  -- No job: leave pending. Consumers must not treat pending as trusted.
  RETURN r.id;
END;
$$;

ALTER FUNCTION public.stocky_record_writer_admission(text,text,text,text,text,text,text,timestamptz,text,text,text,text,text,text) OWNER TO stocky_admission_origin_owner;
ALTER FUNCTION public.stocky_commit_writer_admission(text) OWNER TO stocky_admission_origin_owner;
ALTER FUNCTION public.stocky_recover_writer_admission(text) OWNER TO stocky_admission_origin_owner;
REVOKE ALL ON FUNCTION public.stocky_record_writer_admission(text,text,text,text,text,text,text,timestamptz,text,text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_commit_writer_admission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_recover_writer_admission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_record_writer_admission(text,text,text,text,text,text,text,timestamptz,text,text,text,text,text,text) TO stocky_original_admission;
GRANT EXECUTE ON FUNCTION public.stocky_commit_writer_admission(text) TO stocky_original_admission;
GRANT EXECUTE ON FUNCTION public.stocky_recover_writer_admission(text) TO stocky_original_admission;
GRANT EXECUTE ON FUNCTION public.stocky_current_tenant_id() TO stocky_original_admission, stocky_admission_origin_owner;
GRANT EXECUTE ON FUNCTION public.stocky_current_tenant_context_version() TO stocky_original_admission, stocky_admission_origin_owner;
-- Remaining lock/canonical GRANTs are applied after those helpers exist (see patch_contract).




ALTER TABLE public."ShopRoleAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ShopRoleAssignment" FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Capability + row-manifest helpers (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stocky_privacy_capability_allows(p_op text, p_shop_id text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_req text := NULLIF(current_setting('stocky.privacy_request_id', true), '');
  v_att text := NULLIF(current_setting('stocky.privacy_attempt_id', true), '');
  r public."PrivacyRequest"%ROWTYPE;
  a public."PrivacyAttempt"%ROWTYPE;
  g public."ShopInstallGeneration"%ROWTYPE;
BEGIN
  IF v_req IS NULL OR v_att IS NULL OR p_shop_id IS NULL OR p_op IS NULL THEN
    RETURN false;
  END IF;
  SELECT * INTO r FROM public."PrivacyRequest" WHERE id = v_req;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO a FROM public."PrivacyAttempt" WHERE id = v_att;
  IF NOT FOUND THEN RETURN false; END IF;
  IF a."privacyRequestId" IS DISTINCT FROM r.id THEN RETURN false; END IF;
  IF r."activeAttemptId" IS DISTINCT FROM a.id THEN RETURN false; END IF;
  IF a.state NOT IN ('LEASED','RUNNING') THEN RETURN false; END IF;
  IF a."leaseUntil" IS NULL OR a."leaseUntil" <= clock_timestamp() THEN RETURN false; END IF;
  IF r."targetShopId" IS DISTINCT FROM p_shop_id THEN RETURN false; END IF;
  IF r.state NOT IN ('ENUMERATING','APPLYING','CHECKPOINTING','FINALIZING') THEN RETURN false; END IF;
  SELECT * INTO g FROM public."ShopInstallGeneration" WHERE id = r."generationId";
  IF NOT FOUND THEN RETURN false; END IF;
  IF g."targetShopId" IS DISTINCT FROM p_shop_id THEN RETURN false; END IF;

  IF r.topic = 'customers/data_request' THEN
    IF p_op <> 'READ' THEN RETURN false; END IF;
    RETURN g.fence IN ('LIVE','UNINSTALLED','ERASING','FINALIZING');
  ELSIF r.topic = 'customers/redact' THEN
    IF p_op NOT IN ('READ','DELETE_CUSTOMER') THEN RETURN false; END IF;
    -- Customer work is not whole-shop erasure. Concurrent shop erasure denies customer DELETE.
    RETURN g.fence IN ('LIVE','UNINSTALLED');
  ELSIF r.topic = 'shop/redact' THEN
    IF p_op NOT IN ('READ','DELETE_SHOP') THEN RETURN false; END IF;
    RETURN g.fence IN ('ERASING','FINALIZING');
  ELSE
    RETURN false;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_privacy_row_in_manifest(p_surface text, p_row_id text)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."PrivacyTargetKey" k
    WHERE k."requestId" = NULLIF(current_setting('stocky.privacy_request_id', true), '')
      AND k.surface = p_surface
      AND k."rowId" = p_row_id
      AND k."shopId" = public.stocky_current_tenant_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.stocky_privacy_publication_lock(p_request_id text)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF p_request_id IS NULL OR p_request_id = '' THEN
    RAISE EXCEPTION 'publication_lock_missing_request' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(1347573556, hashtext('pr7-pub-v1:' || p_request_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_privacy_live_attempt_ok(
  p_request_id text,
  p_attempt_id text
) RETURNS boolean
LANGUAGE plpgsql STABLE
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  r public."PrivacyRequest"%ROWTYPE;
  a public."PrivacyAttempt"%ROWTYPE;
BEGIN
  IF p_request_id IS NULL OR p_attempt_id IS NULL THEN
    RETURN false;
  END IF;
  SELECT * INTO r FROM public."PrivacyRequest" WHERE id = p_request_id;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO a FROM public."PrivacyAttempt" WHERE id = p_attempt_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF a."privacyRequestId" IS DISTINCT FROM r.id THEN RETURN false; END IF;
  IF r."activeAttemptId" IS DISTINCT FROM a.id THEN RETURN false; END IF;
  IF a.state NOT IN ('LEASED','RUNNING') THEN RETURN false; END IF;
  IF a."leaseUntil" IS NULL OR a."leaseUntil" <= clock_timestamp() THEN RETURN false; END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_privacy_enumerate_targets(p_request_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  r public."PrivacyRequest"%ROWTYPE;
  v_req text := NULLIF(current_setting('stocky.privacy_request_id', true), '');
  v_att text := NULLIF(current_setting('stocky.privacy_attempt_id', true), '');
  oid text;
  n int;
  missing int := 0;
  new_rev bigint;
BEGIN
  IF p_request_id IS DISTINCT FROM v_req THEN
    RAISE EXCEPTION 'enumerator_request_guc_mismatch' USING ERRCODE = '42501';
  END IF;

  -- Serialize against claim/takeover. Re-validate after the wait using clock_timestamp().
  PERFORM public.stocky_privacy_publication_lock(p_request_id);

  SELECT * INTO r FROM public."PrivacyRequest" WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'enumerator_request_missing' USING ERRCODE = '42501';
  END IF;
  IF v_att IS NULL OR NOT public.stocky_privacy_live_attempt_ok(r.id, v_att) THEN
    RAISE EXCEPTION 'enumerator_stale_attempt' USING ERRCODE = '42501';
  END IF;

  -- Conditional revision bump first. If this UPDATE matches 0 rows, leave keys
  -- and flags byte-identical (no check-then-act DELETE).
  UPDATE public."PrivacyRequest"
    SET "publicationRevision" = "publicationRevision" + 1
    WHERE id = r.id
      AND "activeAttemptId" = v_att
      AND state IN ('RECEIVED','AUTHENTICATED','ENUMERATING','APPLYING','CHECKPOINTING','FINALIZING')
    RETURNING "publicationRevision" INTO new_rev;
  IF new_rev IS NULL THEN
    RAISE EXCEPTION 'enumerator_stale_attempt' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public."PrivacyTargetKey" WHERE "requestId" = r.id;

  IF r.topic = 'shop/redact' THEN
    INSERT INTO public."PrivacyTargetKey"("requestId","shopId",surface,"rowId")
      SELECT r.id, r."targetShopId", 'ShopifyOrderFact', f.id
      FROM public."ShopifyOrderFact" f WHERE f."shopId" = r."targetShopId";
    INSERT INTO public."PrivacyTargetKey"("requestId","shopId",surface,"rowId")
      SELECT r.id, r."targetShopId", 'ShopifyOrderLineFact', l.id
      FROM public."ShopifyOrderLineFact" l WHERE l."shopId" = r."targetShopId";
    INSERT INTO public."PrivacyTargetKey"("requestId","shopId",surface,"rowId")
      SELECT r.id, r."targetShopId", 'AuditEvent', a.id
      FROM public."AuditEvent" a WHERE a."shopId" = r."targetShopId";
    UPDATE public."PrivacyRequest"
      SET "enumerationComplete" = true, "missingLinkages" = 0
      WHERE id = r.id AND "activeAttemptId" = v_att AND "publicationRevision" = new_rev;
    RETURN;
  END IF;

  -- Customer topics: only validated request order IDs + proven children + applicable audit.
  -- Caller cannot enlarge scope with arbitrary row IDs.
  FOREACH oid IN ARRAY COALESCE(r."lookupOrderLegacyIds", '{}')
  LOOP
    INSERT INTO public."PrivacyTargetKey"("requestId","shopId",surface,"rowId")
      SELECT r.id, r."targetShopId", 'ShopifyOrderFact', f.id
      FROM public."ShopifyOrderFact" f
      WHERE f."shopId" = r."targetShopId" AND f."shopifyLegacyResourceId" = oid;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      INSERT INTO public."PrivacyTargetKey"("requestId","shopId",surface,"rowId")
        SELECT r.id, r."targetShopId", 'ShopifyOrderLineFact', l.id
        FROM public."ShopifyOrderFact" f
        JOIN public."ShopifyOrderLineFact" l
          ON l."shopId" = f."shopId" AND l."shopifyOrderGid" = f."shopifyGid"
        WHERE f."shopId" = r."targetShopId" AND f."shopifyLegacyResourceId" = oid
        ON CONFLICT DO NOTHING;
    ELSE
      missing := missing + 1;
    END IF;
  END LOOP;

  IF r."lookupCustomerRestId" IS NOT NULL THEN
    INSERT INTO public."PrivacyTargetKey"("requestId","shopId",surface,"rowId")
      SELECT r.id, r."targetShopId", 'AuditEvent', a.id
      FROM public."AuditEvent" a
      WHERE a."shopId" = r."targetShopId" AND a."customerRestId" = r."lookupCustomerRestId";
  END IF;

  UPDATE public."PrivacyRequest"
    SET "enumerationComplete" = (missing = 0), "missingLinkages" = missing
    WHERE id = r.id AND "activeAttemptId" = v_att AND "publicationRevision" = new_rev;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'enumerator_stale_attempt' USING ERRCODE = '42501';
  END IF;
END;
$$;

ALTER FUNCTION public.stocky_privacy_capability_allows(text, text) OWNER TO stocky_privacy_capability_owner;
ALTER FUNCTION public.stocky_privacy_row_in_manifest(text, text) OWNER TO stocky_privacy_target_owner;
ALTER FUNCTION public.stocky_privacy_enumerate_targets(text) OWNER TO stocky_privacy_target_owner;

REVOKE ALL ON FUNCTION public.stocky_privacy_capability_allows(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_privacy_row_in_manifest(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_privacy_enumerate_targets(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_privacy_publication_lock(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_privacy_live_attempt_ok(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.stocky_privacy_capability_allows(text, text) TO stocky_privacy_reader, stocky_privacy_erasure;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_row_in_manifest(text, text) TO stocky_privacy_reader, stocky_privacy_erasure;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_enumerate_targets(text) TO stocky_privacy_reader, stocky_privacy_erasure, stocky_control_plane;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_publication_lock(text) TO stocky_privacy_reader, stocky_privacy_erasure, stocky_control_plane, stocky_privacy_target_owner;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_live_attempt_ok(text, text) TO stocky_privacy_reader, stocky_privacy_erasure, stocky_control_plane, stocky_privacy_target_owner;

GRANT SELECT ON public."PrivacyRequest", public."PrivacyAttempt", public."ShopInstallGeneration" TO stocky_privacy_capability_owner;
GRANT SELECT ON public."PrivacyRequest", public."PrivacyAttempt", public."PrivacyTargetKey", public."ShopInstallGeneration" TO stocky_privacy_target_owner;
GRANT SELECT ON public."ShopifyOrderFact", public."ShopifyOrderLineFact", public."AuditEvent" TO stocky_privacy_target_owner;
GRANT INSERT, DELETE ON public."PrivacyTargetKey" TO stocky_privacy_target_owner;
GRANT UPDATE ON public."PrivacyRequest" TO stocky_privacy_target_owner;
GRANT USAGE, SELECT ON SEQUENCE public."PrivacyTargetKey_id_seq" TO stocky_privacy_target_owner;

-- Publisher privilege: only the enumerator definer may write keys.
-- Callers cannot enlarge scope by inserting arbitrary row IDs.
ALTER TABLE public."PrivacyTargetKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PrivacyTargetKey" FORCE ROW LEVEL SECURITY;
CREATE POLICY target_key_definer_all ON public."PrivacyTargetKey"
  FOR ALL TO stocky_privacy_target_owner
  USING ("requestId" = NULLIF(current_setting('stocky.privacy_request_id', true), ''))
  WITH CHECK ("requestId" = NULLIF(current_setting('stocky.privacy_request_id', true), ''));
CREATE POLICY target_key_cp_select ON public."PrivacyTargetKey"
  FOR SELECT TO stocky_control_plane
  USING (true);

-- Enumerator SELECT policies (FORCE RLS; owner is not table owner).
CREATE POLICY order_enumerate ON public."ShopifyOrderFact" FOR SELECT TO stocky_privacy_target_owner
  USING ("shopId" = (SELECT r."targetShopId" FROM public."PrivacyRequest" r WHERE r.id = NULLIF(current_setting('stocky.privacy_request_id', true), '')));
CREATE POLICY line_enumerate ON public."ShopifyOrderLineFact" FOR SELECT TO stocky_privacy_target_owner
  USING ("shopId" = (SELECT r."targetShopId" FROM public."PrivacyRequest" r WHERE r.id = NULLIF(current_setting('stocky.privacy_request_id', true), '')));
CREATE POLICY audit_enumerate ON public."AuditEvent" FOR SELECT TO stocky_privacy_target_owner
  USING ("shopId" = (SELECT r."targetShopId" FROM public."PrivacyRequest" r WHERE r.id = NULLIF(current_setting('stocky.privacy_request_id', true), '')));

-- Consumer privacy policies: topic + row manifest. No processingEnabled.
CREATE POLICY order_privacy_read ON public."ShopifyOrderFact" FOR SELECT TO stocky_privacy_reader, stocky_privacy_erasure
  USING ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_privacy_capability_allows('READ', "shopId") AND stocky_privacy_row_in_manifest('ShopifyOrderFact', id));
CREATE POLICY order_privacy_delete_customer ON public."ShopifyOrderFact" FOR DELETE TO stocky_privacy_erasure
  USING ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_privacy_capability_allows('DELETE_CUSTOMER', "shopId") AND stocky_privacy_row_in_manifest('ShopifyOrderFact', id));
CREATE POLICY order_privacy_delete_shop ON public."ShopifyOrderFact" FOR DELETE TO stocky_privacy_erasure
  USING ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_privacy_capability_allows('DELETE_SHOP', "shopId"));

CREATE POLICY line_privacy_read ON public."ShopifyOrderLineFact" FOR SELECT TO stocky_privacy_reader, stocky_privacy_erasure
  USING ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_privacy_capability_allows('READ', "shopId") AND stocky_privacy_row_in_manifest('ShopifyOrderLineFact', id));
CREATE POLICY line_privacy_delete_customer ON public."ShopifyOrderLineFact" FOR DELETE TO stocky_privacy_erasure
  USING ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_privacy_capability_allows('DELETE_CUSTOMER', "shopId") AND stocky_privacy_row_in_manifest('ShopifyOrderLineFact', id));
CREATE POLICY line_privacy_delete_shop ON public."ShopifyOrderLineFact" FOR DELETE TO stocky_privacy_erasure
  USING ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_privacy_capability_allows('DELETE_SHOP', "shopId"));

CREATE POLICY audit_privacy_read ON public."AuditEvent" FOR SELECT TO stocky_privacy_reader, stocky_privacy_erasure
  USING ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_privacy_capability_allows('READ', "shopId") AND stocky_privacy_row_in_manifest('AuditEvent', id));
CREATE POLICY audit_privacy_delete_customer ON public."AuditEvent" FOR DELETE TO stocky_privacy_erasure
  USING ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_privacy_capability_allows('DELETE_CUSTOMER', "shopId") AND stocky_privacy_row_in_manifest('AuditEvent', id));
CREATE POLICY audit_privacy_delete_shop ON public."AuditEvent" FOR DELETE TO stocky_privacy_erasure
  USING ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1' AND stocky_privacy_capability_allows('DELETE_SHOP', "shopId"));

GRANT SELECT ON public."ShopifyOrderFact", public."ShopifyOrderLineFact", public."AuditEvent" TO stocky_privacy_reader, stocky_privacy_erasure;
GRANT DELETE ON public."ShopifyOrderFact", public."ShopifyOrderLineFact", public."AuditEvent" TO stocky_privacy_erasure;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."ShopifyOrderFact", public."ShopifyOrderLineFact" TO stocky_runtime;
GRANT SELECT, INSERT ON public."AuditEvent" TO stocky_runtime;

-- ---------------------------------------------------------------------------
-- Shop finalizer: SELECT/DELETE Shop only; rely on ON DELETE SET NULL
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stocky_privacy_finalize_shop_delete(
  p_request_id text,
  p_target_shop_id text,
  p_generation_id text,
  p_attempt_id text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  r public."PrivacyRequest"%ROWTYPE;
  g public."ShopInstallGeneration"%ROWTYPE;
  n int;
  live int;
BEGIN
  SELECT * INTO r FROM public."PrivacyRequest" WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'finalizer_request_missing' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO g FROM public."ShopInstallGeneration" WHERE id = p_generation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'finalizer_generation_missing' USING ERRCODE = 'P0001'; END IF;
  IF r.state <> 'FINALIZING' OR g.fence <> 'FINALIZING' THEN
    RAISE EXCEPTION 'finalizer_not_finalizing' USING ERRCODE = 'P0001';
  END IF;
  IF r."targetShopId" IS DISTINCT FROM p_target_shop_id OR g."targetShopId" IS DISTINCT FROM p_target_shop_id THEN
    RAISE EXCEPTION 'finalizer_target_mismatch' USING ERRCODE = 'P0001';
  END IF;
  IF r."generationId" IS DISTINCT FROM p_generation_id THEN
    RAISE EXCEPTION 'finalizer_generation_mismatch' USING ERRCODE = 'P0001';
  END IF;
  IF r."activeAttemptId" IS DISTINCT FROM p_attempt_id THEN
    RAISE EXCEPTION 'finalizer_stale_attempt' USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO live FROM public."Shop" s
    WHERE s."myshopifyDomain" = g."canonicalDomain" AND s."processingEnabled" = true AND s.id IS DISTINCT FROM p_target_shop_id;
  IF live > 0 THEN
    RAISE EXCEPTION 'finalizer_live_successor' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public."Shop"
    WHERE id = p_target_shop_id
      AND "processingEnabled" = false
      AND "processingDisabledReason" = 'REDACTED';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 1 THEN
    RETURN 'deleted';
  END IF;
  IF n = 0 AND NOT EXISTS (SELECT 1 FROM public."Shop" WHERE id = p_target_shop_id) THEN
    RETURN 'already_absent';
  END IF;
  RAISE EXCEPTION 'finalizer_shop_not_eligible' USING ERRCODE = 'P0001';
END;
$$;

ALTER FUNCTION public.stocky_privacy_finalize_shop_delete(text,text,text,text) OWNER TO stocky_privacy_finalizer_owner;
REVOKE ALL ON FUNCTION public.stocky_privacy_finalize_shop_delete(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_finalize_shop_delete(text,text,text,text) TO stocky_privacy_erasure;
GRANT SELECT, DELETE ON public."Shop" TO stocky_privacy_finalizer_owner;
GRANT SELECT ON public."PrivacyRequest", public."ShopInstallGeneration", public."PrivacyAttempt" TO stocky_privacy_finalizer_owner;

-- Runtime/CP: Shop SELECT/INSERT/UPDATE, no DELETE
GRANT SELECT, INSERT, UPDATE ON public."Shop" TO stocky_runtime;
GRANT SELECT, UPDATE ON public."Shop" TO stocky_control_plane;

-- ---------------------------------------------------------------------------
-- Lifecycle gate (versioned, domain-keyed, valid when Shop is absent)
-- ns 0x50523731 = PR71
-- ---------------------------------------------------------------------------
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
  -- Namespace freeze: ANY ERASING/FINALIZING generation. Never ORDER BY id.
  -- LIVE + ERASING coexistence is fail-closed frozen (no guessed successor write).
  RETURN NOT EXISTS (
    SELECT 1 FROM public."ShopInstallGeneration"
    WHERE "canonicalDomain" = p_canonical_domain
      AND fence IN ('ERASING','FINALIZING')
  );
END;
$$;

ALTER FUNCTION public.stocky_lifecycle_shared_lock(text) OWNER TO stocky_lifecycle_gate_owner;
ALTER FUNCTION public.stocky_lifecycle_exclusive_lock(text) OWNER TO stocky_lifecycle_gate_owner;
ALTER FUNCTION public.stocky_generation_writable(text) OWNER TO stocky_lifecycle_gate_owner;
REVOKE ALL ON FUNCTION public.stocky_lifecycle_shared_lock(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_lifecycle_exclusive_lock(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_generation_writable(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_lifecycle_shared_lock(text) TO stocky_runtime, stocky_control_plane, stocky_privacy_erasure, stocky_privacy_reader, stocky_privacy_target_owner;
GRANT EXECUTE ON FUNCTION public.stocky_lifecycle_exclusive_lock(text) TO stocky_control_plane, stocky_privacy_erasure;
GRANT EXECUTE ON FUNCTION public.stocky_generation_writable(text) TO stocky_runtime, stocky_control_plane, stocky_privacy_erasure, stocky_privacy_reader;
GRANT SELECT ON public."ShopInstallGeneration" TO stocky_lifecycle_gate_owner;

-- Instrumented writer helper used by participating fact/CP/bootstrap paths.
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
REVOKE ALL ON FUNCTION public.stocky_participating_write_guard(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_participating_write_guard(text) TO stocky_runtime, stocky_control_plane;

-- ---------------------------------------------------------------------------
-- Authorization: advisory lock + SELECT-only verifier (no assignment UPDATE)
-- ns 0x50523732 = PR72
-- Permission map version: pr7-perm-v1
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stocky_authz_lock(p_shop_id text, p_actor_id text)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(1347573554, hashtext('pr7-authz-v1:' || p_shop_id || ':' || p_actor_id));
END;
$$;
REVOKE ALL ON FUNCTION public.stocky_authz_lock(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_authz_lock(text, text) TO stocky_runtime, stocky_control_plane;

CREATE OR REPLACE FUNCTION public.stocky_authz_lock_pair(p_shop_id text, p_actor_a text, p_actor_b text)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF p_actor_a <= p_actor_b THEN
    PERFORM public.stocky_authz_lock(p_shop_id, p_actor_a);
    IF p_actor_a <> p_actor_b THEN
      PERFORM public.stocky_authz_lock(p_shop_id, p_actor_b);
    END IF;
  ELSE
    PERFORM public.stocky_authz_lock(p_shop_id, p_actor_b);
    PERFORM public.stocky_authz_lock(p_shop_id, p_actor_a);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.stocky_authz_lock_pair(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_authz_lock_pair(text,text,text) TO stocky_runtime, stocky_control_plane;

CREATE OR REPLACE FUNCTION public.stocky_verify_platform_assignment(p_shop_id text, p_actor_id text, p_permission text)
RETURNS boolean
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE allowed boolean;
BEGIN
  IF p_permission IS DISTINCT FROM 'platform.replay.execute' THEN
    RETURN false;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public."ShopRoleAssignment" a
    WHERE a."shopId" = p_shop_id
      AND a."shopifyUserId" = p_actor_id
      AND a."revokedAt" IS NULL
      AND a.role IN ('shop_owner','shop_admin')
  ) INTO allowed;
  RETURN allowed;
END;
$$;

ALTER FUNCTION public.stocky_verify_platform_assignment(text,text,text) OWNER TO stocky_assignment_verifier_owner;
REVOKE ALL ON FUNCTION public.stocky_verify_platform_assignment(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_verify_platform_assignment(text,text,text) TO stocky_control_plane, stocky_runtime;
GRANT SELECT ON public."ShopRoleAssignment" TO stocky_assignment_verifier_owner;

CREATE POLICY assignment_runtime_all ON public."ShopRoleAssignment" FOR ALL TO stocky_runtime
  USING ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1')
  WITH CHECK ("shopId" = stocky_current_tenant_id() AND stocky_current_tenant_context_version() = 'phase1-db-tenant-context-v1');
CREATE POLICY assignment_verifier_select ON public."ShopRoleAssignment" FOR SELECT TO stocky_assignment_verifier_owner
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."ShopRoleAssignment" TO stocky_runtime;
GRANT SELECT ON public."ShopRoleAssignment" TO stocky_control_plane;

-- Control-plane ordinary job family
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public."DurableJob", public."JobAttempt", public."DeadLetter", public."JobReplay",
  public."WebhookDelivery", public."JobDispatch", public."SyncApplicationReceipt", public."DispatchReadyShop",
  public."Session", public."PrivacyRequest", public."PrivacyAttempt",
  public."PrivacyCoordinatorEvent", public."PrivacyCompletionReceipt",
  public."PrivacyDeliveryTombstone", public."PlatformReplayCommand"
TO stocky_control_plane;
GRANT SELECT ON public."PrivacyTargetKey" TO stocky_control_plane;
GRANT USAGE, SELECT ON SEQUENCE public."PrivacyCoordinatorEvent_id_seq" TO stocky_control_plane;

GRANT SELECT ON public."PrivacyRequest", public."PrivacyAttempt", public."ShopInstallGeneration" TO stocky_privacy_reader, stocky_privacy_erasure;
GRANT SELECT ON public."Shop" TO stocky_privacy_reader, stocky_privacy_erasure;

-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- CC-GEN customer-target barrier, trusted origin, source-derived residual
-- ns 1347573555 = canonical tenant namespace × kind/value (NOT generation)
-- Generation remains immutable evidence on barrier / completed-target / request.
-- Global lock order: lifecycle domain (1347573553) → publication (1347573556)
--   → authz (1347573554) → customer-target (1347573555). Never lookup-then-lock.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stocky_customer_target_lock_key1(p_canonical_domain text)
RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$ SELECT hashtext('pr7-ctgt-v2:' || p_canonical_domain); $$;

CREATE OR REPLACE FUNCTION public.stocky_customer_target_lock_key2(p_kind text, p_value text)
RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$ SELECT hashtext(p_kind || ':' || p_value); $$;

CREATE OR REPLACE FUNCTION public.stocky_customer_target_lock_shared(
  p_canonical_domain text, p_kind text, p_value text
) RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock_shared(
    public.stocky_customer_target_lock_key1(p_canonical_domain),
    public.stocky_customer_target_lock_key2(p_kind, p_value)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_customer_target_lock_exclusive(
  p_canonical_domain text, p_kind text, p_value text
) RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    public.stocky_customer_target_lock_key1(p_canonical_domain),
    public.stocky_customer_target_lock_key2(p_kind, p_value)
  );
END;
$$;

-- Unique canonical-namespace resolver. Never ORDER BY id. Fail missing/ambiguous.
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

-- Trusted origin: declared persisted generation, or unique LIVE shop binding.
-- Never ORDER BY id. Old work must not adopt a newer generation.
CREATE OR REPLACE FUNCTION public.stocky_writer_origin_generation(
  p_shop_id text,
  p_declared_generation_id text,
  p_canonical_domain text
) RETURNS text
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  g public."ShopInstallGeneration"%ROWTYPE;
  v_id text;
  n int;
BEGIN
  IF p_declared_generation_id IS NOT NULL AND p_declared_generation_id <> '' THEN
    SELECT * INTO g FROM public."ShopInstallGeneration" WHERE id = p_declared_generation_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'customer_write_origin_missing' USING ERRCODE = 'P0001';
    END IF;
    IF g."canonicalDomain" IS DISTINCT FROM p_canonical_domain THEN
      RAISE EXCEPTION 'customer_write_origin_namespace_mismatch' USING ERRCODE = 'P0001';
    END IF;
    RETURN g.id;
  END IF;
  SELECT COUNT(*), MIN(gg.id) INTO n, v_id
  FROM public."ShopInstallGeneration" gg
  WHERE gg."canonicalDomain" = p_canonical_domain
    AND gg.fence = 'LIVE'
    AND (gg."shopRowId" = p_shop_id OR gg."targetShopId" = p_shop_id);
  IF n = 0 THEN
    RAISE EXCEPTION 'customer_write_origin_missing' USING ERRCODE = 'P0001';
  END IF;
  IF n > 1 THEN
    RAISE EXCEPTION 'customer_write_origin_ambiguous' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_customer_targets_for_request(p_request_id text)
RETURNS TABLE(kind text, value text)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT 'CUSTOMER_REST_ID'::text, r."lookupCustomerRestId"
  FROM public."PrivacyRequest" r
  WHERE r.id = p_request_id AND r."lookupCustomerRestId" IS NOT NULL
  UNION ALL
  SELECT 'ORDER_LEGACY_ID'::text, oid
  FROM public."PrivacyRequest" r
  CROSS JOIN LATERAL unnest(COALESCE(r."lookupOrderLegacyIds", '{}')) AS oid
  WHERE r.id = p_request_id;
$$;

CREATE OR REPLACE FUNCTION public.stocky_privacy_install_customer_barrier(
  p_request_id text,
  p_attempt_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  r public."PrivacyRequest"%ROWTYPE;
  g public."ShopInstallGeneration"%ROWTYPE;
  tgt record;
BEGIN
  PERFORM public.stocky_privacy_publication_lock(p_request_id);
  SELECT * INTO r FROM public."PrivacyRequest" WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'barrier_request_missing' USING ERRCODE = 'P0001'; END IF;
  IF r.topic IS DISTINCT FROM 'customers/redact' THEN
    RAISE EXCEPTION 'barrier_not_customer_redact' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.stocky_privacy_live_attempt_ok(r.id, p_attempt_id) THEN
    RAISE EXCEPTION 'barrier_stale_attempt' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO g FROM public."ShopInstallGeneration" WHERE id = r."generationId";
  IF NOT FOUND THEN RAISE EXCEPTION 'barrier_generation_missing' USING ERRCODE = 'P0001'; END IF;
  -- Domain shared, not exclusive: do not freeze the shop.
  PERFORM public.stocky_lifecycle_shared_lock(g."canonicalDomain");
  IF g.fence IN ('ERASING','FINALIZING') THEN
    RAISE EXCEPTION 'superseded_by_shop_erasure' USING ERRCODE = 'P0001';
  END IF;
  IF g.fence NOT IN ('LIVE','UNINSTALLED') THEN
    RAISE EXCEPTION 'barrier_generation_ineligible' USING ERRCODE = 'P0001';
  END IF;

  -- Lock BEFORE any barrier lookup/insert (no publication race).
  FOR tgt IN
    SELECT src.kind, src.value FROM public.stocky_customer_targets_for_request(r.id) AS src ORDER BY src.kind, src.value
  LOOP
    PERFORM public.stocky_customer_target_lock_exclusive(g."canonicalDomain", tgt.kind, tgt.value);
  END LOOP;

  INSERT INTO public."PrivacyCustomerTargetBarrier"(
    "shopId","generationId","targetKind","targetValue","privacyRequestId","attemptId","publicationRevision",state
  )
  SELECT r."targetShopId", r."generationId", src.kind, src.value, r.id, p_attempt_id, r."publicationRevision", 'ACTIVE'
  FROM public.stocky_customer_targets_for_request(r.id) AS src
  WHERE NOT EXISTS (
    SELECT 1 FROM public."PrivacyCustomerTargetBarrier" b
    WHERE b."shopId" = r."targetShopId"
      AND b."generationId" = r."generationId"
      AND b."targetKind" = src.kind
      AND b."targetValue" = src.value
      AND b.state = 'ACTIVE'
  );

  UPDATE public."PrivacyCustomerTargetBarrier" b
    SET state='ACTIVE', "attemptId"=p_attempt_id, "releasedAt"=NULL,
        "publicationRevision"=r."publicationRevision"
    WHERE b."privacyRequestId"=r.id AND b.state='RELEASED';
END;
$$;


DROP FUNCTION IF EXISTS public.stocky_customer_write_guard(text, text, text, text, timestamptz, text);
DROP FUNCTION IF EXISTS public.stocky_fact_write_guard(text, text, text, text, timestamptz, text);
DROP FUNCTION IF EXISTS public.stocky_customer_write_guard(text, text, text, text, timestamptz, text, boolean);
DROP FUNCTION IF EXISTS public.stocky_fact_write_guard(text, text, text, text, timestamptz, text, boolean);
DROP FUNCTION IF EXISTS public.stocky_customer_write_guard(text, text, text, text, text);
DROP FUNCTION IF EXISTS public.stocky_fact_write_guard(text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.stocky_customer_write_guard(
  p_canonical_domain text,
  p_shop_id text,
  p_kind text,
  p_value text,
  p_work_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_domain text;
  n int;
  ct record;
  v_origin text;
  og public."ShopInstallGeneration"%ROWTYPE;
  cg public."ShopInstallGeneration"%ROWTYPE;
  live_n int;
  v_trusted boolean;
  wa public."WriterAdmissionOrigin"%ROWTYPE;
  v_payload_admitted_at timestamptz;
BEGIN
  v_domain := public.stocky_shop_canonical_domain(p_shop_id, p_canonical_domain);
  -- Lock BEFORE examining barriers (Decision CC-GEN).
  PERFORM public.stocky_customer_target_lock_shared(v_domain, p_kind, p_value);

  SELECT count(*) INTO n
  FROM public."PrivacyCustomerTargetBarrier" b
  JOIN public."ShopInstallGeneration" bg ON bg.id = b."generationId"
  WHERE bg."canonicalDomain" = v_domain
    AND b."targetKind" = p_kind
    AND b."targetValue" = p_value
    AND b.state = 'ACTIVE';
  IF n > 0 THEN
    RAISE EXCEPTION 'customer_target_erasing' USING ERRCODE = 'P0001';
  END IF;

  -- Derive origin from the protected admission record. Caller generation/time
  -- is not authority. A record id is a lookup key only.
  IF p_work_id IS NULL OR p_work_id = '' THEN
    RAISE EXCEPTION 'customer_target_attribution_ambiguous' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO wa
  FROM public."WriterAdmissionOrigin"
  WHERE "workId" = p_work_id
    AND "canonicalDomain" = v_domain
    AND "shopId" = p_shop_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_target_attribution_ambiguous' USING ERRCODE = 'P0001';
  END IF;
  IF wa."originStatus" = 'PENDING_LINK' OR wa."acked" IS NOT TRUE THEN
    RAISE EXCEPTION 'customer_admission_not_acked' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public."WriterAdmissionOriginTarget" t
    WHERE t."originId" = wa.id
      AND t."targetKind" = p_kind
      AND t."targetValue" = p_value
  ) THEN
    RAISE EXCEPTION 'customer_target_binding_mismatch' USING ERRCODE = 'P0001';
  END IF;

  v_payload_admitted_at := wa."originalAdmittedAt";
  IF v_payload_admitted_at IS NULL THEN
    RAISE EXCEPTION 'customer_target_attribution_ambiguous' USING ERRCODE = 'P0001';
  END IF;

  v_trusted := (wa."originStatus" = 'BOUND')
               AND (wa."originGenerationId" IS NOT NULL)
               AND (wa."originGenerationId" <> '');

  IF EXISTS (
    SELECT 1
    FROM public."PrivacyCompletedTarget" c
    LEFT JOIN public."ShopInstallGeneration" g ON g.id = c."generationId"
    WHERE c."targetKind" = p_kind
      AND c."targetValue" = p_value
      AND (g.id IS NULL OR g."canonicalDomain" = v_domain)
      AND (g.id IS NULL OR c."completedAt" IS NULL)
  ) THEN
    RAISE EXCEPTION 'customer_target_attribution_ambiguous' USING ERRCODE = 'P0001';
  END IF;

  FOR ct IN
    SELECT c."generationId" AS completed_generation_id, c."completedAt" AS completed_at
    FROM public."PrivacyCompletedTarget" c
    JOIN public."ShopInstallGeneration" cg0 ON cg0.id = c."generationId"
    WHERE cg0."canonicalDomain" = v_domain
      AND c."targetKind" = p_kind
      AND c."targetValue" = p_value
  LOOP
    IF ct.completed_at IS NULL THEN
      RAISE EXCEPTION 'customer_target_attribution_ambiguous' USING ERRCODE = 'P0001';
    END IF;
    IF v_payload_admitted_at > ct.completed_at THEN
      CONTINUE;
    END IF;
    IF v_origin IS NULL THEN
      IF v_trusted THEN
        v_origin := public.stocky_writer_origin_generation(p_shop_id, wa."originGenerationId", v_domain);
      ELSE
        v_origin := public.stocky_writer_origin_generation(p_shop_id, NULL, v_domain);
      END IF;
    END IF;
    SELECT * INTO og FROM public."ShopInstallGeneration" WHERE id = v_origin;
    IF NOT FOUND OR og."installedAt" IS NULL THEN
      RAISE EXCEPTION 'customer_target_attribution_ambiguous' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO cg FROM public."ShopInstallGeneration" WHERE id = ct.completed_generation_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'customer_target_attribution_ambiguous' USING ERRCODE = 'P0001';
    END IF;
    IF v_trusted AND v_origin = ct.completed_generation_id THEN
      RAISE EXCEPTION 'customer_target_restore_denied' USING ERRCODE = 'P0001';
    END IF;
    -- BEGIN GW01_TEMPORAL_OVERLAP
    IF v_trusted IS NOT TRUE THEN
      IF og."installedAt" <= ct.completed_at
         AND v_payload_admitted_at >= og."installedAt"
         AND v_payload_admitted_at <= ct.completed_at THEN
        RAISE EXCEPTION 'customer_target_attribution_ambiguous' USING ERRCODE = 'P0001';
      END IF;
    END IF;
    -- END GW01_TEMPORAL_OVERLAP
    IF v_origin = ct.completed_generation_id THEN
      RAISE EXCEPTION 'customer_target_restore_denied' USING ERRCODE = 'P0001';
    END IF;
    SELECT count(*) INTO live_n
    FROM public."ShopInstallGeneration"
    WHERE "canonicalDomain" = v_domain AND fence = 'LIVE';
    IF live_n <> 1 OR og.fence IS DISTINCT FROM 'LIVE' OR cg.fence = 'LIVE' THEN
      RAISE EXCEPTION 'customer_target_attribution_ambiguous' USING ERRCODE = 'P0001';
    END IF;
    IF v_payload_admitted_at < og."installedAt" THEN
      RAISE EXCEPTION 'customer_target_restore_denied' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_fact_write_guard(
  p_canonical_domain text,
  p_shop_id text,
  p_kind text,
  p_value text,
  p_work_id text
) RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM public.stocky_participating_write_guard(p_canonical_domain);
  PERFORM public.stocky_customer_write_guard(
    p_canonical_domain, p_shop_id, p_kind, p_value, p_work_id
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.stocky_privacy_customer_residual_count(p_request_id text)
RETURNS bigint
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  r public."PrivacyRequest"%ROWTYPE;
  v_req text := NULLIF(current_setting('stocky.privacy_request_id', true), '');
  v_shop text := NULLIF(current_setting('stocky.current_shop_id', true), '');
  v_att text := NULLIF(current_setting('stocky.privacy_attempt_id', true), '');
  audit_n bigint := 0;
  order_n bigint := 0;
  line_n bigint := 0;
BEGIN
  -- Own preconditions BEFORE any RLS-filtered count (CC-02). Do not depend on enumerate.
  IF v_req IS DISTINCT FROM p_request_id THEN
    RAISE EXCEPTION 'residual_request_guc_mismatch' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public."PrivacyRequest" WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'residual_request_missing' USING ERRCODE = 'P0001';
  END IF;
  IF v_shop IS DISTINCT FROM r."targetShopId" THEN
    RAISE EXCEPTION 'residual_tenant_mismatch' USING ERRCODE = '42501';
  END IF;
  IF v_att IS NULL OR NOT public.stocky_privacy_live_attempt_ok(r.id, v_att) THEN
    RAISE EXCEPTION 'residual_stale_attempt' USING ERRCODE = '42501';
  END IF;
  IF NOT public.stocky_privacy_capability_allows('READ', r."targetShopId") THEN
    RAISE EXCEPTION 'residual_capability_denied' USING ERRCODE = '42501';
  END IF;
  IF r."lookupCustomerRestId" IS NOT NULL THEN
    SELECT count(*) INTO audit_n
    FROM public."AuditEvent" a
    WHERE a."shopId" = r."targetShopId"
      AND a."customerRestId" = r."lookupCustomerRestId";
  END IF;
  SELECT count(*) INTO order_n
  FROM public."ShopifyOrderFact" f
  WHERE f."shopId" = r."targetShopId"
    AND f."shopifyLegacyResourceId" = ANY (COALESCE(r."lookupOrderLegacyIds", '{}'));
  SELECT count(*) INTO line_n
  FROM public."ShopifyOrderLineFact" l
  WHERE l."shopId" = r."targetShopId"
    AND l."shopifyOrderGid" IN (
      SELECT 'gid://shopify/Order/' || oid
      FROM unnest(COALESCE(r."lookupOrderLegacyIds", '{}')) AS oid
    );
  RETURN audit_n + order_n + line_n;
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_privacy_complete_customer_redact(
  p_request_id text,
  p_attempt_id text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  r public."PrivacyRequest"%ROWTYPE;
  g public."ShopInstallGeneration"%ROWTYPE;
  tgt record;
  residual bigint;
  max_retries int := 5;
BEGIN
  PERFORM public.stocky_privacy_publication_lock(p_request_id);
  SELECT * INTO r FROM public."PrivacyRequest" WHERE id = p_request_id;
  IF NOT FOUND THEN RETURN 'stale'; END IF;
  IF r.topic IS DISTINCT FROM 'customers/redact' THEN
    RAISE EXCEPTION 'complete_not_customer_redact' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.stocky_privacy_live_attempt_ok(r.id, p_attempt_id) THEN
    RETURN 'stale';
  END IF;
  SELECT * INTO g FROM public."ShopInstallGeneration" WHERE id = r."generationId";
  IF NOT FOUND THEN RETURN 'stale'; END IF;
  IF g.fence IN ('ERASING','FINALIZING') THEN
    RETURN 'superseded';
  END IF;

  FOR tgt IN
    SELECT src.kind, src.value FROM public.stocky_customer_targets_for_request(r.id) AS src ORDER BY src.kind, src.value
  LOOP
    PERFORM public.stocky_customer_target_lock_exclusive(g."canonicalDomain", tgt.kind, tgt.value);
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.stocky_customer_targets_for_request(r.id) AS src
    WHERE NOT EXISTS (
      SELECT 1 FROM public."PrivacyCustomerTargetBarrier" b
      WHERE b."shopId" = r."targetShopId"
        AND b."generationId" = r."generationId"
        AND b."targetKind" = src.kind
        AND b."targetValue" = src.value
        AND b.state = 'ACTIVE'
        AND b."privacyRequestId" = r.id
        AND b."attemptId" = p_attempt_id
    )
  ) THEN
    RETURN 'stale';
  END IF;

  PERFORM public.stocky_privacy_enumerate_targets(p_request_id);

  residual := public.stocky_privacy_customer_residual_count(p_request_id);
  IF residual > 0 THEN
    UPDATE public."PrivacyRequest"
      SET "completeRetryCount" = "completeRetryCount" + 1,
          state = CASE WHEN "completeRetryCount" + 1 >= max_retries THEN 'ESCALATED' ELSE 'CHECKPOINTING' END
      WHERE id = r.id AND "activeAttemptId" = p_attempt_id;
    IF residual > 0 AND (SELECT "completeRetryCount" FROM public."PrivacyRequest" WHERE id = r.id) >= max_retries THEN
      RETURN 'budget_exhausted';
    END IF;
    RETURN 'remnants';
  END IF;

  INSERT INTO public."PrivacyCompletionReceipt"(id,"privacyRequestId","generationId","targetShopIdHmac")
    VALUES ('rcpt_'||p_request_id, p_request_id, r."generationId", 'hmac:'||r."targetShopId")
    ON CONFLICT ("privacyRequestId") DO NOTHING;

  INSERT INTO public."PrivacyCompletedTarget"(
    "shopId","generationId","targetKind","targetValue","privacyRequestId","completedAt"
  )
  SELECT r."targetShopId", r."generationId", src.kind, src.value, r.id, clock_timestamp()
  FROM public.stocky_customer_targets_for_request(r.id) AS src
  ON CONFLICT DO NOTHING;

  UPDATE public."PrivacyCustomerTargetBarrier"
    SET state='RELEASED', "releasedAt"=clock_timestamp()
    WHERE "privacyRequestId"=r.id AND state='ACTIVE';

  UPDATE public."PrivacyRequest"
    SET state='COMPLETED'
    WHERE id = r.id
      AND "activeAttemptId" = p_attempt_id
      AND state IN ('APPLYING','CHECKPOINTING','ENUMERATING','FINALIZING');
  IF NOT FOUND THEN
    RETURN 'stale';
  END IF;
  RETURN 'completed';
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_privacy_claim_attempt(
  p_request_id text,
  p_old_attempt_id text,
  p_new_attempt_id text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM public.stocky_privacy_publication_lock(p_request_id);
  UPDATE public."PrivacyAttempt"
    SET state='LOST', "leaseUntil"=clock_timestamp() - interval '1 second'
    WHERE id = p_old_attempt_id AND "privacyRequestId" = p_request_id;
  INSERT INTO public."PrivacyAttempt"(id,"privacyRequestId",epoch,state,"leaseUntil",worker)
    SELECT p_new_attempt_id, p_request_id, COALESCE(max(epoch),0)+1, 'RUNNING', clock_timestamp() + interval '1 hour', 'takeover'
    FROM public."PrivacyAttempt" WHERE "privacyRequestId" = p_request_id;
  UPDATE public."PrivacyRequest"
    SET "activeAttemptId" = p_new_attempt_id
    WHERE id = p_request_id;
  UPDATE public."PrivacyCustomerTargetBarrier"
    SET "attemptId" = p_new_attempt_id
    WHERE "privacyRequestId" = p_request_id AND state='ACTIVE';
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_privacy_data_request_coverage(p_request_id text)
RETURNS text
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  r public."PrivacyRequest"%ROWTYPE;
  key_n int;
BEGIN
  SELECT * INTO r FROM public."PrivacyRequest" WHERE id = p_request_id;
  IF NOT FOUND THEN RETURN 'missing'; END IF;
  IF r.topic IS DISTINCT FROM 'customers/data_request' THEN
    RETURN 'wrong_topic';
  END IF;
  SELECT count(*) INTO key_n FROM public."PrivacyTargetKey" WHERE "requestId" = p_request_id;
  RETURN 'revision='||r."publicationRevision"||',keys='||key_n||',complete='||r."enumerationComplete";
END;
$$;

-- omitted disposable stocky_cp_participating_write

-- omitted disposable stocky_lifecycle_complete_attempt_retry

-- omitted disposable stocky_dispatcher_disabled_shop_write

-- Seven-symbol floor remains a regression floor ONLY (GW-02).
-- omitted disposable stocky_inventory_floor_complete

-- Completeness reconciles an independently loaded source-derived required set.
-- omitted disposable stocky_inventory_is_complete

-- omitted disposable stocky_detect_unguarded_cp_write

-- Grants / ownership for CC-GEN helpers. PUBLIC EXECUTE revoked.
ALTER FUNCTION public.stocky_privacy_claim_attempt(text, text, text) OWNER TO stocky_privacy_target_owner;
GRANT INSERT, UPDATE ON public."PrivacyAttempt" TO stocky_privacy_target_owner;
ALTER FUNCTION public.stocky_customer_targets_for_request(text) OWNER TO stocky_privacy_target_owner;
ALTER FUNCTION public.stocky_privacy_install_customer_barrier(text, text) OWNER TO stocky_privacy_target_owner;
ALTER FUNCTION public.stocky_customer_write_guard(text, text, text, text, text) OWNER TO stocky_lifecycle_gate_owner;
ALTER FUNCTION public.stocky_privacy_customer_residual_count(text) OWNER TO stocky_privacy_target_owner;
ALTER FUNCTION public.stocky_privacy_complete_customer_redact(text, text) OWNER TO stocky_privacy_target_owner;
ALTER FUNCTION public.stocky_privacy_data_request_coverage(text) OWNER TO stocky_privacy_target_owner;
ALTER FUNCTION public.stocky_shop_canonical_domain(text, text) OWNER TO stocky_lifecycle_gate_owner;
ALTER FUNCTION public.stocky_writer_origin_generation(text, text, text) OWNER TO stocky_lifecycle_gate_owner;

REVOKE ALL ON FUNCTION public.stocky_shop_canonical_domain(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_writer_origin_generation(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_customer_targets_for_request(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_privacy_install_customer_barrier(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_customer_write_guard(text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_fact_write_guard(text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_privacy_customer_residual_count(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_privacy_complete_customer_redact(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_privacy_claim_attempt(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_privacy_data_request_coverage(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_customer_target_lock_key1(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_customer_target_lock_key2(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_customer_target_lock_shared(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_customer_target_lock_exclusive(text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.stocky_shop_canonical_domain(text, text) TO stocky_runtime, stocky_control_plane, stocky_privacy_erasure, stocky_privacy_reader, stocky_lifecycle_gate_owner, stocky_privacy_target_owner;
GRANT EXECUTE ON FUNCTION public.stocky_writer_origin_generation(text, text, text) TO stocky_runtime, stocky_control_plane, stocky_privacy_erasure, stocky_lifecycle_gate_owner, stocky_privacy_target_owner;
GRANT EXECUTE ON FUNCTION public.stocky_customer_targets_for_request(text) TO stocky_privacy_erasure, stocky_control_plane, stocky_privacy_target_owner;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_install_customer_barrier(text, text) TO stocky_privacy_erasure, stocky_control_plane;
GRANT EXECUTE ON FUNCTION public.stocky_customer_write_guard(text, text, text, text, text) TO stocky_runtime, stocky_control_plane;
GRANT EXECUTE ON FUNCTION public.stocky_fact_write_guard(text, text, text, text, text) TO stocky_runtime, stocky_control_plane;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_customer_residual_count(text) TO stocky_privacy_erasure, stocky_control_plane;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_complete_customer_redact(text, text) TO stocky_privacy_erasure, stocky_control_plane;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_claim_attempt(text, text, text) TO stocky_control_plane;
GRANT EXECUTE ON FUNCTION public.stocky_privacy_data_request_coverage(text) TO stocky_privacy_reader, stocky_control_plane;
GRANT EXECUTE ON FUNCTION public.stocky_customer_target_lock_key1(text) TO stocky_runtime, stocky_control_plane, stocky_privacy_erasure, stocky_privacy_target_owner, stocky_lifecycle_gate_owner;
GRANT EXECUTE ON FUNCTION public.stocky_customer_target_lock_key2(text, text) TO stocky_runtime, stocky_control_plane, stocky_privacy_erasure, stocky_privacy_target_owner, stocky_lifecycle_gate_owner;
GRANT EXECUTE ON FUNCTION public.stocky_customer_target_lock_shared(text, text, text) TO stocky_runtime, stocky_control_plane, stocky_privacy_erasure, stocky_privacy_target_owner, stocky_lifecycle_gate_owner;
GRANT EXECUTE ON FUNCTION public.stocky_lifecycle_shared_lock(text) TO stocky_admission_origin_owner, stocky_original_admission;
GRANT EXECUTE ON FUNCTION public.stocky_customer_target_lock_key1(text) TO stocky_admission_origin_owner;
GRANT EXECUTE ON FUNCTION public.stocky_customer_target_lock_key2(text, text) TO stocky_admission_origin_owner;
GRANT EXECUTE ON FUNCTION public.stocky_customer_target_lock_shared(text, text, text) TO stocky_admission_origin_owner;
GRANT EXECUTE ON FUNCTION public.stocky_shop_canonical_domain(text, text) TO stocky_admission_origin_owner, stocky_original_admission;

GRANT EXECUTE ON FUNCTION public.stocky_customer_target_lock_exclusive(text, text, text) TO stocky_privacy_erasure, stocky_control_plane, stocky_privacy_target_owner, stocky_lifecycle_gate_owner;

-- Residual helper is SECURITY DEFINER as target_owner and must evaluate capability itself (CC-02).
GRANT EXECUTE ON FUNCTION public.stocky_privacy_capability_allows(text, text) TO stocky_privacy_target_owner;

GRANT SELECT ON public."Shop" TO stocky_lifecycle_gate_owner;
GRANT SELECT ON public."ShopInstallGeneration" TO stocky_lifecycle_gate_owner;
GRANT SELECT ON public."PrivacyCustomerTargetBarrier", public."PrivacyCompletedTarget" TO stocky_lifecycle_gate_owner;
GRANT SELECT, INSERT, UPDATE ON public."PrivacyCustomerTargetBarrier" TO stocky_privacy_target_owner;
GRANT USAGE, SELECT ON SEQUENCE public."PrivacyCustomerTargetBarrier_id_seq" TO stocky_privacy_target_owner;
GRANT SELECT, INSERT ON public."PrivacyCompletedTarget" TO stocky_privacy_target_owner;
GRANT SELECT, INSERT ON public."PrivacyCompletionReceipt" TO stocky_privacy_target_owner;
GRANT SELECT ON public."PrivacyRequest", public."PrivacyAttempt" TO stocky_privacy_target_owner;

ALTER TABLE public."PrivacyCustomerTargetBarrier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PrivacyCustomerTargetBarrier" FORCE ROW LEVEL SECURITY;
CREATE POLICY customer_barrier_definer_all ON public."PrivacyCustomerTargetBarrier"
  FOR ALL TO stocky_privacy_target_owner
  USING (true) WITH CHECK (true);
CREATE POLICY customer_barrier_gate_select ON public."PrivacyCustomerTargetBarrier"
  FOR SELECT TO stocky_lifecycle_gate_owner
  USING (true);

ALTER TABLE public."PrivacyCompletedTarget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PrivacyCompletedTarget" FORCE ROW LEVEL SECURITY;
CREATE POLICY completed_target_definer_all ON public."PrivacyCompletedTarget"
  FOR ALL TO stocky_privacy_target_owner
  USING (true) WITH CHECK (true);
CREATE POLICY completed_target_gate_select ON public."PrivacyCompletedTarget"
  FOR SELECT TO stocky_lifecycle_gate_owner
  USING (true);

-- Source-derived participating-writer inventory is enforced by
-- scripts/privacy/participating-writers.ts (architecture gate). Appendix F
-- disposable inventory SQL is not production schema.

-- Independent source-derived snapshot (scanner output; not SELECT FROM inventory).
-- Pinned to X application sources. Completeness must reconcile against these rows.


-- DO-01/DO-02 proposed capture-to-producer and effect-host boundary (disposable).
-- PostgreSQL does not verify Shopify tokens. This models the application
-- boundary after requireAdminTenant / authenticate.admin.

REVOKE ALL ON public."OriginalAdminCapture" FROM PUBLIC;
REVOKE ALL ON public."OriginalAdminSession" FROM PUBLIC;
REVOKE ALL ON public."QueuedWorkSighting" FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.stocky_establish_modeled_admin_session(
  p_shop_id text,
  p_canonical_domain text,
  p_actor_identity text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_id text;
  v_shop text;
BEGIN
  IF session_user IS DISTINCT FROM 'stocky_admin_capture' THEN
    RAISE EXCEPTION 'admission_capture_principal_required' USING ERRCODE = '42501';
  END IF;
  IF p_shop_id IS NULL OR p_shop_id = '' OR p_canonical_domain IS NULL OR p_canonical_domain = ''
     OR p_actor_identity IS NULL OR p_actor_identity = '' THEN
    RAISE EXCEPTION 'admission_session_identity_required' USING ERRCODE = 'P0001';
  END IF;
  v_shop := NULLIF(current_setting('stocky.current_shop_id', true), '');
  IF v_shop IS DISTINCT FROM p_shop_id THEN
    RAISE EXCEPTION 'admission_session_tenant_mismatch' USING ERRCODE = 'P0001';
  END IF;
  v_id := 'oas_' || replace(p_shop_id, '-', '_') || '_' || replace(clock_timestamp()::text, ' ', '_');
  INSERT INTO public."OriginalAdminSession"(id, "canonicalDomain", "shopId", "actorIdentity", "establishedAt")
  VALUES (v_id, p_canonical_domain, p_shop_id, p_actor_identity, clock_timestamp());
  PERFORM set_config('stocky.admin_session_id', v_id, true);
  PERFORM set_config('stocky.admin_session_actor', p_actor_identity, true);
  PERFORM set_config('stocky.admin_session_domain', p_canonical_domain, true);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_capture_original_admin_command(
  p_canonical_domain text,
  p_shop_id text,
  p_command_id text,
  p_source_kind text,
  p_source_identity text,
  p_source_content_digest text,
  p_target_kind text,
  p_target_value text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_domain text;
  v_sid text;
  sess public."OriginalAdminSession"%ROWTYPE;
  existing public."OriginalAdminCapture"%ROWTYPE;
  live_n int;
  live_id text;
  v_id text;
BEGIN
  IF session_user IS DISTINCT FROM 'stocky_admin_capture' THEN
    RAISE EXCEPTION 'admission_capture_principal_required' USING ERRCODE = '42501';
  END IF;
  IF p_command_id IS NULL OR p_command_id = '' OR p_source_identity IS NULL OR p_source_identity = ''
     OR p_source_content_digest IS NULL OR p_source_content_digest = '' THEN
    RAISE EXCEPTION 'admission_identity_required' USING ERRCODE = 'P0001';
  END IF;
  v_sid := NULLIF(current_setting('stocky.admin_session_id', true), '');
  IF v_sid IS NULL THEN
    RAISE EXCEPTION 'admission_admin_session_required' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO sess FROM public."OriginalAdminSession" WHERE id = v_sid;
  IF NOT FOUND OR sess."shopId" IS DISTINCT FROM p_shop_id
     OR sess."canonicalDomain" IS DISTINCT FROM p_canonical_domain THEN
    RAISE EXCEPTION 'admission_admin_session_mismatch' USING ERRCODE = 'P0001';
  END IF;
  v_domain := public.stocky_shop_canonical_domain(p_shop_id, p_canonical_domain);
  PERFORM public.stocky_lifecycle_shared_lock(v_domain);
  PERFORM public.stocky_source_content_lock(v_domain, p_source_content_digest);
  SELECT count(*), min(id) INTO live_n, live_id
  FROM public."ShopInstallGeneration"
  WHERE "canonicalDomain" = v_domain AND fence = 'LIVE';
  IF live_n <> 1 OR live_id IS NULL THEN
    RAISE EXCEPTION 'admission_generation_ambiguous' USING ERRCODE = 'P0001';
  END IF;
  -- Reconcile an existing original-admin capture of this command or source
  -- identity BEFORE applying non-fresh provenance. Retry must not be treated
  -- as a fresh capture merely because an origin row already exists.
  SELECT * INTO existing
  FROM public."OriginalAdminCapture"
  WHERE "canonicalDomain" = v_domain
    AND "commandId" = p_command_id;
  IF FOUND THEN
    IF existing."sourceKind" IS DISTINCT FROM p_source_kind
       OR existing."sourceIdentity" IS DISTINCT FROM p_source_identity
       OR existing."sourceContentDigest" IS DISTINCT FROM p_source_content_digest
       OR existing."targetKind" IS DISTINCT FROM p_target_kind
       OR existing."targetValue" IS DISTINCT FROM p_target_value THEN
      RAISE EXCEPTION 'admission_command_input_conflict' USING ERRCODE = 'P0001';
    END IF;
    IF existing."contradictedAt" IS NOT NULL
       OR public.stocky_admin_source_contradicted(v_domain, existing."sourceContentDigest", existing.id) THEN
      RAISE EXCEPTION 'capture_content_no_longer_fresh' USING ERRCODE = 'P0001';
    END IF;
    RETURN existing.id;
  END IF;
  SELECT * INTO existing
  FROM public."OriginalAdminCapture"
  WHERE "canonicalDomain" = v_domain
    AND "sourceKind" = p_source_kind
    AND "sourceIdentity" = p_source_identity
    AND "sourceContentDigest" = p_source_content_digest;
  IF FOUND THEN
    IF existing."contradictedAt" IS NOT NULL
       OR public.stocky_admin_source_contradicted(v_domain, existing."sourceContentDigest", existing.id) THEN
      RAISE EXCEPTION 'capture_content_no_longer_fresh' USING ERRCODE = 'P0001';
    END IF;
    RETURN existing.id;
  END IF;
  -- AO-03: non-fresh sighting, non-admin origin, or a different identity's
  -- admin capture of the same source digest cannot mint a fresh ADMIN capture.
  IF EXISTS (
    SELECT 1 FROM public."QueuedWorkSighting" q
    WHERE q."canonicalDomain" = v_domain
      AND q."sourceContentDigest" = p_source_content_digest
  ) OR EXISTS (
    SELECT 1 FROM public."WriterAdmissionOrigin" o
    WHERE o."canonicalDomain" = v_domain
      AND o."sourceContentDigest" = p_source_content_digest
      AND o."originalCaptureId" IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public."OriginalAdminCapture" c
    WHERE c."canonicalDomain" = v_domain
      AND c."sourceContentDigest" = p_source_content_digest
  ) THEN
    RAISE EXCEPTION 'queued_work_cannot_acquire_fresh_admin_origin' USING ERRCODE = 'P0001';
  END IF;
  -- AO-05: tenant/domain-qualified surrogate; not a globally caller-chosen command string.
  -- Domain-qualified surrogate over bytea. A text NUL is illegal; use a bytea separator.
  v_id := 'oac_' || encode(
    sha256(convert_to(v_domain, 'UTF8') || '\x00'::bytea || convert_to(p_command_id, 'UTF8')),
    'hex'
  );
  INSERT INTO public."OriginalAdminCapture"(
    id, "canonicalDomain", "shopId", "commandId", "sourceKind", "sourceIdentity",
    "sourceContentDigest", "actorIdentity", "capturedAt", "liveGenerationId",
    "targetKind", "targetValue"
  ) VALUES (
    v_id, v_domain, p_shop_id, p_command_id, p_source_kind, p_source_identity,
    p_source_content_digest, sess."actorIdentity", clock_timestamp(), live_id,
    p_target_kind, p_target_value
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_note_queued_work(
  p_canonical_domain text,
  p_shop_id text,
  p_source_kind text,
  p_source_identity text,
  p_source_content_digest text,
  p_sighted_class text DEFAULT 'QUEUED_INBOX',
  p_parent_work_id text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_class text;
  v_corr text := NULL;
  parent public."WriterAdmissionOrigin"%ROWTYPE;
BEGIN
  IF session_user IS DISTINCT FROM 'stocky_original_admission'
     AND session_user IS DISTINCT FROM 'stocky_control_plane' THEN
    RAISE EXCEPTION 'queued_sighting_principal_required' USING ERRCODE = '42501';
  END IF;
  PERFORM public.stocky_source_content_lock(p_canonical_domain, p_source_content_digest);
  v_class := COALESCE(NULLIF(p_sighted_class, ''), 'QUEUED_INBOX');
  IF p_parent_work_id IS NOT NULL AND p_parent_work_id <> '' THEN
    SELECT * INTO parent FROM public."WriterAdmissionOrigin"
     WHERE "canonicalDomain" = p_canonical_domain AND "workId" = p_parent_work_id;
    IF FOUND
       AND parent."originalCaptureId" IS NOT NULL
       AND parent."originStatus" = 'BOUND'
       AND parent."acked" IS TRUE
       AND parent."sourceContentDigest" IS NOT DISTINCT FROM p_source_content_digest THEN
      v_corr := parent."originalCaptureId";
    END IF;
  END IF;
  INSERT INTO public."QueuedWorkSighting"(
    "canonicalDomain", "shopId", "sourceKind", "sourceIdentity", "sourceContentDigest",
    "sightedClass", "sightedAt", "parentWorkId", "correlatedCaptureId"
  ) VALUES (
    p_canonical_domain, p_shop_id, p_source_kind, p_source_identity, p_source_content_digest,
    v_class, clock_timestamp(), NULLIF(p_parent_work_id,''), v_corr
  ) ON CONFLICT DO NOTHING;
  PERFORM public.stocky_mark_uncorrelated_captures_contradicted(
    p_canonical_domain, p_source_content_digest, v_class, v_corr);
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_bind_execution_context(p_work_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  wa public."WriterAdmissionOrigin"%ROWTYPE;
  v_shop text;
BEGIN
  IF session_user IS DISTINCT FROM 'stocky_runtime'
     AND session_user IS DISTINCT FROM 'stocky_control_plane' THEN
    RAISE EXCEPTION 'effect_host_principal_required' USING ERRCODE = '42501';
  END IF;
  IF p_work_id IS NULL OR p_work_id = '' THEN
    RAISE EXCEPTION 'effect_execution_context_required' USING ERRCODE = 'P0001';
  END IF;
  v_shop := NULLIF(current_setting('stocky.current_shop_id', true), '');
  SELECT * INTO wa FROM public."WriterAdmissionOrigin" WHERE "workId" = p_work_id;
  IF NOT FOUND OR wa."shopId" IS DISTINCT FROM v_shop THEN
    RAISE EXCEPTION 'effect_execution_context_invalid' USING ERRCODE = 'P0001';
  END IF;
  -- AO-04: GUC is an untrusted transaction-local locator/correlation, not a capability.
  -- Consumers can set it. The apply host always revalidates protected work + actual input.
  PERFORM set_config('stocky.trusted_work_id', wa."workId", true);
  PERFORM set_config('stocky.trusted_digest', wa."sourceContentDigest", true);
  PERFORM set_config('stocky.trusted_domain', wa."canonicalDomain", true);
  PERFORM set_config('stocky.trusted_shop', wa."shopId", true);
END;
$$;

CREATE OR REPLACE FUNCTION public.stocky_effect_commitment(
  p_canonical_domain text,
  p_shop_id text,
  p_kind text,
  p_value text,
  p_effect_id text
) RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT encode(
    sha256(convert_to(
      'pr7-effect-v1' || E'\n' ||
      p_canonical_domain || E'\n' ||
      p_shop_id || E'\n' ||
      p_kind || E'\n' ||
      p_value || E'\n' ||
      p_effect_id,
      'UTF8'
    )),
    'hex'
  );
$$;
ALTER FUNCTION public.stocky_effect_commitment(text, text, text, text, text) OWNER TO stocky_lifecycle_gate_owner;
REVOKE ALL ON FUNCTION public.stocky_effect_commitment(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stocky_effect_commitment(text, text, text, text, text) TO stocky_runtime, stocky_control_plane;

CREATE OR REPLACE FUNCTION public.stocky_apply_bound_customer_effect(
  p_canonical_domain text,
  p_shop_id text,
  p_kind text,
  p_value text,
  p_effect_id text,
  p_work_id text DEFAULT NULL,
  p_operation text DEFAULT 'CUSTOMER_WRITE',
  p_source_body text DEFAULT ''
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  -- Frozen snapshot of the modeled semantic write. All later work uses these locals.
  v_domain text;
  v_shop text;
  v_kind text;
  v_value text;
  v_effect text;
  v_op text;
  v_body text;
  v_effect_digest text;
  v_source_digest text;
  v_work text;
  wa public."WriterAdmissionOrigin"%ROWTYPE;
  v_bound text;
  v_capture text;
BEGIN
  IF session_user IS DISTINCT FROM 'stocky_runtime'
     AND session_user IS DISTINCT FROM 'stocky_control_plane' THEN
    RAISE EXCEPTION 'effect_host_principal_required' USING ERRCODE = '42501';
  END IF;
  v_domain := p_canonical_domain;
  v_shop := p_shop_id;
  v_kind := p_kind;
  v_value := p_value;
  v_effect := p_effect_id;
  v_op := COALESCE(p_operation, 'CUSTOMER_WRITE');
  v_body := COALESCE(p_source_body, '');
  IF v_domain IS NULL OR v_domain = '' OR v_shop IS NULL OR v_shop = ''
     OR v_kind IS NULL OR v_kind = '' OR v_value IS NULL OR v_value = ''
     OR v_effect IS NULL OR v_effect = '' OR v_op IS NULL OR v_op = '' THEN
    RAISE EXCEPTION 'effect_input_required' USING ERRCODE = 'P0001';
  END IF;
  -- AO-02: compute the effect commitment from this snapshot. No caller digest argument.
  v_effect_digest := public.stocky_effect_commitment(v_domain, v_shop, v_kind, v_value, v_effect);
  -- RE-02: source commitment excludes generated effect/work/command ids.
  v_source_digest := public.stocky_source_commitment(v_domain, v_shop, v_op, v_kind, v_value, v_body);
  -- AO-04: p_work_id / GUC are untrusted locators. Host revalidates protected work.
  v_work := NULLIF(p_work_id, '');
  IF v_work IS NULL THEN
    v_work := NULLIF(current_setting('stocky.trusted_work_id', true), '');
  END IF;
  IF v_work IS NULL OR v_work = '' THEN
    RAISE EXCEPTION 'effect_execution_context_required' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO wa
  FROM public."WriterAdmissionOrigin"
  WHERE "workId" = v_work
    AND "canonicalDomain" = v_domain
    AND "shopId" = v_shop;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'effect_tenant_mismatch' USING ERRCODE = 'P0001';
  END IF;
  IF wa."acked" IS NOT TRUE THEN
    RAISE EXCEPTION 'customer_admission_not_acked' USING ERRCODE = 'P0001';
  END IF;
  -- Provenance key is the source commitment (pr7-source-v1) or an opaque
  -- G1–G15 synthetic source key. It is NOT pr7-effect-v1. Generated effect
  -- ids cannot satisfy this comparison.
  IF wa."sourceContentDigest" IS DISTINCT FROM v_source_digest THEN
    RAISE EXCEPTION 'effect_digest_mismatch' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public."WriterAdmissionOriginTarget" t WHERE t."originId" = wa.id
  ) AND NOT EXISTS (
    SELECT 1 FROM public."WriterAdmissionOriginTarget" t
    WHERE t."originId" = wa.id AND t."targetKind" = v_kind AND t."targetValue" = v_value
  ) THEN
    RAISE EXCEPTION 'effect_target_mismatch' USING ERRCODE = 'P0001';
  END IF;
  -- Lock order: lifecycle + target (fact_write_guard) THEN source content. Same as admission.
  PERFORM public.stocky_fact_write_guard(v_domain, v_shop, v_kind, v_value, v_work);
  PERFORM public.stocky_source_content_lock(v_domain, wa."sourceContentDigest");
  -- Re-read origin after locks (pending recovery / contradiction may have landed).
  SELECT * INTO wa
  FROM public."WriterAdmissionOrigin"
  WHERE "workId" = v_work
    AND "canonicalDomain" = v_domain
    AND "shopId" = v_shop;
  -- First effect per work, then first effect per source (RE-02). Historical
  -- committed writes are not unwritten; a correlated child may retry the same
  -- effectId but cannot mint a second effect of the same source.
  SELECT l."effectCommitment" INTO v_bound
    FROM public."SourceEffectLink" l
   WHERE l."canonicalDomain" = v_domain AND l."workId" = v_work;
  IF FOUND THEN
    IF v_bound IS DISTINCT FROM v_effect_digest THEN
      RAISE EXCEPTION 'effect_digest_mismatch' USING ERRCODE = 'P0001';
    END IF;
    RETURN;
  END IF;
  SELECT l."effectCommitment" INTO v_bound
    FROM public."SourceEffectLink" l
   WHERE l."canonicalDomain" = v_domain
     AND l."sourceContentDigest" = wa."sourceContentDigest";
  IF FOUND THEN
    IF v_bound IS DISTINCT FROM v_effect_digest THEN
      RAISE EXCEPTION 'effect_digest_mismatch' USING ERRCODE = 'P0001';
    END IF;
    RETURN;
  END IF;
  v_capture := wa."originalCaptureId";
  IF v_capture IS NOT NULL
     AND public.stocky_admin_source_contradicted(v_domain, wa."sourceContentDigest", v_capture) THEN
    PERFORM public.stocky_mark_uncorrelated_captures_contradicted(
      v_domain, wa."sourceContentDigest", 'EFFECT_RECHECK', NULL);
    RAISE EXCEPTION 'effect_source_no_longer_fresh' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public."AuditEvent"(id, "shopId", "customerRestId")
  VALUES (v_effect, v_shop, CASE WHEN v_kind = 'CUSTOMER_REST_ID' THEN v_value ELSE NULL END);
  INSERT INTO public."SourceEffectLink"(
    "canonicalDomain", "sourceContentDigest", "effectCommitment", "workId", "effectId"
  ) VALUES (
    v_domain, wa."sourceContentDigest", v_effect_digest, v_work, v_effect
  );
END;
$$;

ALTER FUNCTION public.stocky_establish_modeled_admin_session(text, text, text) OWNER TO stocky_admission_origin_owner;
ALTER FUNCTION public.stocky_capture_original_admin_command(text, text, text, text, text, text, text, text) OWNER TO stocky_admission_origin_owner;
ALTER FUNCTION public.stocky_note_queued_work(text, text, text, text, text, text, text) OWNER TO stocky_admission_origin_owner;
ALTER FUNCTION public.stocky_bind_execution_context(text) OWNER TO stocky_lifecycle_gate_owner;
ALTER FUNCTION public.stocky_apply_bound_customer_effect(text, text, text, text, text, text, text, text) OWNER TO stocky_lifecycle_gate_owner;

REVOKE ALL ON FUNCTION public.stocky_establish_modeled_admin_session(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_capture_original_admin_command(text, text, text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_note_queued_work(text, text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_bind_execution_context(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stocky_apply_bound_customer_effect(text, text, text, text, text, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.stocky_establish_modeled_admin_session(text, text, text) TO stocky_admin_capture;
GRANT EXECUTE ON FUNCTION public.stocky_capture_original_admin_command(text, text, text, text, text, text, text, text) TO stocky_admin_capture;
GRANT EXECUTE ON FUNCTION public.stocky_note_queued_work(text, text, text, text, text, text, text) TO stocky_original_admission, stocky_control_plane;
GRANT EXECUTE ON FUNCTION public.stocky_bind_execution_context(text) TO stocky_runtime, stocky_control_plane;
GRANT EXECUTE ON FUNCTION public.stocky_apply_bound_customer_effect(text, text, text, text, text, text, text, text) TO stocky_runtime, stocky_control_plane;
GRANT EXECUTE ON FUNCTION public.stocky_source_content_lock(text, text) TO stocky_lifecycle_gate_owner;
GRANT EXECUTE ON FUNCTION public.stocky_admin_source_contradicted(text, text, text) TO stocky_lifecycle_gate_owner;
GRANT EXECUTE ON FUNCTION public.stocky_current_tenant_id() TO stocky_admin_capture;
GRANT EXECUTE ON FUNCTION public.stocky_current_tenant_context_version() TO stocky_admin_capture;
GRANT EXECUTE ON FUNCTION public.stocky_shop_canonical_domain(text, text) TO stocky_admin_capture, stocky_lifecycle_gate_owner;
GRANT EXECUTE ON FUNCTION public.stocky_lifecycle_shared_lock(text) TO stocky_admin_capture;
GRANT EXECUTE ON FUNCTION public.stocky_fact_write_guard(text, text, text, text, text) TO stocky_lifecycle_gate_owner;
GRANT EXECUTE ON FUNCTION public.stocky_participating_write_guard(text) TO stocky_lifecycle_gate_owner;
GRANT INSERT ON public."AuditEvent" TO stocky_lifecycle_gate_owner;

DROP POLICY IF EXISTS audit_gate_insert ON public."AuditEvent";
CREATE POLICY audit_gate_insert ON public."AuditEvent"
  FOR INSERT TO stocky_lifecycle_gate_owner
  WITH CHECK (true);


