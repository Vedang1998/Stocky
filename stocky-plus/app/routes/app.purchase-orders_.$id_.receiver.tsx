import type { LoaderFunctionArgs } from "react-router";
import { loadPurchaseOrderPdf } from "../services/purchasing/purchase-order-pdf-loader.server";

/**
 * Resource route: the receiving sheet warehouse staff count a delivery
 * against. It shows retail prices and deliberately leaves out costs.
 */
export const loader = (args: LoaderFunctionArgs) =>
  loadPurchaseOrderPdf(args, "receiving");
