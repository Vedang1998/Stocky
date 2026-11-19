import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  PosApiError,
  handlePosApiRequest,
  parsePosLocation,
  posJson,
} from "../lib/pos/pos-api.server";
import { requireReceivingLocation } from "../lib/pos/receiving-api.server";
import { countAtPos, getCountSheet } from "../lib/pos/stocktake-api.server";

const MAX_BODY_BYTES = 16 * 1024;

async function readJsonBody(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("Content-Length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    throw new PosApiError(400, "bad_request", "The request is too large.");
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new PosApiError(400, "bad_request", "The request is too large.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new PosApiError(400, "bad_request", "The request body must be JSON.");
  }
}

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
    const body = await readJsonBody(request);
    const { unauthenticated } = await import("../shopify.server");
    return posJson(
      await countAtPos(context, params.id ?? "", locationGid, body, {
        adminFor: async (shopDomain) => (await unauthenticated.admin(shopDomain)).admin,
      }),
    );
  });
