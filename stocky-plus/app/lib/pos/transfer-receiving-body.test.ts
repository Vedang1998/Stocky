import { describe, expect, it } from "vitest";
import { PosApiError } from "./pos-api.server";
import { parseTransferReceiveBody } from "./transfer-receiving-body";

function refusal(body: unknown): PosApiError {
  try {
    parseTransferReceiveBody(body);
  } catch (error) {
    expect(error).toBeInstanceOf(PosApiError);
    return error as PosApiError;
  }
  throw new Error("expected the body to be refused");
}

describe("parseTransferReceiveBody", () => {
  it("reads a scan, defaulting to one unit and trimming the code", () => {
    expect(parseTransferReceiveBody({ intent: "scan", code: " 123 " })).toEqual({
      intent: "scan",
      code: "123",
      quantity: 1,
    });
    expect(parseTransferReceiveBody({ intent: "scan", code: "1", quantity: 3 })).toMatchObject({
      quantity: 3,
    });
  });

  it("reads a set and a post", () => {
    expect(parseTransferReceiveBody({ intent: "set", lineId: "l1", quantity: 0 })).toEqual({
      intent: "set",
      lineId: "l1",
      quantity: 0,
    });
    expect(parseTransferReceiveBody({ intent: "post" })).toEqual({ intent: "post" });
  });

  it("refuses what is not a request, with a 400", () => {
    for (const body of [
      null,
      [],
      "scan",
      {},
      { intent: "other" },
      { intent: "scan" },
      { intent: "scan", code: "  " },
      { intent: "scan", code: "a\u0000b" },
      { intent: "scan", code: "x".repeat(192) },
      { intent: "scan", code: "1", quantity: 0 },
      { intent: "scan", code: "1", quantity: 1.5 },
      { intent: "scan", code: "1", quantity: 1_000_001 },
      { intent: "set", quantity: 1 },
      { intent: "set", lineId: "", quantity: 1 },
      { intent: "set", lineId: "a\u0000", quantity: 1 },
      { intent: "set", lineId: "l1", quantity: -1 },
      { intent: "set", lineId: "l1" },
      { intent: "set", lineId: "l1", quantity: null },
    ]) {
      expect(refusal(body).status).toBe(400);
    }
  });
});
