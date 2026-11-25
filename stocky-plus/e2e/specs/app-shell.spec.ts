import { APP_NAV_ITEMS } from "../../app/lib/navigation";
import { expect, openAppPage, test } from "../support/fixtures";

test("opening ProPo from the test store shows the home page", async ({ page }) => {
  expect(await openAppPage(page, "/app")).toBe("Home");
});

for (const item of APP_NAV_ITEMS) {
  test(`the ${item.label} menu item opens its page`, async ({ page }) => {
    expect(await openAppPage(page, item.href)).not.toBe("");
  });
}
