# PR 3 — Database Enforcement Third Correction Implementation Report

**Authority:** ChatGPT (D-039)
**Implementation owner:** Cursor
**Status:** `THIRD CORRECTION IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`

Do not mark findings closed. Independent Claude Code review is required.

---

## Identity

| Field | Value |
| --- | --- |
| Starting head (required) | `440a93eaf2d87a9b8cf2c7390740d79be6453d05` |
| Authorized main | `d58a897fdad96eb1dec70d0029dcc34ed9f1dd86` |
| Pre-correction runtime/test head | `24cc4d8a85374de8151c8de3d87f3a9cad7d6e9b` |
| Second review report commit | `440a93eaf2d87a9b8cf2c7390740d79be6453d05` |
| Synthetic merge (pre-correction) | `fdd617ec314b81713d7d39b1a2756a4cc06b14c4` |
| Live PR-head identity | **Authoritative only in the GitHub PR #15 body** after exact-head CI — this report does not self-pin a final SHA (F-NEW-03) |

All three independent review reports remain byte-identical and unmodified.

---

## Finding disposition

Every finding: **IMPLEMENTED — PENDING INDEPENDENT VERIFICATION**

| ID | Sev | Exact correction | Primary files | Regression tests |
| --- | :---: | --- | --- | --- |
| F-NEW-01 | P1 | Non-superuser CREATEROLE provisioning: fail closed on SUPERUSER/BYPASSRLS/CREATEDB; alter only CREATEROLE/INHERIT when different; no semantic no-op ALTER ROLE; dedicated full-lifecycle suite + CI | `roles.ts`, `helpers.ts`, `non-superuser-migration-owner.test.ts`, `ci.yml` | non-superuser suite (2) |
| F-NEW-02 | P2 | Effective function default ACL via `acldefault`/`aclexplode`; absent ≠ safe; GRANT-to-creator + REVOKE-PUBLIC; function allowlist; repair + probe | `roles.ts`, `future-function-default-privilege.test.ts` | 1 |
| F-NEW-03 | P2 | Correct chain of custody to `24cc4d8` pre-correction; mechanical runtime/test classification at handoff; PR-body live identity | control records, PR body | docs |
| F-PR3C-08 residual | P2 | Structured merchant-error classification; assert only `42501` in revocation window; pre/post success requirements | `merchant-error.ts`, `populated-concurrency.test.ts`, `merchant-error-classification.test.ts` | 3 + populated |
| P3-a | P3 | Namespace-qualified preflight FK count + composite-key column lookup with multi-match guard | `preflight.ts`, `verify.ts`, `catalog-qualification-followup.test.ts` | 2 |
| P3-b | P3 | Removed `stocky_runtime_ci_only` TypeScript fallbacks; require env | `enforcement.migration.test.ts`, `helpers.ts` | migration suite |
| P3-c | P3 | Removed stale `EX-RAW-001`; unused raw-exception detection; `EX-RAW-002` provenance | `allowlist.ts`, `scan.ts`, architecture audit | audit tests |
| P3-d | P3 | Encode PG16 creator membership (owner→runtime ADMIN, no INHERIT/SET); reject reverse/transitive | `roles.ts`, `role-creator-membership.test.ts`, architecture/runbook | 1 |

---

## Local validation evidence (disposable)

Environment: Node v22.x, npm 11.5.2, PostgreSQL 16.14, Redis 7, bootstrap `stocky` (superuser), migration owner fixtures non-superuser `CREATEROLE`, runtime fixture-local or `stocky_runtime`.

Focused new suites executed and passed:

| Suite | Tests |
| --- | ---: |
| non-superuser-migration-owner | 2 |
| future-function-default-privilege | 1 |
| merchant-error-classification | 3 |
| role-creator-membership | 1 |
| catalog-qualification-followup | 2 |
| role-membership (regression) | 6 |
| default-privilege-drift (regression) | 1 |
| architecture-audit (regression) | 25 |

Non-superuser evidence (observed): `migration_owner.rolsuper=false`, `rolbypassrls=false`, `rolcreaterole=true`, `rolcreatedb=false`; first+second provision ok; first+second apply ok; full step completion; FORCE RLS on 18 tables; dangerous SUPERUSER/BYPASSRLS fail closed with bootstrap-repair codes.

---

## Safety confirmations

- No production or merchant data
- No deployment / production backfill / ownership repair
- No PR 4
- No inventory mutation; inventory-write flags DEFAULT OFF
- No real secrets
- Independent review reports unchanged
- PR #15 remains draft and unmerged

## Next action

Return to ChatGPT for exact-head verification and the independent PR 3 third-correction review prompt.
