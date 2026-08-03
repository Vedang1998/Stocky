# PR 3 — Database Enforcement Correction Implementation Report

**Authority:** ChatGPT D-037  
**Implementation owner:** Cursor  
**Independent correction reviewer:** Claude Code (pending)  
**Status:** Correction implemented — pending independent verification  

**Branch:** `phase-1/tenant-enforcement`  
**PR:** [#15](https://github.com/Vedang1998/Stocky/pull/15) — open, **draft**, unmerged  
**Production execution:** NOT AUTHORIZED  
**Inventory writes:** UNAPPROVED / flags DEFAULT OFF  
**PR 4:** BLOCKED  

---

## Identity chain of custody

| Commit | Role |
| --- | --- |
| `57016ed4b685c8958ad49d821f4afd9ea9894a9b` | Independently reviewed implementation head (Claude original PR 3 review) |
| `0ee3ae027d746b9696c990dfbc59976f4ef56ae7` | **Actual last runtime/test implementation head before review** (corrects false `aeeecc2…` claim) |
| `ebcd0263ee726829f517d729abe601c7416a0952` | Review-report-only commit; required correction starting head |
| `b02d660…` | Correction backlog + D-037 |
| `fe16e2b…` | Exact RLS/FK/trigger verification + safe apply + identity/roles |
| `66c692e…` | Catalog parsing / prepare-verify bugfixes |
| `01cced4…` | Resumable interrupt suite + Vitest discovery + access allowlist |
| (this documentation tip) | Evidence / runbook / status sync — see `git rev-parse HEAD` at handoff |

Independent review report preserved verbatim:

`stocky-plus/docs/phases/phase-1/PR3_DATABASE_ENFORCEMENT_REVIEW_REPORT.md`

---

## Finding disposition (Cursor)

Every finding remains:

```text
IMPLEMENTATION PENDING INDEPENDENT VERIFICATION
```

Do **not** treat Cursor tests as closure.

### P1

| ID | Correction summary | Primary files | Regression tests |
| --- | --- | --- | --- |
| F-PR3-01 | Step-aware resume preflight (`initial` / `resume` / `final`); no permanent refuse on partial apply | `preflight.ts`, `apply.ts` | `partial-apply-recovery.test.ts` (11) |
| F-PR3-02 | Apply order: prepare roles (no merchant DML) → constraints → per-table RLS → verify definitions → grants → final verify; `failSafe` revokes DML unless exact verify passes | `apply.ts`, `roles.ts` | interrupt suite; populated concurrency |
| F-PR3-03 | Catalog RLS verify: `polcmd`, roles, permissive, USING/WITH CHECK vs expected predicate; detect `USING (true)`, PUBLIC, wrong key | `verify.ts`, `catalog-expect.ts` | `definition-drift.test.ts` (11) |
| F-PR3-04 | Catalog FK verify: local/ref columns+order, parent, actions, validation, deferrability; refuse same-named wrong definition | `verify.ts`, `apply.ts` | `composite-definition-drift.test.ts` (2) |
| F-PR3-05 | Recursive `pg_auth_members` membership checks; fail closed; optional `--repair-dangerous-drift` | `roles.ts` | `role-membership.test.ts` (6) |
| F-PR3-06 | Semantic URL normalize + post-connect identity (`current_user`, attributes, ownership, membership) | `connection.ts`, `db.server.ts` | `connected-identity.test.ts` (4) |

### P2 / P3

| ID | Correction summary |
| --- | --- |
| F-PR3-07 | `guard-prisma-destructive.ts`; `db:migrate`/`db:push` wrappers; expected post-enforcement schema divergence path |
| F-PR3-08 | Trigger verifier checks `tgenabled`, `tgtype`, function body markers, search_path, SECURITY DEFINER |
| F-PR3-09..11 | PUBLIC grants, excess privileges, fail-closed privileged attribute repair |
| F-PR3-12 | Per-table RLS steps (no giant multi-table transaction) |
| F-PR3-13 | Document migration-owner bypass; inspect actual table owner attributes in roles verify |
| F-PR3-14 | Structured JSON failures for lock/timeout on apply/preflight paths |
| F-PR3-15 | Derived step status (not durable false “checkpointed” claims) |
| F-PR3-16 | Worker-surface tests renamed/deferred honestly |
| F-PR3-17 | Runbook security-preserving cutover sequence (this cycle) |
| F-PR3-18 | Residual round-trip cost documented; no false perf claim |
| F-PR3-19 | LeadTimeSnapshot secondary FK documented + FK definition verify |
| F-PR3-20 | Pool scenarios: committed expansion deferred explicitly where not expanded |
| F-PR3-21..22 | Identity corrected to `0ee3ae0` as prior runtime/test head; this correction report |
| F-PR3-23 | Advisory unlock return checked |
| F-PR3-24 | Hardcoded password fallback removed; `STOCKY_RUNTIME_ROLE_PASSWORD` required |
| F-PR3-25..26 | Reset helper / Proxy receiver hardened |
| F-PR3-27 | Dead code cleanup in verify/apply paths |
| F-PR3-28 | Preflight skip inventory not usable to bypass apply safety gates |
| F-PR3-29 | Restored `$queryRaw` tagged API; mocks model production API |

---

## Capable-local verification environment

| Item | Value |
| --- | --- |
| Node | v22.14.0 |
| npm | 11.5.2 |
| PostgreSQL | 16.14 (Ubuntu) |
| Redis | 7.0.15 |
| Migration identity | `stocky` (superuser in disposable CI fixture — **not** production) |
| Runtime role | `stocky_runtime`: NOSUPERUSER, NOBYPASSRLS, NOCREATEROLE, NOCREATEDB, NOINHERIT, LOGIN |
| Production / merchant data | **none** |
| Production credentials | **none** |

---

## Populated-scale evidence (disposable only)

Fixture:

- 50 Shops
- 100,000 `Supplier` rows
- 100,000 `POLineItem` rows
- Concurrent SELECT/UPDATE traffic during apply

Observed (`tenant_populated_enforcement_evidence`):

```json
{
  "shops": 50,
  "suppliers": 100000,
  "polineItems": 100000,
  "applyOk": true,
  "maxLockHoldMs": 67,
  "p50": 1,
  "p95": 10,
  "max": 67,
  "unsafe": false,
  "deadlocksObserved": 0,
  "resumeOk": true,
  "classification": "populated-scale",
  "emptySmokeClaim": false
}
```

**Honesty:**

- Empty-database smoke timings are **not** representative.
- This populated run is disposable-local evidence only.
- Production evidence is **not collected** and **not claimed**.
- Backup restoration for production cutover: **unexecuted** (not authorized).

---

## Focused adversarial suite counts (capable-local)

| Suite | Command / file | Passed |
| --- | ---: | ---: |
| RLS / composite / trigger definition drift | `definition-drift.test.ts` | 11 |
| Composite FK definition drift | `composite-definition-drift.test.ts` | 2 |
| Immutability trigger drift | `immutability-trigger-drift.test.ts` | 3 |
| Partial-apply / interruption / resume | `partial-apply-recovery.test.ts` | 11 |
| Role-membership escalation | `role-membership.test.ts` | 6 |
| Exact privilege allowlist | `exact-privilege-allowlist.test.ts` | 2 |
| Connected identity | `connected-identity.test.ts` | 4 |
| Populated concurrency | `populated-concurrency.test.ts` | 1 |
| Aggregate migrations config | `npm run test:migrations` | **150** |
| DB isolation | `npm run test:db-isolation` | **19** |
| Unit | `npm test` | **56** |

CLI verifiers after correction apply (disposable):

- `tenant:enforcement:verify` → `ok:true`
- `tenant:enforcement:drift` → `ok:true`
- `tenant:roles:verify` → `ok:true`
- `tenant:rls:verify` → `ok:true`
- `tenant:immutability:verify` → `ok:true`

Adversarial probes reproduced review failures and then restored clean:

- `USING (true)` → verifier fail → re-apply clean
- `GRANT stocky TO stocky_runtime` → roles verify fail → revoke clean

---

## CI

Exact-head CI for the final documentation tip must be recorded after this commit lands. Prior correction runtime tip `01cced4…` must show named correction steps succeeding with nonzero tests (file-path selection; no zero-match `-t` filters).

Required named steps (CI workflow):

- Tenant RLS definition-drift tests
- Tenant composite-definition drift tests
- Tenant immutability-trigger drift tests
- Tenant unsafe partial-apply recovery tests
- Tenant enforcement interruption/resume tests
- Tenant role-membership escalation tests
- Tenant exact privilege allowlist tests
- Tenant runtime connected-identity tests
- Tenant populated enforcement concurrency tests
- Tenant enforcement deadlock/timeout recovery tests

---

## Safety confirmation

- No production or merchant data accessed
- No deployment
- No production backfill
- No guessed ownership repair
- No PR 4 work
- No inventory mutation
- Every inventory-write flag remains DEFAULT OFF
- No real production secret committed
- PR #15 remains draft and unmerged
- No rebase / amend / force-push
- Independent review report unchanged

---

## Residual risks (new IDs — not closed)

See RISK_REGISTER: R-080..R-085. Status:

```text
Correction implemented — pending independent verification
```

Q-011, F-016, R-022 through R-029 remain open.

---

## Next action

```text
Return to ChatGPT for exact-head triage and the independent PR 3 correction-review prompt.
```
