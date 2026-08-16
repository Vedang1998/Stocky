import { describe, expect, it } from "vitest";
import { evaluateCanonicalLockCapacity } from "./lock-capacity";

describe("PR5 canonical lock capacity evaluator", () => {
  it("mlpt=64 / 100 / 0 requested 32 is accepted by condition A and stays 32", () => {
    const result = evaluateCanonicalLockCapacity(
      {
        maxLocksPerTransaction: 64,
        maxConnections: 100,
        maxPreparedTransactions: 0,
      },
      { requestedCanonicalIdentitiesPerTransaction: 32 },
    );
    expect(result.requestedAcceptedByConditionA).toBe(true);
    expect(result.requestedAcceptedByConditionB).toBe(true);
    expect(result.reduced).toBe(false);
    expect(result.effectiveCanonicalIdentitiesPerTransaction).toBe(32);
    expect(result.sharedLockObjectBudget).toBe(6400);
  });

  it("mlpt=63 / 100 / 0 requested 32 reduces below 32 (F-CLAUDE-PR5IE-03)", () => {
    const result = evaluateCanonicalLockCapacity(
      {
        maxLocksPerTransaction: 63,
        maxConnections: 100,
        maxPreparedTransactions: 0,
      },
      { requestedCanonicalIdentitiesPerTransaction: 32 },
    );
    expect(result.conditionACap).toBe(31);
    expect(result.requestedAcceptedByConditionA).toBe(false);
    expect(result.reduced).toBe(true);
    expect(result.effectiveCanonicalIdentitiesPerTransaction).toBe(31);
    expect(result.effectiveCanonicalIdentitiesPerTransaction).toBeLessThan(32);
  });

  it("implementation-entry examples 32/100/0, 16/100/0, 64/5/0", () => {
    const reduce32 = evaluateCanonicalLockCapacity(
      {
        maxLocksPerTransaction: 32,
        maxConnections: 100,
        maxPreparedTransactions: 0,
      },
      { requestedCanonicalIdentitiesPerTransaction: 32 },
    );
    expect(reduce32.effectiveCanonicalIdentitiesPerTransaction).toBe(16);

    const reduce16 = evaluateCanonicalLockCapacity(
      {
        maxLocksPerTransaction: 16,
        maxConnections: 100,
        maxPreparedTransactions: 0,
      },
      { requestedCanonicalIdentitiesPerTransaction: 32 },
    );
    expect(reduce16.effectiveCanonicalIdentitiesPerTransaction).toBe(8);

    const reduce64x5 = evaluateCanonicalLockCapacity(
      {
        maxLocksPerTransaction: 64,
        maxConnections: 5,
        maxPreparedTransactions: 0,
      },
      { requestedCanonicalIdentitiesPerTransaction: 32 },
    );
    expect(reduce64x5.sharedLockObjectBudget).toBe(320);
    expect(reduce64x5.conditionBCap).toBe(20);
    expect(reduce64x5.effectiveCanonicalIdentitiesPerTransaction).toBe(20);
  });

  it("never raises the requested batch and never reduces below one", () => {
    const tiny = evaluateCanonicalLockCapacity(
      {
        maxLocksPerTransaction: 1,
        maxConnections: 1,
        maxPreparedTransactions: 0,
      },
      { requestedCanonicalIdentitiesPerTransaction: 1 },
    );
    expect(tiny.effectiveCanonicalIdentitiesPerTransaction).toBe(1);
    expect(tiny.effectiveCanonicalIdentitiesPerTransaction).toBeLessThanOrEqual(
      tiny.requestedBatch,
    );
  });
});
