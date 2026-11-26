import { describe, expect, it, vi } from "vitest";
import type { ReceivingLine } from "./api-types";
import {
  RECEIVING_MESSAGES,
  bumpCount,
  afterSubmit,
  createSubmissionKey,
  withoutSubmitted,
  loadOrders,
  loadSheet,
  matchLine,
  newSubmissionKey,
  overReceived,
  readCount,
  receiptRequest,
  setCount,
  submitReceipt,
  totalUnits,
} from "./receiving";

const line = (overrides: Partial<ReceivingLine>): ReceivingLine => ({
  lineItemId: "l1",
  variantGid: "gid://shopify/ProductVariant/1",
  name: "Blue",
  sku: "BLU-1",
  barcode: "0360002914",
  orderedQty: 10,
  receivedQty: 0,
  pendingQty: 0,
  rejectedQty: 0,
  openQty: 10,
  ...overrides,
});

function respond(status: number, body: unknown = {}) {
  const fetchImpl = vi.fn<(url: string, init?: object) => Promise<Response>>();
  fetchImpl.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
  return fetchImpl;
}

describe("matchLine", () => {
  const lines = [
    line({}),
    line({ lineItemId: "l2", name: "Red", sku: "RED-2", barcode: null }),
    line({ lineItemId: "l3", name: "Same SKU as barcode", sku: "0360002914", barcode: "999" }),
  ];

  it("finds a line by barcode, ignoring case and spaces", () => {
    expect(matchLine(lines, " 0360002914 ")?.lineItemId).toBe("l1");
  });

  it("prefers a barcode match over a SKU match", () => {
    expect(matchLine(lines, "0360002914")?.lineItemId).toBe("l1");
  });

  it("falls back to the SKU", () => {
    expect(matchLine(lines, "red-2")?.lineItemId).toBe("l2");
  });

  it("returns null for blank or unknown codes", () => {
    expect(matchLine(lines, "  ")).toBeNull();
    expect(matchLine(lines, "nope")).toBeNull();
  });
});

describe("counts", () => {
  it("adds units and drops a line that returns to zero", () => {
    let counts = bumpCount({}, "l1", 2);
    counts = bumpCount(counts, "l1", 1);
    expect(counts).toEqual({ l1: 3 });
    expect(bumpCount(counts, "l1", -9)).toEqual({});
  });

  it("sets an exact count and clears it with zero", () => {
    expect(setCount({ l1: 2 }, "l1", 7)).toEqual({ l1: 7 });
    expect(setCount({ l1: 2 }, "l1", 0)).toEqual({});
  });

  it("caps a count at the service limit", () => {
    expect(bumpCount({}, "l1", 2_000_000)).toEqual({ l1: 1_000_000 });
  });

  it("reads typed counts as whole numbers and anything else as zero", () => {
    expect(readCount(" 12 ")).toBe(12);
    expect(readCount("1.5")).toBe(0);
    expect(readCount("-3")).toBe(0);
    expect(readCount("")).toBe(0);
    expect(readCount(undefined)).toBe(0);
    expect(readCount("99999999")).toBe(0);
  });

  it("totals units and finds over-received lines", () => {
    const lines = [line({ openQty: 4 }), line({ lineItemId: "l2", openQty: 10 })];
    const counts = { l1: 5, l2: 10 };
    expect(totalUnits(counts)).toBe(15);
    expect(overReceived(lines, counts).map((l) => l.lineItemId)).toEqual(["l1"]);
  });
});

describe("receiptRequest and submission keys", () => {
  it("lists only counted lines in a stable order", () => {
    expect(receiptRequest("k", { b: 2, a: 1, c: 0 }, false)).toEqual({
      idempotencyKey: "k",
      lines: [
        { lineItemId: "a", acceptedQty: 1 },
        { lineItemId: "b", acceptedQty: 2 },
      ],
    });
    expect(receiptRequest("k", { a: 1 }, true).allowOverReceipt).toBe(true);
  });

  it("keeps one key until it is reset, even when counts change", () => {
    let n = 0;
    const key = createSubmissionKey(() => `key-${++n}`);
    const first = key.get();
    expect(key.get()).toBe(first);
    expect(first).toBe("key-1");
  });

  it("starts a new key after reset", () => {
    let n = 0;
    const key = createSubmissionKey(() => `key-${++n}`);
    const first = key.get();
    key.reset();
    expect(key.get()).not.toBe(first);
  });
});

describe("afterSubmit", () => {
  const sheet = { receivingEnabled: true, order: { id: "po", poNumber: "PO-1", supplierName: "Acme" }, denial: null, lines: [] };
  const answered = (outcome: "posted" | "pending" | "settled" | "not_recorded", extra: Record<string, unknown> = {}) =>
    afterSubmit({
      ok: true,
      value: { complete: outcome === "posted", message: "Receipt 3: done.", receiptNumber: 3, outcome, sheet, ...extra },
    } as Parameters<typeof afterSubmit>[0]);
  const refused = (status: number | undefined, code?: string, fieldErrors: Record<string, string> = {}) =>
    afterSubmit({ ok: false, message: "No.", fieldErrors, ...(status === undefined ? {} : { status }), ...(code ? { code } : {}) });

  it("finishes a posted receipt and starts the next one fresh", () => {
    expect(answered("posted")).toMatchObject({ freeze: false, startOver: true, reload: false, notice: { tone: "success" } });
  });

  it("repeats a pending receipt unchanged, keeping the counts and key", () => {
    expect(answered("pending")).toMatchObject({
      freeze: true,
      startOver: false,
      notice: { tone: "warning", heading: "Receipt 3 is not finished" },
    });
  });

  it("starts over after a settled failure instead of replaying its key", () => {
    expect(answered("settled")).toMatchObject({ freeze: false, startOver: true });
  });

  it("keeps the counts when nothing was recorded", () => {
    expect(answered("not_recorded")).toMatchObject({ freeze: false, startOver: false });
  });

  it("reloads the order when it could not be read back, without losing the receipt", () => {
    expect(answered("posted", { sheet: null })).toMatchObject({ startOver: true, reload: true });
  });

  it("calls an unknown outcome unconfirmed and freezes the request", () => {
    expect(refused(undefined)).toMatchObject({
      freeze: true,
      startOver: false,
      notice: { tone: "critical", heading: "Receipt not confirmed" },
    });
  });

  it("clears the counts only for a delivery recorded with other counts", () => {
    expect(refused(409, "different_counts")).toMatchObject({ startOver: true, reload: true, freeze: false });
    expect(refused(409, "conflict")).toMatchObject({ startOver: false, reload: true, freeze: false });
  });

  it("keeps the counts and shows line errors for a refusal", () => {
    expect(refused(400, "bad_request", { "line:l1": "Only 4 left." })).toMatchObject({
      startOver: false,
      freeze: false,
      lineErrors: { l1: "Only 4 left." },
      notice: { heading: "Nothing was received" },
    });
  });
});

describe("withoutSubmitted", () => {
  const request = { idempotencyKey: "k", lines: [{ lineItemId: "a", acceptedQty: 3 }, { lineItemId: "b", acceptedQty: 1 }] };

  it("keeps units scanned while the receipt was in flight", () => {
    expect(withoutSubmitted({ a: 5, b: 1, c: 2 }, request)).toEqual({ a: 2, c: 2 });
  });

  it("never goes below zero", () => {
    expect(withoutSubmitted({ a: 1 }, request)).toEqual({});
  });
});

describe("requests", () => {
  it("lists orders for the POS location with a search", async () => {
    const fetchImpl = respond(200, { orders: [] });

    const result = await loadOrders(fetchImpl, 401, " acme ");

    expect(result).toEqual({ ok: true, value: { orders: [] } });
    expect(fetchImpl).toHaveBeenCalledWith("/api/pos/receiving?search=acme&location=401", {
      signal: undefined,
    });
  });

  it("asks for a location instead of calling the app without one", async () => {
    const fetchImpl = respond(200);

    const result = await loadOrders(fetchImpl, null, "");

    expect(result).toMatchObject({ ok: false, message: RECEIVING_MESSAGES.noLocation });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("escapes the order id in the sheet request", async () => {
    const fetchImpl = respond(200, { lines: [] });

    await loadSheet(fetchImpl, 401, "a/b");

    expect(fetchImpl.mock.calls[0][0]).toBe("/api/pos/receiving/a%2Fb?location=401");
  });

  it.each([
    [401, RECEIVING_MESSAGES.signIn],
    [429, RECEIVING_MESSAGES.busy],
    [500, RECEIVING_MESSAGES.failed],
  ])("turns status %i into a plain message", async (status, message) => {
    expect(await loadSheet(respond(status), 401, "po")).toMatchObject({ ok: false, message });
  });

  it("carries the HTTP status on a failure, and none when offline", async () => {
    expect(await submitReceipt(respond(409, {}), 401, "po", { idempotencyKey: "k", lines: [] })).toMatchObject({
      ok: false,
      status: 409,
    });
    const offline = vi.fn().mockRejectedValue(new Error("down"));
    const result = await submitReceipt(offline, 401, "po", { idempotencyKey: "k", lines: [] });
    expect(result).toMatchObject({ ok: false, message: RECEIVING_MESSAGES.submitUnsure });
    expect((result as { status?: number }).status).toBeUndefined();
  });

  it("treats a server error on submit as an unconfirmed receipt, with no status", async () => {
    const result = await submitReceipt(respond(500), 401, "po", { idempotencyKey: "k", lines: [] });
    expect(result).toMatchObject({ ok: false, message: RECEIVING_MESSAGES.submitUnsure });
    expect((result as { status?: number }).status).toBeUndefined();
  });

  it("passes on the app's error code for a reused key with other counts", async () => {
    const result = await submitReceipt(
      respond(409, { error: { code: "different_counts", message: "Already submitted." } }),
      401,
      "po",
      { idempotencyKey: "k", lines: [] },
    );
    expect(result).toMatchObject({ ok: false, status: 409, code: "different_counts" });
  });

  it("shows the app's own message for a refusal and keeps the field errors", async () => {
    const fetchImpl = respond(400, {
      error: { code: "bad_request", message: "Fix the highlighted field.", fieldErrors: { "line:l1": "Only 4 left." } },
    });

    const result = await submitReceipt(fetchImpl, 401, "po", { idempotencyKey: "k", lines: [] });

    expect(result).toEqual({
      ok: false,
      message: "Fix the highlighted field.",
      status: 400,
      code: "bad_request",
      fieldErrors: { "line:l1": "Only 4 left." },
    });
  });

  it("posts the receipt as JSON", async () => {
    const fetchImpl = respond(200, { complete: true });
    const request = { idempotencyKey: "key-12345", lines: [{ lineItemId: "l1", acceptedQty: 2 }] };

    await submitReceipt(fetchImpl, 401, "po-1", request);

    expect(fetchImpl).toHaveBeenCalledWith("/api/pos/receiving/po-1?location=401", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  });

  it("tells the person to retry when the connection dropped during a receipt", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("network");
    });

    const result = await submitReceipt(fetchImpl, 401, "po", { idempotencyKey: "k", lines: [] });

    expect(result).toMatchObject({ ok: false, message: RECEIVING_MESSAGES.submitUnsure });
  });
});

describe("newSubmissionKey", () => {
  it("makes distinct keys the receiving service accepts", () => {
    const pattern = /^[A-Za-z0-9][A-Za-z0-9:._-]{7,127}$/;
    const keys = new Set(Array.from({ length: 50 }, () => newSubmissionKey()));
    expect(keys.size).toBe(50);
    for (const key of keys) expect(key).toMatch(pattern);
  });

  it("still makes a valid key when randomUUID is missing", () => {
    vi.stubGlobal("crypto", {});
    try {
      expect(newSubmissionKey()).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{8}){3}$/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
