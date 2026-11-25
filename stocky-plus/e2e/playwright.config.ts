import { defineConfig, devices } from "@playwright/test";

/**
 * Dev-store E2E: the app runs locally (scripts/store-e2e/run.sh starts it)
 * and talks to stocky-test-store.myshopify.com. See docs/STORE_E2E.md.
 */
export default defineConfig({
  testDir: "./specs",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  reporter: [["list"], ["html", { open: "never", outputFolder: "../e2e-report" }]],
  use: {
    ...devices["Desktop Chrome"],
    // The Shopify app library answers 410 to user agents it reads as bots,
    // including HeadlessChrome.
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    trace: "off",
    screenshot: "only-on-failure",
  },
  outputDir: "../e2e-results",
});
