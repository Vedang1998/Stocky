/**
 * The printed transfer papers: what the transfer document and the pick list
 * say for each stage of a transfer, and what the two PDF routes answer. The
 * read model behind them is covered against PostgreSQL in
 * scripts/tenant-enforcement/tests/transfer-workflow.test.ts.
 */
import { isValidElement } from "react";
import * as reactPdf from "@react-pdf/renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoaderFunctionArgs } from "react-router";
import type {
  TransferHeader,
  TransferLineView,
} from "./transfers/transfer-read.server";
import { pdfPartCount } from "../lib/pdf/parts";
import { transferTotals } from "./transfers/transfer-quantities";
import { transferStatusBadge } from "./transfers/transfer-display";
import type { TransferPaper } from "./transfers/transfer-documents.server";

const WAREHOUSE = "gid://shopify/Location/1";
const SHOP_FLOOR = "gid://shopify/Location/2";
const ID = "clxtransfer0001abc123";

const { reads, context } = vi.hoisted(() => ({
  reads: { getTransfer: vi.fn(), listTransferLinesForExport: vi.fn() },
  context: {
    db: { shopifyLocationFact: { findMany: vi.fn() } },
    admin: { graphql: vi.fn() },
  },
}));

vi.mock("./transfers/transfer-read.server", async () => {
  const actual = await vi.importActual<
    typeof import("./transfers/transfer-read.server")
  >("./transfers/transfer-read.server");
  return { ...actual, ...reads };
});

const { limiter, tenant } = vi.hoisted(() => ({
  limiter: { refusePaperOverLimit: vi.fn() },
  tenant: { shopId: "shop-a", correlationId: "request-1" },
}));

vi.mock("../lib/pdf/paper-rate-limit.server", () => limiter);

vi.mock("../tenant/require-admin-tenant.server", () => ({
  requireAdminTenant: vi.fn(async () => ({
    admin: context.admin,
    db: context.db,
    tenant,
  })),
}));

import { loader as documentLoader } from "../routes/app.transfers_.$id_.document";
import { loader as pickListLoader } from "../routes/app.transfers_.$id_.pick-list";
import {
  pickListDocument,
  pickOrder,
  readTransferPaper,
  transferDocument,
} from "./transfers/transfer-documents.server";

const header = (extra: Partial<TransferHeader> = {}): TransferHeader => ({
  id: ID,
  sourceLocationId: WAREHOUSE,
  destinationLocationId: SHOP_FLOOR,
  status: "DRAFT",
  notes: null,
  shopifyTransferId: null,
  shortResolution: null,
  createdAt: new Date("2026-11-10T20:45:00Z"),
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
  status: "IN_TRANSIT",
  shippedAt: new Date("2026-11-11T14:05:00Z"),
  shippedByUserId: "42",
} as const;

const line = (extra: Partial<TransferLineView> = {}): TransferLineView => ({
  id: "line-red",
  shopifyVariantId: "gid://shopify/ProductVariant/1",
  title: "Red wine",
  sku: "RED-750",
  barcode: "0123456789012",
  quantity: 6,
  pickedQty: 0,
  receivedQty: 0,
  pendingReceiveQty: 0,
  rejectedQty: 0,
  rejectNote: null,
  returnedQty: 0,
  shipQty: 6,
  outstandingQty: 0,
  writtenOffQty: 0,
  ...extra,
});

const WHITE = {
  id: "line-white",
  shopifyVariantId: "gid://shopify/ProductVariant/2",
  title: "White wine",
  sku: "WHT-750",
  barcode: null,
  quantity: 4,
  shipQty: 4,
} as const;

function paper(
  transfer: TransferHeader,
  lines: TransferLineView[],
  extra: Partial<TransferPaper> = {},
): TransferPaper {
  const totals = transferTotals(transfer.status, lines);
  return {
    reference: "T-ABC123",
    transfer,
    statusLabel: transferStatusBadge(transfer.status, totals).label,
    source: {
      name: "Warehouse",
      addressLines: ["12 Dock Road", "Toronto, ON M5V 2T6", "CA"],
    },
    destination: { name: "Shop floor", addressLines: ["80 King Street"] },
    lines,
    totals,
    ...extra,
  };
}

const TORONTO = { shopName: "Cellar & Co", timeZone: "America/Toronto" };

/** Every piece of text in a document, in reading order; line breaks inside a cell are left out. */
function documentText(node: unknown): string[] {
  if (node === "\n") return [];
  if (typeof node === "string" || typeof node === "number") {
    return [String(node)];
  }
  if (Array.isArray(node)) return node.flatMap(documentText);
  if (isValidElement(node)) {
    return documentText((node.props as { children?: unknown }).children);
  }
  return [];
}

const transferText = (
  subject: TransferPaper,
  setting: {
    shopName: string | null;
    timeZone: string | null;
    part?: number;
  } = TORONTO,
) => documentText(transferDocument(reactPdf, subject, setting));

const pickListText = (subject: TransferPaper, part?: number) =>
  documentText(pickListDocument(reactPdf, subject, { ...TORONTO, part }));

/** `count` lines named Item 1, Item 2, … with SKUs that sort the other way round. */
const manyLines = (
  count: number,
  extra: Partial<TransferLineView> = {},
): TransferLineView[] =>
  Array.from({ length: count }, (_, index) =>
    line({
      id: `line-${String(index + 1).padStart(4, "0")}`,
      title: `Item ${index + 1}`,
      sku: `S-${count - index}`,
      barcode: null,
      quantity: 1,
      shipQty: 1,
      ...extra,
    }),
  );

function args(
  path: string,
  params: Record<string, string> = { id: ID },
): LoaderFunctionArgs {
  return {
    request: new Request(`https://app.example${path}`),
    params,
    context: {},
  } as LoaderFunctionArgs;
}

const LOCATION_ROWS = [
  {
    shopifyGid: WAREHOUSE,
    name: "Warehouse",
    address1: "12 Dock Road",
    city: "Toronto",
    provinceCode: "ON",
    zip: "M5V 2T6",
    countryCode: "CA",
  },
  {
    shopifyGid: SHOP_FLOOR,
    name: "Shop floor",
    address1: null,
    city: "Toronto",
    provinceCode: null,
    zip: null,
    countryCode: null,
  },
];

function shopAnswers(shop: Record<string, unknown> | null) {
  context.admin.graphql.mockResolvedValue({
    json: async () => ({ data: { shop } }),
  });
}

beforeEach(() => {
  reads.getTransfer.mockReset();
  reads.listTransferLinesForExport.mockReset();
  context.db.shopifyLocationFact.findMany.mockReset();
  context.admin.graphql.mockReset();
  limiter.refusePaperOverLimit.mockReset();
  limiter.refusePaperOverLimit.mockResolvedValue(null);

  reads.getTransfer.mockResolvedValue(header());
  reads.listTransferLinesForExport.mockResolvedValue([line(), line(WHITE)]);
  context.db.shopifyLocationFact.findMany.mockResolvedValue(LOCATION_ROWS);
  shopAnswers({
    name: "Cellar & Co",
    currencyCode: "CAD",
    ianaTimezone: "America/Toronto",
  });
});

describe("Transfer document", () => {
  it("is the sheet to check a delivery against while the stock is on its way", () => {
    const text = transferText(
      paper(header({ ...SHIPPED, notes: "Two cartons, fragile" }), [
        line(),
        line(WHITE),
      ]),
    );

    expect(text).toEqual(
      expect.arrayContaining([
        "Transfer T-ABC123",
        "Cellar & Co · In transit · 2 items, 10 units sent",
        "From",
        "Warehouse",
        "12 Dock Road",
        "Toronto, ON M5V 2T6",
        "CA",
        "To",
        "Shop floor",
        "80 King Street",
        "Created Nov 10, 2026, 3:45 PM EST",
        "Shipped Nov 11, 2026, 9:05 AM EST",
        "Item",
        "Barcode / SKU",
        "Sent",
        "Received",
        "Damaged",
        "Red wine",
        "0123456789012",
        "SKU RED-750",
        "6",
        "White wine",
        "WHT-750",
        "4",
        "Packed by",
        "Received by",
        "Notes",
        "Two cartons, fragile",
      ]),
    );
    // The travelling copy has boxes to write in, not the columns of the record.
    expect(text).not.toContain("Written off");
    expect(text).not.toContain("Total units");
    expect(text.join("\n")).not.toMatch(/NaN|undefined|null/);
  });

  it("says what is still to be sent for a draft, picked quantities included", () => {
    const text = transferText(
      paper(header(), [line({ pickedQty: 5, shipQty: 5 }), line(WHITE)]),
    );

    expect(text).toContain("Cellar & Co · Draft · 2 items, 9 units to send");
    expect(text).toContain("To send");
    expect(text).not.toContain("Sent");
    expect(text).toContain("5");
    expect(text.filter((part) => part.startsWith("Shipped"))).toEqual([]);
  });

  it("says how much of a transfer in transit the destination has already counted", () => {
    const text = transferText(
      paper(header(SHIPPED), [
        line({ receivedQty: 2, pendingReceiveQty: 1, outstandingQty: 2 }),
        line({ ...WHITE, rejectedQty: 1, outstandingQty: 3 }),
      ]),
    );

    expect(text).toContain(
      "Cellar & Co · Partly received · 2 items, 10 units sent, 4 already counted at the destination",
    );
  });

  it("is the record of where every unit ended up once the transfer is finished", () => {
    const closedShort = header({
      ...SHIPPED,
      status: "RECEIVED",
      receivedAt: new Date("2026-11-12T16:30:00Z"),
      receivedByUserId: "43",
      shortResolution: "WRITTEN_OFF",
    });
    const text = transferText(
      paper(closedShort, [
        line({
          receivedQty: 3,
          rejectedQty: 1,
          rejectNote: "Torn carton",
          writtenOffQty: 2,
        }),
        line({ ...WHITE, receivedQty: 4 }),
      ]),
    );

    expect(text).toEqual(
      expect.arrayContaining([
        "Cellar & Co · Closed short · 2 items, 10 units sent, 7 received",
        "Closed Nov 12, 2026, 11:30 AM EST",
        "Asked",
        "Sent",
        "Received",
        "Rejected",
        "Returned",
        "Written off",
        "Rejected: Torn carton",
        "Total units",
      ]),
    );
    // Asked, sent, received, rejected, returned, written off: the first line, then the totals.
    const red = text.indexOf("SKU RED-750");
    expect(text.slice(red + 1, red + 7)).toEqual([
      "6",
      "6",
      "3",
      "1",
      "0",
      "2",
    ]);
    const totals = text.indexOf("Total units");
    expect(text.slice(totals + 2, totals + 8)).toEqual([
      "10",
      "10",
      "7",
      "1",
      "0",
      "2",
    ]);
    // Nothing is left to sign for or to count.
    expect(text).not.toContain("Packed by");
    expect(text).not.toContain("Damaged");
    expect(text.join("\n")).not.toMatch(/NaN|undefined|null/);
  });

  it("says a transfer received in full was received, not closed", () => {
    const text = transferText(
      paper(
        header({
          ...SHIPPED,
          status: "RECEIVED",
          receivedAt: new Date("2026-11-12T16:30:00Z"),
        }),
        [line({ receivedQty: 6 })],
      ),
    );

    expect(text).toContain("Received Nov 12, 2026, 11:30 AM EST");
    expect(text).toContain(
      "Cellar & Co · Received · 1 item, 6 units sent, 6 received",
    );
  });

  it("shows that nothing left the source for a cancelled transfer", () => {
    const text = transferText(
      paper(
        header({
          status: "CANCELLED",
          cancelledAt: new Date("2026-11-11T01:00:00Z"),
        }),
        [line({ shipQty: 0 })],
      ),
    );

    expect(text).toContain(
      "Cellar & Co · Cancelled · 1 item, 6 units asked for, none sent",
    );
    expect(text).toContain("Cancelled Nov 10, 2026, 8:00 PM EST");
    const red = text.indexOf("SKU RED-750");
    expect(text.slice(red + 1, red + 3)).toEqual(["6", "0"]);
  });

  it("gives times in UTC, and says so, when the shop's time zone is not known", () => {
    const subject = paper(header(SHIPPED), [line()]);

    expect(transferText(subject, { shopName: null, timeZone: null })).toEqual(
      expect.arrayContaining([
        "In transit · 1 item, 6 units sent",
        "Created 2026-11-10 20:45 UTC",
        "Shipped 2026-11-11 14:05 UTC",
      ]),
    );
    expect(
      transferText(subject, { shopName: null, timeZone: "Mars/Olympus" }),
    ).toContain("Created 2026-11-10 20:45 UTC");
  });

  it("prints a transfer with no items rather than an empty table", () => {
    const text = transferText(paper(header(), []));

    expect(text).toContain("Cellar & Co · Draft · No items yet");
    expect(text).toContain("No items on this transfer.");
  });

  it("falls back to the SKU when an item has no barcode, and to a dash when it has neither", () => {
    const text = transferText(
      paper(header(SHIPPED), [
        line(WHITE),
        line({ id: "line-gin", title: "Gin", sku: null, barcode: null }),
      ]),
    );

    expect(text).toContain("WHT-750");
    expect(text).not.toContain("SKU WHT-750");
    expect(text).toContain("—");
  });
});

describe("Pick list", () => {
  it("lists what to pull in SKU order, with what was already entered as picked", () => {
    const subject = paper(header({ notes: "Top shelf first" }), [
      line({ id: "l1", title: "Gin", sku: "SKU-10", quantity: 2, shipQty: 2 }),
      line({ id: "l2", title: "Loose corks", sku: null, barcode: null }),
      line({
        id: "l3",
        title: "Rum",
        sku: "sku-9",
        quantity: 12,
        pickedQty: 8,
        shipQty: 8,
      }),
      line({ id: "l4", title: "Ale", sku: " ", barcode: "999" }),
    ]);
    const text = pickListText(subject);

    expect(pickOrder(subject.lines).map((entry) => entry.title)).toEqual([
      "Rum",
      "Gin",
      "Ale",
      "Loose corks",
    ]);
    expect(text).toEqual(
      expect.arrayContaining([
        "Pick list T-ABC123",
        "Cellar & Co · 4 items, 26 units to pick · In SKU order",
        "From",
        "Warehouse",
        "To",
        "Shop floor",
        "To pick",
        "Picked",
        "8 already entered as picked",
        "Notes",
        "Top shelf first",
      ]),
    );
    // The quantity to pull is what the transfer asks for, not what is picked so far.
    const rum = text.indexOf("SKU sku-9");
    expect(text[rum + 1]).toBe("12");
    expect(text.indexOf("Rum")).toBeLessThan(text.indexOf("Gin"));
    expect(text.indexOf("Ale")).toBeLessThan(text.indexOf("Loose corks"));
    expect(text.join("\n")).not.toMatch(/NaN|undefined|null/);
  });

  it("does not sort the caller's lines in place", () => {
    const lines = [line({ id: "b", sku: "B" }), line({ id: "a", sku: "A" })];

    pickOrder(lines);

    expect(lines.map((entry) => entry.id)).toEqual(["b", "a"]);
  });

  it("prints a draft with no items", () => {
    const text = pickListText(paper(header(), []));

    expect(text).toContain("Cellar & Co · No items yet");
    expect(text).toContain("No items on this transfer.");
  });
});

describe("A transfer too long for one document", () => {
  it("prints in parts of 250 items", () => {
    expect([0, 1, 250, 251, 500, 501, 1000].map(pdfPartCount)).toEqual([
      1, 1, 1, 2, 2, 3, 4,
    ]);
  });

  it("puts each item on exactly one part of the transfer document, in the order of the transfer", () => {
    const subject = paper(
      header({ ...SHIPPED, notes: "Pallet 3" }),
      manyLines(600),
    );
    const parts = [1, 2, 3].map((part) =>
      transferText(subject, { ...TORONTO, part }),
    );
    const items = (text: string[]) =>
      text.filter((entry) => /^Item \d+$/.test(entry));

    expect(parts[0]).toContain("Transfer T-ABC123 · Part 1 of 3");
    expect(parts[0]).toContain(
      "Cellar & Co · In transit · 600 items, 600 units sent · Items 1 to 250 of 600",
    );
    expect(parts[1]).toContain("Transfer T-ABC123 · Part 2 of 3");
    expect(parts[1].join("\n")).toContain("Items 251 to 500 of 600");
    expect(parts[2].join("\n")).toContain("Items 501 to 600 of 600");

    expect(items(parts[0])).toHaveLength(250);
    expect(items(parts[1])).toHaveLength(250);
    expect(items(parts[2])).toHaveLength(100);
    expect(items(parts[1])[0]).toBe("Item 251");
    expect(parts.flatMap(items)).toEqual(
      subject.lines.map((entry) => entry.title),
    );

    // Signatures and notes close the last part only.
    for (const text of parts.slice(0, 2)) {
      expect(text).not.toContain("Packed by");
      expect(text).not.toContain("Pallet 3");
    }
    expect(parts[2]).toContain("Packed by");
    expect(parts[2]).toContain("Pallet 3");
    // Every part still says where it is going.
    for (const text of parts) expect(text).toContain("Shop floor");
  });

  it("totals the whole transfer once, on the last part of the record", () => {
    const subject = paper(
      header({
        ...SHIPPED,
        status: "RECEIVED",
        receivedAt: new Date("2026-11-12T16:30:00Z"),
      }),
      manyLines(300, { receivedQty: 1 }),
    );

    const first = transferText(subject, { ...TORONTO, part: 1 });
    const last = transferText(subject, { ...TORONTO, part: 2 });

    expect(first.join("\n")).not.toContain("Total units");
    const totals = last.indexOf("Total units, all parts");
    expect(last.slice(totals + 2, totals + 5)).toEqual(["300", "300", "300"]);
  });

  it("splits the pick list after sorting, so the parts follow one walk through the stock", () => {
    const subject = paper(header(), manyLines(300));

    const first = pickListText(subject, 1);
    const second = pickListText(subject, 2);

    expect(first).toContain("Pick list T-ABC123 · Part 1 of 2");
    expect(first).toContain(
      "Cellar & Co · 300 items, 300 units to pick · In SKU order · Items 1 to 250 of 300",
    );
    // SKUs run against the order the lines were added: S-1 belongs to the last line.
    expect(first).toContain("Item 300");
    expect(first).toContain("S-250");
    expect(first).not.toContain("S-251");
    expect(second).toContain("S-251");
    expect(second).toContain("Item 1");
    expect(second.join("\n")).toContain("Items 251 to 300 of 300");
  });
});

describe("What the transfer papers read", () => {
  it("puts both locations on the paper with the address parts Shopify has", async () => {
    const read = await readTransferPaper(context.db as never, ID);

    expect(context.db.shopifyLocationFact.findMany).toHaveBeenCalledWith({
      where: {
        shopifyGid: { in: [WAREHOUSE, SHOP_FLOOR] },
        existenceState: "LIVE",
      },
      select: {
        shopifyGid: true,
        name: true,
        address1: true,
        city: true,
        provinceCode: true,
        zip: true,
        countryCode: true,
      },
    });
    expect(read).toMatchObject({
      reference: "T-ABC123",
      statusLabel: "Draft",
      source: {
        name: "Warehouse",
        addressLines: ["12 Dock Road", "Toronto, ON M5V 2T6", "CA"],
      },
      destination: { name: "Shop floor", addressLines: ["Toronto"] },
      totals: { lineCount: 2, requestedUnits: 10, shipUnits: 10 },
    });
    expect(read?.lines.map((entry) => entry.title)).toEqual([
      "Red wine",
      "White wine",
    ]);
  });

  it("names a location Shopify no longer has without showing its ID", async () => {
    context.db.shopifyLocationFact.findMany.mockResolvedValue([
      LOCATION_ROWS[0],
    ]);

    const read = await readTransferPaper(context.db as never, ID);

    expect(read?.destination).toEqual({
      name: "Location no longer in Shopify",
      addressLines: [],
    });
    expect(JSON.stringify(read?.destination)).not.toContain("gid://");
  });

  it("reads nothing more for a transfer the shop does not have", async () => {
    reads.getTransfer.mockResolvedValue(null);

    expect(await readTransferPaper(context.db as never, ID)).toBeNull();
    expect(reads.listTransferLinesForExport).not.toHaveBeenCalled();
    expect(context.db.shopifyLocationFact.findMany).not.toHaveBeenCalled();
  });
});

describe("Transfer paper routes", () => {
  async function expectPdf(response: Response, filename: string) {
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      `inline; filename="${filename}"`,
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1_000);
  }

  it("answers the transfer document as a PDF named after the transfer", async () => {
    reads.getTransfer.mockResolvedValue(header(SHIPPED));

    const response = await documentLoader(
      args(`/app/transfers/${ID}/document`),
    );

    await expectPdf(response, "transfer-T-ABC123.pdf");
    // The transfer is looked up through the signed-in shop's database handle.
    expect(reads.getTransfer).toHaveBeenCalledWith(context.db, ID);
    expect(reads.listTransferLinesForExport).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({ id: ID, status: "IN_TRANSIT" }),
    );
  });

  it("answers the pick list of a draft as a PDF", async () => {
    const response = await pickListLoader(
      args(`/app/transfers/${ID}/pick-list`),
    );

    await expectPdf(response, "transfer-T-ABC123-pick-list.pdf");
  });

  it.each(["IN_TRANSIT", "RECEIVED", "CANCELLED"] as const)(
    "has no pick list for a transfer that is %s, and points to the transfer document",
    async (status) => {
      reads.getTransfer.mockResolvedValue(header({ status }));

      const response = await pickListLoader(
        args(`/app/transfers/${ID}/pick-list`),
      );

      expect(response.status).toBe(404);
      expect(response.headers.get("Content-Type")).toBe(
        "text/plain; charset=utf-8",
      );
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(await response.text()).toBe(
        "A pick list is printed while a transfer is a draft. This transfer has left the draft stage; print the transfer document instead.",
      );
      expect(context.admin.graphql).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["document", documentLoader],
    ["pick-list", pickListLoader],
  ] as const)(
    "answers 404 for the %s of a transfer the shop does not have, without asking Shopify",
    async (suffix, loader) => {
      reads.getTransfer.mockResolvedValue(null);

      const missing = await loader(args(`/app/transfers/${ID}/${suffix}`));
      const blank = await loader(
        args(`/app/transfers/%20/${suffix}`, { id: " " }),
      );
      const absent = await loader(args(`/app/transfers//${suffix}`, {}));

      for (const response of [missing, blank, absent]) {
        expect(response.status).toBe(404);
        expect(await response.text()).toBe("Transfer not found");
        expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      }
      // A blank or missing ID never reaches the database.
      expect(reads.getTransfer).toHaveBeenCalledTimes(1);
      expect(context.admin.graphql).not.toHaveBeenCalled();
    },
  );

  it("answers the part asked for, named with its number", async () => {
    reads.getTransfer.mockResolvedValue(header(SHIPPED));
    reads.listTransferLinesForExport.mockResolvedValue(manyLines(260));

    await expectPdf(
      await documentLoader(args(`/app/transfers/${ID}/document?part=2`)),
      "transfer-T-ABC123-part-2-of-2.pdf",
    );
    // Without a part named, the first.
    await expectPdf(
      await documentLoader(args(`/app/transfers/${ID}/document`)),
      "transfer-T-ABC123-part-1-of-2.pdf",
    );

    reads.getTransfer.mockResolvedValue(header());
    await expectPdf(
      await pickListLoader(args(`/app/transfers/${ID}/pick-list?part=2`)),
      "transfer-T-ABC123-pick-list-part-2-of-2.pdf",
    );
  });

  it.each(["3", "0", "-1", "1.5", "2e0", "two", "", "00002", "99999"])(
    "has no part %j of a two-part transfer, and renders nothing for it",
    async (part) => {
      reads.listTransferLinesForExport.mockResolvedValue(manyLines(260));

      const response = await documentLoader(
        args(`/app/transfers/${ID}/document?part=${encodeURIComponent(part)}`),
      );

      expect(response.status).toBe(404);
      expect(await response.text()).toBe(
        "This transfer prints in 2 parts. Ask for a part from 1 to 2.",
      );
      expect(context.admin.graphql).not.toHaveBeenCalled();
    },
  );

  it("has no second part of a transfer that fits one document", async () => {
    const response = await pickListLoader(
      args(`/app/transfers/${ID}/pick-list?part=2`),
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe(
      "This transfer prints as one document, without parts.",
    );
    await expectPdf(
      await pickListLoader(args(`/app/transfers/${ID}/pick-list?part=1`)),
      "transfer-T-ABC123-pick-list.pdf",
    );
  });

  it("still prints when Shopify does not answer with the shop's name and time zone", async () => {
    context.admin.graphql.mockRejectedValue(new Error("socket hang up"));

    await expectPdf(
      await documentLoader(args(`/app/transfers/${ID}/document`)),
      "transfer-T-ABC123.pdf",
    );

    shopAnswers(null);
    await expectPdf(
      await pickListLoader(args(`/app/transfers/${ID}/pick-list`)),
      "transfer-T-ABC123-pick-list.pdf",
    );
  });

  it("passes on a sign-in bounce raised while asking Shopify", async () => {
    const bounce = new Response(null, { status: 401 });
    context.admin.graphql.mockRejectedValue(bounce);

    await expect(
      documentLoader(args(`/app/transfers/${ID}/document`)),
    ).rejects.toBe(bounce);
  });

  it("counts each paper asked for against the signed-in shop", async () => {
    reads.getTransfer.mockResolvedValue(header(SHIPPED));
    const asked = args(`/app/transfers/${ID}/document`);

    await documentLoader(asked);

    expect(limiter.refusePaperOverLimit).toHaveBeenCalledTimes(1);
    expect(limiter.refusePaperOverLimit).toHaveBeenCalledWith(
      tenant,
      asked.request,
    );
  });

  it("answers a shop that asks too often before anything is read", async () => {
    const refusal = new Response("Try again later", { status: 429 });
    limiter.refusePaperOverLimit.mockResolvedValue(refusal);

    expect(await documentLoader(args(`/app/transfers/${ID}/document`))).toBe(
      refusal,
    );
    expect(await pickListLoader(args(`/app/transfers/${ID}/pick-list`))).toBe(
      refusal,
    );

    expect(reads.getTransfer).not.toHaveBeenCalled();
    expect(context.db.shopifyLocationFact.findMany).not.toHaveBeenCalled();
    expect(context.admin.graphql).not.toHaveBeenCalled();
  });
});
