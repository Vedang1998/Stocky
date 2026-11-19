import { describe, expect, it } from "vitest";
import { issueText } from "./issues";

describe("issueText", () => {
  it("explains each issue", () => {
    expect(issueText({ kind: "no_barcode" })).toContain("No barcode or SKU");
    expect(issueText({ kind: "barcode_unprintable" })).toContain("printed as text");
    expect(issueText({ kind: "barcode_too_long" })).toContain("larger label");
  });

  it("names the fields that were left off in the merchant's words", () => {
    expect(issueText({ kind: "fields_left_off", fields: ["location", "compareAt"] })).toBe(
      "Left off to fit this label size: location, compare-at price.",
    );
  });
});
