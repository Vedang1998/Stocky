import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { CatalogAdminReadClient } from "../../../app/lib/catalog-facts/admin-read";
import {
  CatalogFactNotStoredError,
  applyCatalogFactWebhookRefetch,
  type CatalogFactAtomicWebhookTopic,
} from "../../../app/jobs/workers/catalog-facts/resource-refetch";
import {
  abandonDirectObservation,
  beginDirectObservation,
} from "../../../app/lib/catalog-facts/ingest/direct-observation";
import {
  completeLocationData,
  resetF3Rows,
  setupF3Database,
} from "./pr5-f3-test-helpers";

type Authority = Awaited<ReturnType<typeof setupF3Database>>["authority"];

const NOW = new Date("2026-11-11T00:02:00Z");
const CREATED_AT = "2026-11-11T00:01:58Z";

const PRODUCT_GID = "gid://shopify/Product/9001";
const VARIANT_GID = "gid://shopify/ProductVariant/9002";
const ITEM_GID = "gid://shopify/InventoryItem/9003";
const LOCATION_GIDS = [
  "gid://shopify/Location/9005",
  "gid://shopify/Location/9006",
] as const;

const QUANTITY_NAMES = [
  "available",
  "on_hand",
  "incoming",
  "committed",
  "reserved",
  "damaged",
  "safety_stock",
  "quality_control",
];

/**
 * Shopify's answers for one product that a merchant has just created as a
 * draft: one default variant, one tracked inventory item with no cost, stocked
 * at zero in both of the shop's locations.
 */
function newDraftProductAdmin(queries: string[] = []): CatalogAdminReadClient {
  return {
    async graphql(query, options) {
      const variables = (options?.variables ?? {}) as Record<string, unknown>;
      queries.push(/query (\w+)/.exec(query)?.[1] ?? query);
      return {
        async json() {
          if (query.includes("query CatalogFactLocation(")) {
            const locationGid = String(variables.id);
            return {
              data: {
                location: {
                  id: locationGid,
                  legacyResourceId: locationGid.split("/").pop(),
                  name: "My Custom Location",
                  isActive: true,
                  deactivatedAt: null,
                  fulfillsOnlineOrders: true,
                  shipsInventory: true,
                  hasActiveInventory: true,
                  fulfillmentService: null,
                  address: {
                    address1: null,
                    city: null,
                    provinceCode: null,
                    countryCode: "US",
                    zip: null,
                  },
                  createdAt: "2026-11-01T00:00:00Z",
                  updatedAt: "2026-11-01T00:00:00Z",
                },
              },
            };
          }
          if (query.includes("query CatalogFactProductVariantIds")) {
            return {
              data: {
                product: {
                  id: PRODUCT_GID,
                  variants: {
                    pageInfo: { hasNextPage: false, endCursor: "c1" },
                    edges: [{ cursor: "c1", node: { id: VARIANT_GID } }],
                  },
                },
              },
            };
          }
          if (query.includes("query CatalogFactProductVariant(")) {
            return {
              data: {
                productVariant: {
                  id: VARIANT_GID,
                  legacyResourceId: "9002",
                  title: "Default Title",
                  displayName: "E2E Temp Product - Default Title",
                  sku: null,
                  barcode: null,
                  position: 1,
                  price: "0.00",
                  compareAtPrice: null,
                  selectedOptions: [{ name: "Title", value: "Default Title" }],
                  product: { id: PRODUCT_GID },
                  inventoryItem: { id: ITEM_GID },
                  createdAt: CREATED_AT,
                  updatedAt: CREATED_AT,
                },
              },
            };
          }
          if (query.includes("query CatalogFactProduct(")) {
            return {
              data: {
                product: {
                  id: PRODUCT_GID,
                  legacyResourceId: "9001",
                  title: "E2E Temp Product",
                  handle: "e2e-temp-product",
                  vendor: "stocky-test-store",
                  productType: "",
                  tags: [],
                  status: "DRAFT",
                  featuredMedia: null,
                  createdAt: CREATED_AT,
                  updatedAt: CREATED_AT,
                },
              },
            };
          }
          if (query.includes("query CatalogFactShopCurrency")) {
            return { data: { shop: { currencyCode: "USD" } } };
          }
          if (query.includes("query CatalogFactInventoryItem(")) {
            return {
              data: {
                inventoryItem: {
                  id: ITEM_GID,
                  legacyResourceId: "9003",
                  sku: null,
                  tracked: true,
                  requiresShipping: true,
                  measurement: { weight: { value: 0.0, unit: "KILOGRAMS" } },
                  unitCost: null,
                  variants: { nodes: [{ id: VARIANT_GID }] },
                  createdAt: CREATED_AT,
                  updatedAt: CREATED_AT,
                },
              },
            };
          }
          if (query.includes("query CatalogFactInventoryLevelByPair")) {
            const locationGid = String(variables.locationId);
            return {
              data: {
                inventoryItem: {
                  id: ITEM_GID,
                  inventoryLevel: {
                    id: `gid://shopify/InventoryLevel/${locationGid.split("/").pop()}?inventory_item_id=9003`,
                    isActive: true,
                    createdAt: CREATED_AT,
                    updatedAt: CREATED_AT,
                    item: { id: ITEM_GID },
                    location: { id: locationGid },
                    quantities: QUANTITY_NAMES.map((name) => ({
                      name,
                      quantity: 0,
                      updatedAt: CREATED_AT,
                    })),
                  },
                },
              },
            };
          }
          throw new Error(`unexpected query ${query}`);
        },
      };
    },
  };
}

type Delivery = {
  topic: CatalogFactAtomicWebhookTopic;
  payload: Record<string, unknown>;
};

const PRODUCT_CREATE: Delivery = {
  topic: "products/create",
  payload: { id: 9001, admin_graphql_api_id: PRODUCT_GID },
};
const ITEM_CREATE: Delivery = {
  topic: "inventory_items/create",
  payload: { id: 9003, admin_graphql_api_id: ITEM_GID },
};
const LEVEL_CONNECT: Delivery[] = [9005, 9006].map((locationId) => ({
  topic: "inventory_levels/connect",
  payload: { inventory_item_id: 9003, location_id: locationId, available: 0 },
}));

describe("webhooks for a product created after install (#94)", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let authority: Authority;
  let sequence = 0;

  beforeAll(async () => {
    ({ prisma, shopAId, authority } = await setupF3Database());
    process.env.STOCKY_DISPATCHER_PROCESS_COUNT = "1";
  }, 120_000);

  beforeEach(async () => {
    delete process.env.FEATURE_PR5_ABSENCE_TOMBSTONE;
    await resetF3Rows(prisma);
  });

  afterAll(async () => {
    delete process.env.STOCKY_DISPATCHER_PROCESS_COUNT;
    await prisma?.$disconnect();
  });

  /** The shop's locations are already known from the sync that ran at install. */
  async function seedLocations() {
    await prisma.shopifyLocationFact.createMany({
      data: ["9005", "9006"].map((id) =>
        completeLocationData({ id, shopId: shopAId }),
      ),
    });
  }

  function job(delivery: Delivery, id: string, queries?: string[]) {
    return {
      authority,
      admin: newDraftProductAdmin(queries),
      topic: delivery.topic,
      payload: delivery.payload,
      durableJobId: `job-${id}`,
      rootDurableJobId: `job-${id}`,
      attemptId: `attempt-${id}`,
      correlationId: `corr-${id}`,
      signalDeliveryId: `delivery-${id}`,
      signalReceivedAt: NOW,
      applicationKey: `webhook-delivery:${id}`,
      leaseDurationMs: 60_000,
      canonicalBatchSize: 32,
      configuredWorstCaseConcurrentCanonicalTransactions: 50,
    };
  }

  async function deliver(delivery: Delivery, queries?: string[]) {
    sequence += 1;
    return applyCatalogFactWebhookRefetch(
      job(delivery, `new-${sequence}`, queries),
    );
  }

  async function openReads() {
    return prisma.catalogObservationInFlight.count({
      where: {
        shopId: shopAId,
        lifecycleState: "ACTIVE",
        observationResponseGen: null,
      },
    });
  }

  async function expectWholeProductIngested() {
    const item = await prisma.shopifyInventoryItemFact.findUniqueOrThrow({
      where: { shopId_shopifyGid: { shopId: shopAId, shopifyGid: ITEM_GID } },
    });
    expect(item.existenceState).toBe("LIVE");
    expect(item.shopifyVariantGid).toBe(VARIANT_GID);
    expect(item.tracked).toBe(true);

    const levels = await prisma.shopifyInventoryLevelFact.findMany({
      where: { shopId: shopAId, inventoryItemGid: ITEM_GID },
      orderBy: { locationGid: "asc" },
    });
    expect(levels.map((level) => level.locationGid)).toEqual([
      ...LOCATION_GIDS,
    ]);
    for (const level of levels) {
      expect(level.existenceState).toBe("LIVE");
      expect(level.availableQuantity).toBe(0);
    }

    expect(
      await prisma.shopifyProductFact.count({
        where: { shopId: shopAId, shopifyGid: PRODUCT_GID },
      }),
    ).toBe(1);
    expect(
      await prisma.shopifyVariantFact.count({
        where: { shopId: shopAId, shopifyGid: VARIANT_GID },
      }),
    ).toBe(1);
    expect(await openReads()).toBe(0);
  }

  it.each([
    {
      order: "product, item, levels (the order Shopify usually sends)",
      deliveries: [PRODUCT_CREATE, ITEM_CREATE, ...LEVEL_CONNECT],
    },
    {
      order: "item, levels, product",
      deliveries: [ITEM_CREATE, ...LEVEL_CONNECT, PRODUCT_CREATE],
    },
    {
      order: "levels, item, product",
      deliveries: [...LEVEL_CONNECT, ITEM_CREATE, PRODUCT_CREATE],
    },
    {
      order: "one level, product, item, other level",
      deliveries: [
        LEVEL_CONNECT[0],
        PRODUCT_CREATE,
        ITEM_CREATE,
        LEVEL_CONNECT[1],
      ],
    },
  ])(
    "creates item and level facts when delivered as $order",
    async ({ deliveries }) => {
      await seedLocations();
      for (const delivery of deliveries) {
        const result = await deliver(delivery);
        expect(result.applicationStatus).toBe("applied");
      }
      await expectWholeProductIngested();
    },
  );

  it("ingests the whole product from one level webhook when every other webhook is lost", async () => {
    const result = await deliver(LEVEL_CONNECT[0]);
    expect(result.applicationStatus).toBe("applied");

    expect(
      await prisma.shopifyInventoryLevelFact.count({
        where: { shopId: shopAId, inventoryItemGid: ITEM_GID },
      }),
    ).toBe(1);
    for (const count of [
      prisma.shopifyProductFact.count({ where: { shopifyGid: PRODUCT_GID } }),
      prisma.shopifyVariantFact.count({ where: { shopifyGid: VARIANT_GID } }),
      prisma.shopifyInventoryItemFact.count({
        where: { shopifyGid: ITEM_GID },
      }),
      prisma.shopifyLocationFact.count({
        where: { shopifyGid: LOCATION_GIDS[0] },
      }),
    ]) {
      expect(await count).toBe(1);
    }
    expect(await openReads()).toBe(0);
  });

  it("does not read a parent again when its fact is already stored", async () => {
    await seedLocations();
    await deliver(PRODUCT_CREATE);

    const itemQueries: string[] = [];
    await deliver(ITEM_CREATE, itemQueries);
    expect(itemQueries).toEqual(["CatalogFactInventoryItem"]);

    const levelQueries: string[] = [];
    await deliver(LEVEL_CONNECT[0], levelQueries);
    expect(levelQueries).toEqual(["CatalogFactInventoryLevelByPair"]);
  });

  it("fails without a receipt while another read of the item is in flight, and the retry stores the item", async () => {
    await seedLocations();
    await deliver(PRODUCT_CREATE);
    const otherJobsRead = await beginDirectObservation(authority, {
      identity: {
        shopId: shopAId,
        resourceKind: "InventoryItem",
        shopifyGid: ITEM_GID,
      },
      leaseDurationMs: 60_000,
    });

    const receiptsBefore = await prisma.syncApplicationReceipt.count();
    await expect(
      applyCatalogFactWebhookRefetch(job(ITEM_CREATE, "blocked-item")),
    ).rejects.toBeInstanceOf(CatalogFactNotStoredError);
    expect(await prisma.syncApplicationReceipt.count()).toBe(receiptsBefore);
    expect(
      await prisma.shopifyInventoryItemFact.count({
        where: { shopifyGid: ITEM_GID },
      }),
    ).toBe(0);
    // Only the other job's read is still open; the failed attempt gave its own back.
    expect(await openReads()).toBe(1);

    await abandonDirectObservation(authority, otherJobsRead);
    const retry = await applyCatalogFactWebhookRefetch(
      job(ITEM_CREATE, "blocked-item"),
    );
    expect(retry.applicationStatus).toBe("applied");
    expect(
      await prisma.shopifyInventoryItemFact.count({
        where: { shopifyGid: ITEM_GID },
      }),
    ).toBe(1);
    expect(await openReads()).toBe(0);
  });

  it("gives its reads back when Shopify fails part-way through a product", async () => {
    const failingVariantRead = async () => {
      throw new Error("shopify_unavailable");
    };
    await expect(
      applyCatalogFactWebhookRefetch({
        ...job(PRODUCT_CREATE, "variant-read-fails"),
        reads: { readVariant: failingVariantRead },
      }),
    ).rejects.toThrow("shopify_unavailable");
    expect(await openReads()).toBe(0);

    const retry = await applyCatalogFactWebhookRefetch(
      job(PRODUCT_CREATE, "variant-read-fails"),
    );
    expect(retry.applicationStatus).toBe("applied");
    expect(
      await prisma.shopifyVariantFact.count({
        where: { shopifyGid: VARIANT_GID },
      }),
    ).toBe(1);
  });
});
