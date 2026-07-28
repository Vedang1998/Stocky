# Stocky++ — Inventory Management, Forecasting & Purchasing for Shopify

A Shopify-embedded inventory management, demand-forecasting, and purchasing
app built as a full replacement for Shopify Stocky, with fixes for Stocky's
historical gaps: landed costs, the receive-and-print loop, vendor lead-time
tracking, and bundle (BOM) forecasting.

The app is initially built for a high-volume liquor store but is architected
for commercial release on the Shopify App Store.

## Setup

See **[SETUP.md](./SETUP.md)** for environment, database, Shopify Partner
linking, and GitHub push steps. Short version once Docker is installed:

```bash
docker compose up -d
npx prisma migrate deploy
shopify app config link
npm run dev       # terminal 1
npm run worker    # terminal 2
```

## Modules

| Module | Where | What it does |
|--------|-------|--------------|
| Supplier Master | `/app/suppliers` | Vendors, SKU mappings, MOQ/pack sizes, volume price tiers, rich vendor notes, trailing 90-day lead times |
| Purchase Orders | `/app/purchase-orders` | Multi-currency POs, landed-cost allocation (freight/customs by cost, weight, or volume), tiered-price recalculation, partial receives with backorder state, receiver PDF (costs hidden) |
| Buying Table | `/app/buying-table` | Per-vendor demand planning grid: ABC class, live stock, incoming, sales velocity (out-of-stock days excluded), reorder points, one-click draft PO with MOQ/pack rounding, per-SKU custom lookbacks |
| Warehouse | `/app/warehouse` | Scan-to-receive (barcode → +1), session receipt tracking, ZPL label generation for exactly the units received |
| Stocktakes | `/app/stocktakes` | Freeze expected counts, enter physical counts, push deltas to Shopify via `inventoryAdjustQuantities` |
| Transfers | `/app/transfers` | Draft → pick → ship → receive using Shopify's Inventory Transfer API |
| Bundles / BOM | `/app/bundles` | Map bundle variants to component variants; bundle sales feed component forecasting |
| Analytics | `/app/analytics` | Dead stock (120-day), tied-up capital, inventory valuation (qty × landed cost), low-stock alerts, CSV exports |
| Billing | `/app/billing` | `appSubscriptionCreate` plans; the Buying Table is gated as a premium feature |

## Prerequisites

- Node.js 20.19+ (or 22.12+)
- Docker (for local PostgreSQL + Redis), or native installs
- A Shopify Partner account and a **development store**
- Shopify CLI (`npm i -g @shopify/cli`)

## Setup

```bash
# 1. Infrastructure (PostgreSQL 16 + Redis 7)
docker compose up -d

# 2. Environment
cp .env.example .env   # DATABASE_URL / REDIS_URL match docker-compose

# 3. Dependencies + database
npm install
npx prisma migrate deploy   # applies prisma/migrations
npx prisma generate

# 4. Link to your Partner app (creates one if needed)
shopify app config link

# 5. Run the app and the background worker in separate terminals
npm run dev       # Shopify CLI dev server + tunnel
npm run worker    # BullMQ workers: webhooks, ABC cron, catalog sync
```

After installing the app on your dev store, open the dashboard and click
**Sync catalog** to bulk-import products, variants, and barcodes.

## Architecture notes

- **Webhooks** (`orders/create`, `orders/cancelled`, `refunds/create`,
  `inventory_levels/update`) return 200 immediately; processing happens in
  BullMQ workers with 3-attempt exponential backoff. Redeliveries are
  deduplicated by `webhookId`.
- **Rate limits**: every Admin API call goes through
  `app/services/shopify-gql.server.ts`, which reads
  `extensions.cost.throttleStatus` and retries with backoff.
- **Out-of-stock detection**: Shopify has no inventory-history API, so
  `inventory_levels/update` webhooks build a daily `InventorySnapshot`
  table from install time forward. Velocity math excludes OOS days.
- **Forecast formulas** (`app/services/forecasting.server.ts`):
  - `velocity = unitsSold / (lookbackDays − outOfStockDays)`
  - `reorderPoint = velocity × leadTimeDays + safetyStock`
  - `toBuy = reorderPoint + velocity × targetDays − (onHand + incoming)`
- **ABC analysis** runs weekly (Sunday 02:00) per shop, by revenue and by
  volume: A = top 80%, B = next 15%, C = bottom 5%.
- **Lead times**: when a PO reaches fully-received, the ordered→received
  duration is snapshotted and the supplier's trailing 90-day average
  refreshes automatically.

## Tests

```bash
npm test          # vitest: forecasting + landed-cost allocation math
npm run typecheck
npm run lint
```
