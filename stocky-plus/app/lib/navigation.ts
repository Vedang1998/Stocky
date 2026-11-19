export type AppNavItem = {
  label: string;
  href: string;
};

/** Landing page. Rendered with rel="home", so Shopify links the app name to it. */
export const APP_HOME: AppNavItem = { label: "Home", href: "/app" };

/**
 * Sidebar order follows the product information architecture. An item is
 * listed only once its page exists; navigation.test.ts enforces that.
 */
export const APP_NAV_ITEMS: readonly AppNavItem[] = [
  { label: "Replenishment", href: "/app/buying-table" },
  { label: "Purchase orders", href: "/app/purchase-orders" },
  { label: "Receiving", href: "/app/warehouse" },
  { label: "Inventory", href: "/app/inventory" },
  { label: "Stocktakes", href: "/app/stocktakes" },
  { label: "Transfers", href: "/app/transfers" },
  { label: "Adjustments", href: "/app/adjustments" },
  { label: "Suppliers", href: "/app/suppliers" },
  { label: "Labels", href: "/app/labels" },
  { label: "Reports", href: "/app/reports" },
  { label: "Bundles", href: "/app/bundles" },
  { label: "Billing", href: "/app/billing" },
];
