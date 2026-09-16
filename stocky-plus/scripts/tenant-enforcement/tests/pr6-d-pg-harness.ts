/**
 * Disposable PostgreSQL + mock Admin helpers for PR6-D orchestration evidence.
 * Production mapper/orchestration only — not pr6-c-b-compat-mapper.ts.
 */
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { Client } from "pg";
import type { OrderAdminReadClient } from "../../../app/lib/order-facts/admin-read";
import type { OrderFactsTxnHost } from "../../../app/lib/order-facts/sync/apply-composition";
import type { OrderApplyDb } from "../../../app/lib/order-facts/apply/sql";
import { asQueryRaw, setTenant } from "./pr6-c-pg-harness";
import { createOrderStoreAdmin, type OrderStore } from "../../../app/lib/order-facts/admin-read/__tests__/order-store-admin";
import { operationNameOf } from "../../../app/lib/order-facts/admin-read/__tests__/mock-admin";
import {
  agreementNode,
  lineNode,
  moneyBag,
  orderHeader,
  refundNode,
  saleNode,
} from "../../../app/lib/order-facts/admin-read/__tests__/fixtures";
import { getRuntimeClient } from "../connection";
import { resetSchemaAndApplyEnforcement } from "./helpers";
import { resetControlPlanePrismaForTests } from "../../../app/sync/control-plane-db.server";
import { queryRows } from "../../../app/lib/order-facts/apply/sql";
import type { WebhookDeliveryWork } from "../../../app/lib/order-facts/sync/types";
import type { OrderFactsWebhookTopic } from "../../../app/lib/order-facts/sync/constants";
import {
  FROZEN_V1_SCHEMA_VERSIONS,
  NEW_TOPIC_SCHEMA_VERSIONS,
} from "../../../app/lib/order-facts/sync/constants";


export const D_NOW = new Date("2026-01-20T12:00:00.000Z");
export const IN_WINDOW_ISO = "2026-01-10T00:00:00Z";
export const OUT_OF_WINDOW_ISO = "2025-01-01T00:00:00Z";
export const BEHIND_UPDATED_ISO = "2026-01-05T00:00:00Z";
export const AHEAD_UPDATED_ISO = "2026-01-18T00:00:00Z";

export const SHOP_A_DOMAIN = "pr6-d-a.myshopify.com";
export const SHOP_B_DOMAIN = "pr6-d-b.myshopify.com";

export function digest64(label: string): string {
  return label.padEnd(64, "a").slice(0, 64);
}

export async function setupPr6DDatabase(): Promise<{
  prisma: PrismaClient;
  shopAId: string;
  shopBId: string;
}> {
  process.env.STOCKY_ALLOW_CONTROL_PLANE_URL_FALLBACK = "1";
  const { prisma } = await resetSchemaAndApplyEnforcement();
  await resetControlPlanePrismaForTests();
  const shopA = await prisma.shop.create({
    data: { myshopifyDomain: SHOP_A_DOMAIN, processingEnabled: true },
  });
  const shopB = await prisma.shop.create({
    data: { myshopifyDomain: SHOP_B_DOMAIN, processingEnabled: true },
  });
  return { prisma, shopAId: shopA.id, shopBId: shopB.id };
}

export function asOrderFactsTxnHost(
  client: Client,
  shopId: string,
  options?: { loseAppliedCommit?: boolean; myshopifyDomain?: string },
): OrderFactsTxnHost {
  const applyDb = asQueryRaw(client);
  const host: OrderFactsTxnHost = {
    $queryRaw: applyDb.$queryRaw.bind(applyDb),
    authority: {
      shopId,
      myshopifyDomain: options?.myshopifyDomain ?? SHOP_A_DOMAIN,
    },
    salesDailyAggregate: {
      upsert: async () => {
        throw new Error("pr6-d harness salesDailyAggregate is not production TenantDb");
      },
      findUnique: async () => null,
      update: async () => {
        throw new Error("pr6-d harness salesDailyAggregate is not production TenantDb");
      },
    },
    bomComponent: {
      findMany: async () => [],
    },
    $transaction: async (fn, txOptions) => {
      const isolation =
        txOptions?.isolationLevel ===
        Prisma.TransactionIsolationLevel.RepeatableRead
          ? "REPEATABLE READ"
          : "READ COMMITTED";
      await client.query(`BEGIN ISOLATION LEVEL ${isolation}`);
      try {
        await setTenant(client, shopId);
        const result = await fn(host);
        if (
          options?.loseAppliedCommit &&
          result &&
          typeof result === "object" &&
          "receiptStatus" in result &&
          (result as { receiptStatus?: string }).receiptStatus === "applied"
        ) {
          await client.query("ROLLBACK");
          throw new Error("injected_commit_loss");
        }
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      }
    },
  };
  return host;
}

export async function withTxnHost<T>(
  shopId: string,
  fn: (db: OrderFactsTxnHost, client: Client) => Promise<T>,
  options?: { loseAppliedCommit?: boolean },
): Promise<T> {
  const client = await getRuntimeClient();
  try {
    return await fn(asOrderFactsTxnHost(client, shopId, options), client);
  } finally {
    await client.end();
  }
}

export async function countForShop(
  shopId: string,
  sql: string,
  params: unknown[] = [],
): Promise<number> {
  const client = await getRuntimeClient();
  try {
    await client.query("BEGIN");
    await setTenant(client, shopId);
    const rows = await client.query(sql, params);
    await client.query("COMMIT");
    return Number(rows.rows[0]?.n ?? 0);
  } finally {
    await client.end();
  }
}

export async function queryForShop<T extends Record<string, unknown>>(
  shopId: string,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = await getRuntimeClient();
  try {
    await client.query("BEGIN");
    await setTenant(client, shopId);
    const rows = await client.query(sql, params);
    await client.query("COMMIT");
    return rows.rows as T[];
  } finally {
    await client.end();
  }
}

export async function insertSyncApplicationReceipt(input: {
  shopId: string;
  applicationKey: string;
  sourceJobType: string;
  rootDurableJobId: string;
  firstApplyingDurableJobId: string;
  payloadDigest: string;
  applicationSchemaVersion?: string;
}): Promise<void> {
  const client = await getRuntimeClient();
  try {
    await client.query("BEGIN");
    await setTenant(client, input.shopId);
    await client.query(
      `INSERT INTO "SyncApplicationReceipt" (
         id,
         "shopId",
         "applicationKey",
         "sourceJobType",
         "rootDurableJobId",
         "firstApplyingDurableJobId",
         "payloadDigest",
         "applicationSchemaVersion"
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        `ocr-d-${randomUUID()}`,
        input.shopId,
        input.applicationKey,
        input.sourceJobType,
        input.rootDurableJobId,
        input.firstApplyingDurableJobId,
        input.payloadDigest,
        input.applicationSchemaVersion ?? "sync-application-receipt-v1",
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

export async function countSyncApplicationReceipts(
  shopId: string,
  applicationKeyContains?: string,
): Promise<number> {
  if (applicationKeyContains) {
    return countForShop(
      shopId,
      `SELECT count(*)::int AS n FROM "SyncApplicationReceipt"
        WHERE "applicationKey" LIKE $1`,
      [`%${applicationKeyContains}%`],
    );
  }
  return countForShop(
    shopId,
    `SELECT count(*)::int AS n FROM "SyncApplicationReceipt"`,
  );
}

export async function loadSyncApplicationReceipt(input: {
  shopId: string;
  applicationKey: string;
}): Promise<{ payloadDigest: string } | null> {
  const rows = await queryForShop<{ payloadDigest: string }>(
    input.shopId,
    `SELECT "payloadDigest" FROM "SyncApplicationReceipt"
      WHERE "applicationKey" = $1`,
    [input.applicationKey],
  );
  return rows[0] ?? null;
}

export async function countSalesDailyAggregate(shopId: string): Promise<number> {
  return countForShop(
    shopId,
    `SELECT count(*)::int AS n FROM "SalesDailyAggregate" WHERE "shopId" = $1`,
    [shopId],
  );
}

export function inWindowHeader(overrides: Record<string, unknown> = {}) {
  return orderHeader({
    createdAt: IN_WINDOW_ISO,
    updatedAt: AHEAD_UPDATED_ISO,
    processedAt: IN_WINDOW_ISO,
    ...overrides,
  });
}

export function standardStore(orderGid: string, extra?: Partial<OrderStore>): OrderStore {
  const numeric = orderGid.replace(/\D/g, "") || "1";
  return {
    header: inWindowHeader({ id: orderGid, legacyResourceId: numeric }),
    lines: [
      lineNode(1, {
        id: `${orderGid}/LineItem/1`,
        sku: "KEEP-SKU",
      }),
    ],
    agreements: [
      agreementNode(1, [
        saleNode(1, { lineItem: { id: `${orderGid}/LineItem/1` } }),
      ]),
    ],
    refunds: [],
    ...extra,
  };
}

export type ListedOrder = {
  id: string;
  updatedAt: string;
  processedAt: string | null;
  createdAt: string | null;
  cancelledAt: string | null;
};

export type BulkMock = {
  id?: string;
  status?: string | (() => string);
  /** Poll-by-id status; defaults to `status` then COMPLETED. */
  pollStatus?: string | (() => string);
  url?: string | null;
  partialDataUrl?: string | null;
  objectCount?: string;
  rootObjectCount?: string;
  userErrors?: Array<{ message: string }>;
  mismatchPolledId?: string;
};

export function createOrderFactsAdmin(input: {
  stores: Record<string, OrderStore>;
  listed?: ListedOrder[];
  listedHasNextPage?: boolean;
  filterListedByQuery?: boolean;
  bulk?: BulkMock;
  scopes?: readonly string[] | (() => readonly string[]);
  shopTimezone?: string;
  shopCurrency?: string;
}): OrderAdminReadClient & {
  calls: Array<{ name: string | null; query: string; variables?: Record<string, unknown> }>;
  graphqlCount: () => number;
} {
  const calls: Array<{
    name: string | null;
    query: string;
    variables?: Record<string, unknown>;
  }> = [];
  const storeAdmins = new Map<string, ReturnType<typeof createOrderStoreAdmin>>();
  for (const [gid, store] of Object.entries(input.stores)) {
    storeAdmins.set(gid, createOrderStoreAdmin(store));
  }
  const firstStore = storeAdmins.values().next().value;

  const client: OrderAdminReadClient & {
    calls: typeof calls;
    graphqlCount: () => number;
  } = {
    calls,
    graphqlCount: () => calls.length,
    graphql: async (query, options) => {
      const name = operationNameOf(query);
      const variables = options?.variables ?? {};
      calls.push({ name, query, variables });

      if (name === "OrderFactsWindowListing") {
        const rawQuery = typeof variables.query === "string" ? variables.query : "";
        let listed = input.listed ?? [];
        if (input.filterListedByQuery) {
          const processed = /processed_at:>='([^']+)'/.exec(rawQuery)?.[1];
          const updated = /updated_at:>='([^']+)'/.exec(rawQuery)?.[1];
          listed = listed.filter((row) => {
            if (processed && (row.processedAt ?? row.createdAt ?? "") < processed) {
              return false;
            }
            if (updated && row.updatedAt < updated) return false;
            return true;
          });
        }
        return {
          json: async () => ({
            data: {
              orders: {
                pageInfo: {
                  hasNextPage: Boolean(input.listedHasNextPage),
                  endCursor: listed.at(-1)?.id ?? null,
                },
                edges: listed.map((node) => ({
                  cursor: node.id,
                  node,
                })),
              },
            },
            extensions: { cost: { requestedQueryCost: 2 } },
          }),
        };
      }

      if (name === "CatalogFactBulkOperationRunQuery") {
        const bulk = input.bulk ?? {};
        if (bulk.userErrors?.length) {
          return {
            json: async () => ({
              data: {
                bulkOperationRunQuery: {
                  bulkOperation: null,
                  userErrors: bulk.userErrors,
                },
              },
            }),
          };
        }
        return {
          json: async () => ({
            data: {
              bulkOperationRunQuery: {
                bulkOperation: {
                  id: bulk.id ?? "gid://shopify/BulkOperation/d1",
                  status:
                    typeof bulk.status === "function"
                      ? bulk.status()
                      : (bulk.status ?? "CREATED"),
                },
                userErrors: [],
              },
            },
          }),
        };
      }

      if (name === "CatalogFactBulkOperation") {
        const bulk = input.bulk ?? {};
        return {
          json: async () => ({
            data: {
              bulkOperation: {
                id: bulk.mismatchPolledId ?? bulk.id ?? "gid://shopify/BulkOperation/d1",
                status:
                  typeof bulk.pollStatus === "function"
                    ? bulk.pollStatus()
                    : (bulk.pollStatus ??
                      (typeof bulk.status === "function"
                        ? bulk.status()
                        : (bulk.status ?? "COMPLETED"))),
                url:
                  bulk.url === undefined
                    ? "https://example.invalid/order-facts.jsonl"
                    : bulk.url,
                partialDataUrl: bulk.partialDataUrl ?? null,
                objectCount: bulk.objectCount ?? "2",
                rootObjectCount: bulk.rootObjectCount ?? "1",
              },
            },
          }),
        };
      }

      if (name === "ShopTimezoneCurrency") {
        return {
          json: async () => ({
            data: {
              shop: {
                id: "gid://shopify/Shop/1",
                ianaTimezone: input.shopTimezone ?? "America/New_York",
                currencyCode: input.shopCurrency ?? "USD",
              },
            },
            extensions: { cost: { requestedQueryCost: 1 } },
          }),
        };
      }

      if (name === "CurrentAppInstallationAccessScopes") {
        const handles =
          typeof input.scopes === "function"
            ? input.scopes()
            : (input.scopes ?? ["read_orders", "read_products"]);
        return {
          json: async () => ({
            data: {
              currentAppInstallation: {
                accessScopes: handles.map((handle) => ({ handle })),
              },
            },
            extensions: { cost: { requestedQueryCost: 1 } },
          }),
        };
      }

      const requested =
        typeof variables.id === "string" ? variables.id : null;
      let admin = requested ? storeAdmins.get(requested) : undefined;
      if (!admin && requested) {
        for (const [gid, store] of Object.entries(input.stores)) {
          if (store.refunds.some((refund) => refund.id === requested)) {
            admin = storeAdmins.get(gid);
            break;
          }
        }
      }
      admin = admin ?? firstStore;
      if (!admin) {
        throw new Error(`no order store for ${name ?? query.slice(0, 40)}`);
      }
      return admin.graphql(query, options);
    },
  };
  return client;
}

export function webhookWork(input: {
  shopId: string;
  topic: OrderFactsWebhookTopic;
  projection: Record<string, unknown>;
  payloadSchemaVersion?: string;
  applicationKey?: string;
  durableJobId?: string;
  payloadDigest?: string;
  receivedAt?: Date;
}): WebhookDeliveryWork {
  const durableJobId = input.durableJobId ?? randomUUID();
  const schema =
    input.payloadSchemaVersion ??
    (input.topic in FROZEN_V1_SCHEMA_VERSIONS
      ? FROZEN_V1_SCHEMA_VERSIONS[
          input.topic as keyof typeof FROZEN_V1_SCHEMA_VERSIONS
        ]
      : NEW_TOPIC_SCHEMA_VERSIONS[
          input.topic as keyof typeof NEW_TOPIC_SCHEMA_VERSIONS
        ]);
  return {
    shopId: input.shopId,
    topic: input.topic,
    payloadSchemaVersion: schema,
    projection: input.projection,
    applicationKey: input.applicationKey ?? `webhook-delivery:${durableJobId}`,
    payloadDigest: input.payloadDigest ?? digest64(durableJobId),
    sourceJobType: `webhook:${input.topic}`,
    rootDurableJobId: durableJobId,
    applyingDurableJobId: durableJobId,
    durableJobId,
    jobAttemptId: `${durableJobId}:1`,
    correlationId: durableJobId,
    receivedAt: input.receivedAt ?? D_NOW,
    leaseDurationMs: 60_000,
  };
}

export function legacyRunner(shopId: string) {
  return async (
    _topic: string,
    db: unknown,
    payload: Record<string, unknown>,
  ): Promise<void> => {
    const applyDb = db as OrderApplyDb;
    const seed =
      typeof payload.admin_graphql_api_id === "string"
        ? payload.admin_graphql_api_id
        : typeof payload.id === "string" || typeof payload.id === "number"
          ? String(payload.id)
          : randomUUID();
    const variant = `gid://shopify/ProductVariant/legacy-${seed
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(-48)}`;
    await queryRows(applyDb)`INSERT INTO "SalesDailyAggregate" (
        id, shop, "shopId", "shopifyVariantId", "locationId", date, "unitsSold", revenue
      ) VALUES (
        ${randomUUID()}, ${SHOP_A_DOMAIN}, ${shopId}, ${variant}, 'legacy-d',
        DATE '2026-01-20', 1, 1.00
      )
      ON CONFLICT ("shop", "shopifyVariantId", "locationId", date)
      DO UPDATE SET "unitsSold" = "SalesDailyAggregate"."unitsSold" + 1`;
  };
}

export async function* jsonlLines(objects: unknown[]): AsyncGenerator<string> {
  yield objects.map((object) => JSON.stringify(object)).join("\n") + "\n";
}

export function bulkARoot(
  gid: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: gid,
    name: "#bulk",
    createdAt: IN_WINDOW_ISO,
    updatedAt: AHEAD_UPDATED_ISO,
    processedAt: IN_WINDOW_ISO,
    closed: false,
    edited: false,
    test: false,
    currencyCode: "USD",
    presentmentCurrencyCode: "USD",
    taxesIncluded: false,
    currentSubtotalLineItemsQuantity: 1,
    originalTotalPriceSet: moneyBag("10.00"),
    currentTotalPriceSet: moneyBag("10.00"),
    currentSubtotalPriceSet: moneyBag("10.00"),
    currentTotalDiscountsSet: moneyBag("0.00"),
    currentTotalTaxSet: moneyBag("0.00"),
    netPaymentSet: moneyBag("10.00"),
    totalRefundedSet: moneyBag("0.00"),
    currentShippingPriceSet: moneyBag("0.00"),
    ...overrides,
  };
}

export function bulkALine(
  orderGid: string,
  index = 1,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const orderKey = orderGid.startsWith("gid://shopify/Order/")
    ? orderGid.slice("gid://shopify/Order/".length)
    : orderGid;
  return {
    id: `gid://shopify/LineItem/${orderKey}-${index}`,
    __parentId: orderGid,
    quantity: 1,
    currentQuantity: 1,
    refundableQuantity: 1,
    isGiftCard: false,
    title: "Line",
    originalTotalSet: moneyBag("10.00"),
    originalUnitPriceSet: moneyBag("10.00"),
    discountedTotalSet: moneyBag("9.00"),
    totalDiscountSet: moneyBag("1.00"),
    ...overrides,
  };
}

export { lineNode, refundNode, saleNode, agreementNode };
