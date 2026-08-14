# Phase 1 PR 4 — D-047 Correction Independent Review Report

**Reviewer:** Claude Code (independent principal engineer / architecture + release-risk review)
**Decision under review:** D-047 — Phase 1 PR 4 focused operational claim / migrations guard corrections
**Scope:** P2-NEW-D047-01, P3-NEW-D047-01, plus D-047 migration/documentation/risk/identity/CI evidence
**Verdict:** **CORRECTIONS REQUIRED**

This report is immutable. Do not edit it.

---

## 1. Review identity

| Field | Value | Verified how |
|---|---|---|
| Exact reviewed head | `cc1ff7e7a088f130372e7ead3bc2e679aee952fd` | `git rev-parse FETCH_HEAD` on `origin/phase-1/sync-control-plane`; GitHub PR API `head.sha` |
| Confirmed merge base | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` | `git merge-base FETCH_HEAD origin/main` |
| `origin/main` tip | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` | `git rev-parse origin/main` (unchanged) |
| PR #20 state | **OPEN**, **DRAFT (`draft: true`)**, **UNMERGED (`merged: false`)** | GitHub PR API |
| Review branch | `claude/d047-pr20-review-ppn666`, created from the exact head | `git checkout -B … cc1ff7e7…` |

### Identity gate

All eight gate conditions pass:

1. PR #20 is OPEN, DRAFT, UNMERGED — confirmed.
2. Head is exactly `cc1ff7e7a088f130372e7ead3bc2e679aee952fd` — confirmed.
3. Merge base is exactly `e69bc53d91db75472b0d0998bf1b74ee6246adb1` — confirmed.
4. Exact-head PR CI run `31131707375` succeeded against that SHA — confirmed (below).
5. No later commit changed the review identity — `origin/phase-1/sync-control-plane` resolves to the reviewed SHA.
6. Inventory-write flags remain OFF — `.github/workflows/ci.yml` sets `FEATURE_STOCKTAKE_INVENTORY_WRITES`, `FEATURE_ADJUSTMENT_WRITES`, `FEATURE_RECEIPT_WRITES`, `FEATURE_COST_SYNC`, `FEATURE_TRANSFER_WRITES`, `ALLOW_DEV_SUBSCRIPTION_ACTIVATE` all `"false"`.
7. Q-003 OPEN (`docs/OPEN_QUESTIONS.md:7`); F-PR4-18 OPEN (`PR4_SYNC_CONTROL_PLANE_CORRECTION_BACKLOG.md:228`, disposition `PENDING INDEPENDENT VERIFICATION`).
8. PR 5 and production activity remain unauthorized — no production access was used or attempted in this review.

### Exact-head CI evidence (independently inspected, not taken from the report)

**Pull-request run** — `GET /actions/runs/31131707375`:

| Field | Observed |
|---|---|
| Workflow | CI (`.github/workflows/ci.yml`) |
| Run number | 206, attempt 1, event `pull_request` |
| Head SHA | `cc1ff7e7a088f130372e7ead3bc2e679aee952fd` |
| Status / conclusion | `completed` / **`success`** |

**Job `92721868719`** — `GET /actions/jobs/92721868719`: conclusion `success`; **135 numbered steps, every one `conclusion: success`, none skipped or failed**. Step 91 `Sync dispatch performance/fairness (F-PR4-11/13)` succeeded; step 130 `Migration and tenant-backfill tests` succeeded; steps 131–132 are the two `NEW-PR4-C07` `-t` migration gates.

**Push run** — `GET /actions/runs/31131499707`: run number 205, event `push`, head SHA `cc1ff7e7…`, conclusion **`success`**. Cursor's report of this run is independently corroborated.

### Immutability and document identity

- Incorporated D-046 follow-up report blob SHA: `git rev-parse cc1ff7e:stocky-plus/docs/phases/phase-1/PR4_SYNC_CONTROL_PLANE_D046_FOLLOWUP_CORRECTION_REVIEW_REPORT.md` → **`29a5f4e3a05b57a817b952d233cd8895db7a4c37`** — matches the required value exactly.
- `git diff --name-only 06b58ba..cc1ff7e -- 'docs/phases/phase-1/*REVIEW_REPORT.md'` returns **no files**: every prior immutable review report is byte-unchanged across the entire D-047 work range.
- D-047 changed exactly 21 files (`git diff --name-only 06b58ba..cc1ff7e`); no immutable report, no historical migration, and no `.github/workflows/ci.yml` change among them.

---

## 2. Environment reconstructed

Fresh PostgreSQL **16.13** (`initdb`, port 5433, default `work_mem`, no planner forcing) and Redis 7-compatible `redis-server` on port 6380, with the CI environment matrix reproduced verbatim (Node v22.22.2, npm pinned to 11.5.2, `npm ci`, inventory-write flags OFF). Three databases were used: `stocky_plus_ci` (full CI parity), `d047_eq` (planner experiments), `d047_clean` (pristine regression re-verification). No production or merchant data was touched.

---

## 3. Commands executed and results

| # | Command | Exit | Result |
|---|---|:---:|---|
| 1 | `npx prisma generate` | 0 | ok |
| 2 | `npx prisma validate` | 0 | schema valid |
| 3 | `npx prisma migrate deploy` (fresh DB, full chain) | 0 | all migrations applied, incl. `20260806220000_…d047_fair_claim_indexes` |
| 4 | `npx prisma migrate deploy` (second fresh DB) | 0 | reproducible |
| 5 | `npm run tenant:indexes:apply -- --apply` / `:verify` | 0 | 44 indexes created / verified |
| 6 | `npm run tenant:roles:provision -- --apply` | 0 | ok |
| 7 | `npm run sync:roles:provision -- --apply` / `sync:roles:verify` | 0 | `{"ok": true, "errors": []}` |
| 8 | `npm run test:sync-performance` × **5 consecutive** | 0,0,0,0,0 | **11 passed** each run (2 files), no flake |
| 9 | `npm run test:sync-integration` | 0 | **185 passed** (15 files) |
| 10 | `npm run test:sync-dispatch-recovery` | 0 | **29 passed** |
| 11 | `npm run test:migrations` (full) | 0 | **219 passed, 1 skipped, 1 todo (221)** |
| 12 | Six exact-CI D-045 `-t` gates on pristine DB | 0 ×6 | all pass — see §9 |
| 13 | P3 name-filter matrix (13 cases) | — | see §8 |
| 14 | `npm run lint` | 0 | clean |
| 15 | `npm run typecheck` | 0 | clean |
| 16 | `npm run build` | 0 | built |
| 17 | `npm run graphql-codegen` | 0 | clean |
| 18 | `npm run sync:inventory:check` | 0 | `ok surfaces=37 digest=87905b396b3a…` |
| 19 | `npm run tenant:access:inventory:check` | 0 | `tenant_access_inventory_fresh` |
| 20 | `git diff --check` | 0 | no whitespace errors |
| 21 | `EXPLAIN (ANALYZE, BUFFERS)` reproduction, PG 16, default `work_mem` | — | see §5–§6 |

Cursor's headline test counts (11 / 185 / 219) are independently reproduced exactly.

`npm run tenant:schema:drift` reports expected enforcement divergence and instructs setting `STOCKY_ENFORCEMENT_SCHEMA_DIVERGENCE_EXPECTED=1` after `tenant:enforcement:verify`; this is pre-existing documented behaviour, not a D-047 defect. Exact-head CI step 13 passed this gate.

---

## 4. Shared runtime / EXPLAIN SQL identity — **PASS (with a test-strength caveat)**

Verified by reading source, not by trusting the identity test:

- `app/sync/dispatcher.server.ts:164-166` — `claimBatchFair` calls `tx.$queryRaw(buildFairClaimLockedSelectSql({ now, batchSize, maxPerShop }))` and nothing else. There is no second claim statement.
- `app/sync/fair-claim-query.server.ts:181` — `buildFairClaimLockedExplainSql` interpolates `buildFairClaimLockedSelectSql(params)` directly into the `EXPLAIN` wrapper, so the EXPLAIN subject is byte-identical to the runtime text by construction.
- I dumped both rendered statements: the EXPLAIN text is exactly the `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` prefix followed by the identical SELECT body, with **11 identical bound values** in the same order.
- All values (`now` ×5, `shopCap`, `maxPerShop` ×3, `batchSize`) are Prisma-bound placeholders. **No string interpolation of values**; no SQL injection surface.
- No duplicate synthetic SQL and no test-only branch remains in the sync module.

Caveat recorded as **P3-D047-R06**: the shipped identity test proves only function-reference equality and bound-value equality — both self-referential. Nothing asserts that `claimBatchFair` actually uses the builder. The property holds today because I read the code, but a future inline edit to `claimBatchFair` would leave the performance gate green while evaluating different SQL. That is the precise failure mode P2-NEW-D047-01 was raised to prevent.

---

## 5. Operational SQL correctness — **PASS**

Direct execution of the production builder against seeded fixtures (4 shops: normal, RETRY_WAIT-only, empty, `processingEnabled=false`; PENDING/RETRY_WAIT/future/terminal rows):

| Property | Result |
|---|---|
| Includes both PENDING and RETRY_WAIT | **Yes** — claimed set spans both states |
| Excludes future `nextEligibleAt` | **Yes** — zero future rows leaked |
| Excludes non-eligible states (RUNNING/SUCCEEDED/DISPATCH_LEASED) | **Yes** — zero leaked |
| `maxPerShop` applied | **Yes** — per-shop counts ≤ cap at 1, 2, 3 |
| `batchSize` applied | **Yes** — returned ≤ batch at 1, 2, 4 |
| Never claims a job for the wrong shop | **Yes** — every returned `shopId` matched the row's owner |
| One state empty (RETRY_WAIT deleted) | **Yes** — correct PENDING-only result |
| No eligible rows | **Yes** — returns 0 |
| Empty shops | **Yes** — excluded from the seed |
| Locking | `FOR UPDATE OF d SKIP LOCKED` on `DurableJob`; `LockRows` present in every plan |
| No duplicate claims | Confirmed under 2 and 4 concurrent dispatchers |
| Lease / state transition | `assertTransition(... "DISPATCH_LEASED")` plus a state-guarded `UPDATE … WHERE id = $ AND state = $` — a lost race skips the row rather than performing an illegal transition |
| Rollback | Aborted transaction released all locks; the identical 5 rows were immediately re-claimable |

Disabled shops (`processingEnabled = false`) **are** seeded and claimed by the SQL, then routed to `shop_disabled` by the post-claim re-check at `dispatcher.server.ts:1318`. This matches approved behaviour and is not a regression, but it now consumes bounded seed slots — see **P3-D047-R12**.

---

## 6. Planner-predicate (`>=` / `<=`) verdict — **SEMANTICALLY SOUND AND EMPIRICALLY NECESSARY; residual brittleness recorded as P3**

`"shopId" >= s.id AND "shopId" <= s.id` is **semantically identical to equality** here: `DurableJob.shopId` is `String` `NOT NULL` and `Shop.id` is `String` (cuid), both `text` under the database's default deterministic collation, so btree comparison is a total order and the range pair collapses to exactly the equality set. No nullability, collation, or constraint hazard.

I did not accept the report's justification on the strength of a fast plan. I rewrote the shipped statement's predicate back to bare equality and re-ran both variants on the same data (PG 16, 50,000 jobs, 1,000 empty shops, `ANALYZE`, default `work_mem`):

| Variant | Top-node buffers | Execution time | Indexes chosen | Plan gate |
|---|---:|---:|---|---|
| **Range pair (shipped)** | **5,161** | **6.4 ms** | `DurableJob_shop_claim_pending_idx`, `DurableJob_shop_claim_retry_wait_idx`, `DurableJob_pkey` | PASS |
| Bare equality (rewritten) | **9,555,158** | **10,820 ms** | `DurableJob_eligible_pending_idx` **+ shopId Filter**, … | FAIL (`prohibited eligible_*_idx with shopId Filter`) |

That is a ~1,850× buffer and ~1,690× latency regression, with `Rows Removed by Filter: 39801`. **The implementation report's explanation is accurate**, and the plan gate does reject the equality regression — a real safety net.

Residual concern (**P3-D047-R09**): it remains a deliberate planner workaround rather than an index-design fix. Its correctness depends on PostgreSQL continuing not to normalise a `>= x AND <= x` pair into `= x` — undocumented behaviour that no PostgreSQL guarantee covers. The root cause is that `DurableJob_eligible_pending_idx` competes for the same predicate; retiring or reshaping that index (or driving the lateral from an explicit `VALUES` list) would be structurally safer. The mitigation is real but is a CI gate, not a database guarantee.

---

## 7. Boundedness, scalability, plan shape, fairness, concurrency, ordering

### 7.1 DurableJob boundedness — **PASS (SQL-enforced)**

The `shop_seed … LIMIT ${shopCap}` and per-shop `LATERAL … LIMIT ${maxPerShop}` are SQL literals bound by Prisma, so candidate rows ≤ `shopCap × maxPerShop` is enforced by SQL, not by application expectation. Measured across 5 shops × 50,000 jobs (mixed PENDING/RETRY_WAIT/future, dominant-shop backlog) and multiple `batchSize`/`maxPerShop` combinations (50/2, 10/1, 20/5): **no Seq Scan on `DurableJob`**, all DurableJob access via `shop_claim_*` Index Only Scans, `LockRows` present, sorts `quicksort Memory: 25–31kB` with actual rows ≤ 25, `Execution Time` 0.38 ms at 50k rows. Plans were stable across repeated runs after `ANALYZE` with default `work_mem` and no `enable_seqscan`, cost manipulation, sleeps, retries, or skips.

### 7.2 Shop-discovery scalability — **FAIL (P2-D047-R01)**

The bound applies to `DurableJob` only. `shop_seed` **Seq Scans the entire `Shop` table** and evaluates **four correlated subplans per Shop row** (SubPlan 1–4; SubPlans 1/3 and 2/4 are duplicate probes of the same query, evaluated once for the `WHERE … IS NOT NULL` test and again for `ORDER BY LEAST(...)`). Work is therefore proportional to **every Shop row**, independent of backlog:

| Total shops | Top-node `shared hit` | Execution time | `Seq Scan on "Shop"` | Plan gate |
|---:|---:|---:|:---:|:---:|
| 1,005 | 5,135 | 3.4 ms | YES | **PASS** |
| 5,005 | 25,190 | 16.0 ms | YES | **PASS** |
| 20,005 | 100,421 | **256.8 ms** | YES | **PASS** |

Growth is strictly linear at ≈5 buffers per Shop row. At 1,005 shops, 5,066 of 5,135 buffers (**98.7 %**) are consumed by shop discovery while the entire bounded candidate phase costs ~31–90 buffers; `Rows Removed by Filter: 1000`. Extrapolated to a merchant base of 50,000 shops this is ~250,000 buffer hits per dispatch cycle on a continuously running dispatcher.

This is the same class of defect P2-NEW-D047-01 was raised to fix: unbounded per-dispatch work proportional to a table's full row count. It was moved from `DurableJob` to `Shop`, not removed. It is not disclosed anywhere in the D-047 implementation report, whose "After" table reports **"~227 (with empty shops)"** buffers — an understatement of 22× at 1,005 shops and 440× at 20,005 shops.

### 7.3 Plan-shape assertions and parser — **PARTIAL (P3-D047-R05)**

Reproduced independently on PG 16. The operational query does not Seq Scan `DurableJob`, does not `WindowAgg`, does not sort externally, does not sort more rows than the SQL-enforced bound, selects the intended shop-claim indexes, and includes `LockRows` — all confirmed, stable across repeats, with no environment exemptions.

Challenging `assertEligibleClaimPlanShape` (`app/sync/__tests__/eligible-claim-plan.ts`):

- **Shop scanning is invisible to the gate.** No assertion rejects `Seq Scan on "Shop"`. Every plan in §7.2 — including the 100,421-buffer, 256 ms plan at 20,005 shops — **passes the gate unchanged**. A plan with arbitrarily expensive Shop scanning still passes.
- **Buffer bounds are mentioned, not asserted.** `EXPLAIN … BUFFERS` is requested and `sync-performance.test.ts` asserts only `/Buffers:\s*shared hit=\d+/` — presence of a number, never a bound. No buffer/row ceiling is enforced.
- **Sort bound reads output rows, not input rows.** `actualRowsOnLine` parses the Sort node's `actual … rows=N`, which for a top-N heapsort under a `LIMIT` reports the *limited output*, not the sorted input. A Sort consuming a large input beneath a Limit would report a small count and pass.
- **Bitmap Heap Scan is not rejected.** Only `Seq Scan on "DurableJob"` is prohibited; a Bitmap Heap Scan on `DurableJob` passes provided a `shop_claim_*` scan appears elsewhere in the plan.
- Nested/indented plan output is handled correctly (the regexes are unanchored and the sort check is per-line), and the eight fixture tests in `eligible-claim-plan.test.ts` cover the legacy `ROW_NUMBER` plan, WindowAgg, external sort, oversized sort, missing shop-claim index, and the `eligible_*` + `shopId Filter` trap. Within its declared scope the parser is sound; its blind spot is everything outside `DurableJob`.

### 7.4 Repeated-cycle fairness — **FAIL (P2-D047-R02)**

Fairness was tested across many dispatch cycles, not one call. `shopCap = batchSize`, and the seed is ordered by absolute earliest `nextEligibleAt`. A shop whose backlog is continuously replenished with work older than its neighbours' therefore holds its seed slot permanently.

Decisive experiment — 3 "greedy" shops (exactly `shopCap`, `batchSize=3`, `maxPerShop=2`) receiving fresh 24-hour-old work every cycle, plus 5 "normal" shops holding 1-hour-old eligible work, 40 consecutive cycles driving the production claim SQL:

```
greedy claims : 40, 40, 40
normal claims :  0,  0,  0,  0,  0
STARVED normal shops (zero progress in 40 cycles): 5/5
eligible normal-shop jobs still unclaimed: 50
```

The greedy shops consumed **100 % of dispatch capacity for every cycle**; no normal shop ever progressed, and the condition is self-sustaining — it does not resolve while greedy shops keep receiving older work. Supporting runs through `dispatchPendingJobs`:

| Shops | batchSize | maxPerShop | Cycles | Shops that never progressed |
|---:|---:|---:|---:|---|
| 12 | 4 | 2 | 20 | **7 / 12** (first-progress cycles 0, 0, 6, 12, 18) |
| 20 | 4 | 1 | 25 | **10 / 20** |
| 10 | 4 | 5 | 15 | **5 / 10** |

F-PR4-13 requires an "equivalent starvation-resistant algorithm" with the acceptance test "**each active shop makes progress**". That criterion is not met whenever active shops exceed `shopCap = batchSize`. The shipped `sync-performance` test asserts `claimedByShop.length === shops.length` with **5 shops and `batchSize` 20** — 5 ≤ 20, so the failing regime is never exercised. The suite cannot detect this defect.

The algorithm delivers **oldest-first bounded progress**, not round-robin and not starvation-resistance. Neither `PR4_SYNC_CONTROL_PLANE_D047_CORRECTION_IMPLEMENTATION_REPORT.md` (which states the design "Preserves … maxPerShop fairness") nor the `fair-claim` naming states this limitation truthfully.

### 7.5 Concurrency and refill — **PARTIAL FAIL (P2-D047-R04)**

Correctness under concurrency is sound: with 2 and 4 simultaneous dispatchers there were **no duplicate claims, no duplicate `JobDispatch` rows, and no illegal state transitions**; `SKIP LOCKED` behaved correctly under real overlap; and transaction rollback released locks leaving the same jobs immediately claimable.

Throughput is not. Four concurrent dispatchers against 6 shops holding 120 eligible jobs (`batchSize` 10, `maxPerShop` 3) produced:

```
claims=[0, 0, 8, 10]  total=18  dispatchRows=18  uniqueJobs=18
```

Two of four dispatchers claimed **nothing** while >100 eligible jobs remained. Because every dispatcher computes the same bounded candidate set of `shopCap × maxPerShop` rows, once the first dispatchers lock that set the others find it entirely locked and return empty rather than refilling from the remaining backlog. Horizontal dispatcher scale-out is defeated by the bounded candidate set. This is the "avoidable zero/underfilled batches while substantial eligible work remains" condition, confirmed.

### 7.6 Ordering guarantee — **NOT GUARANTEED (P3-D047-R07)**

The outer `SELECT … FROM locked` has **no `ORDER BY`**; ordering exists only inside the `locked` CTE. Empirically the returned order was correctly sorted in 5/5 runs, because a CTE containing a locking clause cannot be inlined and is scanned in stored order — an incidental PostgreSQL execution property, not a SQL guarantee.

The shipped test named "deterministic ordering" does not test this. It collects the claimed ids, **re-queries the database with its own `orderBy: [nextEligibleAt, createdAt, id]`**, and then asserts the re-sorted result is sorted — a tautology that would pass for any returned order. Determinism of the claim SQL's row order is therefore unverified by the suite and unguaranteed by the SQL.

---

## 8. P3-NEW-D047-01 migration name-filter guard — **PASS (two minor gaps)**

`failOnZeroPassedNameFilter()` is wired into `vitest.migrations.config.ts` (and `vitest.sync-integration.config.ts`), activating only when `testNamePattern` is set. All 13 required checks were executed:

| # | Case | Expected | Observed |
|---|---|:---:|---|
| 1 | Nonexistent `-t` filter | exit 1 | **exit 1**, `[ci-guard]` emitted |
| 2 | Valid interruption/resume filter | exit 0 | **exit 0**, 9 passed |
| 3 | Valid `NEW-PR4-C07 role-present` | exit 0 | **exit 0**, 1 passed |
| 4 | Valid `NEW-PR4-C07 role-absent` | exit 0 | **exit 0**, 1 passed |
| 5a | Drifted interruption/resume filter | exit 1 | **exit 1**, 11 skipped, guard fired |
| 5b | Drifted role-present filter | exit 1 | **exit 1**, 7 skipped, guard fired |
| 5c | Drifted role-absent filter | exit 1 | **exit 1**, 7 skipped, guard fired |
| 6 | Skip-only filter | exit 1 | **exit 1**, 2 skipped, guard fired |
| 7 | Todo-only filter | exit 1 | **exit 1**, 1 skipped + 1 todo, guard fired |
| 8 | Unfiltered migration suite | exit 0 | **exit 0**, 219 passed |
| 9 | File selected without `-t` | exit 0 | **exit 0**, 7 passed (guard inert) |
| 10 | Normal failure reporting | unaffected | genuine failures still reported and still exit 1 |
| 11 | Nested suites counted | correct | `countPassed` recurses `suite.tasks`; case 2 counted 9 passes across nested describes |
| 12 | Probes don't pollute release evidence | — | **gap — see P3-D047-R10** |
| 13 | Reporter API-change regression test | — | **gap — see P3-D047-R11** |

The guard also fired correctly and unprompted during my own work when I used three paraphrased `-t` strings that matched nothing — real-world evidence that it fails closed.

---

## 9. Regression confirmation — original D-046 / D-045 findings intact

`NEW-CLAUDE-D045-01` … `NEW-CLAUDE-D045-04` were **not reopened**. Their exact CI `-t` gates were re-executed at the reviewed head on a pristine database:

| Gate | Exit | Result |
|---|:---:|---|
| `NEW-CLAUDE-D045-02: v3 worker verified-after-rollback` | 0 | 1 passed |
| `NEW-CLAUDE-D045-02: v2 worker verified-after-rollback` | 0 | 1 passed |
| `NEW-CLAUDE-D045-02: worker digest-conflict dead-letter` | 0 | 2 passed |
| `NEW-CLAUDE-D045-02: worker uncertain-outcome dead-letter` | 0 | 2 passed |
| `NEW-CLAUDE-D045-02: RepeatableRead transaction option` | 0 | 1 passed |
| `production queue-presence exports no classification seam` (D045-01) | 0 | 1 passed |

Plus `test:sync-integration` 185 passed and `test:sync-dispatch-recovery` 29 passed. **No regression evidence exists, and none of these findings is reopened.**

*Note for the record:* an initial run of these gates on a database I had already contaminated with review probes (Shop rows deleted) produced `TenantAuthorityError: Canonical Shop not found`. Re-running on a pristine database produced the clean results above. The failures were an artefact of my own probe fixtures, not of the reviewed code.

---

## 10. Index and migration verdict — **PARTIAL (P2-D047-R03, P3-D047-R08)**

Migration `20260806220000_sync_control_plane_d047_fair_claim_indexes`:

- **Additive** — creates exactly the two intended partial indexes and nothing else.
- **Does not modify historical migrations** — the D-047 range touches only this new directory under `prisma/migrations/`.
- **Deploys cleanly on a fresh database** and **after the complete existing chain** (verified on three independent databases).
- **Idempotent** — `CREATE INDEX IF NOT EXISTS`; re-running the file emits `NOTICE: … already exists, skipping` and succeeds.
- **Covered by drift/index verification** — `tenant:indexes:verify`, `tenant:indexes:plan`, and exact-head CI steps 12–14 pass; both indexes are present in `pg_indexes` with the intended definitions.

Two problems:

**Redundant indexes retained (P3-D047-R08).** `DurableJob_shop_eligible_pending_idx` `("shopId","nextEligibleAt","createdAt") WHERE state='PENDING'` (added by `20260804210000_sync_control_plane_correction`) is a **strict column prefix with an identical partial predicate** of the new `DurableJob_shop_claim_pending_idx` `("shopId","nextEligibleAt","createdAt",id) WHERE state='PENDING'`. The same holds for the `retry_wait` pair. The older two are now fully subsumed and were not dropped, leaving `DurableJob` — the hottest write table in the control plane — carrying **15 indexes**, two of which serve no query the new pair does not serve better. This is avoidable write amplification and storage cost.

**No rollout / locking assessment (P2-D047-R03).** The migration uses plain `CREATE INDEX`, not `CREATE INDEX CONCURRENTLY`. I measured the lock it takes on a populated table: **`ShareLock` on `DurableJob`**, which blocks all `INSERT`/`UPDATE`/`DELETE` — i.e. all webhook intake and all dispatch writes — for the duration of both index builds. On an empty CI database this is instant and invisible; on a populated production table it is a write outage proportional to table size. The repository already has the tooling and precedent for this (`prisma/migrations/20260803120000_tenant_enforcement_helpers` uses `CONCURRENTLY`, and `tenant:indexes:apply` exists specifically to build indexes concurrently with lock-hold measurement). The D-047 implementation report contains **no locking or rollout assessment for this migration at all**, despite the review scope requiring one. Production execution remains unauthorized, so there is no live exposure today — but the assessment is a prerequisite for authorizing it later.

---

## 11. Documentation, risk, and identity verdict — **PARTIAL**

Correct and verified:

- D-047 backlog and implementation report exist, are internally consistent, and correctly mark both findings `IMPLEMENTATION PENDING INDEPENDENT VERIFICATION`.
- `DECISIONS.md:553-563` records D-047 with the correct final decision text, PR 5 blocked, production and inventory writes unauthorized.
- `PROJECT_STATUS.md` — stage `PR 4 D-047 CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`; not accepted, not ready, not merged.
- `RISK_REGISTER.md:122` — **R-119 preserved OPEN**; `:123` — **R-120 OPEN** pending independent verification.
- Phase-1 README status lines are consistent.
- Tenant and sync inventories are fresh (both `:check` scripts pass).
- Q-003 and F-PR4-18 remain OPEN.
- Migration identity and PR body identity match the reviewed head; the PR body correctly declares OPEN/DRAFT/UNMERGED and flags every gate.
- Immutable reports unchanged; D-046 follow-up blob SHA matches exactly.

Inaccurate or incomplete:

1. **Buffer claim materially understates cost.** The "After" table reports `~227` shared-hit buffers "(with empty shops)". Measured: 5,135 at 1,005 shops, 100,421 at 20,005 shops. (P2-D047-R01)
2. **Boundedness claim is scoped too broadly.** "Candidate set size ≤ `batchSize × maxPerShop`, independent of total backlog" is true and verified, but the report presents it as the algorithm's overall complexity without disclosing the O(total Shop rows) discovery phase. (P2-D047-R01)
3. **Fairness is described untruthfully.** "Preserves … `maxPerShop` fairness" and the `fair-claim` naming imply starvation resistance that §7.4 disproves. (P2-D047-R02)
4. **Stale CI identity row.** The report states exact-head CI was "**Not obtained by agent**" and that "Human must re-run / dispatch CI on tip `99dec79…`", citing superseded run `31126856745`. Runs `31131707375` and `31131499707` both exist and succeeded on `cc1ff7e7…`. This is stale rather than wrong — the report predates the runs — but it now contradicts the PR body and should be corrected. (P3-D047-R13)
5. **No migration locking/rollout assessment.** (P2-D047-R03)

---

## 12. Safety and scope verdict — **PASS**

No prohibited action was taken. PR #20 was not merged, not marked ready, and not modified. Nothing was committed to `phase-1/sync-control-plane`. PR 5 was not begun. No inventory-write flag was enabled. No production migration, queue execution, webhook replay, or merchant data access occurred. No history was amended, rebased, squashed, or force-pushed. No prior immutable report was edited. No finding was fixed — all are recorded only. All review probes were executed against disposable local databases and deleted from the working tree; `git status` is clean apart from this report. Plans were obtained with default `work_mem` and no planner forcing, sleeps, retries, or skips.

---

## 13. Findings

### P0 — none

### P1 — none

### P2-D047-R01 · Shop discovery costs O(total Shop rows) per dispatch; the plan gate cannot see it

- **File:** `app/sync/fair-claim-query.server.ts:60-96` (`shop_seed`); `app/sync/__tests__/eligible-claim-plan.ts:32-92`
- **Evidence:** `Seq Scan on "Shop" s` with `Filter: ((SubPlan 3) IS NOT NULL OR (SubPlan 4) IS NOT NULL)` and four correlated subplans per Shop row. Measured top-node `shared hit`: 5,135 @ 1,005 shops → 25,190 @ 5,005 → 100,421 @ 20,005 (256.8 ms). At 1,005 shops, 5,066/5,135 buffers (98.7 %) are shop discovery; `Rows Removed by Filter: 1000`. Every one of these plans **passes** `assertEligibleClaimPlanShape`.
- **Merchant impact:** Dispatch latency and database load grow linearly with the total merchant count regardless of queue depth. As the app scales, every merchant's webhook dispatch slows because of shops with no work at all.
- **Reproduction:** Seed 5 shops × 50k jobs plus N empty shops; `ANALYZE`; run `buildFairClaimLockedExplainSql({ batchSize: 50, maxPerShop: 2 })` for N ∈ {0, 500, 1000, 5000, 20000}.
- **Expected:** Per-dispatch work bounded by eligible work, not by total Shop rows; the plan gate should reject expensive Shop scanning.
- **Recommended correction:** Drive the seed from `DurableJob` (e.g. a bounded distinct-shop scan over the `shop_claim_*` indexes, or a persisted "shops with eligible work" set maintained on enqueue) instead of scanning `Shop`; deduplicate the four subplans into one lateral probe per shop; add a Shop-side cost assertion to the gate.
- **Missing test:** A plan probe at ≥1,000 shops asserting a bound on total buffers and on Shop rows visited.

### P2-D047-R02 · Shops outside the bounded seed can starve indefinitely; F-PR4-13 acceptance criterion is not met

- **File:** `app/sync/fair-claim-query.server.ts:60-96` (`ORDER BY LEAST(...) … LIMIT ${shopCap}`, `shopCap = batchSize`); `app/sync/__tests__/sync-performance.test.ts:186-190`
- **Evidence:** 3 greedy shops (= `shopCap`) with continuously replenished older work took **40/40 cycles**; 5 normal shops received **zero** claims across 40 cycles with 50 eligible jobs left unclaimed. Through `dispatchPendingJobs`: 7/12, 10/20, and 5/10 shops never progressed over 20/25/15 cycles.
- **Merchant impact:** A merchant's webhooks may never dispatch while noisier neighbours with older backlogs monopolise every seed slot — silent, unbounded sync staleness for the affected shop.
- **Reproduction:** As above; seed greedy shops with 24h-old work replenished each cycle and normal shops with 1h-old work; run ≥40 cycles at `batchSize = shopCap = 3`.
- **Expected:** F-PR4-13 requires a "starvation-resistant algorithm" whose acceptance test is "each active shop makes progress".
- **Recommended correction:** Make seed selection aging-aware or rotating (e.g. persist a per-shop last-served cursor and order by least-recently-served, or reserve a fraction of `shopCap` for shops not served in the previous N cycles); alternatively decouple `shopCap` from `batchSize`. If bounded-progress semantics are accepted instead, state them explicitly in the report, F-PR4-13, and the acceptance criteria.
- **Missing test:** A repeated-cycle fairness test with **active shops > `batchSize`** asserting every continuously eligible shop progresses within a bounded number of cycles. The existing test uses 5 shops against `batchSize` 20 and cannot fail.

### P2-D047-R03 · Fair-claim index migration takes `ShareLock` on `DurableJob` with no rollout or locking assessment

- **File:** `prisma/migrations/20260806220000_sync_control_plane_d047_fair_claim_indexes/migration.sql:5-11`
- **Evidence:** Plain `CREATE INDEX` (not `CONCURRENTLY`). Measured inside a transaction on a populated table: `SELECT mode FROM pg_locks WHERE relation = '"DurableJob"'::regclass` → **`ShareLock`**, which blocks all `INSERT`/`UPDATE`/`DELETE`. The D-047 implementation report contains no locking or rollout assessment. The repo has the `CONCURRENTLY` precedent (`20260803120000_tenant_enforcement_helpers`) and the `tenant:indexes:apply` low-lock framework.
- **Merchant impact:** If executed against a populated production database, webhook intake and dispatch writes stall for the duration of both index builds.
- **Reproduction:** `BEGIN; CREATE INDEX …; SELECT mode FROM pg_locks WHERE relation='"DurableJob"'::regclass; COMMIT;`
- **Expected:** Hot-table index creation is concurrent, or carries a documented lock-hold and rollout assessment.
- **Recommended correction:** Route these indexes through the existing concurrent-apply path, or add an explicit rollout assessment with measured lock-hold before any production execution is authorized.
- **Missing test:** A populated-table lock-hold assertion for the D-047 indexes, matching the pattern already used in `populated-concurrency.test.ts`.

### P2-D047-R04 · Concurrent dispatchers return empty batches while substantial eligible work remains

- **File:** `app/sync/fair-claim-query.server.ts:98-140` (bounded `candidates` set shared by every dispatcher)
- **Evidence:** 4 concurrent dispatchers, 6 shops, 120 eligible jobs, `batchSize` 10 / `maxPerShop` 3 → `claims=[0, 0, 8, 10]`. Two dispatchers claimed nothing. No duplicates and no illegal transitions — correctness is intact; throughput is not.
- **Merchant impact:** Adding dispatcher workers does not add throughput under backlog; idle workers burn database round-trips returning empty while queues drain slowly.
- **Reproduction:** Seed 6 shops × 20 eligible jobs; `Promise.all` of four `dispatchPendingJobs({ batchSize: 10, maxPerShop: 3 })`.
- **Expected:** A dispatcher finding the initial candidate set locked should refill from remaining eligible work rather than return zero.
- **Recommended correction:** Over-provision the candidate set relative to `batchSize` (e.g. seed `shopCap × k`), or retry the seed excluding already-locked shops, so `SKIP LOCKED` has fresh candidates.
- **Missing test:** A concurrency test asserting that with N dispatchers and ≫N×batchSize eligible jobs, every dispatcher claims a non-zero batch.

### P3-D047-R05 · Plan gate asserts neither Shop-side cost nor buffer bounds, and reads sort output rows rather than input rows

- **File:** `app/sync/__tests__/eligible-claim-plan.ts:32-92`; `app/sync/__tests__/sync-performance.test.ts:160-168`
- **Evidence:** No `Seq Scan on "Shop"` prohibition (the 100,421-buffer plan passes); `BUFFERS` asserted only as `/Buffers:\s*shared hit=\d+/` presence; `actualRowsOnLine` reads a Sort node's output rows, so a top-N heapsort under a `LIMIT` reports the limited count; Bitmap Heap Scan on `DurableJob` is not rejected.
- **Recommended correction:** Assert an absolute ceiling on top-node buffers and on Shop rows visited; reject `Seq Scan on "Shop"`; prohibit Bitmap Heap Scan on `DurableJob`.
- **Missing test:** Fixtures for an expensive-Shop-scan plan and a Bitmap Heap Scan plan, both expected to be rejected.

### P3-D047-R06 · Shared-SQL identity test is self-referential and does not bind the runtime path

- **File:** `app/sync/__tests__/sync-performance.test.ts:62-77`
- **Evidence:** Asserts `id.selectBuilder === buildFairClaimLockedSelectSql` (tautology) and `explainSql.values === selectSql.values`. It never compares rendered SQL text and never asserts that `claimBatchFair` uses the builder. The property holds today (verified by reading `dispatcher.server.ts:164-166`) but is untested.
- **Recommended correction:** Assert that the EXPLAIN text ends with the exact select text, and add a runtime assertion (spy or string capture) that the statement `claimBatchFair` executes is the builder's output.
- **Missing test:** A regression test that fails if `claimBatchFair` is edited to inline different SQL.

### P3-D047-R07 · Claimed row order is not guaranteed by the SQL, and the "deterministic ordering" test is vacuous

- **File:** `app/sync/fair-claim-query.server.ts:141-147` (outer `SELECT … FROM locked`, no `ORDER BY`); `app/sync/__tests__/sync-performance.test.ts:245-256`
- **Evidence:** Ordering exists only inside the `locked` CTE. Empirically correct in 5/5 runs — an incidental consequence of a locking CTE being non-inlinable — not a SQL guarantee. The test re-queries with its own `orderBy` and asserts the result is sorted, which is true for any input.
- **Recommended correction:** Add an explicit outer `ORDER BY "nextEligibleAt", "createdAt", id` (free — the CTE is already sorted); assert the SQL's returned order directly.
- **Missing test:** Assert the claim SQL's returned sequence is non-decreasing, without re-sorting it.

### P3-D047-R08 · Redundant partial indexes retained on the hottest control-plane table

- **File:** `prisma/migrations/20260806220000_…/migration.sql`; `prisma/migrations/20260804210000_sync_control_plane_correction/migration.sql`
- **Evidence:** `DurableJob_shop_eligible_{pending,retry_wait}_idx` are strict column prefixes with identical partial predicates of the new `DurableJob_shop_claim_{pending,retry_wait}_idx`. `DurableJob` now carries 15 indexes.
- **Recommended correction:** Drop the two subsumed indexes in a follow-up additive migration once the new plan is accepted.
- **Missing test:** An index-inventory assertion rejecting prefix-redundant partial indexes on `DurableJob`.

### P3-D047-R09 · Fair-claim correctness depends on an undocumented planner behaviour

- **File:** `app/sync/fair-claim-query.server.ts:44-51, 64-96, 104-124`
- **Evidence:** `>= x AND <= x` is semantically identical to `= x` here and empirically necessary (equality → 9,555,158 buffers / 10,820 ms vs 5,161 / 6.4 ms), but relies on PostgreSQL not normalising the range pair. Mitigated by the plan gate, which does reject the equality regression.
- **Recommended correction:** Address the root cause — retire or reshape the competing `DurableJob_eligible_*_idx`, or drive the lateral from an explicit `VALUES` list — so the plan is correct by index design rather than by predicate obfuscation.
- **Missing test:** A gate asserting the workaround still selects `shop_claim_*` on the minimum supported PostgreSQL version, so a planner change is caught by version, not by luck.

### P3-D047-R10 · Name-filter probes add a permanent skip and todo to release migration evidence

- **File:** `scripts/vitest/migrations-name-filter-probes.test.ts`; `vitest.migrations.config.ts:13`
- **Evidence:** Full suite now reports `219 passed | 1 skipped | 1 todo (221)`. The probes are labelled disposable but are permanently included in release evidence.
- **Recommended correction:** Move the probes to a dedicated config or `include` used only by the negative gates, keeping the release suite at zero skips and zero todos.
- **Missing test:** An assertion that the release migration suite reports no skipped and no todo tests.

### P3-D047-R11 · No regression test protects the zero-pass reporter from a Vitest API change

- **File:** `scripts/vitest/fail-on-zero-passed-name-filter.ts`
- **Evidence:** The guard depends on `ctx.config.testNamePattern`, `task.type === "test" | "suite"`, and `task.tasks`. No unit test asserts `onFinished` sets `process.exitCode = 1`. If a future Vitest version renames or reshapes any of these, the reporter returns silently and every focused `-t` gate reverts to failing open. CI contains no negative `-t` gate that would notice.
- **Recommended correction:** Add a unit test that drives the reporter with synthetic file/task trees (zero-pass, nested-pass, no-pattern), and add one always-failing negative `-t` gate to CI.
- **Missing test:** As above.

### P3-D047-R12 · Disabled shops consume bounded seed slots

- **File:** `app/sync/fair-claim-query.server.ts:60-96` (`shop_seed` does not filter `processingEnabled`); `app/sync/dispatcher.server.ts:1313-1333`
- **Evidence:** Jobs belonging to a `processingEnabled = false` shop are seeded and claimed, then discarded as `shop_disabled` after the fact. Consistent with prior behaviour and not a regression, but now that discovery is hard-capped at `shopCap`, disabled shops directly displace enabled shops from the seed.
- **Recommended correction:** Add `AND s."processingEnabled"` to `shop_seed` (the `Shop` row is already being read), retaining the post-claim re-check for the disable-after-claim race.
- **Missing test:** A dispatch test with disabled shops holding the oldest backlog asserting enabled shops still fill the batch.

### P3-D047-R13 · Implementation report's exact-head CI row is stale and contradicts verified evidence

- **File:** `docs/phases/phase-1/PR4_SYNC_CONTROL_PLANE_D047_CORRECTION_IMPLEMENTATION_REPORT.md` (identity chain table)
- **Evidence:** States exact-head CI was "Not obtained by agent" and that a human must dispatch CI, citing superseded run `31126856745`. Runs `31131707375` (PR) and `31131499707` (push) both succeeded on `cc1ff7e7…`.
- **Recommended correction:** Update the identity row to cite the verified exact-head runs.

---

## 14. Verdict summary

| # | Item | Verdict |
|---|---|---|
| 1 | Exact reviewed SHA | `cc1ff7e7a088f130372e7ead3bc2e679aee952fd` |
| 2 | Confirmed merge base | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` |
| 3 | PR state | OPEN · DRAFT · UNMERGED |
| 4 | Exact-head CI | Run `31131707375` / job `92721868719` — success, 135 steps, 0 skipped; push run `31131499707` success — both independently inspected |
| 7 | Shared runtime/EXPLAIN SQL identity | **PASS** (caveat P3-D047-R06) |
| 8 | Operational SQL correctness | **PASS** |
| 9 | Planner predicate `>=`/`<=` | **SOUND AND NECESSARY** (residual P3-D047-R09) |
| 10 | DurableJob boundedness | **PASS — SQL-enforced** |
| 11 | Shop-discovery scalability | **FAIL — P2-D047-R01** |
| 12 | Plan shape and parser | **PARTIAL — P3-D047-R05** |
| 13 | Repeated-cycle fairness | **FAIL — P2-D047-R02** |
| 14 | Concurrency and refill | **CORRECT BUT UNDERFILLED — P2-D047-R04** |
| 15 | Ordering guarantee | **NOT GUARANTEED — P3-D047-R07** |
| 16 | Index / migration | **PARTIAL — P2-D047-R03, P3-D047-R08** |
| 17 | Migration zero-test guard | **PASS** (gaps P3-D047-R10, P3-D047-R11) |
| 18 | Documentation, risk, identity | **PARTIAL** — identity and immutability exact; performance, fairness, and locking claims inaccurate or absent |
| 19 | D-046 / D-045 findings | **INTACT — not reopened** |
| 20 | Immutable reports | **UNCHANGED** — D-046 follow-up blob `29a5f4e3a05b57a817b952d233cd8895db7a4c37` |
| 21 | Safety and scope | **PASS** |

### Final verdict

**CORRECTIONS REQUIRED**

P2-NEW-D047-01 is **partially corrected**. The genuine achievements are real and independently verified: the runtime and EXPLAIN harness now share one production SQL builder, the synthetic PENDING-only harness query is gone, `DurableJob` access is index-only and SQL-bounded, the `ROW_NUMBER` full-backlog Seq Scan and WindowAgg are eliminated, operational correctness is clean across every eligibility and tenancy case tested, concurrency is free of duplicate claims and illegal transitions, and the shipped test counts (11 / 185 / 219) reproduce exactly.

But the correction does not close the finding. The unbounded per-dispatch work was **relocated from `DurableJob` to `Shop`**, where it is invisible to the plan gate and grows linearly with the merchant base (100,421 buffers and 257 ms at 20,005 shops). Separately, the bounded seed permits **indefinite shop starvation** — three shops consumed 100 % of dispatch capacity for 40 consecutive cycles while five eligible shops received nothing — which contradicts F-PR4-13's stated acceptance criterion, is not disclosed in the D-047 documentation, and cannot be detected by the shipped test suite. The index migration takes a write-blocking `ShareLock` on the control plane's hottest table with no rollout assessment.

P3-NEW-D047-01 is **substantively correct**: all 13 required name-filter behaviours were verified, including the three real CI gates, their drifted variants, and the skip-only and todo-only cases. Only two minor gaps remain (probe pollution of release evidence; no regression test for the reporter itself).

R-120 must remain **OPEN**. R-119 remains **OPEN**. Q-003 and F-PR4-18 remain **OPEN**. PR #20 remains OPEN, DRAFT, and UNMERGED. PR 5 remains BLOCKED. Production execution and inventory writes remain unauthorized.

**D-047 correction closure is not approved.**
