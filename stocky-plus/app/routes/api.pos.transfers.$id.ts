import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  PosApiError,
  handlePosApiRequest,
  parsePosLocation,
  posJson,
} from "../lib/pos/pos-api.server";
import { readPosJson } from "../lib/pos/pos-body.server";
import {
  getTransferReceiveSheet,
  requireTransferLocation,
  receiveTransferAtPos,
} from "../lib/pos/transfer-receiving-api.server";

const MAX_BODY_BYTES = 16 * 1024;

/**
 * GET /api/pos/transfers/:id?location=<POS location ID>
 *
 * One transfer in transit to the POS location: its totals and the lines with
 * units still to receive.
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) =>
  handlePosApiRequest(request, async ({ db }) => {
    const locationGid = requireTransferLocation(
      parsePosLocation(new URL(request.url).searchParams.get("location")),
    );
    return posJson(await getTransferReceiveSheet(db, params.id ?? "", locationGid));
  });

/**
 * POST /api/pos/transfers/:id?location=<POS location ID>
 *
 * `{ "intent": "scan", "code": "...", "quantity": 1 }` counts units in,
 * `{ "intent": "set", "lineId": "...", "quantity": 5 }` sets a line's count,
 * `{ "intent": "post" }` adds the counted-in units to stock here.
 */
export const action = async ({ request, params }: ActionFunctionArgs) =>
  handlePosApiRequest(request, async (context) => {
    if (request.method !== "POST") {
      throw new PosApiError(405, "bad_request", "Use POST to receive a transfer.");
    }
    const locationGid = requireTransferLocation(
      parsePosLocation(new URL(request.url).searchParams.get("location")),
    );
    const body = await readPosJson(request, MAX_BODY_BYTES);
    const { unauthenticated } = await import("../shopify.server");
    return posJson(
      await receiveTransferAtPos(context, params.id ?? "", locationGid, body, {
        adminFor: async (shopDomain) => (await unauthenticated.admin(shopDomain)).admin,
      }),
    );
  });
