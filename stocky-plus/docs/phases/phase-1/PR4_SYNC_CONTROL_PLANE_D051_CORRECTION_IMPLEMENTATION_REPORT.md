# Phase 1 PR 4 — D-051 Correction Implementation Report

**Decision:** D-051 — Phase 1 PR 4 per-shop readiness lock scope (close global convoy)
**Authorized starting reviewed D-050 head:** `62f4cff0ec2c0ec9542959fb65be29b26997e603`
**Authorized main / merge base:** `e69bc53d91db75472b0d0998bf1b74ee6246adb1`
**D-051 runtime/test implementation head:** `05bcb88c213be8823e840c8233b98d46236ff644` (`fix(test): align D-049 multi-shop writers with D-051 lock order`; runtime migration in `d94f5d2`)
**Immutable D-050 review incorporation:** cherry-pick `2e1fc3995614baf28d3fba1be59163d0be95096c` → local commit `747cf35159460d6fa6248089d9736fbf3c61101e` → blob `8247d8aea868818b8e904d196fee1a80fad283f5` — `PR4_SYNC_CONTROL_PLANE_D050_CORRECTION_REVIEW_REPORT.md` (immutable; never edited after incorporation)
**Status:** `D-051 CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`

D-050 correction closure is **APPROVED** for the two P1 defects it was created to repair. That approval is **not** PR 4 acceptance. Do **not** mark D-051 findings closed on Cursor evidence. PR #20 remains **OPEN, DRAFT, UNMERGED**. PR 5 remains **BLOCKED**. Inventory-write flags remain **OFF**. Q-003 and F-PR4-18 remain **OPEN**.

## Findings in scope

| ID | Severity | Disposition after Cursor work |
|---|---|---|
| F-CLAUDE-D050-01 | P2 | Implemented (per-shop advisory + fail-closed lock-order) — pending independent verification |
| F-CLAUDE-D050-02 | P3 | D-050 implementation-report identity corrected to `62f4cff…` / PUSH `31542495663` / PR `31542499135` — those runs do **not** cover D-051 |
| F-CLAUDE-D050-03A | P3 | Independent stale-fairness formula/literals |
| F-CLAUDE-D050-03B | P3 | Distinct +500 ms / >1,000 ms / 1,000 ms anti-reset cases |

## Root cause of the global convoy (F-CLAUDE-D050-01)

D-050 trigger functions took one transaction-scoped advisory key for **all** shops:

```text
pg_advisory_xact_lock(hashtextextended('stocky_dispatch_ready_shop_maintain', 0))
```

in:

- `stocky_dispatch_ready_shop_maintain_insert_stmt()`
- `stocky_dispatch_ready_shop_maintain_update_stmt()`
- `stocky_dispatch_ready_shop_sync_enabled_stmt()`

The lock was held until COMMIT. Unrelated merchants serialized on a mutex they do not share. Independent D-050 measurements (`62f4cff…`):

| Workload | Concurrency 1 | Concurrency 100 | Notes |
|---|---:|---:|---|
| control (no readiness) | 530 tps | 3,258 tps | scales |
| PENDING intake | 859 tps | peak 1,689 then 1,229 tps | convoy |
| expired-lease recovery | 373 tps | 320 tps | does not scale |
| recovery latency | — | p99 ~864.9 ms / max ~1,008 ms | |
| HOL blocker | held 200 / 1,000 / 3,000 ms | unrelated intake blocked ~207 / 1,013 / 3,007 ms | head-of-line |

That global lock is **not** an acceptable production throughput ceiling. The branch is unmerged; the architecture is corrected here.

## Chosen replacement lock architecture

Per-shop transaction-scoped advisory lock:

```text
pg_advisory_xact_lock(
  hashtextextended('stocky_dispatch_ready_shop_maintain:' || shop_id, 0)
)
```

acquired in `shopId ASC` inside each statement-trigger loop. Bodies remain INLINE (no nested helper — D-050 `42501` lesson). The D-050 migration is **not** edited.

Transaction-wide deadlock freedom is **not** claimed from `ORDER BY shopId ASC` inside a single statement alone. Opposite-order multi-statement transactions (T1: B then A; T2: A then B) can ABBA on per-shop xact locks and `DispatchReadyShop` row locks.

**Enforcement:** before locking shop S, if transaction-local `stocky.ready_lock_max_shop` ( `set_config(..., is_local=true)` ) is a shopId **greater than** S, RAISE `P0001` with message prefix `stocky_dispatch_ready_lock_order`. This is **not** the removed D-049 multi-shop-allowance GUC. Single-statement multi-shop writers still succeed because the trigger sorts ASC. Opposite-order multi-statement acquisition fails closed instead of waiting into `40P01`.

No bounded SQLSTATE retry is part of this architecture. Structural deadlocks are refused rather than normalized.

## Transaction-shape audit (runtime)

Inspected: `app/sync/intake.server.ts`, `replay.server.ts`, `lifecycle.server.ts`, `dispatcher.server.ts`, `uninstall.server.ts`, `reinstall.server.ts`, `fair-claim-query.server.ts`.

**Invariant recorded and enforced:** no supported runtime writer issues readiness-changing SQL statements for **different shops in separate statements** of one transaction.

| Writer | Transaction boundary | Readiness-changing statements | Shop set / statement | Shop set / transaction | Lock order |
|---|---|---|---|---|---|
| Webhook intake (create PENDING job) | `prisma.$transaction` in `intake.server.ts` | 1× `DurableJob` INSERT PENDING | 1 shop | 1 shop | advisory(shop) → ReadyShop |
| Webhook intake duplicate/conflict | same tx | CANCELLED / no PENDING arrival (maintain filter misses) | 1 shop | 1 shop | no maintain advisory |
| `createDurableJob` | autocommit `durableJob.create` | 1× INSERT PENDING | 1 shop | 1 shop | advisory(shop) → ReadyShop |
| Dead-letter replay | `$transaction` | 1× INSERT PENDING | 1 shop | 1 shop | advisory(shop) → ReadyShop |
| Retry (`completeAttemptRetry`) | `$transaction` | 1× UPDATE → RETRY_WAIT | 1 shop | 1 shop | advisory(shop) → ReadyShop |
| Success / fail / dead-letter | `$transaction` per job | terminal states — not PENDING/RETRY_WAIT arrival | 1 shop | 1 shop | no maintain advisory |
| Attempt reaper (`recoverExpiredRunningAttempts`) | **separate `$transaction` per attempt** | RETRY_WAIT or terminal | 1 shop / tx | 1 shop / tx | advisory only on retry arrival |
| Stranded ENQUEUED recovery | **separate `$transaction` per job** | RETRY_WAIT or terminal | 1 shop / tx | 1 shop / tx | advisory only on retry arrival |
| Timeout recovery (same lifecycle paths) | per-job tx | as retry/fail | 1 shop | 1 shop | as above |
| Uninstall | `$transaction` | 1× `Shop.processingEnabled=false`; then per-job CANCELLED (not maintain) | 1 shop | 1 shop | advisory(shop) → ReadyShop for enabled sync |
| Reinstall | autocommit `shop.update` | 1× `processingEnabled=true` | 1 shop | 1 shop | advisory(shop) → ReadyShop |
| Expired-lease recovery | **one** `$queryRaw` UPDATE | 1 multi-row DISPATCH_LEASED→PENDING | many shops possible | same as statement | trigger `ORDER BY shopId ASC`; advisory per shop ASC |
| Bulk `processingEnabled` | one UPDATE | 1 statement | many shops | same as statement | trigger `ORDER BY id ASC` |
| Raw SQL multi-row INSERT/UPDATE | one statement | 1 | many shops | same as statement | trigger shopId ASC |
| `claimBatchFair` / `dispatchPendingJobs` claim | `$transaction` A/B/C/D | lease CAS is DISPATCH_LEASED (**not** maintain); D updates ReadyShop **directly** | many shops | many shops | ReadyShop `FOR UPDATE SKIP LOCKED` only — **does not take maintain advisory** |
| `enqueueWithDispatch` return-to-PENDING | **separate** from claim | 1× UPDATE → PENDING | 1 shop | 1 shop | advisory(shop) → ReadyShop |
| `dispatchPendingJobs` overall | recoverExpired **then** claim **then** per-job enqueue | recover: 1 multi-shop statement; claim: no maintain advisory; enqueue: 1 shop | recover: many in one statement | recover and claim are **separate** transactions | ASC inside recovery trigger |

`ORDER BY shopId ASC` inside each individual statement does **not** by itself prove transaction-wide deadlock freedom. The audit shows the dangerous ABBA pattern is **not** a supported runtime writer. The fail-closed lock-order register enforces that invariant if a future/raw multi-statement writer appears.

## Migration

`20260812230000_sync_control_plane_d051_readiness_lock_scope` — additive `CREATE OR REPLACE` of the three trigger functions + `REVOKE ALL … FROM PUBLIC`. Does **not** edit `20260811190000_sync_control_plane_d050_split_claim_statement_triggers`. No production execution.

## D-050 P3 contract-test corrections

- **F-CLAUDE-D050-03A:** stale-fairness expected bound is `ceil(stale / (8 × shopCap)) + ceil(real / shopCap)` with independent literals `8` and `shopCap = batchSize`. The production helper is still asserted **equal** to that independent bound so helper drift fails the test.
- **F-CLAUDE-D050-03B:** three distinct shops/cases — `nextDispatchAt ≈ +500 ms` must not reset (delay ≤ 1000 ms); `+2 s` must pull earlier; exactly `1000 ms` must not pull (`>` not `>=`). Independent literals: approved max delay **1000** ms; fairness floor **1** ms.

## Local concurrency / correctness evidence (disposable PostgreSQL 16.14)

Do **not** treat Cursor evidence as finding closure.

### Cross-shop non-blocking

PENDING intake, RETRY_WAIT, expired-lease recovery vs unrelated intake, and `processingEnabled` vs unrelated intake: shop B completed while shop A’s readiness transaction remained `idle in transaction` (`pg_stat_activity`). Secondary elapsed bound `< 2000 ms`.

### Same-shop serialization

Conflicting shop A insert observed `wait_event_type = Lock` on the second backend; after T1 commit the second insert completed; both PENDING jobs and readiness present.

### Opposite-order / multi-statement

T1 locked higher shop then lower shop → `stocky_dispatch_ready_lock_order` (P0001). T2 locked lower then higher → COMMIT. Zero `40P01`. Readiness intact. Single-statement multi-shop INSERT (VALUES higher shop first) succeeded.

### Head-of-line (100-shop holder)

Unrelated shop insert completed while the 100-shop readiness transaction remained open (then held an additional 1 s). D-050 independent review: unrelated intake waited the holder’s full 200 / 1,000 / 3,000 ms. After D-051 the unrelated write no longer waits for the holder’s duration solely because it is another merchant.

### Distinct-shop concurrency benchmark (`D051_FULL_BENCH=1`, 750 ms bursts)

Zero deadlocks, zero errors at every level. Intake **scales** with concurrency (D-050 intake declined past concurrency 2).

| workload | c | tps | p50 ms | p95 ms | p99 ms | max ms |
|---|---:|---:|---:|---:|---:|---:|
| control | 1 | 5430.28 | 0.14 | 0.34 | 0.63 | 10.36 |
| control | 2 | 10611.41 | 0.15 | 0.45 | 0.61 | 3.45 |
| control | 4 | 12789.40 | 0.26 | 0.59 | 0.83 | 18.47 |
| control | 10 | 16649.08 | 0.52 | 0.91 | 1.41 | 23.08 |
| control | 25 | 17643.14 | 1.19 | 2.01 | 3.54 | 21.98 |
| control | 50 | 17640.36 | 2.18 | 4.29 | 9.73 | 43.37 |
| control | 100 | 15922.88 | 4.09 | 11.68 | 27.28 | 83.49 |
| intake | 1 | 5055.85 | 0.18 | 0.31 | 0.43 | 3.43 |
| intake | 2 | 7342.63 | 0.20 | 0.57 | 0.70 | 11.43 |
| intake | 4 | 10628.65 | 0.32 | 0.68 | 0.96 | 12.38 |
| intake | 10 | 12589.71 | 0.70 | 1.18 | 2.03 | 10.86 |
| intake | 25 | 14598.95 | 1.49 | 2.53 | 3.98 | 28.94 |
| intake | 50 | 14302.56 | 2.80 | 5.58 | 13.44 | 46.22 |
| intake | 100 | 11259.45 | 5.51 | 18.49 | 37.36 | 121.37 |
| retry | 1 | 1966.76 | 0.43 | 0.88 | 1.25 | 4.83 |
| retry | 2 | 3916.22 | 0.43 | 0.99 | 1.21 | 5.54 |
| retry | 4 | 4843.29 | 0.72 | 1.35 | 1.78 | 14.93 |
| retry | 10 | 6014.53 | 1.54 | 2.23 | 2.93 | 13.76 |
| retry | 25 | 7071.90 | 3.17 | 4.62 | 9.47 | 30.97 |
| retry | 50 | 6867.10 | 6.07 | 10.29 | 20.06 | 64.28 |
| retry | 100 | 5807.79 | 11.42 | 30.15 | 99.88 | 169.71 |
| recovery | 1 | 1248.67 | 0.69 | 1.41 | 1.84 | 5.48 |
| recovery | 2 | 2360.37 | 0.71 | 1.50 | 1.83 | 6.62 |
| recovery | 4 | 3042.55 | 1.17 | 1.97 | 2.43 | 14.36 |
| recovery | 10 | 3723.32 | 2.53 | 3.40 | 4.48 | 13.18 |
| recovery | 25 | 4405.23 | 5.09 | 7.03 | 15.90 | 33.01 |
| recovery | 50 | 4214.19 | 9.83 | 17.73 | 45.23 | 81.70 |
| recovery | 100 | 3307.12 | 21.59 | 45.99 | 117.19 | 161.98 |
| mixed | 1 | 5220.74 | 0.16 | 0.30 | 0.46 | 19.83 |
| mixed | 2 | 5950.80 | 0.21 | 0.79 | 1.16 | 12.22 |
| mixed | 4 | 8332.01 | 0.40 | 0.95 | 1.38 | 13.96 |
| mixed | 10 | 9332.45 | 0.93 | 1.83 | 2.45 | 13.79 |
| mixed | 25 | 10493.44 | 2.09 | 3.84 | 5.44 | 22.73 |
| mixed | 50 | 10280.72 | 4.02 | 7.86 | 15.62 | 52.21 |
| mixed | 100 | 8511.95 | 8.23 | 20.27 | 61.78 | 141.44 |

CI contract uses deterministic cross-shop non-blocking plus a qualitative gate that intake tps at concurrency 10 > tps at concurrency 1. Brittle exact throughput ratios are **not** in CI.

## Safety

- **Q-003:** OPEN
- **F-PR4-18:** OPEN
- **PR 5:** BLOCKED
- Inventory-write flags: **OFF** / DEFAULT OFF
- No production deployment, backfill, ownership repair, or inventory mutation
- Immutable D-050 review report was not edited after incorporation

## Risks

| ID | Disposition |
|---|---|
| R-119, R-120, R-121, R-124, R-125, R-126 | **CLOSED** on D-050 independent evidence. Regression gates remain mandatory during D-051. |
| R-122, R-123 | **OPEN** |
| R-127 | **OPEN** — F-CLAUDE-D050-01 (this cycle) |
| R-128 | **OPEN** — F-CLAUDE-D050-03 (this cycle) |
| R-115…R-118, R-031/R-032/R-033 | **OPEN** until normal PR 4 closure |

## Local validation (disposable PostgreSQL 16.14 + Redis 7; this Cursor session)

Do **not** treat Cursor evidence as finding closure. Commands ran on `05bcb88c213be8823e840c8233b98d46236ff644` unless noted.

| Check | Result |
|---|---|
| `npx prisma generate` / `npx prisma validate` | passed (Prisma Client v6.19.3; schema valid) |
| `git diff --check` | clean |
| `tenant:roles:provision --apply` / `tenant:roles:verify` | passed (`ok:true`; runtime role created) |
| `sync:roles:provision --apply` / `sync:roles:verify` | passed (`ok:true`) |
| `test:sync-integration` | **241 passed** / 20 files / exit 0 (153s) — CI-equivalent `SHOPIFY_APP_URL` + role passwords |
| `test:sync-exactly-once` | **42 passed** / 2 files / exit 0 |
| `test:sync-envelope-fail-closed` | **6 passed** / exit 0 |
| `test:sync-role-isolation` | **9 passed** / exit 0 |
| D-045 `-t` gates (v3/v2 rollback, digest-conflict, uncertain, RepeatableRead, queue-seam) | each **nonzero passed** / exit 0 |
| `test:migrations` | **226 passed** / 49 files / exit 0 (327s) |
| NEW-PR4-C07 role-present / role-absent `-t` | **1 passed** each / exit 0 |
| `test:migrations-name-filter-probes` (no `-t`) | exit 0 (1 skipped / 1 todo) |
| name-filter `-t "skip-only probe"` / `-t "todo-only probe"` | **exit 1** as required (`[ci-guard] … refusing vacuous success`) |
| `test:vitest-reporters` | **4 passed** / exit 0 |
| `test:sync-performance` (privileged `DATABASE_URL`; `D051_FULL_BENCH` unset) | **64 passed** / 6 files / exit 0 (130.51s) |
| `d051-corrections.test.ts` | **11 passed** (cross-shop non-blocking ×4, same-shop serialization, global-key probe, single-statement multi-shop, opposite-order fail-closed, HOL, bench 1/2/4/10, expired-lease 1/2/100) |
| `d050-corrections.test.ts` | **11 passed** (incl. ≥1000 claim-vs-insert 35950ms; 25s deadlock 25047ms; expired-lease 1/2/100; independent stale-fairness / anti-reset cases) |
| `d049-readiness-corrections.test.ts` | **7 passed** (incl. lock-order fail-closed; 8s adversarial stress; 0×40P01) |
| `test:sync-dispatch-recovery` | **29 passed** / exit 0 |
| `lint` / `typecheck` / `graphql-codegen` / `build` | passed |
| `sync:inventory:check` / `tenant:access:inventory:check` / `tenant:access:audit` / `tenant:enforcement:inventory:check` | passed |

`test:sync-performance` with `DATABASE_RUNTIME_URL` set after `test:migrations` on the same disposable database produced **6 failed / 58 passed** (`42501 permission denied for table DurableJob` on `recoverExpiredDispatchLeases`). That is post-migration grant/RLS contamination of the restricted role on the shared local DB, not a D-051 product regression: the same suite is **64 passed** on privileged `DATABASE_URL`, and exact-head GitHub CI (which provisions roles on a fresh database) succeeded. `d051-corrections.test.ts` still **11 passed** in the contaminated run because those tests use direct `pg` clients on `DATABASE_URL`.

HOL wall time **1110 ms** of which **1000 ms** is the post-completion hold; primary proof is shop B completing while T1 remained `idle in transaction`.

CI-mode bench (1/2/4/10, 750 ms bursts) on this session: intake 4984 → 13113 tps; recovery 1238 → 3607 tps; `advisoryWaitSamples=0`; intake `advisoryGrantedMax` 1→10 (not a single global lock). Full 1…100 table above is from the earlier `D051_FULL_BENCH=1` run recorded in this file.

## Exact-head CI

D-050 runs `31542495663` / `31542499135` cover **D-050 only** (`62f4cff…`) and do **not** cover D-051.

### Runtime/test implementation head `05bcb88c213be8823e840c8233b98d46236ff644`

| Field | Value |
|---|---|
| Exact-head PUSH CI | run `31651548233` — job `94296810645` — **success** — `head_sha` = `05bcb88…` — GitHub Actions skipped steps **0** |
| Exact-head PR CI | run `31651551006` — job `94296824298` — **success** — `head_sha` = `05bcb88…` — GitHub Actions skipped steps **0** |
| PUSH URL | https://github.com/Vedang1998/Stocky/actions/runs/31651548233 |
| PR URL | https://github.com/Vedang1998/Stocky/actions/runs/31651551006 |
| Superseded cancelled (cancel-in-progress) | PUSH `31650948914` (`267bcab…`); PR `31650951938` (`267bcab…`); PUSH `31649319386` / PR `31649322127` (`747cf35…`) |

A documentation-only commit after `05bcb88…` is **not** covered by those runs. Exact-head CI for the live PR tip must be obtained again and reported in the Cursor return to ChatGPT. Do not treat the `05bcb88…` runs as covering later commits (F-CLAUDE-D050-02 lesson).

## Final status

`D-051 CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`

PR #20 remains **OPEN, DRAFT, UNMERGED**.
