/**
 * Shop-local calendar days.
 *
 * Instants are stored and passed as UTC `Date`s. A "local date" is a
 * `YYYY-MM-DD` string in the shop's IANA time zone (`Shop.ianaTimezone`).
 * Day boundaries are resolved through `Intl`, so DST transitions (23h/25h days,
 * midnight gaps) are handled without a time-zone library. A missing or
 * unrecognized zone fails closed: there is no UTC or server-local fallback.
 */
import { AnalyticsPrerequisiteError } from "./errors";

export type LocalDate = string;

export type ShopCalendarErrorCode =
  | "local_date_invalid"
  | "range_invalid"
  | "range_too_long";

export class ShopCalendarError extends Error {
  readonly code: ShopCalendarErrorCode;

  constructor(code: ShopCalendarErrorCode, message: string) {
    super(message);
    this.name = "ShopCalendarError";
    this.code = code;
  }
}

/** Ten years of days; guards loops over caller-supplied ranges. */
export const MAX_LOCAL_RANGE_DAYS = 3660;

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      calendar: "gregory",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * Validate the shop's IANA zone. Throws `AnalyticsPrerequisiteError` when it is
 * absent or not recognized by the runtime's time-zone database.
 */
export function requireShopTimeZone(
  timeZone: string | null | undefined,
): string {
  const trimmed = timeZone?.trim();
  if (!trimmed) {
    throw new AnalyticsPrerequisiteError(
      "shop_timezone",
      "Shop time zone is not known yet; store calendar days cannot be computed",
    );
  }
  try {
    formatterFor(trimmed);
  } catch {
    throw new AnalyticsPrerequisiteError(
      "shop_timezone",
      `Shop time zone "${trimmed}" is not a recognized IANA zone`,
    );
  }
  return trimmed;
}

function parseLocalDate(value: LocalDate): {
  year: number;
  month: number;
  day: number;
} {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) {
    throw new ShopCalendarError(
      "local_date_invalid",
      `Expected a YYYY-MM-DD date, received "${value}"`,
    );
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new ShopCalendarError(
      "local_date_invalid",
      `"${value}" is not a real calendar date`,
    );
  }
  return { year, month, day };
}

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== "string") return false;
  try {
    parseLocalDate(value);
    return true;
  } catch {
    return false;
  }
}

export function assertLocalDate(value: LocalDate): LocalDate {
  parseLocalDate(value);
  return value;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

function formatUtcDate(date: Date): LocalDate {
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
}

/** The shop-local calendar date containing `instant`. */
export function localDateOf(instant: Date, timeZone: string): LocalDate {
  const ms = instant.getTime();
  if (!Number.isFinite(ms)) {
    throw new ShopCalendarError("range_invalid", "Invalid instant");
  }
  const parts = formatterFor(timeZone).formatToParts(instant);
  let year = "";
  let month = "";
  let day = "";
  for (const part of parts) {
    if (part.type === "year") year = part.value;
    else if (part.type === "month") month = part.value;
    else if (part.type === "day") day = part.value;
  }
  return `${year.padStart(4, "0")}-${month}-${day}`;
}

export function addLocalDays(date: LocalDate, days: number): LocalDate {
  if (!Number.isInteger(days)) {
    throw new ShopCalendarError("range_invalid", "Day offset must be an integer");
  }
  const { year, month, day } = parseLocalDate(date);
  return formatUtcDate(new Date(Date.UTC(year, month - 1, day + days)));
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function diffLocalDays(from: LocalDate, to: LocalDate): number {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) -
      Date.UTC(a.year, a.month - 1, a.day)) /
      MS_PER_DAY,
  );
}

export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * First UTC instant whose shop-local date is `date`.
 *
 * Local date is non-decreasing in UTC time for every real zone transition, so
 * a binary search over a window wide enough for any UTC offset (-12h..+14h)
 * plus a DST shift finds the boundary exactly, including zones where local
 * midnight does not exist on a transition day.
 */
export function startOfLocalDay(date: LocalDate, timeZone: string): Date {
  const { year, month, day } = parseLocalDate(date);
  const utcMidnight = Date.UTC(year, month - 1, day);
  let low = utcMidnight - 16 * MS_PER_HOUR;
  let high = utcMidnight + 16 * MS_PER_HOUR;
  if (localDateOf(new Date(low), timeZone) >= date) {
    throw new ShopCalendarError(
      "range_invalid",
      `Cannot resolve the start of ${date} in ${timeZone}`,
    );
  }
  if (localDateOf(new Date(high), timeZone) < date) {
    throw new ShopCalendarError(
      "range_invalid",
      `Cannot resolve the start of ${date} in ${timeZone}`,
    );
  }
  // Invariant: local(low) < date <= local(high).
  while (high - low > 1) {
    const mid = low + Math.floor((high - low) / 2);
    if (localDateOf(new Date(mid), timeZone) < date) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return new Date(high);
}

export type UtcRange = {
  /** Inclusive. */
  startUtc: Date;
  /** Exclusive. */
  endUtcExclusive: Date;
};

/** UTC instants covering the inclusive shop-local range `[start, end]`. */
export function localRangeToUtc(
  start: LocalDate,
  endInclusive: LocalDate,
  timeZone: string,
): UtcRange {
  assertLocalRange(start, endInclusive);
  return {
    startUtc: startOfLocalDay(start, timeZone),
    endUtcExclusive: startOfLocalDay(addLocalDays(endInclusive, 1), timeZone),
  };
}

export function assertLocalRange(
  start: LocalDate,
  endInclusive: LocalDate,
): number {
  const span = diffLocalDays(start, endInclusive) + 1;
  if (span < 1) {
    throw new ShopCalendarError(
      "range_invalid",
      `Range end ${endInclusive} is before start ${start}`,
    );
  }
  if (span > MAX_LOCAL_RANGE_DAYS) {
    throw new ShopCalendarError(
      "range_too_long",
      `Range of ${span} days exceeds the ${MAX_LOCAL_RANGE_DAYS}-day limit`,
    );
  }
  return span;
}

export function enumerateLocalDates(
  start: LocalDate,
  endInclusive: LocalDate,
): LocalDate[] {
  const span = assertLocalRange(start, endInclusive);
  const dates: LocalDate[] = [];
  for (let i = 0; i < span; i += 1) {
    dates.push(addLocalDays(start, i));
  }
  return dates;
}

export function isWithinLocalRange(
  date: LocalDate,
  start: LocalDate,
  endInclusive: LocalDate,
): boolean {
  return date >= start && date <= endInclusive;
}
