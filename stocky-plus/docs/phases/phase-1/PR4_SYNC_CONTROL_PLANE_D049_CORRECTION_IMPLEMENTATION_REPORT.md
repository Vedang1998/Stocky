# Phase 1 PR 4 — D-049 Correction Implementation Report

**Decision:** D-049 — monotonic fail-safe readiness + `nextDispatchAt` scheduling  
**Starting reviewed head:** `8866a8d67df63bccd23cccef71cd256433a86c7b`  
**Immutable D-048 review incorporation:** blob `0de12503787c4c056cd097445e5e2db3d6a8339a` / SHA256 `3906310c89b957371dd59c97fd59896630ac9d3452d12423d8dd6b3286989297`  
**Status:** `D-049 CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`

Do **not** mark findings closed on Cursor evidence.

## Architecture implemented

1. **Monotonic trigger** (`stocky_dispatch_ready_shop_maintain`): eligible INSERT / become-eligible / nextEligibleAt-earlier only; `earliestEligibleAt = LEAST(...)`; `nextDispatchAt` pulled earlier only for future-eligibility windows — never LEAST a fairness floor back to an ancient due time.
2. **Scheduling key** `nextDispatchAt` with index `DispatchReadyShop_dispatch_schedule_idx (processingEnabled, nextDispatchAt, shopId)`.
3. **Claim SQL**: lock due shops by `nextDispatchAt`; reconcile via ORDER BY/LIMIT 1 shop-claim paths; DELETE empty / UPDATE future / UPDATE due+fairness in disjoint CTEs; advance `nextDispatchAt = GREATEST(actual, now+1ms)`.
4. **Bounded refill** in `claimBatchFair` up to `FAIR_CLAIM_MAX_REFILL_ROUNDS=8`.
5. **F-D048-05 B**: single-shop-per-tx GUC guard on maintain trigger; admin bypass `stocky.allow_multi_shop_dispatch_ready=1`.
6. **F-D048-04**: `DurableJob.shopId` immutable in transition guard (BEFORE UPDATE).
7. **F-D048-06**: immediate rejection observer on cancellable sleep promise.

## Fairness bound

Documented bound remains `ceil(activeEligibleShops / shopCap)` with `shopCap = batchSize`.

## Migration

`20260807150000_sync_control_plane_d049_dispatch_schedule` — additive; does not edit D-047/D-048 migrations.

## Risks (remain OPEN)

R-119, R-120, R-121 (materialized as F-D048-01), R-122, R-123 (F-D048-05), R-124 (F-D048-06).

## Safety

Q-003 OPEN · F-PR4-18 OPEN · PR 5 BLOCKED · inventory-write flags OFF · no production activity.
