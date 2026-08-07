/**
 * Plan-shape regression fixtures for operational fair-claim (D-048 / F-PR4-11).
 * Pure string assertions — no DB / planner nondeterminism.
 */
import { describe, expect, it } from "vitest";
import {
  EligibleClaimPlanShapeError,
  assertEligibleClaimPlanShape,
} from "./eligible-claim-plan";

const BOUNDS = { maxCandidateRows: 100, maxReadyShopRows: 50 };

describe("eligible-claim-plan shape (F-PR4-11 / D-048 / D-049)", () => {
  it("accepts bounded DispatchReadyShop + shop-claim Index Only Scan with LockRows", () => {
    const plan = `
CTE Scan on locked  (actual time=0.315..0.327 rows=10 loops=1)
  Buffers: shared hit=117
  CTE locked
    ->  Limit  (actual time=0.313..0.321 rows=10 loops=1)
          ->  LockRows  (actual time=0.313..0.318 rows=10 loops=1)
                ->  Sort  (actual time=0.303..0.304 rows=10 loops=1)
                      Sort Key: oc.shop_slot, oc."nextEligibleAt", oc."createdAt", oc.id
                      Sort Method: quicksort  Memory: 27kB
                      ->  Nested Loop
                            ->  Limit  (actual time=0.050..0.055 rows=5 loops=1)
                                  ->  LockRows
                                        ->  Index Scan using "DispatchReadyShop_dispatch_schedule_idx" on "DispatchReadyShop" r  (actual time=0.020..0.030 rows=5 loops=1)
                            ->  Limit
                                  ->  Index Only Scan using "DurableJob_shop_claim_pending_idx" on "DurableJob"
                                        Index Cond: (("shopId" = ss."shopId") AND ("nextEligibleAt" <= now()))
Execution Time: 0.434 ms
`;
    expect(() => assertEligibleClaimPlanShape(plan, BOUNDS)).not.toThrow();
  });

  it("accepts Index Scan on DurableJob_shop_claim_retry_wait_idx", () => {
    const plan = `
Limit
  ->  LockRows
        ->  Nested Loop
              ->  Index Scan using "DispatchReadyShop_dispatch_schedule_idx" on "DispatchReadyShop" r
              ->  Index Scan using "DurableJob_shop_claim_retry_wait_idx" on "DurableJob"
`;
    expect(() => assertEligibleClaimPlanShape(plan, BOUNDS)).not.toThrow();
  });

  it("rejects Seq Scan of DurableJob (legacy ROW_NUMBER plan)", () => {
    const plan = `
Limit  (actual time=96.442..96.445 rows=10 loops=1)
  ->  Sort  (actual time=96.441..96.443 rows=10 loops=1)
        ->  WindowAgg  (actual time=90.075..96.423 rows=10 loops=1)
              ->  Sort  (actual time=90.054..92.784 rows=45000 loops=1)
                    Sort Method: quicksort  Memory: 12435kB
                    ->  Seq Scan on "DurableJob"  (actual time=0.006..9.374 rows=45000 loops=1)
`;
    expect(() => assertEligibleClaimPlanShape(plan, BOUNDS)).toThrow(
      EligibleClaimPlanShapeError,
    );
  });

  it("rejects Seq Scan on Shop (D-047 relocated unbounded discovery)", () => {
    const plan = `
Limit
  ->  LockRows
        ->  Nested Loop
              ->  Seq Scan on "Shop" s  (actual time=0.010..200.000 rows=20000 loops=1)
                    Filter: (SubPlan 1 IS NOT NULL)
                    Rows Removed by Filter: 19990
                    Buffers: shared hit=100421
              ->  Index Only Scan using "DurableJob_shop_claim_pending_idx" on "DurableJob"
`;
    expect(() => assertEligibleClaimPlanShape(plan, BOUNDS)).toThrow(
      /Seq Scan on "Shop"/,
    );
  });

  it("rejects Bitmap Heap Scan on DurableJob", () => {
    const plan = `
Limit
  ->  LockRows
        ->  Bitmap Heap Scan on "DurableJob"  (actual time=1..50 rows=40000 loops=1)
              ->  Bitmap Index Scan on "DurableJob_eligible_pending_idx"
        ->  Index Only Scan using "DurableJob_shop_claim_pending_idx" on "DurableJob"
        ->  Index Scan using "DispatchReadyShop_dispatch_schedule_idx" on "DispatchReadyShop" r
`;
    expect(() => assertEligibleClaimPlanShape(plan, BOUNDS)).toThrow(
      /Bitmap Heap Scan/,
    );
  });

  it("rejects WindowAgg over the eligible backlog", () => {
    const plan = `
Limit
  ->  WindowAgg  (cost=100..200 rows=45000 width=50) (actual time=90.075..96.423 rows=45000 loops=1)
        ->  Index Scan using "DurableJob_shop_claim_pending_idx" on "DurableJob"
  LockRows
  ->  Index Scan using "DispatchReadyShop_dispatch_schedule_idx" on "DispatchReadyShop" r
`;
    expect(() => assertEligibleClaimPlanShape(plan, BOUNDS)).toThrow(/WindowAgg/);
  });

  it("rejects external disk sort", () => {
    const plan = `
Limit
  ->  LockRows
        ->  Sort
              Sort Method: external merge  Disk: 2816kB
              ->  Index Only Scan using "DurableJob_shop_claim_pending_idx" on "DurableJob"
        ->  Index Scan using "DispatchReadyShop_dispatch_schedule_idx" on "DispatchReadyShop" r
`;
    expect(() => assertEligibleClaimPlanShape(plan, BOUNDS)).toThrow(/external/);
  });

  it("rejects Sort whose actual rows exceed the SQL candidate cap", () => {
    const plan = `
Limit
  ->  LockRows
        ->  Sort  (cost=100..200 rows=10 width=50) (actual time=90.054..92.784 rows=45000 loops=1)
              Sort Method: quicksort  Memory: 12435kB
              ->  Index Only Scan using "DurableJob_shop_claim_pending_idx" on "DurableJob"
        ->  Index Scan using "DispatchReadyShop_dispatch_schedule_idx" on "DispatchReadyShop" r
`;
    expect(() => assertEligibleClaimPlanShape(plan, BOUNDS)).toThrow(
      /unbounded Sort|Sort Method Memory/,
    );
  });

  it("rejects Sort whose planned rows greatly exceed the SQL candidate cap", () => {
    const plan = `
Limit
  ->  LockRows
        ->  Sort  (cost=100..200 rows=45000 width=50)
              ->  Index Only Scan using "DurableJob_shop_claim_pending_idx" on "DurableJob"
        ->  Index Scan using "DispatchReadyShop_dispatch_schedule_idx" on "DispatchReadyShop" r
`;
    expect(() => assertEligibleClaimPlanShape(plan, BOUNDS)).toThrow(/unbounded Sort/);
  });

  it("rejects plans that never use a shop-claim index", () => {
    const plan = `
Limit
  ->  LockRows
        ->  Index Only Scan using "DurableJob_eligible_pending_idx" on "DurableJob"
        ->  Index Scan using "DispatchReadyShop_dispatch_schedule_idx" on "DispatchReadyShop" r
`;
    expect(() => assertEligibleClaimPlanShape(plan, BOUNDS)).toThrow(/shop-claim/);
  });

  it("rejects eligible_* index with shopId Filter (planner trap)", () => {
    const plan = `
Limit
  ->  LockRows
        ->  Index Only Scan using "DurableJob_shop_claim_retry_wait_idx" on "DurableJob"
        ->  Index Scan using "DurableJob_eligible_pending_idx" on "DurableJob"
              Index Cond: ("nextEligibleAt" <= now())
              Filter: ("shopId" = ss."shopId")
              Rows Removed by Filter: 20181
        ->  Index Scan using "DispatchReadyShop_dispatch_schedule_idx" on "DispatchReadyShop" r
`;
    expect(() => assertEligibleClaimPlanShape(plan, BOUNDS)).toThrow(
      /eligible_\*|shopId Filter/,
    );
  });

  it("rejects plans that omit DispatchReadyShop access", () => {
    const plan = `
Limit
  ->  LockRows
        ->  Index Only Scan using "DurableJob_shop_claim_pending_idx" on "DurableJob"
`;
    expect(() => assertEligibleClaimPlanShape(plan, BOUNDS)).toThrow(
      /DispatchReadyShop/,
    );
  });

  it("rejects Seq Scan on DispatchReadyShop (F-D048-03 planted)", () => {
    const plan = `
Limit
  ->  LockRows
        ->  Nested Loop
              ->  Seq Scan on "DispatchReadyShop" r  (actual time=0.010..20.000 rows=20000 loops=1)
              ->  Index Only Scan using "DurableJob_shop_claim_pending_idx" on "DurableJob"
`;
    expect(() => assertEligibleClaimPlanShape(plan, BOUNDS)).toThrow(
      /Seq Scan on "DispatchReadyShop"/,
    );
  });

  it("rejects Bitmap Heap Scan on DispatchReadyShop (F-D048-03 planted)", () => {
    const plan = `
Limit
  ->  LockRows
        ->  Nested Loop
              ->  Bitmap Heap Scan on "DispatchReadyShop" r  (actual time=0.050..5.000 rows=5000 loops=1)
                    ->  Bitmap Index Scan using "DispatchReadyShop_dispatch_schedule_idx"
              ->  Index Only Scan using "DurableJob_shop_claim_pending_idx" on "DurableJob"
`;
    expect(() => assertEligibleClaimPlanShape(plan, BOUNDS)).toThrow(
      /Bitmap Heap Scan on "DispatchReadyShop"/,
    );
  });

  it("rejects large fairness Sort Method memory (F-D048-03 planted)", () => {
    const plan = `
Limit
  ->  LockRows
        ->  Sort  (actual time=20.000..20.010 rows=10 loops=1)
              Sort Method: quicksort  Memory: 1706kB
              ->  Index Scan using "DispatchReadyShop_dispatch_schedule_idx" on "DispatchReadyShop" r
        ->  Index Only Scan using "DurableJob_shop_claim_pending_idx" on "DurableJob"
`;
    expect(() => assertEligibleClaimPlanShape(plan, { ...BOUNDS, maxSortMethodMemoryKb: 256 })).toThrow(
      /Sort Method Memory/,
    );
  });

  it("rejects DispatchReadyShop examining full active-due population", () => {
    const plan = `
Limit
  ->  LockRows
        ->  Nested Loop
              ->  Index Scan using "DispatchReadyShop_dispatch_schedule_idx" on "DispatchReadyShop" r  (actual time=0.020..15.000 rows=20000 loops=1)
              ->  Index Only Scan using "DurableJob_shop_claim_pending_idx" on "DurableJob"
`;
    expect(() => assertEligibleClaimPlanShape(plan, BOUNDS)).toThrow(
      /DispatchReadyShop scan examining/,
    );
  });

});
