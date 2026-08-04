# Phase 1 PR 3 — Independent Third-Correction Review Report

**Implementation owner:** Cursor
**Independent reviewer:** Claude Code
**Technical acceptance authority:** ChatGPT
**Merge authority:** User only after ChatGPT acceptance

**Source backlog:** `PR3_DATABASE_ENFORCEMENT_THIRD_CORRECTION_BACKLOG.md`
**Source implementation report:** `PR3_DATABASE_ENFORCEMENT_THIRD_CORRECTION_IMPLEMENTATION_REPORT.md`

---

## Verdict

```text
READY FOR CHATGPT PR 3 ACCEPTANCE
```

**Finding counts:** P0: 0 · P1: 0 · P2: 0 · P3: 4 (new, non-blocking residuals)

Every P1 and P2 finding carried into this cycle is independently verified closed.
The non-superuser migration-owner lifecycle was reproduced end-to-end in a
disposable environment built by the reviewer, not by re-running Cursor's fixture
alone. No previously closed P1/P2 control regressed.

This verdict authorizes **only** ChatGPT's PR 3 technical acceptance decision. It
does not authorize merge, production migration execution, production backfill,
ownership repair, PR 4, or enabling inventory writes.

---

## 1. Identity

| Field | Value |
| --- | --- |
| Current authorized base (`origin/main`) | `d58a897fdad96eb1dec70d0029dcc34ed9f1dd86` |
| Exact reviewed implementation head | `01dbb6fd97b38864894069dd3ee30524a236e764` |
| `origin/phase-1/tenant-enforcement` | `01dbb6fd97b38864894069dd3ee30524a236e764` |
| Third-correction starting head | `440a93eaf2d87a9b8cf2c7390740d79be6453d05` |
| Merge base of range | `440a93eaf2d87a9b8cf2c7390740d79be6453d05` (exact) |
| Commits in range | 8 (exactly as expected; no rewritten history) |
| **Live synthetic merge ref** | `0687e2e564b7c48f869867c00a86a7d2943555aa` |
| Live synthetic merge parents | `d58a897fdad96eb1dec70d0029dcc34ed9f1dd86` + `01dbb6fd97b38864894069dd3ee30524a236e764` ✅ exact match |
| **Actual last runtime/test head** | `01dbb6fd97b38864894069dd3ee30524a236e764` (independently derived) |
| Working tree at checkout | clean |

The synthetic SHA differs from **both** SHAs named in the prompt (`30c41ef…`,
`0687e2e…` was the one live at review time) — as anticipated, GitHub regenerates
the merge ref. Only the **parents** are authoritative, and they match the
authorized base and head exactly.

### Correction-commit classification (mechanical, by changed path)

| Commit | Subject | Class |
| --- | --- | --- |
| `adbae10` | Record PR 3 third correction backlog | documentation |
| `67f63ed` | Record D-039 and third-correction risks R-091..R-094 | documentation |
| `6c44fb2` | Support non-superuser migration-owner enforcement | **runtime + enforcement tooling + test + CI** |
| `733bd6e` | Fix third-correction test fixtures and ACL verification | **runtime + test** |
| `bfe71f3` | Record PR 3 third correction implementation evidence | documentation |
| `bf3f048` | Refresh PR 3 third-correction control records and inventory | documentation |
| `1b49c05` | Align catalog qualification overload expectation with F-NEW-02 | **test** |
| `01dbb6f` | Fix non-superuser CI attribute assertion for boolean text | **CI** |

Independently derived runtime/test head: **`01dbb6f`**. It changes
`.github/workflows/ci.yml`, which is part of the mandatory test/evidence surface,
and no later commit exists in the range. Cursor's candidate is confirmed — not
accepted on assertion.

### Prior independent review reports — byte-identical

Blob hashes identical at `440a93e` and at `01dbb6f`:

| Report | Blob |
| --- | --- |
| `PR3_DATABASE_ENFORCEMENT_REVIEW_REPORT.md` | `092e0f73dda1b604671727e6f80357d8a93972e1` |
| `PR3_DATABASE_ENFORCEMENT_CORRECTION_REVIEW_REPORT.md` | `1d17ecb23c613778dadbfa6fd0c134c8823791cd` |
| `PR3_DATABASE_ENFORCEMENT_SECOND_CORRECTION_REVIEW_REPORT.md` | `3377b2af6fc1e5f3c762b0588eef4b23960dcba2` |

---

## 2. Scope verification

The third-correction range (`440a93e..01dbb6f`, 31 files, +2371/−200) contains
**none** of the prohibited categories:

| Prohibited | Present? | Evidence |
| --- | :---: | --- |
| PR 4 work | No | no event-inbox / replay / ingestion paths in range |
| Persistent event inbox or replay | No | — |
| Shopify fact ingestion | No | — |
| Forecasting | No | — |
| Purchasing / receiving / stocktake / transfer expansion | No | `git diff --name-only 440a93e..01dbb6f -- stocky-plus/app` is **empty** |
| Billing | No | — |
| AI | No | — |
| Inventory mutation | No | no `app/` change at all in range |
| Enabled inventory-write flag | No | `app/lib/feature-flags.server.ts` unchanged; `envFlag(name, defaultEnabled = false)` — all five flags DEFAULT OFF |
| Production or merchant data | No | disposable PostgreSQL only |
| Real secret | No | test-only literals, `# pragma: allowlist secret` |
| Unrelated dependency change | No | `package.json` / `package-lock.json` unchanged in range |
| Destructive legacy-column removal | No | `prisma/` unchanged in range; no `DROP COLUMN` / `DROP TABLE` outside drift-injection tests |

---

## 3. Finding disposition

| ID | Sev | Disposition | Basis |
| --- | :---: | --- | --- |
| F-NEW-01 | P1 | **CLOSED** | Reviewer-built non-superuser environment: 149/149 steps, two applies, full isolation matrix, complete dangerous-drift matrix |
| F-NEW-02 | P2 | **CLOSED** | Effective-ACL semantics verified against live catalog; 7 drift injections detected; probe-verified repair gated by explicit flag |
| F-NEW-03 | P2 | **CLOSED** | All live records state `24cc4d8` as pre-correction head; every `046a3b1` reference is explicitly marked as the corrected false claim; implementation report does not self-pin a final SHA |
| F-PR3C-08 residual | P2 | **CLOSED** (with new P3 residuals) | Structured classification implemented; two independent reproductions consistent; all four operation families exercised; runbook documents the window |
| P3-a | P3 | **CLOSED** | Decoys in another schema / another table / overloaded function proven not to produce false results and not to mask real defects |
| P3-b | P3 | **CLOSED** | `stocky_runtime_ci_only` exists only in CI env and historical documentation; helper fails closed without env |
| P3-c | P3 | **CLOSED** | Four planted probes (unused, duplicate, stale `EX-RAW-001`, wrong file) all rejected; tree restored clean |
| P3-d | P3 | **CLOSED** | Exact PG16 creator-membership direction and options reproduced; verifier rejects reverse, transitive, and off-spec options |

### New residuals raised by this review (all P3, none blocking)

| ID | Sev | Object | Evidence | Impact | Correction | Missing test |
| --- | :---: | --- | --- | --- | --- | --- |
| **P3-e** | P3 | `scripts/tenant-enforcement/merchant-error.ts:120` (`assertMerchantErrorSummary`) | The helper asserts `beforeWindowSuccess > 0`, `afterWindowSuccess > 0` and `unexpectedErrors === 0`, but never asserts `duringWindowExpectedDenial > 0`. The backlog's required assertion list includes "no expected denial occurs during the revocation window". | If a future apply completed faster than the 5 ms traffic tick, the harness would report success having produced **zero** revocation-window evidence — a vacuous pass. Observed 66 and 69 denials in two runs, so it is not currently vacuous. | Add `if (summary.duringWindowExpectedDenial <= 0) throw` to `assertMerchantErrorSummary`. | assertion that a zero-denial summary fails |
| **P3-f** | P3 | `scripts/tenant-enforcement/tests/populated-concurrency.test.ts:350-379` | The traffic loop runs SELECT→INSERT→UPDATE→DELETE inside one transaction; `timed()` rethrows, so the first 42501 aborts the transaction and the remaining operations never execute. Both reviewer runs recorded `byOperation: {SELECT: 66}` / `{SELECT: 69}` — **no INSERT/UPDATE/DELETE denial was ever observed**. | Denial-window behaviour is evidenced for reads only. All four families are exercised successfully pre/post, so the "one family never exercised" bar is met, but the failure matrix is single-family. | Issue each operation family in its own transaction, or add a per-family probe inside the window. | per-operation denial coverage in the revocation window |
| **P3-g** | P3 | `merchant-error.ts:133-152`; `verify.ts:509-522` | Two dead guards: the trailing `for` loop in `assertMerchantErrorSummary` cannot throw (both branches `continue` or fall through); `composite_key_ambiguous` can never fire because `pg_class` enforces uniqueness of `(relname, relnamespace)` and the query is already namespace-scoped. | No safety impact — the real controls (`unexpectedErrors`, namespace qualification) are correct and were proven live. Misleading as evidence of a guard that exists. | Remove the dead loop; either drop the ambiguity guard or widen it to a cross-schema count that can actually fire. | — |
| **P3-h** | P3 | `.github/workflows/ci.yml:315-330` | The step creates `stocky_mig_ci` and asserts `false,false,true,false` on it, but `non-superuser-migration-owner.test.ts` uses `createNonSuperuserMigrationOwnerFixture`, which creates its **own** `stocky_mig_<suffix>` role. `stocky_mig_ci` is never used by the lifecycle. | The shell assertion is decorative. The substantive assertion is inside the test and **is** correct — CI logs show `"migration_owner":"stocky_mig_full_mse1wspy","rolsuper":false,…`. No false confidence in practice, but the step's visible gate does not gate the thing it names. | Assert the fixture owner's attributes (already emitted as `non_superuser_migration_owner_attrs`) rather than a decoy role, or drop the decoy role. | — |

### Observation (not a finding)

The PR #15 body records the post-correction synthetic merge as
`30c41ef42e74649d08462611944b5a0ccfc84ed6`; the live merge ref at review time was
`0687e2e564b7c48f869867c00a86a7d2943555aa`. Both carry the correct parents.
GitHub regenerates synthetic merges; a body-recorded synthetic SHA is inherently
transient and should not be treated as an identity control.

---

## 4. Non-superuser migration-owner lifecycle matrix (F-NEW-01)

Environment built by the reviewer — **not** Cursor's fixture. Bootstrap authority
was used only to create the database and the migration owner, then disconnected.

### Roles and attributes

| Role | rolsuper | rolbypassrls | rolcreaterole | rolcreatedb | rolinherit | Owns |
| --- | :---: | :---: | :---: | :---: | :---: | --- |
| `stocky` (bootstrap) | **true** | false | false | false | true | nothing in `rev_nonsu` after handover |
| `rev_mig` (migration owner) | **false** | **false** | **true** | **false** | false | schema `public` + all 25 tables |
| `rev_rt` (runtime) | **false** | **false** | **false** | **false** | **false** | **no merchant object** |

### Complete lifecycle under `rev_mig` only

| # | Step | Result |
| --: | --- | --- |
| 1 | `npx prisma migrate deploy` | ✅ all migrations applied |
| 2 | `tenant:indexes:apply -- --apply` | ✅ `"failed":[]` |
| 3 | `tenant:indexes:verify` | ✅ `ok:true`, `mismatches:[]` |
| 4 | `tenant:roles:provision -- --apply` (first) | ✅ `ok:true`, `createdRuntimeRole:true`, `errors:[]` |
| 5 | `tenant:roles:provision -- --apply` (second, idempotent) | ✅ `ok:true`, `createdRuntimeRole:false`, `detectedDrift:[]`, `errors:[]` |
| 6 | `tenant:enforcement:preflight` | ✅ `ok:true` |
| 7 | `tenant:enforcement:plan` | ✅ |
| 8 | `tenant:enforcement:apply -- --apply` (first) | ✅ `ok:true`, **149/149 completed**, `unsafe_runtime_access:false` |
| 9 | `tenant:enforcement:apply -- --apply` (second, idempotent) | ✅ `ok:true`, **149/149 completed** |
| 10 | `tenant:roles:verify` | ✅ `ok:true`, `failures:[]` |
| 11 | `tenant:rls:verify` | ✅ `ok:true`, `issues:[]` |
| 12 | `tenant:immutability:verify` | ✅ `ok:true`, `issues:[]` |
| 13 | `tenant:enforcement:verify` | ✅ `ok:true`, `issues:[]` |
| 14 | `tenant:enforcement:drift` | ✅ `ok:true`, `issues:[]` |

**Required step count 149/149 — met.** Cursor's own suite independently reproduced
the same figure (`{"completed_steps":149,"total_steps":149,"forced_rls_tables":18}`),
as did exact-head CI.

### Live catalog state after enforcement (non-superuser database)

| Expected | Observed |
| --- | --- |
| 18 merchant tables | 18 |
| RLS enabled on all 18 | `rls_enabled=18` |
| RLS **forced** on all 18 | `rls_forced=18` |
| 72 policies | `policies=72` |
| 18 immutability triggers | `triggers=18` (all `tgenabled='O'`) |
| 18 composite tenant keys | `composite_unique_idx=18` |
| 8 composite tenant FKs | `composite_fk=8` |
| Table owner | `rev_mig` × 25 (runtime owns nothing) |
| Function ACLs | `stocky_current_tenant_id` / `…_context_version` = `{rev_mig=X/rev_mig,rev_rt=X/rev_mig}`; `stocky_prevent_shop_id_mutation` = `{rev_mig=X/rev_mig}` (**not** runtime-executable) |
| Default privileges | `rev_mig` function defacl, schema **and** global: `{rev_mig=X/rev_mig}` — PUBLIC EXECUTE removed |

### Role-attribute handling — proven

| Requirement | Result |
| --- | :---: |
| Never attempts `NOSUPERUSER` under non-superuser owner | ✅ SUPERUSER drift produced `runtime_role_superuser_requires_bootstrap_repair`, no `ALTER ROLE` attempted |
| Never attempts `NOBYPASSRLS` under that owner | ✅ `runtime_role_bypassrls_requires_bootstrap_repair` |
| Reads those attributes first | ✅ structured codes emitted before any mutation |
| Fails closed with bootstrap-repair codes | ✅ all three privileged attributes |
| Changes only legally alterable attributes | ✅ `repaired:runtime_can_createrole`, `repaired:runtime_has_inherit` succeeded from the **non-superuser** owner |
| Avoids semantic no-op `ALTER ROLE` | ✅ second provision: `detectedDrift:[]`, no role alteration |
| Second provisioning performs no forbidden alteration | ✅ `ok:true`, `createdRuntimeRole:false` |
| No bare PostgreSQL permission error escapes | ✅ no `permission denied to alter role` anywhere in any run |

### Dangerous-drift matrix

| Injected drift | Verifier result | Repair policy |
| --- | --- | --- |
| Runtime safe (baseline) | `ok:true` | — |
| Runtime `INHERIT` (alterable) | `dangerous_role_attribute_drift:runtime_has_inherit:repair_required` | explicit `--repair-dangerous-drift` only; **no silent repair** |
| Runtime `CREATEROLE` (alterable) | `dangerous_role_attribute_drift:runtime_can_createrole:repair_required` | explicit flag only |
| Runtime `SUPERUSER` | `runtime_role_superuser_requires_bootstrap_repair` | **bootstrap repair required**; flag does not override |
| Runtime `BYPASSRLS` | `runtime_role_bypassrls_requires_bootstrap_repair` | bootstrap repair required |
| Runtime `CREATEDB` | `runtime_role_createdb_requires_bootstrap_repair` | bootstrap repair required |
| Runtime member of migration owner | `member_of:rev_mig`, `member_of_createrole:rev_mig` | rejected |
| Transitive privileged membership | rejected (PostgreSQL itself also refuses the circular grant while the creator edge exists) | rejected |

With `repairDangerousDrift: true`, SUPERUSER/BYPASSRLS still failed closed —
confirming no silent repair of privileged attributes and no incomplete
enforcement reported as success.

### Direct tenant-isolation proof (runtime role, post-enforcement)

| Test | Expected | Observed |
| --- | --- | --- |
| No tenant context | 0 merchant rows | `T1 rows=0` ✅ |
| Wrong context version | 0 rows | `rows=0` ✅ |
| Shop A context | only Shop A | `sup_a` ✅ |
| Shop B context | only Shop B | `sup_b` ✅ |
| Cross-tenant INSERT | fail | `new row violates row-level security policy` ✅ |
| Cross-tenant UPDATE | 0 rows or fail | `UPDATE 0` ✅ |
| `shopId` reassignment | fail | `stocky_tenant_key_immutable: shopId cannot be changed` ✅ |
| Same-tenant `shopId` no-op write | succeed | `UPDATE 1` ✅ (control) |
| Composite cross-tenant parent | fail | `violates foreign key constraint "SupplierSkuMapping_shopId_supplierId_fkey"` ✅ |
| Same-tenant child insert | succeed | `INSERT 0 1` ✅ (control) |
| `SET ROLE` to migration owner | fail | `permission denied to set role "rev_mig"` ✅ |
| Inherited/transitive owner authority | none | `pg_has_role(USAGE)=false`, `MEMBER=false` ✅ |
| `CREATE TABLE` | fail | `permission denied for schema public` ✅ |
| `DISABLE ROW LEVEL SECURITY` | fail | `must be owner of table Supplier` ✅ |
| Execute immutability trigger fn | fail | `permission denied for function stocky_prevent_shop_id_mutation` ✅ |
| `TRUNCATE` merchant table | fail | `permission denied for table Supplier` ✅ |
| Read `_prisma_migrations` | fail | `permission denied for table _prisma_migrations` ✅ |

---

## 5. PostgreSQL 16 creator-membership behaviour (P3-d)

Reproduced independently after `rev_mig` (non-superuser, `CREATEROLE`) created
`rev_rt`:

```text
role=rev_rt  member=rev_mig  grantor=postgres  admin_option=true  inherit_option=false  set_option=false
```

| Property | Result |
| --- | :---: |
| Direction is **migration owner → runtime** | ✅ (`roleid=rev_rt`, `member=rev_mig`) |
| Forbidden direction **runtime → migration owner** absent | ✅ |
| Runtime cannot `SET ROLE` to migration owner | ✅ `permission denied to set role "rev_mig"` |
| Runtime cannot inherit owner authority | ✅ `inherit_option=false`; `pg_has_role(…,'USAGE')=false` |
| Runtime cannot reach it transitively | ✅ PostgreSQL refuses the circular grant; after forcibly breaking the creator edge, the verifier rejects it |
| Owner's administration of runtime is **explicitly bounded** | ✅ verifier accepts **only** `admin=true, inherit=false, set=false` |
| Verifier does not misclassify the safe owner→runtime relationship | ✅ `roles:verify ok:true` in clean state |
| Verifier does **not** broadly allow arbitrary membership involving runtime | ✅ re-granting as `WITH ADMIN OPTION` (which yields `set_option=true`) was rejected: `unexpected_runtime_role_member:rev_mig:admin=true:inherit=false:set=true` |

Reverse membership, transitive membership, and unexpected ADMIN/SET options were
each tested independently.

---

## 6. Future-function default-privilege matrix (F-NEW-02)

### Effective-default semantics — verified against the live catalog

`has_function_privilege('public', …)` was positively controlled: a probe function
returned `public_exec=false` under enforced defaults, and `true` immediately after
an explicit `GRANT EXECUTE … TO PUBLIC`. The PUBLIC check is real, not vacuous.

| State | `proacl` of new probe function | PUBLIC EXECUTE | runtime EXECUTE |
| --- | --- | :---: | :---: |
| Clean enforced (after provision 1 & 2, apply 1 & 2) | `{stocky=X/stocky}` | **false** | **false** |
| defacl rows deleted (truly absent → built-in `acldefault`) | `NULL` | **true** | **true** |
| After flag-gated repair | `{stocky=X/stocky}` | **false** | **false** |

**"Absent function default-ACL row = unsafe when effective PUBLIC EXECUTE
remains" is proven true and is what the implementation encodes.**

### Drift injections — all detected

| # | Injection | Detected by `roles:verify` / `enforcement:drift` / preflight |
| --: | --- | --- |
| 1 | Safe override removed → built-in PUBLIC EXECUTE | ✅ `unsafe_default_function_priv:public:stocky:public:EXECUTE` |
| 2 | Explicit PUBLIC default function EXECUTE | ✅ same code, all three verifiers |
| 3 | Explicit runtime default function EXECUTE | ✅ `unsafe_default_function_priv:runtime:stocky:public:EXECUTE` |
| 4 | Unsafe defaults owned by **another** creator role | ✅ `unsafe_default_function_priv:public:other_creator:public:EXECUTE` — and a role that merely *could* create is caught earlier by `public_schema_create` |
| 5 | Multiple unsafe function defaults | ✅ both codes reported together |
| 6 | PUBLIC execute on an unexpected existing function | ✅ `unexpected_function:zz_other():owner:other_creator` |
| 7 | Runtime execute on an unapproved function | ✅ `runtime_function_execute:<signature>` |

`tenant:enforcement:preflight` also flips to `ok:false`, so a resume cannot
proceed over the hole.

### Repair mode

| Requirement | Result |
| --- | :---: |
| Repair requires the explicit flag | ✅ without it: `dangerous_default_acl_drift:…:repair_required`, exit code 1 |
| No verifier mutates | ✅ drift persisted unchanged across repeated verify runs (`verifier-readonly` 2/2) |
| Before/after evidence recorded | ✅ `repaired_default_acl:before=2:after=0:codes=…:probe=ok` |
| Effective result tested by creating a new function | ✅ built-in probe, plus reviewer's own independent probe |
| Incomplete repair fails closed | ✅ `default_acl_repair_incomplete` / `default_acl_repair_probe_failed` paths present and gated |
| Unrelated ACL entries preserved | ✅ `{stocky=X/stocky}` retained; only PUBLIC/runtime removed |

### Existing-function allowlist — independent classification

| Function | Class | Runtime EXECUTE | Correct? |
| --- | --- | :---: | :---: |
| `stocky_current_tenant_id()` | tenant-context helper | **yes** (intended) | ✅ |
| `stocky_current_tenant_context_version()` | tenant-context helper | **yes** (intended) | ✅ |
| `stocky_prevent_shop_id_mutation()` | trigger function | **no** | ✅ |
| any other | unexpected | — | ✅ rejected via `unexpected_function:` |

Overloads are rejected with argument-signature qualification:
planting `public.stocky_current_tenant_id(int)` produced
`ambiguous_function_overload:stocky_current_tenant_id:count:2` plus
`unsafe_function_search_path:stocky_current_tenant_id(integer)`.

---

## 7. Merchant-error matrix (F-PR3C-08 residual)

`merchant-error.ts` records only safe structured metadata — operation, SQLSTATE,
normalized class, enforcement phase, `dmlExpectedRevoked`, expectedness, relative
ms. **No merchant row values and no SQL parameters are logged.** Verified by
reading every field of `MerchantErrorRecord` and the emitted evidence JSON.

### Two independent reproductions

| Metric | Run 1 | Run 2 |
| --- | ---: | ---: |
| Total samples | 402 | 437 |
| Successes | 336 | 368 |
| Failures | 66 | 69 |
| Failure rate | 0.164 | 0.158 |
| `bySqlstate` | `42501`: 66 | `42501`: 69 |
| `byOperation` | `SELECT`: 66 | `SELECT`: 69 |
| `byPhase` | `during_apply`: 66 | `during_apply`: 69 |
| beforeWindowSuccess | 4 | 4 |
| duringWindowExpectedDenial | 66 | 69 |
| afterWindowSuccess | 88 | (≥1) |
| **unexpectedErrors** | **0** | **0** |
| Latency p50 / p95 / max (ms) | 0.395 / 3.692 / 567.3 | 0.454 / 4.608 / 681.2 |

Consistent, reproducible, and honest — the failure rate is *reported*, not hidden.

### Traffic coverage by operation and phase

| Operation | Succeeded pre-window | Succeeded post-window | Failed during window |
| --- | :---: | :---: | :---: |
| SELECT | ✅ | ✅ | ✅ (66 / 69) |
| INSERT | ✅ | ✅ | **never observed** (P3-f) |
| UPDATE | ✅ | ✅ | **never observed** (P3-f) |
| DELETE | ✅ | ✅ | **never observed** (P3-f) |

All four families **are** genuinely exercised — `successfulOperations` is asserted
to equal exactly `["DELETE","INSERT","SELECT","UPDATE"]`, so the "aggregate
success while a family was never exercised" failure mode is closed. The residual
is narrower: within the denial window, only the *first* operation of each
transaction can fail, so denial evidence is read-only (P3-f).

### Required assertions

| Test must fail if… | Implemented? |
| --- | :---: |
| unknown SQLSTATE occurs | ✅ any non-42501 is `expected:false` → `unexpected_errors` throw; plus explicit "every key is 42501" assertion |
| error before the documented window | ✅ `isExpectedMerchantError` returns false outside `during_apply` |
| `42501` after runtime grants restored | ✅ same |
| any error after enforcement completes | ✅ same |
| runtime remains unavailable | ✅ `no_successful_traffic_after_apply` |
| no traffic succeeds before enforcement | ✅ `no_successful_traffic_before_apply` |
| **no expected denial during the window** | ❌ **not asserted — P3-e** |
| no traffic succeeds after enforcement | ✅ `no_successful_traffic_after_apply` |
| cross-tenant data becomes visible | ✅ covered by `test:db-isolation` (19) and the reviewer's direct matrix, not by this harness |
| any operation produces an unclassified failure | ✅ outer catch records `operation:"unknown"` as unexpected |

**Only `42501` is accepted inside the revocation window** — confirmed both in
`PERMITTED_REVOCATION_WINDOW_SQLSTATES` and by the observed data (100% of 135
failures across two runs were `42501`).

### Runbook honesty

`PR3_DATABASE_ENFORCEMENT_RUNBOOK.md:18` documents the bounded denial window in
the cutover sequence, names SQLSTATE `42501` as the expected class, and states
that "successful-query latency alone is not the merchant experience". Stages 3–7
of the cutover table state DML remains revoked until exact verified RLS. The
documented window is operationally honest.

---

## 8. Regression matrix — prior critical controls

Because `roles.ts` changed by ~750 lines, the earlier P1/P2 attacks were re-run.

### RLS

| Attack | Result |
| --- | --- |
| Extra permissive policy bound to `PUBLIC` | ✅ `rls:verify`, `enforcement:verify`, `enforcement:drift` all `ok:false` |
| `NO FORCE ROW LEVEL SECURITY` | ✅ `rls_not_forced` / `FORCE missing`; apply refuses (`preflightOk:false`, `applied:false`) |
| Policy rewrite / `WITH CHECK` removal / rebind to `PUBLIC` | ✅ covered by `definition-drift` (11 tests) — reviewer's direct attempts used the pre-rename policy names and correctly produced no false positive; live names are `<Table>_tenant_{select,insert,update,delete}` |
| Wrong context helper | ✅ wrong `tenant_context_version` yields 0 rows |

### Composite constraints

| Attack | Result |
| --- | --- |
| Same-named FK in another schema (decoy) | ✅ no false pass, no count inflation |
| Real public FK dropped while decoy present | ✅ `fk_missing`, preflight `ok:false`, drift `ok:false` |
| Composite index dropped (cascading 3 FKs) | ✅ `composite_key_missing` + 3× `fk_missing` |
| Wrong column order / unsafe cascade / invalid FK | ✅ `composite-definition-drift` (2), `exact-privilege-complete-matrix` (27) |

### Immutability triggers

| Attack | Result |
| --- | --- |
| `DISABLE TRIGGER` | ✅ `trigger_disabled` |
| `ENABLE REPLICA TRIGGER` | ✅ `trigger_replica_only` |
| `ENABLE ALWAYS TRIGGER` | ✅ `trigger_always_enabled` |
| Altered function body (search_path preserved) | ✅ `trigger_function_insecure_search_path` + `helper_insecure_search_path` |

### Runtime connected identity

`connected-identity` (4) and `runtime-connected-identity-app` (8) pass on the
clean database. Directly confirmed that the verifier fails **before** any merchant
query when the runtime role is a member of the migration owner — the deliberately
drifted database produced a failing `connected-identity` run, and it passed again
once the safe creator-membership shape was restored. Migration owner, table
owner, superuser, BYPASSRLS, and direct/transitive membership are all covered by
`role-membership` (6) and the drift matrix in §4.

### Verification purity

Verifiers are read-only: injected drift (FORCE RLS off, unsafe defaults, extra
policy, disabled trigger) persisted unchanged across repeated `rls:verify`,
`enforcement:verify`, `enforcement:drift`, `immutability:verify`, and
`roles:verify` invocations. `verifier-readonly` 2/2.

### Partial apply

`partial-apply-recovery` 11/11, interruption/resume subset, and
`resume-preflight-drift` 9/9 all pass. Independently confirmed that on a corrupted
tree `apply --apply` returns `ok:false`, `applied:false`, `preflightOk:false`, and
`unsafe_runtime_access:false` — it refuses rather than half-applying.

**No previously closed P1/P2 control regressed.**

---

## 9. Exact-head CI verification

| Field | Value |
| --- | --- |
| Workflow | `CI` |
| Run | `30871937846` |
| Job | `91875550816` — *Lint, typecheck, test, build, Prisma, GraphQL* |
| `head_sha` | `01dbb6fd97b38864894069dd3ee30524a236e764` ✅ |
| `head_branch` | `phase-1/tenant-enforcement` |
| Conclusion | **success** |
| Duration | 02:29:37 → 02:55:27 UTC |

**All 93 substantive named steps (1 → 93, "Set up job" → "GraphQL codegen /
schema validation") completed with `conclusion: success`. Zero skipped, zero
failed, zero cancelled.** Logs contain no `No test files found` and no
`Tests 0 passed` anywhere.

### The five third-correction steps — logs inspected, not just names

| # | Step | Command | Tests |
| --: | --- | --- | ---: |
| 45 | Tenant non-superuser migration-owner full enforcement | explicit file `non-superuser-migration-owner.test.ts` | **2** |
| 46 | Tenant future-function default-privilege tests | explicit file | **1** |
| 47 | Tenant populated merchant-error classification tests | explicit file | **3** |
| 48 | Tenant PostgreSQL role-creator membership tests | explicit file | **1** |
| 49 | Tenant catalog qualification follow-up tests | explicit file | **2** |

Every step names an explicit test file — no `-t` name filter that could pass
vacuously. (The one `-t`-filtered step, #31, is a *duplicate* narrowing of #30,
which already runs the full file.)

**The non-superuser lifecycle really used `rolsuper=false`:**

```text
migration_owner.attrs=false,false,true,false
migration_owner.rolsuper = false
{"event":"non_superuser_migration_owner_attrs","migration_owner":"stocky_mig_full_mse1wspy",
 "rolsuper":false,"rolbypassrls":false,"rolcreaterole":true,"rolcreatedb":false}
{"event":"non_superuser_enforcement_complete","completed_steps":149,"total_steps":149,
 "forced_rls_tables":18}
```

The same evidence appears twice (02:40:51 in the dedicated step, 02:49:50 in the
aggregate migration suite) with a different fixture suffix each time.

**Bootstrap credentials were not reused for the enforcement lifecycle:** the
`stocky` superuser appears only in `STOCKY_BOOTSTRAP_DATABASE_URL` for role/DB
creation; migrations, provisioning, apply, and verification all ran on
`fixture.migrationUrl` under the non-superuser owner, asserted in-test via
`expect(identity.rows[0].current_user).toBe(fixture.migrationOwner)` and
`expect(identity.rows[0].rolsuper).toBe(false)`.

See §3 P3-h for the one decorative aspect of step 45's shell preamble.

---

## 10. Capable-local execution

### Environment

| Field | Value |
| --- | --- |
| PostgreSQL | 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1) x86_64 |
| Locale / ctype | `C.UTF-8` / `C.UTF-8` |
| Bootstrap role | `stocky` — super=true, bypassrls=false, createrole=false, createdb=false, inherit=true |
| Migration owner | `rev_mig` — super=false, bypassrls=false, **createrole=true**, createdb=false, inherit=false |
| Runtime role | `rev_rt` — super=false, bypassrls=false, createrole=false, createdb=false, **inherit=false** |
| Role membership | `rev_rt` ← `rev_mig`, admin=true, inherit=false, set=false |
| Redis | 7.0.15, DBSIZE 0 at start / 7 after suites |
| Node | v22.22.2 |
| npm | **11.5.2** (exact) |
| Credentials | test-only throughout; no production or merchant data |

### Commands — exact implementation head `01dbb6f`

| Command | Outcome |
| --- | --- |
| `node --version` | `v22.22.2` |
| `npm --version` | `11.5.2` |
| `npm ci` | ✅ (2m40s) |
| `npx prisma generate` | ✅ |
| `npx prisma validate` | ✅ schema valid |
| `npx prisma migrate deploy` | ✅ all migrations applied |
| `npm run tenant:indexes:apply -- --apply` | ✅ 44 created, `failed:[]` |
| `npm run tenant:indexes:verify` | ✅ `ok:true` |
| `npm run tenant:schema:drift` | ✅ `tenant_prisma_schema_drift_ok` |
| `npm run tenant:indexes:plan` | ✅ `{"valid_exact":44}` |
| `npm run tenant:access:audit` | ✅ `tenant_access_audit_ok`, 18 models |
| `npm run tenant:access:inventory:check` | ✅ fresh |
| `npm run tenant:enforcement:inventory:check` | ✅ fresh |
| `npm run tenant:roles:provision -- --apply` | ✅ `ok:true` (×2, idempotent) |
| `npm run tenant:roles:verify` | ✅ `ok:true` |
| `npm run tenant:enforcement:preflight` | ✅ `ok:true` |
| `npm run tenant:enforcement:plan` | ✅ |
| `npm run tenant:enforcement:apply -- --apply` | ✅ `ok:true`, **149 steps**, `unsafe_runtime_access:false`, max lock hold 242 ms, step p50/p95/max 1/3/242 ms |
| `npm run tenant:enforcement:verify` | ✅ `ok:true`, `issues:[]` |
| `npm run tenant:enforcement:drift` | ✅ `ok:true`, `issues:[]` |
| `npm run tenant:rls:verify` | ✅ `ok:true` |
| `npm run tenant:immutability:verify` | ✅ `ok:true` |
| `npm run test:db-isolation` | ✅ 2 files / **19 tests** |
| `npm run test:tenant-access` | ✅ 34 files / **288 tests** |
| `npm run test:migrations` | ✅ 47 files / **216 tests** |
| `npm run test:subject-memory` | ✅ **2 tests** |
| `npm run lint` | ✅ exit 0 |
| `npm run typecheck` | ✅ exit 0 |
| `npm test` | ✅ 6 files / **56 tests** |
| `npm run build` | ✅ built |
| `npm run graphql-codegen` | ⚠️ **BLOCKED — external network** |
| `git diff --check` | ✅ exit 0, clean tree |

`graphql-codegen` fails with `403 Host not in allowlist: shopify.dev` — the
review environment's egress policy blocks the Shopify Admin schema introspection.
Per §20 this is recorded as blocked; **exact-head CI step 93 "GraphQL codegen /
schema validation" succeeded** and is used as substitute evidence.

### Focused third-correction suites (exact counts, run separately)

| Suite | Tests |
| --- | ---: |
| `non-superuser-migration-owner` | 2 |
| `future-function-default-privilege` | 1 |
| `merchant-error-classification` | 3 |
| `role-creator-membership` | 1 |
| `catalog-qualification-followup` | 2 |
| `catalog-qualification` | 2 |
| `populated-concurrency` | 1 (×2 reproductions) |
| `definition-drift` | 11 |
| `composite-definition-drift` | 2 |
| `immutability-trigger-drift` | 4 |
| `partial-apply-recovery` | 11 |
| `deadlock-timeout-recovery` | 6 |
| `role-membership` | 6 |
| `exact-privilege-allowlist` | 2 |
| `exact-privilege-complete-matrix` | 27 |
| `sequence-privilege` | 1 |
| `default-privilege-drift` | 1 |
| `verifier-readonly` | 2 |
| `connected-identity` | 4 |
| `runtime-connected-identity-app` | 8 |
| `resume-preflight-drift` | 9 |
| `advisory-unlock-failure` | 1 |
| `enforcement.migration` | 3 |

No suite reported zero tests. No filter passed vacuously.

### Commands — live synthetic merge tree `0687e2e`

Checked out in a separate worktree at `0687e2e564b7c48f869867c00a86a7d2943555aa`.

**Executable surface is byte-identical to the head:**
`git diff --name-only 01dbb6f origin/pr-15-merge -- stocky-plus/{app,scripts,prisma,package.json,package-lock.json,vitest.*.ts} .github` is **empty**;
`.github` tree hash matches exactly (`b3baeed0…`). The only difference is
`.cursor/rules/*.mdc` and `docs/agents/README.md` arriving from `main`.

| Command | Outcome |
| --- | --- |
| `tenant:access:audit` | ✅ ok |
| `tenant:access:inventory:check` | ✅ fresh |
| `tenant:enforcement:inventory:check` | ✅ fresh |
| `tenant:indexes:verify` | ✅ `ok:true` |
| `tenant:schema:drift` | ✅ `tenant_prisma_schema_drift_ok` (on a fresh migrated + indexed database; identical behaviour to head) |
| `tenant:enforcement:verify` / `:drift` | ✅ `ok:true` |
| `tenant:rls:verify` / `:immutability:verify` / `:roles:verify` | ✅ `ok:true` |
| `npm run lint` | ✅ exit 0 |
| `npm run typecheck` | ✅ exit 0 |
| `npm test` | ✅ **56 tests** |
| `npm run test:db-isolation` | ✅ **19 tests** |
| `npm run test:tenant-access` | ✅ **288 tests** |
| `npm run test:migrations` | ✅ 47 files / **216 tests** |
| `npm run test:subject-memory` | ✅ **2 tests** |
| `npm run build` | ✅ exit 0 |
| All five focused third-correction suites | ✅ 2 / 1 / 3 / 1 / 2 |
| Worktree cleanliness | ✅ clean |

Inventories regenerate clean on both trees; `git status --porcelain` empty on
both.

---

## 11. Residuals

### Acceptable PR 3 residuals (non-blocking)

- **P3-e** — `assertMerchantErrorSummary` does not require
  `duringWindowExpectedDenial > 0`; the harness could in principle pass with zero
  revocation-window evidence. Not currently vacuous (66 and 69 denials observed).
- **P3-f** — denial-window operation coverage is SELECT-only because the first
  42501 aborts the transaction. All four families succeed pre/post.
- **P3-g** — two dead guards (`assertMerchantErrorSummary` trailing loop;
  `composite_key_ambiguous`). No safety impact.
- **P3-h** — CI step 45's shell attribute assertion targets a decoy role
  (`stocky_mig_ci`) the test never uses; the substantive assertion inside the test
  is correct.
- PR body records a superseded synthetic merge SHA (`30c41ef…` vs live
  `0687e2e…`); parents are correct in both.

### Production-rollout evidence still required (out of PR 3 scope)

- Enforcement timings and the DML denial window are **environment-specific
  observations on a disposable 100k+100k fixture**, explicitly labelled
  `"not a production latency or lock-hold guarantee"`. Production-scale lock-hold
  and window-duration evidence remains outstanding.
- Real production migration-owner and runtime-role provisioning, including
  bootstrap-repair rehearsal for any pre-existing privileged runtime role.
- Managed-platform verification: some providers do not expose a non-superuser
  `CREATEROLE` owner with the assumed creator-membership semantics.

### PR 4 dependencies

- PR 4 remains blocked pending ChatGPT PR 3 acceptance and user merge.
- Runtime-role rollout must precede any PR 4 work that assumes RLS-subject
  connections.

### Blocking defects

**None.**

---

## 12. Safety confirmations

| Confirmation | Status |
| --- | :---: |
| No production data accessed | ✅ disposable local PostgreSQL only |
| No merchant data accessed | ✅ synthetic fixtures only |
| No deployment | ✅ |
| No production migration execution | ✅ |
| No backfill | ✅ |
| No ownership repair | ✅ |
| No PR 4 work | ✅ |
| No inventory mutation | ✅ |
| Inventory-write flags DEFAULT OFF | ✅ `envFlag(name, defaultEnabled = false)`; file unchanged in range |
| No real secrets | ✅ test-only credentials throughout |
| Implementation unchanged by reviewer | ✅ every probe (allowlist entries, decoy schemas, drift injections) reverted; `git status --porcelain` empty at `01dbb6f` |
| Independent review reports unchanged | ✅ all three blobs byte-identical |
| PR #15 remains open, draft, unmerged | ✅ `state:open`, `draft:true`, `merged:false` |
| This commit adds only this report | ✅ single-file staged diff |

---

## 13. Next action

```text
Return to ChatGPT for PR 3 technical acceptance decision.
```
