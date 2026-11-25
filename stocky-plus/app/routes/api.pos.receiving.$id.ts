import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  PosApiError,
  handlePosApiRequest,
  parsePosLocation,
  posJson,
} from "../lib/pos/pos-api.server";
import { readPosJson } from "../lib/pos/pos-body.server";
import {
  getReceivingSheet,
  receiveAtPos,
  requireReceivingLocation,
} from "../lib/pos/receiving-api.server";

/** The body is small: at most 1000 short lines. */
const MAX_BODY_BYTES = 256 * 1024;

/**
 * GET /api/pos/receiving/:id?location=<POS location ID>
 *
 * The lines of one purchase order, with how many units each still expects.
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) =>
  handlePosApiRequest(request, async ({ db }) => {
    const locationGid = requireReceivingLocation(
      parsePosLocation(new URL(request.url).searchParams.get("location")),
    );
    return posJson(await getReceivingSheet(db, params.id ?? "", locationGid));
  });

/**
 * POST /api/pos/receiving/:id?location=<POS location ID>
 *
 * Receive a delivery. The body names the receipt (idempotencyKey) so a retry
 * after a dropped connection records it once.
 */
export const action = async ({ request, params }: ActionFunctionArgs) =>
  handlePosApiRequest(request, async (context) => {
    if (request.method !== "POST") {
      throw new PosApiError(405, "bad_request", "Use POST to receive a delivery.");
    }
    const locationGid = requireReceivingLocation(
      parsePosLocation(new URL(request.url).searchParams.get("location")),
    );
    const body = await readPosJson(request, MAX_BODY_BYTES);
    const { unauthenticated } = await import("../shopify.server");
    const result = await receiveAtPos(context, params.id ?? "", locationGid, body, {
      adminFor: async (shopDomain) => (await unauthenticated.admin(shopDomain)).admin,
    });
    return posJson(result);
  });
