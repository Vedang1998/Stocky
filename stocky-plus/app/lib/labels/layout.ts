/**
 * Where everything goes on one label, in printer dots. The ZPL writer and the
 * on-screen preview both draw from this, so what the merchant sees is what
 * the printer is told.
 */
import { code128ModuleCount, isCode128Encodable } from "./code128";
import {
  inchesToDots,
  labelSize,
  type LabelFieldId,
  type LabelTemplate,
} from "./template";

/** What one product contributes to a label. Money is already formatted. */
export type LabelContent = {
  productTitle: string;
  /** Null for a product with a single default variant. */
  variantTitle: string | null;
  sku: string | null;
  barcode: string | null;
  price: string | null;
  /** Only set when it is higher than the price. */
  compareAtPrice: string | null;
  supplier: string | null;
  location: string | null;
};

export type LabelTextElement = {
  kind: "text";
  x: number;
  y: number;
  /** Box the text is aligned in and may not leave. */
  width: number;
  fontHeight: number;
  align: "left" | "center" | "right";
  text: string;
};

export type LabelBarcodeElement = {
  kind: "barcode";
  x: number;
  y: number;
  /** Width of the narrowest bar. */
  moduleWidth: number;
  height: number;
  value: string;
};

export type LabelElement = LabelTextElement | LabelBarcodeElement;

export type LabelIssue =
  /** The product has neither a barcode nor a SKU to encode. */
  | { kind: "no_barcode" }
  /** The value has characters Code 128 cannot encode exactly. */
  | { kind: "barcode_unprintable" }
  /** The value does not fit this label at a width scanners read reliably. */
  | { kind: "barcode_too_long" }
  /** Chosen fields that did not fit on this label size. */
  | { kind: "fields_left_off"; fields: LabelFieldId[] };

export type LabelLayout = {
  widthDots: number;
  heightDots: number;
  elements: LabelElement[];
  issues: LabelIssue[];
};

/** Heights are tuned on the 1.25 in label and scaled to the others. */
const REFERENCE_HEIGHT = 254;
/** Clear space Code 128 needs on each side, in modules. */
const QUIET_ZONE_MODULES = 10;
/** Bars narrower than two dots do not scan reliably off a 203 dpi printer. */
const MIN_MODULE_WIDTH = 2;
const MAX_MODULE_WIDTH = 3;
/** A quarter inch: the shortest bars a handheld scanner picks up easily. */
const MIN_BAR_HEIGHT = 51;
type TextFieldId = Exclude<LabelFieldId, "barcode">;

/** Dropped first when a label is too small for everything chosen. */
const DROP_ORDER: readonly TextFieldId[] = [
  "location",
  "supplier",
  "compareAt",
  "variant",
  "sku",
];

// "^" and "~" start a printer command anywhere in a ZPL job, and control
// characters can end a field, so none of them is ever placed on a label.
// eslint-disable-next-line no-control-regex -- control characters are the target
const UNPRINTABLE = /[\^~\u0000-\u001F\u007F-\u009F]/g;

/** Text as it will be printed: no printer command characters, single spaces. */
export function labelText(value: string | null | undefined): string {
  return (value ?? "").replace(UNPRINTABLE, " ").replace(/\s+/g, " ").trim();
}

/**
 * Width of one character as a share of the font height, for the printer's
 * scalable font. An estimate on the wide side: text is cut a little early
 * rather than run off the label.
 */
function characterWidth(char: string): number {
  if (/[ .,:;'!|ijlI]/.test(char)) return 0.32;
  if (/[MWmw@%]/.test(char)) return 0.85;
  if (/[A-Z0-9$#&]/.test(char)) return 0.6;
  const code = char.codePointAt(0) ?? 0;
  if (code < 0x80) return 0.5;
  // Accented Latin is as wide as its base letter; other scripts are wider.
  return code < 0x250 ? 0.6 : 1;
}

export function estimateTextWidth(text: string, fontHeight: number): number {
  let units = 0;
  for (const char of text) units += characterWidth(char);
  return Math.ceil(units * fontHeight);
}

/** The longest start of `text` that fits `maxWidth`. */
export function fitText(text: string, fontHeight: number, maxWidth: number): string {
  let units = 0;
  let fitted = "";
  for (const char of text) {
    units += characterWidth(char);
    if (units * fontHeight > maxWidth) break;
    fitted += char;
  }
  return fitted.trimEnd();
}

/** Breaks at spaces into at most `maxLines` lines; the last line is cut to fit. */
export function wrapText(
  text: string,
  fontHeight: number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  const words = text.split(" ");
  for (let index = 0; index < words.length; index += 1) {
    const candidate = line === "" ? words[index] : `${line} ${words[index]}`;
    if (estimateTextWidth(candidate, fontHeight) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (lines.length === maxLines - 1 || line === "") {
      // Last line, or a single word wider than the label: cut it.
      const rest = [candidate, ...words.slice(index + 1)].join(" ");
      lines.push(fitText(rest, fontHeight, maxWidth));
      return lines;
    }
    lines.push(line);
    line = words[index];
  }
  if (line !== "") lines.push(line);
  return lines;
}

type BarcodePlan =
  | { kind: "none" }
  | { kind: "bars"; value: string; moduleWidth: number; modules: number }
  /** A value exists but cannot be printed as bars; it is printed as text. */
  | { kind: "text"; value: string };

function planBarcode(
  content: LabelContent,
  widthDots: number,
  issues: LabelIssue[],
): BarcodePlan {
  // Many shops have no barcodes and scan their SKUs instead.
  const value = (content.barcode ?? "").trim() || (content.sku ?? "").trim();
  if (value === "") {
    issues.push({ kind: "no_barcode" });
    return { kind: "none" };
  }
  // Removing a character would print a code that scans as something else.
  if (!isCode128Encodable(value) || /[\^~]/.test(value)) {
    issues.push({ kind: "barcode_unprintable" });
    const readable = labelText(value);
    return readable === "" ? { kind: "none" } : { kind: "text", value: readable };
  }
  const modules = code128ModuleCount(value);
  const moduleWidth = Math.min(
    MAX_MODULE_WIDTH,
    Math.floor(widthDots / (modules + 2 * QUIET_ZONE_MODULES)),
  );
  if (moduleWidth < MIN_MODULE_WIDTH) {
    issues.push({ kind: "barcode_too_long" });
    return { kind: "text", value };
  }
  return { kind: "bars", value, moduleWidth, modules };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

type TopLine = { field: LabelFieldId; text: string; fontHeight: number };

export function layoutLabel(template: LabelTemplate, content: LabelContent): LabelLayout {
  const size = labelSize(template.sizeId);
  const widthDots = inchesToDots(size.widthIn);
  const heightDots = inchesToDots(size.heightIn);
  const scale = heightDots / REFERENCE_HEIGHT;
  const margin = Math.max(10, Math.round(12 * scale));
  const gap = Math.max(3, Math.round(4 * scale));
  const titleFont = clamp(Math.round(26 * scale), 20, 40);
  const bodyFont = clamp(Math.round(20 * scale), 16, 30);
  const priceFont = clamp(Math.round(34 * scale), 26, 54);
  const contentWidth = widthDots - 2 * margin;

  const issues: LabelIssue[] = [];
  const wanted = new Set(template.fields);
  const barcode: BarcodePlan = wanted.has("barcode")
    ? planBarcode(content, widthDots, issues)
    : { kind: "none" };

  const text = {
    product: labelText(content.productTitle),
    variant: labelText(content.variantTitle),
    supplier: labelText(content.supplier),
    location: labelText(content.location),
    // The line under the bars already shows a SKU that is used as the barcode.
    sku:
      barcode.kind !== "none" && barcode.value === (content.sku ?? "").trim()
        ? ""
        : labelText(content.sku),
    price: labelText(content.price),
    compareAt: labelText(content.compareAtPrice),
  };
  const present = (field: TextFieldId) =>
    wanted.has(field) && text[field] !== "";

  const barcodeBlockHeight =
    barcode.kind === "bars"
      ? MIN_BAR_HEIGHT + gap + bodyFont
      : barcode.kind === "text"
        ? bodyFont
        : 0;

  // Start from everything chosen and take fields off until the label fits.
  const dropped: LabelFieldId[] = [];
  let titleLines = heightDots >= REFERENCE_HEIGHT ? 2 : 1;
  let top: TopLine[] = [];
  let bottomRowHeight = 0;
  let compareAtHeight = 0;
  for (;;) {
    const shown = (field: TextFieldId) =>
      present(field) && !dropped.includes(field);
    top = [
      ...(shown("product")
        ? wrapText(text.product, titleFont, contentWidth, titleLines).map((line) => ({
            field: "product" as const,
            text: line,
            fontHeight: titleFont,
          }))
        : []),
      ...(["variant", "supplier", "location"] as const)
        .filter(shown)
        .map((field) => ({
          field,
          text: fitText(text[field], bodyFont, contentWidth),
          fontHeight: bodyFont,
        })),
    ];
    bottomRowHeight = shown("price") ? priceFont : shown("sku") ? bodyFont : 0;
    compareAtHeight = shown("compareAt") ? bodyFont : 0;

    const blocks = [
      ...top.map((line) => line.fontHeight),
      barcodeBlockHeight,
      compareAtHeight,
      bottomRowHeight,
    ].filter((height) => height > 0);
    const needed =
      2 * margin +
      blocks.reduce((sum, height) => sum + height, 0) +
      gap * Math.max(0, blocks.length - 1);
    if (needed <= heightDots) break;

    if (titleLines > 1) {
      titleLines = 1;
      continue;
    }
    const next = DROP_ORDER.find((field) => shown(field));
    if (!next) break;
    dropped.push(next);
  }
  if (dropped.length > 0) issues.push({ kind: "fields_left_off", fields: dropped });
  const shown = (field: TextFieldId) =>
    present(field) && !dropped.includes(field);

  const elements: LabelElement[] = [];
  let topEdge = margin;
  for (const line of top) {
    elements.push({
      kind: "text",
      x: margin,
      y: topEdge,
      width: contentWidth,
      fontHeight: line.fontHeight,
      align: "left",
      text: line.text,
    });
    topEdge += line.fontHeight + gap;
  }

  let bottomEdge = heightDots - margin;
  if (bottomRowHeight > 0) {
    const rowTop = bottomEdge - bottomRowHeight;
    const priceWidth = shown("price")
      ? Math.min(contentWidth, estimateTextWidth(text.price, priceFont))
      : 0;
    if (shown("price")) {
      elements.push({
        kind: "text",
        x: margin + contentWidth - priceWidth,
        y: rowTop,
        width: priceWidth,
        fontHeight: priceFont,
        align: "right",
        text: fitText(text.price, priceFont, priceWidth),
      });
    }
    const skuWidth = contentWidth - (priceWidth > 0 ? priceWidth + 2 * gap : 0);
    if (shown("sku") && skuWidth > 0) {
      elements.push({
        kind: "text",
        x: margin,
        // Sits on the same baseline as the larger price.
        y: bottomEdge - bodyFont,
        width: skuWidth,
        fontHeight: bodyFont,
        align: "left",
        text: fitText(text.sku, bodyFont, skuWidth),
      });
    }
    bottomEdge = rowTop - gap;
  }
  if (compareAtHeight > 0) {
    const was = `Was ${text.compareAt}`;
    elements.push({
      kind: "text",
      x: margin,
      y: bottomEdge - bodyFont,
      width: contentWidth,
      fontHeight: bodyFont,
      align: "right",
      text: fitText(was, bodyFont, contentWidth),
    });
    bottomEdge -= bodyFont + gap;
  }

  const free = bottomEdge - topEdge;
  if (barcode.kind === "bars") {
    const barHeight = clamp(
      free - gap - bodyFont,
      MIN_BAR_HEIGHT,
      Math.round(heightDots * 0.4),
    );
    const blockTop = topEdge + Math.max(0, Math.floor((free - barHeight - gap - bodyFont) / 2));
    elements.push({
      kind: "barcode",
      x: Math.round((widthDots - barcode.modules * barcode.moduleWidth) / 2),
      y: blockTop,
      moduleWidth: barcode.moduleWidth,
      height: barHeight,
      value: barcode.value,
    });
    elements.push({
      kind: "text",
      x: margin,
      y: blockTop + barHeight + gap,
      width: contentWidth,
      fontHeight: bodyFont,
      align: "center",
      text: fitText(barcode.value, bodyFont, contentWidth),
    });
  } else if (barcode.kind === "text") {
    elements.push({
      kind: "text",
      x: margin,
      y: topEdge + Math.max(0, Math.floor((free - bodyFont) / 2)),
      width: contentWidth,
      fontHeight: bodyFont,
      align: "center",
      text: fitText(barcode.value, bodyFont, contentWidth),
    });
  }

  return { widthDots, heightDots, elements, issues };
}
