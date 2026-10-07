import { describe, expect, it } from "vitest";
import {
  operatorInspectPrivacyRequest,
  operatorTokenAgrees,
} from "../operator-resolve.server";

describe("operator token compare (B0-06)", () => {
  it("equal tokens agree (positive)", () => {
    expect(operatorTokenAgrees("op-secret-value", "op-secret-value")).toBe(true);
  });

  it("unequal tokens of any length disagree (negative)", () => {
    expect(operatorTokenAgrees("op-secret-value", "x")).toBe(false);
    expect(operatorTokenAgrees("op-secret-value", "op-secret-value!")).toBe(
      false,
    );
  });

  it("HTTP inspect denies a wrong token before lookup (bypass)", async () => {
    const previous = process.env.STOCKY_PRIVACY_OPERATOR_TOKEN;
    process.env.STOCKY_PRIVACY_OPERATOR_TOKEN = "expected-operator-token";
    try {
      await expect(
        operatorInspectPrivacyRequest({
          requestId: "does-not-matter",
          operatorToken: "wrong",
        }),
      ).rejects.toMatchObject({ code: "operator_denied" });
    } finally {
      if (previous === undefined) {
        delete process.env.STOCKY_PRIVACY_OPERATOR_TOKEN;
      } else {
        process.env.STOCKY_PRIVACY_OPERATOR_TOKEN = previous;
      }
    }
  });
});
