/**
 * Parsing and ZPL rendering for warehouse receiving labels.
 *
 * The label route builds one label per received unit, so the requested
 * counts must be bounded before any output is built: an unbounded count lets
 * one request exhaust the server's memory. Field data from the variant cache
 * (title, barcode, SKU) is merchant-controlled and must not be able to inject
 * ZPL commands into the print job.
 */

import { MAX_LABEL_VARIANTS, MAX_LABELS_PER_REQUEST } from "./labels/limits";

export { MAX_LABEL_VARIANTS, MAX_LABELS_PER_REQUEST };
/** Characters of the product title printed on a label. */
export const LABEL_TITLE_MAX_CHARS = 40;
/** Longest value printed as a Code 128 barcode on a 2.25" label. */
export const LABEL_BARCODE_MAX_CHARS = 48;

export type LabelItem = { variantId: string; count: number };

export type ParseLabelItemsResult =
  | { ok: true; items: LabelItem[] }
  | { ok: false; message: string };

const COUNT_PATTERN = /^\d{1,9}$/;

function decodeVariantId(raw: string): string | null {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return null;
  }
}

/**
 * Parse `items=<variantId>:<count>,...`.
 *
 * Variant IDs are Shopify GIDs (`gid://shopify/ProductVariant/1`) and contain
 * colons, so the count is taken from the last colon. IDs may arrive encoded
 * once or twice depending on how the link was built; both decode to the same
 * value. Repeated IDs are merged. Returns an error instead of partial output
 * when any limit is exceeded or an entry is malformed.
 */
export function parseLabelItems(param: string): ParseLabelItemsResult {
  const counts = new Map<string, number>();
  let total = 0;

  for (const entry of param.split(",")) {
    if (entry === "") continue;
    const separator = entry.lastIndexOf(":");
    if (separator <= 0) {
      return { ok: false, message: "Each item must be <variantId>:<count>" };
    }
    const variantId = decodeVariantId(entry.slice(0, separator));
    const countText = entry.slice(separator + 1);
    if (!variantId || !COUNT_PATTERN.test(countText)) {
      return { ok: false, message: "Each item must be <variantId>:<count>" };
    }
    const count = Number(countText);
    if (count === 0) continue;

    total += count;
    if (total > MAX_LABELS_PER_REQUEST) {
      return {
        ok: false,
        message: `At most ${MAX_LABELS_PER_REQUEST} labels can be printed per request`,
      };
    }
    counts.set(variantId, (counts.get(variantId) ?? 0) + count);
    if (counts.size > MAX_LABEL_VARIANTS) {
      return {
        ok: false,
        message: `At most ${MAX_LABEL_VARIANTS} variants can be printed per request`,
      };
    }
  }

  if (counts.size === 0) {
    return { ok: false, message: "No items specified" };
  }
  return {
    ok: true,
    items: [...counts].map(([variantId, count]) => ({ variantId, count })),
  };
}

// ZPL treats "^" and "~" as command prefixes anywhere in field data; control
// characters can end a field or corrupt the job on some printers.
// eslint-disable-next-line no-control-regex -- control characters are the target
const ZPL_UNSAFE = /[\^~\u0000-\u001F\u007F-\u009F]/g;
const CODE128_PRINTABLE = /^[ -~]+$/;

/** Text safe to place inside a ^FD...^FS field. */
export function zplFieldText(value: string, maxChars: number): string {
  return Array.from(value.replace(ZPL_UNSAFE, "")).slice(0, maxChars).join("");
}

/**
 * Barcode values are printed only when they can be encoded exactly. Removing
 * characters from a barcode would print a code that scans as a different
 * value, so unprintable values fall back to a text notice instead.
 */
export function printableBarcode(value: string): string | null {
  if (value === "" || value.length > LABEL_BARCODE_MAX_CHARS) return null;
  if (!CODE128_PRINTABLE.test(value) || /[\^~]/.test(value)) return null;
  return value;
}

/** One 2.25" x 1.25" label at 203 dpi. */
export function zplLabel(input: { title: string; barcode: string }): string {
  const title = zplFieldText(input.title, LABEL_TITLE_MAX_CHARS);
  const barcode = printableBarcode(input.barcode);
  const barcodeLine =
    barcode !== null
      ? `^FO20,60^BY2^BCN,120,Y,N,N^FD${barcode}^FS`
      : input.barcode === ""
        ? "^FO20,80^A0N,20,20^FDNo barcode on file^FS"
        : "^FO20,80^A0N,20,20^FDBarcode not printable^FS";
  return [
    "^XA",
    // Without this the printer reads text as single-byte and prints any
    // accent or dash outside ASCII as garbage.
    "^CI28",
    "^PW457",
    "^LL254",
    `^FO20,20^A0N,24,24^FD${title}^FS`,
    barcodeLine,
    "^XZ",
  ].join("\n");
}
