import { describe, expect, it, vi } from "vitest";
import { parseCount } from "./receiving";
import {
  createActionQueue,
  failureOutcome,
  type ActionOutcome,
  describeTransfer,
  loadTransferSheet,
  loadTransfers,
  mostCountedIn,
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
      expect(parseCount(text)).toBeNull();
    }
  });

  it("reads real numbers, including a typed 0", () => {
    expect(parseCount("12")).toBe(12);
    expect(parseCount(" 0 ")).toBe(0);
    expect(parseCount("9999999")).toBe(1_000_000);
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

describe("failureOutcome", () => {
  it("keeps going after a plain refusal, stops on anything else", () => {
    for (const status of [400, 404, 409]) {
      expect(failureOutcome({ status, message: "x" })).toBe("refused");
    }
    for (const status of [401, 403, 429]) {
      expect(failureOutcome({ status, message: "x" })).toBe("halt");
    }
    expect(failureOutcome({ message: "lost" })).toBe("unsure");
    expect(failureOutcome({ status: 503, message: "x" })).toBe("unsure");
  });
});

describe("unreadable answers", () => {
  it("treats a 2xx the device cannot read as unsure, not as a failure to retry", async () => {
    const unreadable = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("bad json");
      },
    })) as unknown as Parameters<typeof sendTransferScan>[0];
    expect(await sendTransferScan(unreadable, 12, "t", "1")).toMatchObject({
      ok: false,
      message: TRANSFER_MESSAGES.scanUnsure,
    });
    expect(await postTransferReceipt(unreadable, 12, "t")).toMatchObject({
      ok: false,
      message: TRANSFER_MESSAGES.postUnsure,
    });
  });

  it("still shows what the app said for a refusal", async () => {
    const result = await sendTransferScan(respond(429), 12, "t", "1");
    expect(result).toMatchObject({ ok: false, status: 429 });
  });
});

describe("action queue", () => {
  const actions = (log: string[], outcomes: Record<string, ActionOutcome> = {}) => {
    let inFlight = 0;
    let max = 0;
    const make = (name: string) => async (): Promise<ActionOutcome> => {
      inFlight += 1;
      max = Math.max(max, inFlight);
      await Promise.resolve();
      log.push(name);
      inFlight -= 1;
      return outcomes[name] ?? "ok";
    };
    return { make, maxInFlight: () => max };
  };

  it("runs scans, a count edit and the receipt one at a time, in the order asked", async () => {
    const log: string[] = [];
    const idle = vi.fn();
    const { make, maxInFlight } = actions(log);
    const queue = createActionQueue({ onIdle: idle });
    for (const name of ["scan A", "scan A", "set", "post", "scan B"]) queue.push(make(name));
    await vi.waitFor(() => expect(idle).toHaveBeenCalled());
    expect(log).toEqual(["scan A", "scan A", "set", "post", "scan B"]);
    expect(maxInFlight()).toBe(1);
    expect(idle).toHaveBeenCalledWith(0);
  });

  it("goes on after a refusal", async () => {
    const log: string[] = [];
    const idle = vi.fn();
    const { make } = actions(log, { B: "refused" });
    const queue = createActionQueue({ onIdle: idle });
    for (const name of ["A", "B", "C"]) queue.push(make(name));
    await vi.waitFor(() => expect(idle).toHaveBeenCalled());
    expect(log).toEqual(["A", "B", "C"]);
    expect(idle).toHaveBeenCalledWith(0);
  });

  it("drops what is behind an unsure or halting action and says how many", async () => {
    for (const outcome of ["unsure", "halt"] as const) {
      const log: string[] = [];
      const idle = vi.fn();
      const { make } = actions(log, { B: outcome });
      const queue = createActionQueue({ onIdle: idle });
      for (const name of ["A", "B", "C", "D"]) queue.push(make(name));
      await vi.waitFor(() => expect(idle).toHaveBeenCalled());
      expect(log).toEqual(["A", "B"]);
      expect(idle).toHaveBeenCalledWith(2);
    }
  });

  it("accepts new actions after going idle", async () => {
    const log: string[] = [];
    const idle = vi.fn();
    const { make } = actions(log);
    const queue = createActionQueue({ onIdle: idle });
    queue.push(make("A"));
    await vi.waitFor(() => expect(idle).toHaveBeenCalledTimes(1));
    queue.push(make("B"));
    await vi.waitFor(() => expect(idle).toHaveBeenCalledTimes(2));
    expect(log).toEqual(["A", "B"]);
  });
});
