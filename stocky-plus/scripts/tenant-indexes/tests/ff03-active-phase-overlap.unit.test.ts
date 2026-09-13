import { describe, expect, it } from "vitest";
import {
  builderStillCreatingConcurrentIndex,
  hasShareUpdateExclusiveWithoutAccessExclusive,
  isActiveScanSample,
  type Ff03ProgressSample,
} from "./ff03-active-phase-overlap";

const TARGET = "building index: scanning table";

function sample(
  overrides: Partial<Ff03ProgressSample> = {},
): Ff03ProgressSample {
  return {
    sampledAtNs: 1n,
    phase: TARGET,
    relid: "1",
    schema: "public",
    tuplesDone: 0,
    tuplesTotal: 0,
    blocksDone: 10,
    blocksTotal: 100,
    lockModes: ["ShareUpdateExclusiveLock"],
    builderState: "active",
    builderQuery: `CREATE INDEX CONCURRENTLY "Supplier_shopId_idx" ON "Supplier" ("shopId")`,
    ...overrides,
  };
}

describe("F-F03 active-scan overlap helper", () => {
  it("accepts an in-progress scan with remaining blocks and SHARE UPDATE EXCLUSIVE", () => {
    expect(isActiveScanSample(sample(), TARGET)).toBe(true);
    expect(hasShareUpdateExclusiveWithoutAccessExclusive(sample())).toBe(true);
    expect(builderStillCreatingConcurrentIndex(sample())).toBe(true);
  });

  it("rejects a completed scan that still carries the phase text", () => {
    expect(
      isActiveScanSample(
        sample({ blocksDone: 100, blocksTotal: 100 }),
        TARGET,
      ),
    ).toBe(false);
  });

  it("rejects waiting-for-writers / old-snapshot samples as active scan coverage", () => {
    expect(
      isActiveScanSample(
        sample({ phase: "waiting for writers before build" }),
        TARGET,
      ),
    ).toBe(false);
    expect(
      isActiveScanSample(
        sample({ phase: "waiting for old snapshots" }),
        TARGET,
      ),
    ).toBe(false);
  });

  it("rejects empty locks and AccessExclusiveLock (R-051/R-052 bypass)", () => {
    expect(
      isActiveScanSample(sample({ lockModes: [] }), TARGET),
    ).toBe(false);
    expect(
      isActiveScanSample(
        sample({
          lockModes: ["ShareUpdateExclusiveLock", "AccessExclusiveLock"],
        }),
        TARGET,
      ),
    ).toBe(false);
    expect(
      hasShareUpdateExclusiveWithoutAccessExclusive(
        sample({ lockModes: [] }),
      ),
    ).toBe(false);
  });

  it("rejects a builder that is no longer running CREATE INDEX CONCURRENTLY", () => {
    expect(
      isActiveScanSample(
        sample({ builderQuery: "SELECT 1" }),
        TARGET,
      ),
    ).toBe(false);
    expect(builderStillCreatingConcurrentIndex(sample({ builderQuery: "SELECT 1" }))).toBe(
      false,
    );
  });

  it("rejects a late scan sample with almost no remaining work", () => {
    expect(
      isActiveScanSample(
        sample({ blocksDone: 5300, blocksTotal: 5324 }),
        TARGET,
      ),
    ).toBe(false);
  });

  it("rejects phase-text-only samples with no remaining-work counters", () => {
    expect(
      isActiveScanSample(
        sample({
          tuplesDone: null,
          tuplesTotal: null,
          blocksDone: null,
          blocksTotal: null,
        }),
        TARGET,
      ),
    ).toBe(false);
    expect(
      isActiveScanSample(
        sample({ tuplesDone: 0, tuplesTotal: 0, blocksDone: 0, blocksTotal: 0 }),
        TARGET,
      ),
    ).toBe(false);
  });
});
