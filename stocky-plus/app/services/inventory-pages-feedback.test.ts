/**
 * Issue #78: a failed (or successful) action on the Transfers pages must be
 * visible to the merchant. Each case runs the real route action through the
 * real transfer services and renders the real page with what the action
 * returned. What every action passes on and what the pages show in each state
 * is covered in transfer-pages.test.ts; the Stocktakes pages in
 * stocktake-pages.test.ts.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";
import { attachTenantDbContextMocks } from "../test-utils/prisma-tenant-context-mock";
import { transferTotals } from "./transfers/transfer-quantities";

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
      shopSettings: { findMany: vi.fn(), findFirst: vi.fn() },
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
      page: {
        loaderData: {} as unknown,
        actionData: undefined as unknown,
      },
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
  const Form = (props: { children?: ReactNode }) =>
    createElement("form", null, props.children);
  return {
    ...actual,
    useLoaderData: () => page.loaderData,
    useActionData: () => page.actionData,
    useNavigation: () => ({ state: "idle" }),
    Form,
  };
});

function post(
  path: string,
  fields: Record<string, string>,
  params: Record<string, string> = {},
): ActionFunctionArgs {
  return {
    request: new Request(`https://example.com${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields),
    }),
    params,
    context: {},
  } as ActionFunctionArgs;
}

const LIST_DATA = {
  transfers: [],
  hasMore: false,
  view: "open",
  page: 1,
  locations: [
    { id: SOURCE, name: "Warehouse", isActive: true },
    { id: DESTINATION, name: "Shop floor", isActive: true },
  ],
  planActive: true,
  writesEnabled: true,
};

/** Runs an action of the Transfers list and renders the list with its result. */
async function transfersPage(fields: Record<string, string>) {
  const route = await import("../routes/app.transfers");
  page.actionData = await route.action(post("/app/transfers", fields));
  page.loaderData = LIST_DATA;
  return {
    actionData: page.actionData,
    html:
      page.actionData instanceof Response
        ? ""
        : renderToStaticMarkup(createElement(route.default)),
  };
}

const DRAFT = {
  id: "tr-1",
  shop: SHOP,
  sourceLocationId: SOURCE,
  destinationLocationId: DESTINATION,
  shopifyTransferId: null,
  shortResolution: null,
  status: "DRAFT",
  notes: null,
  createdAt: new Date("2026-11-12T09:00:00.000Z"),
  createdByUserId: "7001",
  shippedAt: null,
  shippedByUserId: null,
  receivedAt: null,
  receivedByUserId: null,
  cancelledAt: null,
  cancelledByUserId: null,
};

/** Runs an action of a draft transfer's page and renders the page with its result. */
async function transferPage(fields: Record<string, string>) {
  const route = await import("../routes/app.transfers_.$id");
  page.actionData = await route.action(
    post("/app/transfers/tr-1", fields, { id: "tr-1" }),
  );
  page.loaderData = {
    transfer: DRAFT,
    sourceName: "Warehouse",
    destinationName: "Shop floor",
    lines: {
      lines: [],
      total: 0,
      page: 1,
      pageCount: 1,
      totals: transferTotals("DRAFT", []),
    },
    filter: "all",
    history: [],
    attention: null,
    planActive: true,
    writesEnabled: true,
  };
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

describe("action results on the Transfers pages (#78)", () => {
  const flags = [
    "FEATURE_TRANSFER_WRITES",
    "FEATURE_STOCKTAKE_INVENTORY_WRITES",
  ] as const;
  const previous = flags.map((name) => process.env[name]);

  beforeEach(() => {
    vi.clearAllMocks();
    attachTenantDbContextMocks(prismaMock);
    // The shop's settings row records an active plan.
    prismaMock.shopSettings.findMany.mockResolvedValue([{ id: "settings-a" }]);
    prismaMock.shopSettings.findFirst.mockResolvedValue({
      subscriptionActive: true,
    });
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
      ...DRAFT,
      lineItems: [
        {
          id: "tl-1",
          shopifyVariantId: "gid://shopify/ProductVariant/1",
          quantity: 2,
          pickedQty: 0,
          receivedQty: 0,
          pendingReceiveQty: 0,
          rejectedQty: 0,
          rejectNote: null,
          returnedQty: 0,
        },
      ],
    });

    const { html } = await transferPage({ intent: "ship" });

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
    const { html } = await transferPage({
      intent: "setQuantity",
      lineId: "tl-1",
      quantity: "two",
    });

    expectCriticalBanner(
      html,
      "Transfer issue",
      "Enter the quantity as a whole number from 1 to 1,000,000.",
    );
    expect(prismaMock.transferOrder.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.transferLineItem.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.transferLineItem.update).not.toHaveBeenCalled();
  });

  it("opens the draft transfer that was created, recording who created it", async () => {
    prismaMock.shopifyLocationFact.findMany.mockResolvedValue([
      { shopifyGid: SOURCE },
      { shopifyGid: DESTINATION },
    ]);
    prismaMock.transferOrder.create.mockResolvedValue({ id: "tr-new" });

    const { actionData } = await transfersPage({
      intent: "create",
      sourceLocationId: SOURCE,
      destinationLocationId: DESTINATION,
      notes: "Friday restock",
    });

    const response = actionData as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/app/transfers/tr-new");
    expect(prismaMock.transferOrder.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.transferOrder.create.mock.calls[0][0].data).toMatchObject(
      {
        sourceLocationId: SOURCE,
        destinationLocationId: DESTINATION,
        notes: "Friday restock",
        status: "DRAFT",
        createdByUserId: "7001",
      },
    );
  });

  it("shows no banner when nothing was submitted", async () => {
    const route = await import("../routes/app.transfers");
    page.loaderData = LIST_DATA;

    const html = renderToStaticMarkup(createElement(route.default));

    expect(html).not.toContain("<s-banner");
    expect(html).toContain('heading="Transfers"');
  });
});
