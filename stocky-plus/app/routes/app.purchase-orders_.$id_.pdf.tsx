import type { LoaderFunctionArgs } from "react-router";
import { loadPurchaseOrderPdf } from "../services/purchasing/purchase-order-pdf-loader.server";

/** Resource route: the purchase order as a PDF for the supplier. */
export const loader = (args: LoaderFunctionArgs) =>
  loadPurchaseOrderPdf(args, "supplier");
