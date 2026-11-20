/**
 * The count sheet route: find the shop's count, read how the shop is named
 * and what its clock says, and answer with the PDF of the part asked for
 * (`?part=2`; a count of up to 250 items has one part).
 */
import type { LoaderFunctionArgs } from "react-router";
import { noSuchPartResponse, pdfResponse } from "../../lib/pdf/document.server";
import { readPdfPart } from "../../lib/pdf/parts";
import { requireAdminTenant } from "../../tenant/require-admin-tenant.server";
import { readFormId } from "../inventory-writes/form-values";
import {
  paperRefusal,
  readPaperSetting,
} from "../inventory-writes/paper.server";
import {
  countSheetFilename,
  countSheetPdf,
  readCountSheet,
} from "./stocktake-count-sheet.server";

export async function loadCountSheet({
  request,
  params,
}: LoaderFunctionArgs): Promise<Response> {
  const { admin, db } = await requireAdminTenant({ request, params });
  const stocktakeId = readFormId(params.id);
  const part = readPdfPart(new URL(request.url).searchParams.get("part"));
  // An address that names no usable part is still answered for the count it
  // names: its first part is read to learn how many parts there are.
  const sheet = stocktakeId
    ? await readCountSheet(db, stocktakeId, part ?? 1)
    : null;
  if (!sheet) return paperRefusal("Stocktake not found", 404);
  if (part === null || part > sheet.shown.parts) {
    return noSuchPartResponse("count", sheet.shown.parts);
  }

  const setting = await readPaperSetting(admin);
  return pdfResponse(
    await countSheetPdf(sheet, { ...setting, printedAt: new Date() }),
    countSheetFilename(sheet, setting.timeZone),
  );
}
