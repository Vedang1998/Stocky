/**
 * Issue #78: a failed (or successful) action on the Transfers and Stocktakes
 * pages must be visible to the merchant. Each case runs the real route action
 * and renders the real page with what the action returned.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";
import { attachTenantDbContextMocks } from "../test-utils/prisma-tenant-context-mock";

const SHOP = "shop-a.myshopify.com";
const SOURCE = "gid://shopify/Location/1";
const DESTINATION = "gid://shopify/Location/2";

const { prismaMock, authenticateAdmin, resolveCanonicalShopByDomain, page } =
  vi.hoisted(() => {
    const prismaMock = {
      transferOrder: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      transferLineItem: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      stocktake: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      stocktakeLineItem: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      shopifyLocationFact: { findMany: vi.fn() },
      shopifyVariantCache: { findMany: vi.fn() },
      $executeRaw: vi.fn(),
      $executeRawUnsafe: vi.fn(),
      $queryRawUnsafe: vi.fn(),
      $transaction: vi.fn(),
    };
    return {
      prismaMock,
      authenticateAdmin: vi.fn(),
      resolveCanonicalShopByDomain: vi.fn(),
      page: { loaderData: {} as unknown, actionData: undefined as unknown },
    };
  });

vi.mock("../db.server", () => ({ default: prismaMock }));

vi.mock("../shopify.server", () => ({
  authenticate: { admin: authenticateAdmin },
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

vi.mock("react-router", async () => {
  const actual =
    await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useLoaderData: () => page.loaderData,
    useActionData: () => page.actionData,
    useNavigation: () => ({ state: "idle" }),
    Form: ({ children }: { children?: ReactNode }) =>
      createElement("form", null, children),
  };
});

function post(
  path: string,
  fields: Record<string, string>,
): ActionFunctionArgs {
  return {
    request: new Request(`https://example.com${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields),
    }),
    params: {},
    context: {},
  } as ActionFunctionArgs;
}

const LOCATIONS = [
  { id: SOURCE, name: "Warehouse" },
  { id: DESTINATION, name: "Shop floor" },
];

async function transfersPage(fields: Record<string, string>) {
  const route = await import("../routes/app.transfers");
  page.actionData = await route.action(post("/app/transfers", fields));
  page.loaderData = { transfers: [], locations: LOCATIONS, variants: [] };
  return {
    actionData: page.actionData,
    html: renderToStaticMarkup(createElement(route.default)),
  };
}

async function stocktakesPage(fields: Record<string, string>) {
  const route = await import("../routes/app.stocktakes");
  page.actionData = await route.action(post("/app/stocktakes", fields));
  page.loaderData = { stocktakes: [], locations: LOCATIONS, variants: [] };
  return {
    actionData: page.actionData,
    html: renderToStaticMarkup(createElement(route.default)),
  };
}

function expectCriticalBanner(html: string, heading: string, message: string) {
  const banner = html.match(
    /<s-banner[^>]*tone="critical"[^>]*>.*?<\/s-banner>/s,
  );
  expect(banner?.[0]).toContain(`heading="${heading}"`);
  expect(banner?.[0]).toContain(message);
}

describe("action results on the Transfers and Stocktakes pages (#78)", () => {
  const flags = [
    "FEATURE_TRANSFER_WRITES",
    "FEATURE_STOCKTAKE_INVENTORY_WRITES",
  ] as const;
  const previous = flags.map((name) => process.env[name]);

  beforeEach(() => {
    vi.clearAllMocks();
    attachTenantDbContextMocks(prismaMock);
    for (const name of flags) delete process.env[name];
    authenticateAdmin.mockResolvedValue({
      session: { shop: SHOP },
      sessionToken: { sub: "7001" },
      admin: { graphql: vi.fn() },
      redirect: vi.fn(),
    });
    resolveCanonicalShopByDomain.mockResolvedValue({
      id: "shop-a-canonical-id",
      myshopifyDomain: SHOP,
    });
    page.actionData = undefined;
  });

  afterEach(() => {
    flags.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  });

  it("shows why a transfer between the same location was not created", async () => {
    const { html } = await transfersPage({
      intent: "create",
      sourceLocationId: SOURCE,
      destinationLocationId: SOURCE,
    });

    expectCriticalBanner(
      html,
      "Transfer issue",
      "Source and destination must differ",
    );
    expect(prismaMock.transferOrder.create).not.toHaveBeenCalled();
  });

  it("shows that shipping is switched off, without naming environment variables", async () => {
    prismaMock.transferOrder.findFirst.mockResolvedValue({
      id: "tr-1",
      shop: SHOP,
      sourceLocationId: SOURCE,
      destinationLocationId: DESTINATION,
      shopifyTransferId: null,
      status: "DRAFT",
      lineItems: [
        {
          id: "tl-1",
          shopifyVariantId: "gid://shopify/ProductVariant/1",
          quantity: 2,
          pickedQty: 0,
          receivedQty: 0,
        },
      ],
    });

    const { html } = await transfersPage({
      intent: "ship",
      transferId: "tr-1",
    });

    expectCriticalBanner(
      html,
      "Transfer issue",
      "Transfer inventory changes are switched off for this app.",
    );
    expect(html).not.toMatch(/FEATURE_/);
    expect(prismaMock.transferOrder.update).not.toHaveBeenCalled();
    expect(prismaMock.transferOrder.updateMany).not.toHaveBeenCalled();
  });

  it("shows a bad quantity instead of saving NaN", async () => {
    const { html } = await transfersPage({
      intent: "addLine",
      transferId: "tr-1",
      variantId: "gid://shopify/ProductVariant/1",
      quantity: "two",
    });

    expectCriticalBanner(
      html,
      "Transfer issue",
      "Enter the quantity as a whole number from 1 to 1,000,000.",
    );
    expect(prismaMock.transferOrder.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.transferLineItem.create).not.toHaveBeenCalled();
  });

  it("confirms a draft transfer that was created", async () => {
    prismaMock.shopifyLocationFact.findMany.mockResolvedValue([
      { shopifyGid: SOURCE },
      { shopifyGid: DESTINATION },
    ]);
    prismaMock.transferOrder.create.mockResolvedValue({ id: "tr-new" });

    const { html, actionData } = await transfersPage({
      intent: "create",
      sourceLocationId: SOURCE,
      destinationLocationId: DESTINATION,
      notes: "Friday restock",
    });

    expect(actionData).toEqual({ ok: true, notice: "Draft transfer created." });
    expect(html).toMatch(
      /<s-banner[^>]*tone="success"[^>]*heading="Draft transfer created\."/,
    );
    expect(prismaMock.transferOrder.create).toHaveBeenCalledTimes(1);
  });

  it("shows that completing a count is switched off", async () => {
    prismaMock.stocktake.findFirst.mockResolvedValue({
      id: "st-1",
      shop: SHOP,
      locationId: SOURCE,
      status: "IN_PROGRESS",
      lineItems: [
        {
          id: "stl-1",
          shopifyVariantId: "gid://shopify/ProductVariant/1",
          expectedQty: 5,
          countedQty: 3,
        },
      ],
    });

    const { html } = await stocktakesPage({
      intent: "complete",
      stocktakeId: "st-1",
    });

    expectCriticalBanner(
      html,
      "Stocktake issue",
      "Stocktake inventory changes are switched off for this app.",
    );
    expect(html).not.toMatch(/FEATURE_/);
    expect(prismaMock.stocktake.update).not.toHaveBeenCalled();
  });

  it("shows a bad counted quantity instead of saving it", async () => {
    const { html } = await stocktakesPage({
      intent: "count",
      lineId: "stl-1",
      countedQty: "-4",
    });

    expectCriticalBanner(
      html,
      "Stocktake issue",
      "Enter the counted quantity as a whole number from 0 to 1,000,000.",
    );
    expect(prismaMock.stocktakeLineItem.update).not.toHaveBeenCalled();
  });

  it("shows no banner when nothing was submitted", async () => {
    const route = await import("../routes/app.transfers");
    page.loaderData = { transfers: [], locations: LOCATIONS, variants: [] };

    const html = renderToStaticMarkup(createElement(route.default));

    expect(html).not.toContain("<s-banner");
    expect(html).toContain("Transfer Orders");
  });
});
