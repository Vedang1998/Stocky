import { describe, expect, it } from "vitest";
import { decideClockA, isWithinHistoryWindow } from "./clocks";

describe("PR6-C independent Clock A", () => {
  const older = new Date("2026-01-01T00:00:00.000Z");
  const equal = new Date("2026-02-01T00:00:00.000Z");
  const newer = new Date("2026-03-01T00:00:00.000Z");

  it("rejects older snapshots wholesale (T44)", () => {
    const decision = decideClockA({
      incomingUpdatedAt: older,
      storedUpdatedAt: equal,
    });
    expect(decision.reason).toBe("stale");
    expect(decision.applyParent).toBe(false);
    expect(decision.applyChildren).toBe(false);
  });

  it("reapplies equal timestamps for child repair (T45)", () => {
    const decision = decideClockA({
      incomingUpdatedAt: equal,
      storedUpdatedAt: new Date(equal.getTime()),
    });
    expect(decision.reason).toBe("equal_repair");
    expect(decision.applyParent).toBe(true);
    expect(decision.applyChildren).toBe(true);
  });

  it("applies newer snapshots", () => {
    const decision = decideClockA({
      incomingUpdatedAt: newer,
      storedUpdatedAt: equal,
    });
    expect(decision.reason).toBe("newer");
    expect(decision.applyParent).toBe(true);
    expect(decision.applyChildren).toBe(true);
  });

  it("does not treat agreement happenedAt as Clock A", () => {
    const happenedAt = newer;
    const clock = decideClockA({
      incomingUpdatedAt: older,
      storedUpdatedAt: equal,
    });
    expect(happenedAt.getTime()).toBeGreaterThan(equal.getTime());
    expect(clock.applyChildren).toBe(false);
  });

  it("treats the 60-day window as inclusive at the exact boundary", () => {
    const observedAt = new Date("2026-09-11T00:00:00.000Z");
    const exact = new Date("2026-07-13T00:00:00.000Z");
    expect(
      isWithinHistoryWindow({
        processedAt: exact,
        shopifyCreatedAt: null,
        observedAt,
        windowDays: 60,
        hasReadAllOrders: false,
      }),
    ).toBe(true);
    const justOutside = new Date("2026-07-12T23:59:59.000Z");
    expect(
      isWithinHistoryWindow({
        processedAt: justOutside,
        shopifyCreatedAt: null,
        observedAt,
        windowDays: 60,
        hasReadAllOrders: false,
      }),
    ).toBe(false);
  });

  it("makes the window predicate unconditional when read_all_orders is granted", () => {
    expect(
      isWithinHistoryWindow({
        processedAt: new Date("2019-01-01T00:00:00.000Z"),
        shopifyCreatedAt: null,
        observedAt: new Date("2026-09-11T00:00:00.000Z"),
        windowDays: 60,
        hasReadAllOrders: true,
      }),
    ).toBe(true);
  });
});
