import { describe, expect, it } from "vitest";
import {
  assertCanPerform,
  canEditCommercialTerms,
  canEditHeader,
  canEditLines,
  canPerform,
  isIncoming,
  isPurchaseOrderStatus,
  nextStatusFor,
  PURCHASE_ORDER_STATUSES,
  PurchaseOrderStateError,
  receivingDenial,
  statusAfterReceiving,
  type LifecycleState,
  type PurchaseOrderAction,
  type PurchaseOrderStatus,
} from "./status";

function state(
  status: PurchaseOrderStatus,
  overrides: Partial<LifecycleState> = {},
): LifecycleState {
  return {
    status,
    archived: false,
    hasReceipts: status === "PARTIAL" || status === "RECEIVED" || status === "CLOSED",
    ...overrides,
  };
}

function allowedFrom(action: PurchaseOrderAction): PurchaseOrderStatus[] {
  return PURCHASE_ORDER_STATUSES.filter((status) =>
    canPerform(state(status), action),
  );
}

describe("purchase order lifecycle", () => {
  it("allows each action only from its documented statuses", () => {
    expect(allowedFrom("markSent")).toEqual(["DRAFT", "SENT", "ORDERED", "PARTIAL"]);
    expect(allowedFrom("markOrdered")).toEqual(["DRAFT", "SENT"]);
    expect(allowedFrom("cancel")).toEqual(["DRAFT", "SENT", "ORDERED"]);
    expect(allowedFrom("close")).toEqual(["PARTIAL", "RECEIVED"]);
    expect(allowedFrom("archive")).toEqual(["RECEIVED", "CLOSED", "CANCELLED"]);
    expect(allowedFrom("delete")).toEqual(["DRAFT"]);
    expect(allowedFrom("unarchive")).toEqual([]);
  });

  it("refuses to reopen a cancelled purchase order by marking it ordered", () => {
    expect(() => assertCanPerform(state("CANCELLED"), "markOrdered")).toThrow(
      new PurchaseOrderStateError(
        "A cancelled purchase order cannot be marked as ordered.",
      ),
    );
    expect(canPerform(state("CANCELLED"), "markSent")).toBe(false);
  });

  it("refuses to cancel a purchase order that has been received", () => {
    for (const status of ["PARTIAL", "RECEIVED", "CLOSED"] as const) {
      expect(canPerform(state(status), "cancel")).toBe(false);
    }
    expect(() => assertCanPerform(state("RECEIVED"), "cancel")).toThrow(
      "Stock has already been received on this purchase order. Close it instead of cancelling.",
    );
  });

  it("refuses to cancel once any stock is received, even if the status lags", () => {
    expect(canPerform(state("ORDERED", { hasReceipts: true }), "cancel")).toBe(false);
  });

  it("never moves a purchase order into a received status", () => {
    const actions: PurchaseOrderAction[] = [
      "markSent",
      "markOrdered",
      "cancel",
      "close",
      "archive",
      "unarchive",
      "delete",
    ];
    for (const status of PURCHASE_ORDER_STATUSES) {
      for (const action of actions) {
        const next = nextStatusFor(status, action);
        if (next !== status) {
          expect(["PARTIAL", "RECEIVED"]).not.toContain(next);
        }
      }
    }
  });

  it("re-sending keeps the status and only the first send leaves draft", () => {
    expect(nextStatusFor("DRAFT", "markSent")).toBe("SENT");
    expect(nextStatusFor("ORDERED", "markSent")).toBe("ORDERED");
    expect(nextStatusFor("PARTIAL", "markSent")).toBe("PARTIAL");
    expect(nextStatusFor("SENT", "markOrdered")).toBe("ORDERED");
    expect(nextStatusFor("ORDERED", "cancel")).toBe("CANCELLED");
    expect(nextStatusFor("PARTIAL", "close")).toBe("CLOSED");
    expect(nextStatusFor("RECEIVED", "archive")).toBe("RECEIVED");
  });

  it("only deletes drafts", () => {
    expect(canPerform(state("DRAFT"), "delete")).toBe(true);
    expect(() => assertCanPerform(state("SENT"), "delete")).toThrow(
      "Only draft purchase orders can be deleted. Cancel it instead.",
    );
  });

  it("makes an archived purchase order read-only until it is unarchived", () => {
    const archived = state("RECEIVED", { archived: true });

    expect(canPerform(archived, "unarchive")).toBe(true);
    expect(canPerform(archived, "close")).toBe(false);
    expect(canPerform(archived, "archive")).toBe(false);
    expect(() => assertCanPerform(archived, "close")).toThrow(
      "Archived purchase orders are read-only. Unarchive it first.",
    );
    expect(canEditHeader(archived)).toBe(false);
    expect(canEditLines(archived)).toBe(false);
    expect(canEditCommercialTerms(archived)).toBe(false);
  });
});

describe("purchase order edit gates", () => {
  it("fixes destination, currency and charges once receiving starts", () => {
    expect(canEditCommercialTerms(state("ORDERED"))).toBe(true);
    expect(canEditCommercialTerms(state("ORDERED", { hasReceipts: true }))).toBe(false);
    expect(canEditCommercialTerms(state("PARTIAL"))).toBe(false);
    expect(canEditCommercialTerms(state("CANCELLED"))).toBe(false);
  });

  it("lets lines change until the purchase order is received in full", () => {
    expect(canEditLines(state("PARTIAL"))).toBe(true);
    for (const status of ["RECEIVED", "CLOSED", "CANCELLED"] as const) {
      expect(canEditLines(state(status))).toBe(false);
    }
  });

  it("keeps header notes and dates editable except on cancelled orders", () => {
    expect(canEditHeader(state("CLOSED"))).toBe(true);
    expect(canEditHeader(state("CANCELLED"))).toBe(false);
  });
});

describe("status helpers", () => {
  it("counts sent, ordered and partially received orders as incoming", () => {
    expect(PURCHASE_ORDER_STATUSES.filter(isIncoming)).toEqual([
      "SENT",
      "ORDERED",
      "PARTIAL",
    ]);
  });

  it("recognises only known statuses", () => {
    expect(isPurchaseOrderStatus("ORDERED")).toBe(true);
    expect(isPurchaseOrderStatus("ordered")).toBe(false);
    expect(isPurchaseOrderStatus("__proto__")).toBe(false);
  });
});

describe("receiving", () => {
  const line = (orderedQty: number, receivedQty: number, cancelledQty = 0) => ({
    orderedQty,
    receivedQty,
    cancelledQty,
  });

  it("is open on sent, ordered and partially received orders only", () => {
    for (const status of PURCHASE_ORDER_STATUSES) {
      const open = ["SENT", "ORDERED", "PARTIAL"].includes(status);
      expect(receivingDenial(state(status)) === null, status).toBe(open);
    }
    expect(receivingDenial(state("DRAFT"))).toMatch(/Send this purchase order/);
    expect(receivingDenial(state("CANCELLED"))).toBe(
      "A cancelled purchase order cannot be received.",
    );
    expect(receivingDenial(state("ORDERED", { archived: true }))).toMatch(
      /Archived/,
    );
  });

  it("moves an open order to partial, then received", () => {
    expect(statusAfterReceiving("ORDERED", [line(10, 4), line(6, 0)], true)).toBe("PARTIAL");
    expect(statusAfterReceiving("SENT", [line(10, 10), line(6, 5)], false)).toBe("PARTIAL");
    expect(statusAfterReceiving("PARTIAL", [line(10, 10), line(6, 6)], true)).toBe("RECEIVED");
  });

  it("treats cancelled and over-received units as nothing left to receive", () => {
    expect(statusAfterReceiving("PARTIAL", [line(10, 7, 3), line(6, 8)], true)).toBe("RECEIVED");
    expect(statusAfterReceiving("ORDERED", [line(10, 10), line(6, 0, 6)], true)).toBe("RECEIVED");
  });

  it("does not call an order received when nothing was", () => {
    expect(statusAfterReceiving("ORDERED", [line(10, 0), line(6, 0)], true)).toBe("ORDERED");
    expect(statusAfterReceiving("SENT", [line(10, 0, 10)], false)).toBe("SENT");
  });

  it("reopens the order when receipts are reversed", () => {
    expect(statusAfterReceiving("RECEIVED", [line(10, 4), line(6, 6)], true)).toBe("PARTIAL");
    expect(statusAfterReceiving("RECEIVED", [line(10, 0)], true)).toBe("ORDERED");
    expect(statusAfterReceiving("PARTIAL", [line(10, 0)], false)).toBe("SENT");
  });

  it("leaves draft, closed and cancelled orders alone", () => {
    for (const status of ["DRAFT", "CLOSED", "CANCELLED"] as const) {
      expect(statusAfterReceiving(status, [line(10, 10)], true)).toBe(status);
    }
  });
});
