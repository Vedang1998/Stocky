/**
 * Issue #78: a failed (or successful) action on the Transfers page must be
 * visible to the merchant. Each case runs the real route action and renders
 * the real page with what the action returned. Issue #97: forms built from
 * Polaris fields must submit on Enter. The Stocktakes pages are covered in
 * stocktake-pages.test.ts.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";
import { submitOnEnter } from "../lib/submit-on-enter";
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
      page: {
        loaderData: {} as unknown,
        actionData: undefined as unknown,
        /** `onKeyDown` of every form rendered, keyed by its intent field. */
        formKeyHandlers: new Map<string, unknown>(),
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
  const { Children, isValidElement } = await import("react");
  const Form = (props: { children?: ReactNode; onKeyDown?: unknown }) => {
    for (const child of Children.toArray(props.children)) {
      if (
        isValidElement<{ name?: string; value?: string }>(child) &&
        child.props.name === "intent" &&
        child.props.value
      ) {
        page.formKeyHandlers.set(child.props.value, props.onKeyDown);
      }
    }
    return createElement("form", null, props.children);
  };
  return {
    ...actual,
    useLoaderData: () => page.loaderData,
    useActionData: () => page.actionData,
    useNavigation: () => ({ state: "idle" }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    useFetcher: () => ({ Form, data: undefined, state: "idle" }),
    Form,
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

function expectCriticalBanner(html: string, heading: string, message: string) {
  const banner = html.match(
    /<s-banner[^>]*tone="critical"[^>]*>.*?<\/s-banner>/s,
  );
  expect(banner?.[0]).toContain(`heading="${heading}"`);
  expect(banner?.[0]).toContain(message);
}

describe("action results on the Transfers page (#78)", () => {
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
    page.formKeyHandlers.clear();
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

  it("submits scan and quantity forms when Enter is pressed in their field (#97)", async () => {
    const variantId = "gid://shopify/ProductVariant/1";
    const variants = [{ shopifyVariantId: variantId, title: "Red wine" }];

    const warehouse = await import("../routes/app.warehouse");
    page.loaderData = {
      openPOs: [
        { id: "po-1", status: "ORDERED", supplier: null, lineItems: [] },
      ],
      variants,
    };
    renderToStaticMarkup(createElement(warehouse.default));

    const transfers = await import("../routes/app.transfers");
    page.loaderData = {
      transfers: [
        {
          id: "tr-1",
          sourceLocationId: SOURCE,
          destinationLocationId: DESTINATION,
          status: "DRAFT",
          notes: null,
          lineItems: [
            {
              id: "tl-1",
              shopifyVariantId: variantId,
              quantity: 2,
              pickedQty: 0,
              receivedQty: 0,
            },
          ],
        },
      ],
      locations: LOCATIONS,
      variants,
    };
    renderToStaticMarkup(createElement(transfers.default));

    for (const intent of ["scan", "pick", "addLine"]) {
      expect(page.formKeyHandlers.get(intent), intent).toBe(submitOnEnter);
    }
    // Forms that are only a button keep the browser's own behaviour.
    for (const intent of ["ship", "cancel"]) {
      expect(page.formKeyHandlers.has(intent), intent).toBe(true);
      expect(page.formKeyHandlers.get(intent), intent).toBeUndefined();
    }
  });

  it("shows nothing as shipped on a transfer that was cancelled as a draft", async () => {
    const route = await import("../routes/app.transfers");
    const transfer = (status: string) => ({
      id: `transfer-${status}`,
      status,
      sourceLocationId: SOURCE,
      destinationLocationId: DESTINATION,
      notes: null,
      createdAt: new Date("2026-11-12T09:00:00.000Z"),
      lineItems: [
        {
          id: `line-${status}`,
          shopifyVariantId: "gid://shopify/ProductVariant/1",
          quantity: 5,
          pickedQty: 2,
          receivedQty: 0,
        },
      ],
    });
    const cells = (status: string) => {
      page.loaderData = {
        transfers: [transfer(status)],
        locations: LOCATIONS,
        variants: [],
      };
      const html = renderToStaticMarkup(createElement(route.default));
      return [...html.matchAll(/<s-table-cell>(\d+)<\/s-table-cell>/g)].map(
        (match) => Number(match[1]),
      );
    };

    // Requested, shipped, received.
    expect(cells("CANCELLED")).toEqual([5, 0, 0]);
    expect(cells("IN_TRANSIT")).toEqual([5, 2, 0]);
  });

  it("shows no banner when nothing was submitted", async () => {
    const route = await import("../routes/app.transfers");
    page.loaderData = { transfers: [], locations: LOCATIONS, variants: [] };

    const html = renderToStaticMarkup(createElement(route.default));

    expect(html).not.toContain("<s-banner");
    expect(html).toContain("Transfer Orders");
  });
});
