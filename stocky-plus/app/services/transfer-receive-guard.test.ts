/**
 * Receiving a transfer must not change local receipt state or Shopify stock
 * unless ProPo itself moved the stock out: a signed-in staff member, the
 * transfer kill switch on, and no Shopify-managed transfer behind it.
 * The ledger-backed path is covered against PostgreSQL in
 * scripts/tenant-enforcement/tests/stocktake-transfer-ledger.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";
import { attachTenantDbContextMocks } from "../test-utils/prisma-tenant-context-mock";

const SHOP = "shop-a.myshopify.com";
const SHOP_ID = "shop-a-canonical-id";

const {
  prismaMock,
  authenticateAdmin,
  adminGraphql,
  resolveCanonicalShopByDomain,
} = vi.hoisted(() => {
  const prismaMock = {
    transferOrder: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    shopSettings: { findMany: vi.fn(), findFirst: vi.fn() },
    transferLineItem: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    shopifyVariantCache: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    $executeRaw: vi.fn(),
    $executeRawUnsafe: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $transaction: vi.fn(),
  };

  return {
    prismaMock,
    authenticateAdmin: vi.fn(),
    adminGraphql: vi.fn(),
    resolveCanonicalShopByDomain: vi.fn(),
  };
});

vi.mock("../db.server", () => ({ default: prismaMock }));

vi.mock("../shopify.server", () => ({
  authenticate: {
    admin: authenticateAdmin,
  },
}));

vi.mock("../tenant/bootstrap.server", () => ({
  shopifySessionStorage: {
    storeSession: vi.fn(),
    loadSession: vi.fn(),
    deleteSession: vi.fn(),
    deleteSessions: vi.fn(),
    findSessionsByShop: vi.fn(),
  },
  normalizeVerifiedShopifyDomain: (raw: string) => raw,
  resolveCanonicalShopByDomain,
  deleteSessionsForShop: vi.fn(),
  updateOfflineSessionScope: vi.fn(),
}));

vi.mock("./shopify-gql.server", () => ({
  fetchLocations: vi.fn(async () => []),
}));

function formRequest(fields: Record<string, string>): Request {
  const body = new URLSearchParams(fields);
  return new Request("https://example.com/app/transfers", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

function actionArgs(request: Request, id: string): ActionFunctionArgs {
  const params: Record<string, string> = { id };
  return { request, params, context: {} } as ActionFunctionArgs;
}

describe("transfer receive guard", () => {
  const previousTransferWrites = process.env.FEATURE_TRANSFER_WRITES;

  function signIn(sessionToken?: { sub: string }) {
    authenticateAdmin.mockResolvedValue({
      session: { shop: SHOP },
      ...(sessionToken ? { sessionToken } : {}),
      admin: { graphql: adminGraphql },
      redirect: vi.fn(),
    });
  }

  function expectNothingChanged() {
    expect(prismaMock.transferLineItem.update).not.toHaveBeenCalled();
    expect(prismaMock.transferOrder.update).not.toHaveBeenCalled();
    expect(prismaMock.transferOrder.updateMany).not.toHaveBeenCalled();
    expect(adminGraphql).not.toHaveBeenCalled();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    attachTenantDbContextMocks(prismaMock);
    // The shop's settings row records an active plan.
    prismaMock.shopSettings.findMany.mockResolvedValue([{ id: "settings-a" }]);
    prismaMock.shopSettings.findFirst.mockResolvedValue({
      subscriptionActive: true,
    });
    process.env.FEATURE_TRANSFER_WRITES = "true";
    signIn({ sub: "7001" });
    resolveCanonicalShopByDomain.mockResolvedValue({
      id: SHOP_ID,
      myshopifyDomain: SHOP,
    });
  });

  afterEach(() => {
    if (previousTransferWrites === undefined) {
      delete process.env.FEATURE_TRANSFER_WRITES;
    } else {
      process.env.FEATURE_TRANSFER_WRITES = previousTransferWrites;
    }
  });

  it("keeps transfer writes off unless the environment turns them on", async () => {
    delete process.env.FEATURE_TRANSFER_WRITES;
    const { featureFlags } = await import("../lib/feature-flags.server");
    expect(featureFlags.transferWrites()).toBe(false);
  });

  it.each(["receiveAll", "postReceipt", "close"])(
    "refuses to %s a transfer that was shipped as a Shopify transfer",
    async (intent) => {
      const { action } = await import("../routes/app.transfers_.$id");
      prismaMock.transferOrder.findFirst.mockResolvedValue({
        id: "tr-1",
        shop: SHOP,
        sourceLocationId: "gid://shopify/Location/1",
        destinationLocationId: "gid://shopify/Location/2",
        shopifyTransferId: "gid://shopify/InventoryTransfer/1",
        status: "IN_TRANSIT",
        lineItems: [
          {
            id: "tl-1",
            shopifyVariantId: "gid://shopify/ProductVariant/1",
            quantity: 4,
            pickedQty: 4,
            receivedQty: 0,
            pendingReceiveQty: 0,
            rejectedQty: 0,
            rejectNote: null,
            returnedQty: 0,
          },
        ],
      });

      const result = await action(
        actionArgs(formRequest({ intent, resolution: "WRITTEN_OFF" }), "tr-1"),
      );

      expect(result).toEqual({
        error: expect.stringContaining("Receive it in Shopify admin"),
        problems: [],
      });
      expectNothingChanged();
    },
  );

  it.each(["receiveAll", "postReceipt"])(
    "refuses to %s when the kill switch is off and says nothing was sent",
    async (intent) => {
      delete process.env.FEATURE_TRANSFER_WRITES;
      const { action } = await import("../routes/app.transfers_.$id");
      prismaMock.transferOrder.findFirst.mockResolvedValue({
        id: "tr-2",
        shop: SHOP,
        sourceLocationId: "gid://shopify/Location/1",
        destinationLocationId: "gid://shopify/Location/2",
        shopifyTransferId: null,
        status: "IN_TRANSIT",
        lineItems: [
          {
            id: "tl-2",
            shopifyVariantId: "gid://shopify/ProductVariant/2",
            quantity: 2,
            pickedQty: 2,
            receivedQty: 0,
            pendingReceiveQty: 2,
            rejectedQty: 0,
            rejectNote: null,
            returnedQty: 0,
          },
        ],
      });

      const result = await action(actionArgs(formRequest({ intent }), "tr-2"));

      expect(result).toEqual({
        error: expect.stringContaining("switched off"),
        problems: [],
      });
      expect((result as { error: string }).error).not.toMatch(/FEATURE_/);
      expectNothingChanged();
    },
  );

  it.each(["ship", "receiveAll", "postReceipt", "close"])(
    "refuses to %s without a signed-in staff member, before reading the transfer",
    async (intent) => {
      signIn();
      const { action } = await import("../routes/app.transfers_.$id");

      const result = await action(actionArgs(formRequest({ intent }), "tr-3"));

      expect(result).toEqual({
        error: expect.stringContaining("signed-in Shopify staff member"),
      });
      expect(prismaMock.transferOrder.findFirst).not.toHaveBeenCalled();
      expectNothingChanged();
    },
  );
});
