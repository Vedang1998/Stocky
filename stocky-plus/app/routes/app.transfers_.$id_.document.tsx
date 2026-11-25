import type { LoaderFunctionArgs } from "react-router";
import { loadTransferPaper } from "../services/transfers/transfer-paper-loader.server";

/**
 * Resource route: the transfer document as a PDF. While the stock is on its
 * way it is the sheet to check the delivery against; afterwards it is the
 * record of where every unit ended up.
 */
export const loader = (args: LoaderFunctionArgs) =>
  loadTransferPaper(args, "document");
