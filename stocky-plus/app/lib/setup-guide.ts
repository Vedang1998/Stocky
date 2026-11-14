export type SetupFacts = {
  catalogSynced: boolean;
  /** Names of active locations, in display order. */
  locationNames: string[];
  supplierCount: number;
  purchaseOrderCount: number;
};

export type SetupAction =
  | { kind: "link"; label: string; href: string }
  | { kind: "sync_catalog"; label: string };

export type SetupStep = {
  id: "catalog" | "locations" | "suppliers" | "purchase_order";
  title: string;
  detail: string;
  done: boolean;
  /** What the merchant can do next; null once the step needs nothing. */
  action: SetupAction | null;
};

export type SetupGuide = {
  steps: SetupStep[];
  doneCount: number;
  complete: boolean;
};

const LOCATIONS_NAMED = 3;

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function describeLocations(names: string[]): string {
  const named = names.slice(0, LOCATIONS_NAMED).join(", ");
  const rest = names.length - LOCATIONS_NAMED;
  const list = rest > 0 ? `${named} and ${rest} more` : named;
  return `${plural(names.length, "active location")}: ${list}.`;
}

/**
 * Setup steps for the Home page. Every step is derived from the shop's own
 * data, so the guide cannot claim progress that has not happened.
 */
export function buildSetupGuide(facts: SetupFacts): SetupGuide {
  const hasLocations = facts.locationNames.length > 0;
  const hasSuppliers = facts.supplierCount > 0;
  const hasPurchaseOrders = facts.purchaseOrderCount > 0;

  const steps: SetupStep[] = [
    {
      id: "catalog",
      title: "Sync your catalog",
      detail: facts.catalogSynced
        ? "Your products, variants and barcodes are in ProPo and stay updated from Shopify."
        : "ProPo copies your products, variants and barcodes from Shopify. This starts when you install and can take a few minutes for a large catalog.",
      done: facts.catalogSynced,
      action: facts.catalogSynced
        ? null
        : { kind: "sync_catalog", label: "Sync catalog" },
    },
    {
      id: "locations",
      title: "Check your locations",
      detail: hasLocations
        ? describeLocations(facts.locationNames)
        : "No active locations have synced yet. They arrive with the catalog sync.",
      done: hasLocations,
      action: {
        kind: "link",
        label: "Manage locations in Shopify",
        href: "shopify://admin/settings/locations",
      },
    },
    {
      id: "suppliers",
      title: "Add your suppliers",
      detail: hasSuppliers
        ? `${plural(facts.supplierCount, "supplier")} added.`
        : "Suppliers hold the lead times and costs that purchase orders and reorder suggestions use.",
      done: hasSuppliers,
      action: hasSuppliers
        ? null
        : { kind: "link", label: "Add a supplier", href: "/app/suppliers" },
    },
    {
      id: "purchase_order",
      title: "Create your first purchase order",
      detail: hasPurchaseOrders
        ? `${plural(facts.purchaseOrderCount, "purchase order")} created.`
        : "Order stock from a supplier, then receive it by scanning as it arrives.",
      done: hasPurchaseOrders,
      action: hasPurchaseOrders
        ? null
        : {
            kind: "link",
            label: "Create a purchase order",
            href: "/app/purchase-orders",
          },
    },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  return { steps, doneCount, complete: doneCount === steps.length };
}
