import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/**
 * Resource route: generates ZPL barcode labels for the exact quantities
 * received in a scan session. `?items=<variantId>:<count>,...`
 *
 * Zebra printers accept raw ZPL. For Dymo, merchants print from Dymo
 * Connect using the same barcode values.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const url = new URL(request.url);
  const itemsParam = url.searchParams.get("items") ?? "";

  const items = itemsParam
    .split(",")
    .filter(Boolean)
    .map((pair) => {
      const [variantId, count] = pair.split(":");
      return {
        variantId: decodeURIComponent(variantId ?? ""),
        count: parseInt(count ?? "0", 10),
      };
    })
    .filter((i) => i.variantId && i.count > 0);

  if (items.length === 0) {
    return new Response("No items specified", { status: 400 });
  }

  const zplBlocks: string[] = [];

  for (const item of items) {
    const variant = await prisma.shopifyVariantCache.findUnique({
      where: {
        shop_shopifyVariantId: { shop, shopifyVariantId: item.variantId },
      },
    });
    if (!variant) continue;

    const barcode = variant.barcode ?? variant.sku ?? "";
    const title = variant.title.slice(0, 40).replace(/[\^~]/g, "");

    // One label per unit received: 2.25" x 1.25" at 203dpi.
    for (let i = 0; i < item.count; i++) {
      zplBlocks.push(
        [
          "^XA",
          "^PW457",
          "^LL254",
          `^FO20,20^A0N,24,24^FD${title}^FS`,
          barcode
            ? `^FO20,60^BY2^BCN,120,Y,N,N^FD${barcode}^FS`
            : `^FO20,80^A0N,20,20^FDNo barcode on file^FS`,
          "^XZ",
        ].join("\n"),
      );
    }
  }

  return new Response(zplBlocks.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="labels-${Date.now()}.zpl"`,
    },
  });
};
