import { describe, expect, it, vi } from "vitest";
import { MESSAGES, lookupCode, lookupVariant } from "./lookup";
import type { ResolvedVariant } from "./api-types";

const variant: ResolvedVariant = {
  variantGid: "gid://shopify/ProductVariant/11",
  productGid: "gid://shopify/Product/1",
  displayName: "Cold Brew - 12 oz",
  productTitle: "Cold Brew",
  variantTitle: "12 oz",
  sku: "CB-12",
  barcode: "036000291452",
  imageUrl: null,
};

function reply(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("lookupCode", () => {
  it("encodes the code and POS location in the request", async () => {
    const fetchImpl = reply(200, { resolution: { status: "unknown", code: "A B&C" }, stock: null });
    await lookupCode(fetchImpl, "A B&C", 77);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/pos/scan?code=A+B%26C&location=77",
      { signal: undefined },
    );
  });

  it("omits the location when POS has none", async () => {
    const fetchImpl = reply(200, { resolution: { status: "unknown", code: "1" }, stock: null });
    await lookupCode(fetchImpl, "1", null);
    expect(fetchImpl).toHaveBeenCalledWith("/api/pos/scan?code=1", { signal: undefined });
  });

  it("maps each resolution to a screen", async () => {
    const stock = { variantGid: variant.variantGid, inventoryItemGid: null, tracked: null, locations: [], totals: { available: null, onHand: null, committed: null, incoming: null } };
    expect(
      await lookupCode(reply(200, { resolution: { status: "matched", code: "1", matchedOn: "sku", variant }, stock }), "1", null),
    ).toEqual({ kind: "stock", variant, matchedOn: "sku", stock, loadedAt: expect.any(Number) });
    expect(
      await lookupCode(reply(200, { resolution: { status: "ambiguous", code: "1", matchedOn: "barcode", candidates: [variant], truncated: true }, stock: null }), "1", null),
    ).toEqual({ kind: "choose", code: "1", matchedOn: "barcode", candidates: [variant], truncated: true });
    expect(
      await lookupCode(reply(200, { resolution: { status: "unknown", code: "1" }, stock: null }), "1", null),
    ).toEqual({ kind: "unknown", code: "1" });
    expect(
      await lookupCode(reply(200, { resolution: { status: "invalid", reason: "empty" }, stock: null }), " ", null),
    ).toEqual({ kind: "invalid" });
  });

  it("explains authentication, permission and server failures", async () => {
    expect(await lookupCode(reply(401, null), "1", null)).toEqual({ kind: "error", message: MESSAGES.signIn });
    expect(
      await lookupCode(reply(403, { error: { code: "forbidden", message: "Paused for this shop." } }), "1", null),
    ).toEqual({ kind: "error", message: "Paused for this shop." });
    expect(await lookupCode(reply(403, "not json"), "1", null)).toEqual({ kind: "error", message: MESSAGES.unavailable });
    expect(await lookupCode(reply(400, {}), "1", null)).toEqual({ kind: "error", message: MESSAGES.unreadable });
    expect(await lookupCode(reply(502, {}), "1", null)).toEqual({ kind: "error", message: MESSAGES.failed });
  });

  it("reports a network failure as offline", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Network request failed"));
    expect(await lookupCode(fetchImpl, "1", null)).toEqual({ kind: "error", message: MESSAGES.offline });
  });

  it("returns null for a request aborted by a newer scan", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    const fetchImpl = vi.fn().mockRejectedValue(abort);
    expect(await lookupCode(fetchImpl, "1", null)).toBeNull();
  });

  it("treats an unreadable success body as a failure", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    });
    expect(await lookupCode(fetchImpl, "1", null)).toEqual({ kind: "error", message: MESSAGES.failed });
  });
});

describe("lookupVariant", () => {
  it("loads stock for a picked candidate", async () => {
    const fetchImpl = reply(200, { variant, stock: null });
    expect(await lookupVariant(fetchImpl, variant.variantGid, 5)).toEqual({
      kind: "stock",
      variant,
      matchedOn: null,
      stock: null,
      loadedAt: expect.any(Number),
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/pos/stock?variant=gid%3A%2F%2Fshopify%2FProductVariant%2F11&location=5",
      { signal: undefined },
    );
  });

  it("asks the operator to wait when the app is rate limiting", async () => {
    expect(await lookupVariant(reply(429, {}), variant.variantGid, null)).toEqual({
      kind: "error",
      message: MESSAGES.busy,
    });
  });

  it("says when the product is not in the synced catalog", async () => {
    expect(await lookupVariant(reply(404, {}), variant.variantGid, null)).toEqual({
      kind: "error",
      message: MESSAGES.removed,
    });
  });
});
