/**
 * Regression tests for issue #77 (Decimals rendered as NaN / [object Object])
 * and the purchase-order side of issue #78 (action errors silently dropped).
 *
 * Loader data must contain nothing the single-fetch encoder can flatten into a
 * shapeless object, and the route components must render money from it.
 */
import { createElement, type ComponentType } from "react";
import { renderToString } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
} from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdminTenant, receivePartialPO } = vi.hoisted(() => ({
  requireAdminTenant: vi.fn(),
  receivePartialPO: vi.fn(),
}));

vi.mock("../tenant/require-admin-tenant.server", () => ({ requireAdminTenant }));

vi.mock("./shopify-gql.server", () => ({
  fetchLocations: vi.fn(async () => [
    { id: "gid://shopify/Location/1", name: "Main warehouse" },
  ]),
}));

vi.mock("./landed-cost.server", () => ({
  applyLandedCostsToPO: vi.fn(),
  receivePartialPO,
  recalculatePOLineCost: vi.fn(),
  recordLeadTimeSnapshot: vi.fn(),
  resolveTieredUnitCost: vi.fn(),
}));

const VARIANT_GID = "gid://shopify/ProductVariant/101";

// Merchant copy: no flag or environment-variable names.
const RECEIVING_OFF_COPY =
  "Receiving is turned off for this store, so nothing was received and no stock changed.";

const decimal = (value: string) => new Prisma.Decimal(value);

function purchaseOrderRow() {
  return {
    id: "po_0000000000000000000001",
    poNumber: null,
    status: "ORDERED",
    currency: "USD",
    exchangeRate: decimal("1.085000"),
    freightCost: decimal("25.00"),
    customsCost: decimal("10.00"),
    landedCostMethod: "COST",
    createdAt: new Date("2026-11-10T12:00:00.000Z"),
    supplier: { id: "sup_1", name: "Acme Wholesale" },
    lineItems: [
      {
        id: "line_1",
        shopifyVariantId: VARIANT_GID,
        vendorSku: "ACME-101",
        orderedQty: 12,
        receivedQty: 0,
        unitCost: decimal("7.2500"),
        allocatedLandedCost: decimal("2.9167"),
        manualCostOverride: false,
      },
      {
        id: "line_2",
        shopifyVariantId: VARIANT_GID,
        vendorSku: null,
        orderedQty: 3,
        receivedQty: 0,
        unitCost: decimal("1.0050"),
        allocatedLandedCost: null,
        manualCostOverride: true,
      },
    ],
  };
}

function supplierRow() {
  return {
    id: "sup_1",
    name: "Acme Wholesale",
    currency: "USD",
    accountNumber: null,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    vendorNotes: null,
    leadTimeDays: null,
    skuMappings: [],
    leadTimeSnapshots: [],
    volumeTiers: [
      {
        id: "tier_1",
        variantId: VARIANT_GID,
        minQty: 10,
        maxQty: 49,
        unitCost: decimal("7.2500"),
      },
      {
        id: "tier_2",
        variantId: VARIANT_GID,
        minQty: 50,
        maxQty: null,
        unitCost: decimal("6.8125"),
      },
    ],
  };
}

const variantRows = [
  { shopifyVariantId: VARIANT_GID, title: "Cabernet 750ml", weight: decimal("1.2500") },
];

function tenantDb() {
  return {
    purchaseOrder: {
      findMany: vi.fn(async () => [purchaseOrderRow()]),
      findFirst: vi.fn(),
    },
    supplier: {
      findMany: vi.fn(async () => [supplierRow()]),
      findFirst: vi.fn(async () => supplierRow()),
    },
    shopifyVariantCache: {
      findMany: vi.fn(async () => variantRows),
      findFirst: vi.fn(),
    },
  };
}

/** Paths of values the single-fetch encoder would not carry across faithfully. */
function unsafeWirePaths(value: unknown, path = "$"): string[] {
  if (value === null || typeof value !== "object" || value instanceof Date) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      unsafeWirePaths(entry, `${path}[${index}]`),
    );
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return [path];
  return Object.entries(value).flatMap(([key, entry]) =>
    unsafeWirePaths(entry, `${path}.${key}`),
  );
}

/**
 * Render a route component from data that has crossed a serialization boundary,
 * as it has in the browser. structuredClone only carries plain data, so a
 * Decimal left in the loader result fails here instead of rendering through
 * its server-side prototype.
 */
async function renderRoute(
  Component: ComponentType,
  loaderData: unknown,
  actionData?: unknown,
): Promise<string> {
  const handler = createStaticHandler([
    {
      id: "route",
      path: "/",
      Component,
      loader: () => structuredClone(loaderData),
      action: () => structuredClone(actionData),
    },
  ]);
  const request =
    actionData === undefined
      ? new Request("https://app.example.test/")
      : new Request("https://app.example.test/", {
          method: "POST",
          body: new URLSearchParams(),
        });
  const context = await handler.query(request);
  if (context instanceof Response) {
    throw new Error(`Route responded with ${context.status} instead of rendering`);
  }
  const router = createStaticRouter(handler.dataRoutes, context);
  return renderToString(
    createElement(StaticRouterProvider, { router, context, hydrate: false }),
  );
}

function loaderArgs(params: Record<string, string> = {}): LoaderFunctionArgs {
  return {
    request: new Request("https://app.example.test/app"),
    params,
    context: {},
  } as unknown as LoaderFunctionArgs;
}

function actionArgs(fields: Record<string, string>): ActionFunctionArgs {
  const body = new URLSearchParams(fields);
  return {
    request: new Request("https://app.example.test/app/purchase-orders", {
      method: "POST",
      body,
    }),
    params: {},
    context: {},
  } as unknown as ActionFunctionArgs;
}

describe("purchase order and supplier money display", () => {
  let db: ReturnType<typeof tenantDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    db = tenantDb();
    requireAdminTenant.mockResolvedValue({
      admin: {},
      db,
      tenant: { myshopifyDomain: "stocky-test-store.myshopify.com" },
    });
  });

  it("purchase order loader sends decimals as exact strings", async () => {
    const { loader } = await import("../routes/app.purchase-orders");

    const data = await loader(loaderArgs());

    expect(unsafeWirePaths(data)).toEqual([]);
    const [po] = data.orders;
    expect(po.freightCost).toBe("25");
    expect(po.customsCost).toBe("10");
    expect(po.exchangeRate).toBe("1.085");
    expect(po.lineItems[0].unitCost).toBe("7.25");
    expect(po.lineItems[0].allocatedLandedCost).toBe("2.9167");
    expect(po.lineItems[0].landedUnitCost).toBe("10.1667");
    expect(po.lineItems[1].allocatedLandedCost).toBeNull();
    expect(po.lineItems[1].landedUnitCost).toBe("1.005");
    expect(data.variants[0].weight).toBe("1.25");
    expect(po.createdAt).toBeInstanceOf(Date);
  });

  it("purchase order page renders money from the loader data", async () => {
    const route = await import("../routes/app.purchase-orders");
    const data = await route.loader(loaderArgs());

    const html = await renderRoute(route.default, data);

    expect(html).toContain("Freight $25.00");
    expect(html).toContain("Customs $10.00");
    expect(html).toContain("@ 1.085");
    expect(html).toContain("$7.25");
    expect(html).toContain("$10.17");
    // Unit cost keeps its entered precision; the landed cost of the same line
    // rounds to cents, where toFixed(2) on the float 1.005 would give 1.00.
    expect(html).toContain("<s-table-cell>$1.005");
    expect(html).toContain("<s-table-cell>$1.01</s-table-cell>");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("[object Object]");
  });

  it("supplier loader and page show volume tier costs", async () => {
    const route = await import("../routes/app.suppliers_.$id");
    const data = await route.loader(loaderArgs({ id: "sup_1" }));

    expect(unsafeWirePaths(data)).toEqual([]);
    expect(data.supplier.volumeTiers[0].unitCost).toBe("7.25");

    const html = await renderRoute(route.default, data);

    expect(html).toContain("$7.25");
    expect(html).toContain("$6.8125");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("[object Object]");
  });

  it("receive with receipt writes off returns a merchant-readable error", async () => {
    vi.stubEnv("FEATURE_RECEIPT_WRITES", "");
    const { action } = await import("../routes/app.purchase-orders");

    const result = await action(
      actionArgs({
        intent: "receive",
        poId: "po_0000000000000000000001",
        lineItemId: "line_1",
        receivedQty: "5",
      }),
    );

    expect(result).toEqual({ error: RECEIVING_OFF_COPY });
    expect(db.purchaseOrder.findFirst).not.toHaveBeenCalled();
    expect(receivePartialPO).not.toHaveBeenCalled();
  });

  it("warehouse scan with receipt writes off returns the same error", async () => {
    vi.stubEnv("FEATURE_RECEIPT_WRITES", "");
    const { action } = await import("../routes/app.warehouse");

    const result = await action(
      actionArgs({
        intent: "scan",
        poId: "po_0000000000000000000001",
        barcode: "0123456789012",
      }),
    );

    expect(result).toEqual({ error: RECEIVING_OFF_COPY });
    expect(db.shopifyVariantCache.findFirst).not.toHaveBeenCalled();
    expect(receivePartialPO).not.toHaveBeenCalled();
  });

  it("purchase order page shows an action error in a critical banner", async () => {
    const route = await import("../routes/app.purchase-orders");
    const data = await route.loader(loaderArgs());

    const withError = await renderRoute(route.default, data, {
      error: "Purchase order not found",
    });
    const withoutError = await renderRoute(route.default, data, { ok: true });

    expect(withError).toMatch(
      /<s-banner tone="critical" heading="Purchase order not updated">.*Purchase order not found.*<\/s-banner>/s,
    );
    expect(withoutError).not.toContain("<s-banner");
  });
});
