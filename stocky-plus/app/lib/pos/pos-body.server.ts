import { readBoundedRequest } from "../http/bounded-request.server";
import { PosApiError } from "./pos-api.server";

/**
 * Read a POS request's JSON body, refusing anything over `maxBytes` before
 * it is held in memory. A body that is too large or is not JSON becomes a
 * 400 the extension can show.
 */
export async function readPosJson(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  let bounded: Request;
  try {
    bounded = await readBoundedRequest(request, maxBytes);
  } catch (error) {
    if (error instanceof Response && error.status === 413) {
      throw new PosApiError(400, "bad_request", "The request is too large.");
    }
    throw error;
  }
  try {
    return await bounded.json();
  } catch {
    throw new PosApiError(400, "bad_request", "The request body must be JSON.");
  }
}
