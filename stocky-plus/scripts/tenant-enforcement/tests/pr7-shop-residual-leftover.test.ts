/**
 * F-01 processor: leftover merchant rows must yield INCOMPLETE.
 * Erasure is mocked so DELETE cannot hide the leftover.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { resetSchemaAndApplyEnforcement } from "./helpers";
import { resetControlPlanePrismaForTests } from "../../../app/sync/control-plane-db.server";

vi.mock("../../../app/privacy/erasure-db.server", () => ({
  withPrivacyPrincipal: vi.fn(async () => undefined),
}));

const { processPrivacyRequest } = await import(
  "../../../app/privacy/execute.server"
);

describe("PR7 shop residual leftover processor (F-01)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK ??= "1";
    process.env.NODE_ENV ??= "test";
    ({ prisma } = await resetSchemaAndApplyEnforcement());
    await resetControlPlanePrismaForTests();
  }, 240_000);

  afterAll(async () => {
    await resetControlPlanePrismaForTests();
    await prisma?.$disconnect();
  });

  it("leftover AuditEvent after skipped erasure is INCOMPLETE (positive leftover)", async () => {
    const shopId = randomUUID();
    const domain = `pr7-left-${shopId}.myshopify.com`;
    await prisma.shop.create({
      data: {
        id: shopId,
        myshopifyDomain: domain,
        processingEnabled: false,
        processingDisabledReason: "UNINSTALLED",
      },
    });
    const generationId = randomUUID();
    await prisma.shopInstallGeneration.create({
      data: {
        id: generationId,
        canonicalDomain: domain,
        targetShopId: shopId,
        shopRowId: shopId,
        fence: "LIVE",
      },
    });
    await prisma.auditEvent.create({
      data: { shopId, customerRestId: "88", action: "still-there" },
    });
    const requestId = randomUUID();
    const attemptId = randomUUID();
    await prisma.privacyRequest.create({
      data: {
        id: requestId,
        topic: "shop/redact",
        state: "RECEIVED",
        targetShopId: shopId,
        generationId,
        shopRowId: shopId,
        canonicalDomain: domain,
        workId: randomUUID(),
        deadlineAt: new Date(Date.now() + 86_400_000),
      },
    });
    await prisma.privacyAttempt.create({
      data: {
        id: attemptId,
        privacyRequestId: requestId,
        epoch: 1,
        state: "RUNNING",
        leaseUntil: new Date(Date.now() + 3_600_000),
      },
    });
    await prisma.privacyRequest.update({
      where: { id: requestId },
      data: { activeAttemptId: attemptId },
    });
    const result = await processPrivacyRequest(requestId, attemptId);
    expect(result.state).toBe("INCOMPLETE");
    expect(result.incomplete).toBe(true);
    expect(result.detail).toBe("shop_residual_visible");
    expect(result.residualCount).toBeGreaterThan(0);
  });

  it("erasure mock is the skipped-delete control (negative)", async () => {
    const { withPrivacyPrincipal } = await import(
      "../../../app/privacy/erasure-db.server"
    );
    expect(vi.isMockFunction(withPrivacyPrincipal)).toBe(true);
  });
});
