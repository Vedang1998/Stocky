import { describe, expect, it } from "vitest";
import {
  batchCertifiesReceiptSuccess,
  observationCertifiesReceiptSuccess,
} from "./receipt-certification";

describe("receipt terminal-accepted allowlist (F-04)", () => {
  it("accepts applied and already_applied", () => {
    expect(
      observationCertifiesReceiptSuccess({
        outcome: "applied",
        reason: "first_insert_live",
      }),
    ).toBe(true);
    expect(
      observationCertifiesReceiptSuccess({
        outcome: "already_applied",
        reason: "already_applied",
      }),
    ).toBe(true);
  });

  it("accepts only explicit terminal no-op reasons", () => {
    expect(
      observationCertifiesReceiptSuccess({
        outcome: "noop",
        reason: "already_live",
      }),
    ).toBe(true);
    expect(
      observationCertifiesReceiptSuccess({
        outcome: "noop",
        reason: "absent_not_later",
      }),
    ).toBe(true);
    expect(
      observationCertifiesReceiptSuccess({ outcome: "noop", reason: "noop" }),
    ).toBe(false);
    expect(
      observationCertifiesReceiptSuccess({ outcome: "noop", reason: null }),
    ).toBe(false);
  });

  it("rejects blocked, incomplete, conflict, lease_invalid and money", () => {
    for (const outcome of [
      "blocked",
      "incomplete",
      "conflict",
      "lease_invalid",
      "rejected",
    ] as const) {
      expect(
        observationCertifiesReceiptSuccess({
          outcome,
          reason: outcome,
        }),
      ).toBe(false);
    }
  });

  it("does not certify a mixed batch", () => {
    expect(
      batchCertifiesReceiptSuccess([
        { outcome: "applied", reason: "first_insert_live" },
        { outcome: "incomplete", reason: "incomplete" },
      ]),
    ).toBe(false);
  });
});
