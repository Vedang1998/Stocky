import type {
  OrderReadFailureKind,
  OrderReadIssueExtras,
  OrderReadPhase,
  OrderReadResourceKind,
} from "./types";

const MAX_DETAIL_CHARS = 512;

export function boundReadDetail(detail: string): string {
  const compact = detail.replace(/\s+/g, " ").trim();
  if (compact.length <= MAX_DETAIL_CHARS) return compact;
  return `${compact.slice(0, MAX_DETAIL_CHARS - 1)}…`;
}

export class OrderFactReadWalkError extends Error {
  readonly kind: OrderReadFailureKind;
  readonly resourceKind: OrderReadResourceKind | null;
  readonly requestedGid: string | null;
  readonly phase: OrderReadPhase | undefined;
  readonly reason: OrderReadFailureKind;

  constructor(
    kind: OrderReadFailureKind,
    detail: string,
    extras: OrderReadIssueExtras = {},
  ) {
    super(boundReadDetail(detail));
    this.name = "OrderFactReadWalkError";
    this.kind = kind;
    this.reason = kind;
    this.resourceKind = extras.resourceKind ?? null;
    this.requestedGid = extras.requestedGid ?? null;
    this.phase = extras.phase;
  }
}

export class OrderPaginationError extends OrderFactReadWalkError {
  constructor(detail: string, extras: OrderReadIssueExtras = {}) {
    super("SNAPSHOT_PAGINATION_INCOMPLETE", detail, extras);
    this.name = "OrderPaginationError";
  }
}
