/**
 * What the two purchase-order PDF routes share: find the shop's order and
 * answer with the part asked for (`?part=2`; an order of up to 250 printed
 * lines has one part).
 */
import type { LoaderFunctionArgs } from "react-router";
import { noSuchPartResponse, pdfResponse } from "../../lib/pdf/document.server";
import { refusePaperOverLimit } from "../../lib/pdf/paper-rate-limit.server";
import { readPdfPart } from "../../lib/pdf/parts";
import { requireAdminTenant } from "../../tenant/require-admin-tenant.server";
import {
  purchaseOrderFilename,
  purchaseOrderPdf,
  purchaseOrderPdfParts,
  receivingSheetPdf,
} from "./documents.server";
import { PurchasingError } from "./errors";
import { getPurchaseOrderView } from "./purchase-order-view.server";
import { readShopProfile } from "./shop-profile.server";

export type PurchaseOrderPdfKind = "supplier" | "receiving";

export async function loadPurchaseOrderPdf(
  { request, params }: LoaderFunctionArgs,
  kind: PurchaseOrderPdfKind,
): Promise<Response> {
  const { admin, db, tenant } = await requireAdminTenant({ request, params });
  const limited = await refusePaperOverLimit(tenant, request);
  if (limited) return limited;

  const profile = await readShopProfile(admin);
  const order = await getPurchaseOrderView(db, params.id ?? "", {
    admin,
    today: profile.today,
    shopCurrency: profile.currencyCode,
  }).catch((error: unknown) => {
    if (error instanceof PurchasingError && error.code === "not_found") {
      throw new Response("Purchase order not found", { status: 404 });
    }
    throw error;
  });

  const parts = purchaseOrderPdfParts(order);
  const part = readPdfPart(new URL(request.url).searchParams.get("part"));
  if (part === null || part > parts) {
    return noSuchPartResponse("purchase order", parts);
  }

  return kind === "supplier"
    ? pdfResponse(
        await purchaseOrderPdf(order, profile.name, part),
        purchaseOrderFilename(order, "", "pdf", { part, parts }),
      )
    : pdfResponse(
        await receivingSheetPdf(order, profile.currencyCode, part),
        purchaseOrderFilename(order, "-receiving", "pdf", { part, parts }),
      );
}
