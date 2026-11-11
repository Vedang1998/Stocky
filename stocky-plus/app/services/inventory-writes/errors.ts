/** Input that can never become a valid Shopify inventory write. */
export class InventoryOperationValidationError extends Error {
  readonly code = "INVENTORY_OPERATION_INVALID" as const;

  constructor(
    message: string,
    readonly issues: readonly string[] = [message],
  ) {
    super(message);
    this.name = "InventoryOperationValidationError";
  }
}

/** The idempotency key was already used for a different payload. */
export class InventoryOperationConflictError extends Error {
  readonly code = "INVENTORY_OPERATION_KEY_REUSED" as const;

  constructor(
    readonly idempotencyKey: string,
    readonly existingOperationId: string,
  ) {
    super(
      `Idempotency key "${idempotencyKey}" was already used for a different inventory change.`,
    );
    this.name = "InventoryOperationConflictError";
  }
}

/** The document an operation belongs to stopped accepting stock changes. */
export class InventoryDocumentClosedError extends Error {
  readonly code = "INVENTORY_DOCUMENT_CLOSED" as const;

  constructor(readonly source: { type: string; id: string }) {
    super(`${source.type} ${source.id} no longer accepts inventory changes.`);
    this.name = "InventoryDocumentClosedError";
  }
}

export class InventoryOperationNotFoundError extends Error {
  readonly code = "INVENTORY_OPERATION_NOT_FOUND" as const;

  constructor(readonly operationId: string) {
    super("Inventory operation not found");
    this.name = "InventoryOperationNotFoundError";
  }
}

/** The caller may not perform this inventory write. */
export class InventoryPermissionError extends Error {
  readonly code = "INVENTORY_PERMISSION_DENIED" as const;

  constructor(message: string) {
    super(message);
    this.name = "InventoryPermissionError";
  }
}
