import { describe, expect, it } from "vitest";
import { adminActorFromSessionToken } from "./actor.server";
import { InventoryPermissionError } from "./errors";

describe("adminActorFromSessionToken", () => {
  it("names the staff member from the verified token subject", () => {
    expect(
      adminActorFromSessionToken({
        sub: "42",
        dest: "https://x.myshopify.com",
      }),
    ).toEqual({
      shopifyUserId: "42",
      displayName: null,
      channel: "ADMIN",
    });
  });

  it("refuses a write when the request names no staff member", () => {
    for (const token of [
      undefined,
      null,
      {},
      { sub: "" },
      { sub: 42 },
      { sub: "42; drop" },
    ]) {
      expect(() => adminActorFromSessionToken(token)).toThrow(
        InventoryPermissionError,
      );
    }
  });
});
