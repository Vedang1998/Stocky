import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  readAllLocations,
  type CatalogAdminReadClient,
} from "../../../app/lib/catalog-facts/admin-read";
import type { FullSyncCanonicalObservation } from "../../../app/lib/catalog-facts/apply/types";
import { applyParsedJsonlBatch } from "../../../app/lib/catalog-facts/ingest/apply-batch";
import { applyCanonicalObservationBatches } from "../../../app/jobs/workers/catalog-facts/canonical-batch";
import {
  completeProductData,
  resetF3Rows,
  setupF3Database,
} from "./pr5-f3-test-helpers";

type Authority = Awaited<ReturnType<typeof setupF3Database>>["authority"];
const NOW = new Date("2026-09-05T12:00:00Z");

describe("PR5-F3 scale completeness fixtures", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let authority: Authority;

  beforeAll(async () => {
    ({ prisma, shopAId, authority } = await setupF3Database());
  }, 120_000);

  beforeEach(async () => {
    await resetF3Rows(prisma);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("FX-LOC-001 reads and persists all 55 locations across page two", async () => {
    let calls = 0;
    const admin: CatalogAdminReadClient = {
      async graphql(_query, options) {
        calls += 1;
        const after = options?.variables?.after;
        const start = after == null ? 1 : 51;
        const end = after == null ? 50 : 55;
        return {
          async json() {
            return {
              data: {
                locations: {
                  pageInfo: {
                    hasNextPage: end < 55,
                    endCursor: end < 55 ? "cursor-50" : "cursor-55",
                  },
                  edges: Array.from(
                    { length: end - start + 1 },
                    (_, offset) => {
                      const id = start + offset;
                      return {
                        node: {
                          id: `gid://shopify/Location/${id}`,
                          legacyResourceId: String(id),
                          name: `Location ${id}`,
                          isActive: true,
                          deactivatedAt: null,
                          fulfillsOnlineOrders: true,
                          shipsInventory: true,
                          hasActiveInventory: true,
                          isFulfillmentService: false,
                          address: {
                            address1: null,
                            city: null,
                            provinceCode: null,
                            countryCode: "US",
                            zip: null,
                          },
                          createdAt: "2026-09-01T00:00:00Z",
                          updatedAt: "2026-09-02T00:00:00Z",
                        },
                      };
                    },
                  ),
                },
              },
            };
          },
        };
      },
    };
    const locations = await readAllLocations(admin);
    const observations: FullSyncCanonicalObservation[] = locations.map(
      (location) => ({
        observationKind: "full_sync",
        identity: {
          shopId: shopAId,
          resourceKind: "Location",
          shopifyGid: location.id,
        },
        existenceKind: "LIVE_FULL_SYNC_PRESENT",
        existenceObservedAt: NOW,
        shopifyCreatedAt: new Date(location.shopifyCreatedAt),
        shopifyUpdatedAt: new Date(location.shopifyUpdatedAt),
        sourceKind: "FULL_SYNC",
        fenceGeneration: 1n,
        epochId: "locations-run",
        attributes: {
          name: location.name,
          isActive: location.isActive,
          deactivatedAt: null,
          fulfillsOnlineOrders: location.fulfillsOnlineOrders,
          shipsInventory: location.shipsInventory,
          isFulfillmentService: location.isFulfillmentService,
          hasActiveInventory: location.hasActiveInventory,
          address1: location.address1,
          city: location.city,
          provinceCode: location.provinceCode,
          countryCode: location.countryCode,
          zip: location.zip,
        },
      }),
    );
    await applyCanonicalObservationBatches({
      authority,
      observations,
      batchSize: 32,
      configuredWorstCaseConcurrentCanonicalTransactions: 50,
      assertProcessingEnabled: async () => undefined,
      project: false,
    });
    expect(calls).toBe(2);
    expect(locations).toHaveLength(55);
    expect(await prisma.shopifyLocationFact.count()).toBe(55);
  });

  it("FX-JSONL-004 persists 260 variants without a first:250 cap", async () => {
    await prisma.shopifyProductFact.create({
      data: completeProductData({ id: "1", shopId: shopAId }),
    });
    const lines = Array.from({ length: 260 }, (_, index) => {
      const id = index + 1;
      return {
        ordinal: id,
        resourceKind: "ProductVariant" as const,
        root: false,
        value: {
          id: `gid://shopify/ProductVariant/${id}`,
          legacyResourceId: String(id),
          __parentId: "gid://shopify/Product/1",
          title: `Variant ${id}`,
          displayName: `Variant ${id}`,
          sku: `SKU-${id}`,
          barcode: null,
          position: id,
          price: "19.99",
          compareAtPrice: null,
          selectedOptions: [{ name: "Title", value: String(id) }],
          createdAt: "2026-09-01T00:00:00Z",
          updatedAt: "2026-09-02T00:00:00Z",
          inventoryItem: {
            id: `gid://shopify/InventoryItem/${id}`,
            sku: `SKU-${id}`,
            tracked: true,
            requiresShipping: true,
            measurement: { weight: null },
            createdAt: "2026-09-01T00:00:00Z",
            updatedAt: "2026-09-02T00:00:00Z",
          },
        },
      };
    });
    const result = await applyParsedJsonlBatch({
      authority,
      domain: "catalog",
      batch: {
        startLineOrdinal: 1,
        endLineOrdinal: 260,
        lines,
      },
      syncRunId: "scale-run",
      bulkOperationGid: "gid://shopify/BulkOperation/scale",
      fenceGeneration: 10n,
      durableJobId: "scale-job",
      observedAt: NOW,
      currencyCode: "USD",
      unitCostAccess: "OMITTED_NO_PERMISSION",
      unitCostSelected: false,
      canonicalIdentitiesPerTransaction: 32,
      configuredWorstCaseConcurrentCanonicalTransactions: 50,
      assertProcessingEnabled: async () => undefined,
    });
    expect(result.results).toHaveLength(520);
    expect(await prisma.shopifyVariantFact.count()).toBe(260);
    expect(await prisma.shopifyInventoryItemFact.count()).toBe(260);
  }, 120_000);
});
