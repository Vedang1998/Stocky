/**
 * PR6-C actual pinned B reader overlay evidence.
 *
 * Materializes admin-read from 610ed050 at test time, drives mocked Shopify
 * transport through B's readOrderFact/readRefundFact, maps into C, and applies
 * on disposable PostgreSQL. Overlay is removed before the file finishes.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import { applyOrderFacts } from "../../../app/lib/order-facts/apply";
import type { OrderApplyDb } from "../../../app/lib/order-facts/apply/sql";
import type { DirectOrderObservation } from "../../../app/lib/order-facts/apply/types";
import { allocateCatalogObservationGeneration } from "../../../app/lib/catalog-facts/observation-generation";
import { getRuntimeClient } from "../connection";
import { resetSchemaAndApplyEnforcement } from "./helpers";
import {
  B_TYPED_READ_CONTRACT_PIN,
  incompleteObservationFromB,
  mapBOrderReadResult,
  mapBRefundReadResult,
  type CompatMapContext,
  type OrderFactSnapshot,
  type OrderReadResult,
  type RefundRead,
} from "./pr6-c-b-compat-mapper";
import {
  asQueryRaw,
  insertObservation,
  setTenant,
} from "./pr6-c-pg-harness";
import {
  materializePinnedBAdminReadOverlay,
  overlayPresent,
  removePinnedBAdminReadOverlay,
} from "./pr6-c-b-pin-overlay";

type MockAdmin = {
  calls: Array<{ query: string; variables?: Record<string, unknown> }>;
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<{ json: () => Promise<unknown> }>;
};

type OverlayFixtures = {
  orderHeader: (overrides?: Record<string, unknown>) => Record<string, unknown>;
  lineNode: (
    index: number,
    overrides?: Record<string, unknown>,
  ) => Record<string, unknown>;
  refundNode: (
    index: number,
    lines: Array<Record<string, unknown>>,
  ) => Record<string, unknown> & { order?: unknown };
  refundLineNode: (
    index: number,
    overrides?: Record<string, unknown>,
  ) => Record<string, unknown>;
  moneyBag: (
    shopAmount: string,
    currency?: string,
    presentmentAmount?: string,
    presentmentCurrency?: string,
  ) => unknown;
};

type OverlayShopContext = {
  admin: MockAdmin;
  shop: { id: string; myshopifyDomain: string };
};
type OverlayStoreAdmin = (store: object) => MockAdmin;
type OverlayReadOrderFact = (
  context: OverlayShopContext,
  gid: string,
  options?: { pageSize?: number },
) => Promise<OrderReadResult<OrderFactSnapshot>>;
type OverlayReadRefundFact = (
  context: OverlayShopContext,
  gid: string,
  options: { orderCurrencyCode: string },
) => Promise<OrderReadResult<RefundRead>>;

let fixtures: OverlayFixtures;
let createOrderStoreAdmin: OverlayStoreAdmin;
let createMockAdmin: (handler: (...args: unknown[]) => unknown) => MockAdmin;
let readOrderFact: OverlayReadOrderFact;
let readRefundFact: OverlayReadRefundFact;

function ctxFor(
  shopId: string,
  token: string,
  req: bigint,
  resp: bigint,
  extras: Partial<CompatMapContext> = {},
): CompatMapContext {
  return {
    shopId,
    observationToken: token,
    observationRequestGen: req,
    observationResponseGen: resp,
    existenceObservedAt: new Date("2026-09-11T00:00:00.000Z"),
    accessScopeSnapshot: ["read_orders"],
    ...extras,
  };
}

function shopContext(admin: MockAdmin, shopId: string, domain: string) {
  return {
    admin,
    shop: { id: shopId, myshopifyDomain: domain },
  };
}

describe("PR6-C pinned B reader overlay", () => {
  let prisma: PrismaClient;
  let shopId: string;
  const domain = "pr6-c-overlay-a.myshopify.com";

  beforeAll(async () => {
    process.on("exit", () => {
      removePinnedBAdminReadOverlay();
    });
    materializePinnedBAdminReadOverlay();
    expect(overlayPresent()).toBe(true);
    const overlayRel = "../../../app/lib/order-facts/admin-read";
    fixtures = (await import(`${overlayRel}/__tests__/fixtures.ts`)) as OverlayFixtures;
    ({ createOrderStoreAdmin } = (await import(
      `${overlayRel}/__tests__/order-store-admin.ts`
    )) as { createOrderStoreAdmin: OverlayStoreAdmin });
    ({ createMockAdmin } = (await import(`${overlayRel}/__tests__/mock-admin.ts`)) as {
      createMockAdmin: (handler: (...args: unknown[]) => unknown) => MockAdmin;
    });
    ({ readOrderFact } = (await import(`${overlayRel}/orders.ts`)) as {
      readOrderFact: OverlayReadOrderFact;
    });
    ({ readRefundFact } = (await import(`${overlayRel}/refunds.ts`)) as {
      readRefundFact: OverlayReadRefundFact;
    });
    ({ prisma } = await resetSchemaAndApplyEnforcement());
    const shop = await prisma.shop.create({
      data: { myshopifyDomain: domain },
    });
    shopId = shop.id;
  }, 600_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    removePinnedBAdminReadOverlay();
    expect(overlayPresent()).toBe(false);
  });

  async function withTenant<T>(
    fn: (client: Client, db: OrderApplyDb) => Promise<T>,
  ): Promise<T> {
    const client = await getRuntimeClient();
    try {
      await client.query("BEGIN");
      await setTenant(client, shopId);
      const result = await fn(client, asQueryRaw(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      await client.end();
    }
  }

  async function applyMapped(
    client: Client,
    db: OrderApplyDb,
    observation: DirectOrderObservation,
    receipt?: { applicationKey: string; payloadDigest: string },
  ) {
    await insertObservation(client, {
      id: observation.observationToken,
      shopId,
      resourceKind: observation.identity.resourceKind,
      shopifyGid: observation.identity.shopifyGid,
      requestGen: observation.observationRequestGen,
    });
    return applyOrderFacts(db, {
      shopId,
      observations: [observation],
      receipt: receipt
        ? {
            applicationKey: receipt.applicationKey,
            sourceJobType: "probe:b-overlay",
            rootDurableJobId: "job-boverlay",
            applyingDurableJobId: "job-boverlay",
            payloadDigest: receipt.payloadDigest.padEnd(48, "x").slice(0, 64),
          }
        : undefined,
    });
  }

  it("materializes the pinned B SHA and executes the real reader, not copied fixtures", async () => {
    expect(B_TYPED_READ_CONTRACT_PIN).toBe(
      "610ed0503a3aa2998aca7228f4fca9617bed23a3",
    );
    const admin = createOrderStoreAdmin({
      header: fixtures.orderHeader({
        processedAt: "2026-08-01T00:00:00Z",
        currencyCode: "USD",
        presentmentCurrencyCode: "EUR",
        originalTotalPriceSet: fixtures.moneyBag("10.00", "USD", "9.00", "EUR"),
        currentTotalPriceSet: fixtures.moneyBag("10.00", "USD", "9.00", "EUR"),
        currentSubtotalPriceSet: fixtures.moneyBag("10.00", "USD", "9.00", "EUR"),
        netPaymentSet: fixtures.moneyBag("10.00", "USD", "9.00", "EUR"),
      }),
      lines: [
        fixtures.lineNode(1, {
          originalTotalSet: fixtures.moneyBag("10.00", "USD", "9.00", "EUR"),
          originalUnitPriceSet: fixtures.moneyBag("10.00", "USD", "9.00", "EUR"),
          discountedTotalSetWithCodeDiscounts: fixtures.moneyBag(
            "9.00",
            "USD",
            "8.00",
            "EUR",
          ),
          discountedTotalSetWithoutCodeDiscounts: fixtures.moneyBag(
            "9.50",
            "USD",
            "8.50",
            "EUR",
          ),
          totalDiscountSet: fixtures.moneyBag("1.00", "USD", "1.00", "EUR"),
        }),
      ],
      agreements: [],
      refunds: [],
    });
    const bResult = (await readOrderFact(
      shopContext(admin, shopId, domain),
      "gid://shopify/Order/1",
    )) as OrderReadResult<OrderFactSnapshot>;
    expect(admin.calls.length).toBeGreaterThan(0);
    expect(admin.calls.some((call) => call.query.includes("OrderFactById"))).toBe(
      true,
    );
    expect(bResult.status).toBe("complete");
    if (bResult.status !== "complete") return;
    expect(bResult.value.processedAt).toBe("2026-08-01T00:00:00Z");
    expect(bResult.value.lineItems[0]?.discountedTotalSetWithCodeDiscounts.shopAmount).toBe(
      "9.00",
    );
    expect(
      bResult.value.lineItems[0]?.discountedTotalSetWithoutCodeDiscounts.shopAmount,
    ).toBe("9.50");
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      const resp = await allocateCatalogObservationGeneration(db);
      const mapped = mapBOrderReadResult(
        bResult,
        ctxFor(shopId, "obs-overlay-live", req, resp),
      );
      expect(mapped.status).toBe("mapped");
      if (mapped.status !== "mapped") return;
      expect(mapped.observation.order?.processedAtShopify).toBe(
        "2026-08-01T00:00:00Z",
      );
      expect(mapped.observation.order?.lines[0]?.discountedTotalSet.shopAmount).toBe(
        "9.00",
      );
      await applyMapped(client, db, mapped.observation);
      const line = await client.query(
        `SELECT "discountedTotalShopAmount"::text AS amt, "processedAtShopify"
           FROM "ShopifyOrderLineFact"
          WHERE "shopifyOrderGid" = $1`,
        ["gid://shopify/Order/1"],
      );
      expect(line.rows[0].amt).toBe("9.000000");
      const order = await client.query(
        `SELECT "processedAtShopify", "shopCurrencyCode", "presentmentCurrencyCode"
           FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        ["gid://shopify/Order/1"],
      );
      expect(order.rows[0].processedAtShopify).toBe("2026-08-01T00:00:00Z");
      expect(order.rows[0].shopCurrencyCode).toBe("USD");
      expect(order.rows[0].presentmentCurrencyCode).toBe("EUR");
    });
  }, 120_000);

  it("persists B restock evidence and complete-connection refundLineOrdinal", async () => {
    const refund = fixtures.refundNode(20, [
      fixtures.refundLineNode(1),
      fixtures.refundLineNode(2, {
        restocked: true,
        location: { id: "gid://shopify/Location/7" },
      }),
      fixtures.refundLineNode(3),
    ]);
    const admin = createOrderStoreAdmin({
      header: fixtures.orderHeader({ id: "gid://shopify/Order/restock" }),
      lines: [fixtures.lineNode(1), fixtures.lineNode(2), fixtures.lineNode(3)],
      agreements: [],
      refunds: [refund],
    });
    const bResult = (await readOrderFact(
      shopContext(admin, shopId, domain),
      "gid://shopify/Order/restock",
    )) as OrderReadResult<OrderFactSnapshot>;
    expect(bResult.status).toBe("complete");
    if (bResult.status !== "complete") return;
    expect(bResult.value.refunds[0]?.refundLineItems.map((item) => item.refundLineOrdinal)).toEqual(
      [0, 1, 2],
    );
    expect(bResult.value.refunds[0]?.refundLineItems[1]?.restocked).toBe(true);
    expect(bResult.value.refunds[0]?.refundLineItems[1]?.restockLocationId).toBe(
      "gid://shopify/Location/7",
    );
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      const resp = await allocateCatalogObservationGeneration(db);
      const mapped = mapBOrderReadResult(
        bResult,
        ctxFor(shopId, "obs-overlay-restock", req, resp),
      );
      expect(mapped.status).toBe("mapped");
      if (mapped.status !== "mapped") return;
      await applyMapped(client, db, mapped.observation);
      const rows = await client.query(
        `SELECT "refundLineOrdinal", restocked, "restockLocationGid"
           FROM "ShopifyOrderRefundLineFact"
          WHERE "shopifyRefundGid" = $1
          ORDER BY "refundLineOrdinal"`,
        ["gid://shopify/Refund/20"],
      );
      expect(rows.rows.map((row) => row.refundLineOrdinal)).toEqual([0, 1, 2]);
      expect(rows.rows[1].restocked).toBe(true);
      expect(rows.rows[1].restockLocationGid).toBe("gid://shopify/Location/7");
    });
  }, 120_000);

  it("maps B null_observed through mocked transport; C never copies INACCESSIBLE from B", async () => {
    const admin = createOrderStoreAdmin({
      header: fixtures.orderHeader({ id: "gid://shopify/Order/null-live" }),
      lines: [fixtures.lineNode(1)],
      agreements: [],
      refunds: [],
      nullOrder: true,
    });
    const bResult = (await readOrderFact(
      shopContext(admin, shopId, domain),
      "gid://shopify/Order/null-live",
    )) as OrderReadResult<OrderFactSnapshot>;
    expect(bResult.status).toBe("null_observed");
    if (bResult.status !== "null_observed") return;
    expect(bResult).not.toHaveProperty("kind", "INACCESSIBLE_HISTORY_WINDOW");
    const mapped = mapBOrderReadResult(
      bResult,
      ctxFor(shopId, "obs-overlay-null", 1n, 2n),
    );
    expect(mapped.status).toBe("null_observed");
    if (mapped.status !== "null_observed") return;
    expect(mapped.observation.existenceKind).toBe("ABSENT_CONFIRMED_QUERY");
    expect(mapped.observation.existenceKind).not.toBe(
      "INACCESSIBLE_HISTORY_WINDOW",
    );
    expect(mapped.observation.queryCompleted).toBe(true);
    expect(mapped.observation.queryReturnedNull).toBe(true);
  });

  it("adjudicates in-window B null_observed as a C tombstone after a real B LIVE read", async () => {
    const liveAdmin = createOrderStoreAdmin({
      header: fixtures.orderHeader({
        id: "gid://shopify/Order/null-window",
        createdAt: "2026-08-01T00:00:00Z",
        processedAt: "2026-08-01T00:00:00Z",
        updatedAt: "2026-08-10T00:00:00Z",
      }),
      lines: [fixtures.lineNode(1)],
      agreements: [],
      refunds: [],
    });
    const nullAdmin = createOrderStoreAdmin({
      header: fixtures.orderHeader({ id: "gid://shopify/Order/null-window" }),
      lines: [],
      agreements: [],
      refunds: [],
      nullOrder: true,
    });
    const liveRead = (await readOrderFact(
      shopContext(liveAdmin, shopId, domain),
      "gid://shopify/Order/null-window",
    )) as OrderReadResult<OrderFactSnapshot>;
    const nullRead = (await readOrderFact(
      shopContext(nullAdmin, shopId, domain),
      "gid://shopify/Order/null-window",
    )) as OrderReadResult<OrderFactSnapshot>;
    expect(liveRead.status).toBe("complete");
    expect(nullRead.status).toBe("null_observed");
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      const resp1 = await allocateCatalogObservationGeneration(db);
      const liveMapped = mapBOrderReadResult(
        liveRead,
        ctxFor(shopId, "obs-overlay-window-live", req1, resp1),
      );
      expect(liveMapped.status).toBe("mapped");
      if (liveMapped.status !== "mapped") return;
      await applyMapped(client, db, liveMapped.observation);
      const req2 = await allocateCatalogObservationGeneration(db);
      const resp2 = await allocateCatalogObservationGeneration(db);
      const nullMapped = mapBOrderReadResult(
        nullRead,
        ctxFor(shopId, "obs-overlay-window-null", req2, resp2),
      );
      expect(nullMapped.status).toBe("null_observed");
      if (nullMapped.status !== "null_observed") return;
      await applyMapped(client, db, nullMapped.observation);
      const row = await client.query(
        `SELECT "existenceState", "existenceKind", "deletedAt"
           FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        ["gid://shopify/Order/null-window"],
      );
      expect(row.rows[0].existenceState).toBe("ABSENT");
      expect(row.rows[0].existenceKind).toBe("ABSENT_CONFIRMED_QUERY");
      expect(row.rows[0].deletedAt).not.toBeNull();
    });
  }, 120_000);

  it("adjudicates aged-out B null_observed as INACCESSIBLE without B assigning that kind", async () => {
    const liveAdmin = createOrderStoreAdmin({
      header: fixtures.orderHeader({
        id: "gid://shopify/Order/null-aged",
        createdAt: "2026-01-01T00:00:00Z",
        processedAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
      }),
      lines: [fixtures.lineNode(1)],
      agreements: [],
      refunds: [],
    });
    const nullAdmin = createOrderStoreAdmin({
      header: fixtures.orderHeader({ id: "gid://shopify/Order/null-aged" }),
      lines: [],
      agreements: [],
      refunds: [],
      nullOrder: true,
    });
    const liveRead = (await readOrderFact(
      shopContext(liveAdmin, shopId, domain),
      "gid://shopify/Order/null-aged",
    )) as OrderReadResult<OrderFactSnapshot>;
    const nullRead = (await readOrderFact(
      shopContext(nullAdmin, shopId, domain),
      "gid://shopify/Order/null-aged",
    )) as OrderReadResult<OrderFactSnapshot>;
    expect(nullRead.status).toBe("null_observed");
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      const resp1 = await allocateCatalogObservationGeneration(db);
      const liveMapped = mapBOrderReadResult(
        liveRead,
        ctxFor(shopId, "obs-overlay-aged-live", req1, resp1),
      );
      expect(liveMapped.status).toBe("mapped");
      if (liveMapped.status !== "mapped") return;
      await applyMapped(client, db, liveMapped.observation);
      const req2 = await allocateCatalogObservationGeneration(db);
      const resp2 = await allocateCatalogObservationGeneration(db);
      const nullMapped = mapBOrderReadResult(
        nullRead,
        ctxFor(shopId, "obs-overlay-aged-null", req2, resp2),
      );
      expect(nullMapped.status).toBe("null_observed");
      if (nullMapped.status !== "null_observed") return;
      expect(nullMapped.observation.existenceKind).not.toBe(
        "INACCESSIBLE_HISTORY_WINDOW",
      );
      await applyMapped(client, db, nullMapped.observation);
      const row = await client.query(
        `SELECT "existenceState", "existenceKind", "deletedAt", "historyWindowState"
           FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        ["gid://shopify/Order/null-aged"],
      );
      expect(row.rows[0].existenceState).toBe("LIVE");
      expect(row.rows[0].existenceKind).toBe("INACCESSIBLE_HISTORY_WINDOW");
      expect(row.rows[0].deletedAt).toBeNull();
      expect(row.rows[0].historyWindowState).toBe(
        "ORDER_HISTORY_WINDOW_TRUNCATED",
      );
    });
  }, 120_000);

  it("maps a real B incomplete walk without treating English detail as INACCESSIBLE", async () => {
    let calls = 0;
    const admin = createMockAdmin(() => {
      calls += 1;
      if (calls === 1) {
        return {
          data: {
            order: {
              ...fixtures.orderHeader({ id: "gid://shopify/Order/incomplete" }),
              lineItems: {
                pageInfo: {
                  hasNextPage: true,
                  endCursor: "gid://shopify/LineItem/1",
                },
                edges: [
                  { cursor: "gid://shopify/LineItem/1", node: fixtures.lineNode(1) },
                ],
              },
              agreements: {
                pageInfo: { hasNextPage: false, endCursor: null },
                edges: [],
              },
              refunds: [],
            },
          },
          extensions: { cost: { requestedQueryCost: 10 } },
        };
      }
      return {
        data: {
          order: {
            ...fixtures.orderHeader({ id: "gid://shopify/Order/incomplete" }),
            lineItems: {
              pageInfo: { hasNextPage: false, endCursor: null },
              edges: [],
            },
            agreements: {
              pageInfo: { hasNextPage: false, endCursor: null },
              edges: [],
            },
            refunds: [],
          },
        },
        extensions: { cost: { requestedQueryCost: 10 } },
      };
    });
    const bResult = (await readOrderFact(
      shopContext(admin, shopId, domain),
      "gid://shopify/Order/incomplete",
      { pageSize: 1 },
    )) as OrderReadResult<OrderFactSnapshot>;
    expect(bResult.status).toBe("incomplete");
    if (bResult.status !== "incomplete") return;
    expect(bResult.reason).toBe("SNAPSHOT_PAGINATION_INCOMPLETE");
    expect(bResult.reason).not.toBe("INACCESSIBLE_HISTORY_WINDOW");
    const mapped = mapBOrderReadResult(
      bResult,
      ctxFor(shopId, "obs-overlay-incomplete", 1n, 2n),
    );
    expect(mapped.status).toBe("incomplete");
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      const resp = await allocateCatalogObservationGeneration(db);
      const observation = incompleteObservationFromB(
        bResult,
        ctxFor(shopId, "obs-overlay-incomplete-pg", req, resp),
      );
      await applyMapped(client, db, observation);
      const facts = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        ["gid://shopify/Order/incomplete"],
      );
      expect(facts.rows[0].n).toBe(0);
    });
  }, 120_000);

  it("blocks a real B refund with orderId=null and writes no canonical row", async () => {
    const refund = fixtures.refundNode(99, [fixtures.refundLineNode(1)]);
    refund.order = null;
    const admin = createOrderStoreAdmin({
      header: fixtures.orderHeader(),
      lines: [fixtures.lineNode(1)],
      agreements: [],
      refunds: [refund],
    });
    const bResult = (await readRefundFact(
      shopContext(admin, shopId, domain),
      "gid://shopify/Refund/99",
      { orderCurrencyCode: "USD" },
    )) as OrderReadResult<RefundRead>;
    expect(admin.calls.some((call) => call.query.includes("RefundFactById"))).toBe(
      true,
    );
    expect(bResult.status).toBe("complete");
    if (bResult.status !== "complete") return;
    expect(bResult.value.orderId).toBeNull();
    const mapped = mapBRefundReadResult(
      bResult,
      ctxFor(shopId, "obs-overlay-orphan", 1n, 2n),
    );
    expect(mapped.status).toBe("blocked");
    if (mapped.status !== "blocked") return;
    expect(mapped.code).toBe("unknown_parent_order_gid");
    await withTenant(async (client) => {
      const rows = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        ["gid://shopify/Refund/99"],
      );
      expect(rows.rows[0].n).toBe(0);
    });
  }, 120_000);

  it("uses enclosing Order GID from a real B nested refund and blocks a contradictory parent", async () => {
    const nested = fixtures.refundNode(21, [fixtures.refundLineNode(1)]);
    nested.order = { id: "gid://shopify/Order/embed" };
    const okAdmin = createOrderStoreAdmin({
      header: fixtures.orderHeader({ id: "gid://shopify/Order/embed" }),
      lines: [fixtures.lineNode(1)],
      agreements: [],
      refunds: [nested],
    });
    const okRead = (await readOrderFact(
      shopContext(okAdmin, shopId, domain),
      "gid://shopify/Order/embed",
    )) as OrderReadResult<OrderFactSnapshot>;
    expect(okRead.status).toBe("complete");
    if (okRead.status !== "complete") return;
    expect(okRead.value.refunds[0]?.orderId).toBe("gid://shopify/Order/embed");
    const clash = fixtures.refundNode(22, [fixtures.refundLineNode(1)]);
    clash.order = { id: "gid://shopify/Order/other" };
    const clashAdmin = createOrderStoreAdmin({
      header: fixtures.orderHeader({ id: "gid://shopify/Order/embed-clash" }),
      lines: [fixtures.lineNode(1)],
      agreements: [],
      refunds: [clash],
    });
    const clashRead = (await readOrderFact(
      shopContext(clashAdmin, shopId, domain),
      "gid://shopify/Order/embed-clash",
    )) as OrderReadResult<OrderFactSnapshot>;
    expect(clashRead.status).toBe("failure");
    if (clashRead.status === "failure") {
      expect(clashRead.kind).toBe("IDENTITY_MISMATCH");
    }
    await withTenant(async (client, db) => {
      const req = await allocateCatalogObservationGeneration(db);
      const resp = await allocateCatalogObservationGeneration(db);
      const mapped = mapBOrderReadResult(
        okRead,
        ctxFor(shopId, "obs-overlay-embed", req, resp),
      );
      expect(mapped.status).toBe("mapped");
      if (mapped.status !== "mapped") return;
      await applyMapped(client, db, mapped.observation);
      const refund = await client.query(
        `SELECT "shopifyOrderGid" FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        ["gid://shopify/Refund/21"],
      );
      expect(refund.rows[0].shopifyOrderGid).toBe("gid://shopify/Order/embed");
      const clashRows = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderRefundFact" WHERE "shopifyGid" = $1`,
        ["gid://shopify/Refund/22"],
      );
      expect(clashRows.rows[0].n).toBe(0);
    });
  }, 120_000);

  it("does not apply when B rejects malformed money; C still rejects a mapped malformed bag", async () => {
    const admin = createOrderStoreAdmin({
      header: fixtures.orderHeader({ id: "gid://shopify/Order/malformed" }),
      lines: [
        fixtures.lineNode(1, {
          discountedTotalSetWithCodeDiscounts: fixtures.moneyBag("not-a-decimal"),
        }),
      ],
      agreements: [],
      refunds: [],
    });
    const bResult = (await readOrderFact(
      shopContext(admin, shopId, domain),
      "gid://shopify/Order/malformed",
    )) as OrderReadResult<OrderFactSnapshot>;
    expect(bResult.status).toBe("failure");
    if (bResult.status === "failure") {
      expect(bResult.kind).toBe("MALFORMED_MONEY");
    }
    const mapped = mapBOrderReadResult(
      bResult,
      ctxFor(shopId, "obs-overlay-malformed", 1n, 2n),
    );
    expect(mapped.status).toBe("failure");
    await withTenant(async (client) => {
      const rows = await client.query(
        `SELECT count(*)::int AS n FROM "ShopifyOrderFact" WHERE "shopifyGid" = $1`,
        ["gid://shopify/Order/malformed"],
      );
      expect(rows.rows[0].n).toBe(0);
      const receipts = await client.query(
        `SELECT count(*)::int AS n FROM "SyncApplicationReceipt"`,
      );
      expect(receipts.rows[0].n).toBeGreaterThanOrEqual(0);
    });
  }, 120_000);

  it("preserves at-sale GIDs across two real B reads with a later current variant", async () => {
    const firstAdmin = createOrderStoreAdmin({
      header: fixtures.orderHeader({
        id: "gid://shopify/Order/atsale",
        updatedAt: "2026-08-10T00:00:00Z",
      }),
      lines: [fixtures.lineNode(1)],
      agreements: [],
      refunds: [],
    });
    const laterAdmin = createOrderStoreAdmin({
      header: fixtures.orderHeader({
        id: "gid://shopify/Order/atsale",
        updatedAt: "2026-08-20T00:00:00Z",
      }),
      lines: [
        fixtures.lineNode(1, {
          sku: "SKU-RECREATED",
          variant: {
            id: "gid://shopify/ProductVariant/99",
            legacyResourceId: "99",
            sku: "SKU-RECREATED",
            title: "Default",
          },
          product: {
            id: "gid://shopify/Product/99",
            legacyResourceId: "99",
            title: "Product 99",
            handle: "product-99",
          },
        }),
      ],
      agreements: [],
      refunds: [],
    });
    const firstRead = (await readOrderFact(
      shopContext(firstAdmin, shopId, domain),
      "gid://shopify/Order/atsale",
    )) as OrderReadResult<OrderFactSnapshot>;
    const laterRead = (await readOrderFact(
      shopContext(laterAdmin, shopId, domain),
      "gid://shopify/Order/atsale",
    )) as OrderReadResult<OrderFactSnapshot>;
    expect(firstRead.status).toBe("complete");
    expect(laterRead.status).toBe("complete");
    await withTenant(async (client, db) => {
      const req1 = await allocateCatalogObservationGeneration(db);
      const resp1 = await allocateCatalogObservationGeneration(db);
      const first = mapBOrderReadResult(
        firstRead,
        ctxFor(shopId, "obs-overlay-atsale-1", req1, resp1),
      );
      expect(first.status).toBe("mapped");
      if (first.status !== "mapped") return;
      await applyMapped(client, db, first.observation);
      const req2 = await allocateCatalogObservationGeneration(db);
      const resp2 = await allocateCatalogObservationGeneration(db);
      const later = mapBOrderReadResult(
        laterRead,
        ctxFor(shopId, "obs-overlay-atsale-2", req2, resp2),
      );
      expect(later.status).toBe("mapped");
      if (later.status !== "mapped") return;
      await applyMapped(client, db, later.observation);
      const line = await client.query(
        `SELECT "variantGidAtSale", "currentVariantGid", sku
           FROM "ShopifyOrderLineFact" WHERE "shopifyOrderGid" = $1`,
        ["gid://shopify/Order/atsale"],
      );
      expect(line.rows[0].variantGidAtSale).toBe(
        "gid://shopify/ProductVariant/1",
      );
      expect(line.rows[0].currentVariantGid).toBe(
        "gid://shopify/ProductVariant/99",
      );
    });
  }, 120_000);

  it("receipt-bound malformed B failure then valid B retry uses the same key/digest", async () => {
    const badAdmin = createOrderStoreAdmin({
      header: fixtures.orderHeader({ id: "gid://shopify/Order/retry-money" }),
      lines: [
        fixtures.lineNode(1, {
          discountedTotalSetWithCodeDiscounts: fixtures.moneyBag("nope"),
        }),
      ],
      agreements: [],
      refunds: [],
    });
    const goodAdmin = createOrderStoreAdmin({
      header: fixtures.orderHeader({ id: "gid://shopify/Order/retry-money" }),
      lines: [fixtures.lineNode(1)],
      agreements: [],
      refunds: [],
    });
    const badRead = (await readOrderFact(
      shopContext(badAdmin, shopId, domain),
      "gid://shopify/Order/retry-money",
    )) as OrderReadResult<OrderFactSnapshot>;
    const goodRead = (await readOrderFact(
      shopContext(goodAdmin, shopId, domain),
      "gid://shopify/Order/retry-money",
    )) as OrderReadResult<OrderFactSnapshot>;
    expect(badRead.status).toBe("failure");
    expect(goodRead.status).toBe("complete");
    await withTenant(async (client, db) => {
      expect(mapBOrderReadResult(badRead, ctxFor(shopId, "tok", 1n, 2n)).status).toBe(
        "failure",
      );
      const req = await allocateCatalogObservationGeneration(db);
      const resp = await allocateCatalogObservationGeneration(db);
      const mapped = mapBOrderReadResult(
        goodRead,
        ctxFor(shopId, "obs-overlay-retry", req, resp),
      );
      expect(mapped.status).toBe("mapped");
      if (mapped.status !== "mapped") return;
      await applyMapped(client, db, mapped.observation, {
        applicationKey: "overlay-retry",
        payloadDigest: "overlay-retry-digest",
      });
      const receipts = await client.query(
        `SELECT count(*)::int AS n FROM "SyncApplicationReceipt"
          WHERE "applicationKey" = $1`,
        ["overlay-retry"],
      );
      expect(receipts.rows[0].n).toBe(1);
    });
  }, 120_000);
});

describe("PR6-C B overlay cleanup", () => {
  it("does not leave admin-read on the C tree", () => {
    removePinnedBAdminReadOverlay();
    expect(overlayPresent()).toBe(false);
  });
});
