import { test as base, expect, type Page } from "@playwright/test";
import { DEV_TEST_STORE, mintSessionToken } from "./session-token";

export const APP_BASE_URL = process.env.STORE_E2E_BASE_URL ?? "http://localhost:3000";
const APP_ORIGIN = new URL(APP_BASE_URL).origin;

const APP_BRIDGE_URL = "https://cdn.shopify.com/shopifycloud/app-bridge.js";

/**
 * Stand-in for the App Bridge script. The real script sends a page opened
 * outside the Shopify admin back to the admin, which needs a signed-in
 * staff account. The stub provides the `shopify` global the app calls and
 * records toasts so specs can read them.
 */
const APP_BRIDGE_STUB = `
window.__propoToasts = [];
window.shopify = {
  config: { apiKey: document.currentScript?.dataset.apiKey ?? "" },
  environment: { embedded: true, mobile: false, pos: false },
  toast: {
    show(message) { window.__propoToasts.push(String(message)); return "toast"; },
    hide() {},
  },
  loading() {},
};
`;

/**
 * A page signed in to the app as the dev test store. Every request to the
 * app carries a freshly minted session token in the Authorization header,
 * as App Bridge adds inside the admin. The secret stays in this Node process.
 */
export const test = base.extend({
  context: async ({ context }, provide) => {
    await context.route(APP_BRIDGE_URL, (route) =>
      route.fulfill({ contentType: "text/javascript", body: APP_BRIDGE_STUB }),
    );
    await context.route(
      (url) => url.origin === APP_ORIGIN,
      (route) =>
        route.continue({
          headers: {
            ...route.request().headers(),
            ...authHeaders(),
          },
        }),
    );
    await provide(context);
  },
});

export { expect };

/** Admin-style query string the app expects on a document load. */
export function appUrl(path: string): string {
  const url = new URL(path, APP_BASE_URL);
  url.searchParams.set("shop", DEV_TEST_STORE);
  url.searchParams.set(
    "host",
    Buffer.from(`admin.shopify.com/store/${DEV_TEST_STORE.split(".")[0]}`).toString("base64url"),
  );
  url.searchParams.set("embedded", "1");
  return url.toString();
}

/**
 * Opens an app page and checks it rendered the page itself rather than the
 * route error page. Returns the page heading.
 */
export async function openAppPage(page: Page, path: string): Promise<string> {
  const response = await page.goto(appUrl(path));
  expect(response, `no response for ${path}`).not.toBeNull();
  expect(response!.status(), `HTTP status for ${path}`).toBeLessThan(400);
  const heading = page.locator("s-page[heading]").first();
  await expect(heading, `${path} rendered the error page`).toBeAttached();
  return (await heading.getAttribute("heading")) ?? "";
}

/** Authorization header carrying a fresh session token for the test store. */
export function authHeaders(): Record<string, string> {
  const token = mintSessionToken({
    shop: DEV_TEST_STORE,
    apiKey: process.env.SHOPIFY_API_KEY ?? "",
    apiSecret: process.env.SHOPIFY_API_SECRET ?? "",
  });
  return { authorization: `Bearer ${token}` };
}

/**
 * Opens a page that needs a ProPo plan on a shop without one, and checks it
 * answers with the plan-required page rather than a crash.
 */
export async function expectPlanRequiredPage(page: Page, path: string): Promise<void> {
  const response = await page.goto(appUrl(path));
  expect(response?.status(), `HTTP status for ${path}`).toBe(403);
  await expect(page.getByRole("heading", { name: "Access not available" })).toBeVisible();
  await expect(page.getByText("An active ProPo plan is required")).toBeVisible();
}
