import { UNSAFE_ErrorResponseImpl as ErrorResponseImpl } from "react-router";
import { describe, expect, it } from "vitest";

import { describeRouteError, isShopifyAuthFlowResponse } from "./route-error";

const response = (status: number, data: unknown, internal = false) =>
  new ErrorResponseImpl(status, "", data, internal);

describe("isShopifyAuthFlowResponse", () => {
  it("keeps HTML bodies (bounce page, exit-iframe) with the Shopify boundary", () => {
    expect(
      isShopifyAuthFlowResponse(
        response(200, '\n<script data-api-key="k" src="app-bridge.js"></script>'),
      ),
    ).toBe(true);
  });

  it("keeps the empty 401 retry/reauthorize response with the Shopify boundary", () => {
    expect(isShopifyAuthFlowResponse(response(401, ""))).toBe(true);
    expect(isShopifyAuthFlowResponse(response(401, null))).toBe(true);
  });

  it("treats the empty 500 from a failed token exchange or afterAuth as an app error", () => {
    expect(isShopifyAuthFlowResponse(response(500, ""))).toBe(false);
    expect(isShopifyAuthFlowResponse(response(500, undefined))).toBe(false);
  });

  it("treats plain-text route responses and thrown Errors as app errors", () => {
    expect(isShopifyAuthFlowResponse(response(404, "Supplier not found"))).toBe(false);
    expect(isShopifyAuthFlowResponse(response(403, { reason: "plan" }))).toBe(false);
    expect(isShopifyAuthFlowResponse(new Error("db down"))).toBe(false);
  });
});

describe("describeRouteError", () => {
  it("shows the short plain-text body of a 404", () => {
    expect(describeRouteError(response(404, "Supplier not found"))).toEqual({
      status: 404,
      title: "Page not found",
      message: "Supplier not found",
    });
  });

  it("falls back to generic copy when the body is HTML, empty, structured or long", () => {
    expect(describeRouteError(response(404, "<b>x</b>")).message).toBe(
      "This page doesn't exist or is no longer available.",
    );
    expect(describeRouteError(response(403, { capability: "x" })).message).toBe(
      "Your account or plan doesn't include access to this page.",
    );
    expect(describeRouteError(response(400, "x".repeat(201))).message).toBe(
      "Check the information you entered and try again.",
    );
  });

  it("hides router-generated messages and multi-line bodies", () => {
    expect(
      describeRouteError(response(404, new Error('No route matches URL "/x"'), true)),
    ).toEqual({
      status: 404,
      title: "Page not found",
      message: "This page doesn't exist or is no longer available.",
    });
    expect(
      describeRouteError(response(400, "Bad input\n    at handler (file:///app.js:1:1)"))
        .message,
    ).toBe("Check the information you entered and try again.");
  });

  it("never exposes server error details", () => {
    const fromResponse = describeRouteError(
      response(500, "PrismaClientKnownRequestError: duplicate key ShopSettings_shop_key"),
    );
    const fromError = describeRouteError(new Error("connection string postgres://secret"));

    for (const view of [fromResponse, fromError]) {
      expect(view.title).toBe("Something went wrong");
      expect(view.message).not.toMatch(/Prisma|postgres|duplicate/);
    }
    expect(fromResponse.status).toBe(500);
    expect(fromError.status).toBe(500);
  });

  it("keeps the upstream status for gateway errors", () => {
    expect(describeRouteError(response(503, "")).status).toBe(503);
  });
});
