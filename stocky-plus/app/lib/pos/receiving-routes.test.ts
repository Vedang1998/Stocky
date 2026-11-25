import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

const requirePosTenant = vi.fn();
const checkPosRateLimit = vi.fn();
const listReceivableOrders = vi.fn();
const getReceivingSheet = vi.fn();
const receiveAtPos = vi.fn();

vi.mock("../../tenant/require-pos-tenant.server", () => ({
  requirePosTenant: (...args: unknown[]) => requirePosTenant(...args),
}));
vi.mock("./pos-rate-limit.server", () => ({
  checkPosRateLimit: (...args: unknown[]) => checkPosRateLimit(...args),
}));
vi.mock("./receiving-api.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./receiving-api.server")>()),
  listReceivableOrders: (...args: unknown[]) => listReceivableOrders(...args),
  getReceivingSheet: (...args: unknown[]) => getReceivingSheet(...args),
  receiveAtPos: (...args: unknown[]) => receiveAtPos(...args),
}));
vi.mock("../../shopify.server", () => ({
  unauthenticated: {
    admin: vi.fn(async () => ({ admin: { graphql: vi.fn() } })),
  },
}));

const { loader: listLoader } = await import("../../routes/api.pos.receiving");
const { loader: sheetLoader, action } = await import(
  "../../routes/api.pos.receiving.$id"
);
const { PosApiError } = await import("./pos-api.server");

const db = { marker: "tenant-db" };

function context() {
  return {
    db,
    shop: { id: "shop-1", myshopifyDomain: "a.myshopify.com" },
    actor: { shopifyUserId: "77", displayName: null, channel: "POS" },
    tenant: { correlationId: "c" },
    cors: (response: Response) => response,
  };
}

const headers = { Origin: "https://extensions.shopifycdn.com", Authorization: "Bearer t" };

function load(path: string, params: Record<string, string> = {}) {
  return {
    request: new Request(`https://app.example.com${path}`, { headers }),
    params,
    context: {},
  } as LoaderFunctionArgs;
}

function post(path: string, body: string, params: Record<string, string> = { id: "po-1" }) {
  return {
    request: new Request(`https://app.example.com${path}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body,
    }),
    params,
    context: {},
  } as ActionFunctionArgs;
}

beforeEach(() => {
  vi.clearAllMocks();
  requirePosTenant.mockResolvedValue(context());
  checkPosRateLimit.mockResolvedValue({ allowed: true });
});

describe("GET /api/pos/receiving", () => {
  it("lists the orders for the POS location as a Shopify GID", async () => {
    listReceivableOrders.mockResolvedValue({ receivingEnabled: true, orders: [], hasMore: false });

    const response = await listLoader(load("/api/pos/receiving?location=401&search=%20acme%20"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ receivingEnabled: true, orders: [], hasMore: false });
    expect(listReceivableOrders).toHaveBeenCalledWith(db, "gid://shopify/Location/401", "acme");
  });

  it("asks for a location instead of listing every order", async () => {
    const response = await listLoader(load("/api/pos/receiving"));

    expect(response.status).toBe(400);
    expect((await response.json()).error.message).toContain("Choose a location");
    expect(listReceivableOrders).not.toHaveBeenCalled();
  });

  it("refuses a location that is not a number", async () => {
    const response = await listLoader(load("/api/pos/receiving?location=abc"));

    expect(response.status).toBe(400);
  });

  it("does not run when the rate limit is reached", async () => {
    checkPosRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 4, firstDenial: false });

    const response = await listLoader(load("/api/pos/receiving?location=401"));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("4");
    expect(listReceivableOrders).not.toHaveBeenCalled();
  });
});

describe("GET /api/pos/receiving/:id", () => {
  it("returns the sheet for the order at the POS location", async () => {
    getReceivingSheet.mockResolvedValue({ lines: [] });

    const response = await sheetLoader(load("/api/pos/receiving/po-1?location=401", { id: "po-1" }));

    expect(response.status).toBe(200);
    expect(getReceivingSheet).toHaveBeenCalledWith(db, "po-1", "gid://shopify/Location/401");
  });

  it("passes service errors through with their status", async () => {
    getReceivingSheet.mockRejectedValue(new PosApiError(404, "not_found", "Purchase order was not found."));

    const response = await sheetLoader(load("/api/pos/receiving/po-9?location=401", { id: "po-9" }));

    expect(response.status).toBe(404);
    expect((await response.json()).error).toEqual({
      code: "not_found",
      message: "Purchase order was not found.",
    });
  });
});

describe("POST /api/pos/receiving/:id", () => {
  it("passes the parsed JSON body, the location and the POS context to the service", async () => {
    receiveAtPos.mockResolvedValue({ complete: true, message: "Receipt 1: 3 units received.", receiptNumber: 1, sheet: {} });

    const response = await action(post("/api/pos/receiving/po-1?location=401", '{"idempotencyKey":"k"}'));

    expect(response.status).toBe(200);
    expect((await response.json()).receiptNumber).toBe(1);
    const [passedContext, id, location, body] = receiveAtPos.mock.calls[0];
    expect(passedContext.db).toBe(db);
    expect([id, location, body]).toEqual(["po-1", "gid://shopify/Location/401", { idempotencyKey: "k" }]);
  });

  it("refuses a body that is not JSON before any service runs", async () => {
    const response = await action(post("/api/pos/receiving/po-1?location=401", "{oops"));

    expect(response.status).toBe(400);
    expect(receiveAtPos).not.toHaveBeenCalled();
  });

  it("refuses an oversized body", async () => {
    const response = await action(post("/api/pos/receiving/po-1?location=401", "x".repeat(300_000)));

    expect(response.status).toBe(400);
    expect(receiveAtPos).not.toHaveBeenCalled();
  });

  it("refuses a declared size over the limit without reading the body", async () => {
    const args = post("/api/pos/receiving/po-1?location=401", "{}");
    args.request.headers.set("Content-Length", "300000");

    const response = await action(args);

    expect(response.status).toBe(400);
    expect((await response.json()).error.message).toBe("The request is too large.");
    expect(receiveAtPos).not.toHaveBeenCalled();
  });

  it("refuses a request without a location", async () => {
    const response = await action(post("/api/pos/receiving/po-1", "{}"));

    expect(response.status).toBe(400);
    expect(receiveAtPos).not.toHaveBeenCalled();
  });

  it("returns field errors so the screen can mark the line", async () => {
    receiveAtPos.mockRejectedValue(
      new PosApiError(400, "bad_request", "Fix the highlighted field.", { "line:l1": "Only 2 left." }),
    );

    const response = await action(post("/api/pos/receiving/po-1?location=401", "{}"));

    expect(response.status).toBe(400);
    expect((await response.json()).error.fieldErrors).toEqual({ "line:l1": "Only 2 left." });
  });

  it("answers a failure the service did not expect with a generic message", async () => {
    receiveAtPos.mockRejectedValue(new Error("db password is hunter2"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await action(post("/api/pos/receiving/po-1?location=401", "{}"));

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("hunter2");
  });
});
