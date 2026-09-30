import { describe, expect, it } from "vitest";
import {
  classifyUnsupportedSub,
  requirePlatformActor,
  verifiedActorFromExactSub,
} from "../actor.server";
import { ActorBoundaryError } from "../errors.server";
import { SAFE_SUB, SHOP_A, WIDE_ROUNDED, WIDE_SUB } from "./authx-mock";

describe("actor identity (D-PR7-01 / PR7-ACT-003/005/018/022)", () => {
  it("persists the exact digit string sub (PR7-ACT-003)", () => {
    const actor = verifiedActorFromExactSub(SAFE_SUB, SHOP_A);
    expect(actor.shopifyUserId).toBe("548380009");
    expect(actor.kind).toBe("human");
  });

  it("preserves wide string identity without Number rounding (PR7-ACT-018)", () => {
    const actor = verifiedActorFromExactSub(WIDE_SUB, SHOP_A);
    expect(actor.shopifyUserId).toBe(WIDE_SUB);
    expect(Number(WIDE_SUB)).toBe(9007199254740992);
    expect(actor.shopifyUserId).not.toBe(String(Number(WIDE_SUB)));
  });

  it("keeps adjacent wide ids distinct (PR7-ACT-022 / AUTH-X-00)", () => {
    const a = verifiedActorFromExactSub(WIDE_ROUNDED, SHOP_A);
    const b = verifiedActorFromExactSub(WIDE_SUB, SHOP_A);
    expect(a.shopifyUserId).not.toBe(b.shopifyUserId);
    expect(Number(a.shopifyUserId)).toBe(Number(b.shopifyUserId));
  });

  it("treats numeric sub as unsupported, not a recovered actor (AUTH-X-03/05)", () => {
    expect(classifyUnsupportedSub(548380009)).toMatchObject({
      status: "unsupported",
      reason: "NUMERIC_SUB",
    });
    expect(classifyUnsupportedSub(Number(WIDE_SUB))).toMatchObject({
      status: "unsupported",
      reason: "NUMERIC_SUB",
    });
  });

  it("denies platform actions when actor is absent (PR7-ACT-005)", () => {
    expect(() =>
      requirePlatformActor({ status: "absent", reason: "NO_ID_TOKEN" }),
    ).toThrow(ActorBoundaryError);
    try {
      requirePlatformActor({ status: "absent", reason: "NO_ID_TOKEN" });
    } catch (error) {
      expect(error).toMatchObject({ code: "AUTH_PLATFORM_DENIED" });
    }
  });

  it("denies platform actions when sub is unsupported", () => {
    expect(() =>
      requirePlatformActor(classifyUnsupportedSub(548380009)),
    ).toThrowError(/verified exact-string actor/);
  });

  it("returns the verified actor for platform actions", () => {
    const actor = verifiedActorFromExactSub(SAFE_SUB, SHOP_A);
    expect(
      requirePlatformActor({ status: "verified", actor }),
    ).toEqual(actor);
  });
});
