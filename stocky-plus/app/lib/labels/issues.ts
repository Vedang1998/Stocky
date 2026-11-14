import type { LabelIssue } from "./layout";
import { LABEL_FIELDS } from "./template";

const FIELD_NAMES = new Map<string, string>(
  LABEL_FIELDS.map((field) => [field.id, field.name.toLowerCase()]),
);

/** What the merchant should know about a label, in plain words. */
export function issueText(issue: LabelIssue): string {
  switch (issue.kind) {
    case "no_barcode":
      return "No barcode or SKU on file, so this label has no barcode.";
    case "barcode_unprintable":
      return "The barcode has characters a label cannot encode, so it is printed as text.";
    case "barcode_too_long":
      return "The barcode is too long for this label size, so it is printed as text. Choose a larger label.";
    case "fields_left_off":
      return `Left off to fit this label size: ${issue.fields
        .map((field) => FIELD_NAMES.get(field) ?? field)
        .join(", ")}.`;
  }
}
