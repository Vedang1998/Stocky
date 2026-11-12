/**
 * The form intents of the purchase-order page and the receiving page. Each
 * intent parses its fields strictly, runs one command and reports the outcome
 * the page shows; lifecycle and quantity rules live in the commands.
 */
import { redirect } from "react-router";
import { FormReader } from "../../lib/purchasing/form-input";
import { UNIT_COST_SCALE } from "../../lib/purchasing/decimal";
import type { PurchaseOrderAction } from "../../lib/purchasing/status";
import type { ExecuteInventoryOperationOptions } from "../inventory-writes/execute.server";
import type { InventoryActor } from "../inventory-writes/types";
import {
  actionFailure,
  FIX_FIELDS_MESSAGE,
  invalidForm,
  purchasingAction,
  readExpectedVersion,
  STALE_PAGE_MESSAGE,
  type PurchasingActionResult,
} from "./action-result.server";
import type { PurchasingContext } from "./actor.server";
import { PurchasingError } from "./errors";
import {
  addPurchaseOrderLines,
  deletePurchaseOrderDraft,
  duplicatePurchaseOrder,
  MAX_LINE_UNIT_COST,
  MAX_ORDER_QUANTITY,
  parseChargesForm,
  parseLineUpdateForm,
  parsePurchaseOrderHeaderForm,
  removePurchaseOrderLine,
  replacePurchaseOrderCharges,
  setLineCancelledQuantity,
  transitionPurchaseOrder,
  updatePurchaseOrderHeader,
  updatePurchaseOrderLine,
} from "./purchase-orders.server";
import {
  getReceivingWorksheet,
  listPurchaseOrderReceipts,
  MAX_RECEIPT_QUANTITY,
  postPurchaseOrderReceipt,
  resumePurchaseOrderReceipt,
  reversePurchaseOrderReceipt,
  type ReceiptLineInput,
  type ReceivingResult,
} from "./receiving.server";
import { readShopProfile } from "./shop-profile.server";

type ActionContext = Pick<
  PurchasingContext,
  "admin" | "db" | "actor" | "inventoryActor"
>;

const TRANSITIONS: Record<Exclude<PurchaseOrderAction, "delete">, string> = {
  markSent: "Marked as sent.",
  markOrdered: "Marked as ordered.",
  cancel: "Purchase order cancelled.",
  close: "Purchase order closed.",
  archive: "Purchase order archived.",
  unarchive: "Purchase order unarchived.",
};

/**
 * Receiving refuses a request that names no staff member, after it has
 * checked that receiving is switched on, so the page shows the right reason.
 */
function stockActor(context: ActionContext): InventoryActor {
  return (
    context.inventoryActor ?? {
      shopifyUserId: null,
      displayName: null,
      channel: "ADMIN",
    }
  );
}

function isTransition(
  intent: string,
): intent is Exclude<PurchaseOrderAction, "delete"> {
  return Object.hasOwn(TRANSITIONS, intent);
}

function readId(form: FormReader, name: string, label: string): string | null {
  return form.text(name, { required: true, maxLength: 64, label });
}

function receivingOutcome(
  intent: string,
  result: ReceivingResult,
): PurchasingActionResult {
  return result.complete
    ? { ok: true, intent, notice: result.message }
    : actionFailure(intent, result.message);
}

async function receiptOnOrder(
  context: ActionContext,
  purchaseOrderId: string,
  receiptId: string,
): Promise<boolean> {
  const receipts = await listPurchaseOrderReceipts(context.db, purchaseOrderId);
  return receipts.some((receipt) => receipt.id === receiptId);
}

/** `stock` reaches the inventory ledger unchanged; tests use it to stand in for Shopify. */
export async function runPurchaseOrderIntent(
  context: ActionContext,
  purchaseOrderId: string,
  formData: FormData,
  stock: ExecuteInventoryOperationOptions = {},
): Promise<PurchasingActionResult | Response> {
  const { admin, db, actor } = context;
  const form = new FormReader(formData);
  const intent = form.raw("intent") ?? "";

  if (intent === "duplicate") {
    return purchasingAction(intent, async () => {
      const copy = await duplicatePurchaseOrder(db, actor, purchaseOrderId);
      return redirect(`/app/purchase-orders/${copy.id}`);
    });
  }

  if (intent === "resumeReceipt" || intent === "reverseReceipt") {
    const receiptId = readId(form, "receiptId", "Receipt");
    const note = form.text("note", { maxLength: 2000, label: "Reason" });
    if (!form.ok || !receiptId) return invalidForm(intent, form);
    if (!(await receiptOnOrder(context, purchaseOrderId, receiptId))) {
      return actionFailure(intent, "Receipt was not found.");
    }
    return purchasingAction(intent, async () =>
      receivingOutcome(
        intent,
        intent === "resumeReceipt"
          ? await resumePurchaseOrderReceipt(db, admin, receiptId, stock)
          : await reversePurchaseOrderReceipt(
              db,
              admin,
              stockActor(context),
              { receiptId, note },
              stock,
            ),
      ),
    );
  }

  const version = readExpectedVersion(formData);
  if (version === null) return actionFailure(intent, STALE_PAGE_MESSAGE);

  if (isTransition(intent)) {
    return purchasingAction(intent, async () => {
      const needsToday = intent === "markSent" || intent === "markOrdered";
      const today = needsToday ? (await readShopProfile(admin)).today : null;
      await transitionPurchaseOrder(
        db,
        actor,
        purchaseOrderId,
        version,
        intent,
        {
          admin,
          today,
        },
      );
      return TRANSITIONS[intent];
    });
  }

  switch (intent) {
    case "delete":
      return purchasingAction(intent, async () => {
        await deletePurchaseOrderDraft(db, actor, purchaseOrderId, version);
        return redirect("/app/purchase-orders?view=draft");
      });

    case "saveDetails": {
      const input = parsePurchaseOrderHeaderForm(form);
      if (!input) return invalidForm(intent, form);
      return purchasingAction(intent, async () => {
        await updatePurchaseOrderHeader(
          db,
          actor,
          purchaseOrderId,
          version,
          input,
          { admin },
        );
        return "Details saved.";
      });
    }

    case "addLine": {
      const variantGid = form.text("variantGid", {
        required: true,
        maxLength: 256,
        label: "Product",
      });
      const quantity = form.integer("quantity", {
        required: true,
        min: 1,
        max: MAX_ORDER_QUANTITY,
        label: "Quantity",
      });
      const unitCost = form.decimal("unitCost", {
        scale: UNIT_COST_SCALE,
        min: 0,
        max: MAX_LINE_UNIT_COST,
        label: "Unit cost",
      });
      if (!form.ok || !variantGid || quantity === null) {
        // Search results are separate forms, so the reason goes in the banner.
        return actionFailure(
          intent,
          Object.values(form.errors)[0] ?? STALE_PAGE_MESSAGE,
        );
      }
      return purchasingAction(intent, async () => {
        const result = await addPurchaseOrderLines(
          db,
          actor,
          purchaseOrderId,
          version,
          [{ variantGid, quantity, unitCost }],
          { admin },
        );
        const added =
          result.merged > 0
            ? "The product was already on the order, so its quantity was increased."
            : "Product added.";
        return result.missingCostVariantGids.length > 0
          ? `${added} No cost is on file for it; enter the unit cost on the line.`
          : added;
      });
    }

    case "saveLine": {
      const lineId = readId(form, "lineId", "Line");
      const input = parseLineUpdateForm(form);
      if (!input || !lineId) return invalidForm(intent, form);
      return purchasingAction(intent, async () => {
        await updatePurchaseOrderLine(
          db,
          actor,
          purchaseOrderId,
          version,
          lineId,
          input,
        );
        return "Line saved.";
      });
    }

    case "removeLine": {
      const lineId = readId(form, "lineId", "Line");
      if (!lineId) return invalidForm(intent, form);
      return purchasingAction(intent, async () => {
        await removePurchaseOrderLine(
          db,
          actor,
          purchaseOrderId,
          version,
          lineId,
        );
        return "Line removed.";
      });
    }

    case "cancelUnits": {
      const lineId = readId(form, "lineId", "Line");
      const cancelledQty = form.integer("cancelledQty", {
        required: true,
        min: 0,
        max: MAX_ORDER_QUANTITY,
        label: "Cancelled units",
      });
      if (!form.ok || !lineId || cancelledQty === null) {
        return invalidForm(intent, form);
      }
      return purchasingAction(intent, async () => {
        await setLineCancelledQuantity(
          db,
          actor,
          purchaseOrderId,
          version,
          lineId,
          cancelledQty,
        );
        return cancelledQty === 0
          ? "No units are cancelled on the line now."
          : "Cancelled units saved.";
      });
    }

    case "saveCharges": {
      const input = parseChargesForm(form);
      if (!input) return invalidForm(intent, form);
      return purchasingAction(intent, async () => {
        await replacePurchaseOrderCharges(
          db,
          actor,
          purchaseOrderId,
          version,
          input,
        );
        return "Charges saved.";
      });
    }

    default:
      return actionFailure(intent, "That action is not available.");
  }
}

export type ReceiveDeliveryResult =
  | {
      ok: true;
      notice: string;
      /** Set when the receipt is recorded but Shopify has not confirmed all of it. */
      warning: string | null;
      /** Units now in stock per variant, for printing labels. */
      received: Array<{ variantGid: string; units: number }>;
    }
  | {
      ok: false;
      error: string;
      fieldErrors: Record<string, string>;
      /** The submission key to reuse, so a corrected retry is the same submission. */
      idempotencyKey: string | null;
    };

/**
 * The receiving page's submission: `accepted-<lineId>`, `rejected-<lineId>`
 * and `reason-<lineId>` for each line of the order.
 */
export async function receiveDelivery(
  context: ActionContext,
  purchaseOrderId: string,
  formData: FormData,
  stock: ExecuteInventoryOperationOptions = {},
): Promise<ReceiveDeliveryResult> {
  const { admin, db } = context;
  const form = new FormReader(formData);
  const idempotencyKey = form.text("idempotencyKey", {
    required: true,
    maxLength: 128,
    label: "Form key",
  });
  const failure = (
    error: string,
    fieldErrors: Record<string, string> = {},
  ): ReceiveDeliveryResult => ({
    ok: false,
    error,
    fieldErrors,
    idempotencyKey,
  });
  if (!idempotencyKey) return failure(STALE_PAGE_MESSAGE);

  try {
    const worksheet = await getReceivingWorksheet(db, purchaseOrderId);
    const lines: ReceiptLineInput[] = [];
    for (const line of worksheet.lines) {
      const acceptedQty = form.integer(`accepted-${line.lineItemId}`, {
        min: 0,
        max: MAX_RECEIPT_QUANTITY,
        label: "Received",
      });
      const rejectedQty = form.integer(`rejected-${line.lineItemId}`, {
        min: 0,
        max: MAX_RECEIPT_QUANTITY,
        label: "Rejected",
      });
      const rejectReason = form.text(`reason-${line.lineItemId}`, {
        maxLength: 255,
        label: "Reason",
      });
      if ((acceptedQty ?? 0) > 0 || (rejectedQty ?? 0) > 0) {
        lines.push({
          lineItemId: line.lineItemId,
          acceptedQty: acceptedQty ?? 0,
          rejectedQty: rejectedQty ?? 0,
          rejectReason,
        });
      }
    }
    const supplierReference = form.text("supplierReference", {
      maxLength: 128,
      label: "Packing slip number",
    });
    const note = form.text("note", { maxLength: 2000, label: "Note" });
    if (!form.ok) {
      return failure(FIX_FIELDS_MESSAGE, form.errors);
    }

    const result = await postPurchaseOrderReceipt(
      db,
      admin,
      stockActor(context),
      {
        purchaseOrderId,
        idempotencyKey,
        lines,
        supplierReference,
        note,
        allowOverReceipt: form.checkbox("allowOverReceipt"),
      },
      stock,
    );
    if (result.receipt === null) return failure(result.message);
    const received = result.receipt.lines
      .filter((line) => line.postedQty > 0)
      .map((line) => ({
        variantGid: line.shopifyVariantId,
        units: line.postedQty,
      }));
    return result.complete
      ? { ok: true, notice: result.message, warning: null, received }
      : {
          ok: true,
          notice: `Receipt ${result.receipt.receiptNumber} recorded.`,
          warning: result.message,
          received,
        };
  } catch (error) {
    if (!(error instanceof PurchasingError)) throw error;
    return failure(error.message, receiptFieldErrors(error.fieldErrors));
  }
}

/** The service keys line errors as `line:<id>`; the page's field is `accepted-<id>`. */
function receiptFieldErrors(
  fieldErrors: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([key, message]) => [
      key.startsWith("line:") ? `accepted-${key.slice("line:".length)}` : key,
      message,
    ]),
  );
}
