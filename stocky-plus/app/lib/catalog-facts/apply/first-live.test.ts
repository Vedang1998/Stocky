import { describe, expect, it } from "vitest";
import { CanonicalApplyIncompleteFirstLiveError } from "./errors";
import { validateFirstLiveAttributes } from "./first-live";
import { DIAGNOSTIC, type CanonicalObservation } from "./types";

function baseDirect(
  identity: CanonicalObservation["identity"],
  attributes: CanonicalObservation["attributes"],
): CanonicalObservation {
  return {
    observationKind: "direct",
    observationToken: "tok",
    observationRequestGen: 1n,
    observationResponseGen: 2n,
    identity,
    existenceKind: "LIVE_REFETCH",
    existenceObservedAt: new Date("2026-08-17T00:00:00.000Z"),
    sourceKind: "INCREMENTAL_REFETCH",
    attributes,
  };
}

describe("PR5-F2B first-LIVE attribute contract", () => {
  it("accepts complete first-LIVE payloads for every resource kind", () => {
    expect(
      validateFirstLiveAttributes(
        baseDirect(
          { shopId: "s", resourceKind: "Product", shopifyGid: "gid://shopify/Product/1" },
          { title: "T", handle: "h", tags: [], status: "ACTIVE" },
        ),
      ).ok,
    ).toBe(true);
    expect(
      validateFirstLiveAttributes(
        baseDirect(
          { shopId: "s", resourceKind: "ProductVariant", shopifyGid: "gid://shopify/ProductVariant/1" },
          {
            shopifyProductGid: "gid://shopify/Product/1",
            title: "V",
            selectedOptions: [{ name: "Size", value: "M" }],
            priceAmount: "19.99",
            currencyCode: "USD",
          },
        ),
      ).ok,
    ).toBe(true);
    expect(
      validateFirstLiveAttributes(
        baseDirect(
          { shopId: "s", resourceKind: "InventoryItem", shopifyGid: "gid://shopify/InventoryItem/1" },
          { tracked: false, requiresShipping: false, unitCostAccess: "NULL" },
        ),
      ).ok,
    ).toBe(true);
    expect(
      validateFirstLiveAttributes(
        baseDirect(
          { shopId: "s", resourceKind: "Location", shopifyGid: "gid://shopify/Location/1" },
          {
            name: "L",
            isActive: false,
            fulfillsOnlineOrders: false,
            shipsInventory: false,
            isFulfillmentService: true,
            hasActiveInventory: false,
          },
        ),
      ).ok,
    ).toBe(true);
    expect(
      validateFirstLiveAttributes(
        baseDirect(
          {
            shopId: "s",
            resourceKind: "InventoryLevel",
            inventoryItemGid: "gid://shopify/InventoryItem/1",
            locationGid: "gid://shopify/Location/1",
          },
          { isActive: false },
        ),
      ).ok,
    ).toBe(true);
  });

  it("rejects missing required first-LIVE fields without synthesizing defaults", () => {
    const product = validateFirstLiveAttributes(
      baseDirect(
        { shopId: "s", resourceKind: "Product", shopifyGid: "gid://shopify/Product/1" },
        { handle: "h", tags: [], status: "ACTIVE" } as CanonicalObservation["attributes"],
      ),
    );
    expect(product.ok).toBe(false);
    if (!product.ok && product.kind === "incomplete") {
      expect(product.missing).toContain("title");
      expect(product.diagnostic).toBe(DIAGNOSTIC.INCOMPLETE_FIRST_LIVE);
      expect(product.error).toBeInstanceOf(CanonicalApplyIncompleteFirstLiveError);
    }

    const variant = validateFirstLiveAttributes(
      baseDirect(
        { shopId: "s", resourceKind: "ProductVariant", shopifyGid: "gid://shopify/ProductVariant/1" },
        {
          shopifyProductGid: "gid://shopify/Product/1",
          title: "V",
          selectedOptions: [],
          priceAmount: "1.00",
        } as CanonicalObservation["attributes"],
      ),
    );
    expect(variant.ok).toBe(false);
    if (!variant.ok && variant.kind === "incomplete") {
      expect(variant.missing).toContain("currencyCode");
    }

    const item = validateFirstLiveAttributes(
      baseDirect(
        { shopId: "s", resourceKind: "InventoryItem", shopifyGid: "gid://shopify/InventoryItem/1" },
        { requiresShipping: true, unitCostAccess: "NULL" } as CanonicalObservation["attributes"],
      ),
    );
    expect(item.ok).toBe(false);
    if (!item.ok && item.kind === "incomplete") {
      expect(item.missing).toContain("tracked");
    }

    const location = validateFirstLiveAttributes(
      baseDirect(
        { shopId: "s", resourceKind: "Location", shopifyGid: "gid://shopify/Location/1" },
        {
          name: "L",
          fulfillsOnlineOrders: true,
          shipsInventory: true,
          isFulfillmentService: false,
          hasActiveInventory: true,
        } as CanonicalObservation["attributes"],
      ),
    );
    expect(location.ok).toBe(false);
    if (!location.ok && location.kind === "incomplete") {
      expect(location.missing).toContain("isActive");
    }

    const level = validateFirstLiveAttributes(
      baseDirect(
        {
          shopId: "s",
          resourceKind: "InventoryLevel",
          inventoryItemGid: "gid://shopify/InventoryItem/1",
          locationGid: "gid://shopify/Location/1",
        },
        {},
      ),
    );
    expect(level.ok).toBe(false);
    if (!level.ok && level.kind === "incomplete") {
      expect(level.missing).toContain("isActive");
    }
  });

  it("does not require attributes for unseen ABSENT", () => {
    const observation: CanonicalObservation = {
      observationKind: "direct",
      observationToken: "tok",
      observationRequestGen: 1n,
      observationResponseGen: 2n,
      identity: { shopId: "s", resourceKind: "Product", shopifyGid: "gid://shopify/Product/1" },
      existenceKind: "ABSENT_CONFIRMED_QUERY",
      existenceObservedAt: new Date("2026-08-17T00:00:00.000Z"),
      sourceKind: "INCREMENTAL_REFETCH",
    };
    expect(validateFirstLiveAttributes(observation).ok).toBe(true);
  });
});
