import type { LoaderFunctionArgs } from "react-router";
import {
  PosApiError,
  handlePosApiRequest,
  parsePosLocation,
  posJson,
} from "../lib/pos/pos-api.server";
import { resolveScannedCode } from "../services/barcode-lookup.server";
import { getVariantStock } from "../services/stock-lookup.server";

/** Raw input bound; normalization enforces the real code length limit. */
const MAX_RAW_CODE_LENGTH = 1024;

/**
 * GET /api/pos/scan?code=<scanned>&location=<POS location ID>
 *
 * Resolves a scanned or typed code to a variant and, when it is a single
 * match, returns its stock by location with the POS location first.
 */
export const loader = async ({ request }: LoaderFunctionArgs) =>
  handlePosApiRequest(request, async ({ db }) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    if (code === null) {
      throw new PosApiError(400, "bad_request", "code is required");
    }
    if (code.length > MAX_RAW_CODE_LENGTH) {
      throw new PosApiError(400, "bad_request", "code is too long");
    }
    const preferredLocationGid = parsePosLocation(url.searchParams.get("location"));

    const resolution = await resolveScannedCode(db, code);
    const stock =
      resolution.status === "matched"
        ? await getVariantStock(db, resolution.variant.variantGid, {
            preferredLocationGid,
          })
        : null;

    return posJson({ resolution, stock });
  });
