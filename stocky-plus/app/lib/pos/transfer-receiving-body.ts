import { MAX_TRANSFER_LINE_QUANTITY } from "../../services/transfers/transfer-quantities";
import { PosApiError } from "./pos-api.server";

const MAX_CODE_LENGTH = 191;
const MAX_ID_LENGTH = 64;

export type PosTransferReceiveRequest =
  | { intent: "scan"; code: string; quantity: number }
  | { intent: "set"; lineId: string; quantity: number }
  | { intent: "post" };

function bad(message: string): never {
  throw new PosApiError(400, "bad_request", message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function wholeNumber(value: unknown, min: number): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > MAX_TRANSFER_LINE_QUANTITY
  ) {
    return bad(
      `Quantity must be a whole number from ${min} to ${MAX_TRANSFER_LINE_QUANTITY}.`,
    );
  }
  return value;
}

/** Validate the JSON a POS screen sends to receive a transfer. */
export function parseTransferReceiveBody(body: unknown): PosTransferReceiveRequest {
  if (!isRecord(body)) return bad("The request body must be a JSON object.");

  if (body.intent === "scan") {
    const { code } = body;
    const trimmed = typeof code === "string" ? code.trim() : "";
    if (trimmed === "") return bad("Scan or type a barcode or SKU.");
    if (trimmed.includes("\u0000")) return bad("That code is not valid.");
    if (trimmed.length > MAX_CODE_LENGTH) return bad("That code is too long.");
    return {
      intent: "scan",
      code: trimmed,
      quantity: body.quantity === undefined ? 1 : wholeNumber(body.quantity, 1),
    };
  }

  if (body.intent === "set") {
    const { lineId } = body;
    if (
      typeof lineId !== "string" ||
      lineId === "" ||
      lineId.length > MAX_ID_LENGTH ||
      lineId.includes("\u0000")
    ) {
      return bad("A count needs a lineId.");
    }
    return {
      intent: "set",
      lineId,
      quantity: wholeNumber(body.quantity, 0),
    };
  }

  if (body.intent === "post") return { intent: "post" };

  return bad('intent must be "scan", "set" or "post".');
}
