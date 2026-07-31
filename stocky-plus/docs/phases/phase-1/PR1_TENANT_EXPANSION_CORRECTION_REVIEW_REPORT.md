# PR 1 — Tenant Expansion and Backfill: Independent Correction Review

**Intended location:** `stocky-plus/docs/phases/phase-1/PR1_TENANT_EXPANSION_CORRECTION_REVIEW_REPORT.md`

---

## 1. Executive summary

The corrected head is a large and, in several areas, genuinely strong improvement over the head that received the original `NOT READY` verdict. The most serious original findings about index rollout are now **empirically corrected**: `prisma migrate deploy` no longer builds any index on a populated merchant table, all 28 compatibility indexes are built by the external concurrent tool, and the verify path is genuinely fail-closed against invalid indexes, same-name/wrong-definition indexes, and silent repair. I reproduced each of those behaviors directly against disposable PostgreSQL 16.14. The maintenance-URL guardrail (R12) is correctly wired and fails before any connection is opened. Scope discipline is intact: exactly 18 nullable `shopId` columns, no `Shop` foreign keys, no RLS, no policies, no inventory-write flag changes, no PR 2 / PR 3 / Phase 2 work.

However, the review cannot be closed. Two of the mandated deep-dive areas contain defects that go to the heart of the merge gate, and both were confirmed by direct experiment rather than by reading test names:

**R9 — the concurrent-index overlap proof is invalid.** The test's stated mechanism for keeping `CREATE INDEX CONCURRENTLY` in flight — "Hold open snapshots so CREATE INDEX CONCURRENTLY remains active until released" — does not work. The holder sessions run at PostgreSQL's default `READ COMMITTED` isolation, where the snapshot is released when the `SELECT` statement finishes. I measured `backend_xmin` as **null** for both idle-in-transaction holders, and `CREATE INDEX CONCURRENTLY` over 20,000 rows completed in **63 ms** with both holders open. The identical experiment at `REPEATABLE READ` produced `backend_xmin = 855` and held the build for **8,978 ms**. The build is therefore not held open at all; any overlap observed in CI is an accidental sub-100 ms race, not engineered proof. Compounding this, `buildCompletedAt` is assigned only when the promise is *awaited* — after the writes and after the holders commit — so every interval assertion of the form `w.end <= buildCompletedAt` is satisfiable even if the build finished before the first write began. The tautological `expect(buildSettled || true).toBe(true)` is still present, and the `AccessExclusiveLock` absence assertion is vacuous whenever the polling loop exits on a progress-only observation. The emitted `buildDurationMs` evidence is materially misleading for the same reason.

**R10 — the run subject is not deterministic.** Direct-owner domain discovery issues `SELECT DISTINCT shop FROM "<table>"` with **no boundary predicate**, while membership evidence is bounded by `id <= highWaterMark`. A row inserted above a direct-owner high-water mark before discovery runs can therefore change discovered domains, proposed Shops, `shopsWouldCreate`, discovery issues, and run blocking status, while the membership checksum remains unchanged and no drift is detected. Separately, `membershipChecksum` is computed over **ordered IDs only**, so deleting an in-boundary row and recreating a materially different row with the same ID is invisible — I confirmed the checksum is byte-identical. The code's own error text claims "identity replacement inside the original high-water mark fails closed," which is not true as implemented. Starting evidence is also not captured under one coherent snapshot: `beforeCounts`, dataset boundaries, and domain discovery are three separate unsynchronized read phases outside any transaction.

I must also be explicit about a material limitation of this review: **the Prisma-dependent half of the mandated command list could not be executed.** My sandbox egress policy blocks `binaries.prisma.sh`, so Prisma cannot download its schema/query engines. Consequently `prisma generate`, `prisma validate`, `prisma migrate deploy`, `npm run tenant:schema:drift`, `npm run test:migrations`, `npm test`, `npm run typecheck`, and `npm run build` could not be run, and `npm run graphql-codegen` additionally requires blocked access to `shopify.dev`. I worked around this for schema and index verification by applying the migration SQL directly with `psql` and by driving the index tooling, which uses `pg` rather than Prisma engines. The backfill engine itself could not be executed. My R10 and R11 conclusions are therefore based on code inspection plus targeted SQL and Node experiments, not on full-engine runs, and I flag below exactly which claims remain unverified.

Verdict: **NOT READY**.

---

## 2. Review identity

| Item | Value |
|---|---|
| Reviewer | Independent senior reviewer (Claude), fresh session |
| Review date | 2026-07-31 |
| Repository | `Vedang1998/Stocky` (public) |
| Pull request | #11 — Add Phase 1 tenant expansion and backfill foundation |
| Base main | `8ccc8d29a78e05615b31324b38df17f4f1d1296e` |
| Original reviewed head | `7aabb095806716697bfea2783379351b15e1cda2` |
| Original verdict | `NOT READY` |
| Exact corrected head reviewed | `fb04345f129b8664566c5947f2ad75f57102269b` |
| Repository modified | No |
| Commits created / pushed / merged | None |
| GitHub PR approved | No |

---

## 3. Repository, PR, and exact-head CI verification

All identity facts were verified against the GitHub API, not against the PR description. **Every reported CI claim checked out.**

```
git rev-parse HEAD  →  fb04345f129b8664566c5947f2ad75f57102269b
git status --porcelain → (empty; clean tree)
```

| Claim | Verified value | Result |
|---|---|---|
| PR state | `open` | ✅ |
| Draft | `true` | ✅ |
| Merged | `false` | ✅ |
| PR head SHA | `fb04345f129b8664566c5947f2ad75f57102269b` | ✅ matches |
| PR base SHA | `8ccc8d29a78e05615b31324b38df17f4f1d1296e` | ✅ matches |
| Branch tip `phase-1/tenant-expand` | `fb04345f…` | ✅ no commit after review head |
| Workflow run `30595774582` `head_sha` | `fb04345f…` | ✅ genuinely associated |
| Run conclusion | `success` | ✅ |
| Job `91047713940` name | `Lint, typecheck, test, build, Prisma, GraphQL` | ✅ |
| Job conclusion / head_sha | `success` / `fb04345f…` | ✅ |
| PR size | 8 commits, 63 files, +8546 / −206 | ✅ |

Actions **log content** was not retrieved (unauthenticated API); I verified run/job identity, conclusion, and head association, but not the per-step stdout. Any claim resting on specific CI log output remains unverified by me.

Commits base→head: `854a3d5`, `0d836e1`, `7aabb09` (original reviewed head), `3a6ae28`, `e8f91ae`, `6a65c08`, `adf0b52`, `fb04345`.

---

## 4. Environment

| Component | Value |
|---|---|
| OS | Ubuntu 24.04.4 LTS (disposable container) |
| PostgreSQL | **16.14** (Ubuntu 16.14-0ubuntu0.24.04.1), disposable, `initdb` + local instance |
| Node | v22.22.2 |
| npm | 11.5.2 (pinned per `engines`) |
| Database | `stocky_plus_ci`, role `stocky`, `127.0.0.1:5432` — CI-equivalent |
| Env | Mirrors `.github/workflows/ci.yml` (test placeholders; all inventory-write flags `false`) |
| Production/merchant data | None accessed |

**Egress restrictions (material):** `binaries.prisma.sh` → HTTP 403; `shopify.dev` → unreachable. `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1` does not help, since the engine binary itself is served from the blocked host.

---

## 5. Commands executed and exit codes

| Command | Exit | Notes |
|---|---|---|
| `git diff --check` | **0** | Clean |
| `npm ci` | **0** | Required pinning npm to 11.5.2 first (`EBADENGINE` otherwise) |
| `npx prisma generate` | **1** | ⛔ **BLOCKED** — engine download 403 |
| `npx prisma validate` | **1** | ⛔ **BLOCKED** — engine download 403 |
| `npx prisma migrate deploy` | **1** | ⛔ **BLOCKED** — engine download 403 |
| *(substitute)* `psql -f` each `migration.sql` in order | **0** | All 5 migrations applied cleanly from empty DB |
| `npm run tenant:indexes:plan` (pre-apply) | **1** | Expected; `{"missing":28}` |
| `npm run tenant:indexes:apply -- --apply` | **0** | 28 indexes created |
| `npm run tenant:indexes:verify` | **0** | `{"ok":true,"mismatches":[]}` |
| `npm run tenant:indexes:plan` (post-apply) | **0** | `{"valid_exact":28}` |
| `npm run tenant:schema:drift` | — | ⛔ **BLOCKED** (invokes `prisma migrate diff`) |
| `npm run test:migrations` | — | ⛔ **BLOCKED** (Prisma client) |
| `npm run lint` | — | Not run (dependent pipeline blocked) |
| `npm run typecheck` | — | ⛔ **BLOCKED** (needs generated Prisma client types) |
| `npm test` | — | ⛔ **BLOCKED** (Prisma client) |
| `npm run build` | — | ⛔ **BLOCKED** |
| `npm run graphql-codegen` | — | ⛔ **BLOCKED** (`shopify.dev` unreachable) |

**No blocked command is reported as passing.** Additional independent experiments (CIC isolation behavior, index fail-closed, maintenance-URL guard, checksum property) are recorded in §9–§13.

---

## 6. Scope verification

Verified directly against the schema built from the PR's own migrations.

**Present and correct:**

| Check | Method | Result |
|---|---|---|
| Nullable `shopId` on exactly 18 models | `information_schema.columns` | ✅ 18 columns, all `is_nullable = YES` |
| Canonical `Shop` + unique `myshopifyDomain` | migration `20260730160000` | ✅ |
| Legacy `shop` preserved | schema diff | ✅ retained |
| `Session` unchanged | diff | ✅ |
| Run / checkpoint / issue / detection records | migrations `…160000`, `…220000` | ✅ |
| Domain normalization | `app/lib/shop-domain.ts` + tests | ✅ present |
| Concurrent index tooling | `scripts/tenant-indexes/**` | ✅ |
| Diagnostics / quarantine | `scripts/tenant-backfill/diagnose.ts` | ✅ |

**Correctly absent:**

| Prohibited item | Verification | Result |
|---|---|---|
| Non-null `shopId` | all 18 nullable | ✅ absent |
| Shop ownership FKs | `pg_constraint` where `confrelid = "Shop"` → 0 rows | ✅ absent |
| Composite child FKs | diff | ✅ absent |
| RLS / forced RLS | `pg_class.relrowsecurity` → 0 rows | ✅ absent |
| RLS policies | `pg_policies` → 0 | ✅ absent |
| DB roles, txn-local tenant context, runtime tenant conversion, dual writes | diff | ✅ absent |
| Shopify sync expansion, inventory mutations | diff | ✅ absent |
| PR 2 / PR 3 / Phase 2 work | diff | ✅ absent |

The 18 models: `BomComponent, ForecastOverride, InventorySnapshot, LeadTimeSnapshot, LowStockAlert, POLineItem, PurchaseOrder, SalesDailyAggregate, ShopSettings, ShopifyVariantCache, Stocktake, StocktakeLineItem, Supplier, SupplierSkuMapping, TransferLineItem, TransferOrder, VariantAbcClass, VolumePriceTier`.

**Scope verdict: PASS.**

---

## 7. Original finding-by-finding correction assessment

| ID | Subject | Status | Basis |
|---|---|---|---|
| F-PR1-01 | Dry-run/apply equivalence | ⚠️ **Unverified** | Test file present; engine not executable here |
| F-PR1-02 | Issue/checkpoint atomicity | ⚠️ **Unverified** | `batch-atomicity.migration.test.ts` present; not executed |
| F-PR1-03 | Blocking-condition accuracy | ⚠️ **Unverified** | `cross-domain-blocking.migration.test.ts` present; not executed |
| F-PR1-04 | Issue reopening / count semantics | ⚠️ **Unverified** | `issue-reopen-counts.migration.test.ts` present; not executed |
| F-PR1-05 | No blocking index build via Prisma Migrate | ✅ **CORRECTED** | Migration `…160100` is a documented `SELECT 1` no-op; 0 compatibility indexes exist after migrate |
| F-PR1-06 | Concurrent index tool owns all 28 | ✅ **CORRECTED** | Apply created 28; post-apply plan `valid_exact: 28`; `pg_index` shows 28/28 valid |
| F-PR1-07 | Invalid index fails closed | ✅ **CORRECTED** | Forced `indisvalid=false` → verify exit 1, `"ok":false`, `status:"invalid"` |
| F-PR1-08 | Same-name index not trusted | ✅ **CORRECTED** | Same name / wrong column → `status:"wrong_definition"`, exit 1 |
| F-PR1-09 | No unexpected automatic drop | ✅ **CORRECTED** | Apply exit 1 with explicit "does not silently repair or drop it… Recovery requires an explicitly authorized DROP INDEX CONCURRENTLY" |
| F-PR1-10 | Pinned apply lock | ⚠️ **Partial** | Dedicated non-pooled `pg.Client` confirmed in `connection.ts`; PID/unlock/cleanup assertions in `apply-lock.migration.test.ts` not executed |
| F-PR1-11 | Domain normalization | ⚠️ **Unverified** | `shop-domain.ts` + unit tests present; not executed |
| F-PR1-12 | Resume evidence preservation | ⚠️ **Partial / see F-N02** | Fields persisted on run record, but the evidence they preserve is not itself deterministic |
| F-PR1-13 | Dataset drift detection | ❌ **NOT corrected** | ID-only checksum; same-ID replacement undetected (§10) |
| F-PR1-14 | True affected-row races | ⚠️ **Unverified** | `engine-races.migration.test.ts` present; not executed |
| F-PR1-15 | Concurrent-index non-blocking proof | ❌ **NOT corrected** | Overlap mechanism empirically disproven (§9) |

---

## 8. R1–R8 assessment

| Ref | Area | Status |
|---|---|---|
| R1 | Migration additivity / empty-DB apply | ✅ Verified — all 5 migrations apply cleanly from empty |
| R2 | Concurrent index tooling exists and is exercised | ✅ Verified end-to-end |
| R3 | Index classification correctness | ✅ Verified (`valid_exact` / `invalid` / `wrong_definition` / `missing`) |
| R4 | Legacy `shop` preservation, `Session` untouched | ✅ Verified |
| R5 | Additive-only tooling, no runtime behavior change | ✅ Verified by diff |
| R6 | Diagnostics / quarantine records present | ✅ Present (behavior unverified) |
| R7 | Runbook and phase records | ✅ Present |
| R8 | CI wiring of index lifecycle | ✅ Verified in `ci.yml` (apply → verify → drift → plan, in correct order) |

---

## 9. R9 — concurrent-index overlap reproduction

This is the mandated deep-dive and it is the strongest finding in the review. I answered each of the twelve prompted questions empirically rather than by reading the test name or the emitted JSON.

### Experiment 1 — do the "snapshot holders" hold a snapshot?

Replicating the test exactly: `new Client(...)`, `BEGIN`, `SELECT COUNT(*)`, then **idle in transaction** (no isolation level specified → `READ COMMITTED`).

```
=== holders: state + backend_xmin (idle-in-transaction, READ COMMITTED) ===
4606|idle in transaction||t
4605|idle in transaction||t          ← backend_xmin is NULL for both

=== CIC timing with idle READ COMMITTED holders open ===
CIC_ELAPSED_MS=63
```

### Experiment 2 — control at REPEATABLE READ

```
=== REPEATABLE READ holder xmin ===
4626|idle in transaction|855        ← snapshot retained

CIC_ELAPSED_MS=8978
```

**Conclusion.** Under `READ COMMITTED` the snapshot is released at statement end and `MyProc->xmin` is cleared, so `WaitForOlderSnapshots` has nothing to wait for. The holders' `AccessShareLock` does not conflict with the `ShareLock` that `WaitForLockers` waits on, so they do not delay the phase transitions either. The comment *"Hold open snapshots so CREATE INDEX CONCURRENTLY remains active until released"* is **factually false as written**. A 142× difference (63 ms vs 8,978 ms) between the two isolation levels isolates the mechanism unambiguously.

### Answers to the mandated questions

1. **Isolation level of holders:** default `READ COMMITTED` — never set explicitly.
2. **Does the snapshot survive the `SELECT`?** No. `backend_xmin` measured null.
3. **Does the test genuinely keep the build in progress?** No. It relies entirely on a 20,000-row scan lasting long enough — measured at ~63 ms.
4. **Observation tied to exact builder PID and relation?** Partially. Both queries filter `pid = builderPid`, and the lock query joins `pg_class` on `relname = 'Supplier'`; the `pg_stat_progress_create_index` query does **not** constrain the relation.
5. **Could an early-phase observation be followed by completion before a write begins?** Yes. The loop exits on the *first* observation, then three writes follow inside a ~63 ms window. The only real guard is `expect(buildSettled).toBe(false)`, which makes the test **fail-flaky** rather than falsely-passing — on a faster host, a warm cache, or a loaded runner it will fail, or the first poll will miss the build entirely and `expect(observations.length).toBeGreaterThan(0)` will fail after a 30 s spin.
6. **Is completion timestamped when the promise settles?** **No.** `buildCompletedAt = Date.now()` executes only after `await buildPromise`, which is placed *after* the writes and after the holders commit. The actual settle time is discarded.
7. **Could the final overlap assertion pass even if the build completed during/before the write?** **Yes** — this is the direct consequence of (6). Every assertion of the form `w.end <= buildCompletedAt` and `w.start < buildCompletedAt` is trivially satisfiable.
8. **Does `buildSettled || true` remain?** **Yes** — still present inside the write-window loop. It is a tautology and can never fail.
9. **Are insert/update/delete proven to run while the builder is active?** Only by the `expect(buildSettled).toBe(false)` checks — which is a genuine but timing-dependent guard, not deterministic proof.
10. **Is absence of `AccessExclusiveLock` proved?** **No.** `lockObs.every(...)` returns `true` on an empty array, and the loop can exit having collected only a `pg_stat_progress_create_index` row. The assertion is vacuous in that path.

### Consequence for recorded evidence

`buildDurationMs = buildCompletedAt − buildStartedAt` will report the wall time to the await point — inflated by the holder sleep and the write sequence — while the real build took tens of milliseconds. The `tenant_index_concurrent_write_evidence` JSON preserved as proof is therefore **materially misleading**, which matters more than the test defect itself because that artifact is intended to be durable evidence.

**R9 verdict: FAIL — overlap is not deterministic and not empirically proven.** → **F-N01 (P1)**, **F-N05 (P3)**, **F-N06 (P3)**.

---

## 10. R10 — dataset-boundary and determinism assessment

### Domain discovery is not bounded by the run subject

`engine.ts:511` (Session) and `engine.ts:520` (direct-owner tables):

```sql
SELECT DISTINCT shop FROM "Session" ORDER BY shop
SELECT DISTINCT shop FROM "<table>" ORDER BY shop     -- no id <= highWaterMark
```

`boundaries.ts` provides `boundaryPredicate()` for exactly this purpose, and it is **not applied** to discovery. A row inserted above a direct-owner high-water mark — before discovery, after discovery but before row processing, or during an interrupted/resumed run — introduces a new domain candidate. That can change discovered/proposed Shops, `shopsWouldCreate`, discovery issues, Shop counts, and run blocking status, while the membership checksum (bounded by `id <= highWaterMark`) stays identical and `assertMembershipUnchanged` reports no drift. **The run's conclusions are therefore not a function of the run's recorded subject.**

Unrestricted `Session` discovery is a related but separable concern: `Session` has no recorded boundary at all, so a new install mid-run changes discovery. This needs either a Session snapshot/boundary or an explicitly documented and product-owner-approved exception.

### Same-ID replacement is undetected

`membershipChecksum` hashes **ordered IDs only**:

```
before checksum: a25d52a0c166765d1380189b9c1ffd1c5ec1021aa2ac16b1ee67a39d618e44dc
after  checksum: a25d52a0c166765d1380189b9c1ffd1c5ec1021aa2ac16b1ee67a39d618e44dc
SAME-ID REPLACEMENT DETECTED? false
```

Delete an in-boundary row, recreate a materially different row (different `shop`, different parent, different content) with the same ID → count and ID set unchanged → checksum unchanged → drift check passes and the row is classified against evidence gathered for a different row.

This is aggravated by the error text in `assertMembershipUnchanged`, which states: *"Insertion, deletion, or identity replacement inside the original high-water mark fails closed."* **Identity replacement does not fail closed.** An operator reading that message during a production cutover would be actively misled. Membership evidence needs immutable or ownership-relevant starting content (e.g. `createdAt`, legacy `shop`, parent FK) folded into the hash — `checksumRows()` already exists and does exactly this.

### Starting snapshot is not coherent

`engine.ts:464–468` and `:508+` execute three unsynchronized phases outside any transaction, with no `REPEATABLE READ`:

1. `beforeCounts.Shop`, then per-table `beforeCounts` (sequential, one query each);
2. `loadDatasetBoundaries` (one query per table);
3. domain discovery (one query per table).

Concurrent writes between any two phases yield mutually inconsistent starting evidence. `prisma.$transaction` is used elsewhere in the file, so the capability is available and simply is not applied to the evidence-capture phase.

### Operational concern — unbounded ID materialization

`loadTableBoundary` runs `SELECT id FROM "<table>" ORDER BY id ASC` and materializes **every ID into a JS array**, for all 18 tables, then again in `recomputeMembershipChecksum` on resume. On production-scale `InventorySnapshot` / `SalesDailyAggregate` (potentially tens of millions of rows) this is a memory and latency hazard for the exact operation it is meant to make safe. A server-side aggregate (e.g. `md5`/`sha` over ordered IDs, or `count(*)` + `max(id)` + a streaming digest) avoids materialization.

### Items I could not test

Parent-evidence stability across resume, diagnostic checkpoint rehydration, empty-boundary exclusion after later inserts, and the final ownership checksum's exclusion of above-boundary rows all require executing the engine, which was blocked. The empty-boundary path *looks* correct by inspection (`highWaterMark === null` → `boundaryPredicate` returns `FALSE`), but I did not execute it.

**R10 verdict: FAIL.** → **F-N02 (P1)**, **F-N03 (P1)**, **F-N04 (P2)**, **F-N07 (P2)**.

---

## 11. R11 — full-engine race assessment

**Not independently verified.** `engine-races.migration.test.ts` (215 lines) imports `runTenantBackfill` and uses real `pg.Client` sessions plus `issueFingerprint`, so it is structurally the right shape — full engine, separate committed sessions, not a unit stub. But it cannot be executed here, so I cannot confirm the matching-assignment (`concurrently_resolved`, unchanged checkpoint, no issue created), conflicting-assignment (`CONCURRENT_SHOP_ID_CONFLICT`, atomic issue+detection+checkpoint, run blocked, no duplication on resume), or deletion (batch failure, checkpoint rollback) claims.

**Test-only callback boundary — reviewed and acceptable.** `BeforeShopIdUpdateHook` / `onBeforeShopIdUpdate` is an optional field on `BackfillOptions`, documented as test-only, invoked only when supplied. `cli.ts` does not pass it. When absent it cannot affect production behavior. It is nonetheless a production-code test seam; I would prefer it excluded from the production build surface, but it does not block.

One residual risk worth flagging for whoever does execute these: a hook that opens a second session inside the guarded-update transaction is a natural deadlock source, and any test that pauses inside a transaction while another session writes the same row needs a lock timeout to fail fast rather than hang to the vitest timeout.

**R11 verdict: UNVERIFIED (not a pass).**

---

## 12. R12 — maintenance-URL assessment

**PASS — verified empirically.**

Wiring: `cli.ts:52` sets `requireExplicitMaintenanceUrl = (mode === "apply")`; `getMaintenanceClient` calls `resolveMaintenanceDatabaseUrl` **before** `new Client()` / `connect()`, so rejection genuinely precedes any connection.

| Scenario | Expected | Observed | Result |
|---|---|---|---|
| `TENANT_MAINTENANCE_DATABASE_URL` unset, `DATABASE_URL` present | fail before connect | exit 1, *"TENANT_MAINTENANCE_DATABASE_URL is required for tenant:indexes:apply (DATABASE_URL alone is not accepted…)"* | ✅ |
| Explicit URL matching pooler guardrail | reject | exit 1, *"must not use a pooler or PgBouncer endpoint"* | ✅ |
| CI supplies explicit maintenance URL | present | `ci.yml` sets it both job-wide and per-step on the apply step | ✅ |

**Bypass analysis.** `applyIndexes` is exported and called with a caller-supplied client in tests via `withMaintenanceClient`. That is harmless test/library access, not an operational bypass: no production-facing entry point reaches a mutating apply without going through `cli.ts`, and `package.json` exposes only the CLI. Minor nit: `cli.ts` opens the client *before* validating the `--apply` flag, so `apply` without `--apply` connects then exits 1 — harmless but slightly untidy.

`POOLER_PATTERN` is a string heuristic and is correctly self-described as a guardrail only. Acceptable for PR 1; the real protection must come from the deployment plan.

---

## 13. R13 — Prisma-drift assessment

**Partially verified — command shape correct, runtime behavior unverified.**

The child-process argv is exactly the expected shape and contains **no credentials**:

```
npx prisma migrate diff
  --from-schema-datasource <APP_ROOT>/prisma/schema.prisma
  --to-schema-datamodel   <APP_ROOT>/prisma/schema.prisma
  --exit-code
```

with `DATABASE_URL` passed through `env: { ...process.env, DATABASE_URL: url }`. ✅ No URL in argv.

**Not comparing the datamodel with itself.** `--from-schema-datasource` resolves the *live database* via the schema's datasource block; `--to-schema-datamodel` reads the *datamodel*. The two flags differ in kind despite pointing at the same file. ✅ Correct.

Exit-code handling is correct and distinguishes the three cases: `0` → ok, `2` → drift (throws with diff output), anything else → distinct "failed with exit code N" error. ✅

**Unverified:** matching-database-returns-zero, missing-compatibility-index-returns-drift, and non-index-alteration-returns-drift could not be executed (`prisma migrate diff` needs the blocked schema engine).

**One residual confidentiality risk (P3).** On the error path the code interpolates `result.stderr` into the thrown message. Prisma connection errors (e.g. `P1001`) embed the resolved host and port. No password is exposed, but host/port can reach logs. Consider redacting stderr before surfacing.

**Design note (correct, worth recording):** because migration `…160100` is a no-op, a database that has had only `prisma migrate deploy` applied is *legitimately drifted* against the datamodel until `tenant:indexes:apply` runs. CI orders the steps correctly (apply → verify → drift). Operators must not run drift before apply and read the result as a defect; the runbook should state this explicitly if it does not already.

---

## 14. Schema and migration assessment

**PASS.**

Five migrations apply cleanly from an empty database, in order, with `ON_ERROR_STOP=1`:

```
20260728000000_init_stocky_plus                      OK
20260730160000_tenant_expansion                      OK
20260730160100_tenant_compatibility_indexes          OK
20260730210000_tenant_backfill_correction            OK
20260730220000_tenant_ownership_issue_detection      OK
```

`CREATE INDEX` audit across all migrations: every non-concurrent index build targets either a table created in the same migration (`TenantOwnershipIssueDetection`, `TenantBackfillRun`, `TenantBackfillCheckpoint`, `TenantOwnershipIssue`, `Shop`) or pre-existing `init` indexes unchanged by this PR. **No compatibility index is built by Prisma Migrate** — confirmed by count query returning 0 after migrate.

Migration `…160100` is a well-documented no-op marker explaining D-024 and the rejected earlier approach. Rewriting that migration directory in place is acceptable *only* because PR #11 is unmerged; the file says so explicitly. Good practice.

Additivity: all 18 `shopId` columns nullable, no FKs added to `Shop`, legacy `shop` retained.

---

## 15. Backfill, checkpoint, quarantine, and evidence assessment

**Cannot be certified.** The engine (1,635 lines) could not be executed. Structurally the design is sound — approved-table allowlist with `assertApprovedTable`, parameterized boundary predicates, `$transaction`-wrapped batch application, checkpoint records, fingerprinted issues with run-scoped detections, reason-code enumeration.

Two positives I can confirm by inspection:
- SQL identifier interpolation is confined to table names drawn from `BACKFILL_TABLE_ORDER` and gated by `assertApprovedTable`; values are parameterized (`$1`). No injection path found.
- `redactShopEvidence` is applied to domain evidence before it is written to issue records — good instinct for a table that will hold merchant data.

But the evidence layer that everything else rests on is defective per §10: the run subject is not deterministic, and drift detection has a same-ID blind spot while claiming otherwise. Until that is fixed, checkpoint/quarantine correctness cannot be certified even if the tests pass, because the tests would be validating behavior against a subject definition that concurrent activity can move.

---

## 16. Test-quality and flakiness assessment

| Observation | Severity |
|---|---|
| R9 overlap window depends on a ~63 ms accidental race; `expect(buildSettled).toBe(false)` will fail intermittently on faster/loaded hosts | P1 (F-N01) |
| `expect(buildSettled \|\| true).toBe(true)` — tautology, can never fail | P3 (F-N05) |
| `lockObs.every(o => o.mode !== "AccessExclusiveLock")` vacuous on empty array | P3 (F-N06) |
| `buildCompletedAt` captured at await, not at settle → interval assertions non-probative | P1 (part of F-N01) |
| `pg_stat_progress_create_index` poll not constrained to the target relation | P3 |
| 30 s observation deadline with `expect(observations.length).toBeGreaterThan(0)` → hard failure if the first poll misses a 63 ms build | P2 (flake) |
| Test coverage breadth is otherwise good — 15 test files across boundaries, atomicity, reopen counts, races, drift, allowlist, timeouts | Positive |

I did not execute the suite, so I cannot comment on runtime flakiness beyond what static analysis plus the isolation experiment establishes. Green CI on a single run does not rebut a timing race of this shape.

---

## 17. Security, tenancy, privacy, and inventory-write assessment

| Check | Result |
|---|---|
| Inventory-write flags changed? | ✅ **No.** Only occurrences in the diff are `delete process.env.FEATURE_*` inside test setup. No production default altered. |
| `FEATURE_*_WRITES`, `FEATURE_COST_SYNC` default | ✅ OFF |
| `ALLOW_DEV_SUBSCRIPTION_ACTIVATE` | ✅ `false` |
| Production deployment authorized? | ✅ No — remains unauthorized |
| Cross-tenant exposure introduced | ✅ None (no runtime tenant enforcement in scope; PR is additive) |
| RLS prematurely activated | ✅ No |
| Secrets / `.env` / merchant data in diff | ✅ None found |
| Credentials in argv | ✅ None (drift passes URL via child env) |
| Credentials in logs | ⚠️ Minor — `stderr` interpolation could surface host/port (P3) |
| SQL injection | ✅ Allowlisted identifiers, parameterized values |
| PII handling | ✅ `redactShopEvidence` applied to domain evidence |
| Integer overflow | No concern found (counts are JS numbers over row counts) |

**No P0 finding.** Nothing in this PR creates cross-tenant exposure, destructive inventory behavior, or secret exposure.

---

## 18. Documentation and evidence assessment

| Requirement | Status |
|---|---|
| Original `NOT READY` report preserved faithfully | ✅ Content present (582 lines, verdict text intact) — but see note below |
| Correction backlog does not claim independent closure | ✅ Reads as implementer claims awaiting review |
| Immutable reviewed heads vs mutable PR tip distinguished | ✅ Both `7aabb09` and `fb04345` recorded distinctly |
| Corrected head + CI accurately represented | ✅ Every CI identity claim independently confirmed |
| D-024 describes the accepted decision | ✅ Consistent with the no-op migration and external tool |
| F-016 / R-022 open | ✅ Open |
| Q-011 open | ✅ Open (verified in `OPEN_QUESTIONS.md`) |
| R-028, R-029, R-041–R-046 open | ✅ Recorded as open |
| Production deployment unauthorized | ✅ Stated |
| Inventory writes unapproved, flags OFF | ✅ Stated and verified in code |

**Chain-of-custody note (P3, F-N08).** `PR1_TENANT_EXPANSION_REVIEW_REPORT.md` was first added to the repository in commit `3a6ae28` — *"Correct Phase 1 PR 1 after Claude NOT READY review"* — i.e. the historical independent review artifact was committed by the party implementing the corrections, in the same commit as the corrections. The content appears faithful and I have no evidence of alteration, but I also have no pre-correction commit to diff it against, so I cannot independently attest that it is unmodified. For future phases, the review artifact should land in its own commit before corrections begin.

**Documentation defect (P2, F-N03).** The `assertMembershipUnchanged` error message asserts a safety property the implementation does not have. This is not a doc-hygiene nit — it is an operational-safety claim an engineer would rely on during a production cutover.

---

## 19. Findings table

| ID | Sev | File / line | Evidence | Merchant impact | Required correction | Missing test |
|---|---|---|---|---|---|---|
| **F-N01** | **P1** | `scripts/tenant-indexes/tests/indexes.migration.test.ts:331–341, 466–482` | Holders run `READ COMMITTED`; measured `backend_xmin` NULL; CIC = **63 ms** with holders open vs **8978 ms** at `REPEATABLE READ`. `buildCompletedAt` assigned only after `await buildPromise`, post-writes. | The non-blocking-index-rollout claim is unproven. If CIC does take an `AccessExclusiveLock` or blocks writes on real merchant volumes, a production index rollout stalls the storefront path — the exact risk this test exists to exclude. Recorded `buildDurationMs` evidence is misleading. | Open holders with `BEGIN ISOLATION LEVEL REPEATABLE READ` (or hold a real conflicting lock) so the build is deterministically held; capture `buildCompletedAt` **inside** the `.then`/`.catch` settle callbacks; assert each write window ends strictly before the recorded settle time; assert on realistic row volume. | Deterministic overlap test that fails if the build settles before any write starts |
| **F-N02** | **P1** | `scripts/tenant-backfill/engine.ts:511, 520` | `SELECT DISTINCT shop FROM "<table>"` with no `id <= highWaterMark`; `boundaryPredicate()` exists in `boundaries.ts` and is unused here | Rows created mid-run change discovered domains, proposed Shops, `shopsWouldCreate`, discovery issues and blocking status while membership checksum is unchanged → run conclusions are not reproducible from recorded evidence; resume can diagnose differently than the original run | Apply `boundaryPredicate` to all direct-owner discovery queries; either snapshot/bound `Session` discovery or record an explicit, product-owner-approved documented exception | Insert above the direct-owner high-water mark before discovery, after discovery, and across resume — assert identical Shops, `shopsWouldCreate`, issues, blocking status, checksums |
| **F-N03** | **P1** | `scripts/tenant-backfill/checksum.ts:membershipChecksum`; `boundaries.ts:assertMembershipUnchanged` | Checksum over ordered IDs only; demonstrated byte-identical hash across same-ID replacement. Error text claims identity replacement "fails closed" | Delete + recreate at the same ID inside the boundary is undetected; the row is classified against evidence gathered for a different row. Operators are told the opposite by the tool's own message | Include immutable/ownership-relevant starting evidence (e.g. `createdAt`, legacy `shop`, parent FK) in membership evidence — `checksumRows()` already does this; correct the error message to match actual behavior | Same-ID delete/reinsert with identical ID set and count must fail closed |
| **F-N04** | **P2** | `scripts/tenant-backfill/engine.ts:464–468, 508+` | `beforeCounts`, `loadDatasetBoundaries`, and domain discovery are three unsynchronized read phases outside any transaction | Starting evidence can be mutually inconsistent under concurrent activity; `beforeCounts` may not correspond to the boundary set it is compared against | Capture all starting evidence in one `REPEATABLE READ` transaction | Concurrent writes interleaved between capture phases must fail closed or produce coherent evidence |
| **F-N05** | **P3** | `indexes.migration.test.ts` (write-window loop) | `expect(buildSettled \|\| true).toBe(true)` | None directly; falsely signals overlap coverage in review | Remove | — |
| **F-N06** | **P3** | `indexes.migration.test.ts` (post-observation assertions) | `lockObs.every(...)` vacuously true on empty array; loop can exit on progress-only observation | `AccessExclusiveLock` absence may be unproven while appearing asserted | Require ≥1 granted lock observation for the builder PID on the target relation before asserting mode; assert `ShareUpdateExclusiveLock` positively | Assertion that fails when no lock row was observed |
| **F-N07** | **P2** | `scripts/tenant-backfill/boundaries.ts:loadTableBoundary`, `recomputeMembershipChecksum` | `SELECT id FROM "<table>" ORDER BY id ASC` materializes all IDs into JS memory, ×18 tables, repeated on resume | On production-scale `InventorySnapshot` / `SalesDailyAggregate`, boundary capture may exhaust memory or stall the cutover window | Compute the digest server-side or stream; avoid full ID materialization | Boundary capture against a large-table fixture with a memory ceiling |
| **F-N08** | **P3** | `docs/phases/phase-1/PR1_TENANT_EXPANSION_REVIEW_REPORT.md` (added in `3a6ae28`) | Historical review artifact first committed in the correction commit | Chain of custody for independent review evidence is not independently attestable | Land review artifacts in their own commit before corrections | — |
| **F-N09** | **P3** | `scripts/tenant-indexes/drift-lib.ts` (error paths) | `result.stderr` interpolated into thrown error; Prisma `P1001` embeds host/port | Host/port may reach logs (no password) | Redact stderr before surfacing | Assert no host/URL fragment in drift error output |

**Unverified (not findings, but not closed):** F-PR1-01, -02, -03, -04, -10 (partial), -11, -14; R11 in full; R13 runtime behavior. These require executing the Prisma-dependent suite.

---

## 20. Positive findings

1. **The index-rollout corrections are real and verified.** F-PR1-05 through F-PR1-09 were the most dangerous original findings, and every one reproduces correctly against PostgreSQL 16.14: no compatibility index is built by Prisma Migrate, all 28 are built concurrently by the external tool, and the tool ends up at `valid_exact: 28` with `pg_index` confirming 28/28 valid.
2. **The index tool is genuinely fail-closed and refuses to self-repair.** Forcing `indisvalid = false` produces exit 1 / `status: "invalid"`. Creating a same-named index on the *wrong column* is caught as `wrong_definition` — the tool checks definition, not name. Apply then refuses to proceed with an explicit message requiring an authorized `DROP INDEX CONCURRENTLY`. This is exactly the behavior the phase brief asked for.
3. **R12 is correctly implemented.** Mutating apply rejects a missing maintenance URL and a pooler-pattern URL *before opening a connection*, and CI supplies the explicit URL. Verified by execution.
4. **R13's command shape is right for the stated confidentiality concern** — credentials via child env, never argv — and it genuinely compares live database against datamodel rather than datamodel against itself.
5. **Scope discipline is exemplary.** Exactly 18 nullable columns, zero `Shop` FKs, zero RLS, zero policies, no inventory-write changes, no PR 2 / PR 3 / Phase 2 leakage. Under a +8,546-line diff this is genuinely disciplined.
6. **Migrations are clean and additive**, and the no-op marker migration documents the rejected approach and the reason — good archaeology for future maintainers.
7. **Security fundamentals are sound**: allowlisted SQL identifiers, parameterized values, `redactShopEvidence` on merchant-derived evidence, no secrets in the diff.
8. **Every CI identity claim was accurate.** Run, job, head SHA, conclusion, and branch tip all matched exactly. That kind of precision in reporting is worth acknowledging.

---

## 21. Required correction sequence

1. **F-N02** — bound direct-owner domain discovery by the recorded run subject; resolve `Session` discovery by snapshot or documented exception.
2. **F-N03** — strengthen membership evidence beyond IDs; correct the misleading `assertMembershipUnchanged` message.
3. **F-N01** — rebuild the R9 overlap proof: `REPEATABLE READ` holders (or a real conflicting lock), settle-time capture inside the promise callbacks, realistic volume; regenerate the evidence artifact, which is currently misleading.
4. **F-N05, F-N06** — remove the tautology; make the lock assertion non-vacuous and positively assert `ShareUpdateExclusiveLock`.
5. **F-N04** — capture all starting evidence under one `REPEATABLE READ` transaction.
6. **F-N07** — remove unbounded ID materialization from boundary capture.
7. **F-N09** — redact stderr in drift error output.
8. **Re-run the full mandated command list on an unrestricted runner**, including every Prisma-dependent command I could not execute, and preserve exact output.
9. **Re-run the R9 test ≥10 times** and record pass/fail and true build duration per run.
10. Resubmit for independent review at the new exact head.

**F-N08** is process guidance for the next phase, not a merge blocker.

---

## 22. Final verdict

# NOT READY

Two P1 findings remain (F-N01, F-N02) plus a third that is P1 in effect because the tool actively asserts a safety property it does not have (F-N03). The gate conditions "run evidence is deterministic and durable" and "concurrent index rollout is genuinely non-blocking and fail-closed" are not met: the run subject can be changed by concurrent activity without detection, and the non-blocking proof rests on a mechanism I measured to be inert.

Independently of the findings, this review **cannot** satisfy the required-commands gate. `prisma generate`, `prisma validate`, `prisma migrate deploy`, `tenant:schema:drift`, `test:migrations`, `test`, `typecheck`, `build`, and `graphql-codegen` were all blocked by sandbox egress restrictions on `binaries.prisma.sh` and `shopify.dev`. Several original findings (F-PR1-01, -02, -03, -04, -11, -14) and the whole of R11 therefore remain **unverified**, not passed. Even if the P1 findings were resolved, `READY FOR CHATGPT PR 1 ACCEPTANCE` would require a review run on an unrestricted runner.

The index-rollout work is genuinely good and I would not want the verdict to obscure that. The problem is narrower and fixable: the evidence layer that the whole backfill rests on is not yet deterministic, and the proof that the index rollout is safe does not currently prove it.

**Merge: not approved. PR 2 and PR 3: not authorized — remain NOT STARTED. Production inventory writes: UNAPPROVED. All inventory-write flags: DEFAULT OFF (verified unchanged).**

---

*No repository file was modified, no commit created, no branch pushed, no PR approved or merged. No production or merchant data was accessed.*
