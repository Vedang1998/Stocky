import { describe, expect, it, vi } from "vitest";
import {
  createScanQueue,
  describeTransfer,
  loadTransferSheet,
  loadTransfers,
  mostCountedIn,
  parseCountedIn,
  postTransferReceipt,
  sendTransferCount,
  sendTransferScan,
  TRANSFER_MESSAGES,
} from "./transfers";

function respond(status: number, body: unknown = {}) {
  const fetchImpl = vi.fn<(url: string, init?: object) => Promise<Response>>();
  fetchImpl.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
  return fetchImpl;
}

describe("requests", () => {
  it("lists transfers for the POS location and escapes ids", async () => {
    const fetchImpl = respond(200, { receivingEnabled: true, transfers: [], hasMore: false });
    await loadTransfers(fetchImpl, 12);
    expect(fetchImpl).toHaveBeenCalledWith("/api/pos/transfers?location=12", { signal: undefined });
    await loadTransferSheet(fetchImpl, 12, "a/b");
    expect(fetchImpl).toHaveBeenLastCalledWith("/api/pos/transfers/a%2Fb?location=12", {
      signal: undefined,
    });
  });

  it("asks for a location before calling the app", async () => {
    const fetchImpl = respond(200);
    for (const result of [
      await loadTransfers(fetchImpl, null),
      await loadTransferSheet(fetchImpl, null, "t"),
      await sendTransferScan(fetchImpl, null, "t", "1"),
      await postTransferReceipt(fetchImpl, null, "t"),
    ]) {
      expect(result).toMatchObject({ ok: false, message: TRANSFER_MESSAGES.noLocation });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts a scan, a set and a post", async () => {
    const fetchImpl = respond(200, { ok: true, scanned: null, posted: null, sheet: null });
    await sendTransferScan(fetchImpl, 12, "t1", "123", 2);
    await sendTransferCount(fetchImpl, 12, "t1", "l1", 0);
    await postTransferReceipt(fetchImpl, 12, "t1");
    const bodies = fetchImpl.mock.calls.map(([, init]) =>
      JSON.parse((init as { body: string }).body),
    );
    expect(bodies).toEqual([
      { intent: "scan", code: "123", quantity: 2 },
      { intent: "set", lineId: "l1", quantity: 0 },
      { intent: "post" },
    ]);
  });

  it("passes a refusal the app explained through as-is", async () => {
    const fetchImpl = respond(409, { error: { code: "conflict", message: "Only a transfer in transit can be received." } });
    expect(await postTransferReceipt(fetchImpl, 12, "t")).toMatchObject({
      ok: false,
      message: "Only a transfer in transit can be received.",
    });
  });

  it("does not claim a scan or post failed when the connection dropped or the server errored", async () => {
    const dropped = vi.fn(async () => {
      throw new TypeError("network");
    });
    expect(await sendTransferScan(dropped, 12, "t", "1")).toMatchObject({
      ok: false,
      message: TRANSFER_MESSAGES.scanUnsure,
    });
    expect(await postTransferReceipt(dropped, 12, "t")).toMatchObject({
      ok: false,
      message: TRANSFER_MESSAGES.postUnsure,
    });
    for (const status of [500, 502, 503]) {
      expect(await sendTransferScan(respond(status), 12, "t", "1")).toMatchObject({
        ok: false,
        message: TRANSFER_MESSAGES.scanUnsure,
      });
      expect(await postTransferReceipt(respond(status), 12, "t")).toMatchObject({
        ok: false,
        message: TRANSFER_MESSAGES.postUnsure,
      });
    }
  });
});

describe("typed counts", () => {
  it("ignores empty and invalid text instead of counting 0", () => {
    for (const text of ["", "  ", "abc", "-1", "1.5", "12345678", null, undefined]) {
      expect(parseCountedIn(text)).toBeNull();
    }
  });

  it("reads real numbers, including a typed 0", () => {
    expect(parseCountedIn("12")).toBe(12);
    expect(parseCountedIn(" 0 ")).toBe(0);
    expect(parseCountedIn("9999999")).toBe(1_000_000);
  });

  it("bounds a line's count by what is counted in plus what is still unaccounted for", () => {
    expect(mostCountedIn({ countedInQty: 3, outstandingQty: 4 })).toBe(7);
  });
});

describe("describeTransfer", () => {
  const now = Date.parse("2026-11-25T12:00:00Z");
  it("says when it was sent and what is left", () => {
    expect(
      describeTransfer(
        { id: "t", shippedAt: "2026-11-25T08:00:00Z", shippedUnits: 10, outstandingUnits: 7, countedInUnits: 3 },
        now,
      ),
    ).toBe("Sent today · 7 of 10 units to receive · 3 counted in");
    expect(
      describeTransfer(
        { id: "t", shippedAt: "2026-11-22T08:00:00Z", shippedUnits: 4, outstandingUnits: 4, countedInUnits: 0 },
        now,
      ),
    ).toBe("Sent 3 d ago · 4 of 4 units to receive");
    expect(
      describeTransfer({ id: "t", shippedAt: null, shippedUnits: 4, outstandingUnits: 4, countedInUnits: 0 }, now),
    ).toBe("4 of 4 units to receive");
  });
});

describe("scan queue", () => {
  it("counts quick scans one at a time, in order, and the same code twice", async () => {
    const seen: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const idle = vi.fn();
    const queue = createScanQueue({
      run: async (code) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await Promise.resolve();
        seen.push(code);
        inFlight -= 1;
        return true;
      },
      onIdle: idle,
    });
    queue.push("A");
    queue.push("A");
    queue.push("B");
    await vi.waitFor(() => expect(idle).toHaveBeenCalled());
    expect(seen).toEqual(["A", "A", "B"]);
    expect(maxInFlight).toBe(1);
    expect(idle).toHaveBeenCalledWith(0);
  });

  it("drops the scans behind one that could not be confirmed and says how many", async () => {
    const seen: string[] = [];
    const idle = vi.fn();
    const queue = createScanQueue({
      run: async (code) => {
        seen.push(code);
        return code !== "B";
      },
      onIdle: idle,
    });
    for (const code of ["A", "B", "C", "D"]) queue.push(code);
    await vi.waitFor(() => expect(idle).toHaveBeenCalled());
    expect(seen).toEqual(["A", "B"]);
    expect(idle).toHaveBeenCalledWith(2);
  });
});
