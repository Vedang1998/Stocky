import { CHILD_MERCHANT_MODELS, DIRECT_MERCHANT_MODELS } from "../tenant/models";

/** Child-first physical deletion order. Shop root is finalizer-owned. */
export const PRIVACY_MERCHANT_DELETE_ORDER: readonly string[] = [
  ...CHILD_MERCHANT_MODELS,
  ...DIRECT_MERCHANT_MODELS,
];
