import { describe, expect, it } from "vitest";
import {
  CanonicalLockCapacityInsufficientError,
  evaluateCanonicalLockCapacity,
  readPostgresLockCapacitySettings,
} from "./lock-capacity";

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
    expect(result.capacitySufficient).toBe(true);
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
    expect(result.capacitySufficient).toBe(true);
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

  it("never raises the requested batch when capacity is sufficient for one", () => {
    const tiny = evaluateCanonicalLockCapacity(
      {
        maxLocksPerTransaction: 2,
        maxConnections: 100,
        maxPreparedTransactions: 0,
      },
      { requestedCanonicalIdentitiesPerTransaction: 1 },
    );
    expect(tiny.effectiveCanonicalIdentitiesPerTransaction).toBe(1);
    expect(tiny.effectiveCanonicalIdentitiesPerTransaction).toBeLessThanOrEqual(
      tiny.requestedBatch,
    );
  });

  it("rejects configurations that cannot accommodate one identity (F-CLAUDE-PR5F1-05)", () => {
    expect(() =>
      evaluateCanonicalLockCapacity(
        {
          maxLocksPerTransaction: 1,
          maxConnections: 1,
          maxPreparedTransactions: 0,
        },
        { requestedCanonicalIdentitiesPerTransaction: 1 },
      ),
    ).toThrow(CanonicalLockCapacityInsufficientError);

    try {
      evaluateCanonicalLockCapacity({
        maxLocksPerTransaction: 1,
        maxConnections: 1,
        maxPreparedTransactions: 0,
      });
      throw new Error("expected insufficient capacity");
    } catch (error) {
      expect(error).toBeInstanceOf(CanonicalLockCapacityInsufficientError);
      const typed = error as CanonicalLockCapacityInsufficientError;
      expect(typed.conditionACap).toBe(0);
      expect(typed.conditionBCap).toBe(0);
      expect(typed.code).toBe("canonical_lock_capacity_insufficient");
    }
  });

  it("rejects invalid capacity inputs", () => {
    expect(() =>
      evaluateCanonicalLockCapacity({
        maxLocksPerTransaction: 0,
        maxConnections: 1,
        maxPreparedTransactions: 0,
      }),
    ).toThrow(/maxLocksPerTransaction/);
    expect(() =>
      evaluateCanonicalLockCapacity({
        maxLocksPerTransaction: 64,
        maxConnections: 0,
        maxPreparedTransactions: 0,
      }),
    ).toThrow(/maxConnections/);
    expect(() =>
      evaluateCanonicalLockCapacity(
        {
          maxLocksPerTransaction: 64,
          maxConnections: 100,
          maxPreparedTransactions: 0,
        },
        { requestedCanonicalIdentitiesPerTransaction: 0 },
      ),
    ).toThrow(/requestedCanonicalIdentitiesPerTransaction/);
    expect(() =>
      evaluateCanonicalLockCapacity(
        {
          maxLocksPerTransaction: 64,
          maxConnections: 100,
          maxPreparedTransactions: 0,
        },
        { configuredWorstCaseConcurrentCanonicalTransactions: 0 },
      ),
    ).toThrow(/configuredWorstCaseConcurrentCanonicalTransactions/);
  });

  it("rejects missing / non-numeric PostgreSQL settings (F-CLAUDE-PR5F1-09)", async () => {
    await expect(
      readPostgresLockCapacitySettings({
        query: async () => ({ rows: [] }),
      }),
    ).rejects.toThrow(/were not returned/);

    await expect(
      readPostgresLockCapacitySettings({
        query: async () => ({
          rows: [
            {
              max_locks_per_transaction: "64",
              max_connections: "not-a-number",
              max_prepared_transactions: "0",
            },
          ],
        }),
      }),
    ).rejects.toThrow(/not a numeric integer/);

    await expect(
      readPostgresLockCapacitySettings({
        query: async () => ({
          rows: [
            {
              max_locks_per_transaction: "",
              max_connections: "100",
              max_prepared_transactions: "0",
            },
          ],
        }),
      }),
    ).rejects.toThrow(/missing/);
  });
});
