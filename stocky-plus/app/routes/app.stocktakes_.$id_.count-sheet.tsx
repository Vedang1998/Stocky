import type { LoaderFunctionArgs } from "react-router";
import { loadCountSheet } from "../services/stocktakes/stocktake-sheet-loader.server";

/** Resource route: the count sheet of a stocktake as a PDF, one part of up to 250 items. */
export const loader = (args: LoaderFunctionArgs) => loadCountSheet(args);
