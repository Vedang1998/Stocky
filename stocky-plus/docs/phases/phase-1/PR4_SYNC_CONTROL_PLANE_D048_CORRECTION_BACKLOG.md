# Phase 1 PR 4 — D-048 Correction Backlog

**Decision:** D-048 — Phase 1 PR 4 DispatchReadyShop fair-dispatch architecture corrections  
**Source:** Immutable D-047 review `0cf08771e1e43d02bc9d9bded2a92109b9997c6e`  
**Starting head:** `cc1ff7e7a088f130372e7ead3bc2e679aee952fd`  
**PR:** #20 — OPEN, DRAFT, UNMERGED  
**Status:** IMPLEMENTATION PENDING INDEPENDENT VERIFICATION

Do **not** mark findings or risks closed on Cursor evidence alone.

## In-scope blocking P2

| ID | Summary | Disposition target |
|---|---|---|
| P2-D047-R01 | Per-dispatch O(total Shop rows) discovery | DispatchReadyShop indexed due selection — no Shop Seq Scan |
| P2-D047-R02 | Indefinite shop starvation | Least-recently-served fairness with documented `ceil(A/shopCap)` bound |
| P2-D047-R03 | Blocking CREATE INDEX rollout | Concurrent pre-create tooling; historical D-047 migration untouched |
| P2-D047-R04 | Concurrent dispatchers underfill | SKIP LOCKED on readiness rows → disjoint fairness windows |

## In-scope P3

| ID | Summary | Disposition |
|---|---|---|
| P3-D047-R05 | Plan gate blind spots | Reject Shop Seq Scan, DurableJob Bitmap, buffer/row bounds, planted fixtures |
| P3-D047-R06 | Self-referential SQL identity | Independent dispatcher source-boundary guard |
| P3-D047-R07 | Vacuous ordering test | Explicit outer ORDER BY + raw result assertion |
| P3-D047-R08 | Redundant shop_eligible_* indexes | **Retain** — deferred; not authorized for destructive cleanup |
| P3-D047-R09 | Range-pair planner workaround | **Retain** with equality-regression test + documented residual risk |
| P3-D047-R10 | Probe pollution of release suite | Probes moved to isolated vitest config |
| P3-D047-R11 | Reporter API regression | Unit tests for failOnZeroPassedNameFilter |
| P3-D047-R12 | Disabled shops consume capacity | `processingEnabled` denormalized on DispatchReadyShop; excluded before lock |
| P3-D047-R13 | Stale CI/docs claims | Corrected in D-048 implementation report / status |

## Out of scope / do not reopen

- Accepted D-045 / D-046 corrections and NEW-CLAUDE-D045-01…04 without regression evidence
- Accepted migration zero-test guard behavior (keep fail-on-zero; only isolate probes)
- PR 5, production migration, inventory-write enablement

## Architecture selected

**DispatchReadyShop** per-shop readiness/fairness control-plane relation:

- one row per shop with PENDING/RETRY_WAIT work (including future-due)
- `earliestEligibleAt`, `lastServedAt`, denormalized `processingEnabled`
- trigger-maintained on DurableJob + Shop.processingEnabled
- claim SQL locks due enabled readiness rows with `FOR UPDATE SKIP LOCKED`
- per-shop LATERAL via `DurableJob_shop_claim_*` (range-pair predicate retained)
- first-round `shop_slot` preference before second slots
- explicit outer `ORDER BY` fairness contract

## Eventual-progress invariant

A continuously eligible, processing-enabled shop receives a service opportunity within

`ceil(activeEligibleShops / shopCap)` successful dispatch cycles

when capacity exists (`shopCap = batchSize`).
