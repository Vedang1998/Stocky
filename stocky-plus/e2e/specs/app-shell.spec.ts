import { APP_NAV_ITEMS } from "../../app/lib/navigation";
import { expect, expectPlanRequiredPage, openAppPage, test } from "../support/fixtures";

// Menu pages whose loader requires a plan capability. The run's fresh
// database has no plan, so these answer with the plan-required page.
const PLAN_GATED = new Set(["/app/replenishment"]);

test("opening ProPo from the test store shows the home page", async ({ page }) => {
  expect(await openAppPage(page, "/app")).toBe("Home");
});

for (const item of APP_NAV_ITEMS.filter(({ href }) => !PLAN_GATED.has(href))) {
  test(`the ${item.label} menu item opens its page`, async ({ page }) => {
    expect(await openAppPage(page, item.href)).not.toBe("");
  });
}

for (const item of APP_NAV_ITEMS.filter(({ href }) => PLAN_GATED.has(href))) {
  test(`the ${item.label} menu item tells a shop with no plan that a plan is needed`, async ({
    page,
  }) => {
    await expectPlanRequiredPage(page, item.href);
  });
}
