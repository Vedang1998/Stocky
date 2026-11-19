/**
 * Purchase-order documents: the PDF for the supplier, the receiving sheet for
 * the warehouse (no costs on it), the supplier email draft, and CSV exports.
 * Each renders from the purchase order's view model, so it shows the same
 * exact amounts as the order page.
 */
import { createElement as h, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { csvDownloadResponse, toCsv } from "../../lib/csv.server";
import { formatDecimal, formatMoney } from "../../lib/decimal-format";
import {
  PDF_STYLES,
  labelled,
  pageFooter,
  renderPdf,
  type ReactPdf,
} from "../../lib/pdf/document.server";
import { formatDay } from "../../lib/purchasing/display";
import { STATUS_LABELS } from "../../lib/purchasing/status";
import { CHARGE_KIND_LABELS } from "../../lib/purchasing/totals";
import type { PurchaseOrderExport } from "./purchase-order-list.server";
import type {
  PurchaseOrderLineView,
  PurchaseOrderView,
} from "./purchase-order-view.server";

/** Units the supplier is asked to ship: ordered less cancelled. */
function orderedUnits(line: PurchaseOrderLineView): number {
  return Math.max(0, line.orderedQty - line.cancelledQty);
}

function isZero(amount: string): boolean {
  return /^-?0(?:\.0+)?$/.test(amount);
}

function present(...parts: Array<string | false | null | undefined>): string {
  return parts
    .filter(
      (part): part is string => typeof part === "string" && part.trim() !== "",
    )
    .join(" · ");
}

function productDetails(line: PurchaseOrderLineView): string {
  return present(
    line.vendorSku && `Supplier SKU ${line.vendorSku}`,
    line.sku && `SKU ${line.sku}`,
    line.packSize !== null && line.packSize > 1 && `Pack of ${line.packSize}`,
    line.orderUnit && `Ordered by ${line.orderUnit}`,
  );
}

function shipTo(order: PurchaseOrderView): string {
  return (
    order.header.shipToAddress ??
    present(order.location?.name, order.location?.address)
  );
}

/** The purchase order as the supplier receives it: lines, costs, charges and terms. */
export function purchaseOrderPdf(
  order: PurchaseOrderView,
  shopName: string | null,
): Promise<Uint8Array<ArrayBuffer>> {
  return renderPdf((pdf) => purchaseOrderDocument(pdf, order, shopName));
}

export function purchaseOrderDocument(
  pdf: ReactPdf,
  order: PurchaseOrderView,
  shopName: string | null,
): ReactElement<DocumentProps> {
  const { Document, Page, Text, View } = pdf;
  const money = (amount: string) => formatMoney(amount, order.currency);
  const lines = order.lines.filter((line) => orderedUnits(line) > 0);
  const columns = {
    product: { width: "40%" },
    qty: { width: "9%", ...PDF_STYLES.number },
    cost: { width: "15%", ...PDF_STYLES.number },
    discount: { width: "9%", ...PDF_STYLES.number },
    tax: { width: "9%", ...PDF_STYLES.number },
    amount: { width: "18%", ...PDF_STYLES.number },
  };
  const percent = (value: string) =>
    value === "" || isZero(value)
      ? "—"
      : `${formatDecimal(value, { maximumFractionDigits: 3 })}%`;
  const { header } = order;
  const totalRow = (label: string, amount: string) =>
    h(
      View,
      { style: PDF_STYLES.totalRow, key: label },
      h(Text, null, label),
      h(Text, null, money(amount)),
    );

  return h(
    Document,
    {
      title: `Purchase order ${order.poNumber}`,
      author: shopName ?? undefined,
    },
    h(
      Page,
      { size: "LETTER", style: PDF_STYLES.page },
      h(Text, { style: PDF_STYLES.title }, `Purchase order ${order.poNumber}`),
      h(
        Text,
        { style: PDF_STYLES.subtitle },
        present(
          `Version ${order.version}`,
          header.issuedOn && `Issued ${formatDay(header.issuedOn)}`,
          order.status === "CANCELLED" && "Cancelled",
        ),
      ),
      h(
        View,
        { style: PDF_STYLES.blocks },
        labelled(pdf, "Supplier", [
          order.supplier.name,
          order.supplier.contactEmail,
        ]),
        labelled(pdf, "Ship to", [shopName, shipTo(order)]),
        labelled(pdf, "Bill to", [shopName, header.billToAddress]),
      ),
      h(
        View,
        { style: PDF_STYLES.blocks },
        labelled(pdf, "Expected", [
          header.expectedOn && formatDay(header.expectedOn),
        ]),
        labelled(pdf, "Ship by", [header.shipOn && formatDay(header.shipOn)]),
        labelled(pdf, "Cancel if not shipped by", [
          header.cancelOn && formatDay(header.cancelOn),
        ]),
        labelled(pdf, "Payment terms", [header.paymentTerms]),
        labelled(pdf, "Shipping terms", [header.shippingTerms]),
        labelled(pdf, "Your order number", [header.supplierOrderNumber]),
        labelled(pdf, "Buyer", [header.buyerName]),
      ),
      h(
        View,
        { style: PDF_STYLES.headerRow, fixed: true },
        h(Text, { style: columns.product }, "Product"),
        h(Text, { style: columns.qty }, "Qty"),
        h(Text, { style: columns.cost }, "Unit cost"),
        h(Text, { style: columns.discount }, "Discount"),
        h(Text, { style: columns.tax }, "Tax"),
        h(Text, { style: columns.amount }, "Amount"),
      ),
      ...lines.map((line) =>
        h(
          View,
          { style: PDF_STYLES.row, key: line.id, wrap: false },
          h(
            View,
            { style: columns.product },
            h(Text, null, line.name),
            productDetails(line)
              ? h(Text, { style: PDF_STYLES.detail }, productDetails(line))
              : null,
            line.note ? h(Text, { style: PDF_STYLES.detail }, line.note) : null,
          ),
          h(Text, { style: columns.qty }, String(orderedUnits(line))),
          h(Text, { style: columns.cost }, money(line.unitCost)),
          h(
            Text,
            { style: columns.discount },
            percent(line.discountPercentInput),
          ),
          h(Text, { style: columns.tax }, percent(line.taxRatePercentInput)),
          h(Text, { style: columns.amount }, money(line.netAmount)),
        ),
      ),
      h(
        View,
        { style: PDF_STYLES.totals, wrap: false },
        totalRow(
          `Subtotal (${order.totals.units} ${order.totals.units === 1 ? "unit" : "units"})`,
          order.totals.merchandiseAmount,
        ),
        isZero(order.totals.taxAmount)
          ? null
          : totalRow("Tax", order.totals.taxAmount),
        ...order.charges.map((charge) =>
          totalRow(
            charge.description || CHARGE_KIND_LABELS[charge.kind],
            charge.amount,
          ),
        ),
        h(
          View,
          { style: PDF_STYLES.grandTotal },
          h(Text, null, `Total (${order.currency})`),
          h(Text, null, money(order.totals.totalAmount)),
        ),
      ),
      header.supplierNotes
        ? h(
            View,
            { style: PDF_STYLES.notes },
            h(Text, { style: PDF_STYLES.label }, "Notes"),
            h(Text, null, header.supplierNotes),
          )
        : null,
      pageFooter(
        pdf,
        `Purchase order ${order.poNumber}, version ${order.version}`,
      ),
    ),
  );
}

/**
 * The sheet warehouse staff count a delivery against. It shows what is still
 * expected and the retail price for price tags, never what the shop paid.
 */
export function receivingSheetPdf(
  order: PurchaseOrderView,
  shopCurrency: string | null,
): Promise<Uint8Array<ArrayBuffer>> {
  return renderPdf((pdf) => receivingSheetDocument(pdf, order, shopCurrency));
}

export function receivingSheetDocument(
  pdf: ReactPdf,
  order: PurchaseOrderView,
  shopCurrency: string | null,
): ReactElement<DocumentProps> {
  const { Document, Page, Text, View } = pdf;
  const lines = order.lines.filter((line) => orderedUnits(line) > 0);
  const retail = (amount: string | null) =>
    amount === null
      ? "—"
      : shopCurrency
        ? formatMoney(amount, shopCurrency)
        : formatDecimal(amount, { maximumFractionDigits: 2 });
  const columns = {
    product: { width: "34%" },
    barcode: { width: "20%" },
    ordered: { width: "9%", ...PDF_STYLES.number },
    received: { width: "9%", ...PDF_STYLES.number },
    expected: { width: "9%", ...PDF_STYLES.number },
    retail: { width: "10%", ...PDF_STYLES.number },
    counted: { width: "9%", alignItems: "flex-end" as const },
  };

  return h(
    Document,
    { title: `Receiving sheet ${order.poNumber}` },
    h(
      Page,
      { size: "LETTER", style: PDF_STYLES.page },
      h(Text, { style: PDF_STYLES.title }, `Receiving sheet ${order.poNumber}`),
      h(
        Text,
        { style: PDF_STYLES.subtitle },
        present(
          STATUS_LABELS[order.status],
          `${order.totals.remainingUnits} of ${order.totals.units} units still expected`,
        ),
      ),
      h(
        View,
        { style: PDF_STYLES.blocks },
        labelled(pdf, "Supplier", [order.supplier.name]),
        labelled(pdf, "Destination", [
          order.location?.name ?? "Unknown location",
        ]),
        labelled(pdf, "Expected", [
          order.header.expectedOn
            ? formatDay(order.header.expectedOn)
            : "Not set",
        ]),
        labelled(pdf, "Supplier order number", [
          order.header.supplierOrderNumber,
        ]),
      ),
      h(
        View,
        { style: PDF_STYLES.headerRow, fixed: true },
        h(Text, { style: columns.product }, "Product"),
        h(Text, { style: columns.barcode }, "Barcode / SKU"),
        h(Text, { style: columns.ordered }, "Ordered"),
        h(Text, { style: columns.received }, "Received"),
        h(Text, { style: columns.expected }, "Expected"),
        h(Text, { style: columns.retail }, "Retail"),
        h(
          Text,
          { style: { ...columns.counted, textAlign: "right" as const } },
          "Counted",
        ),
      ),
      ...lines.map((line) =>
        h(
          View,
          { style: PDF_STYLES.row, key: line.id, wrap: false },
          h(
            View,
            { style: columns.product },
            h(Text, null, line.name),
            line.vendorSku
              ? h(
                  Text,
                  { style: PDF_STYLES.detail },
                  `Supplier SKU ${line.vendorSku}`,
                )
              : null,
          ),
          h(
            View,
            { style: columns.barcode },
            h(Text, null, line.barcode || line.sku || "—"),
            line.barcode && line.sku
              ? h(Text, { style: PDF_STYLES.detail }, `SKU ${line.sku}`)
              : null,
          ),
          h(Text, { style: columns.ordered }, String(orderedUnits(line))),
          h(Text, { style: columns.received }, String(line.receivedQty)),
          h(Text, { style: columns.expected }, String(line.remainingQty)),
          h(Text, { style: columns.retail }, retail(line.retailPrice)),
          h(
            View,
            { style: columns.counted },
            h(View, {
              style: {
                width: 34,
                height: 14,
                borderWidth: 0.75,
                borderColor: "#111",
              },
            }),
          ),
        ),
      ),
      pageFooter(pdf, `Receiving sheet ${order.poNumber}`),
    ),
  );
}

export function purchaseOrderFilename(
  order: Pick<PurchaseOrderView, "poNumber" | "version">,
  suffix: string,
  extension: "pdf" | "csv",
): string {
  return `${order.poNumber}${suffix}-v${order.version}.${extension}`;
}

const LINE_COLUMNS = [
  "PO number",
  "Product",
  "Variant ID",
  "SKU",
  "Supplier SKU",
  "Barcode",
  "Ordered",
  "Cancelled",
  "Received",
  "Still expected",
  "Currency",
  "Unit cost",
  "Discount %",
  "Tax %",
  "Net amount",
  "Tax amount",
  "Landed unit cost",
  "Retail price",
  "Note",
] as const;

/** One row per line, every amount as an exact decimal. */
export function purchaseOrderLinesCsv(order: PurchaseOrderView): Response {
  const csv = toCsv(
    LINE_COLUMNS,
    order.lines.map((line) => [
      order.poNumber,
      line.name,
      line.variantGid,
      line.sku,
      line.vendorSku,
      line.barcode,
      line.orderedQty,
      line.cancelledQty,
      line.receivedQty,
      line.remainingQty,
      order.currency,
      line.unitCost,
      line.discountPercentInput || "0",
      line.taxRatePercentInput || "0",
      line.netAmount,
      line.taxAmount,
      line.landedUnitCost,
      line.retailPrice,
      line.note,
    ]),
  );
  return csvDownloadResponse(
    csv,
    purchaseOrderFilename(order, "-lines", "csv"),
  );
}

const LIST_COLUMNS = [
  "PO number",
  "Status",
  "Archived",
  "Supplier",
  "Destination",
  "Expected",
  "Overdue",
  "Ordered units",
  "Received units",
  "Still expected",
  "Currency",
  "Total",
  "Updated",
] as const;

export function purchaseOrderListCsv(
  list: PurchaseOrderExport,
  locationNames: ReadonlyMap<string, string>,
  filename: string,
): Response {
  const csv = toCsv(
    LIST_COLUMNS,
    list.items.map((po) => [
      po.poNumber,
      STATUS_LABELS[po.status],
      po.archived ? "Yes" : "No",
      po.supplierName,
      locationNames.get(po.locationGid) ?? "Unknown location",
      po.expectedOn,
      po.overdue ? "Yes" : "No",
      po.orderedUnits,
      po.receivedUnits,
      po.remainingUnits,
      po.currency,
      po.total,
      po.updatedAt,
    ]),
  );
  return csvDownloadResponse(csv, filename);
}

/** Longest email body offered; mail apps and browsers cut longer links. */
const EMAIL_BODY_LIMIT = 1_800;

/**
 * A draft email to the supplier, opened in the merchant's own mail app. It
 * lists the order and asks the merchant to attach the PDF; nothing is sent
 * from the app. Null when the supplier has no email address.
 */
export function supplierEmailHref(
  order: PurchaseOrderView,
  shopName: string | null,
): string | null {
  const to = order.supplier.contactEmail?.trim();
  if (!to) return null;
  const money = (amount: string) => formatMoney(amount, order.currency);
  const { header } = order;

  const intro = [
    `Hello ${order.supplier.name},`,
    "",
    `Please find our purchase order ${order.poNumber} (version ${order.version}) attached.`,
    "",
  ];
  const closing = [
    "",
    `Total: ${money(order.totals.totalAmount)}`,
    ...(header.expectedOn ? [`Expected: ${formatDay(header.expectedOn)}`] : []),
    ...(shipTo(order) ? [`Ship to: ${shipTo(order)}`] : []),
    ...(header.supplierNotes ? ["", header.supplierNotes] : []),
    "",
    "Thank you,",
    shopName ?? "",
  ];

  const budget = EMAIL_BODY_LIMIT - [...intro, ...closing].join("\n").length;
  const lines = order.lines.filter((line) => orderedUnits(line) > 0);
  const listed: string[] = [];
  let used = 0;
  for (const [index, line] of lines.entries()) {
    const text = `- ${orderedUnits(line)} × ${line.name}${line.vendorSku ? ` (${line.vendorSku})` : ""}`;
    const remaining = lines.length - index - 1;
    const reserve = remaining > 0 ? 40 : 0;
    if (used + text.length + 1 + reserve > budget) {
      listed.push(
        `- and ${lines.length - index} more ${lines.length - index === 1 ? "line" : "lines"}; see the attached PDF`,
      );
      break;
    }
    listed.push(text);
    used += text.length + 1;
  }

  const body = [...intro, ...listed, ...closing].join("\n").trimEnd();
  const subject = `Purchase order ${order.poNumber}${shopName ? ` from ${shopName}` : ""}`;
  const address = encodeURIComponent(to).replace(/%40/g, "@");
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
