# Phase 1 PR 3 — Database Enforcement Second Correction Backlog

**Authority:** ChatGPT (product / architecture)
**Implementation owner:** Cursor
**Independent correction reviewer:** Claude Code
**Technical acceptance authority:** ChatGPT
**Merge authority:** User only after ChatGPT acceptance

**Source review:** `PR3_DATABASE_ENFORCEMENT_CORRECTION_REVIEW_REPORT.md` (preserved verbatim)
**Independently reviewed handoff head:** `cb9d04ebe1a99df2f8b4db0188efd20049c59633`
**Second review-report-only commit / required starting head:** `7865e30cf6ab7a57aa0025f170f861c2a1233b28`
**Actual last runtime/test implementation head (second correction):** `24cc4d8a85374de8151c8de3d87f3a9cad7d6e9b` (F-NEW-03: corrects any live claim that `046a3b1` was the last runtime/test head)
**Decision:** D-038 — Phase 1 PR 3 second corrections required

**Finding counts from second independent review:** P0: 0 · P1: 2 · P2: 6 · P3: 9

**Status legend:** every finding below uses

```text
IMPLEMENTED — PENDING INDEPENDENT VERIFICATION
```

or, for Cursor’s overall work status:

```text
SECOND CORRECTION IMPLEMENTED — PENDING INDEPENDENT VERIFICATION
```

Do **not** mark any finding closed when Cursor’s tests pass. PR 3 remains unaccepted. PR #15 remains draft and unmerged. PR 4 remains blocked. Production execution and inventory writes remain unauthorized. Inventory-write flags remain DEFAULT OFF.

---

## Identity chain of custody

| Commit | Role |
| --- | --- |
| `57016ed4b685c8958ad49d821f4afd9ea9894a9b` | First independently reviewed implementation head |
| `ebcd0263ee726829f517d729abe601c7416a0952` | First review-report-only / first correction start |
| `01cced426e8cbdfebb8580c20bfc4f2041713c59` | First correction actual last runtime/test head |
| `cb9d04ebe1a99df2f8b4db0188efd20049c59633` | First correction handoff reviewed by Claude |
| `7865e30cf6ab7a57aa0025f170f861c2a1233b28` | Second review-report-only; required second-correction starting head |
| (this cycle) | Cursor second correction — pending independent verification |

Both independent review report files must remain unchanged:

- `PR3_DATABASE_ENFORCEMENT_REVIEW_REPORT.md`
- `PR3_DATABASE_ENFORCEMENT_CORRECTION_REVIEW_REPORT.md`

---

## P1 — blocking

### F-PR3C-01 · P1 · Runtime connected-identity verification is never invoked by the application

| Field | Value |
| --- | --- |
| Severity | P1 |
| Object | `app/db.server.ts`; `scripts/tenant-enforcement/connection.ts` (`assertSafeRuntimeConnectedIdentity`, `getRuntimeClient` — no application callers) |
| Reproduction | `grep` shows zero app callers; with `DATABASE_MIGRATION_URL` absent, privileged `DATABASE_RUNTIME_URL` aliases are accepted and the app connects as table owner |
| Required correction | Shared runtime-database identity module; verify connected identity before first merchant query; fail closed; concurrency-safe init; re-verify after reset/URL change |
| Required regression test | Correct runtime succeeds; migration owner / table owner / superuser / BYPASSRLS / direct+transitive membership / ADMIN OPTION / missing SELECT / excess control priv / wrong DB / concurrent init / reset+privileged / URL change+privileged all fail before merchant query |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### F-PR3C-02 · P1 · Default privileges on future tables are undetected

| Field | Value |
| --- | --- |
| Severity | P1 |
| Object | `scripts/tenant-enforcement/roles.ts` (`verifyRoles` never reads `pg_default_acl`); `verify.ts` likewise |
| Reproduction | `ALTER DEFAULT PRIVILEGES … GRANT ALL ON TABLES TO stocky_runtime` → all verifiers `ok:true`; new table has runtime SELECT with `relrowsecurity=false` |
| Required correction | Inspect `pg_default_acl`; stable issue codes; include in roles/enforcement/drift/resume preflight/runtime identity where relevant; provisioning fails closed and requires explicit repair mode |
| Required regression test | Inject runtime/PUBLIC default table/sequence/function privileges from migration and table owners; assert exact codes; future table inaccessible until explicitly enforced |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

---

## P2 — mandatory

### F-PR3C-03 · P2 · `tenant:roles:verify` mutates and erases schema-CREATE drift

| Field | Value |
| --- | --- |
| Severity | P2 |
| Object | `scripts/tenant-enforcement/roles.ts` (`REVOKE CREATE … FROM PUBLIC` inside verify) |
| Required correction | Remove all DDL/DML from verify/drift/preflight/rls/immutability verify paths; run under read-only transaction where possible |
| Required regression test | Digest before/after equal; PUBLIC CREATE preserved and reported as `public_schema_create` |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### F-PR3C-04 · P2 · Deadlock/timeout recovery CI step is vacuous

| Field | Value |
| --- | --- |
| Severity | P2 |
| Object | `.github/workflows/ci.yml`; `partial-apply-recovery.test.ts` (no deadlock/timeout/cancel tests) |
| Required correction | Dedicated `deadlock-timeout-recovery.test.ts`; distinct CI commands for partial-apply, interruption/resume, and deadlock/timeout/cancellation |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### F-PR3C-05 · P2 · Sequence privileges outside exact allowlist

| Field | Value |
| --- | --- |
| Severity | P2 |
| Object | `scripts/tenant-enforcement/roles.ts` |
| Required correction | Inspect all `public` sequences; reject runtime/PUBLIC USAGE/SELECT/UPDATE/ownership/defaults with stable codes |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### F-PR3C-06 · P2 · Exact privilege suite covers only 2 of required cases

| Field | Value |
| --- | --- |
| Severity | P2 |
| Object | `scripts/tenant-enforcement/tests/exact-privilege-allowlist.test.ts` |
| Required correction | Mechanically explicit matrix of every required privilege-drift case with distinct stable codes |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### F-PR3C-07 · P2 · Resume preflight reports ok under dangerous drift

| Field | Value |
| --- | --- |
| Severity | P2 |
| Object | `scripts/tenant-enforcement/preflight.ts` |
| Required correction | Distinguish incomplete vs dangerous definition/privilege drift; require `--acknowledge-dangerous-drift-repair` before normalizing tampering; wrong same-named FKs remain refused |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### F-PR3C-08 · P2 · Populated concurrency evidence is not honest

| Field | Value |
| --- | --- |
| Severity | P2 |
| Object | `populated-concurrency.test.ts`; correction report / PR body claims |
| Required correction | Runtime-role merchant traffic; merchant-query p50/p95/max; pg_locks/pg_stat_activity evidence; deliberate fault; no unsupported maxLockHoldMs guarantee language |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

---

## P3 — residuals (required this cycle)

### F-PR3C-09 · P3 · `unsafe_runtime_access` asserted without measurement on early returns

| Field | Value |
| --- | --- |
| Required correction | Measure or return `"unknown"` with reason on preflight exception/failure and advisory-lock unavailable paths |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### F-PR3C-10 · P3 · `ENABLE ALWAYS TRIGGER` accepted

| Field | Value |
| --- | --- |
| Required correction | Exact expected `tgenabled = 'O'`; treat ALWAYS/disabled/replica as drift; adversarial test |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### F-PR3C-11 · P3 · Dead code remains

| Field | Value |
| --- | --- |
| Required correction | Remove `void ENFORCEMENT_CONTEXT_VERSION` and empty no-op block in `db.server.ts` |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### F-PR3C-12 · P3 · Catalog lookups lack schema/relation qualification

| Field | Value |
| --- | --- |
| Required correction | Qualify every constraint/relation/function/trigger/index/policy lookup; fail on multiple/wrong-schema matches |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### F-PR3C-13 · P3 · Self-referential final-head claims

| Field | Value |
| --- | --- |
| Required correction | Record runtime/test head + docs range; live PR head only in PR body after exact-head CI; no infinite pinning commits |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### F-PR3C-14 · P3 · Advisory-unlock failure swallowed

| Field | Value |
| --- | --- |
| Required correction | Surface structured unlock failure in final result; do not report clean success |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### F-PR3C-15 · P3 · Runbook overstates URL guarantee

| Field | Value |
| --- | --- |
| Required correction | State connected-identity verification guarantee after F-PR3C-01; migration credentials must not be in web/worker env |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### F-PR3C-16 · P3 · Non-superuser migration owner is opt-in

| Field | Value |
| --- | --- |
| Required correction | Runbook + staging/production verification require `STOCKY_REQUIRE_NONSUPERUSER_OWNER=1` (or unconditional production-like check); prefer non-superuser owner in CI where practical |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### F-PR3C-17 · P3 · Test helper hardcodes runtime password default

| Field | Value |
| --- | --- |
| Required correction | Require `STOCKY_RUNTIME_ROLE_PASSWORD` via env; CI supplies test-only value; no shared module invents a password |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

---

## Safety confirmations (required throughout)

- No production or merchant data
- No deployment / production backfill / ownership repair
- No PR 4 work
- No inventory mutation; every inventory-write flag remains DEFAULT OFF
- No real production secrets
- Both independent review reports unchanged
- PR #15 remains draft and unmerged
- No amend, rebase, or force-push

## Next action after Cursor handoff

```text
Return to ChatGPT for exact-head verification and the independent PR 3 second-correction review prompt.
```
