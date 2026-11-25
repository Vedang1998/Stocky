/**
 * Times as the shop's clock shows them, for the stocktake, adjustment and
 * transfer pages, their papers and their CSV reports.
 *
 * The zone is the shop's IANA time zone as Shopify gave it. Until it is known
 * (a shop whose first sync has not finished), or when this runtime does not
 * know the zone, times are given in UTC and say so; no zone is ever guessed.
 * The locale is fixed and the zone is passed in, so the server render and the
 * browser produce the same text.
 */

const formatters = new Map<string, Intl.DateTimeFormat | null>();

function formatterFor(
  key: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat | null {
  let formatter = formatters.get(key);
  if (formatter === undefined) {
    try {
      formatter = new Intl.DateTimeFormat("en-US", options);
    } catch (error) {
      // A zone name this runtime does not know.
      if (!(error instanceof RangeError)) throw error;
      formatter = null;
    }
    formatters.set(key, formatter);
  }
  return formatter;
}

/** The zone when this runtime can tell the time in it; otherwise null. */
export function usableTimeZone(
  timeZone: string | null | undefined,
): string | null {
  const zone = timeZone?.trim();
  if (!zone) return null;
  return formatterFor(`check:${zone}`, { timeZone: zone }) ? zone : null;
}

function instantOf(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function partsOf(
  formatter: Intl.DateTimeFormat,
  date: Date,
): Record<string, string> {
  return Object.fromEntries(
    formatter.formatToParts(date).map(({ type, value }) => [type, value]),
  );
}

function utcStamp(date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

/**
 * A moment for a person to read: "Nov 10, 2026, 3:45 PM EST" on the shop's
 * clock, or "2026-11-10 20:45 UTC" without a usable zone. Empty for no moment.
 */
export function formatShopTime(
  value: Date | string | null | undefined,
  timeZone: string | null | undefined,
): string {
  const date = instantOf(value);
  if (!date) return "";
  const zone = usableTimeZone(timeZone);
  const formatter = zone
    ? formatterFor(`read:${zone}`, {
        timeZone: zone,
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : null;
  if (!formatter) return `${utcStamp(date)} UTC`;
  // Put together from its parts: the separators a runtime writes between
  // them differ from one to the next, and the page must read the same from
  // the server and in the browser.
  const part = partsOf(formatter, date);
  return `${part.month} ${part.day}, ${part.year}, ${part.hour}:${part.minute} ${part.dayPeriod} ${part.timeZoneName}`;
}

/**
 * A moment for a spreadsheet column: "2026-11-10 15:45" on the shop's clock,
 * or in UTC without a usable zone. The column's heading says which
 * (`timeColumn`). Sorts as text in time order, except across the hour that
 * repeats when clocks go back.
 */
export function shopTimeStamp(
  value: Date | string | null | undefined,
  timeZone: string | null | undefined,
): string {
  const date = instantOf(value);
  if (!date) return "";
  const zone = usableTimeZone(timeZone);
  const formatter = zone
    ? formatterFor(`stamp:${zone}`, {
        timeZone: zone,
        calendar: "gregory",
        numberingSystem: "latn",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
    : null;
  if (!formatter) return utcStamp(date);
  const part = partsOf(formatter, date);
  return `${part.year}-${part.month}-${part.day} ${part.hour}:${part.minute}`;
}

/** A column heading that names the clock its times are on: "Shipped at (America/Toronto)". */
export function timeColumn(
  label: string,
  timeZone: string | null | undefined,
): string {
  return `${label} (${usableTimeZone(timeZone) ?? "UTC"})`;
}

/**
 * A moment as a spreadsheet cell under a `timeColumn` heading: a stamp on the
 * shop's clock, or, without a usable zone, the instant itself, which the CSV
 * writer prints as an ISO time in UTC.
 */
export function shopTimeCell(
  value: Date | null | undefined,
  timeZone: string | null | undefined,
): string | Date | null {
  if (!value) return null;
  return usableTimeZone(timeZone) ? shopTimeStamp(value, timeZone) : value;
}

/** The calendar day of a moment, "2026-11-10": the shop's day, or the UTC day without a usable zone. */
export function shopDay(
  value: Date,
  timeZone: string | null | undefined,
): string {
  return shopTimeStamp(value, timeZone).slice(0, 10);
}
