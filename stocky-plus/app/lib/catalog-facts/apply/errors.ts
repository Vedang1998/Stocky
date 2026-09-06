/**
 * Canonical apply errors. Callers MUST ROLLBACK the tenant transaction
 * after any of these (the PostgreSQL transaction may already be aborted
 * for lock-timeout).
 */

export class CanonicalApplyError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CanonicalApplyError";
    this.code = code;
  }
}

export class CanonicalApplyMissingTokenError extends CanonicalApplyError {
  constructor(message = "Canonical apply missing observation token fails closed") {
    super("canonical_apply_missing_token", message);
    this.name = "CanonicalApplyMissingTokenError";
  }
}

export class CanonicalApplyLeaseInvalidError extends CanonicalApplyError {
  constructor(message = "Observation lease is invalid at the fact fence") {
    super("canonical_apply_lease_invalid", message);
    this.name = "CanonicalApplyLeaseInvalidError";
  }
}

export class CanonicalApplyAbandonedTokenError extends CanonicalApplyError {
  constructor(message = "Abandoned observation token cannot apply") {
    super("canonical_apply_abandoned_token", message);
    this.name = "CanonicalApplyAbandonedTokenError";
  }
}

export class CanonicalApplyRequestGenerationMismatchError extends CanonicalApplyError {
  constructor(
    message = "Observation token does not bind to the supplied observationRequestGen",
  ) {
    super("canonical_apply_request_generation_mismatch", message);
    this.name = "CanonicalApplyRequestGenerationMismatchError";
  }
}

export class CanonicalApplyExistenceKindError extends CanonicalApplyError {
  constructor(kind: string) {
    super(
      "canonical_apply_existence_kind_forbidden",
      `Existence kind ${kind} is not an approved applicator input`,
    );
    this.name = "CanonicalApplyExistenceKindError";
  }
}

export class CanonicalApplyBatchExceedsCapacityError extends CanonicalApplyError {
  readonly effectiveCanonicalIdentitiesPerTransaction: number;
  readonly requested: number;

  constructor(requested: number, effective: number) {
    super(
      "canonical_apply_batch_exceeds_capacity",
      `Canonical apply batch of ${requested} identities exceeds effective cap ${effective}`,
    );
    this.name = "CanonicalApplyBatchExceedsCapacityError";
    this.effectiveCanonicalIdentitiesPerTransaction = effective;
    this.requested = requested;
  }
}

export class CanonicalApplyUniqueConflictError extends CanonicalApplyError {
  constructor(message = "Unique conflict despite advisory anchor; retry full apply") {
    super("canonical_apply_unique_conflict", message);
    this.name = "CanonicalApplyUniqueConflictError";
  }
}

export class CanonicalApplyMoneyError extends CanonicalApplyError {
  constructor(message: string) {
    super("canonical_apply_money_unsafe", message);
    this.name = "CanonicalApplyMoneyError";
  }
}

export class CanonicalApplyPhysicalDeleteError extends CanonicalApplyError {
  constructor() {
    super(
      "canonical_apply_physical_delete_forbidden",
      "Canonical apply APIs provide no physical-delete operation (R-164)",
    );
    this.name = "CanonicalApplyPhysicalDeleteError";
  }
}

export class CanonicalApplyNumericScaleError extends CanonicalApplyError {
  readonly field: string;

  constructor(field: string, value?: string) {
    super(
      "canonical_apply_numeric_scale_unrepresentable",
      value
        ? `${field} is not exactly representable on DECIMAL(20,6) without rounding (${value})`
        : `${field} is not exactly representable on DECIMAL(20,6) without rounding`,
    );
    this.name = "CanonicalApplyNumericScaleError";
    this.field = field;
  }
}

export class CanonicalApplyIncompleteFirstLiveError extends CanonicalApplyError {
  readonly missing: readonly string[];

  constructor(missing: readonly string[]) {
    super(
      "canonical_apply_incomplete_first_live",
      `First LIVE canonical insert lacks required authoritative attributes: ${missing.join(", ")}`,
    );
    this.name = "CanonicalApplyIncompleteFirstLiveError";
    this.missing = missing;
  }
}

export class CanonicalApplyIncompleteAuthoritativeAttributesError extends CanonicalApplyError {
  readonly missing: readonly string[];

  constructor(missing: readonly string[]) {
    super(
      "canonical_apply_incomplete_authoritative_attributes",
      `Authoritative resource attributes are incomplete: ${missing.join(", ")}`,
    );
    this.name = "CanonicalApplyIncompleteAuthoritativeAttributesError";
    this.missing = missing;
  }
}

export class CanonicalApplyQuantityDomainError extends CanonicalApplyError {
  readonly field: string;

  constructor(field: string, value?: unknown) {
    super(
      "canonical_apply_quantity_domain_unrepresentable",
      value === undefined
        ? `${field} is not a PostgreSQL integer quantity`
        : `${field} is not a PostgreSQL integer quantity (${String(value)})`,
    );
    this.name = "CanonicalApplyQuantityDomainError";
    this.field = field;
  }
}
