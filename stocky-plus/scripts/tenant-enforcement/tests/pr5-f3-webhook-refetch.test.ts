import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { CatalogAdminReadClient } from "../../../app/lib/catalog-facts/admin-read";
import {
  CATALOG_FACT_ATOMIC_WEBHOOK_TOPICS,
  applyCatalogFactWebhookRefetch,
  catalogRefetchApplicationDigest,
  isCatalogFactAtomicWebhookTopic,
  resolveCatalogWebhookIdentity,
} from "../../../app/jobs/workers/catalog-facts/resource-refetch";
import { runCatalogFactsSyncStep } from "../../../app/jobs/workers/catalog-facts/catalog-sync";
import { resetF3Rows, setupF3Database } from "./pr5-f3-test-helpers";

type Authority = Awaited<ReturnType<typeof setupF3Database>>["authority"];

const NOW = new Date("2026-09-05T12:00:00Z");

function variantIdsResponse(ids: number[], hasNextPage = false) {
  return {
    data: {
      product: {
        id: "gid://shopify/Product/1",
        variants: {
          pageInfo: {
            hasNextPage,
            endCursor: ids.length ? `c${ids[ids.length - 1]}` : null,
          },
          edges: ids.map((id) => ({
            cursor: `c${id}`,
            node: { id: `gid://shopify/ProductVariant/${id}` },
          })),
        },
      },
    },
  };
}

function variantResponse(id: number, updatedAt = "2026-09-05T10:00:00Z") {
  return {
    data: {
      productVariant: {
        id: `gid://shopify/ProductVariant/${id}`,
        legacyResourceId: String(id),
        title: `Variant ${id}`,
        displayName: `Variant ${id}`,
        sku: `SKU-${id}`,
        barcode: null,
        position: id,
        price: "1.00",
        compareAtPrice: null,
        selectedOptions: [{ name: "Title", value: String(id) }],
        product: { id: "gid://shopify/Product/1" },
        inventoryItem: { id: `gid://shopify/InventoryItem/${id}` },
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt,
      },
    },
  };
}

function defaultCatalogGraphql(query: string): unknown {
  if (query.includes("query CatalogFactProductVariantIds")) {
    return variantIdsResponse([]);
  }
  if (query.includes("query CatalogFactShopCurrency")) {
    return { data: { shop: { currencyCode: "USD" } } };
  }
  if (query.includes("query CatalogFactProductVariant(")) {
    return variantResponse(2);
  }
  return undefined;
}

function admin(
  handler: (query: string, variables: Record<string, unknown>) => unknown,
): CatalogAdminReadClient {
  return {
    async graphql(query, options) {
      return {
        async json() {
          const result = handler(query, options?.variables ?? {});
          if (result !== undefined) return result;
          const fallback = defaultCatalogGraphql(query);
          if (fallback !== undefined) return fallback;
          throw new Error(`unexpected query ${query}`);
        },
      };
    },
  };
}

function productResponse(title = "Authoritative Product") {
  return {
    data: {
      product: {
        id: "gid://shopify/Product/1",
        legacyResourceId: "1",
        title,
        handle: "authoritative-product",
        vendor: "Vendor",
        productType: "Type",
        tags: ["tag"],
        status: "ACTIVE",
        featuredMedia: null,
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-05T10:00:00Z",
      },
    },
  };
}

function inventoryResponse(available: number | null = 7) {
  return {
    data: {
      inventoryItem: {
        id: "gid://shopify/InventoryItem/3",
        inventoryLevel: {
          id: "gid://shopify/InventoryLevel/4",
          isActive: true,
          createdAt: "2026-09-01T00:00:00Z",
          updatedAt: "2026-09-05T10:00:00Z",
          item: { id: "gid://shopify/InventoryItem/3" },
          location: { id: "gid://shopify/Location/5" },
          quantities: [
            "available",
            "on_hand",
            "incoming",
            "committed",
            "reserved",
            "damaged",
            "safety_stock",
            "quality_control",
          ].map((name, index) => ({
            name,
            quantity: name === "available" ? available : index,
            updatedAt: "2026-09-05T10:00:00Z",
          })),
        },
      },
    },
  };
}

async function seedProjectionGraph(prisma: PrismaClient, shopId: string) {
  await prisma.shopifyProductFact.create({
    data: {
      id: "product-1",
      shopId,
      shopifyGid: "gid://shopify/Product/1",
      title: "Product",
      handle: "product",
      tags: [],
      status: "ACTIVE",
      existenceState: "LIVE",
      existenceKind: "LIVE_REFETCH",
      existenceObservedAt: NOW,
      existenceRequestGen: 1n,
      existenceResponseGen: 2n,
      attributeRequestGen: 1n,
      attributeResponseGen: 2n,
      sourceKind: "INCREMENTAL_REFETCH",
      compatibilityProjectionState: "HEALTHY",
    },
  });
  await prisma.shopifyVariantFact.create({
    data: {
      id: "variant-2",
      shopId,
      shopifyGid: "gid://shopify/ProductVariant/2",
      shopifyProductGid: "gid://shopify/Product/1",
      title: "V",
      selectedOptions: [{ name: "Title", value: "Default" }],
      priceAmount: "1.000000",
      currencyCode: "USD",
      existenceState: "LIVE",
      existenceKind: "LIVE_REFETCH",
      existenceObservedAt: NOW,
      existenceRequestGen: 3n,
      existenceResponseGen: 4n,
      attributeRequestGen: 3n,
      attributeResponseGen: 4n,
      sourceKind: "INCREMENTAL_REFETCH",
      compatibilityProjectionState: "HEALTHY",
    },
  });
  await prisma.shopifyInventoryItemFact.create({
    data: {
      id: "item-3",
      shopId,
      shopifyGid: "gid://shopify/InventoryItem/3",
      shopifyVariantGid: "gid://shopify/ProductVariant/2",
      tracked: true,
      requiresShipping: true,
      unitCostAccess: "NULL",
      existenceState: "LIVE",
      existenceKind: "LIVE_REFETCH",
      existenceObservedAt: NOW,
      existenceRequestGen: 5n,
      existenceResponseGen: 6n,
      attributeRequestGen: 5n,
      attributeResponseGen: 6n,
      sourceKind: "INCREMENTAL_REFETCH",
      compatibilityProjectionState: "HEALTHY",
    },
  });
  await prisma.shopifyLocationFact.create({
    data: {
      id: "location-5",
      shopId,
      shopifyGid: "gid://shopify/Location/5",
      name: "Main",
      isActive: true,
      fulfillsOnlineOrders: true,
      shipsInventory: true,
      isFulfillmentService: false,
      hasActiveInventory: true,
      existenceState: "LIVE",
      existenceKind: "LIVE_REFETCH",
      existenceObservedAt: NOW,
      existenceRequestGen: 7n,
      existenceResponseGen: 8n,
      attributeRequestGen: 7n,
      attributeResponseGen: 8n,
      sourceKind: "INCREMENTAL_REFETCH",
      compatibilityProjectionState: "HEALTHY",
    },
  });
}

function baseInput(authority: Authority, mockAdmin: CatalogAdminReadClient) {
  return {
    authority,
    admin: mockAdmin,
    durableJobId: "job-f3",
    rootDurableJobId: "job-f3",
    attemptId: "attempt-f3",
    correlationId: "corr-f3",
    signalDeliveryId: "delivery-f3",
    signalReceivedAt: NOW,
    applicationKey: `webhook-delivery:${Math.random()}`,
    leaseDurationMs: 60_000,
    canonicalBatchSize: 32,
    configuredWorstCaseConcurrentCanonicalTransactions: 50,
  };
}

describe("PR5-F3 authoritative webhook refetch and R-165", () => {
  let prisma: PrismaClient;
  let shopAId: string;
  let authority: Authority;

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

  it.each(CATALOG_FACT_ATOMIC_WEBHOOK_TOPICS)(
    "enumerates %s as an atomic authoritative-refetch topic",
    (topic) => {
      expect(isCatalogFactAtomicWebhookTopic(topic)).toBe(true);
    },
  );

  it("sorts resolved identities in the refetch receipt digest", () => {
    const left = catalogRefetchApplicationDigest({
      applyingDurableJobId: "job",
      topic: "products/update",
      shopId: shopAId,
      resolvedIdentities: [
        {
          shopId: shopAId,
          resourceKind: "ProductVariant",
          shopifyGid: "gid://shopify/ProductVariant/2",
        },
        {
          shopId: shopAId,
          resourceKind: "Product",
          shopifyGid: "gid://shopify/Product/1",
        },
      ],
    });
    const right = catalogRefetchApplicationDigest({
      applyingDurableJobId: "job",
      topic: "products/update",
      shopId: shopAId,
      resolvedIdentities: [
        {
          shopId: shopAId,
          resourceKind: "Product",
          shopifyGid: "gid://shopify/Product/1",
        },
        {
          shopId: shopAId,
          resourceKind: "ProductVariant",
          shopifyGid: "gid://shopify/ProductVariant/2",
        },
      ],
    });
    expect(left).toBe(right);
  });

  it("prefers the webhook Product GID over numeric identity", () => {
    expect(
      resolveCatalogWebhookIdentity(shopAId, "products/update", {
        id: 999,
        admin_graphql_api_id: "gid://shopify/Product/1",
      }),
    ).toMatchObject({ shopifyGid: "gid://shopify/Product/1" });
  });

  it("rejects unsafe numeric identity instead of rounding a Shopify ID", () => {
    expect(() =>
      resolveCatalogWebhookIdentity(shopAId, "products/update", {
        id: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toThrow("identity_missing");
  });

  it("FX-WH uses authoritative Product refetch rather than webhook body fields", async () => {
    const result = await applyCatalogFactWebhookRefetch({
      ...baseInput(
        authority,
        admin((query) => {
          if (query.includes("query CatalogFactProduct(")) {
            return productResponse("Authoritative");
          }
        }),
      ),
      topic: "products/update",
      payload: {
        id: 1,
        admin_graphql_api_id: "gid://shopify/Product/1",
        title: "Untrusted webhook title",
      },
    });
    expect(result.applicationStatus).toBe("applied");
    expect(
      await prisma.shopifyProductFact.findUniqueOrThrow({
        where: {
          shopId_shopifyGid: {
            shopId: shopAId,
            shopifyGid: "gid://shopify/Product/1",
          },
        },
      }),
    ).toMatchObject({
      title: "Authoritative",
      compatibilityProjectionState: "HEALTHY",
    });
  });

  it("FX-WH-002 keeps a Product live when a delayed delete signal refetches live", async () => {
    await prisma.shopifyProductFact.create({
      data: {
        id: "product-existing",
        shopId: shopAId,
        shopifyGid: "gid://shopify/Product/1",
        title: "Old",
        handle: "old",
        tags: [],
        status: "ACTIVE",
        existenceState: "LIVE",
        existenceKind: "LIVE_REFETCH",
        existenceObservedAt: NOW,
        existenceRequestGen: 1n,
        existenceResponseGen: 2n,
        attributeRequestGen: 1n,
        attributeResponseGen: 2n,
        sourceKind: "INCREMENTAL_REFETCH",
      },
    });
    await applyCatalogFactWebhookRefetch({
      ...baseInput(
        authority,
        admin((query) => {
          if (query.includes("query CatalogFactProduct(")) {
            return productResponse("Still Live");
          }
        }),
      ),
      topic: "products/delete",
      payload: { admin_graphql_api_id: "gid://shopify/Product/1" },
    });
    const row = await prisma.shopifyProductFact.findUniqueOrThrow({
      where: {
        shopId_shopifyGid: {
          shopId: shopAId,
          shopifyGid: "gid://shopify/Product/1",
        },
      },
    });
    expect(row.existenceState).toBe("LIVE");
    expect(row.existenceDiagnosticState).toBe("STALE_DELETE_SIGNAL");
  });

  it("FX-WH-003 / FX-WH-012 flag OFF holds confirmed Product absence and still writes a receipt", async () => {
    await prisma.shopifyProductFact.create({
      data: {
        id: "product-existing",
        shopId: shopAId,
        shopifyGid: "gid://shopify/Product/1",
        title: "Old",
        handle: "old",
        tags: [],
        status: "ACTIVE",
        existenceState: "LIVE",
        existenceKind: "LIVE_REFETCH",
        existenceObservedAt: NOW,
        existenceRequestGen: 1n,
        existenceResponseGen: 2n,
        attributeRequestGen: 1n,
        attributeResponseGen: 2n,
        sourceKind: "INCREMENTAL_REFETCH",
      },
    });
    const input = {
      ...baseInput(
        authority,
        admin(() => ({ data: { product: null } })),
      ),
      topic: "products/delete" as const,
      payload: { admin_graphql_api_id: "gid://shopify/Product/1" },
    };
    const result = await applyCatalogFactWebhookRefetch(input);
    expect(result.applicationStatus).toBe("tombstone_held");
    expect(
      (
        await prisma.shopifyProductFact.findUniqueOrThrow({
          where: {
            shopId_shopifyGid: {
              shopId: shopAId,
              shopifyGid: "gid://shopify/Product/1",
            },
          },
        })
      ).existenceState,
    ).toBe("LIVE");
    expect(await prisma.syncApplicationReceipt.count()).toBe(1);
  });

  it("FX-WH-006 refetches all eight quantities and ignores webhook available", async () => {
    await seedProjectionGraph(prisma, shopAId);
    const result = await applyCatalogFactWebhookRefetch({
      ...baseInput(
        authority,
        admin(() => inventoryResponse(7)),
      ),
      topic: "inventory_levels/update",
      payload: {
        inventory_item_id: 3,
        location_id: 5,
        available: 999,
      },
    });
    expect(result.applicationStatus).toBe("applied");
    const level = await prisma.shopifyInventoryLevelFact.findUniqueOrThrow({
      where: {
        shopId_inventoryItemGid_locationGid: {
          shopId: shopAId,
          inventoryItemGid: "gid://shopify/InventoryItem/3",
          locationGid: "gid://shopify/Location/5",
        },
      },
    });
    expect(level.availableQuantity).toBe(7);
    expect(level.committedQuantity).toBe(3);
    expect(level.qualityControlQuantity).toBe(7);
  });

  it("FX-WH-007 / R-165 canonical UNKNOWN availability never becomes legacy zero", async () => {
    await seedProjectionGraph(prisma, shopAId);
    await expect(
      applyCatalogFactWebhookRefetch({
        ...baseInput(
          authority,
          admin(() => inventoryResponse(null)),
        ),
        topic: "inventory_levels/update",
        payload: {
          inventory_item_id: 3,
          location_id: 5,
          available: null,
        },
      }),
    ).rejects.toThrow("inventory_level_quantity_vector_incomplete");
    expect(await prisma.inventorySnapshot.count()).toBe(0);
    expect(
      await prisma.catalogObservationInFlight.count({
        where: { lifecycleState: "ABANDONED" },
      }),
    ).toBe(1);
  });

  it("FX-WH-008 canonical inventory webhook path does not write forecast or ABC side effects", async () => {
    await seedProjectionGraph(prisma, shopAId);
    await applyCatalogFactWebhookRefetch({
      ...baseInput(
        authority,
        admin(() => inventoryResponse(5)),
      ),
      topic: "inventory_levels/update",
      payload: { inventory_item_id: 3, location_id: 5, available: 1 },
    });
    expect(await prisma.lowStockAlert.count()).toBe(0);
    expect(await prisma.variantAbcClass.count()).toBe(0);
  });

  it("FX-WH-012 duplicate replay is receipt-idempotent and abandons its unused token", async () => {
    const input = {
      ...baseInput(
        authority,
        admin((query) => {
          if (query.includes("query CatalogFactProduct(")) {
            return productResponse();
          }
        }),
      ),
      applicationKey: "webhook-delivery:repeat",
      topic: "products/update" as const,
      payload: { admin_graphql_api_id: "gid://shopify/Product/1" },
    };
    expect(
      (await applyCatalogFactWebhookRefetch(input)).applicationStatus,
    ).toBe("applied");
    expect(
      (await applyCatalogFactWebhookRefetch(input)).applicationStatus,
    ).toBe("already_applied");
    expect(await prisma.syncApplicationReceipt.count()).toBe(1);
    expect(
      await prisma.catalogObservationInFlight.count({
        where: { lifecycleState: "ABANDONED" },
      }),
    ).toBe(1);
  });

  it("FX-WH-004 transport/refetch failure is not deletion and abandons exact in-flight evidence", async () => {
    await prisma.shopifyProductFact.create({
      data: {
        id: "product-existing",
        shopId: shopAId,
        shopifyGid: "gid://shopify/Product/1",
        title: "Old",
        handle: "old",
        tags: [],
        status: "ACTIVE",
        existenceState: "LIVE",
        existenceKind: "LIVE_REFETCH",
        existenceObservedAt: NOW,
        existenceRequestGen: 1n,
        existenceResponseGen: 2n,
        attributeRequestGen: 1n,
        attributeResponseGen: 2n,
        sourceKind: "INCREMENTAL_REFETCH",
      },
    });
    await expect(
      applyCatalogFactWebhookRefetch({
        ...baseInput(
          authority,
          admin(() => ({ errors: [{ message: "upstream 500" }] })),
        ),
        topic: "products/delete",
        payload: { admin_graphql_api_id: "gid://shopify/Product/1" },
      }),
    ).rejects.toThrow("upstream 500");
    expect(
      (
        await prisma.shopifyProductFact.findUniqueOrThrow({
          where: {
            shopId_shopifyGid: {
              shopId: shopAId,
              shopifyGid: "gid://shopify/Product/1",
            },
          },
        })
      ).existenceState,
    ).toBe("LIVE");
    expect(
      await prisma.catalogObservationInFlight.count({
        where: { lifecycleState: "ABANDONED" },
      }),
    ).toBe(1);
  });

  it("FX-WH-001 paginates GraphQL variant IDs instead of trusting 100 webhook GIDs", async () => {
    const payloadVariantGids = Array.from(
      { length: 100 },
      (_, index) => `gid://shopify/ProductVariant/${index + 1}`,
    );
    const result = await applyCatalogFactWebhookRefetch({
      ...baseInput(
        authority,
        admin((query, variables) => {
          if (query.includes("query CatalogFactProduct(")) {
            return productResponse("Paged");
          }
          if (query.includes("query CatalogFactProductVariantIds")) {
            if (variables.after == null) {
              return variantIdsResponse(
                Array.from({ length: 100 }, (_, index) => index + 1),
                true,
              );
            }
            expect(variables.after).toBe("c100");
            return variantIdsResponse([101], false);
          }
          if (query.includes("query CatalogFactProductVariant(")) {
            const id = String(variables.id ?? "");
            const numeric = Number(id.split("/").pop());
            return variantResponse(numeric);
          }
        }),
      ),
      topic: "products/update",
      payload: {
        id: 1,
        admin_graphql_api_id: "gid://shopify/Product/1",
        variant_gids: payloadVariantGids,
      },
    });
    expect(result.applicationStatus).toBe("applied");
    expect(await prisma.shopifyVariantFact.count({ where: { shopId: shopAId } })).toBe(
      101,
    );
    expect(
      await prisma.shopifyVariantFact.findUnique({
        where: {
          shopId_shopifyGid: {
            shopId: shopAId,
            shopifyGid: "gid://shopify/ProductVariant/101",
          },
        },
      }),
    ).not.toBeNull();
  }, 180_000);

  it("FX-WH-005 maps inventory_levels/disconnect pair identity from item and location ids only", async () => {
    await seedProjectionGraph(prisma, shopAId);
    await applyCatalogFactWebhookRefetch({
      ...baseInput(
        authority,
        admin((query) => {
          if (query.includes("query CatalogFactInventoryLevelByPair")) {
            return inventoryResponse(4);
          }
        }),
      ),
      topic: "inventory_levels/disconnect",
      payload: { inventory_item_id: 3, location_id: 5 },
    });
    expect(await prisma.shopifyInventoryLevelFact.count()).toBe(1);
    const level = await prisma.shopifyInventoryLevelFact.findUniqueOrThrow({
      where: {
        shopId_inventoryItemGid_locationGid: {
          shopId: shopAId,
          inventoryItemGid: "gid://shopify/InventoryItem/3",
          locationGid: "gid://shopify/Location/5",
        },
      },
    });
    expect(level.existenceDiagnosticState).toBe("STALE_DISCONNECT_SIGNAL");
    expect(level.existenceState).toBe("LIVE");
  });

  it("FX-WH-009 Clock A keeps the newer Shopify updatedAt across out-of-order webhooks", async () => {
    await applyCatalogFactWebhookRefetch({
      ...baseInput(
        authority,
        admin((query) => {
          if (query.includes("query CatalogFactProduct(")) {
            return productResponse("Newer");
          }
        }),
      ),
      applicationKey: "webhook-delivery:newer",
      topic: "products/update",
      payload: { admin_graphql_api_id: "gid://shopify/Product/1" },
    });
    await applyCatalogFactWebhookRefetch({
      ...baseInput(
        authority,
        admin((query) => {
          if (query.includes("query CatalogFactProduct(")) {
            return {
              data: {
                product: {
                  ...productResponse("Older").data.product,
                  title: "Older",
                  updatedAt: "2026-09-01T00:00:00Z",
                },
              },
            };
          }
        }),
      ),
      applicationKey: "webhook-delivery:older",
      topic: "products/update",
      payload: { admin_graphql_api_id: "gid://shopify/Product/1" },
    });
    expect(
      (
        await prisma.shopifyProductFact.findUniqueOrThrow({
          where: {
            shopId_shopifyGid: {
              shopId: shopAId,
              shopifyGid: "gid://shopify/Product/1",
            },
          },
        })
      ).title,
    ).toBe("Newer");
  });

  it("FX-WH-010 disabled shop fails closed with zero merchant writes", async () => {
    await prisma.shop.update({
      where: { id: shopAId },
      data: { processingEnabled: false },
    });
    let graphqlCalls = 0;
    await expect(
      applyCatalogFactWebhookRefetch({
        ...baseInput(
          authority,
          admin(() => {
            graphqlCalls += 1;
            throw new Error("must not refetch while disabled");
          }),
        ),
        topic: "products/update",
        payload: { admin_graphql_api_id: "gid://shopify/Product/1" },
      }),
    ).rejects.toThrow("shop_processing_disabled");
    expect(graphqlCalls).toBe(0);
    expect(await prisma.shopifyProductFact.count()).toBe(0);
  });

  it("FX-WH-011 catalog-sync defers while webhook-class work is pending", async () => {
    await prisma.durableJob.create({
      data: {
        shopId: shopAId,
        jobType: "webhook:inventory_levels/update",
        source: "webhook:inventory_levels/update",
        queueName: "stocky-webhooks",
        payloadSchemaVersion: "webhook-projection-inventory-levels-update-v1",
        sanitizedPayload: {},
        payloadDigest: "b".repeat(64),
        idempotencyKey: "webhook-backlog-wh011",
        correlationId: "webhook-backlog-wh011",
        authorityVersion: "tenant-job-envelope-v3",
        executionStrategy: "ATOMIC_APPLICATION_RECEIPT",
      },
    });
    let calls = 0;
    const result = await runCatalogFactsSyncStep({
      authority,
      admin: admin(() => {
        calls += 1;
        throw new Error("must not call Shopify while deferred");
      }),
      durableJobId: "catalog-job",
      correlationId: "catalog-job",
      durableAttemptCount: 0,
      canonicalBatchSize: 32,
      canonicalConcurrency: 50,
    });
    expect(result).toMatchObject({
      status: "CONTINUE",
      reason: "webhook_backlog_preferred",
    });
    expect(calls).toBe(0);
  });
});
