import { describe, expect, it, vi } from "vitest";
import type { PrivacyRequest } from "@prisma/client";

const controlPlane = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../sync/control-plane-db.server", () => ({
  getControlPlanePrisma: () => controlPlane.current,
}));

import {
  erasureErrorCode,
  processShopRedactRequest,
  retryDelayMs,
} from "./erasure.server";

describe("erasure retry policy", () => {
  it("backs off from one minute to six hours", () => {
    expect([1, 2, 3, 4, 5, 6, 40].map(retryDelayMs)).toEqual([
      60_000,
      300_000,
      1_800_000,
      7_200_000,
      21_600_000,
      21_600_000,
      21_600_000,
    ]);
    expect(retryDelayMs(0)).toBe(60_000);
  });

  it("names database refusals and keeps other errors free of detail", () => {
    expect(
      erasureErrorCode(
        new Error("stocky_privacy_erasure_refused: shop is not marked REDACTED"),
      ),
    ).toBe("erasure_refused");
    expect(
      erasureErrorCode(
        new Error(
          'stocky_privacy_erasure_stalled: rows in "Supplier" are still referenced',
        ),
      ),
    ).toBe("erasure_stalled");
    expect(
      erasureErrorCode(new Error("stocky_privacy_erasure_incomplete")),
    ).toBe("erasure_incomplete");
    expect(
      erasureErrorCode(Object.assign(new Error("timeout"), { code: "P2024" })),
    ).toBe("error_P2024");
    expect(
      erasureErrorCode(
        Object.assign(new Error("x"), { code: "postgres://user:pw@host/db" }),
      ),
    ).toBe("unexpected_error");
    expect(erasureErrorCode("connection lost")).toBe("unexpected_error");
  });
});

describe("erasure evidence", () => {
  it("does not record a shop as erased while its row still exists", async () => {
    const updates: Array<Record<string, unknown>> = [];
    controlPlane.current = {
      shop: {
        updateMany: async () => ({ count: 1 }),
        // The database function reported nothing left, yet the row is there.
        findUnique: async () => ({ id: "shop-1" }),
      },
      $queryRaw: async () => [{ deleted: 0n }],
      privacyRequest: {
        update: async (args: { data: Record<string, unknown> }) => {
          updates.push(args.data);
        },
      },
    };
    const now = new Date("2026-11-11T12:00:00Z");
    const request = {
      id: "request-1",
      shopRecordId: "shop-1",
      shopDomain: "evidence.myshopify.com",
      attempts: 1,
      erasedRows: null,
    } as PrivacyRequest;

    const outcome = await processShopRedactRequest(
      request,
      { deleteSessions: async () => 0, purgeQueuedJobs: async () => 0 },
      now,
    );

    expect(outcome).toEqual({
      status: "failed",
      errorCode: "erasure_incomplete",
    });
    expect(updates).toEqual([
      {
        lastErrorCode: "erasure_incomplete",
        nextAttemptAt: new Date(now.getTime() + 60_000),
      },
    ]);
  });
});
