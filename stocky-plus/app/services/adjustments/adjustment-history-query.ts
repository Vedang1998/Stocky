import type { AdjustmentCursor } from "./adjustment.server";

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const CURSOR_SEPARATOR = "~";
const MAX_OPERATION_ID_LENGTH = 64;

/**
 * A calendar day typed into a date field, as the UTC instant it starts or
 * ends. null for anything that is not a real date.
 */
export function parseUtcDay(
  value: string | null,
  edge: "start" | "end",
): Date | null {
  const match = value ? DAY.exec(value) : null;
  if (!match) return null;
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const start = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC rolls 2026-02-31 over into March; such a value is not a date.
  if (
    start.getUTCFullYear() !== year ||
    start.getUTCMonth() !== month - 1 ||
    start.getUTCDate() !== day
  ) {
    return null;
  }
  return edge === "start"
    ? start
    : new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
}

export function formatAdjustmentCursor(cursor: AdjustmentCursor): string {
  return `${cursor.createdAt.toISOString()}${CURSOR_SEPARATOR}${cursor.operationId}`;
}

export function parseAdjustmentCursor(
  value: string | null,
): AdjustmentCursor | null {
  if (!value) return null;
  const at = value.indexOf(CURSOR_SEPARATOR);
  if (at === -1) return null;
  const createdAt = new Date(value.slice(0, at));
  const operationId = value.slice(at + 1);
  if (
    Number.isNaN(createdAt.getTime()) ||
    operationId === "" ||
    operationId.length > MAX_OPERATION_ID_LENGTH
  ) {
    return null;
  }
  return { createdAt, operationId };
}

export interface AdjustmentHistoryQuery {
  /** The day strings as given, for filling the filter fields back in. */
  fromDay: string;
  toDay: string;
  from: Date | null;
  to: Date | null;
  after: AdjustmentCursor | null;
}

/** The history filter carried in a page or export URL. Bad values are dropped. */
export function readAdjustmentHistoryQuery(
  params: URLSearchParams,
): AdjustmentHistoryQuery {
  const from = parseUtcDay(params.get("from"), "start");
  const to = parseUtcDay(params.get("to"), "end");
  return {
    fromDay: from ? (params.get("from") ?? "") : "",
    toDay: to ? (params.get("to") ?? "") : "",
    from,
    to,
    after: parseAdjustmentCursor(params.get("after")),
  };
}
