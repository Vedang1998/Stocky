import { describe, expect, it } from "vitest";
import {
  CAPABILITY_KEYS,
  CORE_CAPABILITIES,
  ENTERPRISE_PLAN,
  SELF_SERVE_PLANS,
  annualSavingsCents,
  findSelfServePlan,
  type LimitKey,
} from "./plans";

/** §6 of docs/product/11_PRICING_AND_PACKAGING_STRATEGY.md. */
const APPROVED_CAPABILITY_KEYS = [
  "core.replenishment",
  "core.purchase_orders",
  "core.receiving",
  "core.stocktakes",
  "core.transfers",
  "pos.receiving",
  "cost.landed",
  "workflow.approvals",
  "automation.flow",
  "forecast.smart",
  "analytics.natural_language",
  "integration.accounting",
  "platform.api_access",
];

const LIMIT_KEYS: LimitKey[] = [
  "locations",
  "activeVariants",
  "users",
  "monthlyPurchaseOrders",
];

const ALL_PLANS = [...SELF_SERVE_PLANS, ENTERPRISE_PLAN];

const asCeiling = (limit: number | null) => limit ?? Number.POSITIVE_INFINITY;

describe("plan catalog", () => {
  it("defines exactly the approved capability keys, each once", () => {
    expect(new Set(CAPABILITY_KEYS).size).toBe(CAPABILITY_KEYS.length);
    expect([...CAPABILITY_KEYS].sort()).toEqual(
      [...APPROVED_CAPABILITY_KEYS].sort(),
    );
  });

  it("grants only approved keys, without duplicates", () => {
    for (const plan of ALL_PLANS) {
      expect(new Set(plan.capabilities).size).toBe(plan.capabilities.length);
      for (const key of plan.capabilities) {
        expect(APPROVED_CAPABILITY_KEYS).toContain(key);
      }
    }
  });

  it("includes every core capability in every paid plan", () => {
    expect([...CORE_CAPABILITIES]).toEqual(
      APPROVED_CAPABILITY_KEYS.filter((key) => key.startsWith("core.")),
    );
    for (const plan of ALL_PLANS) {
      for (const key of CORE_CAPABILITIES) {
        expect(plan.capabilities, plan.handle).toContain(key);
      }
    }
  });

  it("lists self-serve plans from Essentials to Pro with unique names", () => {
    expect(SELF_SERVE_PLANS.map((plan) => plan.handle)).toEqual([
      "essentials",
      "growth",
      "pro",
    ]);
    const names = ALL_PLANS.map((plan) => plan.displayName.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it("never lowers a limit, allowance or capability on a higher plan", () => {
    for (let i = 1; i < SELF_SERVE_PLANS.length; i++) {
      const lower = SELF_SERVE_PLANS[i - 1]!;
      const higher = SELF_SERVE_PLANS[i]!;
      for (const key of LIMIT_KEYS) {
        expect(
          asCeiling(higher.limits[key]),
          `${higher.handle}.${key}`,
        ).toBeGreaterThanOrEqual(asCeiling(lower.limits[key]));
      }
      expect(higher.aiCreditsPerMonth).toBeGreaterThanOrEqual(
        lower.aiCreditsPerMonth,
      );
      expect(higher.reportingHistoryMonths).toBeGreaterThanOrEqual(
        lower.reportingHistoryMonths,
      );
      expect(higher.monthlyPriceCents).toBeGreaterThan(lower.monthlyPriceCents);
      for (const key of lower.capabilities) {
        expect(higher.capabilities).toContain(key);
      }
    }
  });

  it("gives every self-serve plan a finite AI credit ceiling", () => {
    for (const plan of SELF_SERVE_PLANS) {
      expect(Number.isSafeInteger(plan.aiCreditsPerMonth), plan.handle).toBe(
        true,
      );
      expect(plan.aiCreditsPerMonth).toBeGreaterThan(0);
    }
  });

  it("caps locations and variants on every self-serve plan", () => {
    for (const plan of SELF_SERVE_PLANS) {
      expect(plan.limits.locations, plan.handle).not.toBeNull();
      expect(plan.limits.activeVariants, plan.handle).not.toBeNull();
    }
  });

  it("recommends Growth and only Growth", () => {
    expect(
      SELF_SERVE_PLANS.filter((plan) => plan.recommended).map(
        (plan) => plan.handle,
      ),
    ).toEqual(["growth"]);
  });

  it("prices annual billing below twelve monthly payments", () => {
    for (const plan of SELF_SERVE_PLANS) {
      expect(annualSavingsCents(plan), plan.handle).toBeGreaterThan(0);
    }
  });

  it("reserves API access for the contract plan", () => {
    expect(ENTERPRISE_PLAN.capabilities).toContain("platform.api_access");
    for (const plan of SELF_SERVE_PLANS) {
      expect(plan.capabilities).not.toContain("platform.api_access");
    }
  });
});

describe("findSelfServePlan", () => {
  it("matches handles and display names case-insensitively", () => {
    expect(findSelfServePlan("growth")?.handle).toBe("growth");
    expect(findSelfServePlan("Growth")?.handle).toBe("growth");
    expect(findSelfServePlan("  GROWTH ")?.handle).toBe("growth");
    expect(findSelfServePlan("Essentials")?.handle).toBe("essentials");
    expect(findSelfServePlan("PRO")?.handle).toBe("pro");
  });

  it("does not match partial, unknown or empty identifiers", () => {
    expect(findSelfServePlan("Growth Plus")).toBeNull();
    expect(findSelfServePlan("grow")).toBeNull();
    expect(findSelfServePlan("dev")).toBeNull();
    expect(findSelfServePlan("   ")).toBeNull();
    expect(findSelfServePlan("")).toBeNull();
    expect(findSelfServePlan(null)).toBeNull();
    expect(findSelfServePlan(undefined)).toBeNull();
  });

  it("never resolves the contract plan", () => {
    expect(findSelfServePlan(ENTERPRISE_PLAN.handle)).toBeNull();
    expect(findSelfServePlan(ENTERPRISE_PLAN.displayName)).toBeNull();
  });
});
