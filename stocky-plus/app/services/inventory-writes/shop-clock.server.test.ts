import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TenantAuthority } from "../../tenant/authority.server";

const readShopReportingProfile = vi.hoisted(() => vi.fn());
vi.mock("../../tenant/bootstrap.server", () => ({ readShopReportingProfile }));

import { readShopTimeZone } from "./shop-clock.server";

const tenant = { shop: "shop-a.myshopify.com" } as unknown as TenantAuthority;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("readShopTimeZone", () => {
  it("reads the stored zone of the shop the request is signed in to", async () => {
    readShopReportingProfile.mockResolvedValue({
      ianaTimezone: "America/Toronto",
    });

    await expect(readShopTimeZone(tenant)).resolves.toBe("America/Toronto");
    expect(readShopReportingProfile).toHaveBeenCalledTimes(1);
    expect(readShopReportingProfile).toHaveBeenCalledWith(tenant);
  });

  it.each([null, "", "Mars/Olympus"])(
    "has no zone when the stored one is %j",
    async (ianaTimezone) => {
      readShopReportingProfile.mockResolvedValue({ ianaTimezone });

      await expect(readShopTimeZone(tenant)).resolves.toBeNull();
    },
  );

  it("does not hide a failure to read the shop", async () => {
    readShopReportingProfile.mockRejectedValue(new Error("connection lost"));

    await expect(readShopTimeZone(tenant)).rejects.toThrow("connection lost");
  });
});
