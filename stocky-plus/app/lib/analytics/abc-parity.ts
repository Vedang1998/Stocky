/**
 * Stocky-parity ABC/U classification (PRD §3.5).
 *
 * - Variant level, over the last eight weeks (56 shop-local days).
 * - Ranked by net revenue, descending; ties broken by net units (descending)
 *   and then variant GID, so a run is fully deterministic.
 * - A: variants that cumulatively drive the first 80% of revenue.
 *   B: the next 15%. C: the remainder, including variants with no revenue.
 * - The variant that crosses a boundary stays in the earlier class.
 * - U: less than eight weeks of eligible data, either because the shop's
 *   stored order history starts inside the window or because the variant was
 *   created inside it (or its creation date is unknown). U variants take no
 *   share of the revenue total.
 *
 * Shares are computed with Decimal arithmetic on positive revenue only; a
 * variant whose net revenue is zero or negative contributes nothing and is C.
 */
import { ZERO, type Decimal } from "./money";
import { addLocalDays, type LocalDate } from "./shop-calendar";

export const ABC_PARITY_METHOD = "stocky-abc-parity-v1";
export const ABC_WINDOW_DAYS = 56;
export const ABC_A_CUMULATIVE_PERCENT = 80;
export const ABC_B_CUMULATIVE_PERCENT = 95;

export type AbcClass = "A" | "B" | "C" | "U";

export type AbcUnclassifiedReason =
  | "shop_history_short"
  | "variant_too_new"
  | "variant_age_unknown";

export type AbcCandidate = {
  variantGid: string;
  /** Shop-local date the variant was created in Shopify. */
  createdLocalDate: LocalDate | null;
  /** Net revenue inside the window, shop currency. */
  revenue: Decimal;
  netUnits: number;
};

export type AbcRow = {
  variantGid: string;
  abcClass: AbcClass;
  /** 1-based position among classified (A/B/C) variants; null for U. */
  rank: number | null;
  revenue: Decimal;
  netUnits: number;
  /** Fraction of classified revenue (0–1); null for U or a zero total. */
  revenueShare: Decimal | null;
  /** Cumulative fraction after this variant (0–1); null for U or a zero total. */
  cumulativeShare: Decimal | null;
  unclassifiedReason: AbcUnclassifiedReason | null;
};

export type AbcClassCounts = Record<AbcClass, number>;

export type AbcClassification = {
  method: typeof ABC_PARITY_METHOD;
  windowStartLocalDate: LocalDate;
  windowEndLocalDate: LocalDate;
  /** Positive revenue of classified variants: the denominator of every share. */
  classifiedRevenue: Decimal;
  counts: AbcClassCounts;
  revenueByClass: Record<AbcClass, Decimal>;
  /** Classified variants first in rank order, then U variants by GID. */
  rows: AbcRow[];
};

export function abcWindowFor(asOfLocalDate: LocalDate): {
  windowStartLocalDate: LocalDate;
  windowEndLocalDate: LocalDate;
} {
  return {
    windowStartLocalDate: addLocalDays(asOfLocalDate, -(ABC_WINDOW_DAYS - 1)),
    windowEndLocalDate: asOfLocalDate,
  };
}

function compareCandidates(a: AbcCandidate, b: AbcCandidate): number {
  const byRevenue = b.revenue.comparedTo(a.revenue);
  if (byRevenue !== 0) return byRevenue;
  if (a.netUnits !== b.netUnits) return b.netUnits - a.netUnits;
  return a.variantGid < b.variantGid ? -1 : a.variantGid > b.variantGid ? 1 : 0;
}

function unclassifiedReason(
  candidate: AbcCandidate,
  windowStartLocalDate: LocalDate,
  shopHistoryShort: boolean,
): AbcUnclassifiedReason | null {
  if (shopHistoryShort) return "shop_history_short";
  if (candidate.createdLocalDate == null) return "variant_age_unknown";
  if (candidate.createdLocalDate > windowStartLocalDate) return "variant_too_new";
  return null;
}

export function classifyAbcParity(input: {
  candidates: readonly AbcCandidate[];
  asOfLocalDate: LocalDate;
  /** First shop-local date with stored order history; null when none. */
  historyStartLocalDate: LocalDate | null;
}): AbcClassification {
  const { windowStartLocalDate, windowEndLocalDate } = abcWindowFor(
    input.asOfLocalDate,
  );
  const shopHistoryShort =
    input.historyStartLocalDate == null ||
    input.historyStartLocalDate > windowStartLocalDate;

  const seen = new Set<string>();
  const eligible: AbcCandidate[] = [];
  const unclassified: AbcRow[] = [];
  for (const candidate of input.candidates) {
    if (seen.has(candidate.variantGid)) {
      throw new Error(`Duplicate ABC candidate ${candidate.variantGid}`);
    }
    seen.add(candidate.variantGid);
    const reason = unclassifiedReason(
      candidate,
      windowStartLocalDate,
      shopHistoryShort,
    );
    if (reason) {
      unclassified.push({
        variantGid: candidate.variantGid,
        abcClass: "U",
        rank: null,
        revenue: candidate.revenue,
        netUnits: candidate.netUnits,
        revenueShare: null,
        cumulativeShare: null,
        unclassifiedReason: reason,
      });
    } else {
      eligible.push(candidate);
    }
  }

  eligible.sort(compareCandidates);
  const classifiedRevenue = eligible.reduce(
    (sum, c) => (c.revenue.greaterThan(0) ? sum.plus(c.revenue) : sum),
    ZERO,
  );
  const aLimit = classifiedRevenue.times(ABC_A_CUMULATIVE_PERCENT);
  const bLimit = classifiedRevenue.times(ABC_B_CUMULATIVE_PERCENT);

  const counts: AbcClassCounts = { A: 0, B: 0, C: 0, U: unclassified.length };
  const revenueByClass: Record<AbcClass, Decimal> = {
    A: ZERO,
    B: ZERO,
    C: ZERO,
    U: unclassified.reduce((sum, row) => sum.plus(row.revenue), ZERO),
  };

  let cumulative = ZERO;
  const classified: AbcRow[] = eligible.map((candidate, index) => {
    const contribution = candidate.revenue.greaterThan(0) ? candidate.revenue : ZERO;
    // Class is decided by the share *before* this variant, which keeps the
    // boundary-crossing variant in the earlier class.
    const before = cumulative.times(100);
    let abcClass: AbcClass;
    if (contribution.greaterThan(0) && before.lessThan(aLimit)) abcClass = "A";
    else if (contribution.greaterThan(0) && before.lessThan(bLimit)) abcClass = "B";
    else abcClass = "C";
    cumulative = cumulative.plus(contribution);
    counts[abcClass] += 1;
    revenueByClass[abcClass] = revenueByClass[abcClass].plus(candidate.revenue);
    const hasTotal = classifiedRevenue.greaterThan(0);
    return {
      variantGid: candidate.variantGid,
      abcClass,
      rank: index + 1,
      revenue: candidate.revenue,
      netUnits: candidate.netUnits,
      revenueShare: hasTotal ? contribution.dividedBy(classifiedRevenue) : null,
      cumulativeShare: hasTotal ? cumulative.dividedBy(classifiedRevenue) : null,
      unclassifiedReason: null,
    };
  });

  unclassified.sort((a, b) =>
    a.variantGid < b.variantGid ? -1 : a.variantGid > b.variantGid ? 1 : 0,
  );

  return {
    method: ABC_PARITY_METHOD,
    windowStartLocalDate,
    windowEndLocalDate,
    classifiedRevenue,
    counts,
    revenueByClass,
    rows: [...classified, ...unclassified],
  };
}
