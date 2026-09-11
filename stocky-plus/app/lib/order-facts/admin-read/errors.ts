import type { OrderReadFailureKind } from "./types";

export class OrderFactReadWalkError extends Error {
  readonly kind: OrderReadFailureKind;

  constructor(kind: OrderReadFailureKind, detail: string) {
    super(detail);
    this.name = "OrderFactReadWalkError";
    this.kind = kind;
  }
}

export class OrderPaginationError extends OrderFactReadWalkError {
  constructor(detail: string) {
    super("SNAPSHOT_PAGINATION_INCOMPLETE", detail);
    this.name = "OrderPaginationError";
  }
}
