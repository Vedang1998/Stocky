/**
 * F-PR4-11 / D-047 operational fair-claim plan-shape assertions.
 *
 * Asserts properties of the production claimBatchFair / fair-claim-query plan:
 * no Seq Scan on DurableJob, no external/disk sort, no unbounded WindowAgg /
 * full-backlog Sort, and index-supported shop-claim access. Does not mandate a
 * single index name as the sole acceptance criterion.
 */

export class EligibleClaimPlanShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EligibleClaimPlanShapeError";
  }
}

const SHOP_CLAIM_INDEX =
  /Index (?:Only )?Scan using "DurableJob_shop_claim_(?:pending|retry_wait)_idx"/i;

/** Parse "(actual ... rows=N" from a plan line; null if absent. */
function actualRowsOnLine(line: string): number | null {
  const m = /\(actual time=[^)]*rows=(\d+)/i.exec(line);
  return m ? Number(m[1]) : null;
}

/**
 * @param planText EXPLAIN (ANALYZE, BUFFERS) text for the operational claim SQL
 * @param bounds optional SQL-enforced candidate cap (shopCap × maxPerShop)
 */
export function assertEligibleClaimPlanShape(
  planText: string,
  bounds?: { maxCandidateRows: number },
): void {
  if (/Seq Scan on "DurableJob"/i.test(planText)) {
    throw new EligibleClaimPlanShapeError('prohibited Seq Scan on "DurableJob"');
  }
  if (/Sort Method: external/i.test(planText)) {
    throw new EligibleClaimPlanShapeError("prohibited external/disk sort");
  }
  if (/\bWindowAgg\b/i.test(planText)) {
    throw new EligibleClaimPlanShapeError(
      "prohibited WindowAgg — fair claim must not rank the full eligible backlog",
    );
  }

  const maxCandidates = bounds?.maxCandidateRows;
  if (maxCandidates != null) {
    for (const line of planText.split("\n")) {
      if (!/\bSort\b/i.test(line)) continue;
      // Skip "Sort Key:" / "Sort Method:" annotation lines without node costs.
      if (!/\(cost=/i.test(line) && !/\(actual /i.test(line)) continue;
      const rows = actualRowsOnLine(line);
      if (rows != null && rows > maxCandidates) {
        throw new EligibleClaimPlanShapeError(
          `prohibited unbounded Sort over ${rows} rows (cap ${maxCandidates})`,
        );
      }
    }
  }

  if (!/Index (?:Only )?Scan/i.test(planText)) {
    throw new EligibleClaimPlanShapeError(
      "expected Index Scan or Index Only Scan on the fair-claim path",
    );
  }
  if (!SHOP_CLAIM_INDEX.test(planText)) {
    throw new EligibleClaimPlanShapeError(
      'expected shop-claim Index Scan using "DurableJob_shop_claim_pending_idx" or "DurableJob_shop_claim_retry_wait_idx"',
    );
  }
  if (!/LockRows|FOR UPDATE/i.test(planText)) {
    throw new EligibleClaimPlanShapeError(
      "expected LockRows / FOR UPDATE SKIP LOCKED on the operational claim path",
    );
  }
}
