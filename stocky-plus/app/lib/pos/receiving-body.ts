import {
  MAX_RECEIPT_LINES,
  MAX_RECEIPT_QUANTITY,
  type PostReceiptInput,
} from "../../services/purchasing/receiving.server";
import { PosApiError } from "./pos-api.server";

const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9:._-]{7,127}$/;
const MAX_REFERENCE_LENGTH = 128;
const MAX_NOTE_LENGTH = 2000;
const MAX_REASON_LENGTH = 255;

function bad(message: string, fieldErrors?: Record<string, string>): never {
  throw new PosApiError(400, "bad_request", message, fieldErrors);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function quantity(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > MAX_RECEIPT_QUANTITY
  ) {
    return bad(`${label} must be a whole number from 0 to ${MAX_RECEIPT_QUANTITY}.`);
  }
  return value;
}

function optionalText(
  value: unknown,
  label: string,
  maxLength: number,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return bad(`${label} must be text.`);
  const text = value.trim();
  if (text.length > maxLength) {
    return bad(`${label} must be ${maxLength} characters or fewer.`);
  }
  return text === "" ? null : text;
}

/**
 * Validate the JSON a POS screen sends to receive a delivery. Lines that
 * receive and reject nothing are dropped; a body with no units at all is
 * refused so an empty receipt is never recorded.
 */
export function parseReceiptBody(
  body: unknown,
  purchaseOrderId: string,
): PostReceiptInput {
  if (!isRecord(body)) return bad("The request body must be a JSON object.");

  const { idempotencyKey, lines } = body;
  if (typeof idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
    return bad("The request needs an idempotencyKey of 8 to 128 letters, digits or - _ . :");
  }
  if (!Array.isArray(lines)) return bad("lines must be a list.");
  if (lines.length > MAX_RECEIPT_LINES) {
    return bad(`A receipt can have at most ${MAX_RECEIPT_LINES} lines.`);
  }

  const seen = new Set<string>();
  const parsed: PostReceiptInput["lines"][number][] = [];
  for (const entry of lines) {
    if (!isRecord(entry)) return bad("Every line must be an object.");
    const { lineItemId } = entry;
    if (typeof lineItemId !== "string" || lineItemId === "" || lineItemId.length > 64) {
      return bad("Every line needs a lineItemId.");
    }
    if (seen.has(lineItemId)) return bad("A line appears twice.");
    seen.add(lineItemId);

    const acceptedQty = quantity(entry.acceptedQty ?? 0, "Received");
    const rejectedQty = quantity(entry.rejectedQty ?? 0, "Rejected");
    if (acceptedQty === 0 && rejectedQty === 0) continue;
    parsed.push({
      lineItemId,
      acceptedQty,
      rejectedQty,
      rejectReason: optionalText(entry.rejectReason, "Reason", MAX_REASON_LENGTH),
    });
  }
  if (parsed.length === 0) return bad("Enter at least one unit to receive or reject.");

  if (body.allowOverReceipt !== undefined && typeof body.allowOverReceipt !== "boolean") {
    return bad("allowOverReceipt must be true or false.");
  }

  return {
    purchaseOrderId,
    idempotencyKey,
    lines: parsed,
    supplierReference: optionalText(body.supplierReference, "Packing slip number", MAX_REFERENCE_LENGTH),
    note: optionalText(body.note, "Note", MAX_NOTE_LENGTH),
    allowOverReceipt: body.allowOverReceipt === true,
  };
}
