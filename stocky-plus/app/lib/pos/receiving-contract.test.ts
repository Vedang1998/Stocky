import { describe, expect, it } from "vitest";
import type * as Contract from "../../../extensions/propo-pos/src/api-types";
import { matchLine } from "../../../extensions/propo-pos/src/receiving";
import { findScannedLine } from "../purchasing/receiving-scan";
import type {
  PosCountLine,
  PosCountResponse,
  PosCountSheet,
  PosStocktakeEntry,
  PosStocktakeList,
} from "./stocktake-api.server";
import type {
  PosReceiptResponse,
  PosReceivableOrder,
  PosReceivingLine,
  PosReceivingList,
  PosReceivingSheet,
} from "./receiving-api.server";

describe("POS receiving response contract", () => {
  it("matches the server types", () => {
    type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
    const contract: [
      Same<PosReceivableOrder, Contract.ReceivableOrder>,
      Same<PosReceivingList, Contract.ReceivingListResponse>,
      Same<PosReceivingLine, Contract.ReceivingLine>,
      Same<PosReceivingSheet, Contract.ReceivingSheet>,
      Same<PosReceiptResponse, Contract.ReceiptResponse>,
    ] = [true, true, true, true, true];
    expect(contract).toEqual([true, true, true, true, true]);
  });
});

describe("POS counting response contract", () => {
  it("matches the server types", () => {
    type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
    const contract: [
      Same<PosStocktakeEntry, Contract.CountableStocktake>,
      Same<PosStocktakeList, Contract.StocktakeListResponse>,
      Same<PosCountLine, Contract.CountLine>,
      Same<PosCountSheet, Contract.CountSheet>,
      Same<PosCountResponse, Contract.CountResponse>,
    ] = [true, true, true, true, true];
    expect(contract).toEqual([true, true, true, true, true]);
  });
});

describe("scanning on POS and in the admin", () => {
  const lines = [
    { lineItemId: "a", name: "A", sku: "SKU-A", barcode: "111", openQty: 1, variantGid: "v", orderedQty: 1, receivedQty: 0, pendingQty: 0, rejectedQty: 0 },
    { lineItemId: "b", name: "B", sku: "111", barcode: null, openQty: 1, variantGid: "w", orderedQty: 1, receivedQty: 0, pendingQty: 0, rejectedQty: 0 },
    { lineItemId: "c", name: "C", sku: " Mixed-Case ", barcode: " 222 ", openQty: 1, variantGid: "x", orderedQty: 1, receivedQty: 0, pendingQty: 0, rejectedQty: 0 },
  ];

  it.each(["111", "sku-a", " 222 ", "mixed-case", "missing", "", "  "])(
    "matches %j the same way",
    (code) => {
      expect(matchLine(lines, code)?.lineItemId ?? null).toBe(
        findScannedLine(lines, code)?.lineItemId ?? null,
      );
    },
  );
});
