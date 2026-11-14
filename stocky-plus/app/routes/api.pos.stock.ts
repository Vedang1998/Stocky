import type { LoaderFunctionArgs } from "react-router";
import {
  PosApiError,
  handlePosApiRequest,
  parsePosLocation,
  parseVariantGid,
  posJson,
} from "../lib/pos/pos-api.server";
import { findLiveVariant } from "../services/barcode-lookup.server";
import { getVariantStock } from "../services/stock-lookup.server";

/**
 * GET /api/pos/stock?variant=<ProductVariant GID>&location=<POS location ID>
 *
 * Stock by location for one variant, e.g. after the operator picks one of
 * several candidates for an ambiguous scan.
 */
export const loader = async ({ request }: LoaderFunctionArgs) =>
  handlePosApiRequest(request, async ({ db }) => {
    const url = new URL(request.url);
    const variantGid = parseVariantGid(url.searchParams.get("variant"));
    const preferredLocationGid = parsePosLocation(url.searchParams.get("location"));

    const variant = await findLiveVariant(db, variantGid);
    if (!variant) {
      throw new PosApiError(404, "not_found", "This product is not in the synced catalog.");
    }
    const stock = await getVariantStock(db, variantGid, { preferredLocationGid });
    return posJson({ variant, stock });
  });
