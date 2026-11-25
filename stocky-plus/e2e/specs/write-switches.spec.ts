import { expect, openAppPage, test } from "../support/fixtures";

// The cloud run keeps every inventory-write switch off (project rules
// section 12); each screen that can change Shopify stock must say so.
const SWITCHED_OFF = [
  { path: "/app/stocktakes", banner: "Stock changes from counts are switched off" },
  { path: "/app/transfers", banner: "Stock changes from transfers are switched off" },
  { path: "/app/adjustments", banner: "Adjustments are switched off" },
];

for (const { path, banner } of SWITCHED_OFF) {
  test(`${path} warns that stock changes are switched off`, async ({ page }) => {
    await openAppPage(page, path);
    await expect(page.locator(`s-banner[heading="${banner}"]`)).toBeAttached();
  });
}
