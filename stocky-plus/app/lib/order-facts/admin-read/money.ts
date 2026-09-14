/**
 * MoneyBag mapping for PR6-B. Exact decimal strings. Never Number/parseFloat.
 * Required vs optional bags follow A's ORDER_REQUIRED_MONEY_BAGS /
 * ORDER_OPTIONAL_MONEY_BAGS. Do not redefine those tables.
 */

import type { MoneyBagSides } from "../types";
import {
  requireDecimalString,
  requireNonEmptyString,
} from "./decimal";
import { OrderFactReadWalkError } from "./errors";

type MoneyV2Node = {
  amount?: unknown;
  currencyCode?: unknown;
};

type MoneyBagNode = {
  shopMoney?: MoneyV2Node | null;
  presentmentMoney?: MoneyV2Node | null;
} | null;

function moneyV2Side(
  node: MoneyV2Node | null | undefined,
  field: string,
): { amount: string; currencyCode: string } {
  if (node == null || typeof node !== "object") {
    throw new OrderFactReadWalkError(
      "MALFORMED_MONEY",
      `${field} is missing MoneyV2`,
    );
  }
  if (typeof node.amount === "number") {
    throw new OrderFactReadWalkError(
      "MALFORMED_MONEY",
      `${field}.amount arrived as Number; exact decimal string required`,
    );
  }
  return {
    amount: requireDecimalString(node.amount, `${field}.amount`),
    currencyCode: requireNonEmptyString(
      node.currencyCode,
      `${field}.currencyCode`,
    ),
  };
}

export function requireMoneyBag(
  value: unknown,
  field: string,
  orderCurrencyCode: string,
): MoneyBagSides {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new OrderFactReadWalkError(
      "MALFORMED_MONEY",
      `${field} is a required MoneyBag and is missing or malformed`,
    );
  }
  const bag = value as MoneyBagNode;
  let shop: { amount: string; currencyCode: string };
  let presentment: { amount: string; currencyCode: string };
  try {
    shop = moneyV2Side(bag?.shopMoney ?? null, `${field}.shopMoney`);
    presentment = moneyV2Side(
      bag?.presentmentMoney ?? null,
      `${field}.presentmentMoney`,
    );
  } catch (error) {
    if (error instanceof OrderFactReadWalkError) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    throw new OrderFactReadWalkError("MALFORMED_MONEY", detail);
  }
  if (shop.currencyCode !== orderCurrencyCode) {
    throw new OrderFactReadWalkError(
      "MONEY_CURRENCY_MISMATCH",
      `${field}.shopMoney.currencyCode ${shop.currencyCode} does not match order currencyCode ${orderCurrencyCode}`,
    );
  }
  return {
    shopAmount: shop.amount,
    shopCurrencyCode: shop.currencyCode,
    presentmentAmount: presentment.amount,
    presentmentCurrencyCode: presentment.currencyCode,
  };
}

export function optionalMoneyBag(
  value: unknown,
  field: string,
  orderCurrencyCode: string,
): MoneyBagSides | null {
  if (value == null) return null;
  return requireMoneyBag(value, field, orderCurrencyCode);
}
