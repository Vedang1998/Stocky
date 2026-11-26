import { expect, openAppPage, test } from "../support/fixtures";

// The test store has no paid plan in the run's fresh database, so pages
// that create records must stay readable and say a plan is needed.
test("adding a supplier without a plan shows the plan-required notice", async ({ page }) => {
  expect(await openAppPage(page, "/app/suppliers/new")).toBe("Add supplier");
  await expect(
    page.locator('s-banner[heading="An active ProPo plan is needed to make changes"]'),
  ).toBeAttached();
});
