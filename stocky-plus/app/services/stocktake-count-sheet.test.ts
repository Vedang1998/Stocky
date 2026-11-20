/**
 * The printed count sheet: what it says while a count is open, once it is
 * closed, and for a blind count; how a long count splits into parts; and what
 * the PDF route answers. The read model behind it is covered against
 * PostgreSQL in scripts/tenant-enforcement/tests/stocktake-workflow.test.ts.
 */
import { isValidElement } from "react";
import * as reactPdf from "@react-pdf/renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoaderFunctionArgs } from "react-router";
import type {
  StocktakeHeader,
  StocktakeLineView,
  StocktakeProgress,
} from "./stocktakes/stocktake-read.server";
import type {
  CountSheet,
  CountSheetSetting,
} from "./stocktakes/stocktake-count-sheet.server";
import type { DifferenceValue } from "./stocktakes/stocktake-value";

const CELLAR = "gid://shopify/Location/11";
const ID = "st-1";

const { reads, listSyncedLocations, context } = vi.hoisted(() => ({
  reads: {
    getStocktake: vi.fn(),
    getStocktakeLineRange: vi.fn(),
    getStocktakeProgress: vi.fn(),
  },
  listSyncedLocations: vi.fn(),
  context: { db: { tenant: "shop-a" }, admin: { graphql: vi.fn() } },
}));

vi.mock("./stocktakes/stocktake-read.server", async () => {
  const actual = await vi.importActual<
    typeof import("./stocktakes/stocktake-read.server")
  >("./stocktakes/stocktake-read.server");
  return { ...actual, ...reads };
});

vi.mock("./inventory-writes/locations.server", () => ({ listSyncedLocations }));

const values = vi.hoisted(() => ({ getStocktakeDifferenceValue: vi.fn() }));
vi.mock("./stocktakes/stocktake-value.server", () => values);

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

import { loader } from "../routes/app.stocktakes_.$id_.count-sheet";
import {
  countSheetDocument,
  countSheetFilename,
  readCountSheet,
} from "./stocktakes/stocktake-count-sheet.server";

const header = (extra: Partial<StocktakeHeader> = {}): StocktakeHeader => ({
  id: ID,
  name: "Cellar count",
  locationId: CELLAR,
  status: "IN_PROGRESS",
  scope: "FULL",
  quantityBasis: "ON_HAND",
  expectedSource: "LIVE",
  blind: false,
  createdAt: new Date("2026-11-12T08:55:00.000Z"),
  startedAt: new Date("2026-11-12T09:00:00.000Z"),
  startedByUserId: "42",
  completedAt: null,
  completedByUserId: null,
  cancelledAt: null,
  cancelledByUserId: null,
  ...extra,
});

const COMPLETED = {
  status: "COMPLETED",
  completedAt: new Date("2026-11-12T11:15:00.000Z"),
  completedByUserId: "77",
} as const;

const line = (extra: Partial<StocktakeLineView> = {}): StocktakeLineView => ({
  id: "line-red",
  shopifyVariantId: "gid://shopify/ProductVariant/1",
  title: "Red wine",
  sku: "RED-750",
  barcode: "0123456789012",
  expectedQty: 10,
  countedQty: null,
  delta: null,
  countSource: null,
  countedAt: null,
  countedByUserId: null,
  movementDetectedQty: null,
  movementBaselineQty: null,
  movementReviewedAt: null,
  ...extra,
});

const WHITE = {
  id: "line-white",
  shopifyVariantId: "gid://shopify/ProductVariant/2",
  title: "White wine",
  sku: "WHT-750",
  barcode: null,
} as const;

const counted = (
  countedQty: number,
  extra: Partial<StocktakeLineView> = {},
): Partial<StocktakeLineView> => ({
  countedQty,
  delta: countedQty - (extra.movementBaselineQty ?? extra.expectedQty ?? 10),
  countSource: "MANUAL",
  countedAt: new Date("2026-11-12T09:30:00.000Z"),
  countedByUserId: "77",
  ...extra,
});

const progress = (
  extra: Partial<StocktakeProgress> = {},
): StocktakeProgress => ({
  lineCount: 2,
  countedCount: 0,
  uncountedCount: 2,
  zeroFilledCount: 0,
  differenceCount: 0,
  unitsOver: 0,
  unitsShort: 0,
  movementReviewCount: 0,
  ...extra,
});

/** A sheet whose one part holds all of `lines`, unless `shown` says otherwise. */
function sheet(
  stocktake: StocktakeHeader,
  lines: StocktakeLineView[],
  extra: Partial<Omit<CountSheet, "shown">> & {
    shown?: Partial<CountSheet["shown"]>;
  } = {},
): CountSheet {
  const { shown, ...rest } = extra;
  return {
    stocktake,
    locationName: "Cellar",
    value: null,
    progress: progress({
      lineCount: shown?.total ?? lines.length,
      countedCount: lines.filter((each) => each.countedQty !== null).length,
    }),
    ...rest,
    shown: {
      part: 1,
      parts: 1,
      lines,
      first: 1,
      total: lines.length,
      ...shown,
    },
  };
}

const TORONTO = {
  shopName: "Cellar & Co",
  timeZone: "America/Toronto",
  printedAt: new Date("2026-11-12T10:00:00.000Z"),
};

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

const sheetText = (
  subject: CountSheet,
  setting: Partial<CountSheetSetting> = {},
) =>
  documentText(
    countSheetDocument(reactPdf, subject, { ...TORONTO, ...setting }),
  );

/** `count` lines named Item 1, Item 2, … */
const manyLines = (count: number, from = 1): StocktakeLineView[] =>
  Array.from({ length: count }, (_, index) =>
    line({
      id: `line-${String(from + index).padStart(5, "0")}`,
      title: `Item ${from + index}`,
      sku: `S-${from + index}`,
      barcode: null,
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

function shopAnswers(shop: Record<string, unknown> | null) {
  context.admin.graphql.mockResolvedValue({
    json: async () => ({ data: { shop } }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  values.getStocktakeDifferenceValue.mockResolvedValue(null);
  limiter.refusePaperOverLimit.mockReset();
  limiter.refusePaperOverLimit.mockResolvedValue(null);
  reads.getStocktake.mockResolvedValue(header());
  reads.getStocktakeLineRange.mockResolvedValue({
    lines: [line(), line(WHITE)],
    total: 2,
  });
  reads.getStocktakeProgress.mockResolvedValue(progress());
  listSyncedLocations.mockResolvedValue([
    { id: CELLAR, name: "Cellar", isActive: true },
  ]);
  shopAnswers({
    name: "Cellar & Co",
    currencyCode: "CAD",
    ianaTimezone: "America/Toronto",
  });
});

describe("Count sheet of an open count", () => {
  it("is the paper to count from: every item with what is expected and a box for what is found", () => {
    const text = sheetText(sheet(header(), [line(), line(WHITE)]));

    expect(text).toEqual([
      "Count sheet: Cellar count",
      "Cellar & Co · In progress · Full count · 2 items, 0 counted so far",
      "Location",
      "Cellar",
      "What is counted",
      "Units on the shelf, including units already committed to orders (on hand).",
      "Dates",
      "Started Nov 12, 2026, 4:00 AM EST by staff ID 42",
      "Printed Nov 12, 2026, 5:00 AM EST",
      "Write the units you find in the box. Write 0 for an item with none on the shelf. Leave the box empty for an item you did not count.",
      "Item",
      "Barcode / SKU",
      "Expected",
      "Counted",
      "Red wine",
      "0123456789012",
      "SKU RED-750",
      "10",
      "White wine",
      "WHT-750",
      "10",
      "Counted by",
      "Name and signature",
      "Date",
      "Checked by",
      "Name and signature",
      "Date",
    ]);
  });

  it("says what is already entered for an item, zero included", () => {
    const text = sheetText(
      sheet(header(), [
        line(counted(12)),
        line({ ...WHITE, ...counted(0) }),
        line({ id: "line-rose", title: "Rosé" }),
      ]),
    );

    expect(text[1]).toContain("3 items, 2 counted so far");
    expect(text).toContain("Already entered: 12");
    expect(text).toContain("Already entered: 0");
    expect(text.filter((each) => each.startsWith("Already entered"))).toEqual([
      "Already entered: 12",
      "Already entered: 0",
    ]);
  });

  it("leaves expected quantities, and everything that gives them away, off a blind count", () => {
    const text = sheetText(
      sheet(
        header({ blind: true }),
        [line({ expectedQty: 73, ...counted(70, { expectedQty: 73 }) })],
        {
          progress: progress({
            lineCount: 1,
            countedCount: 1,
            differenceCount: 1,
            unitsShort: 3,
          }),
        },
      ),
    );

    expect(text).toContain(
      "Cellar & Co · In progress · Full count, blind · 1 item, 1 counted so far",
    );
    expect(text).not.toContain("Expected");
    expect(text).not.toContain("73");
    expect(text).not.toContain("Difference");
    expect(text.join(" ")).not.toMatch(/difference|short|over|-3/i);
    // The count the staff member entered is theirs to see.
    expect(text).toContain("Already entered: 70");
  });

  it("names what is counted for a count on the earlier basis, and marks a partial count", () => {
    const text = sheetText(
      sheet(header({ scope: "PARTIAL", quantityBasis: "AVAILABLE" }), [line()]),
    );

    expect(text).toContain(
      "Cellar & Co · In progress · Partial count · 1 item, 0 counted so far",
    );
    expect(text).toContain("Units available to sell.");
  });

  it("says so when the expected quantities are synced ones, unless the count is blind", () => {
    const note =
      "Expected quantities are from the last sync, not from a read of Shopify. Each one is read from Shopify when the item's count is entered.";

    expect(sheetText(sheet(header(), [line()]))).not.toContain(note);
    expect(
      sheetText(sheet(header({ expectedSource: "SYNC" }), [line()])),
    ).toContain(note);
    expect(
      sheetText(
        sheet(header({ expectedSource: "SYNC", blind: true }), [line()]),
      ),
    ).not.toContain(note);
    // A record shows what the differences were measured from; all of it was read by then.
    expect(
      sheetText(
        sheet(header({ ...COMPLETED, expectedSource: "SYNC" }), [line()]),
      ),
    ).not.toContain(note);
  });

  it("prints a count that was never started as a sheet too, dated from when it was created", () => {
    const text = sheetText(
      sheet(header({ status: "DRAFT", startedAt: null }), [line()]),
    );

    expect(text[0]).toBe("Count sheet: Cellar count");
    expect(text).toContain("Started Nov 12, 2026, 3:55 AM EST by staff ID 42");
  });

  it("says so when the count has no items yet", () => {
    const text = sheetText(sheet(header({ scope: "PARTIAL" }), []));

    expect(text).toContain(
      "Cellar & Co · In progress · Partial count · No items yet",
    );
    expect(text).toContain("No items on this count.");
  });

  it("gives times in UTC and carries no shop name when Shopify gave neither", () => {
    const text = sheetText(sheet(header({ startedByUserId: null }), [line()]), {
      shopName: null,
      timeZone: null,
    });

    expect(text[1]).toBe("In progress · Full count · 1 item, 0 counted so far");
    expect(text).toContain(
      "Started 2026-11-12 09:00 UTC by staff not recorded",
    );
    expect(text).toContain("Printed 2026-11-12 10:00 UTC");
  });
});

describe("Count record of a closed count", () => {
  it("lists expected, counted and the difference for every item, with the totals of the count", () => {
    const text = sheetText(
      sheet(
        header(COMPLETED),
        [
          line(counted(12)),
          line({ ...WHITE, ...counted(7) }),
          line({ id: "line-rose", title: "Rosé", sku: null, barcode: null }),
        ],
        {
          progress: progress({
            lineCount: 3,
            countedCount: 2,
            uncountedCount: 1,
            differenceCount: 2,
            unitsOver: 2,
            unitsShort: 3,
          }),
        },
      ),
    );

    expect(text).toEqual([
      "Count record: Cellar count",
      "Cellar & Co · Completed · Full count · 3 items, 2 counted, 2 with a difference",
      "Location",
      "Cellar",
      "What is counted",
      "Units on the shelf, including units already committed to orders (on hand).",
      "Dates",
      "Started Nov 12, 2026, 4:00 AM EST by staff ID 42",
      "Completed Nov 12, 2026, 6:15 AM EST by staff ID 77",
      "Item",
      "Barcode / SKU",
      "Expected",
      "Counted",
      "Difference",
      "Red wine",
      "0123456789012",
      "SKU RED-750",
      "10",
      "12",
      "+2",
      "White wine",
      "WHT-750",
      "10",
      "7",
      "-3",
      "Rosé",
      "—",
      "10",
      "Not counted",
      "—",
      "Items counted",
      "2 of 3",
      "Items with a difference",
      "2",
      "Units over",
      "2",
      "Units short",
      "3",
    ]);
  });

  it("closes the totals of a completed count with what its differences were worth", () => {
    const record = (value: DifferenceValue) =>
      sheetText(
        sheet(
          header(COMPLETED),
          [line(counted(12)), line({ ...WHITE, ...counted(7) })],
          {
            progress: progress({
              countedCount: 2,
              uncountedCount: 0,
              differenceCount: 2,
              unitsOver: 2,
              unitsShort: 3,
            }),
            value,
          },
        ),
      );
    const tail = (text: string[]) => text.slice(text.indexOf("Units short"));

    expect(
      tail(
        record({
          basis: "COMPLETION",
          totals: [{ currencyCode: "USD", amount: "-4.25" }],
          costedCount: 2,
          uncostedCount: 0,
        }),
      ),
    ).toEqual([
      "Units short",
      "3",
      "Value of differences",
      "-$4.25",
      "At Shopify's unit cost when the count was completed.",
    ]);

    expect(
      tail(
        record({
          basis: "COMPLETION",
          totals: [{ currencyCode: "USD", amount: "8.5" }],
          costedCount: 1,
          uncostedCount: 1,
        }),
      ),
    ).toEqual([
      "Units short",
      "3",
      "Value of differences",
      "+$8.50",
      "At Shopify's unit cost when the count was completed. 1 item with a difference had no unit cost when the count was completed and is not in this figure.",
    ]);

    // Completed before costs were kept, or nothing on it has a cost.
    expect(
      tail(
        record({
          basis: "COMPLETION",
          totals: [],
          costedCount: 0,
          uncostedCount: 2,
        }),
      ),
    ).toEqual([
      "Units short",
      "3",
      "Value of differences",
      "Not known",
      "2 items with a difference had no unit cost when the count was completed.",
    ]);
  });

  it("prints no value for a count without differences, or without a value", () => {
    const none = sheetText(
      sheet(header(COMPLETED), [line(counted(10))], {
        value: {
          basis: "COMPLETION",
          totals: [],
          costedCount: 0,
          uncostedCount: 0,
        },
      }),
    );
    expect(none).not.toContain("Value of differences");
    expect(none[none.length - 2]).toBe("Units short");

    expect(
      sheetText(sheet(header(COMPLETED), [line(counted(12))])),
    ).not.toContain("Value of differences");
  });

  it("shows the expected quantities of a blind count once it is closed", () => {
    const text = sheetText(
      sheet(header({ ...COMPLETED, blind: true }), [
        line({ expectedQty: 73, ...counted(70, { expectedQty: 73 }) }),
      ]),
    );

    expect(text).toContain("Expected");
    expect(text).toContain("73");
    expect(text).toContain("-3");
  });

  it("explains a difference that was measured from the quantity after stock moved", () => {
    const text = sheetText(
      sheet(header(COMPLETED), [
        line(
          counted(8, {
            movementDetectedQty: 6,
            movementBaselineQty: 6,
            movementReviewedAt: new Date("2026-11-12T11:00:00.000Z"),
          }),
        ),
        // Reviewed as counted before the movement: the difference is still counted minus expected.
        line({
          ...WHITE,
          ...counted(8, {
            movementDetectedQty: 6,
            movementReviewedAt: new Date("2026-11-12T11:00:00.000Z"),
          }),
        }),
      ]),
    );

    expect(
      text.filter((each) => each.startsWith("Stock moved during the count")),
    ).toEqual(["Stock moved during the count. Difference measured from 6."]);
    expect(text).toContain("+2");
    expect(text).toContain("-2");
  });

  it("says that a cancelled count changed nothing", () => {
    const text = sheetText(
      sheet(
        header({
          status: "CANCELLED",
          cancelledAt: new Date("2026-11-12T11:15:00.000Z"),
          cancelledByUserId: null,
        }),
        [line(counted(12))],
      ),
    );

    expect(text[0]).toBe("Count record: Cellar count");
    expect(text).toContain(
      "Cancelled Nov 12, 2026, 6:15 AM EST by staff not recorded",
    );
    expect(text.at(-1)).toBe(
      "This count was cancelled. Nothing was changed in Shopify.",
    );
    expect(text.join(" ")).not.toContain("Completed Nov");
  });

  it("does not say when it was printed: the record does not change", () => {
    expect(
      sheetText(sheet(header(COMPLETED), [line(counted(10))])).join(" "),
    ).not.toContain("Printed");
  });
});

describe("A count too long for one document", () => {
  it("heads each part with its number and the items it holds", () => {
    const text = sheetText(
      sheet(header(), manyLines(250, 251), {
        shown: { part: 2, parts: 3, first: 251, total: 620 },
      }),
    );

    expect(text[0]).toBe("Count sheet: Cellar count · Part 2 of 3");
    expect(text[1]).toBe(
      "Cellar & Co · In progress · Full count · 620 items, 0 counted so far · Items 251 to 500 of 620",
    );
    expect(text).toContain("Item 251");
    expect(text).toContain("Item 500");
    expect(text).not.toContain("Item 250");
    expect(text).not.toContain("Item 501");
  });

  it("keeps the signatures for the last part", () => {
    const part = (number: number, lines: StocktakeLineView[]) =>
      sheetText(
        sheet(header(), lines, {
          shown: {
            part: number,
            parts: 2,
            first: (number - 1) * 250 + 1,
            total: 260,
          },
        }),
      );

    expect(part(1, manyLines(250))).not.toContain("Counted by");
    expect(part(2, manyLines(10, 251))).toContain("Counted by");
  });

  it("closes the last part of a record with the totals of the whole count", () => {
    const record = (number: number, lines: StocktakeLineView[]) =>
      sheetText(
        sheet(header(COMPLETED), lines, {
          progress: progress({
            lineCount: 260,
            countedCount: 258,
            differenceCount: 4,
          }),
          shown: {
            part: number,
            parts: 2,
            first: (number - 1) * 250 + 1,
            total: 260,
          },
        }),
      );

    expect(record(1, manyLines(250))).not.toContain("258 of 260");
    const last = record(2, manyLines(10, 251));
    expect(last).toContain("Items counted, all parts");
    expect(last).toContain("258 of 260");
  });
});

describe("What the count sheet reads", () => {
  it("reads only the lines of the part asked for, through the shop's database handle", async () => {
    reads.getStocktakeLineRange.mockResolvedValue({
      lines: manyLines(120, 501),
      total: 620,
    });
    reads.getStocktakeProgress.mockResolvedValue(
      progress({ lineCount: 620, countedCount: 5 }),
    );

    const read = await readCountSheet(context.db as never, ID, 3);

    expect(reads.getStocktake).toHaveBeenCalledWith(context.db, ID);
    expect(reads.getStocktakeLineRange).toHaveBeenCalledWith(context.db, {
      stocktakeId: ID,
      skip: 500,
      take: 250,
    });
    expect(reads.getStocktakeProgress).toHaveBeenCalledWith(context.db, ID);
    expect(listSyncedLocations).toHaveBeenCalledWith(context.db);
    expect(read).toMatchObject({
      locationName: "Cellar",
      progress: { lineCount: 620, countedCount: 5 },
      shown: { part: 3, parts: 3, first: 501, total: 620 },
    });
    expect(read?.shown.lines).toHaveLength(120);
  });

  it("is nothing for a count the shop does not have, and reads no lines for it", async () => {
    reads.getStocktake.mockResolvedValue(null);

    expect(await readCountSheet(context.db as never, ID, 1)).toBeNull();
    expect(reads.getStocktakeLineRange).not.toHaveBeenCalled();
    expect(reads.getStocktakeProgress).not.toHaveBeenCalled();
  });

  it("keeps the name of a location that was deactivated, and says so when it is gone", async () => {
    listSyncedLocations.mockResolvedValue([
      { id: CELLAR, name: "Cellar", isActive: false },
    ]);
    expect(
      (await readCountSheet(context.db as never, ID, 1))?.locationName,
    ).toBe("Cellar");

    listSyncedLocations.mockResolvedValue([]);
    expect(
      (await readCountSheet(context.db as never, ID, 1))?.locationName,
    ).toBe("Location no longer in Shopify");
  });

  it("reads what the differences were worth for a completed count only", async () => {
    const worth: DifferenceValue = {
      basis: "COMPLETION",
      totals: [{ currencyCode: "USD", amount: "-12.75" }],
      costedCount: 1,
      uncostedCount: 0,
    };
    values.getStocktakeDifferenceValue.mockResolvedValue(worth);

    // An open sheet is for counting; a value would give the differences away.
    expect(
      (await readCountSheet(context.db as never, ID, 1))?.value,
    ).toBeNull();
    reads.getStocktake.mockResolvedValue(header({ status: "CANCELLED" }));
    expect(
      (await readCountSheet(context.db as never, ID, 1))?.value,
    ).toBeNull();
    expect(values.getStocktakeDifferenceValue).not.toHaveBeenCalled();

    const completed = header(COMPLETED);
    reads.getStocktake.mockResolvedValue(completed);
    expect((await readCountSheet(context.db as never, ID, 1))?.value).toEqual(
      worth,
    );
    expect(values.getStocktakeDifferenceValue).toHaveBeenCalledWith(
      context.db,
      completed,
    );
  });

  it("has one part, with no lines, for a count without items", async () => {
    reads.getStocktakeLineRange.mockResolvedValue({ lines: [], total: 0 });

    expect((await readCountSheet(context.db as never, ID, 1))?.shown).toEqual({
      part: 1,
      parts: 1,
      lines: [],
      first: 1,
      total: 0,
    });
  });
});

describe("Count sheet file name", () => {
  const shown = { part: 1, parts: 1, lines: [], first: 1, total: 0 };

  it("names the paper, the count and the day it started on the shop's clock", () => {
    const late = header({ startedAt: new Date("2026-11-13T02:30:00.000Z") });

    expect(
      countSheetFilename({ stocktake: late, shown }, "America/Toronto"),
    ).toBe("count-sheet-Cellar-count-2026-11-12.pdf");
    expect(countSheetFilename({ stocktake: late, shown }, null)).toBe(
      "count-sheet-Cellar-count-2026-11-13.pdf",
    );
    expect(
      countSheetFilename(
        { stocktake: header(COMPLETED), shown },
        "America/Toronto",
      ),
    ).toBe("count-record-Cellar-count-2026-11-12.pdf");
  });

  it("carries the part of a count in parts, and no more than 60 characters of a long name", () => {
    const name = countSheetFilename(
      {
        stocktake: header({ name: "x".repeat(200) }),
        shown: { ...shown, part: 2, parts: 3 },
      },
      "America/Toronto",
    );

    expect(name).toBe(
      `count-sheet-${"x".repeat(60)}-2026-11-12-part-2-of-3.pdf`,
    );
  });

  it("keeps the letters and digits of a name, without accents, and leaves out a name that has none", () => {
    const named = (name: string) =>
      countSheetFilename({ stocktake: header({ name }), shown }, null);

    expect(named("  Été 2026 / cave n°2  ")).toBe(
      "count-sheet-Ete-2026-cave-n-2-2026-11-12.pdf",
    );
    expect(named("棚卸")).toBe("count-sheet-2026-11-12.pdf");
    expect(named("../..")).toBe("count-sheet-2026-11-12.pdf");
  });
});

describe("Count sheet route", () => {
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

  it("answers the count sheet as a PDF named after the count", async () => {
    const response = await loader(args(`/app/stocktakes/${ID}/count-sheet`));

    await expectPdf(response, "count-sheet-Cellar-count-2026-11-12.pdf");
    expect(reads.getStocktake).toHaveBeenCalledWith(context.db, ID);
    expect(reads.getStocktakeLineRange).toHaveBeenCalledWith(context.db, {
      stocktakeId: ID,
      skip: 0,
      take: 250,
    });
  });

  it("answers the record of a completed count", async () => {
    reads.getStocktake.mockResolvedValue(header(COMPLETED));
    reads.getStocktakeLineRange.mockResolvedValue({
      lines: [line(counted(12))],
      total: 1,
    });

    await expectPdf(
      await loader(args(`/app/stocktakes/${ID}/count-sheet`)),
      "count-record-Cellar-count-2026-11-12.pdf",
    );
  });

  it("keeps a name the merchant typed from breaking out of the file name", async () => {
    reads.getStocktake.mockResolvedValue(
      header({ name: '../etc/"passwd"\r\nX-Evil: 1' }),
    );

    const response = await loader(args(`/app/stocktakes/${ID}/count-sheet`));

    expect(response.headers.get("Content-Disposition")).toBe(
      'inline; filename="count-sheet-etc-passwd-X-Evil-1-2026-11-12.pdf"',
    );
    expect(response.headers.get("X-Evil")).toBeNull();
  });

  it("answers the part asked for, named with its number, and reads only its lines", async () => {
    reads.getStocktakeLineRange.mockResolvedValue({
      lines: manyLines(10, 251),
      total: 260,
    });

    await expectPdf(
      await loader(args(`/app/stocktakes/${ID}/count-sheet?part=2`)),
      "count-sheet-Cellar-count-2026-11-12-part-2-of-2.pdf",
    );
    expect(reads.getStocktakeLineRange).toHaveBeenCalledWith(context.db, {
      stocktakeId: ID,
      skip: 250,
      take: 250,
    });
  });

  it.each(["3", "0", "-1", "1.5", "2e0", "two", "", "00002", "99999"])(
    "has no part %j of a two-part count, and renders nothing for it",
    async (part) => {
      reads.getStocktakeLineRange.mockImplementation(
        async (_db: unknown, input: { skip: number }) => ({
          lines: input.skip === 0 ? manyLines(250) : [],
          total: 260,
        }),
      );

      const response = await loader(
        args(
          `/app/stocktakes/${ID}/count-sheet?part=${encodeURIComponent(part)}`,
        ),
      );

      expect(response.status).toBe(404);
      expect(response.headers.get("Content-Type")).toBe(
        "text/plain; charset=utf-8",
      );
      expect(await response.text()).toBe(
        "This count prints in 2 parts. Ask for a part from 1 to 2.",
      );
      expect(context.admin.graphql).not.toHaveBeenCalled();
    },
  );

  it("has no second part of a count that fits one document", async () => {
    reads.getStocktakeLineRange.mockResolvedValue({ lines: [], total: 2 });

    const response = await loader(
      args(`/app/stocktakes/${ID}/count-sheet?part=2`),
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe(
      "This count prints as one document, without parts.",
    );
  });

  it("answers 404 for a count the shop does not have, without asking Shopify", async () => {
    reads.getStocktake.mockResolvedValue(null);

    const missing = await loader(args(`/app/stocktakes/${ID}/count-sheet`));
    const blank = await loader(
      args("/app/stocktakes/%20/count-sheet", { id: " " }),
    );
    const absent = await loader(args("/app/stocktakes//count-sheet", {}));

    for (const response of [missing, blank, absent]) {
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Stocktake not found");
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    }
    // A blank or missing ID never reaches the database.
    expect(reads.getStocktake).toHaveBeenCalledTimes(1);
    expect(context.admin.graphql).not.toHaveBeenCalled();
  });

  it("still prints, in UTC and without a shop name, when Shopify does not answer", async () => {
    context.admin.graphql.mockRejectedValue(new Error("Shopify is down"));

    await expectPdf(
      await loader(args(`/app/stocktakes/${ID}/count-sheet`)),
      "count-sheet-Cellar-count-2026-11-12.pdf",
    );
  });

  it("passes on a sign-in bounce instead of printing", async () => {
    const bounce = new Response(null, { status: 302 });
    context.admin.graphql.mockRejectedValue(bounce);

    await expect(
      loader(args(`/app/stocktakes/${ID}/count-sheet`)),
    ).rejects.toBe(bounce);
  });

  it("prints with no active plan and with stock changes switched off: it only reads", async () => {
    // Neither the plan gate nor a write switch is consulted; the mocks above
    // provide neither, so reaching either would throw.
    await expectPdf(
      await loader(args(`/app/stocktakes/${ID}/count-sheet`)),
      "count-sheet-Cellar-count-2026-11-12.pdf",
    );
  });

  it("counts each sheet asked for against the signed-in shop", async () => {
    const asked = args(`/app/stocktakes/${ID}/count-sheet`);

    await loader(asked);

    expect(limiter.refusePaperOverLimit).toHaveBeenCalledTimes(1);
    expect(limiter.refusePaperOverLimit).toHaveBeenCalledWith(
      tenant,
      asked.request,
    );
  });

  it("answers a shop that asks too often before anything is read", async () => {
    const refusal = new Response("Try again later", { status: 429 });
    limiter.refusePaperOverLimit.mockResolvedValue(refusal);

    expect(await loader(args(`/app/stocktakes/${ID}/count-sheet`))).toBe(
      refusal,
    );

    expect(reads.getStocktake).not.toHaveBeenCalled();
    expect(reads.getStocktakeLineRange).not.toHaveBeenCalled();
    expect(context.admin.graphql).not.toHaveBeenCalled();
  });
});
