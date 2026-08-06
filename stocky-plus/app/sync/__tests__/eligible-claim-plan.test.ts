/**
 * Plan-shape regression fixtures for F-PR4-11 (P2-D046-01).
 * Pure string assertions — no DB / planner nondeterminism.
 */
import { describe, expect, it } from "vitest";
import {
  EligibleClaimPlanShapeError,
  assertEligibleClaimPlanShape,
} from "./eligible-claim-plan";

describe("eligible-claim-plan shape (F-PR4-11)", () => {
  it("accepts Index Only Scan on DurableJob_eligible_pending_idx without Sort", () => {
    const plan = `
Limit  (cost=0.42..8.03 rows=50 width=29) (actual time=0.016..0.031 rows=50 loops=1)
  Buffers: shared hit=17
  ->  Index Only Scan using "DurableJob_eligible_pending_idx" on "DurableJob"  (cost=0.42..7615.79 rows=50000 width=29) (actual time=0.016..0.028 rows=50 loops=1)
        Index Cond: ("nextEligibleAt" <= now())
        Heap Fetches: 50
        Buffers: shared hit=17
Execution Time: 0.041 ms
`;
    expect(() => assertEligibleClaimPlanShape(plan)).not.toThrow();
  });

  it("accepts Index Scan on DurableJob_eligible_pending_idx without Sort", () => {
    const plan = `
Limit
  ->  Index Scan using "DurableJob_eligible_pending_idx" on "DurableJob"
        Index Cond: ("nextEligibleAt" <= now())
`;
    expect(() => assertEligibleClaimPlanShape(plan)).not.toThrow();
  });

  it("rejects shop-leading eligible index with top-N heapsort (stale-stats CI plan)", () => {
    const plan = `
Limit  (cost=8.31..8.32 rows=1 width=42)
  ->  Sort  (cost=8.31..8.32 rows=1 width=42)
        Sort Key: "nextEligibleAt", "createdAt", id
        Sort Method: top-N heapsort  Memory: 25kB
        ->  Index Scan using "DurableJob_shop_eligible_pending_idx" on "DurableJob"  (cost=0.29..8.30 rows=1 width=42) (actual time=0.031..21.611 rows=50000 loops=1)
              Index Cond: ("nextEligibleAt" <= now())
`;
    expect(() => assertEligibleClaimPlanShape(plan)).toThrow(EligibleClaimPlanShapeError);
  });

  it("rejects state composite index with Incremental Sort (no-ANALYZE local plan)", () => {
    const plan = `
Limit
  ->  Incremental Sort
        Sort Key: "nextEligibleAt", "createdAt", id
        Full-sort Groups: 1  Sort Method: quicksort  Average Memory: 29kB  Peak Memory: 29kB
        ->  Index Scan using "DurableJob_state_nextEligibleAt_createdAt_idx" on "DurableJob"
              Index Cond: ((state = 'PENDING'::"DurableJobState") AND ("nextEligibleAt" <= now()))
`;
    expect(() => assertEligibleClaimPlanShape(plan)).toThrow(EligibleClaimPlanShapeError);
  });

  it("rejects Seq Scan even when index name is absent", () => {
    const plan = `
Limit
  ->  Sort
        Sort Method: top-N heapsort  Memory: 28kB
        ->  Seq Scan on "DurableJob"
              Filter: ((state = 'PENDING'::"DurableJobState") AND ("nextEligibleAt" <= now()))
`;
    expect(() => assertEligibleClaimPlanShape(plan)).toThrow(/Seq Scan|eligible_pending/);
  });

  it("rejects external sort", () => {
    const plan = `
Limit
  ->  Sort
        Sort Method: external merge  Disk: 1024kB
        ->  Index Scan using "DurableJob_eligible_pending_idx" on "DurableJob"
`;
    expect(() => assertEligibleClaimPlanShape(plan)).toThrow(/external sort|Sort/);
  });
});
