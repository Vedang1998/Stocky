/**
 * Merchant error classification unit coverage (F-PR3C-08 residual).
 */
import { describe, expect, it } from "vitest";
import {
  assertMerchantErrorSummary,
  classifyMerchantError,
  isExpectedMerchantError,
  summarizeMerchantErrors,
} from "../merchant-error";

describe("merchant error classification", () => {
  it("classifies 42501 as the only expected revocation-window denial", () => {
    expect(classifyMerchantError({ code: "42501" })).toEqual({
      sqlstate: "42501",
      errorClass: "42501",
    });
    expect(
      isExpectedMerchantError({
        errorClass: "42501",
        phase: "during_apply",
        dmlExpectedRevoked: true,
      }),
    ).toBe(true);
    expect(
      isExpectedMerchantError({
        errorClass: "other",
        phase: "during_apply",
        dmlExpectedRevoked: true,
      }),
    ).toBe(false);
    expect(
      isExpectedMerchantError({
        errorClass: "42501",
        phase: "post_apply",
        dmlExpectedRevoked: false,
      }),
    ).toBe(false);
  });

  it("fails assertions on unexpected SQLSTATE or missing pre/post success", () => {
    const bad = summarizeMerchantErrors({
      samples: 10,
      successes: 8,
      beforeWindowSuccess: 3,
      afterWindowSuccess: 3,
      errors: [
        {
          operation: "SELECT",
          sqlstate: "42P01",
          errorClass: "other",
          phase: "during_apply",
          dmlExpectedRevoked: true,
          expected: false,
          relativeMs: 1,
        },
      ],
    });
    expect(bad.unexpectedErrors).toBe(1);
    expect(() => assertMerchantErrorSummary(bad)).toThrow(
      /unexpected_errors/,
    );

    const noPost = summarizeMerchantErrors({
      samples: 4,
      successes: 2,
      beforeWindowSuccess: 2,
      afterWindowSuccess: 0,
      errors: [
        {
          operation: "SELECT",
          sqlstate: "42501",
          errorClass: "42501",
          phase: "during_apply",
          dmlExpectedRevoked: true,
          expected: true,
          relativeMs: 1,
        },
      ],
    });
    expect(() => assertMerchantErrorSummary(noPost)).toThrow(
      /no_successful_traffic_after_apply/,
    );
  });

  it("accepts a clean pre/during/post profile", () => {
    const summary = summarizeMerchantErrors({
      samples: 12,
      successes: 10,
      beforeWindowSuccess: 4,
      afterWindowSuccess: 6,
      errors: [
        {
          operation: "INSERT",
          sqlstate: "42501",
          errorClass: "42501",
          phase: "during_apply",
          dmlExpectedRevoked: true,
          expected: true,
          relativeMs: 5,
        },
        {
          operation: "UPDATE",
          sqlstate: "42501",
          errorClass: "42501",
          phase: "during_apply",
          dmlExpectedRevoked: true,
          expected: true,
          relativeMs: 6,
        },
      ],
    });
    expect(summary.duringWindowExpectedDenial).toBe(2);
    expect(summary.unexpectedErrors).toBe(0);
    expect(() => assertMerchantErrorSummary(summary)).not.toThrow();
  });
});
