/**
 * F-PR4-11 eligible-claim plan shape assertions.
 *
 * The intended index is DurableJob_eligible_pending_idx
 * ("nextEligibleAt","createdAt",id) WHERE state='PENDING', which satisfies
 * ORDER BY without a Sort node. Shop-leading and state-composite indexes may
 * appear under stale planner statistics and are not proof of the ordered
 * claim path.
 */

export class EligibleClaimPlanShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EligibleClaimPlanShapeError";
  }
}

export function assertEligibleClaimPlanShape(planText: string): void {
  if (!/Index (?:Only )?Scan using "DurableJob_eligible_pending_idx"/i.test(planText)) {
    throw new EligibleClaimPlanShapeError(
      'expected Index Scan / Index Only Scan using "DurableJob_eligible_pending_idx"',
    );
  }
  if (/Seq Scan on "DurableJob"/i.test(planText)) {
    throw new EligibleClaimPlanShapeError('prohibited Seq Scan on "DurableJob"');
  }
  if (/Sort Method: external/i.test(planText)) {
    throw new EligibleClaimPlanShapeError("prohibited external sort");
  }
  // Ordered index must satisfy ORDER BY — Incremental Sort / Sort / top-N
  // heapsort indicate a non-covering index choice (e.g. shop-leading).
  if (/\bIncremental Sort\b|\bSort Method:|\n\s*->\s*Sort\b|^\s*Sort\b/m.test(planText)) {
    throw new EligibleClaimPlanShapeError(
      "prohibited Sort node — eligible_pending index should satisfy ORDER BY",
    );
  }
  if (/DurableJob_shop_eligible_pending/i.test(planText)) {
    throw new EligibleClaimPlanShapeError(
      "shop-leading eligible index is not the F-PR4-11 ordered claim path",
    );
  }
}
