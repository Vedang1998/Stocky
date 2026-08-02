/* eslint-disable @typescript-eslint/no-explicit-any -- TenantDb opaque delegates */
import { createElement as h } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";

/**
 * Resource route: PDF receiver document for warehouse staff.
 * Shows retail prices but deliberately hides wholesale/unit costs.
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { db } = await requireAdminTenant({ request, params });
  const po = await db.purchaseOrder.findFirst({
    where: { id: params.id },
    include: { supplier: true, lineItems: true },
  });
  if (!po) throw new Response("Purchase order not found", { status: 404 });

  const variantIds = po.lineItems.map((li: any) => li.shopifyVariantId);
  const variants = await db.shopifyVariantCache.findMany({
    where: { shopifyVariantId: { in: variantIds } },
  });
  const titleFor = (id: string) =>
    variants.find((v: any) => v.shopifyVariantId === id)?.title ?? id;
  const barcodeFor = (id: string) =>
    variants.find((v: any) => v.shopifyVariantId === id)?.barcode ?? "";

  const { renderToBuffer, Document, Page, Text, View, StyleSheet } =
    await import("@react-pdf/renderer");

  const styles = StyleSheet.create({
    page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
    title: { fontSize: 18, marginBottom: 4 },
    meta: { marginBottom: 16, color: "#444" },
    row: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: "#ddd",
      paddingVertical: 6,
    },
    headerRow: {
      flexDirection: "row",
      borderBottomWidth: 2,
      borderBottomColor: "#000",
      paddingVertical: 6,
      fontFamily: "Helvetica-Bold",
    },
    colProduct: { width: "40%" },
    colSku: { width: "20%" },
    colQty: { width: "13%", textAlign: "right" },
    colPrice: { width: "14%", textAlign: "right" },
    checkbox: { width: "13%", textAlign: "center" },
  });

  const doc = h(
    Document,
    null,
    h(
      Page,
      { size: "LETTER", style: styles.page },
      h(Text, { style: styles.title }, `Receiving Sheet — PO ${po.id.slice(-6).toUpperCase()}`),
      h(
        Text,
        { style: styles.meta },
        `Supplier: ${po.supplier?.name ?? "Unresolved supplier"}    Ordered: ${po.orderedAt ? new Date(po.orderedAt).toLocaleDateString() : "—"}    Status: ${po.status}`,
      ),
      h(
        View,
        { style: styles.headerRow },
        h(Text, { style: styles.colProduct }, "Product"),
        h(Text, { style: styles.colSku }, "Barcode / SKU"),
        h(Text, { style: styles.colQty }, "Expected"),
        h(Text, { style: styles.colPrice }, "Retail"),
        h(Text, { style: styles.checkbox }, "Counted"),
      ),
      ...po.lineItems.map((li: any) =>
        h(
          View,
          { style: styles.row, key: li.id },
          h(Text, { style: styles.colProduct }, titleFor(li.shopifyVariantId)),
          h(
            Text,
            { style: styles.colSku },
            barcodeFor(li.shopifyVariantId) || li.vendorSku || "—",
          ),
          h(Text, { style: styles.colQty }, String(li.orderedQty - li.receivedQty)),
          h(
            Text,
            { style: styles.colPrice },
            li.retailPrice ? `$${Number(li.retailPrice).toFixed(2)}` : "—",
          ),
          h(Text, { style: styles.checkbox }, "☐"),
        ),
      ),
    ),
  );

  const buffer = await renderToBuffer(doc);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receiver-${po.id.slice(-6)}.pdf"`,
    },
  });
};
