import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoaderFunctionArgs } from "react-router";
import { TenantAuthorityError } from "../../tenant/errors";
import type * as Contract from "../../../extensions/propo-pos/src/api-types";
import type {
  ResolvedVariant,
  ScanResolution,
} from "../../services/barcode-lookup.server";
import type { VariantStock } from "../../services/stock-lookup.server";

const requirePosTenant = vi.fn();
const resolveScannedCode = vi.fn();
const findLiveVariant = vi.fn();
const getVariantStock = vi.fn();
const checkPosRateLimit = vi.fn();

vi.mock("../../tenant/require-pos-tenant.server", () => ({
  requirePosTenant: (...args: unknown[]) => requirePosTenant(...args),
}));
vi.mock("./pos-rate-limit.server", () => ({
  checkPosRateLimit: (...args: unknown[]) => checkPosRateLimit(...args),
}));
vi.mock("../../services/barcode-lookup.server", () => ({
  resolveScannedCode: (...args: unknown[]) => resolveScannedCode(...args),
  findLiveVariant: (...args: unknown[]) => findLiveVariant(...args),
}));
vi.mock("../../services/stock-lookup.server", () => ({
  getVariantStock: (...args: unknown[]) => getVariantStock(...args),
}));

const { loader: scanLoader } = await import("../../routes/api.pos.scan");
const { loader: stockLoader } = await import("../../routes/api.pos.stock");

const POS_ORIGIN = "https://extensions.shopifycdn.com";
const db = { marker: "tenant-db" };

function request(path: string) {
  return new Request(`https://app.example.com${path}`, {
    headers: { Origin: POS_ORIGIN, Authorization: "Bearer t" },
  });
}

function args(path: string): LoaderFunctionArgs {
  return { request: request(path), params: {}, context: {} } as LoaderFunctionArgs;
}

function corsFor(response: Response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  return response;
}

const matched = {
  status: "matched",
  code: "036000291452",
  matchedOn: "barcode",
  variant: { variantGid: "gid://shopify/ProductVariant/11" },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SHOPIFY_APP_URL", "https://app.example.com");
  requirePosTenant.mockResolvedValue({
    db,
    tenant: { correlationId: "corr-1" },
    cors: corsFor,
  });
  checkPosRateLimit.mockResolvedValue({ allowed: true });
});

describe("POS API error handling", () => {
  it("adds CORS headers to authentication failures", async () => {
    requirePosTenant.mockRejectedValue(new Response(undefined, { status: 401 }));
    const response = await scanLoader(args("/api/pos/scan?code=1"));
    expect(response.status).toBe(401);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "Authorization, Content-Type",
    );
  });

  it("maps tenant denials to a readable 403 without internal detail", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    requirePosTenant.mockRejectedValue(
      new TenantAuthorityError("shop_processing_disabled", "internal detail"),
    );
    const response = await scanLoader(args("/api/pos/scan?code=1"));
    expect(consoleWarn).toHaveBeenCalledWith("POS API request denied", {
      path: "/api/pos/scan",
      code: "shop_processing_disabled",
    });
    consoleWarn.mockRestore();
    expect(response.status).toBe(403);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = await response.json();
    expect(body.error.code).toBe("forbidden");
    expect(JSON.stringify(body)).not.toContain("internal detail");
  });

  it("keeps unexpected authentication failures readable and opaque", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    requirePosTenant.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5"));
    const response = await scanLoader(args("/api/pos/scan?code=1"));
    expect(response.status).toBe(500);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(JSON.stringify(await response.json())).not.toContain("ECONNREFUSED");
    consoleError.mockRestore();
  });

  it("hides unexpected handler errors behind a 500", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    resolveScannedCode.mockRejectedValue(new Error("db exploded at host x"));
    const response = await scanLoader(args("/api/pos/scan?code=1"));
    expect(response.status).toBe(500);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(JSON.stringify(await response.json())).not.toContain("db exploded");
    expect(consoleError).toHaveBeenCalledWith(
      "POS API request failed",
      expect.objectContaining({ correlationId: "corr-1", path: "/api/pos/scan" }),
    );
    consoleError.mockRestore();
  });

  it("checks the allowance of the authenticated caller", async () => {
    resolveScannedCode.mockResolvedValue({ status: "unknown", code: "1" });
    await scanLoader(args("/api/pos/scan?code=1"));
    expect(checkPosRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ tenant: { correlationId: "corr-1" } }),
    );
  });

  it("answers 429 with Retry-After and does no work once the allowance is spent", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    checkPosRateLimit.mockResolvedValue({
      allowed: false,
      scope: "staff",
      retryAfterSeconds: 17,
      firstDenial: true,
    });
    const response = await scanLoader(args("/api/pos/scan?code=1"));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("17");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).error.code).toBe("rate_limited");
    expect(resolveScannedCode).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledWith("POS API rate limit reached", {
      path: "/api/pos/scan",
      correlationId: "corr-1",
      scope: "staff",
    });
    consoleWarn.mockRestore();
  });

  it("logs a spent allowance once, not on every refused request", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    checkPosRateLimit.mockResolvedValue({
      allowed: false,
      scope: "shop",
      retryAfterSeconds: 3,
      firstDenial: false,
    });
    const response = await stockLoader(
      args("/api/pos/stock?variant=gid://shopify/ProductVariant/11"),
    );
    expect(response.status).toBe(429);
    expect(findLiveVariant).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it("does not count unauthenticated requests against anyone", async () => {
    requirePosTenant.mockRejectedValue(new Response(undefined, { status: 401 }));
    await scanLoader(args("/api/pos/scan?code=1"));
    expect(checkPosRateLimit).not.toHaveBeenCalled();
  });

  it("never caches inventory responses", async () => {
    resolveScannedCode.mockResolvedValue({ status: "unknown", code: "1" });
    const response = await scanLoader(args("/api/pos/scan?code=1"));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("GET /api/pos/scan", () => {
  it("requires a code", async () => {
    const response = await scanLoader(args("/api/pos/scan"));
    expect(response.status).toBe(400);
    expect(resolveScannedCode).not.toHaveBeenCalled();
  });

  it("rejects oversized raw input before resolving", async () => {
    const response = await scanLoader(
      args(`/api/pos/scan?code=${"9".repeat(1025)}`),
    );
    expect(response.status).toBe(400);
    expect(resolveScannedCode).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric location", async () => {
    const response = await scanLoader(
      args("/api/pos/scan?code=1&location=gid://shopify/Location/1"),
    );
    expect(response.status).toBe(400);
  });

  it("returns the match and its stock with the POS location preferred", async () => {
    resolveScannedCode.mockResolvedValue(matched);
    getVariantStock.mockResolvedValue({ locations: [] });

    const response = await scanLoader(
      args("/api/pos/scan?code=036000291452&location=77"),
    );

    expect(response.status).toBe(200);
    expect(resolveScannedCode).toHaveBeenCalledWith(db, "036000291452");
    expect(getVariantStock).toHaveBeenCalledWith(
      db,
      "gid://shopify/ProductVariant/11",
      { preferredLocationGid: "gid://shopify/Location/77" },
    );
    expect(await response.json()).toEqual({
      resolution: matched,
      stock: { locations: [] },
    });
  });

  it("does not load stock for ambiguous or unknown scans", async () => {
    resolveScannedCode.mockResolvedValue({ status: "unknown", code: "x" });
    const response = await scanLoader(args("/api/pos/scan?code=x"));
    expect(await response.json()).toEqual({
      resolution: { status: "unknown", code: "x" },
      stock: null,
    });
    expect(getVariantStock).not.toHaveBeenCalled();
  });
});

describe("GET /api/pos/stock", () => {
  it("validates the variant GID", async () => {
    for (const variant of ["", "11", "gid://shopify/Product/11", "gid://shopify/ProductVariant/1x"]) {
      const response = await stockLoader(
        args(`/api/pos/stock?variant=${encodeURIComponent(variant)}`),
      );
      expect(response.status).toBe(400);
    }
    expect(findLiveVariant).not.toHaveBeenCalled();
  });

  it("returns 404 for a variant outside this shop's live catalog", async () => {
    findLiveVariant.mockResolvedValue(null);
    const response = await stockLoader(
      args("/api/pos/stock?variant=gid://shopify/ProductVariant/11"),
    );
    expect(response.status).toBe(404);
    expect(getVariantStock).not.toHaveBeenCalled();
  });

  it("returns the variant and its stock", async () => {
    findLiveVariant.mockResolvedValue({ variantGid: "gid://shopify/ProductVariant/11" });
    getVariantStock.mockResolvedValue({ locations: [], totals: {} });
    const response = await stockLoader(
      args("/api/pos/stock?variant=gid://shopify/ProductVariant/11&location=3"),
    );
    expect(response.status).toBe(200);
    expect(getVariantStock).toHaveBeenCalledWith(
      db,
      "gid://shopify/ProductVariant/11",
      { preferredLocationGid: "gid://shopify/Location/3" },
    );
  });
});

describe("POS extension response contract", () => {
  it("matches the server types", () => {
    type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
    const contract: [
      Same<ScanResolution, Contract.ScanResolution>,
      Same<VariantStock, Contract.VariantStock>,
      Same<ResolvedVariant, Contract.ResolvedVariant>,
    ] = [true, true, true];
    expect(contract).toEqual([true, true, true]);
  });
});
