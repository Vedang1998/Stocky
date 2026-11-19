# Smart Forecast

Status: forecasting engine and backtest (`app/lib/smart-forecast/`), plus a
Smart Forecast panel in the worksheet row detail on the worksheet branch. The
panel reaches main with the worksheet rebuild, after the analytics foundation
(#88) and plan entitlements (#111).

Product sources: `docs/product/01_EXECUTIVE_PRODUCT_DIRECTION.md` (Smart
mode), `02_FULL_STOCKY_PARITY_PRD.md` §3.4 (Smart mode),
`06_ROADMAP_AND_RELEASE_GATES.md` (AI gate) and
`11_PRICING_AND_PACKAGING_STRATEGY.md` (Smart Forecasting is a Pro
capability, entitlement key `forecast.smart`).

## Rules

1. **Never changes a parity result.** Smart Forecast is advice shown beside
   the Stocky Parity suggestion, clearly labelled. The parity engine in
   `app/lib/replenishment` does not import this module.
2. **Chosen only on evidence.** Every model is backtested on the variant's own
   history. One replaces the recent average only when it cut the average's
   error by at least 10% and its forecasts leaned no more than 20% high or
   low. Otherwise the recent average is kept, and the merchant is told why.
3. **Deterministic.** Only addition, subtraction, multiplication and
   division; the same history always gives the same forecast. No language
   model is called, so there is no AI cost and no AI credit use.
4. **Explained.** Every result carries the error and lean of each model, the
   number of past periods tested, the range actual demand ran in against the
   chosen forecast, and sentences saying what was decided.

## Models

| Model | What it does | History needed |
|---|---|---|
| Recent average (`PARITY_AVERAGE`) | Units over the sales period ÷ its days, as Stocky does. The baseline every other model must beat. | the sales period |
| Same weekday, recent weeks (`SEASONAL_NAIVE_WEEKLY`) | Each future day is the average of the same weekday over the last four weeks. | 28 days |
| Recent average with trend (`TREND_BLEND`) | Half the recent level, half a least-squares line over the last eight weeks, never below zero. | 56 days |
| Occasional sales (`CROSTON_SBA`) | Croston's method with the Syntetos–Boylan correction: smooths sale size and the gap between sales separately (α = 0.1). | 56 days |

## Backtest

Rolling origin. The history is cut every 7 days back from the newest day
whose horizon is fully in the past, up to 8 cuts, keeping only cuts with
enough history for every model so all are scored on the same cuts. At each
cut each model forecasts the horizon (the worksheet's days to cover) from the
days before the cut only. Errors are measured on the horizon total, the
figure an order is built from:

- error (WAPE) = Σ |forecast − actual| ÷ Σ actual;
- lean (bias) = Σ (forecast − actual) ÷ Σ actual.

At least 4 cuts are needed before any model can be chosen.

## Out-of-stock days

A day the variant was out of stock all day is censored: sales on it
understate demand. The models skip those days instead of reading them as
zero, and the backtest leaves them out of both forecast and actual. The
recent average still counts them, exactly as the parity method does, so the
baseline stays the Stocky number. Returns larger than sales on a day are read
as zero demand.

## On the worksheet

- **Where:** a "Smart Forecast" section, marked "Advice", at the end of a
  row's detail, below the Stocky Parity calculation. Nothing runs until the
  merchant presses "Run Smart Forecast".
- **Route:** `GET /app/replenishment/smart-forecast?worksheetId=&lineId=`
  (`app/routes/app.replenishment_.smart-forecast.tsx`). Read-only. It checks
  `core.replenishment`, then `forecast.smart`; a shop without Pro is told
  Smart Forecast is in the Pro plan and nothing is read.
- **Which worksheets:** only those made with "Last X days", because the
  recent average every method must beat is that method's own number. Other
  methods read different days, so the comparison would not be like for like.
- **History:** `loadDemandHistory` (`history.server.ts`) reads the variant's
  daily net units from the shared sales history, ending the day before the
  worksheet's date and starting no earlier than the shop's stored order
  history, so days before it are never read as zero sales. Stock-out days are
  not known yet (`inStock: null`).
- **Stock:** the forecast's order quantity uses the available and incoming
  stock saved on the worksheet row.
- **Using it:** when a method was chosen, an "Order N" button sets the row's
  order quantity through the worksheet's normal quantity change. The parity
  suggestion stays as it was. When the average was kept, the panel says to
  keep the Stocky Parity suggestion and offers no button.

## Not done yet

- Out-of-stock days from inventory history (the adapter marks every day as
  unknown until the app keeps daily stock levels per variant).
- An opt-in worksheet column; today the forecast runs one row at a time.
- Outcome logging: storing each shown forecast and comparing it with what
  later sold.
- Year-over-year seasonality and stockout-length estimation need more than
  eight weeks of history per variant and are left for later.
