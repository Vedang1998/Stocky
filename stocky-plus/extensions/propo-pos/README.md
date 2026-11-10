# ProPo POS extension

Smart-grid tile and modal for Shopify POS (`pos.home.tile.render`,
`pos.home.modal.render`, API `2026-07`, Preact).

## What it does today

**Inventory lookup.** Staff scan with the device camera or a connected
scanner, or type a barcode or SKU. The modal shows the product and its
available, on-hand, committed and incoming quantities at the POS location and
every other active location, with how old each quantity is.

It is read-only. Nothing in this extension writes inventory.

## How it talks to the app

The extension calls the app with relative URLs, which POS resolves against the
app URL and signs with the logged-in user's session token (POS 10.6.0 or
later):

| Request | Purpose |
|---|---|
| `GET /api/pos/scan?code=&location=` | Resolve a scanned code; includes stock when exactly one product matches |
| `GET /api/pos/stock?variant=&location=` | Stock for a product picked from several matches |

Server side, `app/tenant/require-pos-tenant.server.ts` verifies the token
(signature, expiry, audience), resolves the shop from the token's `dest`,
refuses shops that are uninstalled or paused, and issues tenant authority.
Every query then goes through `TenantDb`. No shop identifier from the request
is trusted.

Quantities come from the synchronized Shopify inventory facts, not a live
Shopify call, so the screen states the age of what it shows.

`src/api-types.ts` mirrors the server response types.
`app/lib/pos/pos-api.test.ts` fails typecheck if the two drift.

## Testing on the dev store

Requires the Point of Sale channel on the test store and the Shopify POS app on
a phone or tablet signed in as a staff member who can use the ProPo app.

1. `shopify app dev` (the CLI may add a `uid` to `shopify.extension.toml` on
   first run; commit it).
2. In POS: Smart grid → Add tile → App → ProPo inventory.
3. Check: camera scan, connected scanner, typed SKU, a barcode shared by two
   variants (candidate list), an unknown code, an untracked product, airplane
   mode (offline message), and a staff member without app access (sign-in
   message).

## Checks

```sh
npm run typecheck   # includes this extension
npm test            # includes src/*.test.ts
```
