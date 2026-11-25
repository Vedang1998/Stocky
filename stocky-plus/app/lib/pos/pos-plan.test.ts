import { describe, expect, it, vi } from "vitest";

const requireActivePlanSnapshot = vi.fn();
vi.mock("../../billing/entitlements.server", () => ({
  requireActivePlanSnapshot: (...args: unknown[]) => requireActivePlanSnapshot(...args),
}));

const { POS_NO_PLAN_MESSAGE, requirePosPlan } = await import("./pos-plan.server");
const { PosApiError } = await import("./pos-api.server");

const db = {} as never;

describe("requirePosPlan", () => {
  it("passes when the shop has an active plan", async () => {
    requireActivePlanSnapshot.mockResolvedValueOnce(undefined);
    await expect(requirePosPlan(db)).resolves.toBeUndefined();
  });

  it("turns the plain-text 403 into a POS error that carries a POS-readable message", async () => {
    requireActivePlanSnapshot.mockRejectedValueOnce(new Response("no plan", { status: 403 }));
    const error = await requirePosPlan(db).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(PosApiError);
    expect(error).toMatchObject({ status: 403, code: "forbidden", message: POS_NO_PLAN_MESSAGE });
  });

  it("lets any other failure through", async () => {
    const failure = new Error("database down");
    requireActivePlanSnapshot.mockRejectedValueOnce(failure);
    await expect(requirePosPlan(db)).rejects.toBe(failure);
  });
});
