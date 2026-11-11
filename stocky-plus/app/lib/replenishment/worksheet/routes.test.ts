/**
 * The worksheet page's loader and action and the CSV export, with storage
 * and purchasing replaced: who may reach them, what each form does with its
 * input, and how failures are reported to the merchant.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { resolveEntitlements } from "../../../billing/entitlements";
import { PurchasingError } from "../../../services/purchasing/errors";
import type { WorksheetHeader, WorksheetLine } from "./store.server";

const mocks = vi.hoisted(() => ({
  entitlements: vi.fn(),
  getWorksheet: vi.fn(),
  getWorksheetLine: vi.fn(),
  setFinalQuantity: vi.fn(),
  streamWorksheetLines: vi.fn(),
  getOrderGroups: vi.fn(),
  createDraftOrders: vi.fn(),
  checkPurchaseOrderAllowance: vi.fn(),
  previewLineSuggestion: vi.fn(),
  draftOrderPort: vi.fn(),
}));

const context = {
  admin: { graphql: vi.fn() },
  tenant: { shopId: "shop-a", myshopifyDomain: "shop-a.myshopify.com" },
  db: { authority: { shopId: "shop-a" } },
};

vi.mock("../../../tenant/require-admin-tenant.server", () => ({
  requireAdminTenant: vi.fn(async () => context),
}));
vi.mock("../../../services/purchasing/actor.server", () => ({
  requirePurchasingContext: vi.fn(async () => ({
    ...context,
    actor: { type: "STAFF", id: "staff-1" },
  })),
}));
vi.mock("../../../billing/entitlements.server", async (original) => ({
  ...(await original<typeof import("../../../billing/entitlements.server")>()),
  getShopEntitlements: mocks.entitlements,
}));
vi.mock("../../../tenant/bootstrap.server", () => ({
  readShopReportingProfile: vi.fn(async () => ({
    ianaTimezone: "America/New_York",
    currencyCode: "USD",
    installedAt: new Date("2026-08-01T00:00:00Z"),
  })),
}));
vi.mock("./store.server", async (original) => ({
  ...(await original<typeof import("./store.server")>()),
  getWorksheet: mocks.getWorksheet,
  getWorksheetLine: mocks.getWorksheetLine,
  setFinalQuantity: mocks.setFinalQuantity,
  streamWorksheetLines: mocks.streamWorksheetLines,
}));
vi.mock("./orders.server", () => ({
  getOrderGroups: mocks.getOrderGroups,
  createDraftOrders: mocks.createDraftOrders,
}));
vi.mock("./order-limit.server", () => ({
  checkPurchaseOrderAllowance: mocks.checkPurchaseOrderAllowance,
}));
vi.mock("./preview.server", () => ({ previewLineSuggestion: mocks.previewLineSuggestion }));
vi.mock("./purchasing.server", () => ({
  draftOrderPort: mocks.draftOrderPort,
  purchasingSources: { listSuppliers: vi.fn(async () => []) },
}));

import { action } from "../../../routes/app.replenishment_.$worksheetId";
import { loader as exportLoader } from "../../../routes/app.replenishment_.$worksheetId_.export";
import { WorksheetError } from "./generate.server";
import { WorksheetEditError } from "./store.server";

const ACTIVE = resolveEntitlements([
  {
    id: "gid://shopify/AppSubscription/1",
    name: "Essentials",
    status: "ACTIVE",
    planHandle: "essentials",
    createdAt: "2026-10-02T00:00:00Z",
    currentPeriodEnd: "2026-12-01T00:00:00Z",
    trialDays: 0,
    billingInterval: "EVERY_30_DAYS",
    price: { amount: "29.0", currencyCode: "USD" },
  },
]);

const WORKSHEET: WorksheetHeader = {
  id: "ws_1",
  method: "LAST_X_DAYS",
  scopeKey: "SHOP",
  scopeName: null,
  settings: {
    params: { method: "LAST_X_DAYS", sampleDays: 30, suggestDays: 30 },
    scopeKey: "SHOP",
    incomingSource: "SHOPIFY_INCOMING",
    rounding: { applyMinimumOrderQuantity: false, roundUpToPackSize: false },
    selection: { vendor: null, productType: null, supplierId: null },
  },
  asOfLocalDate: "2026-11-10",
  timeZone: "America/New_York",
  summary: null,
  lineCount: 2,
  generatedAt: new Date("2026-11-10T15:00:00Z"),
};

function post(fields: Record<string, string | string[]>): ActionFunctionArgs {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const entry of Array.isArray(value) ? value : [value]) body.append(name, entry);
  }
  return {
    request: new Request("https://app.example/app/replenishment/ws_1", { method: "POST", body }),
    params: { worksheetId: "ws_1" },
    context: {},
  } as unknown as ActionFunctionArgs;
}

async function thrown(run: () => Promise<unknown>): Promise<Response> {
  try {
    await run();
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
  throw new Error("Expected a Response to be thrown");
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.entitlements.mockResolvedValue(ACTIVE);
  mocks.getWorksheet.mockResolvedValue(WORKSHEET);
  mocks.draftOrderPort.mockReturnValue({ maxLinesPerOrder: 1000, create: vi.fn() });
  mocks.checkPurchaseOrderAllowance.mockResolvedValue({ allowed: true });
});

describe("worksheet page action", () => {
  it("is refused without a plan that includes replenishment, before anything is read", async () => {
    mocks.entitlements.mockResolvedValue(resolveEntitlements([]));
    const response = await thrown(() => action(post({ intent: "setQuantity", lineId: "l1", quantity: "5" })));
    expect(response.status).toBe(403);
    expect(mocks.getWorksheet).not.toHaveBeenCalled();
    expect(mocks.setFinalQuantity).not.toHaveBeenCalled();
  });

  it("answers 404 for a worksheet the shop does not have", async () => {
    mocks.getWorksheet.mockResolvedValue(null);
    const response = await thrown(() => action(post({ intent: "createOrders", supplierId: "sup_1" })));
    expect(response.status).toBe(404);
    expect(mocks.createDraftOrders).not.toHaveBeenCalled();
  });

  it("rejects a form it does not know", async () => {
    const response = await thrown(() => action(post({ intent: "deleteEverything" })));
    expect(response.status).toBe(400);
  });

  describe("setQuantity", () => {
    it("saves a whole number and returns what the row now orders", async () => {
      mocks.setFinalQuantity.mockResolvedValue({ finalQuantity: 12, orderQuantity: 12 });
      await expect(
        action(post({ intent: "setQuantity", lineId: "l1", quantity: " 12 " })),
      ).resolves.toEqual({
        intent: "setQuantity",
        lineId: "l1",
        ok: true,
        finalQuantity: 12,
        orderQuantity: 12,
      });
      expect(mocks.setFinalQuantity).toHaveBeenCalledWith(context.db, {
        worksheetId: "ws_1",
        lineId: "l1",
        quantity: 12,
      });
    });

    it("treats an empty quantity as a return to the suggestion", async () => {
      mocks.setFinalQuantity.mockResolvedValue({ finalQuantity: null, orderQuantity: 17 });
      await action(post({ intent: "setQuantity", lineId: "l1", quantity: "" }));
      expect(mocks.setFinalQuantity).toHaveBeenCalledWith(
        context.db,
        expect.objectContaining({ quantity: null }),
      );
    });

    it.each(["-1", "1.5", "1e3", "12 units", "0x10", "123456789"])(
      "does not store %s",
      async (quantity) => {
        await expect(
          action(post({ intent: "setQuantity", lineId: "l1", quantity })),
        ).resolves.toEqual({
          intent: "setQuantity",
          lineId: "l1",
          ok: false,
          message: "Enter a whole number from 0 to 10,000,000.",
        });
        expect(mocks.setFinalQuantity).not.toHaveBeenCalled();
      },
    );

    it("reports a row that is already on a purchase order", async () => {
      mocks.setFinalQuantity.mockRejectedValue(
        new WorksheetEditError("already_ordered", "This row is already on a purchase order."),
      );
      await expect(
        action(post({ intent: "setQuantity", lineId: "l1", quantity: "3" })),
      ).resolves.toMatchObject({ ok: false, message: "This row is already on a purchase order." });
    });
  });

  describe("preview", () => {
    it("returns field errors without reading sales when the period is not valid", async () => {
      const result = await action(
        post({ intent: "preview", lineId: "l1", method: "LAST_X_DAYS", sampleDays: "0", suggestDays: "30" }),
      );
      expect(result).toMatchObject({ intent: "preview", ok: false, errors: { sampleDays: expect.any(String) } });
      expect(mocks.previewLineSuggestion).not.toHaveBeenCalled();
    });

    it("explains a row that has gone", async () => {
      mocks.getWorksheetLine.mockResolvedValue(null);
      const result = await action(
        post({ intent: "preview", lineId: "gone", method: "FILL_SHELVES" }),
      );
      expect(result).toMatchObject({
        ok: false,
        message: "That row is no longer on this worksheet.",
      });
    });

    it("does not recalculate a worksheet whose settings cannot be read", async () => {
      mocks.getWorksheet.mockResolvedValue({ ...WORKSHEET, settings: null });
      const result = await action(post({ intent: "preview", lineId: "l1", method: "FILL_SHELVES" }));
      expect(result).toMatchObject({ ok: false, errors: {} });
      expect(mocks.previewLineSuggestion).not.toHaveBeenCalled();
    });

    it("calculates against the worksheet's own date and settings", async () => {
      const line = { id: "l1" } as WorksheetLine;
      const suggestion = { suggestedQuantity: 9 };
      mocks.getWorksheetLine.mockResolvedValue(line);
      mocks.previewLineSuggestion.mockResolvedValue(suggestion);

      const result = await action(
        post({ intent: "preview", lineId: "l1", method: "TARGET_STOCK_LEVEL", targetQuantity: "40" }),
      );
      expect(result).toEqual({ intent: "preview", lineId: "l1", ok: true, suggestion });
      expect(mocks.previewLineSuggestion).toHaveBeenCalledWith(context.db, {
        worksheet: {
          asOfLocalDate: "2026-11-10",
          timeZone: "America/New_York",
          settings: WORKSHEET.settings,
          currencyCode: "USD",
        },
        line,
        params: { method: "TARGET_STOCK_LEVEL", targetQuantity: 40 },
        installedAt: new Date("2026-08-01T00:00:00Z"),
      });
    });
  });

  describe("createOrders", () => {
    const groups = (lines: number[]) => ({
      groups: lines.map((count, index) => ({
        supplierId: `sup_${index + 1}`,
        supplierName: `Supplier ${index + 1}`,
        lines: count,
        units: count,
        costByCurrency: [],
        linesWithoutCost: count,
      })),
      linesWithoutSupplier: 0,
    });

    it("creates orders for the chosen suppliers at the chosen location", async () => {
      mocks.getOrderGroups.mockResolvedValue(groups([3, 2]));
      mocks.createDraftOrders.mockResolvedValue([{ purchaseOrderNumber: "PO-1001" }]);

      const result = await action(
        post({ intent: "createOrders", supplierId: ["sup_1", "sup_2"], locationGid: "gid://shopify/Location/1" }),
      );
      expect(result).toEqual({
        intent: "createOrders",
        ok: true,
        orders: [{ purchaseOrderNumber: "PO-1001" }],
      });
      expect(mocks.createDraftOrders).toHaveBeenCalledWith(context.db, mocks.draftOrderPort.mock.results[0].value, {
        worksheet: { id: "ws_1", scopeKey: "SHOP" },
        supplierIds: ["sup_1", "sup_2"],
        locationGid: "gid://shopify/Location/1",
      });
      expect(mocks.draftOrderPort).toHaveBeenCalledWith(
        context.db,
        expect.objectContaining({ actor: { type: "STAFF", id: "staff-1" }, today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }),
      );
    });

    it("counts every order the request would create against the plan allowance", async () => {
      // 2,500 rows for one supplier need three orders; the unchosen supplier needs none.
      mocks.getOrderGroups.mockResolvedValue(groups([2500, 10, 1]));
      mocks.createDraftOrders.mockResolvedValue([]);
      await action(post({ intent: "createOrders", supplierId: ["sup_1", "sup_3"], locationGid: "gid://shopify/Location/1" }));
      expect(mocks.checkPurchaseOrderAllowance).toHaveBeenCalledWith(
        context.db,
        ACTIVE,
        4,
        expect.any(Date),
      );
    });

    it("creates nothing when the allowance would be passed", async () => {
      mocks.getOrderGroups.mockResolvedValue(groups([1]));
      mocks.checkPurchaseOrderAllowance.mockResolvedValue({ allowed: false, message: "None are left." });
      await expect(
        action(post({ intent: "createOrders", supplierId: "sup_1" })),
      ).resolves.toEqual({ intent: "createOrders", ok: false, message: "None are left." });
      expect(mocks.createDraftOrders).not.toHaveBeenCalled();
    });

    it.each([
      new WorksheetError("location_not_found", "Choose the location the stock will be delivered to."),
      new PurchasingError("invalid_state", "This supplier is archived. Restore it before creating purchase orders."),
    ])("reports a problem the merchant can fix: $message", async (error) => {
      mocks.getOrderGroups.mockResolvedValue(groups([1]));
      mocks.createDraftOrders.mockRejectedValue(error);
      await expect(
        action(post({ intent: "createOrders", supplierId: "sup_1" })),
      ).resolves.toEqual({ intent: "createOrders", ok: false, message: error.message });
    });

    it("lets an unexpected failure reach the error boundary", async () => {
      mocks.getOrderGroups.mockResolvedValue(groups([1]));
      mocks.createDraftOrders.mockRejectedValue(new Error("database unavailable"));
      await expect(action(post({ intent: "createOrders", supplierId: "sup_1" }))).rejects.toThrow(
        "database unavailable",
      );
    });
  });
});

describe("worksheet CSV export", () => {
  function get(search = ""): LoaderFunctionArgs {
    return {
      request: new Request(`https://app.example/app/replenishment/ws_1/export${search}`),
      params: { worksheetId: "ws_1" },
      context: {},
    } as unknown as LoaderFunctionArgs;
  }

  it("is refused without a plan that includes replenishment", async () => {
    mocks.entitlements.mockResolvedValue(resolveEntitlements([]));
    const response = await thrown(() => exportLoader(get()));
    expect(response.status).toBe(403);
    expect(mocks.streamWorksheetLines).not.toHaveBeenCalled();
  });

  it("answers 404 for a worksheet the shop does not have", async () => {
    mocks.getWorksheet.mockResolvedValue(null);
    const response = await exportLoader(get());
    expect(response.status).toBe(404);
    expect(mocks.streamWorksheetLines).not.toHaveBeenCalled();
  });

  it("downloads the rows of the view being looked at as a private file", async () => {
    mocks.streamWorksheetLines.mockImplementation(async function* () {
      yield [];
    });
    const response = await exportLoader(get("?show=TO_ORDER&q=merlot&sort=order&dir=desc&page=3"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="replenishment-2026-11-10.csv"',
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await response.text()).startsWith("Product,Variant,SKU,")).toBe(true);
    expect(mocks.streamWorksheetLines).toHaveBeenCalledWith(
      context.db,
      "ws_1",
      expect.objectContaining({
        show: "TO_ORDER",
        query: "merlot",
        sort: { key: "order", direction: "desc" },
      }),
    );
  });
});
