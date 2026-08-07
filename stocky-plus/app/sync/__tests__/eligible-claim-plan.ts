/**
 * F-PR4-11 / D-048 operational fair-claim plan-shape assertions.
 *
 * Asserts properties of the production claimBatchFair / fair-claim-query plan:
 * no Seq Scan on DurableJob, no unbounded Seq Scan on Shop, no external/disk
 * sort, no WindowAgg over the full backlog, no Bitmap Heap walk of DurableJob,
 * no eligible_* + shopId Filter trap, and index-supported DispatchReadyShop +
 * shop-claim access. Buffer/row ceilings represent boundedness on disposable
 * environments — not production SLAs.
 */

export class EligibleClaimPlanShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EligibleClaimPlanShapeError";
  }
}

const SHOP_CLAIM_INDEX =
  /Index (?:Only )?Scan using "DurableJob_shop_claim_(?:pending|retry_wait)_idx"/i;

const READY_SHOP_INDEX =
  /Index (?:Only )?Scan using "DispatchReadyShop_/i;

/** Parse "(actual ... rows=N" from a plan line; null if absent. */
function actualRowsOnLine(line: string): number | null {
  const m = /\(actual time=[^)]*rows=(\d+)/i.exec(line);
  return m ? Number(m[1]) : null;
}

/** Parse top-level shared hit buffer count when present. */
export function parseSharedHitBuffers(planText: string): number | null {
  const m = /Buffers:\s*shared hit=(\d+)/i.exec(planText);
  return m ? Number(m[1]) : null;
}

export type EligibleClaimPlanBounds = {
  maxCandidateRows: number;
  /** Max scheduling rows the readiness lock may examine (shopCap). */
  maxReadyShopRows?: number;
  /** Soft disposable-env shared-hit ceiling (not a production SLA). */
  maxSharedHitBuffers?: number;
};

/**
 * @param planText EXPLAIN (ANALYZE, BUFFERS) text for the operational claim SQL
 * @param bounds optional SQL-enforced candidate / readiness caps
 */
export function assertEligibleClaimPlanShape(
  planText: string,
  bounds?: EligibleClaimPlanBounds,
): void {
  if (/Seq Scan on "DurableJob"/i.test(planText)) {
    throw new EligibleClaimPlanShapeError('prohibited Seq Scan on "DurableJob"');
  }
  if (/Seq Scan on "Shop"/i.test(planText)) {
    throw new EligibleClaimPlanShapeError(
      'prohibited Seq Scan on "Shop" — dispatch must not scan total merchants',
    );
  }
  if (/Bitmap Heap Scan on "DurableJob"/i.test(planText)) {
    throw new EligibleClaimPlanShapeError(
      'prohibited Bitmap Heap Scan on "DurableJob" — implies unbounded candidate walk',
    );
  }
  if (
    /Bitmap Index Scan on "DurableJob_/i.test(planText) ||
    /Bitmap Index Scan using "DurableJob_/i.test(planText)
  ) {
    throw new EligibleClaimPlanShapeError(
      "prohibited Bitmap Index Scan on DurableJob",
    );
  }
  if (/Sort Method: external/i.test(planText)) {
    throw new EligibleClaimPlanShapeError("prohibited external/disk sort");
  }
  if (/\bWindowAgg\b/i.test(planText)) {
    // ROW_NUMBER over per-shop lateral (≤ maxPerShop) is allowed only when the
    // WindowAgg actual rows stay within the candidate bound. Full-backlog
    // WindowAgg is prohibited by the row ceiling below and by missing shop-claim.
    const maxCandidates = bounds?.maxCandidateRows;
    if (maxCandidates == null) {
      throw new EligibleClaimPlanShapeError(
        "prohibited WindowAgg — fair claim must not rank the full eligible backlog",
      );
    }
    for (const line of planText.split("\n")) {
      if (!/\bWindowAgg\b/i.test(line)) continue;
      if (!/\(cost=/i.test(line) && !/\(actual /i.test(line)) continue;
      const rows = actualRowsOnLine(line);
      if (rows != null && rows > maxCandidates) {
        throw new EligibleClaimPlanShapeError(
          `prohibited WindowAgg over ${rows} rows (cap ${maxCandidates})`,
        );
      }
    }
  }

  const maxCandidates = bounds?.maxCandidateRows;
  if (maxCandidates != null) {
    for (const line of planText.split("\n")) {
      if (!/\bSort\b/i.test(line)) continue;
      // Skip "Sort Key:" / "Sort Method:" annotation lines without node costs.
      if (!/\(cost=/i.test(line) && !/\(actual /i.test(line)) continue;
      const actualRows = actualRowsOnLine(line);
      if (actualRows != null) {
        if (actualRows > maxCandidates) {
          throw new EligibleClaimPlanShapeError(
            `prohibited unbounded Sort over ${actualRows} actual rows (cap ${maxCandidates})`,
          );
        }
        continue;
      }
      // No ANALYZE actuals — planned rows only; allow modest estimator slack.
      const planned = /\(cost=[^)]*rows=(\d+)/i.exec(line);
      const plannedRows = planned ? Number(planned[1]) : null;
      if (plannedRows != null && plannedRows > maxCandidates * 2) {
        throw new EligibleClaimPlanShapeError(
          `prohibited unbounded Sort over ${plannedRows} planned rows (cap ${maxCandidates})`,
        );
      }
    }
  }

  const maxReady = bounds?.maxReadyShopRows;
  if (maxReady != null) {
    for (const line of planText.split("\n")) {
      if (!/on "DispatchReadyShop"/i.test(line)) continue;
      if (!/\(cost=/i.test(line) && !/\(actual /i.test(line)) continue;
      const rows = actualRowsOnLine(line);
      // Index scans may report loops; bound absolute actual rows on the lock path.
      if (rows != null && rows > maxReady * 4) {
        throw new EligibleClaimPlanShapeError(
          `prohibited DispatchReadyShop scan examining ${rows} rows (cap ~${maxReady})`,
        );
      }
    }
  }

  if (bounds?.maxSharedHitBuffers != null) {
    const hits = parseSharedHitBuffers(planText);
    if (hits != null && hits > bounds.maxSharedHitBuffers) {
      throw new EligibleClaimPlanShapeError(
        `prohibited shared hit buffers ${hits} exceeding disposable bound ${bounds.maxSharedHitBuffers}`,
      );
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
  if (!READY_SHOP_INDEX.test(planText) && !/on "DispatchReadyShop"/i.test(planText)) {
    throw new EligibleClaimPlanShapeError(
      'expected DispatchReadyShop index access — must not Seq Scan Shop for discovery',
    );
  }
  // Global eligible_* + shopId Filter is the planner trap D-047 measured — reject it.
  if (
    /Index (?:Only )?Scan using "DurableJob_eligible_(?:pending|retry_wait)_idx"/i.test(
      planText,
    ) &&
    /Filter:\s*\("shopId"/i.test(planText)
  ) {
    throw new EligibleClaimPlanShapeError(
      "prohibited DurableJob_eligible_*_idx with shopId Filter — use shop-claim indexes",
    );
  }
  if (!/LockRows|FOR UPDATE/i.test(planText)) {
    throw new EligibleClaimPlanShapeError(
      "expected LockRows / FOR UPDATE SKIP LOCKED on the operational claim path",
    );
  }
}
