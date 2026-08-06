# Phase 1 PR 4 — D-047 Correction Implementation Report

**Decision:** D-047 — PHASE 1 PR 4 FOCUSED OPERATIONAL CLAIM / MIGRATIONS GUARD CORRECTIONS  
**Status after Cursor work:** `PR 4 D-047 CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`  
**Branch:** `phase-1/sync-control-plane`  
**PR:** #20 — OPEN, DRAFT, UNMERGED

## Identity chain (no self-referential tip)

| Identity | SHA / value |
|---|---|
| Unchanged `origin/main` / merge base | `e69bc53d91db75472b0d0998bf1b74ee6246adb1` |
| Required starting PR head | `b76fa2b63cb18cf2717a9269b7740decf0576bea` |
| Independent focused review commit (cherry-picked) | `8050e278ec8396345b842a653c5559243454432b` |
| Cherry-pick on branch | see Git history after starting head |
| Live final PR tip (this report authoring) | `99dec7979bd006b327fed710ca7a745fc5dbcc18` |
| Exact-head CI on tip | **Not obtained by agent** — `gh workflow run` returns HTTP 403; agent push check-suite creation is unreliable. Latest green PR CI remains run `31126856745` on superseded head `b76fa2b…`. Human must re-run / dispatch CI on tip `99dec79…`. |

Immutable reports (do not edit):

- `PR4_SYNC_CONTROL_PLANE_REVIEW_REPORT.md`
- `PR4_SYNC_CONTROL_PLANE_CORRECTION_REVIEW_REPORT.md`
- `PR4_SYNC_CONTROL_PLANE_SECOND_CORRECTION_REVIEW_REPORT.md`
- `PR4_SYNC_CONTROL_PLANE_FINAL_CORRECTION_REVIEW_REPORT.md`
- `PR4_SYNC_CONTROL_PLANE_D046_CORRECTION_REVIEW_REPORT.md`
- `PR4_SYNC_CONTROL_PLANE_D046_FOLLOWUP_CORRECTION_REVIEW_REPORT.md`

## Finding disposition (Cursor side only)

| ID | Sev | Exact correction | Primary files | Tests / gates |
|---|:---:|---|---|---|
| P2-NEW-D047-01 | P2 | Replaced `ROW_NUMBER()` full-backlog window with SQL-capped `MATERIALIZED` shop seed + per-shop LATERAL (PENDING ∪ RETRY_WAIT) + `FOR UPDATE SKIP LOCKED`. Production-owned `buildFairClaimLockedSelectSql` shared by runtime and EXPLAIN harness. Additive `DurableJob_shop_claim_{pending,retry_wait}_idx` including `id`. | `fair-claim-query.server.ts`; `dispatcher.server.ts`; migration `20260806220000_…`; plan/perf tests | `test:sync-performance`; identity + plan fixtures |
| P3-NEW-D047-01 | P3 | Registered existing zero-pass name-filter reporter in `vitest.migrations.config.ts` (activates only with `-t`). | `vitest.migrations.config.ts`; reporter comment | three CI `-t` gates + negatives + skip/todo probes |

**Do not close findings or risks on Cursor evidence alone.**

## Root cause (P2-NEW-D047-01)

1. The F-PR4-11 harness EXPLAINed a synthetic `state = 'PENDING' … LIMIT 50` query that no worker runs.
2. Production `claimBatchFair` used `ROW_NUMBER() OVER (PARTITION BY "shopId")` over `state IN ('PENDING','RETRY_WAIT')`, which planned as **Seq Scan + WindowAgg + full-eligible Sort** at 50k rows.
3. Partial index `DurableJob_eligible_pending_idx` cannot serve the operational `IN (PENDING, RETRY_WAIT)` predicate; the fairness window forced a full-backlog sort regardless.

## Selected algorithm

**Bounded shop-lateral skip-locked claim** (`bounded_shop_lateral_skip_locked`):

1. `shop_seed AS MATERIALIZED` — shops with eligible work, ordered by earliest eligibility, **`LIMIT shopCap = batchSize`** (SQL-enforced).
2. Per-shop `LATERAL` — `UNION ALL` of PENDING and RETRY_WAIT index-ordered probes, each **`LIMIT maxPerShop`**, then merge **`LIMIT maxPerShop`**.
3. Lock phase — `FOR UPDATE SKIP LOCKED` on the bounded candidate id set, final **`LIMIT batchSize`**.

Why:

- Candidate set size ≤ `batchSize × maxPerShop`, independent of total backlog.
- `MATERIALIZED` shop seed makes the planner parameterize per-shop probes onto `DurableJob_shop_claim_*` indexes (Index Only Scan), avoiding Seq Scan and global eligible-index + Filter.
- Preserves PENDING+RETRY_WAIT eligibility, maxPerShop fairness, concurrent SKIP LOCKED, and DISPATCH_LEASED lease transitions.

Bound explanation: `shopCap = batchSize` fills a batch at one job per shop; lateral cap `maxPerShop` is the fairness bound; both LIMITs are SQL literals via Prisma parameters.

## Index / migration design

Additive migration `20260806220000_sync_control_plane_d047_fair_claim_indexes`:

- `DurableJob_shop_claim_pending_idx` `("shopId","nextEligibleAt","createdAt",id) WHERE state='PENDING'`
- `DurableJob_shop_claim_retry_wait_idx` `("shopId","nextEligibleAt","createdAt",id) WHERE state='RETRY_WAIT'`

Including `id` matches `ORDER BY shopId, nextEligibleAt, createdAt, id LIMIT N` for Index Only Scan without re-sort. Historical migrations untouched.

## Shared SQL identity

Module `app/sync/fair-claim-query.server.ts`:

- `buildFairClaimLockedSelectSql` — sole production SELECT text
- `buildFairClaimLockedExplainSql` — `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` wrapping the **same** select builder
- `claimBatchFair` calls `$queryRaw(buildFairClaimLockedSelectSql(...))` only
- Harness calls `$queryRaw(buildFairClaimLockedExplainSql(...))` only
- Identity test: same builder references; identical Prisma bound `values`

No duplicated inline approximation; no test-only SQL branch; no mutable production test seam.

## Before / after operational EXPLAIN (disposable PG 16, 50k rows, default `work_mem`)

### Before (ROW_NUMBER path at starting head)

```
Limit  (actual time=96.442..96.445 rows=10)
  Buffers: shared hit=2001
  ->  Sort  (actual rows=10)
        ->  WindowAgg
              ->  Sort  (actual rows=45000; Sort Method: quicksort Memory: 12435kB)
                    ->  Seq Scan on "DurableJob"  (actual rows=45000; Rows Removed by Filter: 5000)
Execution Time: 96.479 ms
```

### After (bounded shop-lateral path — shopId range predicates)

Measured on disposable PostgreSQL 16 after ANALYZE, ≥50,000 DurableJob rows,
mixed PENDING/RETRY_WAIT/future, empty shops present, default `work_mem`:

```
CTE Scan on locked  (actual time=0.223..0.232 rows=10)
  Buffers: shared hit=227
  CTE shop_seed
    -> Limit/Sort of ≤ shopCap shops (quicksort Memory: 25kB)
    -> Seq Scan on "Shop" (not DurableJob)
    -> Index Only Scan using "DurableJob_shop_claim_pending_idx"
    -> Index Only Scan using "DurableJob_shop_claim_retry_wait_idx"
  CTE locked
    -> Nested Loop + LATERAL Index Only Scan shop_claim_*
    -> LockRows
    -> Sort (actual rows=10; quicksort Memory: 25kB)
    -> Index Scan "DurableJob_pkey"
Execution Time: ≈0.28 ms
```

Load-bearing predicate shape: `"shopId" >= $id AND "shopId" <= $id` (not bare
`=`), which selects shop-claim indexes. Bare equality competed with
`DurableJob_eligible_pending_idx` and planned as global nextEligibleAt scan +
shopId Filter (~51k buffers when empty shops were present).

| Metric | Before | After |
|---|---|---|
| Scan type on DurableJob | Seq Scan | Index Only Scan (`shop_claim_*`) |
| Rows examined (eligible) | ~45,000 | bounded per-shop LIMIT probes |
| Sort input | 45,000 | ≤ shopCap shops / ≤ candidates |
| Sort method | quicksort ~12MB | quicksort ~25kB |
| Buffers (shared hit) | ~2001 | ~227 (with empty shops) |
| Execution time | ~96 ms | ~0.28 ms |
| WindowAgg | yes | no |
| LockRows / SKIP LOCKED | separate follow-up | in production statement |
| Index selected for PENDING | none (seq) | `DurableJob_shop_claim_pending_idx` |

## P3-NEW-D047-01

`failOnZeroPassedNameFilter()` registered in `vitest.migrations.config.ts` (same reporter as sync-integration). Activates only when `testNamePattern` is set.

## Open gates (unchanged)

- Q-003 OPEN
- F-PR4-18 OPEN
- PR 5 BLOCKED
- Production unauthorized; inventory-write flags DEFAULT OFF
- R-119 preserved OPEN; R-120 added for operational claim full-scan/sort risk pending independent verification
- Original D-046 findings intact — not reopened

## Safety

- No amend/rebase/squash/force-push
- No PR ready/merge
- No PR 5 / production / inventory writes
- Immutable review reports byte-unchanged after cherry-pick
