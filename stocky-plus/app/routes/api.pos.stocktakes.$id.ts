import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  PosApiError,
  handlePosApiRequest,
  parsePosLocation,
  posJson,
} from "../lib/pos/pos-api.server";
import { readPosJson } from "../lib/pos/pos-body.server";
import { requireReceivingLocation } from "../lib/pos/receiving-api.server";
import { countAtPos, getCountSheet } from "../lib/pos/stocktake-api.server";

const MAX_BODY_BYTES = 16 * 1024;

/**
 * GET /api/pos/stocktakes/:id?location=<POS location ID>
 *
 * Progress of one count and the items counted so far. Expected quantities
 * are never included.
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) =>
  handlePosApiRequest(request, async ({ db }) => {
    const locationGid = requireReceivingLocation(
      parsePosLocation(new URL(request.url).searchParams.get("location")),
    );
    return posJson(await getCountSheet(db, params.id ?? "", locationGid));
  });

/**
 * POST /api/pos/stocktakes/:id?location=<POS location ID>
 *
 * `{ "intent": "scan", "code": "...", "quantity": 1 }` adds units to an
 * item's count; `{ "intent": "count", "lineId": "...", "countedQty": 5 }`
 * sets it, or clears it with null.
 */
export const action = async ({ request, params }: ActionFunctionArgs) =>
  handlePosApiRequest(request, async (context) => {
    if (request.method !== "POST") {
      throw new PosApiError(405, "bad_request", "Use POST to count.");
    }
    const locationGid = requireReceivingLocation(
      parsePosLocation(new URL(request.url).searchParams.get("location")),
    );
    const body = await readPosJson(request, MAX_BODY_BYTES);
    const { unauthenticated } = await import("../shopify.server");
    return posJson(
      await countAtPos(context, params.id ?? "", locationGid, body, {
        adminFor: async (shopDomain) => (await unauthenticated.admin(shopDomain)).admin,
      }),
    );
  });
