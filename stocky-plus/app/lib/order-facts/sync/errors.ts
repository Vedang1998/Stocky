export class OrderFactsSyncError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "OrderFactsSyncError";
    this.code = code;
  }
}

export class OrderFactsIdentityError extends OrderFactsSyncError {
  constructor(message: string) {
    super("order_facts_identity_invalid", message);
    this.name = "OrderFactsIdentityError";
  }
}

export class OrderFactsSchemaDispatchError extends OrderFactsSyncError {
  constructor(message: string) {
    super("order_facts_schema_unrecognized", message);
    this.name = "OrderFactsSchemaDispatchError";
  }
}

export class OrderFactsBulkDisabledError extends OrderFactsSyncError {
  constructor(message: string) {
    super("order_facts_bulk_disabled", message);
    this.name = "OrderFactsBulkDisabledError";
  }
}

export class OrderFactsJsonlError extends OrderFactsSyncError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "OrderFactsJsonlError";
  }
}

export class OrderFactsScopeError extends OrderFactsSyncError {
  constructor(message: string) {
    super("order_facts_scope_untrusted", message);
    this.name = "OrderFactsScopeError";
  }
}
