import type { LoaderFunctionArgs } from "react-router";
import {
  handlePosApiRequest,
  parsePosLocation,
  posJson,
} from "../lib/pos/pos-api.server";
import { listReceivableTransfers, requireTransferLocation } from "../lib/pos/transfer-receiving-api.server";

/**
 * GET /api/pos/transfers?location=<POS location ID>
 *
 * Transfers in transit to the POS location, ready to be received.
 */
export const loader = async ({ request }: LoaderFunctionArgs) =>
  handlePosApiRequest(request, async ({ db }) => {
    const locationGid = requireTransferLocation(
      parsePosLocation(new URL(request.url).searchParams.get("location")),
    );
    return posJson(await listReceivableTransfers(db, locationGid));
  });
