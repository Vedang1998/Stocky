import { APP_BASE_URL, authHeaders, expect, openAppPage, test } from "../support/fixtures";

// The worker imports the catalog after the first sign-in; until then the
// Inventory lookup page shows this banner.
const NOT_SYNCED = 's-banner[heading="Your catalog has not synced yet"]';

test("the test store's catalog syncs into ProPo after install", async ({ page }) => {
  await expect(async () => {
    expect(await openAppPage(page, "/app/inventory")).toBe("Inventory");
    await expect(page.locator(NOT_SYNCED)).toHaveCount(0);
  }).toPass({ timeout: 180_000, intervals: [5_000] });
});

test("the best-sellers report downloads as CSV", async ({ request }) => {
  const exportUrl = `${APP_BASE_URL}/app/reports/best-sellers/export`;
  let csv = "";
  // 409 means the store's time zone and currency are still importing.
  await expect(async () => {
    const response = await request.get(exportUrl, { headers: authHeaders() });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
    csv = await response.text();
  }).toPass({ timeout: 120_000, intervals: [5_000] });
  expect(csv.split("\n")[0]).not.toBe("");
});
