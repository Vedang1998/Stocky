/** Dots per inch of the common desktop label printers (Zebra ZD/GK, 8 dots/mm). */
export const LABEL_DPI = 203;

export type LabelSize = {
  id: string;
  name: string;
  widthIn: number;
  heightIn: number;
};

/** Standard retail label stock, width by height. */
export const LABEL_SIZES: readonly LabelSize[] = [
  { id: "1.5x1", name: "1.5 × 1 in", widthIn: 1.5, heightIn: 1 },
  { id: "2x1", name: "2 × 1 in", widthIn: 2, heightIn: 1 },
  { id: "2.25x1.25", name: "2.25 × 1.25 in", widthIn: 2.25, heightIn: 1.25 },
  { id: "3x2", name: "3 × 2 in", widthIn: 3, heightIn: 2 },
];

export const LABEL_FIELDS = [
  { id: "product", name: "Product name" },
  { id: "variant", name: "Variant" },
  { id: "supplier", name: "Supplier" },
  { id: "location", name: "Location" },
  { id: "barcode", name: "Barcode" },
  { id: "sku", name: "SKU" },
  { id: "price", name: "Price" },
  { id: "compareAt", name: "Compare-at price" },
] as const;

export type LabelFieldId = (typeof LABEL_FIELDS)[number]["id"];

export type LabelTemplate = {
  sizeId: string;
  /** Fields to print, in the order of LABEL_FIELDS. */
  fields: LabelFieldId[];
};

export const DEFAULT_LABEL_TEMPLATE: LabelTemplate = {
  sizeId: "2.25x1.25",
  fields: ["product", "variant", "barcode", "price"],
};

export function labelSize(sizeId: string): LabelSize {
  return (
    LABEL_SIZES.find((size) => size.id === sizeId) ??
    LABEL_SIZES.find((size) => size.id === DEFAULT_LABEL_TEMPLATE.sizeId)!
  );
}

export function inchesToDots(inches: number): number {
  return Math.round(inches * LABEL_DPI);
}

/**
 * A template read back from browser storage. Anything that is not a known
 * size or field is dropped, so a template saved by an older or newer version
 * of the page still gives a printable label.
 */
export function parseLabelTemplate(value: unknown): LabelTemplate {
  if (typeof value !== "object" || value === null) return DEFAULT_LABEL_TEMPLATE;
  const { sizeId, fields } = value as { sizeId?: unknown; fields?: unknown };
  if (!Array.isArray(fields)) return DEFAULT_LABEL_TEMPLATE;
  return {
    sizeId:
      typeof sizeId === "string" && LABEL_SIZES.some((size) => size.id === sizeId)
        ? sizeId
        : DEFAULT_LABEL_TEMPLATE.sizeId,
    fields: LABEL_FIELDS.map((field) => field.id).filter((id) => fields.includes(id)),
  };
}

export function withField(
  template: LabelTemplate,
  field: LabelFieldId,
  enabled: boolean,
): LabelTemplate {
  const wanted = new Set(template.fields);
  if (enabled) wanted.add(field);
  else wanted.delete(field);
  return {
    ...template,
    fields: LABEL_FIELDS.map(({ id }) => id).filter((id) => wanted.has(id)),
  };
}
