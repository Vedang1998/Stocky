import type { LoaderFunctionArgs } from "react-router";
import {
  handlePosApiRequest,
  parsePosLocation,
  posJson,
} from "../lib/pos/pos-api.server";
import { requireReceivingLocation } from "../lib/pos/receiving-api.server";
import { listCountableStocktakes } from "../lib/pos/stocktake-api.server";

/**
 * GET /api/pos/stocktakes?location=<POS location ID>
 *
 * Stocktakes being counted at the POS location.
 */
export const loader = async ({ request }: LoaderFunctionArgs) =>
  handlePosApiRequest(request, async ({ db }) => {
    const locationGid = requireReceivingLocation(
      parsePosLocation(new URL(request.url).searchParams.get("location")),
      "counting",
    );
    return posJson(await listCountableStocktakes(db, locationGid));
  });
