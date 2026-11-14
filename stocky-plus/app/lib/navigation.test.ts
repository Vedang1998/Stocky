import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_HOME, APP_NAV_ITEMS } from "./navigation";

const ROUTES_DIR = join(__dirname, "..", "routes");

/**
 * Flat-routes files that can render an app path: /app -> app._index,
 * /app/x -> app.x, or app.x._index when the section has child routes.
 */
function routeFilesFor(href: string): string[] {
  const segments = href.split("/").filter(Boolean);
  if (segments.length === 1) return [join(ROUTES_DIR, `${segments[0]}._index.tsx`)];
  const name = segments.join(".");
  return [`${name}.tsx`, `${name}._index.tsx`].map((file) =>
    join(ROUTES_DIR, file),
  );
}

describe("app navigation", () => {
  const items = [APP_HOME, ...APP_NAV_ITEMS];

  it.each(items)("$label links to a page that renders", ({ href }) => {
    const file = routeFilesFor(href).find((candidate) => existsSync(candidate));
    expect(file, `${href} has no route module`).toBeDefined();
    expect(readFileSync(file!, "utf8")).toMatch(/^export default function /m);
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
