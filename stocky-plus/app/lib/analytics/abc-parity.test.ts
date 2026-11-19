import { describe, expect, it } from "vitest";
import { ABC_WINDOW_DAYS, abcWindowFor, classifyAbcParity, type AbcCandidate } from "./abc-parity";
import { Decimal } from "./money";
import { diffLocalDays } from "./shop-calendar";

const AS_OF = "2026-11-09";
const OLD = "2025-01-01";

function candidate(
  variant: string,
  revenue: string,
  netUnits = 1,
  createdLocalDate: string | null = OLD,
): AbcCandidate {
  return {
    variantGid: `gid://shopify/ProductVariant/${variant}`,
    createdLocalDate,
    revenue: new Decimal(revenue),
    netUnits,
  };
}

function classes(result: ReturnType<typeof classifyAbcParity>) {
  return result.rows.map((row) => [row.variantGid.split("/").pop(), row.abcClass]);
}

describe("abcWindowFor", () => {
  it("covers the last eight weeks ending on the as-of date", () => {
    const window = abcWindowFor(AS_OF);
    expect(window).toEqual({
      windowStartLocalDate: "2026-09-15",
      windowEndLocalDate: AS_OF,
    });
    expect(diffLocalDays(window.windowStartLocalDate, window.windowEndLocalDate) + 1).toBe(
      ABC_WINDOW_DAYS,
    );
  });
});

describe("classifyAbcParity", () => {
  it("assigns 80/15/5 with the boundary-crossing variant kept in the earlier class", () => {
    const result = classifyAbcParity({
      asOfLocalDate: AS_OF,
      historyStartLocalDate: OLD,
      candidates: [
        candidate("5", "5"),
        candidate("1", "50"),
        candidate("3", "10"),
        candidate("2", "30"),
        candidate("4", "5", 2),
      ],
    });
    expect(classes(result)).toEqual([
      ["1", "A"],
      ["2", "A"],
      ["3", "B"],
      ["4", "B"],
      ["5", "C"],
    ]);
    expect(result.counts).toEqual({ A: 2, B: 2, C: 1, U: 0 });
    expect(result.classifiedRevenue.toString()).toBe("100");
    expect(result.rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(result.rows[1].cumulativeShare?.toString()).toBe("0.8");
    expect(result.rows[4].cumulativeShare?.toString()).toBe("1");
  });

  it("keeps a single dominant variant in A even when it alone exceeds 80%", () => {
    const result = classifyAbcParity({
      asOfLocalDate: AS_OF,
      historyStartLocalDate: OLD,
      candidates: [candidate("1", "97"), candidate("2", "2"), candidate("3", "1")],
    });
    expect(classes(result)).toEqual([
      ["1", "A"],
      ["2", "C"],
      ["3", "C"],
    ]);
  });

  it("breaks revenue ties by units, then by variant GID", () => {
    const result = classifyAbcParity({
      asOfLocalDate: AS_OF,
      historyStartLocalDate: OLD,
      candidates: [candidate("b", "10", 1), candidate("a", "10", 1), candidate("c", "10", 5)],
    });
    expect(result.rows.map((r) => r.variantGid.split("/").pop())).toEqual(["c", "a", "b"]);
  });

  it("puts zero and negative revenue in C without consuming share", () => {
    const result = classifyAbcParity({
      asOfLocalDate: AS_OF,
      historyStartLocalDate: OLD,
      candidates: [candidate("1", "100"), candidate("2", "0", 0), candidate("3", "-20", -2)],
    });
    expect(classes(result)).toEqual([
      ["1", "A"],
      ["2", "C"],
      ["3", "C"],
    ]);
    expect(result.classifiedRevenue.toString()).toBe("100");
    expect(result.rows[2].revenueShare?.toString()).toBe("0");
  });

  it("classifies everything C when no variant has revenue", () => {
    const result = classifyAbcParity({
      asOfLocalDate: AS_OF,
      historyStartLocalDate: OLD,
      candidates: [candidate("1", "0", 0), candidate("2", "0", 0)],
    });
    expect(result.counts).toEqual({ A: 0, B: 0, C: 2, U: 0 });
    expect(result.rows[0].revenueShare).toBeNull();
  });

  it("marks variants created inside the window, or with unknown age, as U", () => {
    const result = classifyAbcParity({
      asOfLocalDate: AS_OF,
      historyStartLocalDate: OLD,
      candidates: [
        candidate("old", "10"),
        candidate("edge", "10", 1, "2026-09-15"),
        candidate("new", "500", 5, "2026-09-16"),
        candidate("unknown", "10", 1, null),
      ],
    });
    const byId = Object.fromEntries(
      result.rows.map((r) => [r.variantGid.split("/").pop(), r]),
    );
    expect(byId.old.abcClass).toBe("A");
    expect(byId.edge.abcClass).not.toBe("U");
    expect(byId.new).toMatchObject({ abcClass: "U", rank: null, unclassifiedReason: "variant_too_new" });
    expect(byId.unknown).toMatchObject({ abcClass: "U", unclassifiedReason: "variant_age_unknown" });
    // U revenue never enters the classified total.
    expect(result.classifiedRevenue.toString()).toBe("20");
    expect(result.revenueByClass.U.toString()).toBe("510");
  });

  it("marks every variant U when stored history starts inside the window", () => {
    for (const historyStartLocalDate of ["2026-09-16", null]) {
      const result = classifyAbcParity({
        asOfLocalDate: AS_OF,
        historyStartLocalDate,
        candidates: [candidate("1", "10"), candidate("2", "5")],
      });
      expect(result.counts).toEqual({ A: 0, B: 0, C: 0, U: 2 });
      expect(result.rows.every((r) => r.unclassifiedReason === "shop_history_short")).toBe(true);
    }
  });

  it("rejects duplicate candidates", () => {
    expect(() =>
      classifyAbcParity({
        asOfLocalDate: AS_OF,
        historyStartLocalDate: OLD,
        candidates: [candidate("1", "10"), candidate("1", "5")],
      }),
    ).toThrowError(/Duplicate/);
  });

  it("is independent of candidate input order", () => {
    const candidates = Array.from({ length: 40 }, (_, i) =>
      candidate(String(i).padStart(2, "0"), String((i * 37) % 23), i % 4),
    );
    const forward = classifyAbcParity({ asOfLocalDate: AS_OF, historyStartLocalDate: OLD, candidates });
    const reversed = classifyAbcParity({
      asOfLocalDate: AS_OF,
      historyStartLocalDate: OLD,
      candidates: [...candidates].reverse(),
    });
    expect(classes(reversed)).toEqual(classes(forward));
  });
});
