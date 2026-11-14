/**
 * What a purchasing route action returns, and the one place a command's
 * PurchasingError becomes a message on the page. Anything else a command
 * throws is a defect and is left to the route error boundary.
 */
import type { FieldErrors, FormReader } from "../../lib/purchasing/form-input";
import { PurchasingError } from "./errors";

export type PurchasingActionResult =
  | { ok: true; intent: string; notice: string }
  | { ok: false; intent: string; error: string; fieldErrors: FieldErrors };

export const FIX_FIELDS_MESSAGE = "Fix the highlighted fields and try again.";

export const STALE_PAGE_MESSAGE =
  "This page is out of date. Reload it and try again.";

const MAX_VERSION = 2_147_483_647;

export function actionFailure(
  intent: string,
  error: string,
  fieldErrors: FieldErrors = {},
): PurchasingActionResult {
  return { ok: false, intent, error, fieldErrors };
}

/** The failure for a form whose reader recorded field errors. */
export function invalidForm(
  intent: string,
  form: FormReader,
): PurchasingActionResult {
  return actionFailure(intent, FIX_FIELDS_MESSAGE, form.errors);
}

/** The purchase-order version the page was rendered from, or null when absent. */
export function readExpectedVersion(form: FormData): number | null {
  const value = form.get("version");
  if (typeof value !== "string" || !/^\d{1,10}$/.test(value)) return null;
  const version = Number(value);
  return version >= 1 && version <= MAX_VERSION ? version : null;
}

/**
 * Run a command for a form intent. The command returns the confirmation to
 * show, a result it built itself, or a Response (a redirect) to send instead.
 */
export async function purchasingAction(
  intent: string,
  command: () => Promise<string | PurchasingActionResult | Response>,
): Promise<PurchasingActionResult | Response> {
  try {
    const outcome = await command();
    return typeof outcome === "string"
      ? { ok: true, intent, notice: outcome }
      : outcome;
  } catch (error) {
    if (error instanceof PurchasingError) {
      return actionFailure(intent, error.message, error.fieldErrors);
    }
    throw error;
  }
}
