# Phase 1 PR 4 — D-048 Correction Implementation Report

**Decision:** D-048  
**Branch:** `phase-1/sync-control-plane`  
**PR:** #20 — OPEN, DRAFT, UNMERGED  
**Starting head:** `cc1ff7e7a088f130372e7ead3bc2e679aee952fd`  
**Authorized merge base:** `e69bc53d91db75472b0d0998bf1b74ee6246adb1`  
**Immutable D-047 review cherry-pick:** `0cf08771e1e43d02bc9d9bded2a92109b9997c6e` (byte-identical)  
**Status:** `PR 4 D-048 CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`

## Architecture selected

**DispatchReadyShop** readiness/fairness control-plane relation (preferred architecture).

Rejected: optimizing or disguising the D-047 `Shop` Seq Scan + correlated DurableJob probes.

### Why this satisfies R01 / R02 / R04

| Finding | Mechanism |
|---|---|
| R01 | Claim discovery reads only `DispatchReadyShop` due rows (`LIMIT shopCap`). No `Seq Scan on "Shop"`. Scheduling rows examined bounded as total Shop grows. |
| R02 | Order by `lastServedAt ASC NULLS FIRST, shopId`. Bound: `ceil(activeEligibleShops / shopCap)` with `shopCap = batchSize`. First-round `shop_slot` preference within a window. |
| R04 | `FOR UPDATE OF r SKIP LOCKED` on readiness rows → concurrent dispatchers lock disjoint shop windows and refill from remaining eligible shops. |

### Readiness / fairness state model

| Column | Role |
|---|---|
| `shopId` (PK) | Exactly one readiness row per shop with PENDING/RETRY_WAIT work |
| `earliestEligibleAt` | Min nextEligibleAt among PENDING/RETRY_WAIT (including future) |
| `lastServedAt` | Fairness cursor; updated when shop enters a dispatch window |
| `processingEnabled` | Denormalized from Shop — disabled shops excluded before capacity allocation |

Maintenance: `stocky_dispatch_ready_shop_maintain` on DurableJob; `stocky_dispatch_ready_shop_sync_enabled` on Shop.processingEnabled. Fail-safe toward false-positive readiness; uniqueness enforced by PK.

## Index design

| Index | Purpose | Rollout |
|---|---|---|
| `DurableJob_shop_claim_{pending,retry_wait}_idx` | Per-shop LATERAL claim (D-047; unchanged migration) | Concurrent pre-create via `sync:claim-indexes:apply`; migration IF NOT EXISTS no-op |
| `DispatchReadyShop_due_fairness_idx` | `(processingEnabled, earliestEligibleAt, lastServedAt, shopId)` | Created with empty table in D-048 migration |
| `DurableJob_shop_eligible_*` / `DurableJob_eligible_*` | **Retained** (P3-D047-R08) — not dropped | Deferred; write cost accepted pending separate review |

## Planner-workaround disposition (P3-D047-R09)

Range-pair `"shopId" >= ss.shopId AND "shopId" <= ss.shopId` **retained**. Equality still plans as `DurableJob_eligible_*` + shopId Filter under PG 16. Documented residual; equality-regression comparison retained in `test:sync-performance`. Not a PostgreSQL optimization contract.

## P3 dispositions R05–R13

| ID | Disposition |
|---|---|
| R05 | Plan gate rejects Shop Seq Scan, DurableJob Bitmap, WindowAgg over cap, external sort, eligible_* trap; planted fixtures; buffer soft ceiling in operational tests |
| R06 | `assertDispatcherUsesProductionFairClaimSql` reads dispatcher source from disk; planted inline claim fails |
| R07 | Outer `ORDER BY shop_slot, nextEligibleAt, createdAt, id`; raw result ordering test without re-sort |
| R08 | Retain redundant shop_eligible_* — deferred cleanup |
| R09 | Retain range-pair + regression test + R-122 |
| R10 | Probes moved to `vitest.migrations-name-filter-probes.config.ts` / `test:migrations-name-filter-probes` |
| R11 | `scripts/vitest/fail-on-zero-passed-name-filter.test.ts` |
| R12 | `processingEnabled` on DispatchReadyShop; downstream recheck retained |
| R13 | Status/docs updated for D-048; D-047 CI row historically stale at review time (runs existed) |

## Migrations added

- `prisma/migrations/20260807010000_sync_control_plane_d048_dispatch_ready_shop/`

Historical `20260806220000_…d047_fair_claim_indexes` **not edited**.

## Safety

- Inventory-write flags DEFAULT OFF
- No production migration / queue / webhook / merchant data
- PR #20 remains OPEN, DRAFT, UNMERGED
- Q-003 / F-PR4-18 remain OPEN
- PR 5 BLOCKED
- Immutable D-047 review report unchanged after cherry-pick

## Evidence

Filled from executed commands in the Cursor D-048 turn (see final return packet for exact counts/SHAs/CI). Exact-head CI obtained after tip push.
