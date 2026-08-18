import { describe, expect, it } from "vitest";
import { featureFlags } from "../../feature-flags.server";
import {
  CATALOG_BULK_QUERY_NO_UNIT_COST,
  CATALOG_BULK_QUERY_WITH_UNIT_COST,
} from "./bulk-query-documents";
import {
  chooseCatalogBulkQuery,
  preflightUnitCostCapability,
} from "./unit-cost-preflight";
import { createMockAdmin } from "./__tests__/mock-admin";

const PROBE_ID = "gid://shopify/InventoryItem/30322695";

describe("PR5-F2A unitCost capability preflight", () => {
  it("does not enable FEATURE_COST_SYNC", () => {
    expect(featureFlags.costSync()).toBe(false);
  });

  it("selects the with-unitCost bulk document when the field is allowed and present", async () => {
    const admin = createMockAdmin(() => ({
      data: {
        inventoryItem: {
          id: PROBE_ID,
          unitCost: { amount: "19.99", currencyCode: "USD" },
        },
      },
    }));
    const result = await preflightUnitCostCapability(admin, PROBE_ID);
    expect(result.decision).toBe("ALLOWED");
    expect(result.unitCostAccess).toBe("PRESENT");
    expect(result.unitCostAmount).toBe("19.99");
    expect(result.catalogBulkQueryShape).toBe("with-unitCost");
    expect(result.failureKind).toBeNull();
    const chosen = chooseCatalogBulkQuery(result);
    expect(chosen.document).toBe(CATALOG_BULK_QUERY_WITH_UNIT_COST);
    expect(chosen.document).toContain("unitCost");
    expect(admin.calls[0]?.query).toContain("query CatalogFactUnitCostPreflight");
    expect(admin.calls[0]?.query).not.toContain("bulkOperationRunQuery");
  });

  it("keeps with-unitCost when the field is allowed and null", async () => {
    const admin = createMockAdmin(() => ({
      data: {
        inventoryItem: { id: PROBE_ID, unitCost: null },
      },
    }));
    const result = await preflightUnitCostCapability(admin, PROBE_ID);
    expect(result.decision).toBe("ALLOWED");
    expect(result.unitCostAccess).toBe("NULL");
    expect(result.catalogBulkQueryShape).toBe("with-unitCost");
    expect(result.failureKind).toBeNull();
  });

  it("does not abort the catalog read pipeline when unitCost is denied", async () => {
    const admin = createMockAdmin(() => ({
      data: {
        inventoryItem: { id: PROBE_ID, unitCost: null },
      },
      errors: [
        {
          message: "Access denied for unitCost field.",
          path: ["inventoryItem", "unitCost"],
          extensions: { code: "ACCESS_DENIED" },
        },
      ],
    }));
    const result = await preflightUnitCostCapability(admin, PROBE_ID);
    expect(result.decision).toBe("DENIED");
    expect(result.unitCostAccess).toBe("OMITTED_NO_PERMISSION");
    expect(result.catalogBulkQueryShape).toBe("no-unitCost");
    expect(result.failureKind).toBe("GRAPHQL");
    const chosen = chooseCatalogBulkQuery(result);
    expect(chosen.document).toBe(CATALOG_BULK_QUERY_NO_UNIT_COST);
    expect(chosen.document).not.toMatch(/\bunitCost\b/);
    expect(featureFlags.costSync()).toBe(false);
  });

  it("uses the no-unitCost document when the probe is unavailable", async () => {
    const admin = createMockAdmin(() => ({
      errors: [{ message: "Internal error" }],
    }));
    const result = await preflightUnitCostCapability(admin, PROBE_ID);
    expect(result.decision).toBe("UNAVAILABLE");
    expect(result.unitCostAccess).toBe("QUERY_ERROR_ISOLATED");
    expect(result.failureKind).toBe("GRAPHQL");
    expect(chooseCatalogBulkQuery(result).shape).toBe("no-unitCost");
  });

  it("does not classify a path-less access-denied message mentioning unitCost as DENIED", async () => {
    const admin = createMockAdmin(() => ({
      errors: [
        {
          message:
            "Access denied. Required access: `read_inventory` (needed for unitCost among others).",
        },
      ],
    }));
    const result = await preflightUnitCostCapability(admin, PROBE_ID);
    expect(result.decision).not.toBe("DENIED");
    expect(result.decision).toBe("UNAVAILABLE");
    expect(result.unitCostAccess).toBe("QUERY_ERROR_ISOLATED");
    expect(result.failureKind).toBe("GRAPHQL");
    expect(result.catalogBulkQueryShape).toBe("no-unitCost");
  });

  it("does not treat an unrelated ACCESS_DENIED path as unitCost DENIED", async () => {
    const admin = createMockAdmin(() => ({
      data: {
        inventoryItem: { id: PROBE_ID, unitCost: { amount: "1.00", currencyCode: "USD" } },
      },
      errors: [
        {
          message: "Access denied for sku field.",
          path: ["inventoryItem", "sku"],
          extensions: { code: "ACCESS_DENIED" },
        },
      ],
    }));
    const result = await preflightUnitCostCapability(admin, PROBE_ID);
    expect(result.decision).not.toBe("DENIED");
    expect(result.decision).toBe("UNAVAILABLE");
    expect(result.failureKind).toBe("GRAPHQL");
  });

  it("classifies a network failure as TRANSPORT rather than mapping integrity", async () => {
    const admin = createMockAdmin(() => {
      throw new Error("ECONNRESET");
    });
    const result = await preflightUnitCostCapability(admin, PROBE_ID);
    expect(result.decision).toBe("UNAVAILABLE");
    expect(result.unitCostAccess).toBe("QUERY_ERROR_ISOLATED");
    expect(result.failureKind).toBe("TRANSPORT");
    expect(result.catalogBulkQueryShape).toBe("no-unitCost");
  });

  it("classifies a numeric unitCost.amount as MAPPING_INTEGRITY", async () => {
    const admin = createMockAdmin(() => ({
      data: {
        inventoryItem: {
          id: PROBE_ID,
          unitCost: { amount: 3.5, currencyCode: "USD" },
        },
      },
    }));
    const result = await preflightUnitCostCapability(admin, PROBE_ID);
    expect(result.decision).toBe("UNAVAILABLE");
    expect(result.unitCostAccess).toBe("QUERY_ERROR_ISOLATED");
    expect(result.failureKind).toBe("MAPPING_INTEGRITY");
    expect(result.catalogBulkQueryShape).toBe("no-unitCost");
  });
});
