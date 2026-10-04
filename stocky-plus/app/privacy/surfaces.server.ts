import { CHILD_MERCHANT_MODELS, DIRECT_MERCHANT_MODELS } from "../tenant/models";

/** Child-first physical deletion order. Shop root is finalizer-owned. */
export const PRIVACY_MERCHANT_DELETE_ORDER: readonly string[] = [
  ...CHILD_MERCHANT_MODELS,
  ...DIRECT_MERCHANT_MODELS,
];

/**
 * Customer-redact physical delete is topic-scoped: proven children, then
 * enumerated orders, then matching audit. Whole-shop tables are not in scope.
 */
export const CUSTOMER_REDACT_DELETE_ORDER: readonly string[] = [
  "ShopifyOrderLineFact",
  "ShopifyOrderFact",
  "AuditEvent",
];
