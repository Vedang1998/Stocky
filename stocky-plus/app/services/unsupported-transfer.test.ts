import { describe, expect, it } from "vitest";
import {
  completeShopifyTransfer,
  UnsupportedShopifyOperationError,
} from "./shopify-sync.server";
import { featureFlags } from "../lib/feature-flags.server";

describe("Admin API 2025-10 transfer receive support", () => {
  it("keeps transfer writes disabled by default", () => {
    expect(featureFlags.transferWrites()).toBe(false);
  });

  it("fails safely without inventing inventoryTransferComplete", async () => {
    await expect(
      completeShopifyTransfer({} as never, "gid://shopify/InventoryTransfer/1"),
    ).rejects.toBeInstanceOf(UnsupportedShopifyOperationError);

    await expect(
      completeShopifyTransfer({} as never, "gid://shopify/InventoryTransfer/1"),
    ).rejects.toThrow(/unsupported/i);
  });
});
