/**
 * Plan-shape regression fixtures for operational fair-claim (D-047 / F-PR4-11).
 * Pure string assertions — no DB / planner nondeterminism.
 */
import { describe, expect, it } from "vitest";
import {
  EligibleClaimPlanShapeError,
  assertEligibleClaimPlanShape,
} from "./eligible-claim-plan";

const BOUNDS = { maxCandidateRows: 100 };

describe("eligible-claim-plan shape (F-PR4-11 / D-047)", () => {
  it("accepts bounded shop-claim Index Only Scan with LockRows", () => {
    const plan = `
CTE Scan on locked  (actual time=0.315..0.327 rows=10 loops=1)
  Buffers: shared hit=117
  CTE locked
    ->  Limit  (actual time=0.313..0.321 rows=10 loops=1)
          ->  LockRows  (actual time=0.313..0.318 rows=10 loops=1)
                ->  Sort  (actual time=0.303..0.304 rows=10 loops=1)
                      Sort Key: d."nextEligibleAt", d."createdAt", d.id
                      Sort Method: quicksort  Memory: 27kB
                      ->  Index Scan using "DurableJob_pkey" on "DurableJob" d
          InitPlan
            ->  Nested Loop
                  ->  Limit
                        ->  Sort  (actual time=0.176..0.177 rows=5 loops=1)
                              Sort Method: quicksort  Memory: 25kB
                  ->  Limit
                        ->  Index Only Scan using "DurableJob_shop_claim_pending_idx" on "DurableJob"
                              Index Cond: (("shopId" = s.id) AND ("nextEligibleAt" <= now()))
Execution Time: 0.434 ms
`;
    expect(() => assertEligibleClaimPlanShape(plan, BOUNDS)).not.toThrow();
  });

  it("accepts Index Scan on DurableJob_shop_claim_retry_wait_idx", () => {
    const plan = `
Limit
  ->  LockRows
        ->  Nested Loop
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

  it("rejects WindowAgg over the eligible backlog", () => {
    const plan = `
Limit
  ->  WindowAgg
        ->  Index Scan using "DurableJob_shop_claim_pending_idx" on "DurableJob"
  LockRows
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
`;
    expect(() => assertEligibleClaimPlanShape(plan, BOUNDS)).toThrow(/external/);
  });

  it("rejects Sort whose actual rows exceed the SQL candidate cap", () => {
    const plan = `
Limit
  ->  LockRows
        ->  Sort  (cost=100..200 rows=45000 width=50) (actual time=90.054..92.784 rows=45000 loops=1)
              Sort Method: quicksort  Memory: 12435kB
              ->  Index Only Scan using "DurableJob_shop_claim_pending_idx" on "DurableJob"
`;
    expect(() => assertEligibleClaimPlanShape(plan, BOUNDS)).toThrow(/unbounded Sort/);
  });

  it("rejects plans that never use a shop-claim index", () => {
    const plan = `
Limit
  ->  LockRows
        ->  Index Only Scan using "DurableJob_eligible_pending_idx" on "DurableJob"
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
`;
    expect(() => assertEligibleClaimPlanShape(plan, BOUNDS)).toThrow(
      /eligible_\*|shopId Filter/,
    );
  });
});
