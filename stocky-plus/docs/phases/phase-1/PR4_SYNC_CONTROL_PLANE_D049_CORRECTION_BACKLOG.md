# Phase 1 PR 4 — D-049 Correction Backlog

**Decision:** D-049 — Phase 1 PR 4 monotonic fail-safe readiness + index-satisfiable `nextDispatchAt` scheduling  
**Authorized starting reviewed head:** `8866a8d67df63bccd23cccef71cd256433a86c7b`  
**Authorized main / merge base:** `e69bc53d91db75472b0d0998bf1b74ee6246adb1`  
**Immutable D-048 review:** `80955af334c761d3a0299c7ec755f4353186279c` → incorporated report blob `0de12503787c4c056cd097445e5e2db3d6a8339a`  
**Review verdict:** `CORRECTIONS REQUIRED`  
**Status after Cursor work:** `D-049 CORRECTIONS IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`

Do **not** mark any finding closed on Cursor evidence. PR #20 remains **OPEN, DRAFT, UNMERGED**. PR 5 remains **BLOCKED**. Inventory-write flags remain **OFF**. Q-003 and F-PR4-18 remain **OPEN**. R-119…R-122 remain **OPEN**.

## Approved findings in scope

| ID | Severity | Summary | Required direction |
|---|---|---|---|
| F-D048-01 | P1 | Concurrent same-shop inserts can produce false-negative readiness | Monotonic LEAST upsert; never move hint later from concurrent MIN recompute |
| F-D048-02 | P2 | `heal_empty` non-functional (UPDATE then DELETE same row) | One unambiguous modification path; real ground-truth reconciliation |
| F-D048-03 | P2 | Scheduling O(active-due merchants) | Persisted `nextDispatchAt` + matching schedule index |
| F-D048-05 | P2 | Latent multi-shop readiness lock-order/deadlock | Remove MIN RMW; enforce single-shop-per-tx on maintain trigger |
| F-D048-04 | P3 | `DurableJob.shopId` not DB-immutable | Extend transition guard; fail closed |
| F-D048-06 | P3 | Deadlock-timeout harness late rejection handler | Attach observer immediately on cancellable promise |

## Architecture (required)

1. **False positives acceptable; false negatives not.**
2. Trigger: create / move-earlier only (`LEAST`); never SELECT MIN overwrite later.
3. Scheduling key `nextDispatchAt` with index `(processingEnabled, nextDispatchAt, shopId)`.
4. Claim: `WHERE processingEnabled AND nextDispatchAt <= now ORDER BY nextDispatchAt, shopId LIMIT shopCap FOR UPDATE SKIP LOCKED`.
5. Strict fairness: `nextDispatchAt = GREATEST(actualEarliest, now + 1ms)` after service opportunity.
6. Bounded ground-truth reconcile + bounded refill.
7. New additive migration `20260807150000_sync_control_plane_d049_dispatch_schedule`.

## Risks

- **R-120** OPEN — active-due scheduling boundedness (D-049 addresses; pending independent verification).
- **R-121** OPEN — materialized as F-D048-01; D-049 fail-safe pending independent verification.
- **R-122** OPEN — range-pair residual preserved.
- **R-123** OPEN — multi-shop readiness lock-order / deadlock (F-D048-05).
- **R-124** OPEN — CI harness late rejection-handler flake (F-D048-06).

## Non-goals

- Do not begin PR 5.
- Do not edit immutable review reports.
- Do not delete D-047 eligible/shop-eligible indexes.
- Do not enable inventory writes or run production migrations.
