/**
 * Order-fact apply errors. Callers MUST ROLLBACK the tenant transaction
 * after any of these (the PostgreSQL transaction may already be aborted
 * for lock-timeout).
 */

export class OrderApplyError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "OrderApplyError";
    this.code = code;
  }
}

export class OrderApplyMissingTokenError extends OrderApplyError {
  constructor(message = "Order apply missing observation token fails closed") {
    super("order_apply_missing_token", message);
    this.name = "OrderApplyMissingTokenError";
  }
}

export class OrderApplyLeaseInvalidError extends OrderApplyError {
  constructor(message = "Observation lease is invalid at the fact fence") {
    super("order_apply_lease_invalid", message);
    this.name = "OrderApplyLeaseInvalidError";
  }
}

export class OrderApplyAbandonedTokenError extends OrderApplyError {
  constructor(message = "Abandoned observation token cannot apply") {
    super("order_apply_abandoned_token", message);
    this.name = "OrderApplyAbandonedTokenError";
  }
}

export class OrderApplyRequestGenerationMismatchError extends OrderApplyError {
  constructor(
    message = "Observation token does not bind to the supplied observationRequestGen",
  ) {
    super("order_apply_request_generation_mismatch", message);
    this.name = "OrderApplyRequestGenerationMismatchError";
  }
}

export class OrderApplyExistenceKindError extends OrderApplyError {
  constructor(kind: string) {
    super(
      "order_apply_existence_kind_forbidden",
      `Existence kind ${kind} is not an approved applicator input`,
    );
    this.name = "OrderApplyExistenceKindError";
  }
}

export class OrderApplyBatchExceedsCapacityError extends OrderApplyError {
  readonly effectiveCanonicalIdentitiesPerTransaction: number;
  readonly requested: number;

  constructor(requested: number, effective: number) {
    super(
      "order_apply_batch_exceeds_capacity",
      `Order apply batch of ${requested} identities exceeds effective cap ${effective}`,
    );
    this.name = "OrderApplyBatchExceedsCapacityError";
    this.effectiveCanonicalIdentitiesPerTransaction = effective;
    this.requested = requested;
  }
}

export class OrderApplyUniqueConflictError extends OrderApplyError {
  constructor(
    message = "Unique conflict despite advisory anchor; retry full apply",
  ) {
    super("order_apply_unique_conflict", message);
    this.name = "OrderApplyUniqueConflictError";
  }
}

export class OrderApplyMoneyError extends OrderApplyError {
  constructor(message: string) {
    super("order_apply_money_unsafe", message);
    this.name = "OrderApplyMoneyError";
  }
}

export class OrderApplyPhysicalDeleteError extends OrderApplyError {
  constructor() {
    super(
      "order_apply_physical_delete_forbidden",
      "Order apply APIs provide no physical-delete operation (R-164)",
    );
    this.name = "OrderApplyPhysicalDeleteError";
  }
}

export class OrderApplyNumericScaleError extends OrderApplyError {
  readonly field: string;

  constructor(field: string, value?: string) {
    super(
      "order_apply_numeric_scale_unrepresentable",
      value
        ? `${field} is not exactly representable on DECIMAL(20,6) without rounding (${value})`
        : `${field} is not exactly representable on DECIMAL(20,6) without rounding`,
    );
    this.name = "OrderApplyNumericScaleError";
    this.field = field;
  }
}

export class OrderApplyIncompleteSnapshotError extends OrderApplyError {
  constructor(message = "Snapshot pagination is incomplete; no canonical apply") {
    super("order_apply_snapshot_incomplete", message);
    this.name = "OrderApplyIncompleteSnapshotError";
  }
}

export class OrderApplyClientShopDeniedError extends OrderApplyError {
  constructor() {
    super(
      "order_apply_client_shop_denied",
      "Client-supplied shop identity cannot set or override the tenant",
    );
    this.name = "OrderApplyClientShopDeniedError";
  }
}

export class OrderApplyProcessingDisabledError extends OrderApplyError {
  constructor() {
    super(
      "order_apply_processing_disabled",
      "Shop processing is disabled; fail closed before merchant DML",
    );
    this.name = "OrderApplyProcessingDisabledError";
  }
}

export class OrderApplyReceiptDigestConflictError extends OrderApplyError {
  constructor() {
    super(
      "order_apply_receipt_digest_conflict",
      "SyncApplicationReceipt exists with a different payload digest",
    );
    this.name = "OrderApplyReceiptDigestConflictError";
  }
}

export class OrderApplyCurrencyMismatchError extends OrderApplyError {
  constructor(field: string) {
    super(
      "order_apply_currency_mismatch",
      `Required money bag ${field} shop currency does not match the order shop currency`,
    );
    this.name = "OrderApplyCurrencyMismatchError";
  }
}
