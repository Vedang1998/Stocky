import type { LoaderFunctionArgs } from "react-router";
import {
  handlePosApiRequest,
  parsePosLocation,
  posJson,
} from "../lib/pos/pos-api.server";
import {
  listReceivableOrders,
  requireReceivingLocation,
} from "../lib/pos/receiving-api.server";

const MAX_SEARCH_LENGTH = 100;

/**
 * GET /api/pos/receiving?location=<POS location ID>&search=<text>
 *
 * Purchase orders on their way to the POS location, ready to receive.
 */
export const loader = async ({ request }: LoaderFunctionArgs) =>
  handlePosApiRequest(request, async ({ db }) => {
    const url = new URL(request.url);
    const locationGid = requireReceivingLocation(
      parsePosLocation(url.searchParams.get("location")),
    );
    const search = url.searchParams.get("search")?.trim().slice(0, MAX_SEARCH_LENGTH);
    return posJson(await listReceivableOrders(db, locationGid, search || null));
  });
