# Phase 1 PR 3 — Independent Second-Correction Review Report

**Reviewer:** Claude Code (independent)
**Implementation owner:** Cursor
**Technical acceptance authority:** ChatGPT
**Merge authority:** User, only after ChatGPT acceptance

---

## Verdict

```text
NOT READY — FURTHER CORRECTIONS REQUIRED
```

**Counts:** P0: 0 · P1: 1 · P2: 3 · P3: 4

The second correction cycle is substantial and largely genuine. Fifteen of the
seventeen findings are independently reproduced as closed. The blocking defect is
not a regression in the corrected code — it is that the **production-like rollout
configuration mandated by F-PR3C-16 cannot execute at all**, and CI cannot detect
this because CI runs as a cluster superuser.

---

## 1. Identity

| Field | Value |
| --- | --- |
| Current re-authorized base (`origin/main`) | `d58a897fdad96eb1dec70d0029dcc34ed9f1dd86` |
| Exact reviewed implementation head | `24cc4d8a85374de8151c8de3d87f3a9cad7d6e9b` |
| `origin/phase-1/tenant-enforcement` | `24cc4d8a85374de8151c8de3d87f3a9cad7d6e9b` |
| Synthetic merge SHA | `fdd617ec314b81713d7d39b1a2756a4cc06b14c4` |
| Synthetic merge parents | `d58a897fdad96eb1dec70d0029dcc34ed9f1dd86` + `24cc4d8a85374de8151c8de3d87f3a9cad7d6e9b` |
| **Actual last runtime/test head** | **`24cc4d8a85374de8151c8de3d87f3a9cad7d6e9b`** (not `046a3b1` — see F-NEW-03) |
| Correction range | `7865e30…24cc4d8` |
| Correction commit count | 7 |
| Working tree at review | clean (`git status --porcelain` empty for tracked files) |
| Checkout | detached at `24cc4d8`, verified by `git rev-parse HEAD` |

Identity gate passed exactly: both required SHAs matched on first fetch. No base or
head movement occurred during the review.

### Chain of custody

| Commit | Classification |
| --- | --- |
| `02f60928773812ae5c39bb8228a6b67d65822706` | docs — second correction backlog |
| `823326fe012950a84e7c3df74b52a96778c9c20b` | docs — D-038, R-086..R-090 |
| `046a3b1e8975fc38cfd09141ed87fee4b6050a00` | **runtime + test** (23 files) |
| `a7335eba878412bec18bf97be4a76c8adfc7ca25` | **runtime + test + CI** (`apply.ts`, `cli.ts`, `verify.ts`, `ci.yml`, trigger-drift test) |
| `478f92f4cfed3744543ec11d1b2333f6389213b6` | docs + **runtime + test** (`preflight.ts`, 4 test files) |
| `acdfd115e0053cd101f58bac889059b4cb71d261` | docs + **runtime** (`tenant-access/allowlist.ts`, `scan.ts`) |
| `24cc4d8a85374de8151c8de3d87f3a9cad7d6e9b` | docs + **runtime + test** (`allowlist.ts`, `architecture-audit.test.ts`) |

History was **not** rewritten: `merge-base(7865e30, 24cc4d8) = 7865e30`, and every
prior identity SHA (`00fb925`, `57016ed`, `ebcd026`, `01cced4`, `cb9d04e`, `7865e30`)
is an ancestor of the reviewed head.

**Both prior review reports are byte-identical to their preserved versions:**

| File | Blob at original commit | Blob at `24cc4d8` |
| --- | --- | --- |
| `PR3_DATABASE_ENFORCEMENT_REVIEW_REPORT.md` | `092e0f73dda1b604671727e6f80357d8a93972e1` | `092e0f73dda1b604671727e6f80357d8a93972e1` |
| `PR3_DATABASE_ENFORCEMENT_CORRECTION_REVIEW_REPORT.md` | `1d17ecb23c613778dadbfa6fd0c134c8823791cd` | `1d17ecb23c613778dadbfa6fd0c134c8823791cd` |

---

## 2. Base-drift disposition

```text
Current-base governance change:
REVIEWED — NON-OVERLAPPING AND NON-RUNTIME
```

PR #18 (`d58a897`, squash-merged onto `00fb925`) changed 13 files: twelve
`.cursor/rules/*.mdc` files and `stocky-plus/docs/agents/README.md`. No runtime,
Prisma, migration, CI, enforcement-tooling, test or Phase 1 control record was
touched.

**Overlap analysis:** PR #15 changes 75 files. `comm -12` of the two changed-file
sets is **empty** — zero path overlap.

**Combined-tree result:** `git diff 24cc4d8 origin/pr-15-merge` returns exactly the
13 PR #18 files and nothing else. The combined tree is therefore byte-identical to
the reviewed head across every executable path (runtime, scripts, tests, CI,
Prisma, migrations). GitHub produced the synthetic merge cleanly; no conflict
exists. `mergeable_state` is `behind`, which is expected and non-blocking since no
rebase was authorized.

**Reauthorization is valid.** No rebase or merge-from-main is required.

---

## 3. Scope verification

The correction range contains **no** PR 4 work, synchronization control-plane work,
Shopify fact ingestion, forecasting, PO/receiving/stocktake/transfer feature
expansion, billing, AI, inventory mutation, production data, merchant data, real
secrets, unrelated dependency change, or destructive legacy-column removal.

All inventory-write flags remain default OFF, verified in `.github/workflows/ci.yml`
(`FEATURE_STOCKTAKE_INVENTORY_WRITES`, `FEATURE_ADJUSTMENT_WRITES`,
`FEATURE_RECEIPT_WRITES`, `FEATURE_COST_SYNC`, `FEATURE_TRANSFER_WRITES` all
`"false"`; `ALLOW_DEV_SUBSCRIPTION_ACTIVATE: "false"`).

---

## 4. Blocking and new findings

### F-NEW-01 · **P1** · Enforcement cannot run under the mandated non-superuser migration owner

| Field | Value |
| --- | --- |
| File / line | `stocky-plus/scripts/tenant-enforcement/roles.ts:401` and `:408` |
| Evidence | `ALTER ROLE <runtime> NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS` is issued **unconditionally**, including at line 408 in the `else` branch that runs when attributes are already correct (a semantic no-op). |
| Merchant impact | The documented staging/production rollout path is non-functional. Enforcement — NOT NULL, RLS ENABLE/FORCE, tenant policies, immutability triggers, composite keys/FKs — is never installed. Tenant isolation is not established. |

PostgreSQL permits `NOSUPERUSER` and `NOBYPASSRLS` in `ALTER ROLE` **only to a role
holding the SUPERUSER attribute**. Isolated per-clause locally on PostgreSQL 16.13:

```text
NOSUPERUSER    -> ERROR:  permission denied to alter role
NOCREATEDB     -> ALTER ROLE
NOCREATEROLE   -> ALTER ROLE
NOINHERIT      -> ALTER ROLE
NOBYPASSRLS    -> ERROR:  permission denied to alter role

DETAIL: Only roles with the SUPERUSER attribute may change the SUPERUSER attribute.
```

Reproduction with a non-superuser `CREATEROLE` migration owner (`stocky`,
`rolsuper = f`), which is exactly what runbook line 14 and F-PR3C-16 mandate:

```text
$ npm run tenant:roles:provision -- --apply     # second (idempotent) run
permission denied to alter role                 # bare text, no JSON event, no issue code
rc=1

$ STOCKY_REQUIRE_NONSUPERUSER_OWNER=1 npm run tenant:enforcement:apply -- --apply
apply ok = False
   helpers        completed
   roles_prepared failed   "permission denied to alter role"
   pending steps: 147 of 149
```

`CREATE ROLE … NOSUPERUSER … NOBYPASSRLS` (line 376) **is** accepted from a
`CREATEROLE` role, so first-time provisioning succeeds and the failure only appears
on the second run and on every `enforcement:apply`. This is a directly
self-contradicting pair of corrections: F-PR3C-16 adds
`STOCKY_REQUIRE_NONSUPERUSER_OWNER=1` to *require* a non-superuser owner, while the
apply path *requires* a superuser owner to proceed.

CI cannot detect this: the CI `postgres:16-alpine` service creates `POSTGRES_USER:
stocky` as a **cluster superuser**, so `roles_prepared` always succeeds there.

**Expected behavior:** re-assert only the attributes a `CREATEROLE` owner may set,
and verify `rolsuper` / `rolbypassrls` read-only (they are already read in
`existing.rows[0]`), failing closed with a structured code if either is set.

**Missing test:** an enforcement apply/provision test executed under a non-superuser
`CREATEROLE` migration owner. Every current enforcement test runs as superuser.

---

### F-NEW-02 · **P2** · Future-function default privileges remain permissive and undetected

| Field | Value |
| --- | --- |
| File / line | `stocky-plus/scripts/tenant-enforcement/roles.ts:559-563` (preventive block) |
| Merchant impact | Latent. Any function added by a future migration is `EXECUTE`-able by `stocky_runtime` and by `PUBLIC`, and no verifier reports it. |

The preventive `ALTER DEFAULT PRIVILEGES … REVOKE ALL ON FUNCTIONS FROM PUBLIC`
stores **no** `pg_default_acl` row and has no effect. Reproduced on a clean, fully
enforced database:

```text
rows after REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC : 0
probe4 proacl                                      : NULL
has_function_privilege('stocky_runtime', probe4)   : t
tenant:roles:verify        rc=0 "ok":true
tenant:enforcement:drift   rc=0 "ok":true
```

`collectDefaultAclFailures` reports only *explicit GRANT entries* present in
`pg_default_acl`; an **absent** row is treated as safe, but for functions the
absent row *is* the unsafe state (PostgreSQL's built-in default is `PUBLIC
EXECUTE`). `verifyRoles` checks `EXECUTE` on exactly two named functions
(`roles.ts:930`, `:939`, `:954`), not arbitrary `public` functions.

The §10 required proof therefore **fails for functions**. It holds for tables and
sequences — but only because PostgreSQL's built-in defaults are already restrictive
there, not because the preventive block does anything:

```text
future table    SELECT/INSERT/UPDATE/DELETE/TRIGGER/TRUNCATE/REFERENCES  runtime=f public=f
future sequence USAGE/SELECT/UPDATE                                      runtime=f
future function EXECUTE                                                  runtime=t   <-- FAIL
```

No current exposure: the three existing `public` functions are correctly ACL'd —
`stocky_current_tenant_id` and `stocky_current_tenant_context_version` are
intentionally runtime-executable; `stocky_prevent_shop_id_mutation` is
`{stocky=X/stocky}` and **not** runtime-executable.

**Expected behavior:** verify `proacl` on every `public` function against an
allowlist, or write an explicit default-ACL entry that survives in
`pg_default_acl`.

**Missing test:** create a function post-enforcement and assert neither `PUBLIC` nor
the runtime role holds `EXECUTE`.

---

### F-NEW-03 · **P2** · Reported runtime/test head is inaccurate

| Field | Value |
| --- | --- |
| Object | PR #15 body ("New runtime/test implementation head: `046a3b1`"); `PR3_DATABASE_ENFORCEMENT_SECOND_CORRECTION_BACKLOG.md` |

`046a3b1` is **not** the last runtime/test commit. Four later commits changed
runtime, test and CI files:

- `a7335eb` — `apply.ts`, `cli.ts`, `verify.ts`, `.github/workflows/ci.yml`, `immutability-trigger-drift.test.ts`
- `478f92f` — `preflight.ts`, `composite-definition-drift.test.ts`, `definition-drift.test.ts`, `immutability-trigger-drift.test.ts`, `partial-apply-recovery.test.ts`
- `acdfd11` — `tenant-access/allowlist.ts`, `tenant-access/scan.ts`
- `24cc4d8` — `tenant-access/allowlist.ts`, `architecture-audit.test.ts`

The actual last runtime/test head is **`24cc4d8`**, which equals the PR head — so no
untested code shipped, and CI did cover it. The defect is in the recorded evidence,
which F-PR3C-13 was specifically raised to make honest.

---

### F-PR3C-08 residual · **P2** · Merchant error rate recorded but unclassified and unasserted

`populated-concurrency.test.ts:342` swallows every merchant-traffic failure with a
bare `catch { merchantErrors += 1 }` — no SQLSTATE, no message — and **no assertion
bounds it**. Observed across two independent runs: `errors: 69 / 321 samples` and
`errors: 72 / 309 samples` (~22%), with the suite passing.

I classified them independently by instrumenting the same traffic pattern against
`tenant:enforcement:apply`:

```text
TRAFFIC CONNECTED AS: stocky_runtime
APPLY ok= true
MERCHANT TOTAL=343 SUCCESS=265 FAILED=78 (22.7%)
ERROR CLASSIFICATION:
     78 x 42501: permission denied for table Supplier
```

Every failure is the deliberate merchant-DML revocation window. The **behavior is
by design and documented** — the runbook shows DML revoked at steps 3–6 and granted
only at step 7, and in the intended rollout the app is still on the privileged URL
during that window. So this is an evidence/supportability gap, not a safety gap:
the published evidence emphasises p50/p95/max of *successful* queries while the
single most merchant-visible effect appears only as an opaque integer.

**Expected behavior:** classify errors by SQLSTATE in the evidence and assert that
the only permitted class during apply is the expected `42501` window.

---

### P3 residuals

| ID | Finding |
| --- | --- |
| P3-a | **F-PR3C-12 incomplete.** `preflight.ts:214-217` counts `pg_constraint` with no `connamespace` filter, and `verify.ts:491-496` matches `pg_class.relname` with no namespace filter or multiple-match guard. I built a cross-schema decoy FK of an identical name; the unqualified count did rise to 38 while `public` held 37, but preflight still returned `ok:false` because corroborating qualified checks caught the missing constraint. Not exploitable as observed; the qualification requirement is nonetheless not fully met. |
| P3-b | **F-PR3C-17 incomplete.** `enforcement.migration.test.ts:32` and `:126` still invent `stocky_runtime_ci_only` when `STOCKY_RUNTIME_ROLE_PASSWORD` is absent. The *shared* helper (`tests/helpers.ts:18-21`) correctly refuses, so the finding's letter is met; the pattern survives in one test file. |
| P3-c | Stale allowlist entry: `EX-RAW-001` (`app/db.server.ts`) is retained but the audit assertion was moved to `EX-RAW-002`, so it is no longer asserted as used. Honestly annotated in the diff. |
| P3-d | Environment note: on PostgreSQL 16 a non-superuser `CREATEROLE` owner is **auto-granted membership** in roles it creates, so a real non-superuser deployment yields `stocky` as a member of `stocky_runtime`. Direction is owner→runtime and does not affect runtime identity verification, but it should be expected and asserted rather than discovered. |

---

## 5. Finding disposition — F-PR3C-01 … F-PR3C-17

| ID | Orig sev | Independent outcome | Blocks acceptance |
| --- | :---: | --- | :---: |
| F-PR3C-01 | P1 | **CLOSED** — 17/17 attack cases pass against the real application entry path | No |
| F-PR3C-02 | P1 | **PARTIALLY CLOSED** — tables/sequences fully closed; future functions not (F-NEW-02) | Yes (P2) |
| F-PR3C-03 | P2 | **CLOSED** — digest unchanged across all six commands; no mutating SQL | No |
| F-PR3C-04 | P2 | **CLOSED** — six real faults induced; 6 tests pass | No |
| F-PR3C-05 | P2 | **CLOSED** — sequence ACL allowlist enforced | No |
| F-PR3C-06 | P2 | **CLOSED** — 27-case matrix reproduced | No |
| F-PR3C-07 | P2 | **CLOSED** — dangerous drift refused; acknowledged path repairs cleanly | No |
| F-PR3C-08 | P2 | **PARTIALLY CLOSED** — scale/traffic/locks/fault/scope language genuine; error classification missing | Yes (P2) |
| F-PR3C-09 | P3 | **CLOSED** — `boolean \| "unknown"` with reason on early-return paths | No |
| F-PR3C-10 | P3 | **CLOSED** — `tgenabled` `'D'`/`'R'`/`'A'` and any non-`'O'` treated as drift | No |
| F-PR3C-11 | P3 | **CLOSED** — dead code gone; `db.server.ts` now 110 lines | No |
| F-PR3C-12 | P3 | **PARTIALLY CLOSED** — two unqualified lookups remain (P3-a) | No |
| F-PR3C-13 | P3 | **NOT CLOSED** — head claim inaccurate (F-NEW-03) | Yes (P2) |
| F-PR3C-14 | P3 | **CLOSED** — structured `advisory_unlock_failed` with backend PID and recovery hint | No |
| F-PR3C-15 | P3 | **CLOSED** — runbook claim verified true by attack case 16b | No |
| F-PR3C-16 | P3 | **NOT CLOSED** — mandated configuration is non-functional (F-NEW-01) | Yes (P1) |
| F-PR3C-17 | P3 | **PARTIALLY CLOSED** — shared helper refuses; one test file still invents (P3-b) | No |

---

## 6. Attack matrices

### 6.1 Connected identity (F-PR3C-01) — application runtime

Executed against the **actual application entry path**: the default export of
`app/db.server.ts`, invoking `prisma.supplier.findMany({ take: 1 })` — the same
proxy TenantDb, routes and workers use. Module cache busted per case.

| # | Case | Expected | Result |
| :---: | --- | :---: | --- |
| 1 | Correct restricted runtime role | allow | **PASS** — merchant query succeeded |
| 2 | Migration owner | deny | **PASS** |
| 3 | Table owner of a merchant table | deny | **PASS** — `runtime_user_mismatch` |
| 4 | Superuser | deny | **PASS** |
| 5 | BYPASSRLS | deny | **PASS** |
| 6 | CREATEROLE | deny | **PASS** |
| 7 | CREATEDB | deny | **PASS** |
| 8 | Direct owner membership | deny | **PASS** |
| 9 | Transitive owner membership | deny | **PASS** |
| 10 | ADMIN OPTION membership | deny | **PASS** |
| 11 | Role missing required grants | deny | **PASS** |
| 12 | Role with control-table privileges | deny | **PASS** |
| 13 | Unexpected database identity | deny | **PASS** |
| 14 | Reset then privileged replacement | deny | **PASS** |
| 15 | Concurrent first init (12 parallel, privileged) | deny | **PASS** — 12/12 rejected |
| 16 | Semantically aliased privileged URL (`postgres://`, `localhost`) | deny | **PASS** |
| 16b | **Privileged URL with migration URL ABSENT** | deny | **PASS** — `runtime_identity_rejected:runtime_user_mismatch:expected=stocky_runtime:got=stocky` |

**17 cases, 17 passed, 0 failed.** Case 16b is decisive: it is the exact original
F-PR3C-01 bypass, and rejection came from **connected-identity verification**, not
URL comparison. Migration-URL presence is not required to detect a privileged role.

Supporting structural verification: the only `new PrismaClient` on any application
runtime path is `runtime-identity.server.ts:463`; the default export is a Proxy
that awaits `getVerifiedRuntimePrisma()` before every client method and every model
delegate; failure disconnects the client, clears `prismaGlobal`, caches the failure
and leaves no usable global client; concurrent callers share one init promise.

### 6.2 Default privileges (F-PR3C-02)

Ten injections; for each, all four commands (`tenant:roles:verify`,
`tenant:enforcement:verify`, `tenant:enforcement:drift`, resume preflight) were run
and the ACL re-checked afterwards.

| # | Injection | All 4 commands | Issue code |
| :---: | --- | :---: | --- |
| 1 | runtime default table SELECT | rc=1 | `unsafe_default_table_priv:runtime:stocky:public:SELECT` |
| 2 | runtime default table INSERT | rc=1 | `…:INSERT` |
| 3 | runtime default table UPDATE | rc=1 | `…:UPDATE` |
| 4 | runtime default table DELETE | rc=1 | `…:DELETE` |
| 5 | PUBLIC default table | rc=1 | `unsafe_default_table_priv:public:stocky:public:SELECT` |
| 6 | runtime default sequence | rc=1 | `unsafe_default_sequence_priv:runtime:…:USAGE` + `:SELECT` |
| 7 | PUBLIC default sequence | rc=1 | `unsafe_default_sequence_priv:public:…:USAGE` |
| 8 | PUBLIC default function EXECUTE | rc=1 | `unsafe_default_function_priv:public:…:EXECUTE` |
| 9 | Defaults created by a distinct owner (`stocky_migration`) | rc=1 | `unsafe_default_table_priv:runtime:stocky_migration:public:SELECT` |
| 10 | Multiple unsafe entries simultaneously | rc=1 | all three codes reported, none masked |

Codes are stable and distinct, include the defining owner, and every case restored
cleanly (`drift ok:true`, `pg_default_acl` back to 0 rows).

**Non-repair proven:** with one unsafe entry present, all four verifiers were run
and `pg_default_acl` still held exactly 1 row afterwards, byte-identical
(`stocky_migration -> {stocky_runtime=r/stocky_migration}`).

**Explicit repair mode:**

| Scenario | Result |
| --- | --- |
| Without `--repair-dangerous-default-privileges` | Refused: `dangerous_default_acl_drift:…:repair_required`, rc=1 |
| With flag, entry owned by a non-merchant owner | `repaired_default_acl:before=1:after=1`, then `default_acl_repair_incomplete:…` — fails closed, does **not** claim clean |
| With flag, repairable entries | `repaired_default_acl:before=5:after=0`, `errors:[]`, `pg_default_acl` = 0 rows |

Before/after evidence is recorded, only intended entries are removed, and
incomplete repair is surfaced rather than hidden.

**Future objects after clean setup:** tables and sequences grant nothing to runtime
or PUBLIC; **functions do** — see F-NEW-02.

### 6.3 Read-only verifiers (F-PR3C-03)

Catalog digest (md5 over `pg_class` ACL/RLS flags, `pg_namespace` ACL, `pg_policy`
expressions, `pg_trigger` enable states, `pg_proc` ACLs, `stocky%` role attributes)
captured before and after each command. Baseline `0551bc82077dff6d91cbc3eeefcd79a4`.

| Command | rc | Digest |
| --- | :---: | --- |
| `tenant:roles:verify` | 0 | UNCHANGED |
| `tenant:rls:verify` | 0 | UNCHANGED |
| `tenant:immutability:verify` | 0 | UNCHANGED |
| `tenant:enforcement:verify` | 0 | UNCHANGED |
| `tenant:enforcement:drift` | 0 | UNCHANGED |
| `tenant:enforcement:preflight` | 0 | UNCHANGED |

`GRANT CREATE ON SCHEMA public TO PUBLIC` injection:

```text
ACL before : {stocky=UC/stocky,=UC/stocky,stocky_runtime=U/stocky}
tenant:roles:verify        rc=1  public_schema_create
tenant:enforcement:verify  rc=1  public_schema_create
tenant:enforcement:drift   rc=1  public_schema_create
resume preflight           rc=1  public_schema_create
ACL after  : {stocky=UC/stocky,=UC/stocky,stocky_runtime=U/stocky}   (unchanged)
repeat run : rc=1  public_schema_create                              (identical)
after restore: drift ok:true
```

This is the direct regression proof — the previous `REVOKE CREATE … FROM PUBLIC`
inside verify is gone. Static scan of `verify.ts` and the `verifyRoles` body found
no `GRANT`/`REVOKE`/`ALTER`/`CREATE`/`DROP`/DML statements (only comments and
identifier strings). A `SET TRANSACTION READ ONLY` wrapper exists at
`roles.ts:179`.

### 6.4 Privilege matrix (F-PR3C-05 / F-PR3C-06)

`exact-privilege-complete-matrix.test.ts` — **27/27 pass**; `role-membership.test.ts`
— **6/6**; `exact-privilege-allowlist.test.ts` — **2/2**; `sequence-privilege.test.ts`
— **1/1**. Cases include PUBLIC merchant-table SELECT/INSERT/UPDATE/DELETE, runtime
TRIGGER/TRUNCATE/REFERENCES, sequence USAGE/SELECT/UPDATE and ownership, PUBLIC and
runtime schema CREATE, unsafe default ACLs, PUBLIC function EXECUTE, runtime
control-table and `_prisma_migrations` access, merchant-table ownership,
direct/transitive membership and ADMIN OPTION. My independent injections (§6.2,
§6.3) confirmed distinct codes with no masking and clean restoration.

> **Reviewer note.** On first execution four suites reported seven failures
> (`role "stocky" is a member of role "stocky_runtime"`). I traced this to
> PostgreSQL 16 auto-granting role membership to a non-superuser `CREATEROLE`
> creator in my initial environment — an artifact of my setup, **not** a code
> defect. After rebuilding the cluster CI-equivalently, all four suites passed
> (27/27, 8/8, 9/9, 6/6). Recorded as P3-d.

### 6.5 Resume-preflight dangerous drift (F-PR3C-07)

Independently reproduced end to end by dropping a real composite FK
(`BomComponent_shopId_fkey_shop`) from a fully enforced database:

```text
baseline                      preflight ok:true  mode:resume
after dropping real FK        preflight ok:false mode:resume
  recoveryHint: "Dangerous definition/privilege drift detected — re-run with
                 --acknowledge-dangerous-drift-repair only after reviewing exact
                 codes; verifiers remain read-only"
ordinary apply                REFUSED (does not silently normalize)
apply --acknowledge-dangerous-drift-repair   ok:true
post-repair: preflight/verify/drift/roles/rls/immutability   all ok:true
```

Preflight distinguishes incomplete state from dangerous drift, does not return
clean, preserves evidence, and requires the explicit acknowledgement flag. The
suite's own nine cases (policy `USING (true)`, disabled immutability trigger,
direct and transitive owner membership, PUBLIC merchant grant, runtime DML with RLS
disabled, dropped composite FK, wrong same-named FK `fk_wrong_definition`, unsafe
default ACL, PUBLIC schema CREATE) all pass. Wrong same-named constraints are
refused rather than silently replaced.

### 6.6 Fault recovery (F-PR3C-04)

`deadlock-timeout-recovery.test.ts` — **6/6 pass**, and the file is genuinely
adversarial, not vacuous:

| Fault | Mechanism | Classification |
| --- | --- | --- |
| Conflicting lock | `LOCK TABLE … ACCESS EXCLUSIVE` + `SHARE MODE NOWAIT` | fails safely, resumes |
| Real deadlock | two transactions, `statement_timeout 5s`; asserts `error.message` contains `"deadlock"` — proves PostgreSQL's detector fired | `kind: "deadlock"`, bounded retries |
| `lock_timeout` | `SET LOCAL lock_timeout = '100ms'` against ACCESS EXCLUSIVE | `kind: "lock_timeout"` |
| `statement_timeout` | `SET statement_timeout = '75ms'` | `kind: "statement_timeout"` |
| Cancellation | `pg_cancel_backend($1)` | fails safely, resumes |
| Advisory-lock contention | held advisory lock | `advisory_lock_unavailable`, measured safety, resumes |

Every case asserts `unsafe_runtime_access` is measured, no false completed
checkpoint is recorded, and verification/drift are clean after resume. The CI step
`Tenant deadlock-timeout-cancellation recovery tests` (#32) executes this exact file
and ran nonzero tests.

### 6.7 Populated concurrency (F-PR3C-08)

Independently executed; fixture assertions in the test itself enforce the scale.

| Metric | Run A | Run B |
| --- | --- | --- |
| Shops / Supplier rows / POLineItem rows | 50 / 100,000 / 100,000 | same |
| Traffic connection | `stocky_runtime` (independently confirmed) | same |
| Merchant p50 / p95 / max (ms) | 0.427 / 4.841 / 8.539 | 0.462 / 5.115 / 609.628 |
| Merchant samples / errors | 321 / 69 | 309 / 72 |
| Enforcement step p50 / p95 / max (ms) | 1 / 5 / 179 | 1 / 5 / 192 |
| Lock snapshots | 111 | 112 |
| Deliberate fault | advisory-lock contention → `advisory_lock_unavailable`, recovered | same |
| `unsafe_runtime_access` | false | false |

Cursor's output and mine agree on structure and order of magnitude. The evidence
carries honest scope language — `"emptySmokeClaim": false` and
`"evidenceScope": "environment-specific observation; not a production latency or
lock-hold guarantee"` — which resolves the prior unsupported `maxLockHoldMs`
guarantee. The `max` figure varies 8.5 ms → 609.6 ms between runs, correctly *not*
presented as a guarantee.

Two gaps: errors are unclassified and unasserted (see F-PR3C-08 residual above),
and every lock sample carries `blockingPid: null` with no wait duration, so the
evidence demonstrates absence of contention rather than the ability to detect it.

---

## 7. CI verification

| Field | Value |
| --- | --- |
| Workflow | `CI` |
| Run | `30847912646` |
| Job | `91800631206` — *Lint, typecheck, test, build, Prisma, GraphQL* |
| `head_sha` | `24cc4d8a85374de8151c8de3d87f3a9cad7d6e9b` |
| Conclusion | **success** |
| Started / completed | 2026-08-03T19:55:53Z / 2026-08-03T20:19:55Z |
| Attempt | 1 |

**88 substantive steps, all `conclusion: success`. Zero skipped, zero failed.**
(Plus 4 post/cleanup steps, also success.)

The run occurred **after** PR #18 moved main: `d58a897` committed 19:36:08Z, run
started 19:55:51Z — a 19-minute margin.

Every named second-correction step ran and executed nonzero tests (confirmed by
local re-execution of each file):

| # | Step | Local tests |
| :---: | --- | :---: |
| 32 | Tenant deadlock-timeout-cancellation recovery | 6 |
| 34 | Tenant exact privilege allowlist | 2 |
| 35 | Tenant exact privilege complete-matrix | 27 |
| 36 | Tenant sequence privilege | 1 |
| 37 | Tenant default-privilege drift | 1 |
| 38 | Tenant verifier read-only | 2 |
| 39 | Tenant runtime connected-identity | 4 |
| 40 | Tenant runtime connected-identity application | 8 |
| 41 | Tenant resume-preflight corrected-state drift | 9 |
| 42 | Tenant catalog qualification | 2 |
| 43 | Tenant advisory-unlock failure | 1 |
| 44 | Tenant populated runtime-traffic concurrency | 1 |

Each step uses its intended explicit test file. GraphQL codegen (step 88) succeeded.

**Checkout ref:** the retrievable job log (tail-truncated by the API) did not
include the `actions/checkout` ref resolution, so I could not confirm from logs
alone whether CI tested the head directly or GitHub's synthetic merge ref. I
therefore executed the full suite locally on **both** trees (§8). Because the
combined tree differs from the reviewed head only in twelve `.cursor/rules/*.mdc`
files and `docs/agents/README.md`, the distinction is immaterial to every
executable path.

---

## 8. Local execution

**Environment:** PostgreSQL 16.13 (local cluster, port 5433) · Redis 7.0.15 (port
6380) · Node v22.22.2 · **npm 11.5.2** (pinned, matching `packageManager`) ·
`NODE_ENV=test` · test-only credentials only · no production or merchant data.

### 8.1 Exact implementation head `24cc4d8`

| Command | Result |
| --- | --- |
| `npx prisma generate` / `validate` / `migrate deploy` | OK |
| `tenant:indexes:apply --apply` / `:verify` | 44 indexes created; `ok:true` |
| `tenant:schema:drift` | `tenant_prisma_schema_drift_ok` |
| `tenant:enforcement:inventory:check` | fresh |
| `tenant:access:inventory:check` | fresh |
| `tenant:roles:provision --apply` | `ok:true` |
| `tenant:enforcement:apply --apply` | `ok:true` — 149/149 steps completed, `unsafe_runtime_access:false` |
| `tenant:roles:verify` | rc=0 `ok:true` |
| `tenant:rls:verify` | rc=0 `ok:true` |
| `tenant:immutability:verify` | rc=0 `ok:true` |
| `tenant:enforcement:verify` | rc=0 `ok:true` |
| `tenant:enforcement:drift` | rc=0 `ok:true` |
| `tenant:enforcement:preflight` | rc=0 `ok:true` |
| `tenant:access:audit` | rc=0 |
| `npm run lint` | rc=0 |
| `npm run typecheck` | rc=0 |
| `npm test` | **6 files / 56 tests** passed |
| `npm run test:db-isolation` | **2 files / 19 tests** passed |
| `npm run test:migrations` (full) | **42 files / 208 tests** passed |
| `npm run test:tenant-access` (full) | **34 files / 287 tests** passed |
| `npm run test:subject-memory` | **1 file / 2 tests** passed |
| `npm run build` | rc=0 |
| `npm run graphql-codegen` | rc=0 (network available; not blocked) |
| `git diff --check` | rc=0 |

Focused second-correction suites, run individually: **18 files / 102 tests, all
passing** (6, 2, 27, 1, 1, 2, 4, 8, 9, 2, 1, 1, 4, 11, 2, 11, 4, 6).

### 8.2 Synthetic merge tree `fdd617e`

| Command | Result |
| --- | --- |
| `npm run lint` | rc=0 |
| `npm run typecheck` | rc=0 |
| `tenant:access:audit` | rc=0 |
| `tenant:access:inventory:check` | rc=0 |
| `tenant:enforcement:inventory:check` | rc=0 |
| `npm test` | **6 files / 56 tests** passed |
| `npm run test:db-isolation` | **2 files / 19 tests** passed |
| `npm run test:migrations` (full) | **42 files / 208 tests** passed |
| `npm run test:tenant-access` (full) | **34 files / 287 tests** passed |

Results are identical to the exact head. Inventories were regenerated and the
tracked working tree remained clean throughout both runs.

### 8.3 Reviewer-authored adversarial scripts

Four scripts were written for this review and kept **outside** the repository (in
the session scratchpad). None is committed: a default-ACL attack matrix, an
application-runtime identity attack harness, a merchant-error classification probe,
and a cross-schema FK confusion exploit.

---

## 9. Residuals

### Acceptable PR 3 residuals
- P3-a — two unqualified catalog lookups; not exploitable as observed.
- P3-b — one test file retains a test-only password fallback; shared helper refuses.
- P3-c — stale `EX-RAW-001` allowlist entry, honestly annotated.
- P3-d — PostgreSQL 16 `CREATEROLE` auto-membership; expected and benign in direction.
- Lock evidence shows no contention (`blockingPid: null` throughout); acceptable as an observation.

### Blocking defects
- **F-NEW-01 (P1)** — enforcement cannot run under the mandated non-superuser migration owner.
- **F-NEW-02 (P2)** — future functions remain runtime/PUBLIC executable and undetected.
- **F-NEW-03 (P2)** — inaccurate runtime/test head in PR body and backlog.
- **F-PR3C-08 residual (P2)** — merchant error rate unclassified and unasserted.

### Production-rollout evidence still required
- A green enforcement apply under a genuine non-superuser `CREATEROLE` migration owner (blocked by F-NEW-01).
- Merchant-impact evidence with SQLSTATE classification across the apply window.
- Lock evidence captured under real contention (non-null `blockingPid`, wait durations).
- Post-enforcement function-ACL verification.
- Production-scale timing; current figures are disposable-environment observations only.

### PR 4 dependencies
PR 4 remains blocked. It additionally depends on F-NEW-01 being resolved, since the
production enforcement path is currently non-executable.

---

## 10. Safety confirmation

- No production data accessed.
- No merchant data accessed.
- No deployment performed.
- No production backfill performed.
- No ownership repair performed.
- No PR 4 work performed.
- No inventory mutation performed.
- All inventory-write flags remain DEFAULT OFF.
- No real secrets used or recorded; all credentials are local test-only values.
- **Implementation unchanged by the reviewer** — no runtime, test, CI, Prisma,
  migration or configuration file was modified. The only committed change is this
  report.
- Both prior independent review reports remain byte-identical.
- PR #15 remains **open, draft and unmerged** (`state: open`, `draft: true`,
  `merged: false`, head `24cc4d8`, base `main` `d58a897`).
- No amend, rebase, force-push, or merge of main into the feature branch.

---

## 11. Next action

```text
Return to ChatGPT for the exact Cursor PR 3 third-correction prompt.
```
