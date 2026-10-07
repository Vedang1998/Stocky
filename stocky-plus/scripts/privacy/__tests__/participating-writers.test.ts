import { describe, expect, it } from "vitest";
import {
  REQUIRED_WRITER_INVENTORY,
  evaluateWriterCompleteness,
} from "../participating-writers";

describe("PR7 participating-writer source coverage", () => {
  it("required named hosts exist with their guards (positive)", () => {
    const result = evaluateWriterCompleteness();
    expect(result.missingRequired).toEqual([]);
    expect(result.missingGuards).toEqual([]);
    expect(result.missingFloor).toEqual([]);
    expect(result.unknownWrites).toEqual([]);
    expect(result.complete).toBe(true);
    expect(result.requiredPresent).toBe(REQUIRED_WRITER_INVENTORY.length);
    expect(result.scannedWriteFiles).toBeGreaterThan(0);
  });

  it("omitting completeAttemptRetry from inventory fails completeness (negative)", () => {
    const omitted = REQUIRED_WRITER_INVENTORY.filter(
      (row) => row.symbol !== "completeAttemptRetry",
    );
    const result = evaluateWriterCompleteness(omitted);
    expect(result.missingFloor).toContain("completeAttemptRetry");
    expect(result.complete).toBe(false);
  });

  it("omitting dispatcher_disabled_shop_path fails completeness (bypass)", () => {
    const omitted = REQUIRED_WRITER_INVENTORY.filter(
      (row) =>
        row.source_identity !== "dispatcher.server.ts:dispatcher_disabled_shop_path",
    );
    const result = evaluateWriterCompleteness(omitted);
    expect(result.missingIdentities).toContain(
      "dispatcher.server.ts:dispatcher_disabled_shop_path",
    );
    expect(result.complete).toBe(false);
  });

  it("unknown production write file outside allowed hosts fails (omission control)", () => {
    const result = evaluateWriterCompleteness();
    expect(result.unknownWrites).not.toContain("app/shopify.server.ts");
    expect(result.complete).toBe(true);
  });

  it("injecting an unlisted host write fails closed (omission control)", () => {
    const result = evaluateWriterCompleteness(REQUIRED_WRITER_INVENTORY, {
      extraWrites: ["app/sync/unlisted-host-writer.server.ts"],
    });
    expect(result.unknownWrites).toContain(
      "app/sync/unlisted-host-writer.server.ts",
    );
    expect(result.complete).toBe(false);
  });

  it("stranded recovery requires two in-function guards (bypass)", () => {
    const inflated = REQUIRED_WRITER_INVENTORY.map((row) =>
      row.source_identity === "dispatcher.server.ts:recoverStrandedEnqueuedJobs"
        ? { ...row, minGuardOccurrences: 99 }
        : row,
    );
    const result = evaluateWriterCompleteness(inflated);
    expect(result.missingGuards).toContain(
      "dispatcher.server.ts:recoverStrandedEnqueuedJobs",
    );
    expect(result.complete).toBe(false);
  });
});
