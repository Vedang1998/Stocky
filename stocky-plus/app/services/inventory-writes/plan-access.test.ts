import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantDb } from "../../tenant/tenant-db.server";

const { requireActivePlanSnapshot } = vi.hoisted(() => ({
  requireActivePlanSnapshot: vi.fn(),
}));

vi.mock("../../billing/entitlements.server", () => ({
  requireActivePlanSnapshot,
}));

import { planAllowsChanges } from "./plan-access.server";

const db = { tenant: "shop-a" } as unknown as TenantDb;

describe("planAllowsChanges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is true when the plan gate lets the shop through", async () => {
    requireActivePlanSnapshot.mockResolvedValue(undefined);

    expect(await planAllowsChanges(db)).toBe(true);
    expect(requireActivePlanSnapshot).toHaveBeenCalledWith(db);
  });

  it("is false when the plan gate refuses the shop", async () => {
    requireActivePlanSnapshot.mockRejectedValue(
      new Response("An active ProPo plan is required.", { status: 403 }),
    );

    expect(await planAllowsChanges(db)).toBe(false);
  });

  it("passes on any other response the gate throws", async () => {
    const elsewhere = new Response(null, {
      status: 302,
      headers: { Location: "/auth/login" },
    });
    requireActivePlanSnapshot.mockRejectedValue(elsewhere);

    await expect(planAllowsChanges(db)).rejects.toBe(elsewhere);
  });

  it("passes on a failure to read the plan", async () => {
    requireActivePlanSnapshot.mockRejectedValue(new Error("connection lost"));

    await expect(planAllowsChanges(db)).rejects.toThrow("connection lost");
  });
});
