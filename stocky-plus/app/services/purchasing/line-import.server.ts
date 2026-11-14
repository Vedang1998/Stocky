/**
 * Lines for a purchase order from a CSV file: one row per product, found by
 * variant ID, barcode or SKU, with a quantity and optionally a unit cost.
 * The whole file is checked before anything is added, so a file with any bad
 * row adds nothing. The lines CSV this app exports can be imported as is.
 */
import { Prisma } from "@prisma/client";
import type { TenantDb } from "../../tenant/tenant-db.server";
import type { AdminGraphQLClient } from "../shopify-gql.server";
import type { PurchasingActor } from "./actor.server";
import { invalidInput } from "./errors";
import {
  addPurchaseOrderLines,
  MAX_LINE_UNIT_COST,
  MAX_LINES_PER_ORDER,
  MAX_ORDER_QUANTITY,
  type DraftLineInput,
} from "./purchase-orders.server";
import { isVariantGid, resolveVariants } from "./variants.server";

/** Largest file accepted, in bytes. */
export const MAX_LINE_IMPORT_BYTES = 1_000_000;
/**
 * The file's text, read chunk by chunk so that no more than `maxBytes` is
 * ever held; null when the file is larger.
 */
export async function readLinesFile(
  file: Blob,
  maxBytes: number = MAX_LINE_IMPORT_BYTES,
): Promise<string | null> {
  if (file.size > maxBytes) return null;
  const reader = file.stream().getReader();
  const decoder = new TextDecoder("utf-8");
  let text = "";
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

/** Row problems listed before the rest are summarised. */
const MAX_REPORTED_PROBLEMS = 10;
const MAX_CODE_LENGTH = 255;

const COLUMN_NAMES = {
  variant: ["variant id", "variant gid", "variant"],
  barcode: ["barcode", "upc", "ean", "gtin"],
  sku: ["sku"],
  quantity: ["quantity", "qty", "ordered", "order quantity"],
  unitCost: ["unit cost", "cost"],
} as const;

type Column = keyof typeof COLUMN_NAMES;

type ImportRow = {
  /** The row's line number in the file, counting the header as 1. */
  line: number;
  variantGid: string | null;
  barcode: string | null;
  sku: string | null;
  quantity: number;
  unitCost: Prisma.Decimal | null;
};

export type LineImportResult = {
  rows: number;
  added: number;
  merged: number;
  missingCostVariantGids: string[];
};

/**
 * RFC 4180 records: comma separated, fields optionally quoted with doubled
 * quotes inside, CRLF or LF line ends. A leading byte-order mark is ignored.
 */
export function parseCsvRecords(text: string): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let index = 0;

  while (index < source.length) {
    const char = source[index]!;
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
      } else {
        field += char;
      }
      index++;
      continue;
    }
    if (char === '"' && field === "") {
      quoted = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
      if (char === "\r" && source[index + 1] === "\n") index++;
    } else {
      field += char;
    }
    index++;
  }
  if (quoted) {
    throw invalidInput("The file has a quoted value that never ends.");
  }
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}

function columnIndexes(
  header: readonly string[],
): Partial<Record<Column, number>> {
  const names = header.map((cell) =>
    cell.trim().toLowerCase().replace(/\s+/g, " "),
  );
  const indexes: Partial<Record<Column, number>> = {};
  for (const column of Object.keys(COLUMN_NAMES) as Column[]) {
    const found = names.findIndex((name) =>
      (COLUMN_NAMES[column] as readonly string[]).includes(name),
    );
    if (found !== -1) indexes[column] = found;
  }
  return indexes;
}

function variantGidFrom(value: string): string | null {
  if (/^\d{1,20}$/.test(value)) return `gid://shopify/ProductVariant/${value}`;
  return isVariantGid(value) ? value : null;
}

function parseRows(records: string[][]): {
  rows: ImportRow[];
  problems: string[];
} {
  const [header, ...body] = records;
  if (!header) throw invalidInput("The file is empty.");
  const columns = columnIndexes(header);
  if (columns.quantity === undefined) {
    throw invalidInput("The file needs a Quantity column.");
  }
  if (
    columns.variant === undefined &&
    columns.barcode === undefined &&
    columns.sku === undefined
  ) {
    throw invalidInput("The file needs a SKU, Barcode or Variant ID column.");
  }

  const rows: ImportRow[] = [];
  const problems: string[] = [];
  body.forEach((record, offset) => {
    const line = offset + 2;
    if (record.every((cell) => cell.trim() === "")) return;
    const cell = (column: Column) => {
      const index = columns[column];
      const value = index === undefined ? "" : (record[index] ?? "").trim();
      return value === "" ? null : value;
    };

    const variantText = cell("variant");
    const barcode = cell("barcode");
    const sku = cell("sku");
    const quantityText = cell("quantity");
    const costText = cell("unitCost");

    const variantGid =
      variantText === null ? null : variantGidFrom(variantText);
    if (variantText !== null && variantGid === null) {
      problems.push(
        `Row ${line}: "${variantText}" is not a Shopify variant ID.`,
      );
      return;
    }
    if (variantGid === null && barcode === null && sku === null) {
      problems.push(`Row ${line}: give a SKU, barcode or variant ID.`);
      return;
    }
    if (
      (barcode?.length ?? 0) > MAX_CODE_LENGTH ||
      (sku?.length ?? 0) > MAX_CODE_LENGTH
    ) {
      problems.push(`Row ${line}: the SKU or barcode is too long.`);
      return;
    }
    const quantity =
      quantityText !== null && /^\d{1,7}$/.test(quantityText)
        ? Number(quantityText)
        : null;
    if (quantity === null || quantity < 1 || quantity > MAX_ORDER_QUANTITY) {
      problems.push(
        `Row ${line}: the quantity must be a whole number from 1 to ${MAX_ORDER_QUANTITY.toLocaleString("en-US")}.`,
      );
      return;
    }
    let unitCost: Prisma.Decimal | null = null;
    if (costText !== null) {
      if (!/^\d{1,6}(?:\.\d{1,4})?$/.test(costText)) {
        problems.push(
          `Row ${line}: the unit cost must be a number such as 12.50, with at most 4 decimals.`,
        );
        return;
      }
      unitCost = new Prisma.Decimal(costText);
      if (unitCost.greaterThan(MAX_LINE_UNIT_COST)) {
        problems.push(`Row ${line}: the unit cost is too large.`);
        return;
      }
    }
    rows.push({ line, variantGid, barcode, sku, quantity, unitCost });
  });
  return { rows, problems };
}

/** Live variants by exact barcode and by exact SKU. */
async function variantsByCode(
  db: TenantDb,
  barcodes: string[],
  skus: string[],
): Promise<{ barcode: Map<string, string[]>; sku: Map<string, string[]> }> {
  const found = {
    barcode: new Map<string, string[]>(),
    sku: new Map<string, string[]>(),
  };
  if (barcodes.length === 0 && skus.length === 0) return found;
  const rows: Array<{
    shopifyGid: string;
    sku: string | null;
    barcode: string | null;
  }> = await db.shopifyVariantFact.findMany({
    where: {
      existenceState: "LIVE",
      OR: [
        ...(barcodes.length > 0 ? [{ barcode: { in: barcodes } }] : []),
        ...(skus.length > 0 ? [{ sku: { in: skus } }] : []),
      ],
    },
    select: { shopifyGid: true, sku: true, barcode: true },
    orderBy: { shopifyGid: "asc" },
  });
  for (const row of rows) {
    if (row.barcode !== null && barcodes.includes(row.barcode)) {
      found.barcode.set(row.barcode, [
        ...(found.barcode.get(row.barcode) ?? []),
        row.shopifyGid,
      ]);
    }
    if (row.sku !== null && skus.includes(row.sku)) {
      found.sku.set(row.sku, [
        ...(found.sku.get(row.sku) ?? []),
        row.shopifyGid,
      ]);
    }
  }
  return found;
}

function problemMessage(problems: string[]): string {
  const shown = problems.slice(0, MAX_REPORTED_PROBLEMS);
  const more = problems.length - shown.length;
  return [
    "Nothing was imported.",
    ...shown,
    ...(more > 0
      ? [`And ${more} more ${more === 1 ? "row" : "rows"} with problems.`]
      : []),
  ].join(" ");
}

/**
 * Check every row of a lines file, then add them to the purchase order in one
 * step at the version the merchant saw.
 */
export async function importPurchaseOrderLines(
  db: TenantDb,
  actor: PurchasingActor,
  purchaseOrderId: string,
  expectedVersion: number,
  csv: string,
  options: { admin?: AdminGraphQLClient } = {},
): Promise<LineImportResult> {
  const { rows, problems } = parseRows(parseCsvRecords(csv));
  if (problems.length > 0) throw invalidInput(problemMessage(problems));
  if (rows.length === 0) throw invalidInput("The file has no rows to import.");
  if (rows.length > MAX_LINES_PER_ORDER) {
    throw invalidInput(`A file can have at most ${MAX_LINES_PER_ORDER} rows.`);
  }

  const byCode = await variantsByCode(
    db,
    [
      ...new Set(
        rows.filter((r) => !r.variantGid && r.barcode).map((r) => r.barcode!),
      ),
    ],
    [
      ...new Set(
        rows.filter((r) => !r.variantGid && !r.barcode).map((r) => r.sku!),
      ),
    ],
  );
  const named = [
    ...new Set(rows.flatMap((r) => (r.variantGid ? [r.variantGid] : []))),
  ];
  const live =
    named.length > 0
      ? await resolveVariants(db, named, { admin: options.admin })
      : new Map();

  const lines: DraftLineInput[] = [];
  for (const row of rows) {
    let variantGid: string;
    if (row.variantGid) {
      if (!live.has(row.variantGid)) {
        problems.push(
          `Row ${row.line}: no product in this store has that variant ID.`,
        );
        continue;
      }
      variantGid = row.variantGid;
    } else {
      const [kind, code] = row.barcode
        ? (["barcode", row.barcode] as const)
        : (["SKU", row.sku!] as const);
      const matches =
        (kind === "barcode" ? byCode.barcode : byCode.sku).get(code) ?? [];
      if (matches.length === 0) {
        problems.push(`Row ${row.line}: no product has ${kind} ${code}.`);
        continue;
      }
      if (matches.length > 1) {
        problems.push(
          `Row ${row.line}: ${matches.length} products have ${kind} ${code}; use the variant ID instead.`,
        );
        continue;
      }
      variantGid = matches[0]!;
    }
    lines.push({ variantGid, quantity: row.quantity, unitCost: row.unitCost });
  }
  if (problems.length > 0) throw invalidInput(problemMessage(problems));

  const result = await addPurchaseOrderLines(
    db,
    actor,
    purchaseOrderId,
    expectedVersion,
    lines,
    options,
  );
  return { rows: rows.length, ...result };
}
