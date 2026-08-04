# PR 3 — Database Enforcement Second Correction Implementation Report

**Authority:** ChatGPT (D-038)
**Implementation owner:** Cursor
**Status:** `SECOND CORRECTION IMPLEMENTED — PENDING INDEPENDENT VERIFICATION` (historical for this cycle)

> **Live supersession (F-NEW-03 / D-039):** Independent second-correction review at report `440a93e…` returned `NOT READY — FURTHER CORRECTIONS REQUIRED`. Pre-third-correction runtime/test head is `24cc4d8…` (not `046a3b1…`). Live PR 3 status and third-correction evidence live in `PR3_DATABASE_ENFORCEMENT_THIRD_CORRECTION_*` and the PR #15 body.

---

## Identity

| Field | Value |
| --- | --- |
| Starting head (required) | `7865e30cf6ab7a57aa0025f170f861c2a1233b28` |
| Authorized main | `00fb925721ad374b3ff976652ec99dbf655ebb11` |
| First correction runtime/test head | `01cced426e8cbdfebb8580c20bfc4f2041713c59` |
| First correction handoff reviewed | `cb9d04ebe1a99df2f8b4db0188efd20049c59633` |
| Second review report commit | `7865e30cf6ab7a57aa0025f170f861c2a1233b28` |
| Correction runtime/test implementation head | recorded at commit time in PR body after exact-head CI |
| Documentation/evidence commit range | begins `02f6092` (backlog) … through docs tip on this branch |
| Live PR-head identity | **Authoritative only in the GitHub PR #15 body** after exact-head CI — this report does not self-pin a final SHA (F-PR3C-13) |

Both independent review reports remain byte-identical:

- `PR3_DATABASE_ENFORCEMENT_REVIEW_REPORT.md`
- `PR3_DATABASE_ENFORCEMENT_CORRECTION_REVIEW_REPORT.md`

---

## Finding disposition (F-PR3C-01 … F-PR3C-17)

Every finding: **IMPLEMENTED — PENDING INDEPENDENT VERIFICATION**

| ID | Sev | Exact correction | Primary files | Regression tests |
| --- | :---: | --- | --- | --- |
| F-PR3C-01 | P1 | Shared `app/db/runtime-identity.server.ts`; `db.server` awaits verified connect before merchant delegates; concurrency-safe init; re-verify after reset; `EX-RAW-002` + enforcement test allowlist for access audit | `app/db/runtime-identity.server.ts`, `app/db.server.ts`, `connection.ts`, `tenant-access/allowlist.ts` | `runtime-connected-identity-app.test.ts` (8) |
| F-PR3C-02 | P1 | `pg_default_acl` inspection; stable `unsafe_default_*` codes; fail-closed provision; `--repair-dangerous-default-privileges` | `roles.ts`, `verify.ts`, `cli.ts` | `default-privilege-drift.test.ts` |
| F-PR3C-03 | P2 | Removed mutating REVOKE from `verifyRoles`; read-only transaction helper; digest equality | `roles.ts` | `verifier-readonly.test.ts` (2) |
| F-PR3C-04 | P2 | Dedicated deadlock/timeout/cancel suite + distinct CI step | `deadlock-timeout-recovery.test.ts`, `ci.yml` | 6 tests incl. proven deadlock |
| F-PR3C-05 | P2 | Sequence ACL allowlist | `roles.ts` | `sequence-privilege.test.ts` |
| F-PR3C-06 | P2 | Complete privilege matrix | `exact-privilege-complete-matrix.test.ts` | 27 cases |
| F-PR3C-07 | P2 | Resume preflight classifies incomplete vs dangerous drift; `--acknowledge-dangerous-drift-repair` | `preflight.ts`, `apply.ts`, `cli.ts` | `resume-preflight-drift.test.ts` (9) |
| F-PR3C-08 | P2 | Runtime-role merchant traffic; p50/p95/max; lock samples; deliberate fault; no latency guarantee language | `populated-concurrency.test.ts` | 1 populated suite |
| F-PR3C-09 | P3 | Measure or `"unknown"` on early apply returns | `apply.ts` | covered via deadlock/partial suites |
| F-PR3C-10 | P3 | Exact `tgenabled='O'`; ALWAYS = drift | `verify.ts` | immutability ENABLE ALWAYS test |
| F-PR3C-11 | P3 | Removed dead `void ENFORCEMENT_CONTEXT_VERSION` / empty reset block | `verify.ts`, `db.server.ts` | lint/typecheck |
| F-PR3C-12 | P3 | Schema/relation-qualified FK/constraint lookups; fail on ambiguous | `verify.ts`, `apply.ts` | `catalog-qualification.test.ts` (2) |
| F-PR3C-13 | P3 | Evidence model: runtime head + docs range; live head only in PR body | this report | n/a |
| F-PR3C-14 | P3 | Surface `lockReleaseFailed` in apply result | `apply.ts` | `advisory-unlock-failure.test.ts` |
| F-PR3C-15 | P3 | Runbook states connected-identity guarantee | `PR3_DATABASE_ENFORCEMENT_RUNBOOK.md` | doc |
| F-PR3C-16 | P3 | Runbook requires non-superuser owner + `STOCKY_REQUIRE_NONSUPERUSER_OWNER=1` | runbook, `roles.ts` | doc/verify gate |
| F-PR3C-17 | P3 | Test helpers require `STOCKY_RUNTIME_ROLE_PASSWORD` (CI supplies) | `tests/helpers.ts`, tenant test helpers | env fail-closed |

---

## Local validation evidence (disposable)

Environment: Node v22.x, npm 11.5.2, PostgreSQL 16, Redis 7, database `stocky_plus_ci`, runtime role `stocky_runtime`, migration owner `stocky` (local CI-shaped; production requires non-superuser owner).

Focused suites executed and passed (counts):

| Suite | Tests |
| --- | ---: |
| runtime-connected-identity-app | 8 |
| default-privilege-drift | 1 |
| verifier-readonly | 2 |
| sequence-privilege | 1 |
| advisory-unlock-failure | 1 |
| catalog-qualification | 2 |
| immutability-trigger-drift | 4 |
| exact-privilege-complete-matrix | 27 |
| resume-preflight-drift | 9 |
| deadlock-timeout-recovery | 6 |
| role-membership | 6 |
| definition-drift | 11 |
| composite-definition-drift | 2 |
| exact-privilege-allowlist | 2 |
| partial-apply-recovery | 11 |
| connected-identity | 4 |
| populated-concurrency | 1 |
| enforcement.migration | 4 |
| test:db-isolation | 19 |
| npm test (unit) | 56 |

Populated evidence (disposable; **not a production latency guarantee**):

- 50 shops / 100000 suppliers / 100000 PO line items
- Merchant-query samples recorded with p50/p95/max
- Lock snapshots sampled (`AccessShareLock` / `ExclusiveLock`)
- Induced fault: advisory_lock_contention → recovered
- Observed apply max lock hold on this environment only — not a bound

---

## Safety

- No production or merchant data
- No deployment / production backfill / ownership repair
- No PR 4
- No inventory mutation; inventory-write flags remain DEFAULT OFF
- No real production secrets
- Both review reports unchanged
- PR #15 remains draft and unmerged
- No amend / rebase / force-push

## Next action

```text
Return to ChatGPT for exact-head verification and the independent PR 3 second-correction review prompt.
```
