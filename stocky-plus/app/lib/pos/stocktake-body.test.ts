import { describe, expect, it } from "vitest";
import { PosApiError } from "./pos-api.server";
import { parseCountBody } from "./stocktake-body";

function refused(body: unknown): PosApiError {
  try {
    parseCountBody(body);
  } catch (error) {
    expect(error).toBeInstanceOf(PosApiError);
    expect((error as PosApiError).status).toBe(400);
    return error as PosApiError;
  }
  throw new Error("expected the body to be refused");
}

describe("parseCountBody", () => {
  it("reads a scan, trimming the code and defaulting to one unit", () => {
    expect(parseCountBody({ intent: "scan", code: "  0123  " })).toEqual({
      intent: "scan",
      code: "0123",
      quantity: 1,
    });
    expect(parseCountBody({ intent: "scan", code: "x", quantity: 12 })).toMatchObject({ quantity: 12 });
  });

  it("reads a count and a clear", () => {
    expect(parseCountBody({ intent: "count", lineId: "l1", countedQty: 0 })).toEqual({
      intent: "count",
      lineId: "l1",
      countedQty: 0,
    });
    expect(parseCountBody({ intent: "count", lineId: "l1", countedQty: null })).toMatchObject({
      countedQty: null,
    });
  });

  it.each([
    ["not an object", "x"],
    ["an array", []],
    ["an unknown intent", { intent: "complete" }],
    ["no intent", { code: "1" }],
    ["a blank code", { intent: "scan", code: "   " }],
    ["a numeric code", { intent: "scan", code: 5 }],
    ["a code that is too long", { intent: "scan", code: "x".repeat(192) }],
    ["zero units", { intent: "scan", code: "1", quantity: 0 }],
    ["fractional units", { intent: "scan", code: "1", quantity: 1.5 }],
    ["too many units", { intent: "scan", code: "1", quantity: 1_000_001 }],
    ["a count with no line", { intent: "count", countedQty: 1 }],
    ["a count with a long line id", { intent: "count", lineId: "x".repeat(65), countedQty: 1 }],
    ["a negative count", { intent: "count", lineId: "l", countedQty: -1 }],
    ["a count that is text", { intent: "count", lineId: "l", countedQty: "3" }],
    ["a missing count", { intent: "count", lineId: "l" }],
  ])("refuses %s", (_name, body) => {
    expect(refused(body).code).toBe("bad_request");
  });
});
