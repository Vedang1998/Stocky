/**
 * Transfer receive must not mutate local receipt state when Shopify
 * completion is unsupported (Admin API 2025-10). Covers both present and
 * absent shopifyTransferId. FEATURE_TRANSFER_WRITES remains default OFF in
 * production; these cases enable the flag only to exercise the receive path.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";
import { UnsupportedShopifyOperationError } from "./shopify-sync.server";

const SHOP = "shop-a.myshopify.com";
const SHOP_ID = "shop-a-canonical-id";

const {
  prismaMock,
  authenticateAdmin,
  completeShopifyTransfer,
  createShopifyTransfer,
  resolveCanonicalShopByDomain,
} = vi.hoisted(() => {
  const prismaMock = {
    transferOrder: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    transferLineItem: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    shopifyVariantCache: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  return {
    prismaMock,
    authenticateAdmin: vi.fn(),
    completeShopifyTransfer: vi.fn(),
    createShopifyTransfer: vi.fn(),
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
  updateSessionScope: vi.fn(),
}));

vi.mock("./shopify-gql.server", () => ({
  fetchLocations: vi.fn(async () => []),
}));

vi.mock("./shopify-sync.server", async () => {
  const actual = await vi.importActual<typeof import("./shopify-sync.server")>(
    "./shopify-sync.server",
  );
  return {
    ...actual,
    createShopifyTransfer,
    markShopifyTransferReadyToShip: vi.fn(),
    completeShopifyTransfer,
  };
});

function formRequest(fields: Record<string, string>): Request {
  const body = new URLSearchParams(fields);
  return new Request("https://example.com/app/transfers", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

function actionArgs(request: Request): ActionFunctionArgs {
  return { request, params: {}, context: {} } as ActionFunctionArgs;
}

describe("transfer receive guard (unsupported Shopify completion)", () => {
  const previousTransferWrites = process.env.FEATURE_TRANSFER_WRITES;

  beforeEach(() => {
    vi.clearAllMocks();
    // Enable only for these receive-path cases (assertInventoryWriteEnabled
    // reads process.env). Defaults remain OFF outside this suite.
    process.env.FEATURE_TRANSFER_WRITES = "true";
    authenticateAdmin.mockResolvedValue({
      session: { shop: SHOP },
      admin: { graphql: vi.fn() },
      redirect: vi.fn(),
    });
    resolveCanonicalShopByDomain.mockResolvedValue({
      id: SHOP_ID,
      myshopifyDomain: SHOP,
    });
    completeShopifyTransfer.mockImplementation(async () => {
      throw new UnsupportedShopifyOperationError(
        "completeShopifyTransfer",
        "Admin GraphQL 2025-10 has no inventoryTransferComplete (or equivalent receive) mutation. Transfer receive remains disabled.",
      );
    });
  });

  afterEach(() => {
    if (previousTransferWrites === undefined) {
      delete process.env.FEATURE_TRANSFER_WRITES;
    } else {
      process.env.FEATURE_TRANSFER_WRITES = previousTransferWrites;
    }
  });

  it("documents transferWrites remains gated by env default OFF", async () => {
    const previous = process.env.FEATURE_TRANSFER_WRITES;
    delete process.env.FEATURE_TRANSFER_WRITES;
    const { featureFlags } = await import("../lib/feature-flags.server");
    expect(featureFlags.transferWrites()).toBe(false);
    if (previous === undefined) {
      delete process.env.FEATURE_TRANSFER_WRITES;
    } else {
      process.env.FEATURE_TRANSFER_WRITES = previous;
    }
  });

  it("does not mutate locally when Shopify transfer id is present and complete is unsupported", async () => {
    const { action } = await import("../routes/app.transfers");
    prismaMock.transferOrder.findFirst.mockResolvedValue({
      id: "tr-1",
      shop: SHOP,
      shopifyTransferId: "gid://shopify/InventoryTransfer/1",
      status: "IN_TRANSIT",
      lineItems: [
        { id: "tl-1", quantity: 4, pickedQty: 4, receivedQty: 0 },
      ],
    });

    const result = await action(
      actionArgs(formRequest({ intent: "receive", transferId: "tr-1" })),
    );

    expect(completeShopifyTransfer).toHaveBeenCalledWith(
      expect.anything(),
      "gid://shopify/InventoryTransfer/1",
    );
    expect(result).toEqual({
      error: expect.stringMatching(/unsupported/i),
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.transferLineItem.update).not.toHaveBeenCalled();
    expect(prismaMock.transferOrder.update).not.toHaveBeenCalled();
  });

  it("does not mutate locally when Shopify transfer id is absent", async () => {
    const { action } = await import("../routes/app.transfers");
    prismaMock.transferOrder.findFirst.mockResolvedValue({
      id: "tr-2",
      shop: SHOP,
      shopifyTransferId: null,
      status: "IN_TRANSIT",
      lineItems: [
        { id: "tl-2", quantity: 2, pickedQty: 2, receivedQty: 0 },
      ],
    });

    const result = await action(
      actionArgs(formRequest({ intent: "receive", transferId: "tr-2" })),
    );

    expect(completeShopifyTransfer).toHaveBeenCalledWith(
      expect.anything(),
      "missing-shopify-transfer-id",
    );
    expect(result).toEqual({
      error: expect.stringMatching(/unsupported/i),
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.transferLineItem.update).not.toHaveBeenCalled();
    expect(prismaMock.transferOrder.update).not.toHaveBeenCalled();
  });

  it("returns a clear unsupported-operation response to the merchant", async () => {
    const { action } = await import("../routes/app.transfers");
    prismaMock.transferOrder.findFirst.mockResolvedValue({
      id: "tr-3",
      shop: SHOP,
      shopifyTransferId: "gid://shopify/InventoryTransfer/9",
      status: "IN_TRANSIT",
      lineItems: [],
    });

    const result = await action(
      actionArgs(formRequest({ intent: "receive", transferId: "tr-3" })),
    );

    expect(result).toMatchObject({
      error: expect.stringContaining("completeShopifyTransfer is unsupported"),
    });
  });
});
