import { describe, expect, it } from "vitest";
import { PosApiError } from "./pos-api.server";
import { parseReceiptBody } from "./receiving-body";

const KEY = "11111111-2222-3333-4444-555555555555";
const line = { lineItemId: "line-1", acceptedQty: 3 };

function failure(body: unknown): PosApiError {
  try {
    parseReceiptBody(body, "po-1");
  } catch (error) {
    expect(error).toBeInstanceOf(PosApiError);
    expect((error as PosApiError).status).toBe(400);
    return error as PosApiError;
  }
  throw new Error("expected the body to be refused");
}

describe("parseReceiptBody", () => {
  it("accepts a receipt and trims the optional text", () => {
    expect(
      parseReceiptBody(
        {
          idempotencyKey: KEY,
          lines: [{ ...line, rejectedQty: 1, rejectReason: "  Crushed  " }],
          supplierReference: " PS-9 ",
          note: "  ",
          allowOverReceipt: true,
        },
        "po-1",
      ),
    ).toEqual({
      purchaseOrderId: "po-1",
      idempotencyKey: KEY,
      lines: [{ lineItemId: "line-1", acceptedQty: 3, rejectedQty: 1, rejectReason: "Crushed" }],
      supplierReference: "PS-9",
      note: null,
      allowOverReceipt: true,
    });
  });

  it("drops lines with nothing to receive or reject", () => {
    const parsed = parseReceiptBody(
      { idempotencyKey: KEY, lines: [line, { lineItemId: "line-2", acceptedQty: 0 }] },
      "po-1",
    );
    expect(parsed.lines.map((entry) => entry.lineItemId)).toEqual(["line-1"]);
    expect(parsed.allowOverReceipt).toBe(false);
  });

  it.each([
    ["not an object", null],
    ["an array", []],
    ["a missing key", { lines: [line] }],
    ["a short key", { idempotencyKey: "abc", lines: [line] }],
    ["a key with spaces", { idempotencyKey: "has spaces in it", lines: [line] }],
    ["lines that are not a list", { idempotencyKey: KEY, lines: "x" }],
    ["no units at all", { idempotencyKey: KEY, lines: [{ lineItemId: "l", acceptedQty: 0 }] }],
    ["an empty list", { idempotencyKey: KEY, lines: [] }],
    ["a line that is not an object", { idempotencyKey: KEY, lines: ["x"] }],
    ["a line with no id", { idempotencyKey: KEY, lines: [{ acceptedQty: 1 }] }],
    ["a repeated line", { idempotencyKey: KEY, lines: [line, line] }],
    ["a fractional quantity", { idempotencyKey: KEY, lines: [{ ...line, acceptedQty: 1.5 }] }],
    ["a negative quantity", { idempotencyKey: KEY, lines: [{ ...line, acceptedQty: -1 }] }],
    ["a text quantity", { idempotencyKey: KEY, lines: [{ ...line, acceptedQty: "3" }] }],
    ["an enormous quantity", { idempotencyKey: KEY, lines: [{ ...line, acceptedQty: 1_000_001 }] }],
    ["a long reason", { idempotencyKey: KEY, lines: [{ ...line, rejectReason: "x".repeat(256) }] }],
    ["a long packing slip", { idempotencyKey: KEY, lines: [line], supplierReference: "x".repeat(129) }],
    ["a numeric note", { idempotencyKey: KEY, lines: [line], note: 5 }],
    ["a text over-receipt flag", { idempotencyKey: KEY, lines: [line], allowOverReceipt: "yes" }],
  ])("refuses %s", (_name, body) => {
    expect(failure(body).code).toBe("bad_request");
  });

  it("refuses more lines than a receipt can hold", () => {
    const lines = Array.from({ length: 1001 }, (_, index) => ({
      lineItemId: `l-${index}`,
      acceptedQty: 1,
    }));
    expect(failure({ idempotencyKey: KEY, lines }).message).toContain("at most 1000");
  });

  it("refuses NUL bytes in text and line ids", () => {
    expect(failure({ idempotencyKey: KEY, lines: [line], note: "a\u0000b" }).code).toBe("bad_request");
    expect(
      failure({ idempotencyKey: KEY, lines: [{ lineItemId: "l\u00001", acceptedQty: 1 }] }).code,
    ).toBe("bad_request");
  });
});
