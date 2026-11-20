/**
 * What the two transfer paper routes share: find the shop's transfer, read
 * how the shop is named and what its clock says, and answer with the PDF of
 * the part asked for (`?part=2`; a transfer of up to 250 items has one part).
 */
import type { LoaderFunctionArgs } from "react-router";
import { noSuchPartResponse, pdfResponse } from "../../lib/pdf/document.server";
import { refusePaperOverLimit } from "../../lib/pdf/paper-rate-limit.server";
import { pdfPartCount, readPdfPart } from "../../lib/pdf/parts";
import { requireAdminTenant } from "../../tenant/require-admin-tenant.server";
import { readFormId } from "../inventory-writes/form-values";
import {
  paperRefusal,
  readPaperSetting,
} from "../inventory-writes/paper.server";
import {
  pickListPdf,
  readTransferPaper,
  transferDocumentPdf,
  transferPaperFilename,
} from "./transfer-documents.server";

export type TransferPaperKind = "document" | "pick-list";

export async function loadTransferPaper(
  { request, params }: LoaderFunctionArgs,
  kind: TransferPaperKind,
): Promise<Response> {
  const { admin, db, tenant } = await requireAdminTenant({ request, params });
  const limited = await refusePaperOverLimit(tenant, request);
  if (limited) return limited;

  const transferId = readFormId(params.id);
  const paper = transferId ? await readTransferPaper(db, transferId) : null;
  if (!paper) return paperRefusal("Transfer not found", 404);
  if (kind === "pick-list" && paper.transfer.status !== "DRAFT") {
    return paperRefusal(
      "A pick list is printed while a transfer is a draft. This transfer has left the draft stage; print the transfer document instead.",
      404,
    );
  }

  const parts = pdfPartCount(paper.lines.length);
  const part = readPdfPart(new URL(request.url).searchParams.get("part"));
  if (part === null || part > parts) {
    return noSuchPartResponse("transfer", parts);
  }

  const setting = { ...(await readPaperSetting(admin)), part };
  const body =
    kind === "pick-list"
      ? await pickListPdf(paper, setting)
      : await transferDocumentPdf(paper, setting);
  return pdfResponse(body, transferPaperFilename(paper, kind, part));
}
