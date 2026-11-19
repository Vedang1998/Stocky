/* eslint-disable @typescript-eslint/no-explicit-any -- TenantDb opaque delegates */
import type { LoaderFunctionArgs } from "react-router";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import { downloadHeaders } from "../lib/http/download.server";
import { parseLabelItems, zplLabel } from "../lib/warehouse-labels.server";

/**
 * Resource route: generates ZPL barcode labels for the exact quantities
 * received in a scan session. `?items=<variantId>:<count>,...`
 *
 * Zebra printers accept raw ZPL. For Dymo, merchants print from Dymo
 * Connect using the same barcode values.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { db } = await requireAdminTenant({ request });
  const parsed = parseLabelItems(
    new URL(request.url).searchParams.get("items") ?? "",
  );
  if (!parsed.ok) {
    return new Response(parsed.message, { status: 400 });
  }

  const variants = await db.shopifyVariantCache.findMany({
    where: {
      shopifyVariantId: { in: parsed.items.map((item) => item.variantId) },
    },
  });
  const variantsById = new Map<string, any>(
    variants.map((variant: any) => [variant.shopifyVariantId, variant]),
  );

  // Printing fewer labels than were asked for would go unnoticed at the
  // printer, so a product that is not in the catalog stops the whole job.
  const unknown = parsed.items.filter((item) => !variantsById.has(item.variantId));
  if (unknown.length > 0) {
    return new Response(
      `These products are not in your catalog, so no labels were made: ${unknown
        .map((item) => item.variantId)
        .join(", ")}. They may have been deleted in Shopify or not synced yet.`,
      { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const zplBlocks: string[] = [];
  for (const item of parsed.items) {
    const variant = variantsById.get(item.variantId)!;

    const label = zplLabel({
      title: variant.title,
      barcode: variant.barcode ?? variant.sku ?? "",
    });
    // One label per unit received.
    for (let i = 0; i < item.count; i++) zplBlocks.push(label);
  }

  return new Response(zplBlocks.join("\n"), {
    headers: downloadHeaders({
      contentType: "text/plain; charset=utf-8",
      filename: `labels-${Date.now()}.zpl`,
    }),
  });
};
