# PR 3 — Database Enforcement Independent Correction Review

**Reviewer:** Claude Code (independent)
**Implementation owner:** Cursor
**Technical acceptance authority:** ChatGPT
**Merge authority:** User only, after ChatGPT acceptance

---

## 1. Identity and chain of custody

| Field | Value |
| --- | --- |
| Repository | `Vedang1998/Stocky` |
| Application | `stocky-plus/` |
| Pull request | [#15](https://github.com/Vedang1998/Stocky/pull/15) — **open**, **draft**, **unmerged**, `mergeable_state: clean` |
| Base branch | `main` |
| Base SHA (verified) | `00fb925721ad374b3ff976652ec99dbf655ebb11` |
| Head branch | `phase-1/tenant-enforcement` |
| **Exact reviewed handoff head** | `cb9d04ebe1a99df2f8b4db0188efd20049c59633` |
| **Actual last runtime/test implementation head** | `01cced426e8cbdfebb8580c20bfc4f2041713c59` |
| Correction start (review-report-only commit) | `ebcd0263ee726829f517d729abe601c7416a0952` |
| Correction range count | **7 commits** |
| PR totals (GitHub) | 25 commits, 61 changed files, +9905 / −108 |
| Working tree at review | **clean**, detached at `cb9d04e…` |

### 1.1 Verified correction range

```
git merge-base ebcd026… cb9d04e…  →  ebcd0263ee726829f517d729abe601c7416a0952   ✓ exact
git rev-list --count ebcd026…..cb9d04e… →  7                                     ✓ exact
```

| SHA (full) | Classification | Verified |
| --- | --- | --- |
| `b02d6607a42b77aac3e3b676bcd3c0baeea7cfe5` | Documentation (backlog + D-037) | ✓ docs only |
| `fe16e2b7d2371a1e7289a11066b880f8e2386a3f` | Runtime + tests + CI (28 files) | ✓ |
| `66c692ec78037d878b6617e172c7132498c5b4ec` | Runtime (catalog parsing / prepare-verify) | ✓ |
| `01cced426e8cbdfebb8580c20bfc4f2041713c59` | **Last runtime/test commit** | ✓ |
| `a132719cbe300699f8f276c1dd3f5ba7453e87d4` | Documentation only | ✓ docs only |
| `030753460ad6b4e228c4acd65f29bd77b241318d` | Documentation only | ✓ docs only |
| `cb9d04ebe1a99df2f8b4db0188efd20049c59633` | Documentation only | ✓ docs only |

Independently confirmed:

- **No history rewrite.** Merge base is exactly the correction-start commit.
- **`01cced4…` is genuinely the last runtime/test commit.**
  `git diff --name-only 01cced4 cb9d04e | grep -v '^stocky-plus/docs/'` → **empty**.
- **Original independent review report is byte-identical.**
  Blob at `ebcd026` and at `cb9d04e` are both `092e0f73dda1b604671727e6f80357d8a93972e1`.
- **The actual final handoff is `cb9d04e…`, not `0307534…`** — confirmed against `origin/phase-1/tenant-enforcement` and the live PR head.
- **No PR 4 work, no product work, no `.env`, no production data, no dependency upgrade** entered the range. Full changed-file list is 41 files, all within enforcement tooling, tenant runtime, tests, CI, and Phase 1 documentation.

---

## 2. Verdict

```text
NOT READY — FURTHER CORRECTIONS REQUIRED
```

| Severity | New findings |
| ---: | ---: |
| P0 | 0 |
| P1 | 2 |
| P2 | 6 |
| P3 | 9 |
| **Total** | **17** |

**Why not READY.** The correction work is substantial and largely genuine — I independently reproduced all six original P1 attacks and five of the six are now decisively closed with adversarial evidence (72/72 policies, 14/14 semantic predicate variants, 9/9 FK variants, 7/7 role-escalation variants, 8/8 interruption checkpoints, 4/4 deliberately induced fault classes). Two blocking defects remain:

1. **F-PR3C-01 (P1)** — the runtime **connected-identity verification is never invoked by the application**. `assertSafeRuntimeConnectedIdentity` exists and is correct, but it is referenced only by its own test file. The app's only defence is a URL comparison that requires `DATABASE_MIGRATION_URL` to be present in the runtime process environment — which a correctly configured production web/worker process would not have. With it absent, every privileged-URL alias form is accepted and the runtime connects as the table owner with full cross-tenant visibility. §7 P1-6 explicitly states URL text normalization alone is not acceptable evidence; §2 forbids READY when "runtime connected identity is not verified".

2. **F-PR3C-02 (P1)** — `ALTER DEFAULT PRIVILEGES … GRANT ALL ON TABLES TO stocky_runtime` is **undetected by every verifier**, and any table created afterwards is immediately granted to the runtime role with `relrowsecurity = false`. This breaks the stated core invariant ("runtime merchant DML is never active without exact verified forced RLS") for future tables. §10 explicitly requires "Verify future-table default privileges are safe."

Additionally, one mandatory §10 verifier requirement is defeated by the verifier itself (**F-PR3C-03**, a `verify` command that performs DDL and erases the drift it should report), and one named CI step is vacuous (**F-PR3C-04**).

---

## 3. Original finding disposition (F-PR3-01 … F-PR3-29)

Legend: **C** = CLOSED · **PC** = PARTIALLY CLOSED · **O** = OPEN · **AR** = ACCEPTED RESIDUAL

| ID | Sev | Status | Independent evidence | Remaining risk | Blocks acceptance |
| --- | ---: | :---: | --- | --- | :---: |
| F-PR3-01 | P1 | **C** | 8/8 injected interruption checkpoints resume to `verify ok:true`; my own matrix of 8 hand-built partial states (incl. all-18-tables RLS stripped) all reported `resume_preflight_ok:true`, `resume_apply_ok:true`, `rows_after_resume:0`. Re-apply also repaired a drifted FK created by an earlier probe. | none material | no |
| F-PR3-02 | P1 | **C** | Apply order verified in `apply.ts:824-885`: per-table RLS → `definitions_verified` → `runtime_grants_applied` → `final_verified`. At every one of 8 injected boundaries `unsafe_runtime_access=false`. `failSafe` revoked DML whenever `verifyEnforcement` was not ok. | none material | no |
| F-PR3-03 | P1 | **C** | **72/72** policies individually rewritten to `USING/WITH CHECK (true)` → all detected by `verify`, `rls:verify` and `drift`, all restored clean. **14/14** semantic variants detected (see §4.1). | none material | no |
| F-PR3-04 | P1 | **C** | **9/9** FK / composite-key attacks detected (bare parent id, reversed columns, wrong action, wrong parent table, NOT VALID, DEFERRABLE, missing, Shop-FK CASCADE, reversed composite parent key). `apply` refuses wrong same-named FKs with `fk_wrong_definition:…:refuse_silent_accept`. | none material | no |
| F-PR3-05 | P1 | **C** | **7/7** detected: direct `GRANT stocky TO stocky_runtime`, **transitive** (`runtime→mid_role→stocky`), ADMIN OPTION, BYPASSRLS, SUPERUSER, INHERIT, CREATEROLE. Recursive `pg_auth_members` CTE at `roles.ts:418-433`. | runtime-startup guard is direct-only (folded into F-PR3C-01) | no |
| F-PR3-06 | P1 | **PC** | URL half genuinely fixed: 7/7 alias forms rejected **when `DATABASE_MIGRATION_URL` is present**. But 7/7 **accepted** when it is absent, and the app performs no post-connect identity check at all. | **F-PR3C-01 (P1)** | **YES** |
| F-PR3-07 | P2 | **C** | `guard-prisma-destructive.ts` blocks `migrate dev` / `db push` by default with a structured `tenant_prisma_destructive_blocked` event; `db:migrate`/`db:push` route through it. `tenant:schema:drift` → `tenant_prisma_schema_drift_ok`. | none material | no |
| F-PR3-08 | P2 | **C** | 9/10 trigger attacks detected (disabled, replica-only, no column restriction, AFTER UPDATE, wrong function, altered function body, SECURITY DEFINER, reset search_path, same-name-wrong-table). `ENABLE ALWAYS` accepted → F-PR3C-10 (not a weakening). | cosmetic | no |
| F-PR3-09 | P2 | **C** | `GRANT {SELECT,INSERT,UPDATE,DELETE,TRIGGER,TRUNCATE,REFERENCES} ON "Supplier" TO PUBLIC` → all 7 produce `public_grant:Supplier:*`. | none | no |
| F-PR3-10 | P2 | **C** | `TRIGGER`/`TRUNCATE`/`REFERENCES` to runtime → `excess_priv:*` **and** `excess_acl:*` (two independent paths). | none | no |
| F-PR3-11 | P2 | **PC** | Attribute drift now fails closed (`dangerous_role_attribute_drift:…:repair_required`) unless `--repair-dangerous-drift`; verified for BYPASSRLS/SUPERUSER/INHERIT/CREATEROLE. **But** `verifyRoles` reintroduces silent repair for schema CREATE. | **F-PR3C-03 (P2)** | **YES** |
| F-PR3-12 | P2 | **C** | Step list is 149 discrete steps; per-table `rls:{table}` steps (18). No multi-table transaction. Populated run: p50 4 ms, p95 81 ms, max 994 ms. | none | no |
| F-PR3-13 | P2 | **PC** | `verifyRoles` now reads the **actual** table owner (`attributes.actualTableOwner: "stocky"`) rather than the unused `STOCKY_MIGRATION_ROLE`. But the non-superuser requirement fails only when `STOCKY_REQUIRE_NONSUPERUSER_OWNER=1`, which no runbook precondition sets. | F-PR3C-16 (P3) | no |
| F-PR3-14 | P2 | **C** | All four deliberately induced fault classes returned structured JSON with `event`, per-step attribution and `recoveryHint` — including the preflight lock-timeout path that previously escaped unstructured. | F-PR3C-09 (P3) | no |
| F-PR3-15 | P2 | **PC** | `apply.ts` builds step state per run and derives status; report language corrected. **But** `PR3_DATABASE_ENFORCEMENT_ARCHITECTURE.md:95` still says "checkpointed steps". | doc inconsistency | no |
| F-PR3-16 | P2 | **C** | `worker-surfaces.test.ts:115-118` now names one honest test and states `export/privacy/reconciliation/replay deferred`. | none | no |
| F-PR3-17 | P2 | **C** | Runbook now carries both mandated invariants verbatim, a 10-stage security-preserving sequence, blue/green rule, rollback boundaries, forward-recovery table, and honest evidence classes. Backup restore correctly marked **Unexecuted**. | F-PR3C-15 (P3): stage 8 overstates the URL guarantee | no |
| F-PR3-18 | P2 | **AR** | Residual acknowledged in backlog/correction report; no false performance claim made. No benchmark supplied. | unquantified read overhead | no |
| F-PR3-19 | P2 | **PC** | FK definition is now exactly verified (columns, parent, actions, validation, deferrability). The merchant-visible behaviour change (`DELETE PurchaseOrder` now blocked by a lead-time snapshot) is still only mentioned in passing (`ARCHITECTURE.md:65`) and has no test. | undocumented behaviour change | no |
| F-PR3-20 | P2 | **AR** | `test:db-isolation` = 19 tests, 2 files. Coverage not expanded beyond the original 2 of 16 pool scenarios; deferral is stated rather than closed. | 14 pool scenarios unproven | no |
| F-PR3-21 | P3 | **C** | Both PR body and correction report now name `0ee3ae0…` as the actual pre-review runtime/test head. | none | no |
| F-PR3-22 | P3 | **PC** | PR body carries the correct head/run. Correction report at the reviewed head still names `0307534…` / run `30828120871` as "exact final PR head". | **F-PR3C-13 (P3)** | no |
| F-PR3-23 | P3 | **PC** | `releaseAdvisoryLock` now checks the return value and throws `advisory_unlock_failed` — but the `finally` in `applyEnforcement` swallows it. | **F-PR3C-14 (P3)** | no |
| F-PR3-24 | P3 | **C** | `roles.ts:212-218` throws when `STOCKY_RUNTIME_ROLE_PASSWORD` is unset; no fallback. | F-PR3C-17 (P3): test helper default | no |
| F-PR3-25 | P3 | **AR** | `resetPrismaSingletonForTests` is still exported from `app/db.server.ts:171` guarded only by `NODE_ENV`; `db.server.ts:177-179` contains an empty no-op `if` block. | unchanged risk shape | no |
| F-PR3-26 | P3 | **C** | `db.server.ts:160` now `Reflect.get(client, prop, client)` and binds functions to the real client. | none | no |
| F-PR3-27 | P3 | **PC** | `void check`, `void compositeKeyName`, `void expected` removed. `verify.ts:724` `void ENFORCEMENT_CONTEXT_VERSION;` remains. | **F-PR3C-11 (P3)** | no |
| F-PR3-28 | P3 | **C** | `preflight.ts:281-287` — skip is a hard failure when `NODE_ENV=production`. | none | no |
| F-PR3-29 | P3 | **C** | `db-context.server.ts:51` uses tagged `$queryRaw`; mock updated to model the production API. Shop enumeration remains by approved design. | (a) unchanged by design | no |

**Mandatory set status:** F-PR3-01…05, 07, 08, 09, 10, 12, 16, 17 → CLOSED. **F-PR3-06 and F-PR3-11 remain open and are mandatory.** F-PR3-13 is partially closed.

---

## 4. Verifier attack matrices

Environment for all matrices: PostgreSQL 16.13, locale `C`/`C`, database `stocky_plus_ci`, owner `stocky` (superuser, mirroring CI), runtime `stocky_runtime` (NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT LOGIN). Baseline before every matrix: `enforcement:verify`, `drift`, `rls:verify`, `immutability:verify`, `roles:verify` all `ok:true`; 72 policies, 18 triggers.

### 4.1 RLS policy definitions (§8) — 14/14 detected

| Injected definition | `enforcement:verify` | `rls:verify` | `drift` | Issue codes |
| --- | :---: | :---: | :---: | --- |
| `USING (true)` | fail | fail | fail | `policy_using_drift`, `policy_using_true`, `policy_wrong_helper`, `policy_wrong_context_key` |
| `<pred> OR true` | fail | fail | fail | `policy_using_drift` |
| `<pred> OR "shopId" IS NOT NULL` | fail | fail | fail | `policy_using_drift` |
| `NOT ("shopId" <> ctx())` | fail | fail | fail | `policy_using_drift`, `policy_wrong_context_key` |
| `coalesce("shopId" = ctx(), true)` | fail | fail | fail | `policy_using_drift`, `policy_wrong_context_key` |
| wrong helper, same return type | fail | fail | fail | `policy_using_drift`, `policy_wrong_helper` |
| constant tenant (`= 'shop_1'`) | fail | fail | fail | `policy_using_drift`, `policy_wrong_helper` |
| wrong context version literal | fail | fail | fail | `policy_using_drift`, `policy_wrong_context_key` |
| UPDATE policy without `WITH CHECK` | fail | fail | fail | `policy_missing_with_check` |
| policy targeted at `PUBLIC` | fail | fail | fail | `public_policy` |
| policy targeted at owner role | fail | fail | fail | `policy_wrong_role`, `policy_extra_role` |
| `FOR ALL` instead of `FOR SELECT` | fail | fail | fail | `policy_wrong_command` |
| `AS RESTRICTIVE` | fail | fail | fail | `policy_restrictive_mismatch` |
| extra permissive `USING (true)` policy | fail | fail | fail | `unexpected_permissive_policy` |

**All 72 policies tested individually**, not one representative: each policy on each of the 18 tables was independently rewritten to `USING (true)` / `WITH CHECK (true)`, verified detected by all three commands, and restored to a clean baseline.

```
all72_total: 72   all72_detected: 72   all72_failures: []
```

The verifier compares `pg_get_expr(polqual/polwithcheck)` against a strict expected definition after a bounded normalization (`::text` strip, whitespace collapse, lowercase, redundant-outer-paren unwrap) — not fragment search. I found no false-positive or false-negative from the normalizer on PostgreSQL 16.13; the 14 semantically-dangerous-but-similar forms above are exactly the class it must reject, and it rejects all of them by strict inequality before the auxiliary substring checks ever run.

### 4.2 Composite FK / parent key (§7 P1-4) — 9/9 detected

| Injected definition | Detected | Issue code |
| --- | :---: | --- |
| bare parent id only (`FK(purchaseOrderId) → PO(id)`) | ✓ | `fk_wrong_local_columns`, `fk_wrong_referenced_columns` |
| reversed column order both sides | ✓ | `fk_wrong_local_columns`, `fk_wrong_referenced_columns` |
| wrong referential action (`SET NULL`) | ✓ | `fk_wrong_delete_action` |
| wrong parent table (`→ Supplier`) | ✓ | `fk_wrong_parent_table`, `fk_wrong_local_columns` |
| `NOT VALID` (unvalidated) | ✓ | `fk_not_validated` |
| `DEFERRABLE INITIALLY DEFERRED` | ✓ | `fk_unexpected_deferrable`, `fk_unexpected_deferred` |
| constraint dropped | ✓ | `fk_missing` |
| Shop FK `ON DELETE CASCADE` instead of `RESTRICT` | ✓ | `fk_wrong_delete_action` |
| composite parent key columns reversed | ✓ | `composite_key_wrong_columns` |

`apply` additionally refuses to silently accept a wrong same-named FK (`fk_wrong_definition:<name>:refuse_silent_accept`, `apply.ts:290-294, 321-325`) rather than skipping it via existence check.

### 4.3 Immutability triggers (§9) — 9/10 detected

| Injection | `enforcement:verify` | `immutability:verify` | `drift` | Code |
| --- | :---: | :---: | :---: | --- |
| `DISABLE TRIGGER` | fail | fail | fail | `trigger_disabled` |
| `ENABLE REPLICA TRIGGER` | fail | fail | fail | `trigger_replica_only` |
| `ENABLE ALWAYS TRIGGER` | **pass** | **pass** | **pass** | — (**F-PR3C-10**) |
| no column restriction (`BEFORE UPDATE`) | fail | fail | fail | `trigger_wrong_columns` |
| `AFTER UPDATE` | fail | fail | fail | `trigger_wrong_event` |
| wrong function | fail | fail | fail | `trigger_wrong_function`, `trigger_function_body_drift` |
| altered function body (guard removed) | fail | fail | fail | `trigger_function_body_drift` |
| function `SECURITY DEFINER` | fail | fail | fail | `trigger_function_security_definer`, `helper_security_definer` |
| function `RESET search_path` | fail | fail | fail | `trigger_function_insecure_search_path` |
| same-name trigger on wrong table | fail | fail | fail | `trigger_missing` |

After restore, a real immutability operation was re-run and correctly rejected:

```
UPDATE "Supplier" SET "shopId"='shopB' WHERE id='supA';
ERROR:  stocky_tenant_key_immutable: shopId cannot be changed
```

### 4.4 RLS state and helper functions — 6/6 detected

`NO FORCE` → `rls_not_forced` · `DISABLE ROW LEVEL SECURITY` → `rls_not_enabled` · `DROP NOT NULL` on `shopId` → `shopId_nullable` · helper `SECURITY DEFINER` → `helper_security_definer` · helper `EXECUTE TO PUBLIC` → `helper_public_execute` · helper `RESET search_path` → `helper_insecure_search_path`.

### 4.5 Role membership and attributes (§7 P1-5) — 7/7 detected

| Injection | `roles:verify` | Failure codes |
| --- | :---: | --- |
| `GRANT stocky TO stocky_runtime` (direct) | fail | `member_of:stocky`, `member_of_superuser:stocky` |
| `runtime → mid_role → stocky` (transitive) | fail | `member_of:stocky`, `member_of:mid_role`, `member_of_superuser:stocky` |
| `GRANT … WITH ADMIN OPTION` | fail | `member_of:benign_role`, `admin_option_on:benign_role` |
| `ALTER ROLE … BYPASSRLS` | fail | `runtime_has_bypassrls` |
| `ALTER ROLE … SUPERUSER` | fail | `runtime_is_superuser` |
| `ALTER ROLE … INHERIT` | fail | `runtime_has_inherit` |
| `ALTER ROLE … CREATEROLE` | fail | `runtime_can_createrole` |

Under the clean state, `SET ROLE stocky` is impossible for the runtime role (no membership exists), and provisioning fails closed on membership drift rather than silently revoking it (`dangerous_role_membership_drift:…:repair_required`), with repair available only under the explicit `--repair-dangerous-drift` flag.

### 4.6 Exact privilege allowlist (§10) — 15/18 detected

| Drift | Detected | Code |
| --- | :---: | --- |
| PUBLIC SELECT / INSERT / UPDATE / DELETE | ✓ ✓ ✓ ✓ | `public_grant:Supplier:*` |
| PUBLIC TRIGGER / TRUNCATE / REFERENCES | ✓ ✓ ✓ | `public_grant:*` + `excess_priv:*` |
| runtime TRIGGER / TRUNCATE / REFERENCES | ✓ ✓ ✓ | `excess_priv:*`, `excess_acl:*` |
| direct schema `CREATE` to runtime | ✓ | `excess_schema_create` |
| **`CREATE ON SCHEMA public` to PUBLIC** | **✗** | — (**F-PR3C-03**) |
| control-table SELECT | ✓ | `runtime_can_select_control:TenantBackfillRun` |
| `_prisma_migrations` SELECT | ✓ | `runtime_can_select_prisma_migrations` |
| immutability function EXECUTE | ✓ | `runtime_can_execute_immutability_fn` |
| **sequence USAGE/SELECT/UPDATE** | **✗** | — (**F-PR3C-05**) |
| **default privileges on future tables** | **✗** | — (**F-PR3C-02**) |
| merchant table ownership → runtime | ✓ | `runtime_owns_tables:Supplier` |
| direct / transitive privileged membership | ✓ ✓ | see §4.5 |

### 4.7 Connected identity (§11)

`assertSafeRuntimeConnectedIdentity` (`connection.ts:211-259`) checks `current_user`, `session_user`, `rolsuper`, `rolbypassrls`, `rolcreaterole`, `rolcreatedb`, owned merchant tables, and direct role membership. It correctly rejects a migration-owner connection and accepts the restricted runtime role.

**It is never called by the application.** `grep -rn "assertSafeRuntimeConnectedIdentity|readConnectedIdentity|getRuntimeClient" --include=*.ts` across the whole repository returns matches only in `scripts/tenant-enforcement/connection.ts` (definitions) and `scripts/tenant-enforcement/tests/connected-identity.test.ts`. `getRuntimeClient` has **zero** callers anywhere.

Semantic URL alias results against `app/db.server.ts` `resolveRuntimeDatabaseUrl` (`NODE_ENV=production`), where the candidate runtime URL is the migration owner's URL in each alias form:

| Alias form | `DATABASE_MIGRATION_URL` present | `DATABASE_MIGRATION_URL` absent |
| --- | :---: | :---: |
| `postgres://` scheme | REJECTED | **ACCEPTED** |
| trailing slash | REJECTED | **ACCEPTED** |
| `?schema=public` | REJECTED | **ACCEPTED** |
| `?application_name=web` | REJECTED | **ACCEPTED** |
| percent-encoded username (`%73tocky`) | REJECTED | **ACCEPTED** |
| `localhost` vs `127.0.0.1` | REJECTED | **ACCEPTED** |
| byte-identical text | REJECTED | **ACCEPTED** |

Also not checked even when the guard does run: the connected **database name**, server address/port, and **transitive** role membership (the runtime guard's membership query at `connection.ts:240-246` is a single-level join, unlike the recursive CTE used by `verifyRoles`).

### 4.8 Live tenant isolation (positive control)

Two shops, two suppliers, one per tenant:

| Connection | Context | Result |
| --- | --- | --- |
| `stocky_runtime` | none | **0 rows** |
| `stocky_runtime` | `shopA` + correct version | `supA` only |
| `stocky_runtime` | `shopB` + correct version | `supB` only |
| `stocky_runtime` | `shopA` + wrong version key | **0 rows** |
| `stocky_runtime` | `shopA`, cross-tenant `UPDATE … WHERE id='supB'` | `UPDATE 0` |
| `stocky_runtime` | `shopA`, `UPDATE … SET "shopId"='shopB'` | `ERROR: stocky_tenant_key_immutable` |
| owner `stocky` (superuser) | none | **`supA,supB`** — full cross-tenant read |

The last row is the concrete merchant impact of F-PR3C-01: a runtime process misconfigured onto the owner URL sees every tenant, and nothing in the application detects it.

---

## 5. Apply / recovery matrix

### 5.1 Ordering (verified in `apply.ts`, 149 steps)

```
helpers → roles_prepared (merchant DML revoked, no DML granted)
        → supporting indexes (CIC) → composite parent keys (unique CIC)
        → per table: NOT NULL CHECK NOT VALID → VALIDATE → SET NOT NULL
                   → Shop FK NOT VALID → VALIDATE
        → composite FKs NOT VALID → VALIDATE
        → per table: ENABLE RLS + FORCE RLS + 4 policies + immutability trigger   (18 discrete steps)
        → definitions_verified   (exact catalog verify; throws on any issue)
        → runtime_grants_applied (merchant DML granted only here)
        → final_verified         (verify + assertSafeRuntimeAccess)
```

Grants are structurally unreachable before `definitions_verified` succeeds. `provisionRoles(phase:"grants")` independently re-checks `isRlsFullyForced` **and** `verifyRlsOnly` before issuing any grant (`roles.ts:350-368`), so the ordering guarantee does not rely on caller discipline alone.

### 5.2 Injected interruption at every major checkpoint (committed suite, independently re-run)

`partial-apply-recovery.test.ts` — **11 passed**, 63.9 s. Each case does a real `DROP SCHEMA` → `migrate deploy` → index apply → prepare → interrupted apply → resume.

| Interrupt after | `unsafe_runtime_access` | Resume preflight | Resume apply | Final verify |
| --- | :---: | :---: | :---: | :---: |
| `roles_prepared` | false | ok | ok | ok |
| `not_null_check:Supplier` | false | ok | ok | ok |
| `cfk_validate:VolumePriceTier_shopId_supplierId_fkey` | false | ok | ok | ok |
| `rls:Supplier` (first table) | false | ok | ok | ok |
| `rls:StocktakeLineItem` (last table) | false | ok | ok | ok |
| `definitions_verified` | false | ok | ok | ok |
| `runtime_grants_applied` | false | ok | ok | ok |
| `final_verified` | false | ok | ok | ok |

### 5.3 Independent partial-state matrix (my own, not the committed tests)

Each state was hand-built on a fully enforced database, then measured with a real runtime connection holding **no** tenant context.

| State | `unsafe_runtime_access` | Rows visible to runtime w/o context | Resume preflight | Resume apply | Unsafe after | Rows after |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| FORCE removed on 1 table | true | **0** | ok | ok | false | 0 |
| RLS disabled on 1 table | true | 2 | ok | ok | false | 0 |
| ENABLE without FORCE (mid-step crash) | true | **0** | ok | ok | false | 0 |
| FORCE without policies (mid-step crash) | false | **0** | ok | ok | false | 0 |
| all policies dropped, RLS still forced | false | **0** | ok | ok | false | 0 |
| grants revoked after complete state | false | permission denied | ok | ok | false | 0 |
| **all 18 tables RLS stripped, grants retained** (the original F-PR3-02 state) | true | 2 | **ok** | **ok** | **false** | **0** |

The final row is the decisive one: the state the original review found **unrecoverable** is now detected, accepted for resume, repaired, and verified — with data no longer exposed afterwards. `unsafe_runtime_access` is conservative (it flags SELECT-granted-and-not-forced even where RLS still blocks the non-owner runtime role), which is the correct direction for a safety classifier.

### 5.4 Deliberately induced faults (§15) — no committed test covers these

| Fault | Classification | Structured JSON | `unsafe_runtime_access` | Recovery |
| --- | --- | :---: | :---: | --- |
| conflicting `ACCESS EXCLUSIVE` lock, `lock_timeout=300ms` | `preflight_exception: canceling statement due to lock timeout`; `applied:false` | ✓ with step attribution + hint | false | resume preflight ok, apply ok, verify ok, rows 0 |
| `SHARE` lock holder, `lock_timeout=300ms` | `rls:Supplier` failed after **`attempts=5`** (bounded retry exercised) | ✓ | false (measured false) | resume ok, verify ok, rows 0 |
| `statement_timeout=1ms` | first failed step `helpers` | ✓ | false | resume ok, verify ok, rows 0 |
| `pg_cancel_backend` mid-apply | apply not ok | ✓ | false | resume ok, verify ok, rows 0 |

The implementation handles all four correctly. What is missing is any **test** that exercises them (F-PR3C-04).

### 5.5 Advisory locking (§16)

| Property | Result |
| --- | :---: |
| concurrent apply while lock held | rejected — `advisory_lock_unavailable`, `applied:false`, `unsafe:false`, recovery hint present |
| apply succeeds after lock released | ✓ |
| lock held on a pinned backend | ✓ (1 advisory lock observed on the holder's PID) |
| session lock released on backend death | ✓ (`locks_before_kill:1` → `locks_after_kill:0`) |
| new backend can re-acquire after death | ✓ |
| `pg_advisory_unlock` when not held returns false | ✓ (checked at `apply.ts:109-111`, but see F-PR3C-14) |
| pooler / PgBouncer URL rejected for enforcement | ✓ both `pgbouncer.internal:6432` and `…pooler.supabase.com` rejected |
| `apply` without `--apply` | refused — `apply mode requires --apply` |
| `apply` with `DATABASE_URL` only | refused — explicit migration URL required |

---

## 6. Populated concurrency evidence (§15)

Fixture (independently re-run at the reviewed head): **50 shops, 100 000 `Supplier` rows, 100 000 `POLineItem` rows**, concurrent SELECT/UPDATE traffic during apply.

| Metric | Cursor's reported value | **My independent measurement** |
| --- | ---: | ---: |
| `applyOk` | true | **true** |
| `maxLockHoldMs` | 67 | **994** |
| p50 (apply step) | 1 | **4** |
| p95 (apply step) | 10 | **81** |
| max (apply step) | 67 | **994** |
| `unsafe` | false | **false** |
| `deadlocksObserved` | 0 | **0** |
| `resumeOk` | true | **true** |

Environment: PostgreSQL 16.13 (Ubuntu 24.04), locale `C`/`C`, Redis 7.0.15 on port 56379 (`DBSIZE` 0 before and after), Node v22.22.2, npm 11.5.2.

The safety conclusions reproduce. The **timing** figures do not: I measured a maximum step duration ~15× the reported value on comparable hardware. The reported `maxLockHoldMs: 67` should not be treated as a bound. See **F-PR3C-08** — the harness also measures apply-step durations rather than merchant-query delay, records no lock waits or blocked PIDs, and drives its "concurrent traffic" as the **migration owner** rather than the RLS-subject runtime role, so it does not measure what §15 asks for. `deadlocksObserved: 0` in both runs confirms the deadlock-recovery branch of that test never executed.

---

## 7. Runtime Prisma review

| Aspect | Finding |
| --- | --- |
| Lazy initialization | `getPrisma()` recreates the singleton when the resolved URL changes (non-production only); production creates once. |
| Concurrent initialization | Not guarded by a promise/mutex; `global.prismaInitPromise` is declared (`db.server.ts:24`) but never assigned or awaited. Two concurrent first-touches can both construct a client; the loser is `$disconnect`ed fire-and-forget. Low impact (non-production path only). |
| Reset helper | Still exported from the runtime module (F-PR3-25, AR). `db.server.ts:177-179` is an empty `if` block with no effect — dead code. |
| Proxy receiver | Fixed: `Reflect.get(client, prop, client)` + `value.bind(client)`. |
| Raw SQL | `db-context.server.ts:51` restored to tagged `$queryRaw`. `npm run tenant:access:audit` → `tenant_access_audit_ok`; `test:tenant-access` passes. No new runtime raw-SQL bypass introduced by PR 3. |
| Credential safety | `classifyDatabaseUrl` redacts hosts and never logs credentials. Pooler detection is a substring match on `pooler|pgbouncer` — a differently-named proxy endpoint would not be caught (P3, pre-existing). |
| **Connected identity** | **Absent from the runtime path entirely — F-PR3C-01.** |
| URL duplication | `resolveRuntimeDatabaseUrl` and `databaseUrlsSemanticallyEqual` are implemented twice — `app/db.server.ts:27-117` and `scripts/tenant-enforcement/{catalog-expect,connection}.ts` — with subtly different fallback logic. Divergence risk (folded into F-PR3C-01's correction). |

---

## 8. CI verification

| Field | Expected | Verified |
| --- | --- | :---: |
| Workflow | CI | ✓ |
| Run ID | `30829580600` | ✓ |
| Job ID | `91739866934` | ✓ |
| Head SHA | `cb9d04ebe1a99df2f8b4db0188efd20049c59633` | ✓ (run and job both) |
| Conclusion | success | ✓ |
| Event | `pull_request` | ✓ |
| Substantive steps | 80 | ✓ all `success`, **no skipped, no failed** |

All ten named correction steps are present and green (steps 27–36). A non-matching Vitest file filter exits **1**, so no step can pass vacuously on zero matched files — I verified this directly.

**However, three differently-named steps run the identical command** (`.github/workflows/ci.yml:204-214, 240-244`):

| Step | Command |
| --- | --- |
| 30 · Tenant unsafe partial-apply recovery tests | `partial-apply-recovery.test.ts` |
| 31 · Tenant enforcement interruption/resume tests | `partial-apply-recovery.test.ts` |
| 36 · Tenant **deadlock/timeout recovery** tests | `partial-apply-recovery.test.ts` |

§6 requires each step to execute "a distinct explicit file or command". Steps 30/31 are at least a defensible overlap (that file genuinely covers both partial-apply and interruption/resume). Step 36 is not: `partial-apply-recovery.test.ts` contains **zero** occurrences of `deadlock`, `lock_timeout`, `statement_timeout`, or cancellation. The step name asserts coverage that does not exist — the same defect class as the original F-PR3-16. See **F-PR3C-04**.

Local test counts, independently reproduced at the reviewed head:

| Suite | Tests |
| --- | ---: |
| `definition-drift.test.ts` | 11 |
| `composite-definition-drift.test.ts` | 2 |
| `immutability-trigger-drift.test.ts` | 3 |
| `exact-privilege-allowlist.test.ts` | 2 |
| `connected-identity.test.ts` | 4 |
| `role-membership.test.ts` | 6 |
| `partial-apply-recovery.test.ts` | 11 |
| `populated-concurrency.test.ts` | 1 |
| `test:db-isolation` | 19 |
| `test:tenant-access` | 287 |
| `test:migrations` | 150 |
| `npm test` (unit) | 56 |

---

## 9. New findings

### F-PR3C-01 · **P1** · Runtime connected-identity verification is never invoked by the application

1. **Severity:** P1 — runtime privileged identity / tenant isolation bypass.
2. **Location:** `stocky-plus/app/db.server.ts:62-163` (no identity check on any path); `stocky-plus/scripts/tenant-enforcement/connection.ts:211-259` and `:312-331` (`assertSafeRuntimeConnectedIdentity`, `getRuntimeClient` — no application callers).
3. **Requirement:** §7 P1-6 — "post-connect identity verification detects privileged identity; startup fails before merchant processing… Do not accept URL text normalization alone as evidence." §11 — the runtime connection must check `current_user`, `session_user`, database name, role attributes, ownership, membership, `BYPASSRLS`, superuser. §2 — READY is forbidden while "runtime connected identity is not verified".
4. **Reproduction:**
   ```
   grep -rn "assertSafeRuntimeConnectedIdentity\|getRuntimeClient" --include=*.ts stocky-plus/
   # → definitions in connection.ts + connected-identity.test.ts only; zero app/ references
   ```
   Then, with `NODE_ENV=production`, `DATABASE_RUNTIME_URL` set to the migration owner's URL in any of 7 alias forms and `DATABASE_MIGRATION_URL` unset (the normal production web/worker configuration — the privileged URL is not shipped to app processes):
   `resolveRuntimeDatabaseUrl()` returns the privileged URL for **all 7** forms. A Prisma client is then constructed against it with no further check.
5. **Actual behavior:** the application connects as the table owner. With the CI-shaped superuser owner, a no-context `SELECT` returns every tenant's rows (`supA,supB`). With a non-superuser owner, `FORCE RLS` binds it — but nothing verifies which case production is in, and F-PR3C-16 leaves that requirement opt-in.
6. **Expected behavior:** every runtime client must, once per connected identity and before any merchant query, assert `current_user` = the expected runtime role, `session_user` likewise, no `rolsuper`/`rolbypassrls`/`rolcreaterole`/`rolcreatedb`, no owned merchant tables, no role membership (recursive), the expected database name, and the required/forbidden grants — failing closed at startup.
7. **Merchant impact:** a single environment-variable misconfiguration silently disables all tenant isolation for every merchant, with no error, no log line, and no failing verifier.
8. **Required correction:** invoke a post-connect identity assertion from the runtime Prisma path (a `$connect`-time check or Prisma client extension), keyed to the actual connected identity and re-run when the client is replaced; make the recursive membership check and database-name check part of it; de-duplicate the two `resolveRuntimeDatabaseUrl` implementations.
9. **Regression test:** connect the app runtime as (a) migration owner, (b) table owner, (c) superuser, (d) `BYPASSRLS` role, (e) role with owner membership (direct **and** transitive), (f) role missing SELECT, (g) correct runtime role — assert (a)–(f) fail before any merchant query and (g) succeeds; assert the check cannot be bypassed by client reset or concurrent initialization.
10. **Blocks acceptance:** **YES.**

### F-PR3C-02 · **P1** · Default privileges on future tables are undetected; new tables get runtime DML without RLS

1. **Severity:** P1 — tenant isolation bypass on any subsequently created table.
2. **Location:** `stocky-plus/scripts/tenant-enforcement/roles.ts:504-739` (`verifyRoles` never reads `pg_default_acl`); `scripts/tenant-enforcement/verify.ts:668-731` likewise.
3. **Requirement:** §10 — "Verify future-table default privileges are safe." Core invariant — runtime merchant DML is never active without exact verified forced RLS.
4. **Reproduction:**
   ```sql
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO stocky_runtime;
   -- pg_default_acl → {stocky_runtime=arwdDxt/stocky}
   ```
   ```
   npm run tenant:roles:verify        → {"ok":true,"failures":[]}
   npm run tenant:enforcement:verify  → {"ok":true,"issues":[]}
   CREATE TABLE "FutureMerchantTable"(id text primary key, "shopId" text);
   → has_table_privilege('stocky_runtime', …, 'SELECT') = t ; relrowsecurity = f
   ```
5. **Actual behavior:** every verifier reports clean while a standing grant guarantees unrestricted runtime access to every future table. `provisionRoles` revokes the default privileges (`roles.ts:339-344`) but only on its next run, and reports nothing.
6. **Expected behavior:** `verifyRoles` must read `pg_default_acl` for schema `public` and fail on any default grant to the runtime role or to `PUBLIC`, with a stable issue code.
7. **Merchant impact:** a table added by a later migration (PR 4 and beyond will add several) is immediately cross-tenant readable and writable by the runtime role with no RLS, and no command in the suite says so.
8. **Required correction:** add a `pg_default_acl` check to `verifyRoles` (and surface it through `enforcement:verify`/`drift`); report rather than silently revoke.
9. **Regression test:** grant default privileges to the runtime role and to `PUBLIC`; assert `roles:verify` and `enforcement:drift` both fail with distinct codes; assert a newly created table is not runtime-accessible after a clean apply.
10. **Blocks acceptance:** **YES.**

### F-PR3C-03 · **P2** · `tenant:roles:verify` mutates the database and erases the drift it should report

1. **Severity:** P2 (mandatory) — verifier accepts a materially wrong database state.
2. **Location:** `stocky-plus/scripts/tenant-enforcement/roles.ts:644-646`.
3. **Requirement:** §10 — schema `CREATE` drift must be detected with an exact issue code and "provisioning does not silently erase the incident without evidence". §2 — READY is forbidden while "any verifier still accepts a materially wrong database definition".
4. **Reproduction:**
   ```
   GRANT CREATE ON SCHEMA public TO PUBLIC;
   nspacl before →  {pg_database_owner=UC/…, =UC/…, stocky_runtime=U/…}
   npm run tenant:roles:verify → {"ok":true,"failures":[]}
   nspacl after  →  {pg_database_owner=UC/…, =U/…,  stocky_runtime=U/…}
   ```
5. **Actual behavior:** a command named `verify` executes `REVOKE CREATE ON SCHEMA public FROM PUBLIC` **before** evaluating the condition, so the check can never fire; the drift is destroyed and the run reports clean. Because the revoke is wrapped in `.catch(() => undefined)`, the detection behaves differently depending on whether the caller happens to hold owner rights — as a read-only auditor the same drift *would* be reported. A verifier whose result depends on its own write privileges is not a reliable control.
6. **Expected behavior:** verifiers must be strictly read-only and must fail with `public_schema_create` when PUBLIC holds `CREATE` on `public`.
7. **Merchant impact:** PUBLIC `CREATE` on the schema lets any role create objects in `public`, including tables and functions that shadow the tenant-context helpers; the one command an operator would run to detect it removes the evidence and says everything is fine.
8. **Required correction:** delete the `REVOKE` from `verifyRoles`; keep it in `provisionRoles` only; assert read-only behaviour for all `*:verify` and `drift` commands.
9. **Regression test:** grant PUBLIC `CREATE`, assert `roles:verify` fails with `public_schema_create` **and** that `nspacl` is byte-identical before and after the verify run.
10. **Blocks acceptance:** **YES** (mandatory P2 under §10 and F-PR3-11).

### F-PR3C-04 · **P2** · CI step "deadlock/timeout recovery tests" is vacuous; three named steps run one file

1. **Severity:** P2.
2. **Location:** `.github/workflows/ci.yml:204-214` and `:240-244`; `stocky-plus/scripts/tenant-enforcement/tests/partial-apply-recovery.test.ts`.
3. **Requirement:** §6 — "every step executed a distinct explicit file or command". §20 — "A step named 'definition drift' is insufficient if it only runs a broad aggregate without the adversarial cases." §15 — deadlock, lock timeout, statement timeout, cancellation and process interruption must be deliberately induced and their recovery proven.
4. **Reproduction:** `grep -c "deadlock\|lock_timeout\|statement_timeout\|cancel" scripts/tenant-enforcement/tests/partial-apply-recovery.test.ts` → **0**. Steps 30, 31 and 36 all run that same file.
5. **Actual behavior:** the green step named "Tenant enforcement deadlock/timeout recovery tests" proves nothing about deadlock or timeout recovery. `populated-concurrency.test.ts` only handles a deadlock opportunistically (`if (!apply.ok) { … resume }`) and reports `deadlocksObserved: 0` in both Cursor's run and mine, confirming that branch never executed.
6. **Expected behavior:** a dedicated test file that deliberately induces a conflicting lock, a deadlock, a `lock_timeout`, a `statement_timeout` and a cancellation, and asserts safe classification, `unsafe_runtime_access=false`, no falsely-completed step, and successful resume — wired to its own CI step.
7. **Merchant impact:** none directly; the risk is that a future regression in the retry/failSafe path ships green.
8. **Required correction:** add the dedicated fault-injection suite; give each named CI step a distinct command.
9. **Regression test:** the suite itself. Note that I verified the *implementation* passes all five fault classes (§5.4) — only the test is missing.
10. **Blocks acceptance:** **YES** (§6/§20 are explicit acceptance conditions).

### F-PR3C-05 · **P2** · Sequence privileges are outside the exact privilege allowlist

1. **Severity:** P2.
2. **Location:** `stocky-plus/scripts/tenant-enforcement/roles.ts:504-739`.
3. **Requirement:** §10 lists "sequence usage" among the runtime-role drift cases that must produce an exact issue code.
4. **Reproduction:**
   ```sql
   CREATE SEQUENCE evil_seq;
   GRANT USAGE, SELECT, UPDATE ON SEQUENCE evil_seq TO stocky_runtime;
   -- relacl → {stocky=rwU/stocky, stocky_runtime=rwU/stocky}
   ```
   `npm run tenant:roles:verify` → `{"ok":true,"failures":[]}`; `tenant:enforcement:verify` → `{"ok":true}`.
5. **Actual behavior:** no verifier inspects `relkind='S'` ACLs.
6. **Expected behavior:** fail with e.g. `excess_sequence_priv:<sequence>:<priv>` for any runtime or PUBLIC grant on a sequence in `public`.
7. **Merchant impact:** currently latent — the Prisma schema uses text ids and the enforced schema contains **no** sequences, so there is no live exposure. It becomes real the moment any serial/identity column is introduced.
8. **Required correction:** extend the allowlist verifier to sequences (and ideally to all `relkind` in `public`).
9. **Regression test:** create a sequence, grant `USAGE`/`SELECT`/`UPDATE` to runtime and to `PUBLIC`, assert `roles:verify` fails for each.
10. **Blocks acceptance:** **YES** (explicit §10 requirement).

### F-PR3C-06 · **P2** · The named "exact privilege allowlist" suite covers 2 of the 16 required drift cases

1. **Severity:** P2.
2. **Location:** `stocky-plus/scripts/tenant-enforcement/tests/exact-privilege-allowlist.test.ts` (65 lines, 2 tests).
3. **Requirement:** §10 enumerates 16 drift cases; §20 forbids a named step that runs a broad aggregate instead of the adversarial cases.
4. **Reproduction:** the file tests only (a) `GRANT ALL … TO PUBLIC` and (b) excess `TRIGGER/TRUNCATE/REFERENCES`. Absent: PUBLIC schema `CREATE`, sequence usage, default privileges, table ownership, control-table SELECT, `_prisma_migrations` SELECT, function `EXECUTE`.
5. **Actual behavior:** the three genuine gaps (F-PR3C-02/03/05) all sit in the untested remainder — the thin suite is why they survived correction.
6. **Expected behavior:** one assertion per §10 case, each with its exact issue code.
7. **Merchant impact:** indirect — undetected privilege drift.
8. **Required correction:** expand the suite to all 16 cases.
9. **Regression test:** as above.
10. **Blocks acceptance:** **YES** (it is the test that would have caught two P1s).

### F-PR3C-07 · **P2** · Resume preflight reports `ok:true` under dangerous enforcement drift

1. **Severity:** P2.
2. **Location:** `stocky-plus/scripts/tenant-enforcement/preflight.ts:266-408`.
3. **Requirement:** §17 — corrected-state fixtures (policy drift, FK drift, trigger drift, role-membership drift, PUBLIC grant, unsafe runtime grants) must yield stable structured issue codes. §14 — "Dangerous drift must fail, not be silently normalized unless explicit repair mode is invoked."
4. **Reproduction:** on a clean fully enforced database (all verifiers `ok:true`), introduce each corrected-state fixture and call `runPreflight(client, {mode:"resume"})`:

   | Fixture | `preflight.ok` | Issue codes | Detected by `verify`/`drift`/`roles:verify`? |
   | --- | :---: | --- | :---: |
   | null `shopId` row (original bad fixture — control) | **false** | `Supplier:null_shopId_rows` | n/a |
   | policy drift — `USING (true)` | **true** | **none** | yes |
   | trigger drift — `DISABLE TRIGGER` | **true** | **none** | yes |
   | role-membership drift — `GRANT stocky TO stocky_runtime` | **true** | **none** | yes |
   | PUBLIC grant on a merchant table | **true** | **none** | yes |
   | unsafe runtime grants without RLS (`DISABLE ROW LEVEL SECURITY`) | **true** | **none** | yes |
   | FK drift — composite FK dropped | **true** | **none** | yes |

   The original bad fixtures are unaffected: the preflight implementation still emits stable codes for `null_shopId_rows`, `open_quarantine_issues`, `parent_tenant_mismatch`, `cross_domain_mismatch`, `orphan_parent_refs`, `duplicate_composite_keys`, `missing_pr1_composite_index`, `invalid_pr1_composite_index`, plus inventory-freshness and index-verify failures. The gap is confined to the **corrected-state** fixtures §17 adds.
5. **Actual behavior:** `ok:true` with no issue code for all six corrected-state fixtures; preflight's `progress` model tracks only forced-RLS / NOT NULL / composite-FK counts. `apply --apply` then unconditionally `DROP`s and re-`CREATE`s the tampered policy, normalizing the drift with no incident record. (FK drift is the exception — `apply` correctly refuses it.) `verify`/`drift` do detect all of these, so an operator who runs them is protected; an operator who runs preflight then apply is not told anything happened.
6. **Expected behavior:** resume preflight should surface enforcement-definition and privilege drift as structured codes distinct from "incomplete", so the operator distinguishes *resume an interrupted apply* from *repair a tampered database*.
7. **Merchant impact:** a tampering incident can be silently erased by a routine resume, destroying forensic evidence.
8. **Required correction:** run the exact definition verifier inside resume preflight and report (not fail) drift codes; require an explicit repair acknowledgement before apply normalizes policy/trigger drift.
9. **Regression test:** the six §17 corrected-state fixtures, each asserting a distinct code.
10. **Blocks acceptance:** **YES** (§17 fixture requirement).

### F-PR3C-08 · **P2** · Populated concurrency evidence does not measure what §15 requires, and the reported lock timing is not reproducible

1. **Severity:** P2.
2. **Location:** `stocky-plus/scripts/tenant-enforcement/tests/populated-concurrency.test.ts:167-232`; `PR3_DATABASE_ENFORCEMENT_CORRECTION_IMPLEMENTATION_REPORT.md:107-125`; PR #15 body.
3. **Requirement:** §15 — record lock modes, lock waits, blocked PIDs, p50/p95/max operation durations, **maximum merchant-query delay**, deadlocks, timeouts, recovery; and deliberately induce failures.
4. **Reproduction:** re-ran the committed fixture at the reviewed head with the same 50/100k/100k shape.
5. **Actual behavior:**
   - Reported `maxLockHoldMs: 67`; I measured **994** (p95 81 vs reported 10). The published figure is environment-specific and reads as a bound when it is not.
   - The recorded p50/p95/max are **apply step durations**, not merchant-query durations. Maximum merchant-query delay is never measured.
   - No lock modes, lock waits or blocked PIDs are captured.
   - The "concurrent traffic" client connects with the **migration owner** URL, not the runtime role, so it is not subject to RLS and does not represent merchant traffic.
   - `deadlocksObserved: 0` in both runs — the recovery branch is dead code in practice.
6. **Expected behavior:** traffic driven as `stocky_runtime` with tenant context; explicit `pg_locks`/`pg_stat_activity` sampling; merchant-query latency percentiles; deliberate fault induction; timings published with the measuring environment and no implied bound.
7. **Merchant impact:** the lock-cost evidence that would justify a production maintenance window is weaker than it appears.
8. **Required correction:** rework the harness as above; restate the timing evidence with its environment and variance.
9. **Regression test:** assert the harness records non-zero merchant-query samples and at least one deliberately induced fault recovery.
10. **Blocks acceptance:** **YES** (§15 is explicit, and the published number is materially off).

### F-PR3C-09 · P3 · `unsafe_runtime_access` is asserted rather than measured on three early-return paths

`apply.ts:613`, `:637`, `:653` return the literal `unsafe_runtime_access: false` without calling `assertSafeRuntimeAccess`. Observed directly: under a conflicting `ACCESS EXCLUSIVE` lock, apply reported `unsafe_runtime_access: false` while the measured state was `true` (a pre-existing drift the apply correctly refused to touch). §13 asks that the invariant be *verified* at every failure boundary; on these paths it is stated. **Correction:** measure on every return path, or omit the field when no measurement was taken. **Test:** assert reported and measured values agree on the preflight-exception, preflight-failure and advisory-lock-unavailable paths. Does not block.

### F-PR3C-10 · P3 · `ENABLE ALWAYS TRIGGER` is accepted

`verify.ts:340` treats `tgenabled = 'A'` as valid. §9 lists "always trigger" among the injections that must fail. Security-wise `ALWAYS` is *stricter* than `ORIGIN` (it also fires in replica sessions), so this is a specification deviation rather than a weakening — but it is undeclared drift from the expected definition. **Correction:** require `'O'` exactly, or document `'A'` as an accepted variant. **Test:** `ENABLE ALWAYS TRIGGER` → expected code. Does not block.

### F-PR3C-11 · P3 · Dead code remains after the F-PR3-27 cleanup

`verify.ts:724` — `void ENFORCEMENT_CONTEXT_VERSION;`. Also `app/db.server.ts:177-179`, an `if` block with an empty body and only a comment. **Correction:** remove both. Does not block.

### F-PR3C-12 · P3 · Catalog lookups match constraint and function names without schema/table qualification

`verify.ts:412-415`, `:543`, `:640`, `:813` and `apply.ts:200-204`, `:213-216`, `:227-233`, `:148-155` select on `conname = $1` / `proname = $1` / `relname = $1` with no `connamespace`/`conrelid` qualification and then take `rows[0]`. PostgreSQL constraint names are unique per table, not per schema, so a same-named constraint on a different table (or an overloaded function) makes the result order-dependent. Not currently exploitable — the manifest names are globally distinct — but it weakens the "exact definition" guarantee. **Correction:** qualify every catalog lookup by namespace and relation, and fail on multiple matches. **Test:** create a same-named constraint on a second table; assert the verifier still evaluates the correct one or fails explicitly. Does not block.

### F-PR3C-13 · P3 · The correction implementation report misstates the final head and CI run

At the reviewed head, `PR3_DATABASE_ENFORCEMENT_CORRECTION_IMPLEMENTATION_REPORT.md:28` labels `0307534…` "Exact final PR head" and `:169-180` records run `30828120871` / job `91734905661` on `0307534…`. The actual handoff head is `cb9d04e…` with run `30829580600` / job `91739866934`. The PR body **does** disclose the lag explicitly ("Docs internally pin `0307534…`; handoff head is one docs-sync commit later — minor identity lag residual"), so this is a self-declared documentation lag, not a false claim — but it means the correction report does not describe itself, repeating the shape of F-PR3-22. **Correction:** update the report to the actual head and run. Does not block.

### F-PR3C-14 · P3 · Advisory-unlock failure is checked and then swallowed

`apply.ts:104-112` throws `advisory_unlock_failed` when `pg_advisory_unlock` returns false, but the `finally` at `:903-909` catches and discards it, so a failed release is never reported. I confirmed `pg_advisory_unlock` returns `false` when the lock is not held, so the check itself is meaningful. **Correction:** surface the failure in the result (e.g. a `lock_release_failed` flag) rather than discarding it. Does not block.

### F-PR3C-15 · P3 · Runbook overstates the runtime URL guarantee

`PR3_DATABASE_ENFORCEMENT_RUNBOOK.md:76` — stage 8 failure action reads "Fail closed on privileged URL". Given F-PR3C-01 this holds only when `DATABASE_MIGRATION_URL` is also present in the runtime environment, which the same runbook does not require (and which contradicts stage-8's own intent of keeping the privileged URL away from app processes). **Correction:** state the actual precondition, or fix F-PR3C-01 and keep the claim. Does not block on its own.

### F-PR3C-16 · P3 · The non-superuser migration-owner requirement is opt-in and absent from the runbook

`roles.ts:698-704` fails on a superuser owner only when `STOCKY_REQUIRE_NONSUPERUSER_OWNER=1`. No runbook precondition, deployment stage, or CI step sets it, and the runbook's "Preconditions" section does not mention owner attributes at all. The original F-PR3-13 required confirmation that the production migration owner is a non-superuser table owner. **Correction:** add a runbook precondition and set the variable in any staging/production verification path. Does not block PR 3 (no production execution is authorized) but must be closed before any production apply.

### F-PR3C-17 · P3 · Test helper reintroduces the hardcoded runtime password default

`scripts/tenant-enforcement/tests/helpers.ts:28-30` defaults `STOCKY_RUNTIME_ROLE_PASSWORD` to `stocky_runtime_ci_only` when unset. The production path in `roles.ts` correctly refuses to default (F-PR3-24 closed), so this is confined to the disposable test harness — but it is the same literal the original review flagged, now one import away from any script that pulls in the helpers. **Correction:** require the variable in the harness too, or move the default into the CI workflow only. Does not block.

---

## 10. Local command evidence

Environment: Node **v22.22.2**, npm **11.5.2**, PostgreSQL **16.13** (locale `C`/`C`, port 55432, disposable cluster), Redis **7.0.15** (port 56379, `DBSIZE` 0 before and after), reviewed head `cb9d04e…`, detached, clean tree. No production credentials, no merchant data, no network deployment.

| Command | Exit | Result |
| --- | :---: | --- |
| `node --version` / `npm --version` | 0 | v22.22.2 / 11.5.2 |
| `npm ci` | 0 | installed (22 high-severity advisories reported, pre-existing) |
| `npx prisma generate` | 0 | ok |
| `npx prisma validate` | 0 | schema valid |
| `npx prisma migrate deploy` | 0 | all migrations applied |
| `npm run tenant:indexes:apply -- --apply` | 0 | 44 created, 0 failed |
| `npm run tenant:indexes:verify` | 0 | `ok:true` |
| `npm run tenant:schema:drift` | 0 | `tenant_prisma_schema_drift_ok` |
| `npm run tenant:indexes:plan` | 0 | `valid_exact: 44` |
| `npm run tenant:access:audit` | 0 | `tenant_access_audit_ok`, 18 models |
| `npm run tenant:access:inventory:check` | 0 | fresh |
| `npm run tenant:enforcement:inventory:check` | 0 | fresh |
| `npm run tenant:enforcement:preflight` | 0 | `ok:true`, mode `resume`, 18 tables |
| `npm run tenant:roles:provision -- --apply` | 0 | `ok:true`, phase `prepare`, `merchantDmlGranted:false` |
| `npm run tenant:roles:verify` | 0 | `ok:true`, `actualTableOwner:"stocky"` |
| `npm run tenant:enforcement:plan` | 0 | 149 steps, `preflightOk:true` |
| `npm run tenant:enforcement:apply -- --apply` | 0 | `ok:true`, 149/149 completed, `unsafe:false`, max lock 159 ms |
| `npm run tenant:enforcement:verify` | 0 | `ok:true` |
| `npm run tenant:enforcement:drift` | 0 | `ok:true` |
| `npm run tenant:rls:verify` | 0 | `ok:true` |
| `npm run tenant:immutability:verify` | 0 | `ok:true` |
| `npm run test:db-isolation` | 0 | 2 files, **19 tests** |
| `npm run test:tenant-access` | 0 | 34 files, **287 tests** |
| `npm run test:migrations` | 0 | 34 files, **150 tests** |
| `npm run test:subject-memory` | 0 | 1 file, **2 tests** |
| `npm run lint` | 0 | clean |
| `npm run typecheck` | 0 | clean |
| `npm test` | 0 | 6 files, **56 tests** |
| `npm run build` | 0 | ok |
| `npm run graphql-codegen` | **1** | **BLOCKED — environment.** Exits 1 with no diagnostic; the Shopify Admin schema fetch is unavailable through this sandbox's egress proxy. CI step 80 "GraphQL codegen / schema validation" is **success** at the exact reviewed head, which I accept as the substitute evidence. |
| `git diff --check` | 0 | clean |
| Focused: `definition-drift` | 0 | 11 |
| Focused: `composite-definition-drift` | 0 | 2 |
| Focused: `immutability-trigger-drift` | 0 | 3 |
| Focused: `exact-privilege-allowlist` | 0 | 2 |
| Focused: `connected-identity` | 0 | 4 |
| Focused: `role-membership` | 0 | 6 |
| Focused: `partial-apply-recovery` | 0 | 11 |
| Focused: `populated-concurrency` | 0 | 1 |

Working tree remained clean throughout; inventories regenerate to the committed content (`tenant:access:inventory:check` and `tenant:enforcement:inventory:check` both report fresh). All reviewer probe scripts were written outside the repository tree (`node_modules/.reviewer-probe/`, untracked and ignored) and removed before the report commit.

---

## 11. Residuals

### 11.1 Acceptable PR 3 residuals

- F-PR3-18 — extra round-trips per merchant read; documented, no false performance claim, no benchmark.
- F-PR3-20 — 14 of 16 pool scenarios still unproven; deferral stated honestly.
- F-PR3-25 — test reset helper still exported from the runtime module under a `NODE_ENV` guard.
- F-PR3-29(a) — runtime can enumerate all `Shop` rows; approved bootstrap exemption.
- F-PR3C-09 through F-PR3C-17 (P3) — quality, honesty and maintainability items.

### 11.2 Production rollout evidence still required (not PR 3 blockers)

- Populated apply on a production-shaped dataset with merchant-query latency and lock-wait measurement.
- Confirmation that the production migration owner is a **non-superuser** table owner, with `STOCKY_REQUIRE_NONSUPERUSER_OWNER=1` enforced (F-PR3C-16).
- Backup/restore rehearsal — correctly recorded as **Unexecuted**.
- Maintenance-window sizing derived from real lock evidence.

### 11.3 PR 4 dependencies

- PR 4 must not add merchant tables until F-PR3C-02 is closed, or new tables will inherit runtime grants without RLS.
- Real export, privacy-processing, reconciliation and replay/repair execution paths (F-PR3-16 deferral).

### 11.4 Unacceptable remaining defects (must be corrected)

| ID | Sev |
| --- | :---: |
| F-PR3C-01 — runtime connected identity never verified by the application | P1 |
| F-PR3C-02 — future-table default privileges undetected | P1 |
| F-PR3C-03 — `roles:verify` mutates and erases schema-CREATE drift | P2 |
| F-PR3C-04 — vacuous "deadlock/timeout recovery" CI step | P2 |
| F-PR3C-05 — sequence privileges outside the allowlist | P2 |
| F-PR3C-06 — privilege-allowlist suite covers 2 of 16 cases | P2 |
| F-PR3C-07 — resume preflight silent on dangerous drift | P2 |
| F-PR3C-08 — populated evidence does not measure §15 quantities; reported timing not reproducible | P2 |

---

## 12. Reviewer confirmations

- **No production or merchant data was accessed.** All work used a disposable local PostgreSQL 16 cluster seeded with two synthetic shops and a synthetic 50-shop / 200 000-row fixture.
- **No deployment, no production backfill, no ownership repair, no inventory mutation.**
- **Every inventory-write flag remains DEFAULT OFF** — the correction range contains no flag-enabling change.
- **No production secrets** exist in the correction range; the only credentials used were the disposable local `stocky` / `stocky_runtime` passwords.
- **No PR 4 work** entered the range.
- **Implementation was not modified by the reviewer.** The only file added by this review is this report. Reviewer probe scripts lived outside the tracked tree and were deleted.
- **PR #15 remains open, draft and unmerged.** No amend, rebase or force-push was performed. The reviewed implementation/handoff head is `cb9d04ebe1a99df2f8b4db0188efd20049c59633`; this report-only commit is a later, separate commit.

---

## 13. Next action

```text
Return to ChatGPT for the exact Cursor PR 3 follow-up correction prompt.
```
