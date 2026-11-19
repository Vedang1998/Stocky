import { MAX_COUNTED_QUANTITY } from "../../services/stocktakes/stocktake-limits";
import { PosApiError } from "./pos-api.server";

const MAX_CODE_LENGTH = 191;

export type PosCountRequest =
  | { intent: "scan"; code: string; quantity: number }
  | { intent: "count"; lineId: string; countedQty: number | null };

function bad(message: string): never {
  throw new PosApiError(400, "bad_request", message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function wholeNumber(value: unknown, min: number, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > MAX_COUNTED_QUANTITY
  ) {
    return bad(`${label} must be a whole number from ${min} to ${MAX_COUNTED_QUANTITY}.`);
  }
  return value;
}

/** Validate the JSON a POS screen sends to count stock in a stocktake. */
export function parseCountBody(body: unknown): PosCountRequest {
  if (!isRecord(body)) return bad("The request body must be a JSON object.");

  if (body.intent === "scan") {
    const { code } = body;
    if (typeof code !== "string" || code.trim() === "") {
      return bad("Scan or type a barcode or SKU.");
    }
    if (code.trim().length > MAX_CODE_LENGTH) return bad("That code is too long.");
    return {
      intent: "scan",
      code: code.trim(),
      quantity: body.quantity === undefined ? 1 : wholeNumber(body.quantity, 1, "Quantity"),
    };
  }

  if (body.intent === "count") {
    const { lineId } = body;
    if (typeof lineId !== "string" || lineId === "" || lineId.length > 64) {
      return bad("A count needs a lineId.");
    }
    return {
      intent: "count",
      lineId,
      countedQty:
        body.countedQty === null ? null : wholeNumber(body.countedQty, 0, "Counted quantity"),
    };
  }

  return bad('intent must be "scan" or "count".');
}
