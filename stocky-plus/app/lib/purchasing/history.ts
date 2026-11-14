/**
 * Merchant wording for purchasing history events. Safe for client and server
 * bundles; `details` is whatever JSON the event was recorded with.
 */
import { STATUS_LABELS, isPurchaseOrderStatus } from "./status";

type Details = Record<string, unknown>;

const HEADER_FIELD_LABELS: Record<string, string> = {
  locationId: "destination",
  currency: "currency",
  exchangeRate: "exchange rate",
  supplierOrderNumber: "supplier order number",
  invoiceNumber: "invoice number",
  issuedOn: "order date",
  expectedOn: "expected date",
  shipOn: "ship date",
  cancelOn: "cancel date",
  invoiceOn: "invoice date",
  paymentDueOn: "payment due date",
  paymentTerms: "payment terms",
  shippingTerms: "shipping terms",
  shipToAddress: "ship-to address",
  billToAddress: "bill-to address",
  buyerName: "buyer",
  notes: "internal notes",
  supplierNotes: "notes to supplier",
};

const LINE_FIELD_LABELS: Record<string, string> = {
  orderedQty: "quantity",
  unitCost: "unit cost",
  discountPercent: "discount",
  taxRatePercent: "tax rate",
  note: "note",
};

const SUPPLIER_FIELD_LABELS: Record<string, string> = {
  name: "name",
  accountNumber: "account number",
  contactName: "contact name",
  contactEmail: "contact email",
  contactPhone: "contact phone",
  preferredContactMethod: "preferred contact method",
  website: "website",
  addressLine1: "address",
  addressLine2: "address line 2",
  city: "city",
  region: "state or province",
  postalCode: "postal code",
  countryCode: "country",
  currency: "currency",
  paymentTerms: "payment terms",
  shippingTerms: "shipping terms",
  defaultTaxRatePercent: "tax rate",
  defaultLeadTimeDays: "lead time",
  defaultRestockDays: "days between orders",
  minimumOrderValue: "minimum order value",
  vendorNotes: "notes",
};

function asDetails(value: unknown): Details {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Details)
    : {};
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value)
    ? value
    : null;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Labels of the changed fields; column names without a label are left out. */
function fieldList(value: unknown, labels: Record<string, string>): string {
  if (!Array.isArray(value)) return "";
  return value
    .flatMap((field) =>
      typeof field === "string" && labels[field] ? [labels[field]] : [],
    )
    .join(", ");
}

function receiptNumber(details: Details): string {
  const number = count(details.receiptNumber);
  return number === null ? "A receipt" : `Receipt ${number}`;
}

export function describePurchasingEvent(
  action: string,
  rawDetails: unknown,
): string {
  const details = asDetails(rawDetails);
  switch (action) {
    case "purchase_order.created": {
      const lines = count(details.lineCount);
      const origin =
        details.source === "replenishment"
          ? " from replenishment suggestions"
          : details.source === "duplicate" &&
              typeof details.copiedFrom === "string"
            ? ` as a copy of ${details.copiedFrom}`
            : "";
      return lines === null
        ? `Draft created${origin}.`
        : `Draft created${origin} with ${plural(lines, "line", "lines")}.`;
    }
    case "purchase_order.header_updated": {
      const fields = fieldList(details.fields, HEADER_FIELD_LABELS);
      return fields ? `Details changed: ${fields}.` : "Details changed.";
    }
    case "purchase_order.lines_added": {
      const added = count(details.added) ?? 0;
      const merged = count(details.merged) ?? 0;
      if (added > 0 && merged > 0) {
        return `${plural(added, "line", "lines")} added and ${plural(merged, "existing line", "existing lines")} increased.`;
      }
      return merged > 0
        ? `${plural(merged, "existing line", "existing lines")} increased.`
        : `${plural(added, "line", "lines")} added.`;
    }
    case "purchase_order.line_updated": {
      const fields = fieldList(details.fields, LINE_FIELD_LABELS);
      return fields ? `A line changed: ${fields}.` : "A line changed.";
    }
    case "purchase_order.line_removed": {
      const quantity = count(details.quantity);
      return quantity === null
        ? "A line was removed."
        : `A line of ${plural(quantity, "unit", "units")} was removed.`;
    }
    case "purchase_order.line_cancelled": {
      const cancelled = count(details.cancelledQty);
      return cancelled === null
        ? "Units on a line were cancelled."
        : `Cancelled units on a line set to ${cancelled}.`;
    }
    case "purchase_order.charges_updated":
      return "Charges changed.";
    case "purchase_order.sent":
      return "Marked as sent to the supplier.";
    case "purchase_order.ordered":
      return "Marked as ordered.";
    case "purchase_order.cancelled":
      return "Cancelled.";
    case "purchase_order.closed": {
      const unreceived = count(details.unreceivedUnits);
      return unreceived
        ? `Closed with ${plural(unreceived, "unit", "units")} not received.`
        : "Closed.";
    }
    case "purchase_order.archived":
      return "Archived.";
    case "purchase_order.unarchived":
      return "Unarchived.";
    case "purchase_order.received": {
      const units = count(details.postedUnits);
      const base =
        units === null
          ? `${receiptNumber(details)} received.`
          : `${receiptNumber(details)}: ${plural(units, "unit", "units")} received.`;
      const status = details.toStatus;
      return typeof status === "string" && isPurchaseOrderStatus(status)
        ? `${base} Order is now ${STATUS_LABELS[status].toLowerCase()}.`
        : base;
    }
    case "purchase_order.receipt_failed":
      return `${receiptNumber(details)} was not received; no stock changed.`;
    case "purchase_order.receipt_reversed": {
      const units = count(details.reversedUnits);
      return units === null
        ? `${receiptNumber(details)} reversed.`
        : `${receiptNumber(details)} reversed: ${plural(units, "unit", "units")} taken back out of stock.`;
    }
    case "purchase_order.receipt_reversal_failed":
      return `${receiptNumber(details)} could not be reversed; no stock changed.`;
    case "supplier.created":
      return "Supplier created.";
    case "supplier.updated": {
      const fields = fieldList(details.fields, SUPPLIER_FIELD_LABELS);
      return fields ? `Details changed: ${fields}.` : "Details changed.";
    }
    case "supplier.archived":
      return "Archived.";
    case "supplier.restored":
      return "Restored.";
    case "supplier.products_added": {
      const added = count(details.count);
      return added === null
        ? "Products added."
        : `${plural(added, "product", "products")} added.`;
    }
    case "supplier.product_added":
      return "A product was added.";
    case "supplier.product_updated":
      return "A product's terms changed.";
    case "supplier.product_removed":
      return "A product was removed.";
    case "supplier.price_tier_added":
      return "A volume price was added.";
    case "supplier.price_tier_removed":
      return "A volume price was removed.";
    default:
      return "Updated.";
  }
}
