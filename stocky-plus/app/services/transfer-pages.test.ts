/**
 * The Transfers list, the transfer page and the transfer report (CSV): what
 * the route actions pass to the transfer services, what they tell the
 * merchant afterwards, and what the pages and the export show. The services
 * themselves are covered against PostgreSQL in
 * scripts/tenant-enforcement/tests/transfer-workflow.test.ts and
 * stocktake-transfer-ledger.test.ts.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { submitOnEnter } from "../lib/submit-on-enter";
import type {
  TransferEvent,
  TransferHeader,
  TransferLineView,
  TransferListEntry,
} from "./transfers/transfer-read.server";
import { transferTotals } from "./transfers/transfer-quantities";

const SHOP = "shop-a.myshopify.com";
const WAREHOUSE = "gid://shopify/Location/1";
const SHOP_FLOOR = "gid://shopify/Location/2";
const STAFF = { shopifyUserId: "42", displayName: null, channel: "ADMIN" };
const ID = "clxtransfer0001abc123";

const {
  drafts,
  receiving,
  reads,
  context,
  listSyncedLocations,
  isInventoryWriteEnabled,
  page,
} = vi.hoisted(() => ({
  drafts: {
    createTransfer: vi.fn(),
    addTransferItems: vi.fn(),
    setTransferLineQuantity: vi.fn(),
    setTransferPickedQuantity: vi.fn(),
    removeTransferLine: vi.fn(),
    shipTransfer: vi.fn(),
    cancelTransfer: vi.fn(),
  },
  receiving: {
    recordTransferReceiptScan: vi.fn(),
    setTransferReceiveQuantity: vi.fn(),
    setTransferRejectedQuantity: vi.fn(),
    countInOutstandingUnits: vi.fn(),
    postTransferReceipt: vi.fn(),
    receiveTransfer: vi.fn(),
    closeTransfer: vi.fn(),
  },
  reads: {
    listTransfers: vi.fn(),
    getTransfer: vi.fn(),
    getTransferLines: vi.fn(),
    getTransferHistory: vi.fn(),
    listTransferLinesForExport: vi.fn(),
  },
  context: {
    actor: null as unknown,
    db: {
      tenant: "shop-a",
      authority: { myshopifyDomain: "shop-a.myshopify.com" },
      shopSettings: { findUnique: vi.fn() },
    },
    admin: { graphql: () => undefined },
  },
  listSyncedLocations: vi.fn(),
  isInventoryWriteEnabled: vi.fn(),
  page: {
    loaderData: {} as unknown,
    actionData: undefined as unknown,
    /** `onKeyDown` of every form rendered, keyed by its intent field. */
    formKeyHandlers: new Map<string, unknown>(),
  },
}));

vi.mock("./transfers/transfer.server", async () => {
  const actual = await vi.importActual<
    typeof import("./transfers/transfer.server")
  >("./transfers/transfer.server");
  return { ...actual, ...drafts };
});

vi.mock("./transfers/transfer-receiving.server", async () => {
  const actual = await vi.importActual<
    typeof import("./transfers/transfer-receiving.server")
  >("./transfers/transfer-receiving.server");
  return { ...actual, ...receiving };
});

vi.mock("./transfers/transfer-read.server", async () => {
  const actual = await vi.importActual<
    typeof import("./transfers/transfer-read.server")
  >("./transfers/transfer-read.server");
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
    tenant: context.db.authority,
  })),
}));

/** The shop's stored time zone; null, as before its first sync, unless a test sets one. */
const shopClock = vi.hoisted(() => ({ readShopTimeZone: vi.fn() }));
vi.mock("./inventory-writes/shop-clock.server", () => shopClock);

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
    for (const child of Children.toArray(props.children)) {
      if (
        isValidElement<{ name?: string; value?: string }>(child) &&
        child.props.name === "intent" &&
        child.props.value
      ) {
        page.formKeyHandlers.set(child.props.value, props.onKeyDown);
      }
    }
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

import * as listRoute from "../routes/app.transfers";
import * as detailRoute from "../routes/app.transfers_.$id";
import { loader as exportLoader } from "../routes/app.transfers_.$id_.export";
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
  detailRoute.action(post(`/app/transfers/${ID}`, fields, { id: ID }));

const header = (extra: Partial<TransferHeader> = {}): TransferHeader => ({
  id: ID,
  sourceLocationId: WAREHOUSE,
  destinationLocationId: SHOP_FLOOR,
  status: "DRAFT",
  notes: null,
  shopifyTransferId: null,
  shortResolution: null,
  createdAt: new Date("2026-11-12T09:00:00.000Z"),
  createdByUserId: "42",
  shippedAt: null,
  shippedByUserId: null,
  receivedAt: null,
  receivedByUserId: null,
  cancelledAt: null,
  cancelledByUserId: null,
  ...extra,
});

const SHIPPED = {
  shippedAt: new Date("2026-11-12T10:00:00.000Z"),
  shippedByUserId: "42",
};

/** A draft line: nothing has moved yet. */
const line = (extra: Partial<TransferLineView> = {}): TransferLineView => ({
  id: "line-1",
  shopifyVariantId: "gid://shopify/ProductVariant/1",
  title: "Red wine",
  sku: "RED-750",
  barcode: "1111",
  quantity: 10,
  pickedQty: 0,
  receivedQty: 0,
  pendingReceiveQty: 0,
  rejectedQty: 0,
  rejectNote: null,
  returnedQty: 0,
  shipQty: 10,
  outstandingQty: 0,
  writtenOffQty: 0,
  ...extra,
});

/** A line of a transfer in transit: ten units shipped, the rest as given. */
function shippedLine(extra: Partial<TransferLineView> = {}): TransferLineView {
  const shipped = line({ pickedQty: 10, ...extra });
  return {
    ...shipped,
    outstandingQty:
      shipped.shipQty -
      shipped.receivedQty -
      shipped.pendingReceiveQty -
      shipped.rejectedQty -
      shipped.returnedQty,
    ...("outstandingQty" in extra
      ? { outstandingQty: extra.outstandingQty! }
      : {}),
  };
}

const event = (extra: Partial<TransferEvent> = {}): TransferEvent => ({
  operationId: "op-1",
  leg: "shipment",
  at: new Date("2026-11-12T10:00:00.000Z"),
  staffUserId: "42",
  staffName: null,
  status: "APPLIED",
  unfinished: false,
  netUnits: -10,
  refusedChangeCount: 0,
  ...extra,
});

const LOCATIONS = [
  { id: WAREHOUSE, name: "Warehouse", isActive: true },
  { id: SHOP_FLOOR, name: "Shop floor", isActive: true },
  { id: "gid://shopify/Location/3", name: "Old shop", isActive: false },
];

/** What the read side answers for a transfer in `status` with these lines and ledger entries. */
function given(
  transfer: Partial<TransferHeader>,
  lines: TransferLineView[],
  history: TransferEvent[] = [],
) {
  const status = transfer.status ?? "DRAFT";
  reads.getTransfer.mockResolvedValue(header(transfer));
  reads.getTransferLines.mockResolvedValue({
    lines,
    total: lines.length,
    page: 1,
    pageCount: 1,
    totals: transferTotals(status, lines),
  });
  reads.getTransferHistory.mockResolvedValue(history);
  reads.listTransferLinesForExport.mockResolvedValue(lines);
}

/** The ledger entries of a transfer whose shipment and receipts all went through. */
function settledHistory(lines: TransferLineView[]): TransferEvent[] {
  const sum = (units: (line: TransferLineView) => number) =>
    lines.reduce((total, each) => total + units(each), 0);
  const received = sum((each) => each.receivedQty);
  return [
    event({ netUnits: -sum((each) => each.shipQty) }),
    ...(received > 0
      ? [
          event({
            operationId: "op-receipt",
            leg: "receipt",
            netUnits: received,
          }),
        ]
      : []),
  ];
}

const inTransit = (
  lines: TransferLineView[],
  history: TransferEvent[] = settledHistory(lines),
  transfer: Partial<TransferHeader> = {},
) => given({ status: "IN_TRANSIT", ...SHIPPED, ...transfer }, lines, history);

type DetailLoaderData = Awaited<ReturnType<typeof detailRoute.loader>>;

async function loadDetail(path = `/app/transfers/${ID}`) {
  return (await detailRoute.loader(get(path, { id: ID }))) as DetailLoaderData;
}

/** Loads the transfer page and renders it the way it reaches the merchant. */
async function renderDetail(
  actionData: unknown = undefined,
  path = `/app/transfers/${ID}`,
) {
  page.loaderData = await loadDetail(path);
  page.actionData = actionData;
  page.formKeyHandlers.clear();
  return renderToStaticMarkup(createElement(detailRoute.default));
}

function renderList(loaderData: Record<string, unknown>, actionData?: unknown) {
  page.loaderData = {
    transfers: [],
    hasMore: false,
    view: "open",
    page: 1,
    locations: LOCATIONS,
    planActive: true,
    writesEnabled: true,
    ...loaderData,
  };
  page.actionData = actionData;
  page.formKeyHandlers.clear();
  return renderToStaticMarkup(createElement(listRoute.default));
}

/** Whether the submit button of the form with this intent is disabled; undefined when the form is not there. */
function submitDisabled(html: string, intent: string): boolean | undefined {
  const form = html.match(
    new RegExp(
      `<input type="hidden" name="intent" value="${intent}"/>.*?<s-button type="submit"[^>]*>`,
      "s",
    ),
  );
  return form ? form[0].endsWith('disabled="true">') : undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  context.actor = STAFF;
  shopClock.readShopTimeZone.mockResolvedValue(null);
  context.db.shopSettings.findUnique.mockResolvedValue({
    subscriptionActive: true,
  });
  isInventoryWriteEnabled.mockReturnValue(true);
  listSyncedLocations.mockResolvedValue(LOCATIONS);
  reads.listTransfers.mockResolvedValue({ transfers: [], hasMore: false });
  given({}, [line()]);
});

describe("Transfers list", () => {
  it("loads the requested view and page, and whether stock changes are switched on", async () => {
    isInventoryWriteEnabled.mockReturnValue(false);

    const data = await listRoute.loader(
      get("/app/transfers?view=closed&page=3"),
    );

    expect(reads.listTransfers).toHaveBeenCalledWith(context.db, {
      view: "closed",
      page: 3,
    });
    expect(isInventoryWriteEnabled).toHaveBeenCalledWith("transferWrites");
    expect(data).toMatchObject({
      view: "closed",
      page: 3,
      locations: LOCATIONS,
      writesEnabled: false,
    });
  });

  it("falls back to the first page of open transfers for anything else in the address", async () => {
    await listRoute.loader(get("/app/transfers?view=everything&page=-2"));

    expect(reads.listTransfers).toHaveBeenCalledWith(context.db, {
      view: "open",
      page: 1,
    });
  });

  it("creates a draft for the signed-in shop and staff member, and opens it", async () => {
    drafts.createTransfer.mockResolvedValue({ ok: true, transferId: "tr-new" });

    const response = (await listRoute.action(
      post("/app/transfers", {
        intent: "create",
        sourceLocationId: WAREHOUSE,
        destinationLocationId: SHOP_FLOOR,
        notes: "Friday restock",
        shop: "shop-b.myshopify.com",
      }),
    )) as Response;

    expect(drafts.createTransfer).toHaveBeenCalledWith(context.db, {
      shop: SHOP,
      sourceLocationId: WAREHOUSE,
      destinationLocationId: SHOP_FLOOR,
      notes: "Friday restock",
      actor: STAFF,
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/app/transfers/tr-new");
  });

  it("shows why a transfer was not created and keeps what was entered", async () => {
    drafts.createTransfer.mockResolvedValue({
      ok: false,
      error: "Source and destination must differ",
    });

    const result = await listRoute.action(
      post("/app/transfers", {
        intent: "create",
        sourceLocationId: SHOP_FLOOR,
        destinationLocationId: SHOP_FLOOR,
        notes: "Top up",
      }),
    );

    expect(result).toEqual({
      error: "Source and destination must differ",
      values: {
        sourceLocationId: SHOP_FLOOR,
        destinationLocationId: SHOP_FLOOR,
        notes: "Top up",
      },
    });
    const html = renderList({}, result);
    expect(html).toMatch(
      /<s-banner[^>]*tone="critical"[^>]*heading="Transfer issue"[^>]*>.*Source and destination must differ/s,
    );
    // Both selects open on the location that was chosen.
    expect(
      html.match(
        new RegExp(`<s-option value="${SHOP_FLOOR}" selected="true">`, "g"),
      ),
    ).toHaveLength(2);
    expect(html).toMatch(/<s-text-field[^>]*name="notes"[^>]*value="Top up"/);
  });

  it("creates no draft without a signed-in staff member, and keeps what was entered", async () => {
    context.actor = null;

    const result = await listRoute.action(
      post("/app/transfers", {
        intent: "create",
        sourceLocationId: WAREHOUSE,
        destinationLocationId: SHOP_FLOOR,
        notes: "Friday restock",
      }),
    );

    expect(result).toEqual({
      error: STAFF_REQUIRED_MESSAGE,
      values: {
        sourceLocationId: WAREHOUSE,
        destinationLocationId: SHOP_FLOOR,
        notes: "Friday restock",
      },
    });
    expect(drafts.createTransfer).not.toHaveBeenCalled();
    expect(renderList({}, result)).toMatch(
      /<s-text-field[^>]*name="notes"[^>]*value="Friday restock"/,
    );
  });

  it("refuses an intent it does not know", async () => {
    const result = await listRoute.action(
      post("/app/transfers", { intent: "ship", transferId: ID }),
    );

    expect(result).toEqual({ error: "That action is not available." });
    expect(drafts.createTransfer).not.toHaveBeenCalled();
    expect(drafts.shipTransfer).not.toHaveBeenCalled();
  });

  it("offers only active locations, from the first to the second by default", () => {
    const html = renderList({});

    expect(html).not.toContain("Old shop");
    expect(html).toMatch(
      new RegExp(
        `name="sourceLocationId"[^>]*><s-option value="${WAREHOUSE}" selected="true">`,
      ),
    );
    expect(html).toMatch(
      new RegExp(
        `name="destinationLocationId"[^>]*>.*?<s-option value="${SHOP_FLOOR}" selected="true">`,
        "s",
      ),
    );
    expect(html).not.toContain("<s-banner");
  });

  it("explains what to do when fewer than two locations are active", () => {
    const html = renderList({ locations: [LOCATIONS[0], LOCATIONS[2]] });

    expect(html).toContain("fewer than two active locations are synced");
    expect(page.formKeyHandlers.has("create")).toBe(false);
  });

  it("says that shipping and receiving are switched off", () => {
    const html = renderList({ writesEnabled: false });

    expect(html).toContain("Stock changes from transfers are switched off");
    expect(html).not.toMatch(/FEATURE_/);
    // A draft can still be made.
    expect(page.formKeyHandlers.has("create")).toBe(true);
  });

  it("lists transfers with their locations, status, units and a link to open them", () => {
    const entry = (
      extra: Partial<TransferHeader>,
      lines: TransferLineView[],
    ): TransferListEntry => {
      const transfer = header(extra);
      return { ...transfer, totals: transferTotals(transfer.status, lines) };
    };
    const html = renderList({
      transfers: [
        entry({ id: "tr-draft-aaa111" }, [line({ pickedQty: 4 })]),
        entry({ id: "tr-empty-bbb222" }, []),
        entry({ id: "tr-moving-ccc333", status: "IN_TRANSIT" }, [
          shippedLine({ receivedQty: 3 }),
        ]),
        entry(
          {
            id: "tr-short-ddd444",
            status: "RECEIVED",
            sourceLocationId: "gid://shopify/Location/99",
          },
          [shippedLine({ receivedQty: 6, rejectedQty: 1, returnedQty: 3 })],
        ),
        entry({ id: "tr-off-eee555", status: "CANCELLED" }, [line()]),
      ],
    });

    expect(html).toContain(
      '<s-link href="/app/transfers/tr-draft-aaa111">T-AAA111</s-link>',
    );
    expect(html).toContain("4 units to ship");
    expect(html).toContain("No items yet");
    expect(html).toContain("Partly received");
    expect(html).toContain("3 of 10 units received");
    expect(html).toContain("Closed short");
    expect(html).toContain("6 of 10 units received, 1 rejected, 3 returned");
    expect(html).toContain("Location no longer in Shopify");
    expect(html).toContain("10 units requested");
    expect(html).toContain("2026-11-12 09:00 UTC");
  });

  it("links to the other view and to the neighbouring pages", () => {
    const open = renderList({ page: 2, hasMore: true });
    expect(open).toContain('href="/app/transfers?view=closed"');
    expect(open).toContain('href="/app/transfers"');
    expect(open).toContain('href="/app/transfers?page=3"');

    const closed = renderList({ view: "closed", page: 3, hasMore: false });
    expect(closed).toContain('href="/app/transfers"');
    expect(closed).toContain('href="/app/transfers?view=closed&amp;page=2"');
    expect(closed).not.toContain("Older transfers");
    expect(closed).toContain("No more transfers.");
  });
});

describe("Transfer page loader", () => {
  it("answers 404 for a transfer this shop does not have", async () => {
    reads.getTransfer.mockResolvedValue(null);

    const thrown = await loadDetail().catch((error: unknown) => error);

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(404);
    expect(reads.getTransferLines).not.toHaveBeenCalled();
    expect(reads.getTransferHistory).not.toHaveBeenCalled();
  });

  it("reads the line filter and page from the address", async () => {
    inTransit([shippedLine()]);

    const data = await loadDetail(`/app/transfers/${ID}?filter=open&page=2`);

    expect(reads.getTransfer).toHaveBeenCalledWith(context.db, ID);
    expect(reads.getTransferLines).toHaveBeenCalledWith(context.db, {
      transfer: expect.objectContaining({ id: ID, status: "IN_TRANSIT" }),
      filter: "open",
      page: 2,
    });
    expect(data).toMatchObject({
      filter: "open",
      sourceName: "Warehouse",
      destinationName: "Shop floor",
      writesEnabled: true,
    });
    expect(isInventoryWriteEnabled).toHaveBeenCalledWith("transferWrites");
  });

  it("treats an unknown filter as all lines and a bad page as the first", async () => {
    await loadDetail(`/app/transfers/${ID}?filter=everything&page=0`);

    expect(reads.getTransferLines).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({ filter: "all", page: 1 }),
    );
  });

  it("names a location that is no longer synced", async () => {
    given({ destinationLocationId: "gid://shopify/Location/99" }, [line()]);

    expect((await loadDetail()).destinationName).toBe(
      "Location no longer in Shopify",
    );
  });

  it.each([
    ["a clean draft", "DRAFT", [], null],
    [
      "a draft whose stock partly left the source",
      "DRAFT",
      [event({ status: "PARTIALLY_APPLIED", netUnits: -4 })],
      "SHIPMENT_UNFINISHED",
    ],
    [
      "a draft whose shipment Shopify has not answered",
      "DRAFT",
      [event({ status: "APPLYING", unfinished: true, netUnits: 0 })],
      "SHIPMENT_UNFINISHED",
    ],
    [
      "a draft whose shipment was refused whole",
      "DRAFT",
      [event({ status: "FAILED", netUnits: 0, refusedChangeCount: 1 })],
      null,
    ],
    [
      "a cancelled transfer with stock still out",
      "CANCELLED",
      [event({ netUnits: -10 }), event({ operationId: "op-2", netUnits: 6 })],
      "PUT_BACK_UNFINISHED",
    ],
    [
      "a cancelled transfer whose stock is back",
      "CANCELLED",
      [event({ netUnits: -10 }), event({ operationId: "op-2", netUnits: 10 })],
      null,
    ],
    [
      "a shipped transfer the ledger does not know",
      "IN_TRANSIT",
      [],
      "NO_SHIPMENT_RECORD",
    ],
    ["a shipped transfer", "IN_TRANSIT", [event()], null],
    [
      "a transfer with part of its stock back at the source",
      "IN_TRANSIT",
      [event(), event({ operationId: "op-2", netUnits: 2 })],
      "RETURN_UNFINISHED",
    ],
    [
      "a transfer whose receipt is partly posted",
      "IN_TRANSIT",
      [
        event(),
        event({
          operationId: "op-2",
          leg: "receipt",
          status: "PARTIALLY_APPLIED",
          netUnits: 3,
          refusedChangeCount: 1,
        }),
      ],
      "RECEIPT_UNFINISHED",
    ],
    [
      "a transfer whose receipt Shopify has not answered",
      "IN_TRANSIT",
      [
        event(),
        event({
          operationId: "op-2",
          leg: "receipt",
          status: "APPLYING",
          unfinished: true,
          netUnits: 0,
        }),
      ],
      "RECEIPT_UNFINISHED",
    ],
    [
      "a transfer whose return Shopify has not answered",
      "IN_TRANSIT",
      [
        event(),
        event({
          operationId: "op-2",
          status: "RETRY_PENDING",
          unfinished: true,
          netUnits: 0,
        }),
      ],
      "RETURN_UNFINISHED",
    ],
  ] as const)(
    "compares the lines with the ledger: %s",
    async (_name, status, history, attention) => {
      given(
        { status },
        [status === "IN_TRANSIT" ? shippedLine() : line()],
        [...history],
      );

      expect((await loadDetail()).attention).toBe(attention);
    },
  );

  it("expects no ledger entries for a transfer Shopify moves itself", async () => {
    inTransit([shippedLine()], [], {
      shopifyTransferId: "gid://shopify/InventoryTransfer/1",
    });

    expect((await loadDetail()).attention).toBeNull();
  });
});

describe("Transfer page action", () => {
  it("always acts on the transfer in the address, whatever the form says", async () => {
    drafts.shipTransfer.mockResolvedValue({ ok: true, alreadyDone: false });

    await act({ intent: "ship", transferId: "tr-other", id: "tr-other" });

    expect(drafts.shipTransfer).toHaveBeenCalledWith(
      context.db,
      context.admin,
      STAFF,
      ID,
      { allowShortSource: false },
    );
  });

  it("does nothing without a transfer in the address", async () => {
    const result = await detailRoute.action(
      post("/app/transfers/", { intent: "ship" }, {}),
    );

    expect(result).toEqual({ error: "Transfer not found" });
    expect(drafts.shipTransfer).not.toHaveBeenCalled();
  });

  it("refuses an intent it does not know", async () => {
    expect(await act({ intent: "create" })).toEqual({
      error: "That action is not available.",
    });
    expect(drafts.createTransfer).not.toHaveBeenCalled();
  });

  it.each([
    "addItem",
    "addItems",
    "setQuantity",
    "pick",
    "remove",
    "ship",
    "cancel",
    "scan",
    "countIn",
    "reject",
    "countInAll",
    "postReceipt",
    "receiveAll",
    "close",
  ])(
    "saves nothing for %s without a signed-in staff member",
    async (intent) => {
      context.actor = null;

      expect(
        await act({
          intent,
          code: "RED-750",
          items: "RED-750",
          lineId: "line-1",
          quantity: "2",
          pickedQty: "1",
          rejectedQty: "1",
        }),
      ).toEqual({ error: STAFF_REQUIRED_MESSAGE });
      for (const [name, service] of Object.entries({
        ...drafts,
        ...receiving,
      })) {
        expect(service, name).not.toHaveBeenCalled();
      }
    },
  );

  describe("adding one item", () => {
    it("adds the scanned code with its units and says where the line stands", async () => {
      drafts.addTransferItems.mockResolvedValue({
        ok: true,
        added: 1,
        updated: 0,
        items: [{ title: "Red wine", quantity: 7 }],
      });

      const result = await act({
        intent: "addItem",
        code: " RED-750 ",
        quantity: "3",
      });

      expect(drafts.addTransferItems).toHaveBeenCalledWith(context.db, {
        transferId: ID,
        itemsText: "RED-750\t3",
      });
      expect(result).toEqual({
        ok: true,
        scannedAt: expect.any(Number),
        notice: "Red wine: 7 units on the transfer",
      });
    });

    it("adds one unit when no units are given, and keeps a code that ends in a number whole", async () => {
      drafts.addTransferItems.mockResolvedValue({
        ok: true,
        added: 1,
        updated: 0,
        items: [{ title: "Crate", quantity: 1 }],
      });

      await act({ intent: "addItem", code: "CRATE,12" });

      expect(drafts.addTransferItems).toHaveBeenCalledWith(context.db, {
        transferId: ID,
        itemsText: "CRATE,12\t1",
      });
    });

    it.each([
      [{ code: "   " }, "Scan or type a barcode or SKU."],
      [{}, "Scan or type a barcode or SKU."],
      [{ code: "A\nB" }, "Scan or type one barcode or SKU at a time."],
      [
        { code: "A", quantity: "0" },
        "Enter the units as a whole number from 1 to 1,000,000.",
      ],
      [
        { code: "A", quantity: "1.5" },
        "Enter the units as a whole number from 1 to 1,000,000.",
      ],
    ])("refuses %j before anything is looked up", async (fields, error) => {
      const result = await act({ intent: "addItem", ...fields });

      expect(result).toEqual({ error, scannedAt: expect.any(Number) });
      expect(drafts.addTransferItems).not.toHaveBeenCalled();
    });

    it("says in one sentence why a scanned code was not added", async () => {
      drafts.addTransferItems.mockResolvedValue({
        ok: false,
        error:
          "Some lines could not be added. Nothing was added to the transfer.",
        details: ["Line 1: no item has the barcode or SKU NOPE."],
      });

      expect(await act({ intent: "addItem", code: "NOPE" })).toEqual({
        error: "No item has the barcode or SKU NOPE.",
        scannedAt: expect.any(Number),
      });
    });

    it("passes on a refusal that names no line", async () => {
      drafts.addTransferItems.mockResolvedValue({
        ok: false,
        error:
          "This transfer has already been shipped or cancelled. Its lines can no longer be changed.",
        details: [],
      });

      expect(await act({ intent: "addItem", code: "RED-750" })).toEqual({
        error:
          "This transfer has already been shipped or cancelled. Its lines can no longer be changed.",
        scannedAt: expect.any(Number),
      });
    });
  });

  describe("adding a list of items", () => {
    it("passes the pasted text on as it is and counts what was added", async () => {
      drafts.addTransferItems.mockResolvedValue({
        ok: true,
        added: 2,
        updated: 1,
        items: [],
      });

      const result = await act({
        intent: "addItems",
        items: "RED-750\t4\nWHITE-750,2\n1111",
      });

      expect(drafts.addTransferItems).toHaveBeenCalledWith(context.db, {
        transferId: ID,
        itemsText: "RED-750\t4\nWHITE-750,2\n1111",
      });
      expect(result).toEqual({
        ok: true,
        notice:
          "2 items added to the transfer. 1 item already on it had units added.",
      });
    });

    it("hands the list back with the lines that were refused", async () => {
      drafts.addTransferItems.mockResolvedValue({
        ok: false,
        error:
          "Some lines could not be added. Nothing was added to the transfer.",
        details: ["Line 2: no item has the barcode or SKU NOPE."],
      });

      expect(await act({ intent: "addItems", items: "RED-750\nNOPE" })).toEqual(
        {
          error:
            "Some lines could not be added. Nothing was added to the transfer.",
          details: ["Line 2: no item has the barcode or SKU NOPE."],
          items: "RED-750\nNOPE",
        },
      );
    });

    it("does not hand back text that is too long to be a list", async () => {
      drafts.addTransferItems.mockResolvedValue({
        ok: false,
        error: "That is too much text for one list.",
        details: [],
      });

      const result = await act({
        intent: "addItems",
        items: "x".repeat(50_001),
      });

      expect(result).toEqual({
        error: "That is too much text for one list.",
        details: [],
        items: undefined,
      });
    });
  });

  describe("editing a draft line", () => {
    it("saves a quantity for a line of this transfer only", async () => {
      drafts.setTransferLineQuantity.mockResolvedValue({ ok: true });

      const result = await act({
        intent: "setQuantity",
        lineId: "line-1",
        quantity: "12",
      });

      expect(drafts.setTransferLineQuantity).toHaveBeenCalledWith(context.db, {
        lineId: "line-1",
        quantity: 12,
        transferId: ID,
      });
      expect(result).toEqual({ ok: true, notice: "Quantity saved." });
    });

    it.each(["0", "", "two", "1.5", "1000001"])(
      "refuses the quantity %j without saving NaN",
      async (quantity) => {
        const result = await act({
          intent: "setQuantity",
          lineId: "line-1",
          quantity,
        });

        expect(result).toEqual({
          error:
            "Enter the quantity as a whole number from 1 to 1,000,000. To take the item off the transfer, remove it.",
        });
        expect(drafts.setTransferLineQuantity).not.toHaveBeenCalled();
      },
    );

    it("saves a picked quantity, zero included", async () => {
      drafts.setTransferPickedQuantity.mockResolvedValue({ ok: true });

      const result = await act({
        intent: "pick",
        lineId: "line-1",
        pickedQty: "0",
      });

      expect(drafts.setTransferPickedQuantity).toHaveBeenCalledWith(
        context.db,
        { lineId: "line-1", pickedQty: 0, transferId: ID },
      );
      expect(result).toEqual({ ok: true, notice: "Picked quantity saved." });
    });

    it("refuses a picked quantity that is not a whole number", async () => {
      expect(
        await act({ intent: "pick", lineId: "line-1", pickedQty: "-1" }),
      ).toEqual({
        error: "Enter the picked quantity as a whole number of 0 or more.",
      });
      expect(drafts.setTransferPickedQuantity).not.toHaveBeenCalled();
    });

    it("removes a line of this transfer only", async () => {
      drafts.removeTransferLine.mockResolvedValue({ ok: true });

      const result = await act({ intent: "remove", lineId: "line-1" });

      expect(drafts.removeTransferLine).toHaveBeenCalledWith(context.db, {
        lineId: "line-1",
        transferId: ID,
      });
      expect(result).toEqual({
        ok: true,
        notice: "Item removed from the transfer.",
      });
    });

    it.each(["setQuantity", "pick", "remove", "countIn", "reject"])(
      "refuses %s without a line",
      async (intent) => {
        expect(await act({ intent, quantity: "1" })).toEqual({
          error: "Transfer line not found",
        });
        for (const call of [
          drafts.setTransferLineQuantity,
          drafts.setTransferPickedQuantity,
          drafts.removeTransferLine,
          receiving.setTransferReceiveQuantity,
          receiving.setTransferRejectedQuantity,
        ]) {
          expect(call).not.toHaveBeenCalled();
        }
      },
    );

    it("shows why a line could not be changed", async () => {
      drafts.setTransferLineQuantity.mockResolvedValue({
        ok: false,
        error:
          "This transfer has already been shipped or cancelled. Its lines can no longer be changed.",
      });

      expect(
        await act({ intent: "setQuantity", lineId: "line-1", quantity: "2" }),
      ).toEqual({
        error:
          "This transfer has already been shipped or cancelled. Its lines can no longer be changed.",
      });
    });
  });

  describe("ship", () => {
    it("confirms a shipped transfer", async () => {
      drafts.shipTransfer.mockResolvedValue({ ok: true, alreadyDone: false });

      expect(await act({ intent: "ship" })).toEqual({
        ok: true,
        notice:
          "Transfer shipped. Its stock has left the source location in Shopify.",
      });
    });

    it("says when the transfer was already shipped", async () => {
      drafts.shipTransfer.mockResolvedValue({ ok: true, alreadyDone: true });

      expect(await act({ intent: "ship" })).toEqual({
        ok: true,
        notice:
          "This transfer was already shipped. Nothing more was sent to Shopify.",
      });
    });

    it("hands back the items that are short at the source and that shipping can be confirmed", async () => {
      const problems = [
        {
          shopifyVariantId: "gid://shopify/ProductVariant/1",
          title: "Red wine",
          message:
            "Shopify shows 4 available at the source; the transfer takes 10 units.",
        },
      ];
      drafts.shipTransfer.mockResolvedValue({
        ok: false,
        error: "The source location does not have enough stock for every item.",
        problems,
        blocker: "SOURCE_SHORT",
      });

      expect(await act({ intent: "ship" })).toEqual({
        error: "The source location does not have enough stock for every item.",
        problems,
        blocker: "SOURCE_SHORT",
      });
    });

    it("ships below zero only when that was confirmed", async () => {
      drafts.shipTransfer.mockResolvedValue({ ok: true, alreadyDone: false });

      await act({ intent: "ship", allowShortSource: "true" });
      expect(drafts.shipTransfer).toHaveBeenLastCalledWith(
        context.db,
        context.admin,
        STAFF,
        ID,
        { allowShortSource: false },
      );

      await act({ intent: "ship", allowShortSource: "1" });
      expect(drafts.shipTransfer).toHaveBeenLastCalledWith(
        context.db,
        context.admin,
        STAFF,
        ID,
        { allowShortSource: true },
      );
    });
  });

  describe("cancel", () => {
    it("cancels a draft as the signed-in staff member", async () => {
      drafts.cancelTransfer.mockResolvedValue({ ok: true, alreadyDone: false });

      const result = await act({ intent: "cancel" });

      expect(drafts.cancelTransfer).toHaveBeenCalledWith(
        context.db,
        context.admin,
        STAFF,
        ID,
      );
      expect(result).toEqual({ ok: true, notice: "Transfer cancelled." });
    });

    it("says when a cancelled transfer has all of its stock back", async () => {
      drafts.cancelTransfer.mockResolvedValue({ ok: true, alreadyDone: true });

      expect(await act({ intent: "cancel" })).toEqual({
        ok: true,
        notice:
          "This transfer is cancelled and all of its stock is at the source location.",
      });
    });

    it("shows why a transfer could not be cancelled", async () => {
      drafts.cancelTransfer.mockResolvedValue({
        ok: false,
        error:
          "Only a draft transfer can be cancelled. This one has already shipped.",
        problems: [],
        blocker: null,
      });

      expect(await act({ intent: "cancel" })).toEqual({
        error:
          "Only a draft transfer can be cancelled. This one has already shipped.",
        problems: [],
      });
    });
  });

  describe("counting units in", () => {
    it("counts a scan in and says what is still to come", async () => {
      receiving.recordTransferReceiptScan.mockResolvedValue({
        ok: true,
        title: "Red wine",
        countedIn: 4,
        outstanding: 6,
      });

      const result = await act({ intent: "scan", code: "1111", quantity: "2" });

      expect(receiving.recordTransferReceiptScan).toHaveBeenCalledWith(
        context.db,
        { transferId: ID, code: "1111", quantity: 2 },
      );
      expect(result).toEqual({
        ok: true,
        scannedAt: expect.any(Number),
        notice: "Red wine: 4 counted in, 6 still to come",
      });
    });

    it("counts one unit when no units are given", async () => {
      receiving.recordTransferReceiptScan.mockResolvedValue({
        ok: true,
        title: "Red wine",
        countedIn: 1,
        outstanding: 9,
      });

      await act({ intent: "scan", code: "1111", quantity: "" });

      expect(receiving.recordTransferReceiptScan).toHaveBeenCalledWith(
        context.db,
        { transferId: ID, code: "1111", quantity: 1 },
      );
    });

    it("refuses scanned units that are not a whole number", async () => {
      expect(
        await act({ intent: "scan", code: "1111", quantity: "many" }),
      ).toEqual({
        error: "Enter the units as a whole number from 1 to 1,000,000.",
        scannedAt: expect.any(Number),
      });
      expect(receiving.recordTransferReceiptScan).not.toHaveBeenCalled();
    });

    it("shows why a scan was refused and readies the field for the next one", async () => {
      receiving.recordTransferReceiptScan.mockResolvedValue({
        ok: false,
        error: "White wine is not on this transfer.",
      });

      expect(await act({ intent: "scan", code: "2222" })).toEqual({
        error: "White wine is not on this transfer.",
        scannedAt: expect.any(Number),
      });
    });

    it("saves the units typed for a line, zero included", async () => {
      receiving.setTransferReceiveQuantity.mockResolvedValue({ ok: true });

      const result = await act({
        intent: "countIn",
        lineId: "line-1",
        quantity: "0",
      });

      expect(receiving.setTransferReceiveQuantity).toHaveBeenCalledWith(
        context.db,
        { lineId: "line-1", quantity: 0, transferId: ID },
      );
      expect(result).toEqual({ ok: true, notice: "Counted-in units saved." });
    });

    it("refuses typed units that are not a whole number", async () => {
      expect(
        await act({ intent: "countIn", lineId: "line-1", quantity: "" }),
      ).toEqual({
        error: "Enter the units that arrived as a whole number of 0 or more.",
      });
      expect(receiving.setTransferReceiveQuantity).not.toHaveBeenCalled();
    });

    it("counts in everything that is still to come", async () => {
      receiving.countInOutstandingUnits.mockResolvedValue({
        ok: true,
        units: 6,
      });

      const result = await act({ intent: "countInAll" });

      expect(receiving.countInOutstandingUnits).toHaveBeenCalledWith(
        context.db,
        { transferId: ID },
      );
      expect(result).toEqual({
        ok: true,
        notice: "6 units counted in. Check them, then post the receipt.",
      });
    });

    it("says when nothing was left to count in", async () => {
      receiving.countInOutstandingUnits.mockResolvedValue({
        ok: true,
        units: 0,
      });

      expect(await act({ intent: "countInAll" })).toEqual({
        ok: true,
        notice: "Every shipped unit is already accounted for.",
      });
    });
  });

  describe("rejects", () => {
    it("saves rejected units with their reason", async () => {
      receiving.setTransferRejectedQuantity.mockResolvedValue({ ok: true });

      const result = await act({
        intent: "reject",
        lineId: "line-1",
        rejectedQty: "2",
        note: "Broken in transit",
      });

      expect(receiving.setTransferRejectedQuantity).toHaveBeenCalledWith(
        context.db,
        {
          lineId: "line-1",
          rejectedQty: 2,
          note: "Broken in transit",
          transferId: ID,
        },
      );
      expect(result).toEqual({ ok: true, notice: "Rejected units saved." });
    });

    it("saves rejected units without a reason", async () => {
      receiving.setTransferRejectedQuantity.mockResolvedValue({ ok: true });

      await act({ intent: "reject", lineId: "line-1", rejectedQty: "1" });

      expect(receiving.setTransferRejectedQuantity).toHaveBeenCalledWith(
        context.db,
        { lineId: "line-1", rejectedQty: 1, note: null, transferId: ID },
      );
    });

    it("refuses rejected units that are not a whole number", async () => {
      expect(
        await act({ intent: "reject", lineId: "line-1", rejectedQty: "x" }),
      ).toEqual({
        error: "Enter the rejected units as a whole number of 0 or more.",
      });
      expect(receiving.setTransferRejectedQuantity).not.toHaveBeenCalled();
    });
  });

  describe("posting a receipt", () => {
    it("posts what is counted in and says the transfer stays open for the rest", async () => {
      receiving.postTransferReceipt.mockResolvedValue({
        ok: true,
        alreadyDone: false,
        receivedUnits: 4,
        completed: false,
      });

      const result = await act({ intent: "postReceipt" });

      expect(receiving.postTransferReceipt).toHaveBeenCalledWith(
        context.db,
        context.admin,
        STAFF,
        ID,
      );
      expect(receiving.receiveTransfer).not.toHaveBeenCalled();
      expect(result).toEqual({
        ok: true,
        notice:
          "Receipt posted: 4 units added to stock at the destination. The transfer stays in transit for the rest.",
      });
    });

    it("receives everything in one step and says the transfer is finished", async () => {
      receiving.receiveTransfer.mockResolvedValue({
        ok: true,
        alreadyDone: false,
        receivedUnits: 1,
        completed: true,
      });

      const result = await act({ intent: "receiveAll" });

      expect(receiving.receiveTransfer).toHaveBeenCalledWith(
        context.db,
        context.admin,
        STAFF,
        ID,
      );
      expect(receiving.postTransferReceipt).not.toHaveBeenCalled();
      expect(result).toEqual({
        ok: true,
        notice:
          "Receipt posted: 1 unit added to stock at the destination. The transfer is finished.",
      });
    });

    it("says when posting again only brought Shopify in line", async () => {
      receiving.postTransferReceipt.mockResolvedValue({
        ok: true,
        alreadyDone: false,
        receivedUnits: 0,
        completed: false,
      });

      expect(await act({ intent: "postReceipt" })).toEqual({
        ok: true,
        notice:
          "Receipt posted. Stock at the destination matches the units received. The transfer stays in transit for the rest.",
      });
    });

    it("says when the transfer was already received", async () => {
      receiving.postTransferReceipt.mockResolvedValue({
        ok: true,
        alreadyDone: true,
        receivedUnits: 0,
        completed: true,
      });

      expect(await act({ intent: "postReceipt" })).toEqual({
        ok: true,
        notice:
          "This transfer was already received. Nothing more was sent to Shopify.",
      });
    });

    it("hands back the changes Shopify refused", async () => {
      const problems = [
        {
          shopifyVariantId: "gid://shopify/ProductVariant/1",
          title: "Red wine",
          message: "Shopify refused this change.",
        },
      ];
      receiving.postTransferReceipt.mockResolvedValue({
        ok: false,
        error: "Shopify applied 1 of 2 changes.",
        problems,
        blocker: null,
      });

      expect(await act({ intent: "postReceipt" })).toEqual({
        error: "Shopify applied 1 of 2 changes.",
        problems,
      });
    });
  });

  describe("close", () => {
    it.each([
      ["RETURNED", "3 units put back into stock at the source."],
      ["WRITTEN_OFF", "3 units written off."],
    ] as const)(
      "closes a short transfer with its missing units %s",
      async (resolution, outcome) => {
        receiving.closeTransfer.mockResolvedValue({
          ok: true,
          alreadyDone: false,
          missingUnits: 3,
          resolution,
        });

        const result = await act({ intent: "close", resolution });

        expect(receiving.closeTransfer).toHaveBeenCalledWith(
          context.db,
          context.admin,
          STAFF,
          ID,
          { resolution },
        );
        expect(result).toEqual({
          ok: true,
          notice: `Transfer closed. ${outcome}`,
        });
      },
    );

    it("finishes a transfer with nothing missing", async () => {
      receiving.closeTransfer.mockResolvedValue({
        ok: true,
        alreadyDone: false,
        missingUnits: 0,
        resolution: null,
      });

      const result = await act({ intent: "close" });

      expect(receiving.closeTransfer).toHaveBeenCalledWith(
        context.db,
        context.admin,
        STAFF,
        ID,
        { resolution: null },
      );
      expect(result).toEqual({
        ok: true,
        notice:
          "Transfer finished. Every shipped unit is received or rejected.",
      });
    });

    it("says when the transfer was already finished", async () => {
      receiving.closeTransfer.mockResolvedValue({
        ok: true,
        alreadyDone: true,
        missingUnits: 0,
        resolution: null,
      });

      expect(await act({ intent: "close", resolution: "RETURNED" })).toEqual({
        ok: true,
        notice: "This transfer was already finished.",
      });
    });

    it("shows why a transfer could not be closed", async () => {
      receiving.closeTransfer.mockResolvedValue({
        ok: false,
        error: "Only a transfer that is in transit can be closed.",
        problems: [],
        blocker: null,
      });

      expect(await act({ intent: "close" })).toEqual({
        error: "Only a transfer that is in transit can be closed.",
        problems: [],
      });
    });
  });
});

describe("Transfer page", () => {
  it("shows a draft with its add, edit, ship and cancel forms", async () => {
    given({ notes: "Friday restock" }, [
      line({ pickedQty: 4 }),
      line({ id: "line-2", title: "White wine", sku: null, barcode: null }),
    ]);

    const html = await renderDetail();

    expect(html).toContain('heading="Transfer T-ABC123"');
    expect(html).toContain('href="/app/transfers"');
    expect(html).toContain("Draft");
    expect(html).toContain("Warehouse to Shop floor");
    expect(html).toContain("Created 2026-11-12 09:00 UTC by staff ID 42");
    expect(html).toContain("Notes: Friday restock");
    expect(html).toContain("2 items, 14 units to ship");
    expect(html).toContain(`href="/app/transfers/${ID}/export"`);
    expect(html).toContain(`href="/app/transfers/${ID}/pick-list"`);
    expect(html).toContain("Print pick list (PDF)");
    expect(html).toContain(`href="/app/transfers/${ID}/document"`);
    expect(html).toContain("Print transfer document (PDF)");
    expect(html).toMatch(
      /<s-text-field[^>]*label="Barcode or SKU"[^>]*name="code"/,
    );
    expect(html).toMatch(/<s-number-field[^>]*name="quantity"[^>]*value="10"/);
    // The picked field opens on what will ship: 4 picked, or all 10.
    expect(html).toMatch(/<s-number-field[^>]*name="pickedQty"[^>]*value="4"/);
    expect(html).toMatch(/<s-number-field[^>]*name="pickedQty"[^>]*value="10"/);
    expect(html).toContain("Takes 14 units out of stock at Warehouse");
    expect(html).not.toContain("<s-banner");
    expect(html).not.toContain("Ship anyway");
    expect(submitDisabled(html, "ship")).toBe(false);

    for (const intent of ["addItem", "setQuantity", "pick"]) {
      expect(page.formKeyHandlers.get(intent), intent).toBe(submitOnEnter);
    }
    // Forms that are only a button, or a text area, keep the browser's own behaviour.
    for (const intent of ["addItems", "remove", "ship"]) {
      expect(page.formKeyHandlers.has(intent), intent).toBe(true);
      expect(page.formKeyHandlers.get(intent), intent).toBeUndefined();
    }
    for (const intent of ["scan", "countIn", "postReceipt", "close"]) {
      expect(page.formKeyHandlers.has(intent), intent).toBe(false);
    }
  });

  it("keeps shipping unavailable while it is switched off or the draft is empty", async () => {
    isInventoryWriteEnabled.mockReturnValue(false);
    const switchedOff = await renderDetail();
    expect(submitDisabled(switchedOff, "ship")).toBe(true);
    expect(switchedOff).toContain(
      "Stock changes from transfers are switched off",
    );
    expect(switchedOff).not.toMatch(/FEATURE_/);
    // The draft itself can still be edited.
    expect(submitDisabled(switchedOff, "setQuantity")).toBe(false);

    isInventoryWriteEnabled.mockReturnValue(true);
    given({}, []);
    const empty = await renderDetail();
    expect(submitDisabled(empty, "ship")).toBe(true);
    expect(empty).toContain("No items are on this transfer yet.");
    expect(empty).not.toContain("/export");
    // Nothing to print either.
    expect(empty).not.toContain("/document");
    expect(empty).not.toContain("/pick-list");
  });

  it("offers one print button per part for a draft of more than 250 items", async () => {
    given({}, [line()]);
    reads.getTransferLines.mockResolvedValue({
      lines: [line()],
      total: 600,
      page: 1,
      pageCount: 12,
      totals: { ...transferTotals("DRAFT", [line()]), lineCount: 600 },
    });

    const html = await renderDetail();

    for (const part of [1, 2, 3]) {
      expect(html).toContain(
        `href="/app/transfers/${ID}/pick-list?part=${part}"`,
      );
      expect(html).toContain(
        `href="/app/transfers/${ID}/document?part=${part}"`,
      );
    }
    expect(html).toContain("Print pick list, part 1 of 3 (PDF)");
    expect(html).toContain("Print transfer document, part 3 of 3 (PDF)");
    expect(html).not.toContain("part=4");
    expect(html).not.toContain(`href="/app/transfers/${ID}/document"`);
  });

  it("offers to ship below zero only after the source was found short", async () => {
    const html = await renderDetail({
      error: "The source location does not have enough stock for every item.",
      problems: [
        {
          shopifyVariantId: "gid://shopify/ProductVariant/1",
          title: "Red wine",
          message:
            "Shopify shows 4 available at the source; the transfer takes 10 units.",
        },
      ],
      blocker: "SOURCE_SHORT",
    });

    expect(html).toContain("Red wine: Shopify shows 4 available at the source");
    expect(html).toContain('name="allowShortSource" value="1"');
    expect(html).toContain("Ship anyway");
    expect(html).toContain("will go below zero at Warehouse");

    const other = await renderDetail({
      error: "Shopify could not be reached.",
      problems: [],
      blocker: null,
    });
    expect(other).not.toContain("allowShortSource");
  });

  it("hands a refused list back in the field it was pasted into", async () => {
    const html = await renderDetail({
      error:
        "Some lines could not be added. Nothing was added to the transfer.",
      details: ["Line 2: no item has the barcode or SKU NOPE."],
      items: "RED-750\nNOPE",
    });

    expect(html).toContain("Line 2: no item has the barcode or SKU NOPE.");
    expect(html).toMatch(
      /<s-text-area[^>]*name="items"[^>]*value="RED-750\nNOPE"/,
    );
  });

  it("says when shipping a draft did not finish", async () => {
    given({}, [line()], [event({ status: "PARTIALLY_APPLIED", netUnits: -4 })]);

    const html = await renderDetail();

    expect(html).toContain('heading="Shipping this transfer did not finish"');
    expect(html).toContain("4 units left the source");
    expect(html).toContain("Confirmed by Shopify");
    expect(submitDisabled(html, "ship")).toBe(false);
  });

  it("shows a transfer in transit with its receiving forms", async () => {
    inTransit([
      shippedLine({ receivedQty: 3, pendingReceiveQty: 2 }),
      shippedLine({
        id: "line-2",
        title: "White wine",
        rejectedQty: 1,
        rejectNote: "Broken",
      }),
    ]);

    const html = await renderDetail();

    expect(html).toContain("Partly received");
    expect(html).toContain("Shipped 2026-11-12 10:00 UTC by staff ID 42");
    expect(html).toContain(
      "2 items, 20 units shipped · 3 received · 2 counted in and not posted · 1 rejected · 14 still to account for",
    );
    expect(html).toContain("Scanning counts units in at Shop floor.");
    expect(html).toContain("Count in all 14 units still to");
    expect(html).toMatch(/<s-number-field[^>]*name="quantity"[^>]*value="2"/);
    expect(html).toMatch(
      /<s-number-field[^>]*name="rejectedQty"[^>]*value="1"/,
    );
    expect(html).toMatch(/<s-text-field[^>]*name="note"[^>]*value="Broken"/);
    expect(html).toContain(
      "Adds the 2 units counted in to stock at Shop floor in Shopify.",
    );
    expect(submitDisabled(html, "postReceipt")).toBe(false);
    expect(page.formKeyHandlers.has("receiveAll")).toBe(false);
    // Closing waits for the counted-in units.
    expect(html).toContain("2 units are counted in and not posted.");
    expect(page.formKeyHandlers.has("close")).toBe(false);
    expect(html).not.toContain("<s-banner");
    // The transfer document travels with the stock; picking is over.
    expect(html).toContain(`href="/app/transfers/${ID}/document"`);
    expect(html).not.toContain("/pick-list");

    for (const intent of ["scan", "countIn", "reject"]) {
      expect(page.formKeyHandlers.get(intent), intent).toBe(submitOnEnter);
    }
    for (const intent of ["addItem", "addItems", "ship", "cancel", "remove"]) {
      expect(page.formKeyHandlers.has(intent), intent).toBe(false);
    }
  });

  it("offers to receive everything at once while nothing is counted in, and to close short", async () => {
    inTransit([shippedLine({ receivedQty: 7 })]);

    const html = await renderDetail();

    expect(html).toContain("Receive all 3 units");
    expect(submitDisabled(html, "receiveAll")).toBe(false);
    expect(page.formKeyHandlers.has("postReceipt")).toBe(false);
    expect(html).toContain(
      "3 units shipped on this transfer have not arrived.",
    );
    expect(html).toContain("Put back into stock at Warehouse");
    expect(html).toContain("Write off");
  });

  it("offers to finish a transfer whose last units were rejected", async () => {
    inTransit([shippedLine({ receivedQty: 9, rejectedQty: 1 })]);

    const html = await renderDetail();

    expect(html).toContain("Finish transfer");
    expect(html).toContain("Every shipped unit is received or rejected.");
    expect(submitDisabled(html, "close")).toBe(false);
    expect(html).toContain(
      "No units are counted in and none are still to come.",
    );
    expect(html).not.toContain("Write off");
  });

  it("keeps posting unavailable while stock changes are switched off, but not counting", async () => {
    isInventoryWriteEnabled.mockReturnValue(false);
    inTransit([shippedLine({ pendingReceiveQty: 2 })]);

    const counted = await renderDetail();
    expect(submitDisabled(counted, "postReceipt")).toBe(true);
    expect(submitDisabled(counted, "scan")).toBe(false);
    expect(submitDisabled(counted, "countIn")).toBe(false);
    expect(counted).toContain("Units can be counted in and rejects recorded.");

    inTransit([shippedLine()]);
    expect(submitDisabled(await renderDetail(), "receiveAll")).toBe(true);
  });

  it("says when the last receipt is partly posted and offers to post it again", async () => {
    inTransit(
      [shippedLine({ pendingReceiveQty: 0 })],
      [
        event(),
        event({
          operationId: "op-2",
          leg: "receipt",
          status: "PARTIALLY_APPLIED",
          netUnits: 3,
          refusedChangeCount: 1,
          staffName: "Dana",
        }),
      ],
    );

    const html = await renderDetail();

    expect(html).toContain('heading="The last receipt is not fully posted"');
    expect(submitDisabled(html, "postReceipt")).toBe(false);
    expect(html).toContain(
      "Brings stock at Shop floor in Shopify in line with the units received.",
    );
    expect(html).toContain("3 units received at the destination");
    expect(html).toContain("Dana");
    expect(html).toContain("Partly applied, 1 change refused by Shopify");
    // The receipt is settled before the transfer can be closed.
    expect(html).not.toContain("Write off");
  });

  it("offers only to close again while a return to the source is unfinished", async () => {
    inTransit(
      [shippedLine({ receivedQty: 6 })],
      [
        event(),
        event({ operationId: "op-2", leg: "receipt", netUnits: 6 }),
        event({
          operationId: "op-3",
          status: "PARTIALLY_APPLIED",
          netUnits: 1,
          refusedChangeCount: 2,
        }),
      ],
    );

    const html = await renderDetail();

    expect(html).toContain('heading="Closing this transfer did not finish"');
    expect(html).toContain("1 unit put back at the source");
    expect(html).toContain("Partly applied, 2 changes refused by Shopify");
    expect(html).toContain("Put back into stock at Warehouse");
    for (const intent of ["scan", "countIn", "reject", "postReceipt"]) {
      expect(page.formKeyHandlers.has(intent), intent).toBe(false);
    }
    // The lines stay readable.
    expect(html).toContain("Red wine");
  });

  it("lets units counted in during an unfinished return be set back to zero", async () => {
    inTransit(
      [
        shippedLine({ pendingReceiveQty: 2 }),
        shippedLine({ id: "line-2", title: "White wine" }),
      ],
      [event({ netUnits: -20 }), event({ operationId: "op-2", netUnits: 3 })],
    );

    const html = await renderDetail();

    expect(html).toContain('heading="Closing this transfer did not finish"');
    expect(
      html.match(/<input type="hidden" name="intent" value="countIn"\/>/g),
    ).toHaveLength(1);
    expect(html).toMatch(
      /name="lineId" value="line-1"\/>.*?<s-number-field[^>]*name="quantity"[^>]*value="2"/s,
    );
    expect(html).toContain("2 units are counted in and not posted.");
    for (const intent of ["scan", "reject", "postReceipt", "close"]) {
      expect(page.formKeyHandlers.has(intent), intent).toBe(false);
    }
  });

  it("offers nothing that moves stock for a shipment the ledger does not know", async () => {
    inTransit([shippedLine()], []);

    const html = await renderDetail();

    expect(html).toContain(
      'heading="ProPo has no record of this transfer leaving the source"',
    );
    expect(page.formKeyHandlers.size).toBe(0);
    expect(html).not.toContain("Stock changes in Shopify");
  });

  it("leaves a transfer that Shopify moves to Shopify", async () => {
    isInventoryWriteEnabled.mockReturnValue(false);
    inTransit([shippedLine()], [], {
      shopifyTransferId: "gid://shopify/InventoryTransfer/1",
    });

    const html = await renderDetail();

    expect(html).toContain(
      'heading="Shopify moves the stock of this transfer"',
    );
    expect(html).toContain("Receive it in Shopify admin");
    expect(html).not.toContain("switched off");
    expect(page.formKeyHandlers.size).toBe(0);
  });

  it("shows a received transfer read-only", async () => {
    given(
      {
        status: "RECEIVED",
        ...SHIPPED,
        receivedAt: new Date("2026-11-13T08:00:00.000Z"),
        receivedByUserId: "77",
      },
      [
        shippedLine({
          receivedQty: 9,
          rejectedQty: 1,
          rejectNote: "Broken",
          outstandingQty: 0,
        }),
      ],
      [event(), event({ operationId: "op-2", leg: "receipt", netUnits: 9 })],
    );

    const html = await renderDetail();

    expect(html).toContain("Received with rejects");
    expect(html).toContain("Received 2026-11-13 08:00 UTC by staff ID 77");
    expect(html).toContain(
      "1 item, 10 units shipped · 9 received · 1 rejected",
    );
    expect(html).not.toContain("still to account for");
    expect(html).toContain("Broken");
    expect(html).toContain("9 units received at the destination");
    expect(page.formKeyHandlers.size).toBe(0);
    expect(html).not.toContain("<s-banner");
    expect(html).toContain(`href="/app/transfers/${ID}/document"`);
    expect(html).toContain("Print transfer document (PDF)");
    expect(html).not.toContain("/pick-list");
  });

  it.each([
    [
      "RETURNED",
      { returnedQty: 3 },
      "3 units that did not arrive were put back into stock at the source.",
      "3 returned to the source",
    ],
    [
      "WRITTEN_OFF",
      { writtenOffQty: 3 },
      "3 units that did not arrive were written off.",
      "3 written off",
    ],
  ] as const)(
    "says what happened to the missing units of a transfer closed short (%s)",
    async (shortResolution, quantities, sentence, total) => {
      given(
        {
          status: "RECEIVED",
          ...SHIPPED,
          shortResolution,
          receivedAt: new Date("2026-11-13T08:00:00.000Z"),
          receivedByUserId: "77",
        },
        [shippedLine({ receivedQty: 7, outstandingQty: 0, ...quantities })],
      );

      const html = await renderDetail();

      expect(html).toContain("Closed short");
      expect(html).toContain(
        `Closed 2026-11-13 08:00 UTC by staff ID 77. ${sentence}`,
      );
      expect(html).toContain(total);
    },
  );

  it("shows nothing as shipped on a transfer that was cancelled as a draft", async () => {
    given(
      {
        status: "CANCELLED",
        cancelledAt: new Date("2026-11-12T11:00:00.000Z"),
        cancelledByUserId: null,
      },
      [line({ quantity: 5, pickedQty: 2, shipQty: 0 })],
    );

    const html = await renderDetail();

    expect(html).toContain(
      "Cancelled 2026-11-12 11:00 UTC by staff not recorded. Its stock stays at the source location.",
    );
    expect(html).toContain("1 item, 5 units requested");
    expect(html).not.toContain("Shipped");
    expect(
      [...html.matchAll(/<s-table-cell>(\d+)<\/s-table-cell>/g)].map((match) =>
        Number(match[1]),
      ),
    ).toEqual([5]);
    expect(page.formKeyHandlers.size).toBe(0);
  });

  it("offers to finish putting stock back on a cancelled transfer that still has stock out", async () => {
    given(
      { status: "CANCELLED" },
      [line()],
      [event(), event({ operationId: "op-2", netUnits: 6 })],
    );

    const html = await renderDetail();

    expect(html).toContain(
      'heading="Stock is still out of the source location"',
    );
    expect(html).toContain("Finish putting stock back");
    expect(submitDisabled(html, "cancel")).toBe(false);
    expect([...page.formKeyHandlers.keys()]).toEqual(["cancel"]);
  });

  it("keeps the filter in page links and marks the view that is shown", async () => {
    inTransit([shippedLine()]);
    reads.getTransferLines.mockResolvedValue({
      lines: [shippedLine()],
      total: 120,
      page: 2,
      pageCount: 3,
      totals: transferTotals("IN_TRANSIT", [shippedLine()]),
    });

    const html = await renderDetail(
      undefined,
      `/app/transfers/${ID}?filter=open&page=2`,
    );

    expect(html).toContain(
      '<s-text type="strong">Still to account for</s-text>',
    );
    expect(html).toContain(`<s-link href="/app/transfers/${ID}">All items`);
    expect(html).toContain(`href="/app/transfers/${ID}?filter=open"`);
    expect(html).toContain(
      `href="/app/transfers/${ID}?filter=open&amp;page=3"`,
    );
    expect(html).toContain("Page 2 of 3");
  });

  it("says when every item of the open view is accounted for", async () => {
    inTransit([shippedLine({ receivedQty: 10 })]);
    reads.getTransferLines.mockResolvedValue({
      lines: [],
      total: 0,
      page: 1,
      pageCount: 1,
      totals: transferTotals("IN_TRANSIT", [shippedLine({ receivedQty: 10 })]),
    });

    expect(
      await renderDetail(undefined, `/app/transfers/${ID}?filter=open`),
    ).toContain("Every item on this transfer is accounted for.");
  });

  it("shows merchant text as text", async () => {
    inTransit(
      [
        shippedLine({
          title: "<script>alert(1)</script>",
          sku: '"><b>',
          rejectedQty: 1,
          rejectNote: "<img src=x>",
        }),
      ],
      [event({ staffName: "<i>Dana</i>" })],
      { notes: '<img src=x onerror="alert(1)">' },
    );

    const html = await renderDetail();

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("<i>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

describe("Transfer report export", () => {
  const exportTransfer = () =>
    exportLoader(
      get(`/app/transfers/${ID}/export`, { id: ID }),
    ) as Promise<Response>;

  it("answers 404 in plain text for a transfer this shop does not have", async () => {
    reads.getTransfer.mockResolvedValue(null);

    const response = await exportTransfer();

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.text()).toBe("Transfer not found");
    expect(reads.listTransferLinesForExport).not.toHaveBeenCalled();
  });

  it("downloads one row per item as a private CSV file", async () => {
    inTransit([
      shippedLine({ receivedQty: 3, pendingReceiveQty: 2 }),
      shippedLine({
        id: "line-2",
        title: "White wine",
        sku: null,
        barcode: null,
        rejectedQty: 1,
        rejectNote: "Broken, wet",
      }),
    ]);

    const response = await exportTransfer();
    const [head, ...rows] = (await response.text()).trimEnd().split("\r\n");

    expect(reads.listTransferLinesForExport).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({ id: ID, status: "IN_TRANSIT" }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/csv; charset=utf-8",
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="transfer-T-ABC123-2026-11-12.csv"',
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(head).toBe(
      'Transfer,From,To,Status,Created at (UTC),Shipped at (UTC),Received or closed at (UTC),Item,SKU,Barcode,Requested,Shipped,Received,"Counted in, not posted",Rejected,Reject reason,Returned to source,Written off,Still to account for',
    );
    expect(rows).toEqual([
      "T-ABC123,Warehouse,Shop floor,Partly received,2026-11-12T09:00:00.000Z,2026-11-12T10:00:00.000Z,,Red wine,RED-750,1111,10,10,3,2,0,,0,0,5",
      'T-ABC123,Warehouse,Shop floor,Partly received,2026-11-12T09:00:00.000Z,2026-11-12T10:00:00.000Z,,White wine,,,10,10,0,0,1,"Broken, wet",0,0,9',
    ]);
  });

  it("neutralises spreadsheet formulas in names and reasons", async () => {
    inTransit([
      shippedLine({
        title: '=HYPERLINK("http://evil.example")',
        sku: "+SUM(A1)",
        rejectedQty: 1,
        rejectNote: "@cmd",
      }),
    ]);

    const [, row] = (await (await exportTransfer()).text()).split("\r\n");

    expect(row).toContain('"\'=HYPERLINK(""http://evil.example"")"');
    expect(row).toContain("'+SUM(A1)");
    expect(row).toContain("'@cmd");
  });

  it("names a location that is no longer synced by its ID", async () => {
    given({ sourceLocationId: "gid://shopify/Location/99" }, [line()]);

    const [, row] = (await (await exportTransfer()).text()).split("\r\n");

    expect(row).toContain(
      "T-ABC123,gid://shopify/Location/99,Shop floor,Draft,",
    );
  });
});

describe("Transfers without an active plan", () => {
  const PLAN_BANNER =
    'heading="An active ProPo plan is needed to make changes"';

  const attempt = async (run: () => Promise<unknown>): Promise<unknown> => {
    try {
      return await run();
    } catch (thrown) {
      return thrown;
    }
  };

  const CHANGES: Array<Record<string, string>> = [
    { intent: "addItem", code: "RED-750", quantity: "2" },
    { intent: "addItems", items: "RED-750,2" },
    { intent: "setQuantity", lineId: "line-1", quantity: "4" },
    { intent: "pick", lineId: "line-1", pickedQty: "4" },
    { intent: "remove", lineId: "line-1" },
    { intent: "ship" },
    { intent: "ship", allowShortSource: "1" },
    { intent: "cancel" },
    { intent: "scan", code: "RED-750" },
    { intent: "countIn", lineId: "line-1", quantity: "3" },
    { intent: "reject", lineId: "line-1", quantity: "1", note: "Broken" },
    { intent: "countInAll" },
    { intent: "postReceipt" },
    { intent: "receiveAll" },
    { intent: "close", resolution: "RETURNED" },
    { intent: "close", resolution: "WRITTEN_OFF" },
  ];

  const submitButtons = (html: string) =>
    html.match(/<s-button[^>]*type="submit"[^>]*>/g) ?? [];

  for (const snapshot of [{ subscriptionActive: false }, null]) {
    it(`refuses every change with 403 when the plan snapshot is ${JSON.stringify(snapshot)}`, async () => {
      context.db.shopSettings.findUnique.mockResolvedValue(snapshot);

      const refusals = [
        await attempt(() =>
          listRoute.action(
            post("/app/transfers", {
              intent: "create",
              sourceLocationId: WAREHOUSE,
              destinationLocationId: SHOP_FLOOR,
            }),
          ),
        ),
      ];
      for (const fields of CHANGES) {
        refusals.push(await attempt(() => act(fields)));
      }

      for (const [index, refusal] of refusals.entries()) {
        expect(refusal, String(index)).toBeInstanceOf(Response);
        expect((refusal as Response).status, String(index)).toBe(403);
      }
      expect(await (refusals[0] as Response).text()).toBe(
        "An active ProPo plan is required for this feature. You can choose a plan from Billing.",
      );
      for (const [name, service] of Object.entries({
        ...drafts,
        ...receiving,
      })) {
        expect(service, name).not.toHaveBeenCalled();
      }
      expect(reads.getTransfer).not.toHaveBeenCalled();
    });
  }

  it("asks for the plan snapshot of the signed-in shop before the change", async () => {
    drafts.cancelTransfer.mockResolvedValue({ ok: true, alreadyDone: false });

    await act({ intent: "cancel" });

    expect(drafts.cancelTransfer).toHaveBeenCalledTimes(1);

    expect(context.db.shopSettings.findUnique).toHaveBeenCalledWith({
      where: { shop: SHOP },
      select: { subscriptionActive: true },
    });
  });

  it("still lists transfers, says why nothing can be created and locks the form", async () => {
    context.db.shopSettings.findUnique.mockResolvedValue(null);

    const data = await listRoute.loader(get("/app/transfers"));
    expect(data).toMatchObject({ planActive: false, locations: LOCATIONS });
    expect(reads.listTransfers).toHaveBeenCalledTimes(1);

    const html = renderList({ planActive: false });
    expect(html).toContain(PLAN_BANNER);
    expect(html).toContain('href="/app/billing"');
    expect(submitDisabled(html, "create")).toBe(true);
  });

  it("shows no plan banner on the list while the plan is active", async () => {
    const data = await listRoute.loader(get("/app/transfers"));
    expect(data).toMatchObject({ planActive: true });

    const html = renderList({});
    expect(html).not.toContain(PLAN_BANNER);
    expect(submitDisabled(html, "create")).toBe(false);
  });

  it("still shows a draft, with every button locked and Enter doing nothing", async () => {
    context.db.shopSettings.findUnique.mockResolvedValue({
      subscriptionActive: false,
    });

    const html = await renderDetail();

    expect(html).toContain(PLAN_BANNER);
    expect(html).toContain("Red wine");
    const buttons = submitButtons(html);
    expect(buttons.length).toBeGreaterThan(4);
    for (const button of buttons) {
      expect(button).toContain('disabled="true"');
    }
    expect(page.formKeyHandlers.size).toBeGreaterThan(2);
    for (const [intent, handler] of page.formKeyHandlers) {
      expect(handler, intent).toBeUndefined();
    }
    // Reading and printing stay open, as the report download does.
    expect(html).toContain(`href="/app/transfers/${ID}/pick-list"`);
    expect(html).toContain(`href="/app/transfers/${ID}/document"`);
  });

  it("still shows a transfer in transit, with receiving and closing locked", async () => {
    context.db.shopSettings.findUnique.mockResolvedValue(null);
    inTransit([shippedLine({ pendingReceiveQty: 2 })]);

    const html = await renderDetail();

    expect(html).toContain(PLAN_BANNER);
    const buttons = submitButtons(html);
    expect(buttons.length).toBeGreaterThan(3);
    for (const button of buttons) {
      expect(button).toContain('disabled="true"');
    }
    for (const [intent, handler] of page.formKeyHandlers) {
      expect(handler, intent).toBeUndefined();
    }
  });

  it("shows no plan banner on a transfer while the plan is active", async () => {
    const html = await renderDetail();

    expect(html).not.toContain(PLAN_BANNER);
    expect(submitDisabled(html, "addItem")).toBe(false);
  });

  it("does not hide a database failure behind the plan banner", async () => {
    context.db.shopSettings.findUnique.mockRejectedValue(
      new Error("connection lost"),
    );

    await expect(loadDetail()).rejects.toThrow("connection lost");
    await expect(listRoute.loader(get("/app/transfers"))).rejects.toThrow(
      "connection lost",
    );
  });

  it("still downloads the transfer report", async () => {
    context.db.shopSettings.findUnique.mockResolvedValue(null);

    const response = (await exportLoader(
      get(`/app/transfers/${ID}/export`, { id: ID }),
    )) as Response;

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("RED-750");
    expect(context.db.shopSettings.findUnique).not.toHaveBeenCalled();
  });
});

describe("Transfer times on the shop's clock", () => {
  const TORONTO = "America/Toronto";

  beforeEach(() => {
    shopClock.readShopTimeZone.mockResolvedValue(TORONTO);
  });

  it("reads the zone of the shop the request is signed in to, for the list and for a transfer", async () => {
    const list = await listRoute.loader(get("/app/transfers"));
    const detail = await loadDetail();

    expect(shopClock.readShopTimeZone).toHaveBeenCalledTimes(2);
    expect(shopClock.readShopTimeZone).toHaveBeenNthCalledWith(
      1,
      context.db.authority,
    );
    expect(shopClock.readShopTimeZone).toHaveBeenNthCalledWith(
      2,
      context.db.authority,
    );
    expect(list).toMatchObject({ timeZone: TORONTO });
    expect(detail).toMatchObject({ timeZone: TORONTO });
  });

  it("lists each transfer with the time it was created on the shop's clock", () => {
    const transfer = header({
      createdAt: new Date("2026-11-13T02:30:00.000Z"),
    });

    const html = renderList({
      timeZone: TORONTO,
      transfers: [{ ...transfer, totals: transferTotals("DRAFT", [line()]) }],
    });

    expect(html).toContain("Nov 12, 2026, 9:30 PM EST");
    expect(html).not.toContain("UTC");
  });

  it("shows when a transfer was created, shipped and received, and each stock change, on the shop's clock", async () => {
    given(
      {
        status: "RECEIVED",
        ...SHIPPED,
        receivedAt: new Date("2026-11-13T08:00:00.000Z"),
        receivedByUserId: "77",
      },
      [shippedLine({ receivedQty: 10 })],
      [
        event(),
        event({
          operationId: "op-2",
          leg: "receipt",
          at: new Date("2026-11-13T08:00:00.000Z"),
          netUnits: 10,
        }),
      ],
    );

    const html = await renderDetail();

    expect(html).toContain("Created Nov 12, 2026, 4:00 AM EST by staff ID 42");
    expect(html).toContain("Shipped Nov 12, 2026, 5:00 AM EST by staff ID 42");
    expect(html).toContain("Received Nov 13, 2026, 3:00 AM EST by staff ID 77");
    expect(html).toContain(
      "<s-table-cell>Nov 13, 2026, 3:00 AM EST</s-table-cell>",
    );
    expect(html).not.toContain("UTC");
  });

  it("shows when a transfer was cancelled on the shop's clock", async () => {
    given(
      {
        status: "CANCELLED",
        cancelledAt: new Date("2026-11-12T11:00:00.000Z"),
        cancelledByUserId: "42",
      },
      [line()],
    );

    const html = await renderDetail();

    expect(html).toContain(
      "Cancelled Nov 12, 2026, 6:00 AM EST by staff ID 42",
    );
    expect(html).not.toContain("UTC");
  });

  it("writes the report's times on the shop's clock, names the clock in each heading and dates the file by the shop's day", async () => {
    given(
      {
        status: "IN_TRANSIT",
        createdAt: new Date("2026-11-13T02:30:00.000Z"),
        shippedAt: new Date("2026-11-13T15:05:00.000Z"),
        shippedByUserId: "42",
      },
      [shippedLine()],
    );

    const response = (await exportLoader(
      get(`/app/transfers/${ID}/export`, { id: ID }),
    )) as Response;
    const [head, row] = (await response.text()).trimEnd().split("\r\n");

    expect(shopClock.readShopTimeZone).toHaveBeenCalledWith(
      context.db.authority,
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="transfer-T-ABC123-2026-11-12.csv"',
    );
    expect(head).toContain(
      "Created at (America/Toronto),Shipped at (America/Toronto),Received or closed at (America/Toronto),",
    );
    expect(head).not.toContain("UTC");
    expect(row).toBe(
      "T-ABC123,Warehouse,Shop floor,In transit,2026-11-12 21:30,2026-11-13 10:05,,Red wine,RED-750,1111,10,10,0,0,0,,0,0,10",
    );
  });

  it("dates the report's file by the UTC day while the shop's zone is not known", async () => {
    shopClock.readShopTimeZone.mockResolvedValue(null);
    given({ createdAt: new Date("2026-11-13T02:30:00.000Z") }, [line()]);

    const response = (await exportLoader(
      get(`/app/transfers/${ID}/export`, { id: ID }),
    )) as Response;

    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="transfer-T-ABC123-2026-11-13.csv"',
    );
  });
});
