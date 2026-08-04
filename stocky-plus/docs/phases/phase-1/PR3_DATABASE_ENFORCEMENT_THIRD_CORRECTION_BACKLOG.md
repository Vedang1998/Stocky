# Phase 1 PR 3 — Database Enforcement Third Correction Backlog

**Authority:** ChatGPT (product / architecture)
**Implementation owner:** Cursor
**Independent correction reviewer:** Claude Code
**Technical acceptance authority:** ChatGPT
**Merge authority:** User only after ChatGPT acceptance

**Source review:** `PR3_DATABASE_ENFORCEMENT_SECOND_CORRECTION_REVIEW_REPORT.md` (preserved verbatim)
**Current re-authorized base/main:** `d58a897fdad96eb1dec70d0029dcc34ed9f1dd86`
**Second-correction independently reviewed implementation head:** `24cc4d8a85374de8151c8de3d87f3a9cad7d6e9b`
**Synthetic merge independently tested:** `fdd617ec314b81713d7d39b1a2756a4cc06b14c4`
**Synthetic merge parents:** `d58a897fdad96eb1dec70d0029dcc34ed9f1dd86` + `24cc4d8a85374de8151c8de3d87f3a9cad7d6e9b`
**Independent second-correction review-report-only commit / required starting head:** `440a93eaf2d87a9b8cf2c7390740d79be6453d05`
**Actual last runtime/test head before this correction cycle:** `24cc4d8a85374de8151c8de3d87f3a9cad7d6e9b`
**Decision:** D-039 — Phase 1 PR 3 third corrections required

**Finding counts from second independent correction review:** P0: 0 · P1: 1 · P2: 3 · P3: 4

**Status legend:** every finding below uses

```text
IMPLEMENTED — PENDING INDEPENDENT VERIFICATION
```

or, for Cursor’s overall work status:

```text
THIRD CORRECTION IMPLEMENTED — PENDING INDEPENDENT VERIFICATION
```

Do **not** mark any finding closed when Cursor’s tests pass. PR 3 remains unaccepted. PR #15 remains draft and unmerged. PR 4 remains blocked. Production execution and inventory writes remain unauthorized. Inventory-write flags remain DEFAULT OFF.

---

## Identity chain of custody

| Commit | Role |
| --- | --- |
| `24cc4d8a85374de8151c8de3d87f3a9cad7d6e9b` | Actual last runtime/test head before third correction (not `046a3b1`) |
| `440a93eaf2d87a9b8cf2c7390740d79be6453d05` | Second review-report-only; required third-correction starting head |
| `d58a897fdad96eb1dec70d0029dcc34ed9f1dd86` | Current re-authorized `origin/main` |
| `fdd617ec314b81713d7d39b1a2756a4cc06b14c4` | Synthetic merge of main + `24cc4d8` |
| (this cycle) | Cursor third correction — pending independent verification |

All three independent review report files must remain unchanged:

- `PR3_DATABASE_ENFORCEMENT_REVIEW_REPORT.md`
- `PR3_DATABASE_ENFORCEMENT_CORRECTION_REVIEW_REPORT.md`
- `PR3_DATABASE_ENFORCEMENT_SECOND_CORRECTION_REVIEW_REPORT.md`

---

## P1 — blocking

### F-NEW-01 · P1 · Enforcement cannot run under the mandated non-superuser migration owner

| Field | Value |
| --- | --- |
| Severity | P1 |
| Object | `scripts/tenant-enforcement/roles.ts` (unconditional `ALTER ROLE … NOSUPERUSER … NOBYPASSRLS`, including semantic no-op branch) |
| Reproduction | Non-superuser `CREATEROLE` migration owner: second `tenant:roles:provision -- --apply` and every `tenant:enforcement:apply` fail at `roles_prepared` with bare `permission denied to alter role`; 147/149 steps remain pending; CI misses this because `POSTGRES_USER=stocky` is cluster superuser |
| Required correction | Read role attributes first; fail closed on `rolsuper` / `rolbypassrls` with bootstrap-repair codes; never alter SUPERUSER/BYPASSRLS from non-superuser migration connection; re-assert only legally alterable attributes when they differ; no semantic no-op ALTER ROLE; encode PostgreSQL 16 creator membership; dedicated non-superuser full-lifecycle suite + CI |
| Required regression test | `non-superuser-migration-owner.test.ts` + dangerous privileged-attribute drift under non-superuser owner; CI step `Tenant non-superuser migration-owner full enforcement` asserting `rolsuper=false`, `rolbypassrls=false`, `rolcreaterole=true`, `rolcreatedb=false` |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

---

## P2 — mandatory

### F-NEW-02 · P2 · Future-function default privileges remain permissive and undetected

| Field | Value |
| --- | --- |
| Severity | P2 |
| Object | `scripts/tenant-enforcement/roles.ts` (`collectDefaultAclFailures`; preventive `REVOKE` on functions stores no `pg_default_acl` row) |
| Reproduction | After clean enforcement, create probe function as object-creating role → `proacl` NULL → PUBLIC and runtime `EXECUTE` true; `roles:verify` / `enforcement:drift` still `ok:true` |
| Required correction | Persistent safe default privileges for every function-creating role (proven GRANT-to-creator + REVOKE-PUBLIC pattern); verifier uses catalog-safe effective ACL (`acldefault`/`aclexplode`); absent function defacl ≠ safe; allowlist existing application functions; repair mode with before/after + probe verification |
| Required regression test | `future-function-default-privilege.test.ts` |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### F-NEW-03 · P2 · Reported runtime/test head is inaccurate

| Field | Value |
| --- | --- |
| Severity | P2 |
| Object | PR #15 body; live control records claiming `046a3b1` as last runtime/test head |
| Reproduction | Independent review derived actual last runtime/test head `24cc4d8` (four later commits touched runtime/test/CI after `046a3b1`) |
| Required correction | Correct live control records; mechanically derive runtime/test head from changed paths at handoff; PR-body live identity; do not modify independent review reports |
| Required regression test | Mechanical classification at handoff (documentation evidence) |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### F-PR3C-08 residual · P2 · Merchant error rate recorded but unclassified and unasserted

| Field | Value |
| --- | --- |
| Severity | P2 |
| Object | `scripts/tenant-enforcement/tests/populated-concurrency.test.ts` (bare `catch { merchantErrors += 1 }`) |
| Reproduction | ~22% merchant failures during deliberate DML-revocation window; all independently classified as SQLSTATE `42501`; committed test does not assert allowed classes |
| Required correction | Structured error capture (operation, SQLSTATE, class, phase, expectedness); assert only `42501` inside revocation window; fail on unknown SQLSTATE / post-restore errors / missing pre/post success; document merchant-visible denial window |
| Required regression test | Classification assertions in populated suite + `merchant-error-classification.test.ts` |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

---

## P3 — residuals

### P3-a · Complete catalog qualification

| Field | Value |
| --- | --- |
| Severity | P3 |
| Object | `preflight.ts` composite FK count without namespace; `verify.ts` composite-key column lookup without namespace / multi-match guard |
| Required correction | Qualify every catalog lookup by schema/namespace/relation OID; reject multiple matches; decoys in other schema / other table / overloaded function |
| Required regression test | `catalog-qualification-followup.test.ts` |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### P3-b · Remove every test password fallback

| Field | Value |
| --- | --- |
| Severity | P3 |
| Object | `enforcement.migration.test.ts` invents `stocky_runtime_ci_only` when env absent |
| Required correction | Require `STOCKY_RUNTIME_ROLE_PASSWORD`; no TypeScript fallback; literal only in CI config or explicit docs |
| Required regression test | Migration suite uses shared `requireRuntimeRolePassword` / fails closed without env |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### P3-c · Remove stale raw-SQL allowlist evidence

| Field | Value |
| --- | --- |
| Severity | P3 |
| Object | `EX-RAW-001` retained but no longer asserted as used after construction moved to `EX-RAW-002` |
| Required correction | Remove unused exception; architecture audit fails on unused / duplicated / mismatched exceptions; active scanner assertion + test provenance for every remaining exception |
| Required regression test | Architecture audit unused-exception failure + `EX-RAW-002` provenance |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

### P3-d · Encode PostgreSQL 16 role-creator membership behavior

| Field | Value |
| --- | --- |
| Severity | P3 |
| Object | Non-superuser `CREATEROLE` owner auto-granted membership in roles it creates (`admin_option=true`, `inherit_option=false`, `set_option=false`) |
| Required correction | Explicit test + verifier distinction: owner→runtime administration allowed when options match; runtime→owner prohibited; transitive privileged membership rejected; architecture/runbook updated |
| Required regression test | `role-creator-membership.test.ts` |
| Status | IMPLEMENTED — PENDING INDEPENDENT VERIFICATION |

---

## Safety confirmations (unchanged)

- No production or merchant data access
- No production deployment, migration, or backfill
- No ownership repair of production tenants
- No PR 4
- No inventory mutation
- All inventory-write flags remain DEFAULT OFF
- No real secrets
- Independent review reports unchanged
- PR #15 remains draft and unmerged
