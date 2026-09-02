import { describe, expect, it } from "vitest";
import {
  CanonicalApplyIncompleteAuthoritativeAttributesError,
  CanonicalApplyIncompleteFirstLiveError,
  CanonicalApplyQuantityDomainError,
} from "./errors";
import {
  validateExistingAuthoritativeAttributes,
  validateFirstLiveAttributes,
  validateObservationQuantityColumns,
} from "./first-live";
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
          {
            title: "T",
            handle: "h",
            vendor: null,
            productType: null,
            tags: [],
            status: "ACTIVE",
            featuredMediaUrl: null,
          },
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
            displayName: null,
            selectedOptions: [{ name: "Size", value: "M" }],
            sku: null,
            barcode: null,
            priceAmount: "19.99",
            compareAtPriceAmount: null,
            currencyCode: "USD",
            position: null,
          },
        ),
      ).ok,
    ).toBe(true);
    expect(
      validateFirstLiveAttributes(
        baseDirect(
          { shopId: "s", resourceKind: "InventoryItem", shopifyGid: "gid://shopify/InventoryItem/1" },
          {
            shopifyVariantGid: null,
            sku: null,
            tracked: false,
            requiresShipping: false,
            weightValue: null,
            weightUnit: null,
            unitCostAmount: null,
            unitCostCurrencyCode: null,
            unitCostAccess: "NULL",
          },
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
            deactivatedAt: null,
            fulfillsOnlineOrders: false,
            shipsInventory: false,
            isFulfillmentService: true,
            hasActiveInventory: false,
            address1: null,
            city: null,
            provinceCode: null,
            countryCode: null,
            zip: null,
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
          { isActive: false, shopifyInventoryLevelGid: null },
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
      expect(level.missing).toContain("shopifyInventoryLevelGid");
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

  it("rejects empty identity/display strings and invalid selectedOptions without rejecting empty tags", () => {
    const title = validateFirstLiveAttributes(
      baseDirect(
        { shopId: "s", resourceKind: "Product", shopifyGid: "gid://shopify/Product/1" },
        {
          title: "",
          handle: "h",
          vendor: null,
          productType: null,
          tags: [],
          status: "ACTIVE",
          featuredMediaUrl: null,
        },
      ),
    );
    expect(title.ok).toBe(false);
    if (!title.ok && title.kind === "incomplete") expect(title.missing).toContain("title");

    const handle = validateFirstLiveAttributes(
      baseDirect(
        { shopId: "s", resourceKind: "Product", shopifyGid: "gid://shopify/Product/1" },
        {
          title: "T",
          handle: "",
          vendor: null,
          productType: null,
          tags: [],
          status: "ACTIVE",
          featuredMediaUrl: null,
        },
      ),
    );
    expect(handle.ok).toBe(false);
    if (!handle.ok && handle.kind === "incomplete") expect(handle.missing).toContain("handle");

    const locationName = validateFirstLiveAttributes(
      baseDirect(
        { shopId: "s", resourceKind: "Location", shopifyGid: "gid://shopify/Location/1" },
        {
          name: "",
          isActive: true,
          deactivatedAt: null,
          fulfillsOnlineOrders: true,
          shipsInventory: true,
          isFulfillmentService: false,
          hasActiveInventory: true,
          address1: null,
          city: null,
          provinceCode: null,
          countryCode: null,
          zip: null,
        },
      ),
    );
    expect(locationName.ok).toBe(false);
    if (!locationName.ok && locationName.kind === "incomplete") {
      expect(locationName.missing).toContain("name");
    }

    const selectedObject = validateFirstLiveAttributes(
      baseDirect(
        { shopId: "s", resourceKind: "ProductVariant", shopifyGid: "gid://shopify/ProductVariant/1" },
        {
          shopifyProductGid: "gid://shopify/Product/1",
          title: "V",
          displayName: null,
          selectedOptions: {},
          sku: null,
          barcode: null,
          priceAmount: "1.00",
          compareAtPriceAmount: null,
          currencyCode: "USD",
          position: null,
        },
      ),
    );
    expect(selectedObject.ok).toBe(false);
    if (!selectedObject.ok && selectedObject.kind === "incomplete") {
      expect(selectedObject.missing).toContain("selectedOptions");
    }

    const selectedEmpty = validateFirstLiveAttributes(
      baseDirect(
        { shopId: "s", resourceKind: "ProductVariant", shopifyGid: "gid://shopify/ProductVariant/1" },
        {
          shopifyProductGid: "gid://shopify/Product/1",
          title: "V",
          displayName: null,
          selectedOptions: [],
          sku: null,
          barcode: null,
          priceAmount: "1.00",
          compareAtPriceAmount: null,
          currencyCode: "USD",
          position: null,
        },
      ),
    );
    expect(selectedEmpty.ok).toBe(false);
    if (!selectedEmpty.ok && selectedEmpty.kind === "incomplete") {
      expect(selectedEmpty.missing).toContain("selectedOptions");
    }

    const tagsEmpty = validateFirstLiveAttributes(
      baseDirect(
        { shopId: "s", resourceKind: "Product", shopifyGid: "gid://shopify/Product/1" },
        {
          title: "T",
          handle: "h",
          vendor: null,
          productType: null,
          tags: [],
          status: "ACTIVE",
          featuredMediaUrl: null,
        },
      ),
    );
    expect(tagsEmpty.ok).toBe(true);

    const shopifyVariant = validateFirstLiveAttributes(
      baseDirect(
        { shopId: "s", resourceKind: "ProductVariant", shopifyGid: "gid://shopify/ProductVariant/1" },
        {
          shopifyProductGid: "gid://shopify/Product/1",
          title: "Default Title",
          displayName: null,
          selectedOptions: [{ name: "Title", value: "Default Title" }],
          sku: null,
          barcode: null,
          priceAmount: "0.00",
          compareAtPriceAmount: null,
          currencyCode: "USD",
          position: 1,
        },
      ),
    );
    expect(shopifyVariant.ok).toBe(true);
  });

  it("treats omitted existing-row attributes as incomplete without treating quantity-only InventoryLevel as a resource snapshot", () => {
    const omittedVendor = validateExistingAuthoritativeAttributes(
      baseDirect(
        { shopId: "s", resourceKind: "Product", shopifyGid: "gid://shopify/Product/1" },
        {
          title: "T2",
          handle: "h2",
          tags: [],
          status: "ACTIVE",
        } as CanonicalObservation["attributes"],
      ),
    );
    expect(omittedVendor.ok).toBe(false);
    if (!omittedVendor.ok && omittedVendor.kind === "incomplete") {
      expect(omittedVendor.diagnostic).toBe(DIAGNOSTIC.INCOMPLETE_AUTHORITATIVE);
      expect(omittedVendor.error).toBeInstanceOf(
        CanonicalApplyIncompleteAuthoritativeAttributesError,
      );
      expect(omittedVendor.missing).toContain("vendor");
    }

    const quantityOnly = validateExistingAuthoritativeAttributes(
      baseDirect(
        {
          shopId: "s",
          resourceKind: "InventoryLevel",
          inventoryItemGid: "gid://shopify/InventoryItem/1",
          locationGid: "gid://shopify/Location/1",
        },
        {
          quantities: [{ name: "available", quantity: 1, shopifyUpdatedAt: null }],
        },
      ),
    );
    expect(quantityOnly.ok).toBe(true);

    const existenceOnly = validateExistingAuthoritativeAttributes({
      observationKind: "direct",
      observationToken: "tok",
      observationRequestGen: 1n,
      observationResponseGen: 2n,
      identity: { shopId: "s", resourceKind: "Product", shopifyGid: "gid://shopify/Product/1" },
      existenceKind: "LIVE_REFETCH",
      existenceObservedAt: new Date("2026-08-17T00:00:00.000Z"),
      sourceKind: "INCREMENTAL_REFETCH",
    });
    expect(existenceOnly.ok).toBe(true);
  });

  it("rejects non-integer and out-of-range quantities before a writer can run", () => {
    const identity = {
      shopId: "s",
      resourceKind: "InventoryLevel" as const,
      inventoryItemGid: "gid://shopify/InventoryItem/1",
      locationGid: "gid://shopify/Location/1",
    };
    const cases: Array<{ quantity: number; label: string }> = [
      { quantity: 1.5, label: "fractional" },
      { quantity: Number.NaN, label: "NaN" },
      { quantity: Number.POSITIVE_INFINITY, label: "Infinity" },
      { quantity: 2147483648, label: "above int32" },
      { quantity: -2147483649, label: "below int32" },
    ];
    for (const testCase of cases) {
      const result = validateObservationQuantityColumns(
        baseDirect(identity, {
          quantities: [{ name: "available", quantity: testCase.quantity, shopifyUpdatedAt: null }],
        }),
      );
      expect(result.ok, testCase.label).toBe(false);
      if (!result.ok && result.kind === "quantity_domain") {
        expect(result.diagnostic).toBe(DIAGNOSTIC.QUANTITY_DOMAIN);
        expect(result.error).toBeInstanceOf(CanonicalApplyQuantityDomainError);
      }
    }
    expect(
      validateObservationQuantityColumns(
        baseDirect(identity, {
          quantities: [{ name: "available", quantity: null, shopifyUpdatedAt: null }],
        }),
      ).ok,
    ).toBe(true);
    expect(
      validateObservationQuantityColumns(
        baseDirect(identity, {
          quantities: [{ name: "onHand", quantity: 2147483647, shopifyUpdatedAt: null }],
        }),
      ).ok,
    ).toBe(true);
    expect(
      validateObservationQuantityColumns(
        baseDirect(identity, {
          isActive: true,
          shopifyInventoryLevelGid: null,
        }),
      ).ok,
    ).toBe(true);
  });
});
