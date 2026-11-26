import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

const requirePosTenant = vi.fn();
const checkPosRateLimit = vi.fn();
const listCountableStocktakes = vi.fn();
const getCountSheet = vi.fn();
const countAtPos = vi.fn();

vi.mock("../../tenant/require-pos-tenant.server", () => ({
  requirePosTenant: (...args: unknown[]) => requirePosTenant(...args),
}));
vi.mock("./pos-rate-limit.server", () => ({
  checkPosRateLimit: (...args: unknown[]) => checkPosRateLimit(...args),
}));
vi.mock("./stocktake-api.server", () => ({
  listCountableStocktakes: (...args: unknown[]) => listCountableStocktakes(...args),
  getCountSheet: (...args: unknown[]) => getCountSheet(...args),
  countAtPos: (...args: unknown[]) => countAtPos(...args),
}));
vi.mock("../../shopify.server", () => ({
  unauthenticated: { admin: vi.fn(async () => ({ admin: { graphql: vi.fn() } })) },
}));

const { loader: listLoader } = await import("../../routes/api.pos.stocktakes");
const { loader: sheetLoader, action } = await import("../../routes/api.pos.stocktakes.$id");
const { PosApiError } = await import("./pos-api.server");

const db = { marker: "tenant-db" };
const headers = { Origin: "https://extensions.shopifycdn.com", Authorization: "Bearer t" };

function load(path: string, params: Record<string, string> = {}) {
  return { request: new Request(`https://app.example.com${path}`, { headers }), params, context: {} } as LoaderFunctionArgs;
}

function post(path: string, body: string, method = "POST") {
  return {
    request: new Request(`https://app.example.com${path}`, {
      method,
      headers: { ...headers, "Content-Type": "application/json" },
      body,
    }),
    params: { id: "st-1" },
    context: {},
  } as unknown as ActionFunctionArgs;
}

beforeEach(() => {
  vi.clearAllMocks();
  requirePosTenant.mockResolvedValue({
    db,
    shop: { id: "s", myshopifyDomain: "a.myshopify.com" },
    actor: { shopifyUserId: "77", displayName: null, channel: "POS" },
    tenant: { correlationId: "c" },
    cors: (response: Response) => response,
  });
  checkPosRateLimit.mockResolvedValue({ allowed: true });
});

describe("GET /api/pos/stocktakes", () => {
  it("lists the counts for the POS location as a Shopify GID", async () => {
    listCountableStocktakes.mockResolvedValue({ stocktakes: [], hasMore: false });

    const response = await listLoader(load("/api/pos/stocktakes?location=11"));

    expect(response.status).toBe(200);
    expect(listCountableStocktakes).toHaveBeenCalledWith(db, "gid://shopify/Location/11");
  });

  it("asks for a location", async () => {
    const response = await listLoader(load("/api/pos/stocktakes"));

    expect(response.status).toBe(400);
    expect(listCountableStocktakes).not.toHaveBeenCalled();
  });
});

describe("GET /api/pos/stocktakes/:id", () => {
  it("returns the sheet", async () => {
    getCountSheet.mockResolvedValue({ counted: [] });

    const response = await sheetLoader(load("/api/pos/stocktakes/st-1?location=11", { id: "st-1" }));

    expect(response.status).toBe(200);
    expect(getCountSheet).toHaveBeenCalledWith(db, "st-1", "gid://shopify/Location/11");
  });

  it("passes service refusals through with their status", async () => {
    getCountSheet.mockRejectedValue(new PosApiError(409, "conflict", "Different location."));

    const response = await sheetLoader(load("/api/pos/stocktakes/st-1?location=11", { id: "st-1" }));

    expect(response.status).toBe(409);
  });
});

describe("POST /api/pos/stocktakes/:id", () => {
  it("hands the JSON body, location and POS context to the service", async () => {
    countAtPos.mockResolvedValue({ ok: true });

    const response = await action(post("/api/pos/stocktakes/st-1?location=11", '{"intent":"scan","code":"1"}'));

    expect(response.status).toBe(200);
    const [context, id, location, body] = countAtPos.mock.calls[0];
    expect(context.db).toBe(db);
    expect([id, location, body]).toEqual(["st-1", "gid://shopify/Location/11", { intent: "scan", code: "1" }]);
  });

  it("refuses a body that is not JSON, a missing location and an oversized body", async () => {
    expect((await action(post("/api/pos/stocktakes/st-1?location=11", "{oops"))).status).toBe(400);
    expect((await action(post("/api/pos/stocktakes/st-1", "{}"))).status).toBe(400);
    expect((await action(post("/api/pos/stocktakes/st-1?location=11", "x".repeat(20_000)))).status).toBe(400);
    expect(countAtPos).not.toHaveBeenCalled();
  });

  it("does not leak an unexpected failure", async () => {
    countAtPos.mockRejectedValue(new Error("password is hunter2"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await action(post("/api/pos/stocktakes/st-1?location=11", "{}"));

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("hunter2");
  });

  it("does not run when the rate limit is reached", async () => {
    checkPosRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 2, firstDenial: false });

    const response = await action(post("/api/pos/stocktakes/st-1?location=11", "{}"));

    expect(response.status).toBe(429);
    expect(countAtPos).not.toHaveBeenCalled();
  });
});
