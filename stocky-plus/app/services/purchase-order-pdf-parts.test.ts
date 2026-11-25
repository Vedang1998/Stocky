/**
 * Long purchase orders print in parts: what each part of the supplier PDF and
 * the receiving sheet says, how the two PDF routes answer `?part=`, and the
 * part arithmetic they share with the transfer papers. What a one-part order
 * prints is covered against PostgreSQL in
 * app/tenant/__tests__/db-isolation/purchasing-screens.test.ts.
 */
import { isValidElement } from "react";
import * as reactPdf from "@react-pdf/renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoaderFunctionArgs } from "react-router";
import {
  PDF_LINES_PER_PART,
  isLastPart,
  partFileSuffix,
  partLabel,
  partQuery,
  partRange,
  partTitle,
  pdfPart,
  pdfPartCount,
  readPdfPart,
} from "../lib/pdf/parts";
import type {
  PurchaseOrderLineView,
  PurchaseOrderView,
} from "./purchasing/purchase-order-view.server";

const ID = "po-1";

const { view, profile, context } = vi.hoisted(() => ({
  view: { getPurchaseOrderView: vi.fn() },
  profile: { readShopProfile: vi.fn() },
  context: { db: { tenant: "shop-a" }, admin: { graphql: vi.fn() } },
}));

vi.mock("./purchasing/purchase-order-view.server", async () => {
  const actual = await vi.importActual<
    typeof import("./purchasing/purchase-order-view.server")
  >("./purchasing/purchase-order-view.server");
  return { ...actual, ...view };
});

vi.mock("./purchasing/shop-profile.server", () => profile);

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

import { loader as supplierLoader } from "../routes/app.purchase-orders_.$id_.pdf";
import { loader as receivingLoader } from "../routes/app.purchase-orders_.$id_.receiver";
import {
  purchaseOrderDocument,
  purchaseOrderFilename,
  purchaseOrderPdfParts,
  receivingSheetDocument,
  supplierEmailHref,
} from "./purchasing/documents.server";
import { PurchasingError } from "./purchasing/errors";

const line = (
  extra: Partial<PurchaseOrderLineView> = {},
): PurchaseOrderLineView => ({
  id: "line-1",
  variantGid: "gid://shopify/ProductVariant/1",
  name: "Widget - Blue",
  sku: "W-BLUE",
  vendorSku: null,
  barcode: "0123456789012",
  packSize: null,
  orderUnit: null,
  orderedQty: 10,
  receivedQty: 0,
  cancelledQty: 0,
  remainingQty: 10,
  unitCost: "2.5000",
  unitCostInput: "2.5",
  manualCost: false,
  missingCost: false,
  discountPercentInput: "",
  taxRatePercentInput: "",
  note: null,
  netAmount: "25.00",
  taxAmount: "0.00",
  landedUnitCost: "2.5000",
  marginPercent: null,
  retailPrice: "5.00",
  ...extra,
});

/** `count` lines named Widget 1, Widget 2, … */
const manyLines = (count: number): PurchaseOrderLineView[] =>
  Array.from({ length: count }, (_, index) =>
    line({ id: `line-${index + 1}`, name: `Widget ${index + 1}` }),
  );

const order = (
  lines: PurchaseOrderLineView[],
  extra: Partial<PurchaseOrderView> = {},
): PurchaseOrderView => ({
  id: ID,
  poNumber: "PO-1001",
  status: "ORDERED",
  archived: false,
  version: 2,
  sentVersion: null,
  sentAt: null,
  supplier: {
    id: "supplier-1",
    name: "Acme Supply",
    archived: false,
    contactEmail: "orders@acme.example",
  },
  locationGid: "gid://shopify/Location/1",
  location: null,
  locationOptions: [],
  currency: "USD",
  exchangeRateInput: "",
  overdue: false,
  header: {
    supplierOrderNumber: null,
    invoiceNumber: null,
    issuedOn: null,
    expectedOn: null,
    shipOn: null,
    cancelOn: null,
    invoiceOn: null,
    paymentDueOn: null,
    paymentTerms: null,
    shippingTerms: null,
    shipToAddress: null,
    billToAddress: null,
    buyerName: null,
    notes: null,
    supplierNotes: "Deliver to the back door.",
  },
  lines,
  charges: [
    { kind: "SHIPPING", description: null, amount: "10.05", allocate: true },
  ],
  landedCostMethod: "COST",
  totals: {
    units: lines.length * 10,
    receivedUnits: 0,
    remainingUnits: lines.length * 10,
    merchandiseAmount: "15000.00",
    lineDiscountAmount: "0.00",
    taxAmount: "0.00",
    chargesAmount: "10.05",
    totalAmount: "15010.05",
    totalInShopCurrency: null,
    allocationApplied: null,
    unallocatedAmount: "0.00",
  },
  permissions: {
    editHeader: false,
    editTerms: false,
    editLines: false,
    actions: [],
    receivingDenial: null,
  },
  ...extra,
});

/** Every piece of text in a document, in reading order. */
function documentText(node: unknown): string[] {
  if (typeof node === "string" || typeof node === "number") {
    return [String(node)];
  }
  if (Array.isArray(node)) return node.flatMap(documentText);
  if (isValidElement(node)) {
    return documentText((node.props as { children?: unknown }).children);
  }
  return [];
}

const supplierText = (subject: PurchaseOrderView, part?: number) =>
  documentText(purchaseOrderDocument(reactPdf, subject, "Cellar & Co", part));

const sheetText = (subject: PurchaseOrderView, part?: number) =>
  documentText(receivingSheetDocument(reactPdf, subject, "USD", part));

const names = (text: string[]) =>
  text.filter((piece) => /^Widget \d+$/.test(piece));

const args = (path: string, params: Record<string, string> = { id: ID }) =>
  ({
    request: new Request(`https://app.example${path}`),
    params,
    context: {},
  }) as unknown as LoaderFunctionArgs;

beforeEach(() => {
  vi.clearAllMocks();
  limiter.refusePaperOverLimit.mockReset();
  limiter.refusePaperOverLimit.mockResolvedValue(null);
  profile.readShopProfile.mockResolvedValue({
    name: "Cellar & Co",
    currencyCode: "USD",
    ianaTimezone: "America/Toronto",
    today: "2026-11-19",
  });
  view.getPurchaseOrderView.mockResolvedValue(order([line()]));
});

describe("Document parts", () => {
  it("puts 250 rows on a part, and always has one part", () => {
    expect(PDF_LINES_PER_PART).toBe(250);
    expect([0, 1, 250, 251, 500, 501, 1000].map(pdfPartCount)).toEqual([
      1, 1, 1, 2, 2, 3, 4,
    ]);
  });

  it("cuts the rows of each part without losing or repeating one", () => {
    const rows = Array.from({ length: 501 }, (_, index) => index + 1);

    const parts = [1, 2, 3].map((part) => pdfPart(rows, part));

    expect(parts.map((shown) => [shown.first, shown.lines.length])).toEqual([
      [1, 250],
      [251, 250],
      [501, 1],
    ]);
    expect(parts.flatMap((shown) => shown.lines)).toEqual(rows);
    expect(parts.map(isLastPart)).toEqual([false, false, true]);
    expect(pdfPart(rows, 4).lines).toEqual([]);
    expect(pdfPart([], 1)).toMatchObject({ parts: 1, lines: [], total: 0 });
  });

  it("reads the part from the address, and nothing but a whole number from 1", () => {
    expect(readPdfPart(null)).toBe(1);
    expect(readPdfPart("1")).toBe(1);
    expect(readPdfPart("12")).toBe(12);
    for (const value of [
      "",
      "0",
      "-1",
      "1.5",
      "2 ",
      " 2",
      "two",
      "1e2",
      "02",
      "12345",
    ]) {
      expect(readPdfPart(value), JSON.stringify(value)).toBeNull();
    }
  });

  it("names a part only when there is more than one", () => {
    const one = pdfPart(["a"], 1);
    const second = pdfPart(
      Array.from({ length: 1_200 }, () => "a"),
      5,
    );

    expect(partTitle("Receiving sheet PO-1", one)).toBe("Receiving sheet PO-1");
    expect(partRange(one)).toBeNull();
    expect(partQuery(1, 1)).toBe("");
    expect(partLabel(1, 1)).toBe("");
    expect(partFileSuffix(1, 1)).toBe("");

    expect(partTitle("Receiving sheet PO-1", second)).toBe(
      "Receiving sheet PO-1 · Part 5 of 5",
    );
    expect(partRange(second)).toBe("Items 1,001 to 1,200 of 1,200");
    expect(partRange(second, "Lines")).toBe("Lines 1,001 to 1,200 of 1,200");
    expect(partQuery(2, 5)).toBe("?part=2");
    expect(partLabel(2, 5)).toBe(", part 2 of 5");
    expect(partFileSuffix(2, 5)).toBe("-part-2-of-5");
  });
});

describe("Purchase order PDF in parts", () => {
  it("prints an order of up to 250 lines as one document, as before", () => {
    const text = supplierText(order(manyLines(250)));

    expect(text).toContain("Purchase order PO-1001");
    expect(text.join("\n")).not.toMatch(/Part \d|Lines \d|next part/);
    expect(names(text)).toHaveLength(250);
    expect(text).toEqual(
      expect.arrayContaining([
        "Total (USD)",
        "$15,010.05",
        "Shipping",
        "Notes",
        "Deliver to the back door.",
      ]),
    );
  });

  it("prints 250 lines to a part and says where the totals are", () => {
    const subject = order(manyLines(600));

    const first = supplierText(subject, 1);
    const second = supplierText(subject, 2);

    expect(purchaseOrderPdfParts(subject)).toBe(3);
    expect(first).toContain("Purchase order PO-1001 · Part 1 of 3");
    expect(first.join("\n")).toContain("Lines 1 to 250 of 600");
    expect(names(first)).toHaveLength(250);
    expect(names(first)[0]).toBe("Widget 1");
    expect(names(first).at(-1)).toBe("Widget 250");
    expect(first).toContain(
      "The order continues on the next part. Its totals are on part 3.",
    );
    // The supplier and the delivery address are on every part.
    for (const text of [first, second]) {
      expect(text).toEqual(
        expect.arrayContaining(["Acme Supply", "Cellar & Co", "Product"]),
      );
      expect(text).not.toContain("Total (USD)");
      expect(text).not.toContain("Shipping");
      expect(text).not.toContain("Deliver to the back door.");
    }
    expect(second.join("\n")).toContain("Lines 251 to 500 of 600");
    expect(names(second)[0]).toBe("Widget 251");
  });

  it("prints the totals, charges and notes once, on the last part", () => {
    const text = supplierText(order(manyLines(600)), 3);

    expect(text).toContain("Purchase order PO-1001 · Part 3 of 3");
    expect(text.join("\n")).toContain("Lines 501 to 600 of 600");
    expect(names(text)).toHaveLength(100);
    expect(names(text).at(-1)).toBe("Widget 600");
    expect(text).toEqual(
      expect.arrayContaining([
        "Subtotal (6000 units)",
        "Shipping",
        "$10.05",
        "Total (USD)",
        "$15,010.05",
        "Deliver to the back door.",
      ]),
    );
    expect(text.join("\n")).not.toContain("next part");
  });

  it("counts only the lines it prints: a fully cancelled line takes no room", () => {
    const lines = [
      ...manyLines(250),
      line({ id: "gone", name: "Widget 9999", cancelledQty: 10 }),
    ];
    const subject = order(lines);

    expect(purchaseOrderPdfParts(subject)).toBe(1);
    expect(names(supplierText(subject))).not.toContain("Widget 9999");
    expect(purchaseOrderPdfParts(order(manyLines(251)))).toBe(2);
  });

  it("splits the receiving sheet the same way, still without costs", () => {
    const subject = order(manyLines(300));

    const first = sheetText(subject, 1);
    const second = sheetText(subject, 2);

    expect(first).toContain("Receiving sheet PO-1001 · Part 1 of 2");
    expect(first.join("\n")).toContain("Lines 1 to 250 of 300");
    expect(names(first)).toHaveLength(250);
    expect(second).toContain("Receiving sheet PO-1001 · Part 2 of 2");
    expect(second.join("\n")).toContain("Lines 251 to 300 of 300");
    expect(names(second)).toHaveLength(50);
    // Units still expected are for the whole order on every part.
    for (const text of [first, second]) {
      expect(text.join("\n")).toContain("3000 of 3000 units still expected");
      expect(text.join("\n")).not.toMatch(/\$2\.50|\$25\.00|15,010/);
    }
    expect(sheetText(order(manyLines(3))).join("\n")).not.toMatch(
      /Part \d|Lines \d/,
    );
  });

  it("names a part's file after the part", () => {
    const po = { poNumber: "PO-1001", version: 2 };

    expect(purchaseOrderFilename(po, "", "pdf")).toBe("PO-1001-v2.pdf");
    expect(purchaseOrderFilename(po, "", "pdf", { part: 1, parts: 1 })).toBe(
      "PO-1001-v2.pdf",
    );
    expect(
      purchaseOrderFilename(po, "-receiving", "pdf", { part: 2, parts: 3 }),
    ).toBe("PO-1001-receiving-v2-part-2-of-3.pdf");
    expect(purchaseOrderFilename(po, "-lines", "csv")).toBe(
      "PO-1001-lines-v2.csv",
    );
  });

  it("tells the supplier in the email draft how many parts are attached", () => {
    const body = (subject: PurchaseOrderView) =>
      new URL(supplierEmailHref(subject, "Cellar & Co")!).searchParams.get(
        "body",
      )!;

    expect(body(order(manyLines(3)))).toContain(
      "Please find our purchase order PO-1001 (version 2) attached.\n",
    );
    expect(body(order(manyLines(600)))).toContain(
      "Please find our purchase order PO-1001 (version 2) attached in 3 parts.\n",
    );
    expect(body(order(manyLines(600))).length).toBeLessThanOrEqual(1_800);
  });
});

describe("Purchase order PDF routes", () => {
  const ROUTES = [
    ["supplier PDF", supplierLoader, "pdf", "PO-1001-v2"],
    ["receiving sheet", receivingLoader, "receiver", "PO-1001-receiving-v2"],
  ] as const;

  async function expectPdf(response: Response, filename: string) {
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      `inline; filename="${filename}"`,
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  }

  async function expectNoSuchPart(response: Response, sentence: string) {
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.text()).toBe(sentence);
  }

  it.each(ROUTES)(
    "answers the %s of a short order as one PDF, with or without part 1 in the address",
    async (_name, loader, path, filename) => {
      await expectPdf(
        await loader(args(`/app/purchase-orders/${ID}/${path}`)),
        `${filename}.pdf`,
      );
      await expectPdf(
        await loader(args(`/app/purchase-orders/${ID}/${path}?part=1`)),
        `${filename}.pdf`,
      );
      // The order is read through the signed-in shop's database handle.
      expect(view.getPurchaseOrderView).toHaveBeenCalledWith(
        context.db,
        ID,
        expect.objectContaining({ today: "2026-11-19", shopCurrency: "USD" }),
      );
    },
  );

  it.each(ROUTES)(
    "answers the part asked for of a long %s, named with its number",
    async (_name, loader, path, filename) => {
      view.getPurchaseOrderView.mockResolvedValue(order(manyLines(251)));

      await expectPdf(
        await loader(args(`/app/purchase-orders/${ID}/${path}?part=2`)),
        `${filename}-part-2-of-2.pdf`,
      );
    },
  );

  it("answers part 1 of a long order when the address names no part", async () => {
    view.getPurchaseOrderView.mockResolvedValue(order(manyLines(251)));

    await expectPdf(
      await supplierLoader(args(`/app/purchase-orders/${ID}/pdf`)),
      "PO-1001-v2-part-1-of-2.pdf",
    );
  }, 20_000);

  it.each(ROUTES)(
    "refuses a part the %s does not have, and says how many there are",
    async (_name, loader, path) => {
      const ask = (query: string) =>
        loader(args(`/app/purchase-orders/${ID}/${path}${query}`));

      for (const query of [
        "?part=2",
        "?part=0",
        "?part=x",
        "?part=",
        "?part=1.5",
      ]) {
        await expectNoSuchPart(
          await ask(query),
          "This purchase order prints as one document, without parts.",
        );
      }

      view.getPurchaseOrderView.mockResolvedValue(order(manyLines(600)));
      for (const query of ["?part=4", "?part=0", "?part=-1", "?part=9999"]) {
        await expectNoSuchPart(
          await ask(query),
          "This purchase order prints in 3 parts. Ask for a part from 1 to 3.",
        );
      }
    },
  );

  it.each(ROUTES)(
    "still answers 404 for a %s this shop does not have",
    async (_name, loader, path) => {
      view.getPurchaseOrderView.mockRejectedValue(
        new PurchasingError("not_found", "Purchase order not found"),
      );

      const thrown = await loader(
        args(`/app/purchase-orders/${ID}/${path}?part=2`),
      ).then(
        () => null,
        (error: unknown) => error,
      );

      expect(thrown).toBeInstanceOf(Response);
      expect((thrown as Response).status).toBe(404);
    },
  );

  it("does not hide a failure to read the order", async () => {
    view.getPurchaseOrderView.mockRejectedValue(new Error("connection lost"));

    await expect(
      supplierLoader(args(`/app/purchase-orders/${ID}/pdf`)),
    ).rejects.toThrow("connection lost");
  });

  it("counts each PDF asked for against the signed-in shop", async () => {
    view.getPurchaseOrderView.mockResolvedValue(order([line()]));
    const asked = args(`/app/purchase-orders/${ID}/pdf`);

    await supplierLoader(asked);

    expect(limiter.refusePaperOverLimit).toHaveBeenCalledTimes(1);
    expect(limiter.refusePaperOverLimit).toHaveBeenCalledWith(
      tenant,
      asked.request,
    );
  });

  it("answers a shop that asks too often before anything is read", async () => {
    const refusal = new Response("Try again later", { status: 429 });
    limiter.refusePaperOverLimit.mockResolvedValue(refusal);

    expect(await supplierLoader(args(`/app/purchase-orders/${ID}/pdf`))).toBe(
      refusal,
    );
    expect(
      await receivingLoader(args(`/app/purchase-orders/${ID}/receiver`)),
    ).toBe(refusal);

    expect(profile.readShopProfile).not.toHaveBeenCalled();
    expect(view.getPurchaseOrderView).not.toHaveBeenCalled();
  });
});
