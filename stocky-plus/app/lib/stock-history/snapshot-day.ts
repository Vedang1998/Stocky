/**
 * Which calendar day a shop's daily stock snapshot is due for.
 *
 * A snapshot is the stock a shop closed a day with, so it is taken once that
 * day has ended in the shop's own time zone and only for a short while after:
 * stock read many hours later is no longer what the day closed with, and a
 * missing day is easier to explain than a wrong one.
 */
import {
  addLocalDays,
  localDateOf,
  startOfLocalDay,
  type LocalDate,
} from "../analytics/shop-calendar";

/** How long after a day has ended its closing stock may still be captured. */
export const CAPTURE_WINDOW_MS = 6 * 60 * 60_000;

/** Days of history kept per shop, counted back from the newest captured day. */
export const RETENTION_DAYS = 400;

export type SnapshotDay = {
  /** The shop-local day that has just ended. */
  localDate: LocalDate;
  /** The instant that day ended: the first instant of the next local day. */
  dayEndedAt: Date;
};

/**
 * The day whose closing stock can be captured at `now`, or null when the last
 * finished day ended longer ago than the capture window.
 */
export function snapshotDayDue(now: Date, timeZone: string): SnapshotDay | null {
  const today = localDateOf(now, timeZone);
  const dayEndedAt = startOfLocalDay(today, timeZone);
  if (now.getTime() - dayEndedAt.getTime() > CAPTURE_WINDOW_MS) return null;
  return { localDate: addLocalDays(today, -1), dayEndedAt };
}

/** The oldest day kept once `newest` has been captured. */
export function oldestRetainedDate(newest: LocalDate): LocalDate {
  return addLocalDays(newest, -(RETENTION_DAYS - 1));
}
