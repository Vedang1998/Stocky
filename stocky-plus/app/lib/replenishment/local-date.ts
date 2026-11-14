/**
 * Calendar arithmetic on shop-local dates ("YYYY-MM-DD").
 *
 * These values are already in the shop's IANA calendar; converting an instant
 * to a local date is the caller's job. Arithmetic runs on UTC midnights so no
 * DST transition can shift a day.
 */

export type LocalDate = string;

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

function toUtcMs(date: LocalDate): number {
  const match = LOCAL_DATE_PATTERN.exec(date);
  if (!match) {
    throw new RangeError(`Invalid local date "${date}" (expected YYYY-MM-DD)`);
  }
  const [, y, m, d] = match;
  const ms = Date.UTC(Number(y), Number(m) - 1, Number(d));
  if (fromUtcMs(ms) !== date) {
    throw new RangeError(`Invalid calendar date "${date}"`);
  }
  return ms;
}

function fromUtcMs(ms: number): LocalDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== "string") return false;
  try {
    toUtcMs(value);
    return true;
  } catch {
    return false;
  }
}

export function addDays(date: LocalDate, days: number): LocalDate {
  if (!Number.isInteger(days)) {
    throw new RangeError("addDays expects an integer day count");
  }
  return fromUtcMs(toUtcMs(date) + days * MS_PER_DAY);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

/** Number of calendar days in the inclusive range. */
export function inclusiveDayCount(start: LocalDate, end: LocalDate): number {
  return daysBetween(start, end) + 1;
}

/**
 * Same month and day `years` earlier or later. 29 February maps to
 * 28 February in a non-leap target year, so the result never spills into March.
 */
export function addYears(date: LocalDate, years: number): LocalDate {
  if (!Number.isInteger(years)) {
    throw new RangeError("addYears expects an integer year count");
  }
  const source = new Date(toUtcMs(date));
  const year = source.getUTCFullYear() + years;
  const month = source.getUTCMonth();
  const lastDayOfTargetMonth = new Date(
    Date.UTC(year, month + 1, 0),
  ).getUTCDate();
  const day = Math.min(source.getUTCDate(), lastDayOfTargetMonth);
  return fromUtcMs(Date.UTC(year, month, day));
}

export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return toUtcMs(a) - toUtcMs(b);
}
