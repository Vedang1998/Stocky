import type { FieldErrors } from "../../lib/replenishment/form";
import type { VariantRuleValues } from "../../lib/replenishment/rules.server";
import type { ParityMethod, SuggestionResult } from "../../lib/replenishment/types";
import type { WorksheetColumn } from "../../lib/replenishment/worksheet/columns";
import type { CreatedOrder } from "../../lib/replenishment/worksheet/orders.server";

/** What the worksheet page's action returns, by the form that was submitted. */
export type WorksheetActionResult =
  | {
      intent: "setQuantity";
      lineId: string;
      ok: true;
      finalQuantity: number | null;
      orderQuantity: number;
    }
  | { intent: "setQuantity"; lineId: string; ok: false; message: string }
  | { intent: "preview"; lineId: string; ok: true; suggestion: SuggestionResult }
  | { intent: "preview"; lineId: string; ok: false; errors: FieldErrors; message?: string }
  | { intent: "createOrders"; ok: true; orders: CreatedOrder[] }
  | { intent: "createOrders"; ok: false; message: string }
  | { intent: "saveColumns"; ok: true; columns: WorksheetColumn[] }
  | { intent: "saveColumns"; ok: false; message: string };

/** Starting values for the "try another period" form in a row's detail. */
export type PreviewFormValues = {
  method: ParityMethod;
  sampleDays: string;
  suggestDays: string;
  startDate: string;
  endDate: string;
  targetQuantity: string;
};

/** A variant's stored planning levels, as the levels route returns them. */
export type LevelsLoaderResult =
  | { ok: true; values: VariantRuleValues }
  | { ok: false; message: string };

/** The result of saving a variant's planning levels. */
export type LevelsActionResult =
  | { ok: true; outcome: "saved" | "cleared" }
  | { ok: false; errors: FieldErrors; message?: string };
