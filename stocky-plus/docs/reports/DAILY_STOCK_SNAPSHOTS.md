# Daily stock snapshots

The stored history behind historical stock on hand (F-098). Shopify does not
serve inventory levels for a past date, so the app keeps its own copy: once a
day, per shop, the stock the shop closed the day with.

Code: `app/lib/stock-history/`, loop in `app/jobs/workers/daily-stock-snapshots.ts`.

## What a snapshot is

| Table | One row per | Holds |
| --- | --- | --- |
| `DailyStockSnapshot` | shop and calendar day | `localDate`, the time zone used, when the day ended, when it was captured, number of levels |
| `DailyStockLevel` | shop, day, variant and location | available, on hand, cost per item and price as they were at capture |

- `localDate` is a `YYYY-MM-DD` day in the shop's own time zone
  (`Shop.ianaTimezone`), never UTC or the server's zone. The zone used is
  stored on the snapshot, so a later change of the shop's zone does not
  relabel old days.
- The rows are the ones the Stock on hand report lists
  (`METRIC_DEFINITIONS.md` §9.3): live, active inventory levels of tracked
  items whose variant, product and location exist. A quantity Shopify had not
  reported is stored as null, not zero.
- Cost and price are copied at capture, so a report on a past date can value
  stock at that day's cost and price instead of today's.
- Quantities are the app's Shopify facts at `capturedAt`. They are as fresh as
  the sync was at that moment.

## When a day is captured

The worker looks at every shop every ten minutes
(`STOCKY_STOCK_SNAPSHOT_INTERVAL_MS`, `0` turns it off). A shop's day is
captured when all of these hold:

1. The day has ended in the shop's time zone, no more than six hours ago.
   Stock read later than that is no longer what the day closed with.
2. The shop's time zone is known.
3. The first import of locations, catalog and inventory levels has finished.
4. The day has no snapshot yet.

A day is written in one statement: whole or not at all, and once. A second
worker, a retry or a restart writes nothing for a day that is already there.

## Reading it

- A day **with** a `DailyStockSnapshot` row was captured. `levelCount` 0 means
  the shop had no tracked stock that day.
- A day **without** a row was not captured: it is before the shop's first
  snapshot, or the worker was not running during that day's six-hour window,
  or the shop was not ready (rules 2 and 3). Say so; do not show zeros and do
  not substitute another day.
- `capturedAt − dayEndedAt` is how long after midnight the stock was read.
- Read through `TenantDb` (`db.dailyStockSnapshot`, `db.dailyStockLevel`),
  filtering by `localDate`.

## Limits

- History starts the day after this ships for each shop. Earlier days cannot
  be reconstructed.
- 400 days are kept per shop, counted back from the newest captured day. Older
  days are deleted when a new day is captured.
- Rows are never updated; the database refuses it
  (`stocky_daily_stock_history_guard`). They leave through retention or shop
  erasure.
- Capture is not tied to a plan. Whether a shop may see the report is the
  report's decision.
- Size: one level row per tracked variant and location per day. A shop with
  2,000 tracked variants at 2 locations stores about 1.6 million rows over
  400 days.
