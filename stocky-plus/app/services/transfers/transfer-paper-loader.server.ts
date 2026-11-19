/**
 * What the two transfer paper routes share: find the shop's transfer, read
 * how the shop is named and what its clock says, and answer with the PDF of
 * the part asked for (`?part=2`; a transfer of up to 250 items has one part).
 */
import type { LoaderFunctionArgs } from "react-router";
import { noSuchPartResponse, pdfResponse } from "../../lib/pdf/document.server";
import { pdfPartCount, readPdfPart } from "../../lib/pdf/parts";
import { requireAdminTenant } from "../../tenant/require-admin-tenant.server";
import { readFormId } from "../inventory-writes/form-values";
import { readShopProfile } from "../purchasing/shop-profile.server";
import type { AdminGraphQLClient } from "../shopify-gql.server";
import {
  pickListPdf,
  readTransferPaper,
  transferDocumentPdf,
  transferPaperFilename,
} from "./transfer-documents.server";

export type TransferPaperKind = "document" | "pick-list";

function plainText(text: string, status: number): Response {
  return new Response(text, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * The shop's name and time zone from Shopify. A paper still prints when
 * Shopify does not answer: it then carries no shop name and gives times in
 * UTC. A response thrown on the way (a sign-in bounce) is passed on.
 */
async function readPaperSetting(
  admin: AdminGraphQLClient,
): Promise<{ shopName: string | null; timeZone: string | null }> {
  try {
    const profile = await readShopProfile(admin);
    return { shopName: profile.name, timeZone: profile.ianaTimezone };
  } catch (thrown) {
    if (thrown instanceof Response) throw thrown;
    return { shopName: null, timeZone: null };
  }
}

export async function loadTransferPaper(
  { request, params }: LoaderFunctionArgs,
  kind: TransferPaperKind,
): Promise<Response> {
  const { admin, db } = await requireAdminTenant({ request, params });
  const transferId = readFormId(params.id);
  const paper = transferId ? await readTransferPaper(db, transferId) : null;
  if (!paper) return plainText("Transfer not found", 404);
  if (kind === "pick-list" && paper.transfer.status !== "DRAFT") {
    return plainText(
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
