import { describe, expect, it, vi } from "vitest";
import {
  COUNT_MESSAGES,
  loadCountSheet,
  loadStocktakes,
  noteCounted,
  progressText,
  removeCounted,
  sendCount,
  sendScan,
} from "./counting";

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
  it("lists the counts for the POS location", async () => {
    const fetchImpl = respond(200, { stocktakes: [], hasMore: false });

    const result = await loadStocktakes(fetchImpl, 11);

    expect(result).toEqual({ ok: true, value: { stocktakes: [], hasMore: false } });
    expect(fetchImpl).toHaveBeenCalledWith("/api/pos/stocktakes?location=11", { signal: undefined });
  });

  it("asks for a location before calling the app", async () => {
    const fetchImpl = respond(200);

    expect(await loadStocktakes(fetchImpl, null)).toMatchObject({ ok: false, message: COUNT_MESSAGES.noLocation });
    expect(await sendScan(fetchImpl, null, "s", "1")).toMatchObject({ ok: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("escapes the id when loading a count", async () => {
    const fetchImpl = respond(200, {});

    await loadCountSheet(fetchImpl, 11, "a/b");

    expect(fetchImpl.mock.calls[0][0]).toBe("/api/pos/stocktakes/a%2Fb?location=11");
  });

  it("posts a scan with its quantity", async () => {
    const fetchImpl = respond(200, { ok: true });

    await sendScan(fetchImpl, 11, "st-1", "0123", 3);

    expect(fetchImpl).toHaveBeenCalledWith("/api/pos/stocktakes/st-1?location=11", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: "scan", code: "0123", quantity: 3 }),
    });
  });

  it("posts a set-count and a clear", async () => {
    const fetchImpl = respond(200, { ok: true });

    await sendCount(fetchImpl, 11, "st-1", "line-1", 5);
    await sendCount(fetchImpl, 11, "st-1", "line-1", null);

    const bodyOf = (index: number) =>
      JSON.parse((fetchImpl.mock.calls[index][1] as { body: string }).body) as object;
    expect(bodyOf(0)).toEqual({
      intent: "count",
      lineId: "line-1",
      countedQty: 5,
    });
    expect(bodyOf(1)).toMatchObject({ countedQty: null });
  });

  it("passes a refusal the app explained through as-is", async () => {
    const result = await sendScan(
      respond(409, { error: { code: "conflict", message: "This stocktake isn’t being counted any more." } }),
      11,
      "st-1",
      "1",
    );

    expect(result).toMatchObject({ ok: false, message: "This stocktake isn’t being counted any more." });
  });

  it("does not claim a scan failed when the connection dropped", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("network");
    });

    const result = await sendScan(fetchImpl, 11, "st-1", "1");

    expect(result).toMatchObject({ ok: false, message: COUNT_MESSAGES.scanUnsure });
  });
});

describe("counted list", () => {
  const a = { lineId: "a", title: "A", countedQty: 1 };
  const b = { lineId: "b", title: "B", countedQty: 2 };

  it("puts the latest item first and replaces its earlier entry", () => {
    expect(noteCounted([a, b], { ...b, countedQty: 5 })).toEqual([{ ...b, countedQty: 5 }, a]);
  });

  it("removes an item", () => {
    expect(removeCounted([a, b], "a")).toEqual([b]);
  });

  it("describes progress", () => {
    expect(progressText(1, 1)).toBe("1 of 1 item counted");
    expect(progressText(3, 40)).toBe("3 of 40 items counted");
  });
});
