import { APP_BASE_URL, authHeaders, expect, openAppPage, test } from "../support/fixtures";

// A product that ships with the dev test store (see issue #74 checkpoints).
const TEST_STORE_PRODUCT = "The Multi-location Snowboard";

test("the test store's products reach the Inventory page after install", async ({ page }) => {
  await expect(async () => {
    await openAppPage(page, "/app/inventory");
    await expect(page.getByText(TEST_STORE_PRODUCT).first()).toBeVisible({ timeout: 1_000 });
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
