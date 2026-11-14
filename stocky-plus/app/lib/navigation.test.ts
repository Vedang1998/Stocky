import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_HOME, APP_NAV_ITEMS } from "./navigation";

const ROUTES_DIR = join(__dirname, "..", "routes");

/** Flat-routes file for an app path: /app -> app._index, /app/x -> app.x */
function routeFileFor(href: string): string {
  const segments = href.split("/").filter(Boolean);
  const name = segments.length === 1 ? `${segments[0]}._index` : segments.join(".");
  return join(ROUTES_DIR, `${name}.tsx`);
}

describe("app navigation", () => {
  const items = [APP_HOME, ...APP_NAV_ITEMS];

  it.each(items)("$label links to a page that renders", ({ href }) => {
    const file = routeFileFor(href);
    expect(existsSync(file), `${href} has no route module`).toBe(true);
    expect(readFileSync(file, "utf8")).toMatch(/^export default function /m);
  });

  it("keeps every destination inside the embedded app", () => {
    for (const { href } of items) {
      expect(href).toMatch(/^\/app(\/[a-z-]+)*$/);
    }
  });

  it("has no duplicate labels or destinations", () => {
    expect(new Set(items.map((item) => item.label)).size).toBe(items.length);
    expect(new Set(items.map((item) => item.href)).size).toBe(items.length);
  });

  it("follows the product navigation order for the sections that exist", () => {
    const productOrder = [
      "Home",
      "Replenishment",
      "Purchase orders",
      "Receiving",
      "Inventory",
      "Stocktakes",
      "Transfers",
      "Suppliers",
      "Labels",
      "Reports",
      "Alerts",
      "Settings",
    ];
    const listed = items
      .map((item) => item.label)
      .filter((label) => productOrder.includes(label));
    expect(listed).toEqual(productOrder.filter((label) => listed.includes(label)));
  });
});
