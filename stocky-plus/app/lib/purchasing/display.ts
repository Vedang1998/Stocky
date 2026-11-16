/**
 * Date display for purchasing pages. The locale is fixed and the time zone is
 * passed in, so the server render and the browser produce the same text.
 */

const LOCALE = "en-US";
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-11-20" as "Nov 20, 2026"; an empty value as an em dash. */
export function formatDay(value: string | null | undefined): string {
  if (!value || !CALENDAR_DAY.test(value)) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: "UTC",
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00Z`));
}

/**
 * A moment in the shop's time zone, such as "Nov 20, 2026, 3:04 PM". Without a
 * usable time zone the time is shown in UTC and labelled as such.
 */
export function formatMoment(
  value: Date | string,
  timeZone: string | null | undefined,
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  const format = (zone: string) =>
    new Intl.DateTimeFormat(LOCALE, {
      timeZone: zone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  if (timeZone) {
    try {
      return format(timeZone);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
    }
  }
  return `${format("UTC")} UTC`;
}
