/**
 * The Stocktakes list, the count page and the count sheet (CSV): what the
 * route actions pass to the stocktake service, what they tell the merchant
 * afterwards, and what the pages and the export show. The service itself is
 * covered against PostgreSQL in
 * scripts/tenant-enforcement/tests/stocktake-workflow.test.ts.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { submitOnEnter } from "../lib/submit-on-enter";
import type {
  StocktakeHeader,
  StocktakeLineView,
  StocktakeListEntry,
  StocktakeProgress,
} from "./stocktakes/stocktake-read.server";

const SHOP = "shop-a.myshopify.com";
const CELLAR = "gid://shopify/Location/11";
const STAFF = { shopifyUserId: "42", displayName: null, channel: "ADMIN" };
const ID = "st-1";

const {
  service,
  reads,
  context,
  listSyncedLocations,
  isInventoryWriteEnabled,
  page,
} = vi.hoisted(() => ({
  service: {
    createStocktake: vi.fn(),
    saveStocktakeCount: vi.fn(),
    recordStocktakeScan: vi.fn(),
    addStocktakeItems: vi.fn(),
    zeroFillUncounted: vi.fn(),
    clearZeroFill: vi.fn(),
    resolveStocktakeMovement: vi.fn(),
    completeStocktake: vi.fn(),
    cancelStocktake: vi.fn(),
  },
  reads: {
    listStocktakes: vi.fn(),
    getStocktake: vi.fn(),
    getStocktakeProgress: vi.fn(),
    getStocktakeLines: vi.fn(),
    getStocktakeLedgerSummary: vi.fn(),
    listStocktakeLinesForExport: vi.fn(),
  },
  context: {
    actor: null as unknown,
    db: { tenant: "shop-a" },
    admin: { graphql: () => undefined },
  },
  listSyncedLocations: vi.fn(),
  isInventoryWriteEnabled: vi.fn(),
  page: {
    loaderData: {} as unknown,
    actionData: undefined as unknown,
    /** `onKeyDown` of every form rendered, keyed by its intent field (or "get"). */
    formKeyHandlers: new Map<string, unknown>(),
  },
}));

vi.mock("./stocktakes/stocktake.server", async () => {
  const actual = await vi.importActual<
    typeof import("./stocktakes/stocktake.server")
  >("./stocktakes/stocktake.server");
  return { ...actual, ...service };
});

vi.mock("./stocktakes/stocktake-read.server", async () => {
  const actual = await vi.importActual<
    typeof import("./stocktakes/stocktake-read.server")
  >("./stocktakes/stocktake-read.server");
  return { ...actual, ...reads };
});

vi.mock("./inventory-writes/locations.server", () => ({ listSyncedLocations }));

vi.mock("./inventory-writes/actor.server", async () => {
  const actual = await vi.importActual<
    typeof import("./inventory-writes/actor.server")
  >("./inventory-writes/actor.server");
  return {
    ...actual,
    requireAdminTenantWithActor: vi.fn(async () => ({
      admin: context.admin,
      db: context.db,
      actor: context.actor,
      tenant: { myshopifyDomain: SHOP },
    })),
  };
});

vi.mock("../tenant/require-admin-tenant.server", () => ({
  requireAdminTenant: vi.fn(async () => ({
    admin: context.admin,
    db: context.db,
  })),
}));

vi.mock("../lib/feature-flags.server", () => ({ isInventoryWriteEnabled }));

vi.mock("react-router", async () => {
  const actual =
    await vi.importActual<typeof import("react-router")>("react-router");
  const { Children, isValidElement } = await import("react");
  const Form = (props: {
    children?: ReactNode;
    method?: string;
    onKeyDown?: unknown;
  }) => {
    let intent = props.method === "get" ? "get" : "";
    for (const child of Children.toArray(props.children)) {
      if (
        isValidElement<{ name?: string; value?: string }>(child) &&
        child.props.name === "intent" &&
        child.props.value
      ) {
        intent = child.props.value;
      }
    }
    if (intent) page.formKeyHandlers.set(intent, props.onKeyDown);
    return createElement("form", { method: props.method }, props.children);
  };
  return {
    ...actual,
    useLoaderData: () => page.loaderData,
    useActionData: () => page.actionData,
    useNavigation: () => ({ state: "idle" }),
    Form,
  };
});

import * as listRoute from "../routes/app.stocktakes";
import * as countRoute from "../routes/app.stocktakes_.$id";
import { loader as exportLoader } from "../routes/app.stocktakes_.$id_.export";
import { STAFF_REQUIRED_MESSAGE } from "./inventory-writes/actor.server";

function post(
  path: string,
  fields: Record<string, string>,
  params: Record<string, string> = {},
): ActionFunctionArgs {
  return {
    request: new Request(`https://app.example${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields),
    }),
    params,
    context: {},
  } as ActionFunctionArgs;
}

function get(
  path: string,
  params: Record<string, string> = {},
): LoaderFunctionArgs {
  return {
    request: new Request(`https://app.example${path}`),
    params,
    context: {},
  } as LoaderFunctionArgs;
}

const act = (fields: Record<string, string>) =>
  countRoute.action(post(`/app/stocktakes/${ID}`, fields, { id: ID }));

const header = (extra: Partial<StocktakeHeader> = {}): StocktakeHeader => ({
  id: ID,
  name: "Cellar count",
  locationId: CELLAR,
  status: "IN_PROGRESS",
  scope: "FULL",
  quantityBasis: "ON_HAND",
  blind: false,
  createdAt: new Date("2026-11-12T09:00:00.000Z"),
  startedAt: new Date("2026-11-12T09:00:00.000Z"),
  startedByUserId: "42",
  completedAt: null,
  completedByUserId: null,
  cancelledAt: null,
  cancelledByUserId: null,
  ...extra,
});

const line = (extra: Partial<StocktakeLineView> = {}): StocktakeLineView => ({
  id: "line-1",
  shopifyVariantId: "gid://shopify/ProductVariant/1",
  title: "Red wine",
  sku: "RED-750",
  barcode: "1111",
  expectedQty: 10,
  countedQty: 12,
  delta: 2,
  countSource: "MANUAL",
  countedAt: new Date("2026-11-12T09:30:00.000Z"),
  countedByUserId: "77",
  movementDetectedQty: null,
  movementBaselineQty: null,
  movementReviewedAt: null,
  ...extra,
});

const PROGRESS: StocktakeProgress = {
  lineCount: 3,
  countedCount: 2,
  uncountedCount: 1,
  zeroFilledCount: 0,
  differenceCount: 1,
  unitsOver: 2,
  unitsShort: 0,
  movementReviewCount: 0,
};

const linesPage = (lines: StocktakeLineView[], extra = {}) => ({
  lines,
  total: lines.length,
  page: 1,
  pageCount: 1,
  searchTooBroad: false,
  ...extra,
});

const LOCATIONS = [
  { id: CELLAR, name: "Cellar", isActive: true },
  { id: "gid://shopify/Location/13", name: "Old shop", isActive: false },
];

type CountLoaderData = Awaited<ReturnType<typeof countRoute.loader>>;

async function loadCount(path = `/app/stocktakes/${ID}`) {
  return (await countRoute.loader(get(path, { id: ID }))) as CountLoaderData;
}

/** Loads the count page and renders it the way it reaches the merchant. */
async function renderCount(
  path = `/app/stocktakes/${ID}`,
  actionData: unknown = undefined,
) {
  page.loaderData = await loadCount(path);
  page.actionData = actionData;
  page.formKeyHandlers.clear();
  return renderToStaticMarkup(createElement(countRoute.default));
}

function renderList(loaderData: Record<string, unknown>, actionData?: unknown) {
  page.loaderData = {
    stocktakes: [],
    hasMore: false,
    view: "open",
    page: 1,
    locations: LOCATIONS,
    writesEnabled: true,
    ...loaderData,
  };
  page.actionData = actionData;
  page.formKeyHandlers.clear();
  return renderToStaticMarkup(createElement(listRoute.default));
}

beforeEach(() => {
  vi.clearAllMocks();
  context.actor = STAFF;
  isInventoryWriteEnabled.mockReturnValue(true);
  listSyncedLocations.mockResolvedValue(LOCATIONS);
  reads.listStocktakes.mockResolvedValue({ stocktakes: [], hasMore: false });
  reads.getStocktake.mockResolvedValue(header());
  reads.getStocktakeProgress.mockResolvedValue(PROGRESS);
  reads.getStocktakeLines.mockResolvedValue(linesPage([line()]));
  reads.getStocktakeLedgerSummary.mockResolvedValue({
    attemptCount: 0,
    unfinished: false,
    appliedChangeCount: 0,
    refusedChangeCount: 0,
  });
  reads.listStocktakeLinesForExport.mockResolvedValue([line()]);
});

describe("Stocktakes list", () => {
  it("loads the requested view and page, and whether completing is switched on", async () => {
    isInventoryWriteEnabled.mockReturnValue(false);

    const data = await listRoute.loader(
      get("/app/stocktakes?view=closed&page=3"),
    );

    expect(reads.listStocktakes).toHaveBeenCalledWith(context.db, {
      view: "closed",
      page: 3,
    });
    expect(isInventoryWriteEnabled).toHaveBeenCalledWith(
      "stocktakeInventoryWrites",
    );
    expect(data).toMatchObject({
      view: "closed",
      page: 3,
      locations: LOCATIONS,
      writesEnabled: false,
    });
  });

  it("falls back to the first page of open counts for anything else in the address", async () => {
    await listRoute.loader(get("/app/stocktakes?view=everything&page=-2"));

    expect(reads.listStocktakes).toHaveBeenCalledWith(context.db, {
      view: "open",
      page: 1,
    });
  });

  it("starts a count for the signed-in shop and opens it", async () => {
    service.createStocktake.mockResolvedValue({
      ok: true,
      stocktakeId: "st-new",
      lineCount: 40,
      skippedUnsynced: 0,
      skippedUnlinked: 0,
    });

    const response = (await listRoute.action(
      post("/app/stocktakes", {
        intent: "create",
        name: "Friday count",
        locationId: CELLAR,
        scope: "PARTIAL",
        blind: "hide",
        shop: "someone-else.myshopify.com",
      }),
    )) as Response;

    expect(service.createStocktake).toHaveBeenCalledWith(context.db, {
      shop: SHOP,
      locationId: CELLAR,
      name: "Friday count",
      scope: "PARTIAL",
      blind: true,
      actor: STAFF,
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/app/stocktakes/st-new");
  });

  it("starts a full count with expected quantities shown unless asked otherwise", async () => {
    service.createStocktake.mockResolvedValue({ ok: false, error: "x" });

    await listRoute.action(
      post("/app/stocktakes", { intent: "create", locationId: CELLAR }),
    );

    expect(service.createStocktake).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({ scope: "FULL", blind: false, name: "" }),
    );
  });

  it("shows why a count could not be started and keeps what was entered", async () => {
    service.createStocktake.mockResolvedValue({
      ok: false,
      error: "No tracked items are stocked at this location in Shopify.",
    });

    const actionData = await listRoute.action(
      post("/app/stocktakes", {
        intent: "create",
        name: "Friday count",
        locationId: CELLAR,
        scope: "PARTIAL",
        blind: "hide",
      }),
    );
    const html = renderList({}, actionData);

    expect(html).toMatch(
      /<s-banner[^>]*tone="critical"[^>]*heading="Stocktake issue"/,
    );
    expect(html).toContain(
      "No tracked items are stocked at this location in Shopify.",
    );
    expect(html).toMatch(
      /<s-text-field[^>]*name="name"[^>]*value="Friday count"/,
    );
    expect(html).toMatch(/<s-option value="PARTIAL" selected="true">/);
    expect(html).toMatch(/<s-option value="hide" selected="true">/);
    expect(html).not.toMatch(/<s-option value="FULL" selected/);
  });

  it("refuses an intent it does not know", async () => {
    expect(
      await listRoute.action(post("/app/stocktakes", { intent: "delete" })),
    ).toEqual({ error: "That action is not available." });
    expect(service.createStocktake).not.toHaveBeenCalled();
  });

  it("offers only active locations and submits the form on Enter", () => {
    const html = renderList({});

    expect(html).toContain(`<s-option value="${CELLAR}">Cellar</s-option>`);
    expect(html).not.toContain("Old shop");
    expect(page.formKeyHandlers.get("create")).toBe(submitOnEnter);
    expect(html).not.toContain("<s-banner");
  });

  it("explains what to do when no location is synced", () => {
    const html = renderList({ locations: [] });

    expect(html).toContain("No active locations are synced yet.");
    expect(html).not.toContain('name="locationId"');
  });

  it("says that completing counts is switched off", () => {
    const html = renderList({ writesEnabled: false });

    expect(html).toMatch(
      /<s-banner[^>]*tone="warning"[^>]*heading="Stock changes from counts are switched off"/,
    );
    expect(html).not.toMatch(/FEATURE_/);
  });

  it("lists counts with their location, status, type, progress and a link to open them", () => {
    const entry = (extra: Partial<StocktakeListEntry>): StocktakeListEntry => ({
      ...header(),
      lineCount: 1200,
      countedCount: 37,
      ...extra,
    });
    const html = renderList({
      stocktakes: [
        entry({}),
        entry({
          id: "st-2",
          name: "Spot check",
          scope: "PARTIAL",
          blind: true,
          locationId: "gid://shopify/Location/13",
        }),
        entry({
          id: "st-3",
          name: "Gone",
          locationId: "gid://shopify/Location/99",
        }),
      ],
    });

    expect(html).toContain(
      '<s-link href="/app/stocktakes/st-1">Cellar count</s-link>',
    );
    expect(html).toContain("37 of 1,200");
    expect(html).toContain("In progress");
    expect(html).toContain("2026-11-12 09:00 UTC");
    expect(html).toContain("Partial count, blind");
    // A count keeps the name of a location that was deactivated afterwards.
    expect(html).toContain("Old shop");
    expect(html).toContain("Location no longer in Shopify");
    expect(html).not.toContain("Older counts");
    expect(html).not.toContain("Newer counts");
  });

  it("links to the other view and to the neighbouring pages", () => {
    const open = renderList({ hasMore: true });
    const closed = renderList({ view: "closed", page: 2 });

    expect(open).toContain('href="/app/stocktakes?view=closed"');
    expect(open).toContain('href="/app/stocktakes?page=2"');
    expect(open).toContain("No count is in progress.");
    expect(closed).toContain('href="/app/stocktakes"');
    expect(closed).toContain('href="/app/stocktakes?view=closed"');
    expect(closed).toContain("Newer counts");
    expect(closed).toContain("No more counts.");
  });
});

describe("Count page loader", () => {
  it("answers 404 for a count this shop does not have", async () => {
    reads.getStocktake.mockResolvedValue(null);

    await expect(loadCount()).rejects.toMatchObject({ status: 404 });
    await expect(
      countRoute.loader(get("/app/stocktakes/", {})),
    ).rejects.toMatchObject({ status: 404 });
    expect(reads.getStocktakeLines).not.toHaveBeenCalled();
  });

  it("reads the filter, search and page from the address", async () => {
    const data = await loadCount(
      `/app/stocktakes/${ID}?filter=uncounted&q=%20red%20&page=4`,
    );

    expect(reads.getStocktake).toHaveBeenCalledWith(context.db, ID);
    expect(reads.getStocktakeLines).toHaveBeenCalledWith(context.db, {
      stocktakeId: ID,
      filter: "uncounted",
      search: "red",
      page: 4,
    });
    expect(data).toMatchObject({
      filter: "uncounted",
      search: "red",
      locationName: "Cellar",
      expectedHidden: false,
      writesEnabled: true,
    });
    expect(data.lines.lines[0]).toMatchObject({ expectedQty: 10, delta: 2 });
    expect(data.progress.differenceCount).toBe(1);
  });

  it("treats an unknown filter as all lines", async () => {
    const data = await loadCount(`/app/stocktakes/${ID}?filter=secret`);

    expect(data.filter).toBe("all");
  });

  it.each(["all", "uncounted", "counted"])(
    "withholds expected quantities from the %s view of a blind count in progress",
    async (filter) => {
      reads.getStocktake.mockResolvedValue(header({ blind: true }));
      reads.getStocktakeLines.mockResolvedValue(
        linesPage([line({ movementDetectedQty: 6, movementBaselineQty: 6 })]),
      );

      const data = await loadCount(`/app/stocktakes/${ID}?filter=${filter}`);

      expect(data.expectedHidden).toBe(true);
      expect(data.lines.lines[0]).toMatchObject({
        countedQty: 12,
        expectedQty: null,
        delta: null,
        movementDetectedQty: null,
        movementBaselineQty: null,
      });
      expect(data.progress).toMatchObject({
        countedCount: 2,
        differenceCount: null,
        unitsOver: null,
        unitsShort: null,
      });
      expect(JSON.stringify(data)).not.toContain('"expectedQty":10');
    },
  );

  it.each(["differences", "movement"])(
    "shows expected quantities in the %s view of a blind count, for review",
    async (filter) => {
      reads.getStocktake.mockResolvedValue(header({ blind: true }));

      const data = await loadCount(`/app/stocktakes/${ID}?filter=${filter}`);

      expect(data.expectedHidden).toBe(false);
      expect(data.lines.lines[0]).toMatchObject({ expectedQty: 10, delta: 2 });
      expect(data.progress.differenceCount).toBe(1);
    },
  );

  it("shows expected quantities of a blind count once it is closed", async () => {
    reads.getStocktake.mockResolvedValue(
      header({ blind: true, status: "COMPLETED" }),
    );

    const data = await loadCount();

    expect(data.expectedHidden).toBe(false);
    expect(data.lines.lines[0].expectedQty).toBe(10);
  });
});

describe("Count page action", () => {
  it("always acts on the count in the address, whatever the form says", async () => {
    service.zeroFillUncounted.mockResolvedValue({ ok: true, lines: 2 });

    await act({ intent: "zeroFill", stocktakeId: "st-other", id: "st-other" });

    expect(service.zeroFillUncounted).toHaveBeenCalledWith(context.db, {
      stocktakeId: ID,
      actor: STAFF,
    });
  });

  it("does nothing without a count in the address", async () => {
    expect(
      await countRoute.action(
        post("/app/stocktakes/", { intent: "zeroFill" }, {}),
      ),
    ).toEqual({ error: "Stocktake not found" });
    expect(service.zeroFillUncounted).not.toHaveBeenCalled();
  });

  it("refuses an intent it does not know", async () => {
    expect(await act({ intent: "delete" })).toEqual({
      error: "That action is not available.",
    });
    expect(await act({})).toEqual({ error: "That action is not available." });
  });

  describe("scan", () => {
    it("counts one unit unless a quantity is given, and says what the count is now", async () => {
      service.recordStocktakeScan.mockResolvedValue({
        ok: true,
        lineId: "line-1",
        title: "Red wine",
        countedQty: 1234,
        added: false,
      });

      const single = await act({ intent: "scan", code: "1111" });
      await act({ intent: "scan", code: "1111", quantity: "6" });

      expect(service.recordStocktakeScan).toHaveBeenNthCalledWith(
        1,
        context.db,
        {
          stocktakeId: ID,
          code: "1111",
          quantity: 1,
          actor: STAFF,
        },
      );
      expect(service.recordStocktakeScan).toHaveBeenNthCalledWith(
        2,
        context.db,
        expect.objectContaining({ quantity: 6 }),
      );
      expect(single).toEqual({
        ok: true,
        scannedAt: expect.any(Number),
        notice: "Red wine: 1,234 counted",
      });
    });

    it("says when the scan put the item on the count", async () => {
      service.recordStocktakeScan.mockResolvedValue({
        ok: true,
        lineId: "line-9",
        title: "Port",
        countedQty: 1,
        added: true,
      });

      expect(await act({ intent: "scan", code: "6666" })).toMatchObject({
        notice: "Port: 1 counted (added to this count)",
      });
    });

    it.each(["0", "-1", "1.5", "abc", "1000001"])(
      "does not count a quantity of %s",
      async (quantity) => {
        expect(await act({ intent: "scan", code: "1111", quantity })).toEqual({
          error:
            "Enter the scanned quantity as a whole number from 1 to 1,000,000.",
        });
        expect(service.recordStocktakeScan).not.toHaveBeenCalled();
      },
    );

    it("reports a code that could not be counted and still readies the field for the next scan", async () => {
      service.recordStocktakeScan.mockResolvedValue({
        ok: false,
        error: "No item in this shop's catalog has the barcode or SKU 0000.",
      });

      expect(await act({ intent: "scan", code: "0000" })).toEqual({
        error: "No item in this shop's catalog has the barcode or SKU 0000.",
        scannedAt: expect.any(Number),
      });
    });

    it("counts without a staff identity, which only completing needs", async () => {
      context.actor = null;
      service.recordStocktakeScan.mockResolvedValue({
        ok: true,
        lineId: "line-1",
        title: "Red wine",
        countedQty: 1,
        added: false,
      });

      await act({ intent: "scan", code: "1111" });

      expect(service.recordStocktakeScan).toHaveBeenCalledWith(
        context.db,
        expect.objectContaining({ actor: null }),
      );
    });
  });

  describe("count", () => {
    it("saves a typed count for a line of this count", async () => {
      service.saveStocktakeCount.mockResolvedValue({ ok: true });

      expect(
        await act({ intent: "count", lineId: "line-1", countedQty: " 7 " }),
      ).toEqual({ ok: true, notice: "Count saved." });
      expect(service.saveStocktakeCount).toHaveBeenCalledWith(context.db, {
        stocktakeId: ID,
        lineId: "line-1",
        countedQty: 7,
        actor: STAFF,
      });
    });

    it("clears the count when the field is emptied", async () => {
      service.saveStocktakeCount.mockResolvedValue({ ok: true });

      expect(
        await act({ intent: "count", lineId: "line-1", countedQty: "  " }),
      ).toEqual({ ok: true, notice: "Count cleared." });
      expect(service.saveStocktakeCount).toHaveBeenCalledWith(
        context.db,
        expect.objectContaining({ countedQty: null }),
      );
    });

    it.each(["-4", "2.5", "seven", "1000001"])(
      "does not save %s as a count",
      async (countedQty) => {
        expect(
          await act({ intent: "count", lineId: "line-1", countedQty }),
        ).toEqual({
          error:
            "Enter the counted quantity as a whole number from 0 to 1,000,000.",
        });
        expect(service.saveStocktakeCount).not.toHaveBeenCalled();
      },
    );

    it("needs a line, and passes on why a count was not saved", async () => {
      expect(await act({ intent: "count", countedQty: "3" })).toEqual({
        error: "Stocktake line not found",
      });
      expect(await act({ intent: "count", lineId: "line-1" })).toEqual({
        error:
          "Enter the counted quantity as a whole number from 0 to 1,000,000.",
      });
      expect(service.saveStocktakeCount).not.toHaveBeenCalled();

      service.saveStocktakeCount.mockResolvedValue({
        ok: false,
        error: "This count is closed. Its lines can no longer be changed.",
      });
      expect(
        await act({ intent: "count", lineId: "line-1", countedQty: "3" }),
      ).toEqual({
        error: "This count is closed. Its lines can no longer be changed.",
      });
    });
  });

  describe("adding items", () => {
    it("adds a pasted list and says how many were new", async () => {
      service.addStocktakeItems.mockResolvedValue({
        ok: true,
        added: 1,
        alreadyOnCount: 2,
      });

      expect(await act({ intent: "addItems", codes: "RED-750\n2222" })).toEqual(
        {
          ok: true,
          notice: "1 item added to the count. 2 items already on the count.",
        },
      );
      expect(service.addStocktakeItems).toHaveBeenCalledWith(context.db, {
        stocktakeId: ID,
        codesText: "RED-750\n2222",
      });

      service.addStocktakeItems.mockResolvedValue({
        ok: true,
        added: 3,
        alreadyOnCount: 0,
      });
      expect(await act({ intent: "addItems", codes: "a\nb\nc" })).toEqual({
        ok: true,
        notice: "3 items added to the count.",
      });
    });

    it("names the lines that could not be added and hands the list back", async () => {
      service.addStocktakeItems.mockResolvedValue({
        ok: false,
        error: "Some lines could not be added. Nothing was added to the count.",
        details: ["Line 2: no item has the barcode or SKU 0000."],
      });

      const actionData = await act({
        intent: "addItems",
        codes: "RED-750\n0000",
      });
      const html = await renderCount(undefined, actionData);

      expect(actionData).toEqual({
        error: "Some lines could not be added. Nothing was added to the count.",
        details: ["Line 2: no item has the barcode or SKU 0000."],
        codes: "RED-750\n0000",
      });
      expect(html).toContain("Line 2: no item has the barcode or SKU 0000.");
      expect(html).toMatch(
        /<s-text-area[^>]*name="codes"[^>]*value="RED-750\n0000"/,
      );
    });

    it("does not hand back a list that is too long to be one", async () => {
      service.addStocktakeItems.mockResolvedValue({
        ok: false,
        error: "The list is too long.",
        details: [],
      });

      const actionData = await act({
        intent: "addItems",
        codes: "x".repeat(50_001),
      });

      expect(actionData).toMatchObject({ error: "The list is too long." });
      expect((actionData as { codes?: string }).codes).toBeUndefined();
    });
  });

  describe("missed items", () => {
    it("marks uncounted items as zero", async () => {
      service.zeroFillUncounted.mockResolvedValue({ ok: true, lines: 14 });
      expect(await act({ intent: "zeroFill" })).toEqual({
        ok: true,
        notice: "14 items marked as zero.",
      });

      service.zeroFillUncounted.mockResolvedValue({ ok: true, lines: 0 });
      expect(await act({ intent: "zeroFill" })).toEqual({
        ok: true,
        notice: "Every item already has a count.",
      });

      service.zeroFillUncounted.mockResolvedValue({
        ok: false,
        error: "closed",
      });
      expect(await act({ intent: "zeroFill" })).toEqual({ error: "closed" });
    });

    it("takes the zeros back", async () => {
      service.clearZeroFill.mockResolvedValue({ ok: true, lines: 1 });

      expect(await act({ intent: "clearZeroFill" })).toEqual({
        ok: true,
        notice: "1 item set back to not counted.",
      });
      expect(service.clearZeroFill).toHaveBeenCalledWith(context.db, {
        stocktakeId: ID,
      });
    });
  });

  describe("movement review", () => {
    it("settles one line, or every waiting line when none is named", async () => {
      service.resolveStocktakeMovement.mockResolvedValue({
        ok: true,
        resolved: 1,
        remaining: 2,
      });

      expect(
        await act({
          intent: "resolveMovement",
          lineId: "line-1",
          resolution: "COUNTED_AFTER",
        }),
      ).toEqual({
        ok: true,
        notice: "1 item reviewed. 2 items still to review.",
      });
      expect(service.resolveStocktakeMovement).toHaveBeenLastCalledWith(
        context.db,
        { stocktakeId: ID, lineIds: ["line-1"], resolution: "COUNTED_AFTER" },
      );

      service.resolveStocktakeMovement.mockResolvedValue({
        ok: true,
        resolved: 3,
        remaining: 0,
      });
      expect(
        await act({ intent: "resolveMovement", resolution: "COUNTED_BEFORE" }),
      ).toEqual({
        ok: true,
        notice: "3 items reviewed. The count can be completed.",
      });
      expect(service.resolveStocktakeMovement).toHaveBeenLastCalledWith(
        context.db,
        { stocktakeId: ID, lineIds: null, resolution: "COUNTED_BEFORE" },
      );
    });

    it("says when there was nothing left to review, and passes on a refusal", async () => {
      service.resolveStocktakeMovement.mockResolvedValue({
        ok: true,
        resolved: 0,
        remaining: 0,
      });
      expect(
        await act({ intent: "resolveMovement", resolution: "COUNTED_AFTER" }),
      ).toEqual({
        error: "That item no longer waits for review. Reload the page.",
      });

      service.resolveStocktakeMovement.mockResolvedValue({
        ok: false,
        error:
          "Choose whether the item was counted before or after the stock moved.",
      });
      expect(await act({ intent: "resolveMovement" })).toEqual({
        error:
          "Choose whether the item was counted before or after the stock moved.",
      });
    });
  });

  describe("complete", () => {
    it("needs a signed-in staff member", async () => {
      context.actor = null;

      expect(await act({ intent: "complete" })).toEqual({
        error: STAFF_REQUIRED_MESSAGE,
      });
      expect(service.completeStocktake).not.toHaveBeenCalled();
    });

    it("completes as the staff member, leaving uncounted items alone only when asked", async () => {
      service.completeStocktake.mockResolvedValue({
        ok: true,
        alreadyCompleted: false,
      });

      expect(await act({ intent: "complete" })).toEqual({
        ok: true,
        notice: "Count completed. Its differences are applied in Shopify.",
      });
      expect(service.completeStocktake).toHaveBeenLastCalledWith(
        context.db,
        context.admin,
        STAFF,
        ID,
        { acceptUncounted: false },
      );

      await act({ intent: "complete", acceptUncounted: "1" });
      expect(service.completeStocktake).toHaveBeenLastCalledWith(
        context.db,
        context.admin,
        STAFF,
        ID,
        { acceptUncounted: true },
      );

      await act({ intent: "complete", acceptUncounted: "true" });
      expect(service.completeStocktake).toHaveBeenLastCalledWith(
        context.db,
        context.admin,
        STAFF,
        ID,
        { acceptUncounted: false },
      );
    });

    it("says so when the count was already completed", async () => {
      service.completeStocktake.mockResolvedValue({
        ok: true,
        alreadyCompleted: true,
      });

      expect(await act({ intent: "complete" })).toEqual({
        ok: true,
        notice:
          "This count was already completed. Nothing more was sent to Shopify.",
      });
    });

    it("shows what Shopify refused, line by line", async () => {
      service.completeStocktake.mockResolvedValue({
        ok: false,
        error: "Shopify did not accept 1 of 2 changes. The count stays open.",
        problems: [
          {
            shopifyVariantId: "gid://shopify/ProductVariant/2",
            title: "White wine",
            message: "The item is not stocked at the location.",
          },
        ],
        blocker: null,
      });

      const actionData = await act({ intent: "complete" });
      const html = await renderCount(undefined, actionData);

      expect(actionData).toEqual({
        error: "Shopify did not accept 1 of 2 changes. The count stays open.",
        problems: [
          expect.objectContaining({
            title: "White wine",
            message: "The item is not stocked at the location.",
          }),
        ],
        blocker: null,
      });
      expect(html).toMatch(
        /<s-banner[^>]*tone="critical"[^>]*heading="Stocktake issue"/,
      );
      expect(html).toContain(
        "White wine: The item is not stocked at the location.",
      );
    });
  });

  describe("cancel", () => {
    it("cancels the count, with or without a staff identity", async () => {
      context.actor = null;
      service.cancelStocktake.mockResolvedValue({
        ok: true,
        alreadyCancelled: false,
      });

      expect(await act({ intent: "cancel" })).toEqual({
        ok: true,
        notice: "Count cancelled. Nothing was changed in Shopify.",
      });
      expect(service.cancelStocktake).toHaveBeenCalledWith(context.db, {
        stocktakeId: ID,
        actor: null,
      });

      service.cancelStocktake.mockResolvedValue({
        ok: true,
        alreadyCancelled: true,
      });
      expect(await act({ intent: "cancel" })).toEqual({
        ok: true,
        notice: "This count was already cancelled.",
      });
    });

    it("passes on why a count cannot be cancelled", async () => {
      service.cancelStocktake.mockResolvedValue({
        ok: false,
        error: "This count has already changed 1 item in Shopify.",
      });

      expect(await act({ intent: "cancel" })).toEqual({
        error: "This count has already changed 1 item in Shopify.",
      });
    });
  });
});

describe("Count page", () => {
  it("shows an open count with its scan, add, count and finish forms", async () => {
    const html = await renderCount();

    expect(html).toContain('heading="Cellar count"');
    expect(html).toContain("In progress");
    expect(html).toContain("Full count");
    expect(html).toContain(
      "Cellar · started 2026-11-12 09:00 UTC by staff ID 42",
    );
    expect(html).toContain(
      "2 of 3 items counted · 1 item with a difference (2 units over, 0 units short)",
    );
    expect(html).toContain(`href="/app/stocktakes/${ID}/export"`);
    expect(html).toMatch(
      /<s-text-field[^>]*label="Barcode or SKU"[^>]*name="code"/,
    );
    expect(html).toMatch(/<s-number-field[^>]*name="quantity"[^>]*value="1"/);
    expect(html).toMatch(
      /<s-number-field[^>]*name="countedQty"[^>]*value="12"/,
    );
    expect(html).toContain("Red wine");
    expect(html).toContain("RED-750");
    expect(html).toContain("+2");
    expect(html).toContain("Typed");
    expect(html).not.toContain("<s-banner");

    for (const intent of ["scan", "count", "get"]) {
      expect(page.formKeyHandlers.get(intent), intent).toBe(submitOnEnter);
    }
    // Forms that are only a button, or a text area, keep the browser's own behaviour.
    for (const intent of ["addItems", "zeroFill", "complete"]) {
      expect(page.formKeyHandlers.has(intent), intent).toBe(true);
      expect(page.formKeyHandlers.get(intent), intent).toBeUndefined();
    }
  });

  it("offers the two ways to finish a count that has uncounted items", async () => {
    const html = await renderCount();

    expect(html).toContain("1 item has no count.");
    expect(html).toContain("Mark it as zero");
    expect(html).toContain("Complete and leave it unchanged");
    expect(html).toContain('name="acceptUncounted" value="1"');
    expect(html).not.toContain(">Complete count<");
  });

  it("offers a plain complete when every item is counted, and an undo for zero-filled items", async () => {
    reads.getStocktakeProgress.mockResolvedValue({
      ...PROGRESS,
      countedCount: 3,
      uncountedCount: 0,
      zeroFilledCount: 2,
    });

    const html = await renderCount();

    expect(html).toContain("Complete count");
    expect(html).not.toContain("acceptUncounted");
    expect(html).toContain(
      "2 items marked as zero because nobody counted them.",
    );
    expect(page.formKeyHandlers.has("clearZeroFill")).toBe(true);
    expect(page.formKeyHandlers.has("zeroFill")).toBe(false);
  });

  it("keeps completing unavailable while it is switched off or nothing is counted", async () => {
    const completeButton =
      /<input type="hidden" name="intent" value="complete"\/>.*?<s-button type="submit" variant="primary"( disabled="true")?>/s;
    reads.getStocktakeProgress.mockResolvedValue({
      ...PROGRESS,
      countedCount: 3,
      uncountedCount: 0,
    });

    expect((await renderCount()).match(completeButton)?.[1]).toBeUndefined();

    isInventoryWriteEnabled.mockReturnValue(false);
    const switchedOff = await renderCount();
    expect(switchedOff.match(completeButton)?.[1]).toBe(' disabled="true"');
    expect(switchedOff).toContain("Stock changes from counts are switched off");
    expect(switchedOff).not.toMatch(/FEATURE_/);

    isInventoryWriteEnabled.mockReturnValue(true);
    reads.getStocktakeProgress.mockResolvedValue({
      ...PROGRESS,
      countedCount: 0,
      uncountedCount: 3,
    });
    expect((await renderCount()).match(completeButton)?.[1]).toBe(
      ' disabled="true"',
    );
  });

  it("points to the items whose stock moved", async () => {
    reads.getStocktakeProgress.mockResolvedValue({
      ...PROGRESS,
      movementReviewCount: 2,
    });

    const html = await renderCount();

    expect(html).toMatch(
      /<s-banner[^>]*tone="warning"[^>]*heading="Stock moved during this count"/,
    );
    expect(html).toContain(`href="/app/stocktakes/${ID}?filter=movement"`);
    expect(html).toContain("Stock moved (2)");
  });

  it("lets each moved line be settled either way, showing the change each choice makes", async () => {
    reads.getStocktakeProgress.mockResolvedValue({
      ...PROGRESS,
      movementReviewCount: 2,
    });
    reads.getStocktakeLines.mockResolvedValue(
      linesPage(
        [
          line({ movementDetectedQty: 6 }),
          line({ id: "line-2", title: "White wine", movementDetectedQty: 25 }),
        ],
        { total: 2 },
      ),
    );

    const html = await renderCount(`/app/stocktakes/${ID}?filter=movement`);

    expect(html).toContain(
      "Shopify had 10 when the count started and has 6 now.",
    );
    expect(html).toContain("Counted before the stock moved (change +2)");
    expect(html).toContain("Counted after the stock moved (change +6)");
    expect(html).toContain("Counted after the stock moved (change -13)");
    expect(html).toContain('name="lineId" value="line-2"');
    expect(html).toContain('name="resolution" value="COUNTED_BEFORE"');
    expect(html).toContain("All were counted before the stock moved");
    expect(html).toContain("All were counted after the stock moved");
    // The review view replaces the count fields and needs no second banner.
    expect(html).not.toContain('name="countedQty"');
    expect(html).not.toContain("<s-banner");
  });

  it("notes how a reviewed line was settled", async () => {
    reads.getStocktakeLines.mockResolvedValue(
      linesPage([
        line({
          movementDetectedQty: 6,
          movementBaselineQty: 6,
          movementReviewedAt: new Date("2026-11-12T10:00:00Z"),
          delta: 6,
        }),
        line({
          id: "line-2",
          countSource: "SCAN",
          movementDetectedQty: 6,
          movementReviewedAt: new Date("2026-11-12T10:00:00Z"),
        }),
        line({
          id: "line-3",
          countSource: "ZERO_FILL",
          countedQty: 0,
          delta: -10,
        }),
      ]),
    );

    const html = await renderCount();

    expect(html).toContain("Typed, counted after stock moved to 6");
    expect(html).toContain("Scanned, stock moved after it was counted");
    expect(html).toContain("Marked as zero");
  });

  it("hides expected quantities and differences while a blind count is counted", async () => {
    reads.getStocktake.mockResolvedValue(header({ blind: true }));

    const html = await renderCount();

    expect(html).toContain("Blind count");
    expect(html).toContain("This is a blind count");
    expect(html).not.toContain(">Expected<");
    expect(html).not.toContain(">Difference<");
    expect(html).not.toContain("+2");
    expect(html).not.toContain("with a difference");
    // The Differences view is offered, without saying how many there are.
    expect(html).toContain(
      `href="/app/stocktakes/${ID}?filter=differences">Differences</s-link>`,
    );
    expect(html).toMatch(
      /<s-number-field[^>]*name="countedQty"[^>]*value="12"/,
    );
  });

  it("says when a count is partly applied", async () => {
    reads.getStocktakeLedgerSummary.mockResolvedValue({
      attemptCount: 1,
      unfinished: false,
      appliedChangeCount: 4,
      refusedChangeCount: 1,
    });
    const refused = await renderCount();

    reads.getStocktakeLedgerSummary.mockResolvedValue({
      attemptCount: 1,
      unfinished: true,
      appliedChangeCount: 0,
      refusedChangeCount: 0,
    });
    const unfinished = await renderCount();

    expect(refused).toContain('heading="This count is partly applied"');
    expect(refused).toContain(
      "Shopify confirmed 4 of this count&#x27;s changes and refused 1 in the last attempt.",
    );
    expect(unfinished).toContain(
      "Shopify has not finished answering the last attempt to complete this count.",
    );
  });

  it("shows a completed count read-only", async () => {
    reads.getStocktake.mockResolvedValue(
      header({
        status: "COMPLETED",
        completedAt: new Date("2026-11-12T11:15:00.000Z"),
        completedByUserId: "42",
      }),
    );
    reads.getStocktakeLedgerSummary.mockResolvedValue({
      attemptCount: 1,
      unfinished: false,
      appliedChangeCount: 1,
      refusedChangeCount: 0,
    });

    const html = await renderCount();

    expect(html).toContain("Completed 2026-11-12 11:15 UTC by staff ID 42.");
    expect(html).toContain("Red wine");
    expect(html).toContain("How counted");
    expect(html).not.toContain('method="post"');
    expect(html).not.toContain("<s-banner");
    expect(html).not.toContain("Finish the count");
    expect([...page.formKeyHandlers.keys()]).toEqual(["get"]);
  });

  it("shows a cancelled count read-only, even when nobody was signed in", async () => {
    reads.getStocktake.mockResolvedValue(
      header({
        status: "CANCELLED",
        cancelledAt: new Date("2026-11-12T11:15:00.000Z"),
        startedByUserId: null,
      }),
    );

    const html = await renderCount();

    expect(html).toContain("by staff not recorded");
    expect(html).toContain(
      "Cancelled 2026-11-12 11:15 UTC by staff not recorded. Nothing was changed in Shopify.",
    );
    expect(html).not.toContain('method="post"');
  });

  it("keeps the filter and search in page and filter links", async () => {
    reads.getStocktakeLines.mockResolvedValue(
      linesPage([line()], { total: 120, page: 2, pageCount: 3 }),
    );

    const html = await renderCount(
      `/app/stocktakes/${ID}?filter=counted&q=red+wine&page=2`,
    );

    expect(html).toContain("Page 2 of 3");
    expect(html).toContain(
      `href="/app/stocktakes/${ID}?filter=counted&amp;q=red+wine"`,
    );
    expect(html).toContain(
      `href="/app/stocktakes/${ID}?filter=counted&amp;q=red+wine&amp;page=3"`,
    );
    expect(html).toContain(
      `href="/app/stocktakes/${ID}?filter=uncounted&amp;q=red+wine"`,
    );
    expect(html).toContain('name="filter" value="counted"');
    expect(html).toMatch(/<s-text-field[^>]*name="q"[^>]*value="red wine"/);
    expect(html).toContain(`href="/app/stocktakes/${ID}?filter=counted">Clear`);
    expect(html).toMatch(/<s-text[^>]*>Counted \(2\)<\/s-text>/);
  });

  it.each([
    ["", "No items are on this count yet."],
    ["?q=zzz", "No item on this count matches that search."],
    ["?filter=movement", "No item waits for review."],
    ["?filter=uncounted", "No items in this view."],
  ])("explains an empty list at %s", async (query, message) => {
    reads.getStocktakeLines.mockResolvedValue(linesPage([]));

    const html = await renderCount(`/app/stocktakes/${ID}${query}`);

    expect(html).toContain(message);
    expect(html).not.toContain("<s-table");
  });

  it("says when a search was too broad to look at every match", async () => {
    reads.getStocktakeLines.mockResolvedValue(
      linesPage([line()], { searchTooBroad: true }),
    );

    expect(await renderCount(`/app/stocktakes/${ID}?q=a`)).toContain(
      "Many items match that search",
    );
  });

  it("shows merchant text as text", async () => {
    reads.getStocktake.mockResolvedValue(
      header({ name: '<img src=x onerror="alert(1)">' }),
    );
    reads.getStocktakeLines.mockResolvedValue(
      linesPage([line({ title: "<script>alert(1)</script>", sku: '"><b>' })]),
    );

    const html = await renderCount();

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

describe("Count sheet export", () => {
  const exportCount = () =>
    exportLoader(
      get(`/app/stocktakes/${ID}/export`, { id: ID }),
    ) as Promise<Response>;

  it("answers 404 in plain text for a count this shop does not have", async () => {
    reads.getStocktake.mockResolvedValue(null);

    const response = await exportCount();

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.text()).toBe("Stocktake not found");
    expect(reads.listStocktakeLinesForExport).not.toHaveBeenCalled();
  });

  it("downloads one row per item as a private CSV file", async () => {
    reads.listStocktakeLinesForExport.mockResolvedValue([
      line({
        movementDetectedQty: 6,
        movementBaselineQty: 6,
        movementReviewedAt: new Date("2026-11-12T10:00:00Z"),
        delta: 6,
      }),
      line({
        id: "line-2",
        title: "White wine",
        sku: null,
        barcode: null,
        countedQty: null,
        delta: null,
        countSource: null,
        countedAt: null,
        countedByUserId: null,
      }),
      line({ id: "line-3", title: "Rosé", movementDetectedQty: 4 }),
    ]);

    const response = await exportCount();
    const [head, ...rows] = (await response.text()).trimEnd().split("\r\n");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/csv; charset=utf-8",
    );
    expect(response.headers.get("Content-Disposition")).toContain(
      "stocktake-2026-11-12.csv",
    );
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(head).toBe(
      "Count,Location,Status,Item,SKU,Barcode,Expected,Counted,Difference,How counted,Counted at (UTC),Counted by staff ID,Stock moved during count,Measured from",
    );
    expect(rows).toEqual([
      'Cellar count,Cellar,In progress,Red wine,RED-750,1111,10,12,6,Typed,2026-11-12T09:30:00.000Z,77,"Yes, reviewed",6',
      "Cellar count,Cellar,In progress,White wine,,,10,,,,,,,",
      'Cellar count,Cellar,In progress,Rosé,RED-750,1111,10,12,2,Typed,2026-11-12T09:30:00.000Z,77,"Yes, not reviewed",',
    ]);
    expect(reads.listStocktakeLinesForExport).toHaveBeenCalledWith(
      context.db,
      ID,
    );
  });

  it("leaves expected quantities out of the sheet of a blind count in progress", async () => {
    reads.getStocktake.mockResolvedValue(header({ blind: true }));
    reads.listStocktakeLinesForExport.mockResolvedValue([
      line({ movementDetectedQty: 6 }),
    ]);

    const [, row] = (await (await exportCount()).text())
      .trimEnd()
      .split("\r\n");

    expect(row).toBe(
      "Cellar count,Cellar,In progress,Red wine,RED-750,1111,,12,,Typed,2026-11-12T09:30:00.000Z,77,,",
    );
  });

  it("includes expected quantities of a blind count once it is completed", async () => {
    reads.getStocktake.mockResolvedValue(
      header({ blind: true, status: "COMPLETED" }),
    );

    const [, row] = (await (await exportCount()).text())
      .trimEnd()
      .split("\r\n");

    expect(row).toContain("Completed,Red wine,RED-750,1111,10,12,2,");
  });

  it("neutralises spreadsheet formulas in names", async () => {
    reads.getStocktake.mockResolvedValue(header({ name: "=HYPERLINK(1)" }));
    reads.listStocktakeLinesForExport.mockResolvedValue([
      line({ title: "+cmd|' /C calc'!A0", sku: "@SUM(A1)" }),
    ]);

    const [, row] = (await (await exportCount()).text())
      .trimEnd()
      .split("\r\n");

    expect(row.startsWith("'=HYPERLINK(1),")).toBe(true);
    expect(row).toContain("'+cmd|' /C calc'!A0");
    expect(row).toContain("'@SUM(A1)");
  });

  it("names a location that is no longer synced by its ID", async () => {
    listSyncedLocations.mockResolvedValue([]);

    const [, row] = (await (await exportCount()).text())
      .trimEnd()
      .split("\r\n");

    expect(row.startsWith(`Cellar count,${CELLAR},`)).toBe(true);
  });
});
