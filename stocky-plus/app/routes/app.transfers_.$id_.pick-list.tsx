import type { LoaderFunctionArgs } from "react-router";
import { loadTransferPaper } from "../services/transfers/transfer-paper-loader.server";

/** Resource route: the pick list of a draft transfer as a PDF, in SKU order. */
export const loader = (args: LoaderFunctionArgs) =>
  loadTransferPaper(args, "pick-list");
