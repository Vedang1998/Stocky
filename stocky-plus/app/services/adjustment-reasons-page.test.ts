/**
 * The Adjustment reasons page: what its action passes to the reasons service,
 * what it tells the merchant afterwards, and what the page shows. The service
 * itself is covered against PostgreSQL in
 * scripts/tenant-enforcement/tests/adjustment-ledger.test.ts.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

const STAFF = { shopifyUserId: "42", displayName: null, channel: "ADMIN" };
const STUDIO = {
  id: "r1",
  name: "Sent to photo studio",
  shopifyReason: "other",
};
const PURCHASE = {
  id: "r2",
  name: "Staff purchase",
  shopifyReason: "promotion",
};

const { service, context, page } = vi.hoisted(() => ({
  service: {
    listOwnAdjustmentReasons: vi.fn(),
    addOwnAdjustmentReason: vi.fn(),
    updateOwnAdjustmentReason: vi.fn(),
    removeOwnAdjustmentReason: vi.fn(),
  },
  context: {
    actor: null as unknown,
    db: {
      tenant: "shop-a",
      authority: { myshopifyDomain: "shop-a.myshopify.com" },
      shopSettings: { findUnique: vi.fn() },
    },
  },
  page: { loaderData: {} as unknown, actionData: undefined as unknown },
}));

vi.mock("./adjustments/adjustment-reasons.server", () => service);

vi.mock("./inventory-writes/actor.server", async () => {
  const actual = await vi.importActual<
    typeof import("./inventory-writes/actor.server")
  >("./inventory-writes/actor.server");
  return {
    ...actual,
    requireAdminTenantWithActor: vi.fn(async () => ({
      db: context.db,
      actor: context.actor,
    })),
  };
});

vi.mock("../tenant/require-admin-tenant.server", () => ({
  requireAdminTenant: vi.fn(async () => ({
    db: context.db,
    tenant: context.db.authority,
  })),
}));

vi.mock("react-router", async () => {
  const actual =
    await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useLoaderData: () => page.loaderData,
    useActionData: () => page.actionData,
    useNavigation: () => ({ state: "idle" }),
    Form: (props: { children?: ReactNode; method?: string }) =>
      createElement("form", { method: props.method }, props.children),
  };
});

import * as route from "../routes/app.adjustments_.reasons";
import { MAX_OWN_ADJUSTMENT_REASONS } from "./adjustments/adjustment-input";
import { STAFF_REQUIRED_MESSAGE } from "./inventory-writes/actor.server";

function post(fields: Record<string, string>): ActionFunctionArgs {
  return {
    request: new Request("https://app.example/app/adjustments/reasons", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields),
    }),
    params: {},
    context: {},
  } as ActionFunctionArgs;
}

const get = (): LoaderFunctionArgs =>
  ({
    request: new Request("https://app.example/app/adjustments/reasons"),
    params: {},
    context: {},
  }) as LoaderFunctionArgs;

type Reason = typeof STUDIO;

function render(
  loaderData: { planActive?: boolean; reasons?: Reason[] } = {},
  actionData: unknown = undefined,
): string {
  page.loaderData = { planActive: true, reasons: [], ...loaderData };
  page.actionData = actionData;
  return renderToStaticMarkup(createElement(route.default));
}

const ADD = {
  intent: "add",
  name: "Staff purchase",
  shopifyReason: "promotion",
};
const UPDATE = { ...ADD, intent: "update", id: "r2" };
const REMOVE = { intent: "remove", id: "r2" };

const expectNoChange = () => {
  expect(service.addOwnAdjustmentReason).not.toHaveBeenCalled();
  expect(service.updateOwnAdjustmentReason).not.toHaveBeenCalled();
  expect(service.removeOwnAdjustmentReason).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
  context.actor = STAFF;
  context.db.shopSettings.findUnique.mockResolvedValue({
    subscriptionActive: true,
  });
  service.listOwnAdjustmentReasons.mockResolvedValue([]);
});

describe("Adjustment reasons page action", () => {
  it("refuses every change when no staff member is signed in", async () => {
    context.actor = null;

    for (const fields of [ADD, UPDATE, REMOVE]) {
      expect(await route.action(post(fields)), fields.intent).toEqual({
        error: STAFF_REQUIRED_MESSAGE,
      });
    }
    expectNoChange();
  });

  it("refuses an intent it does not know", async () => {
    expect(await route.action(post({ ...ADD, intent: "delete" }))).toEqual({
      error: "That action is not available.",
    });
    expect(await route.action(post({}))).toEqual({
      error: "That action is not available.",
    });
    expectNoChange();
  });

  it("adds a reason for the signed-in staff member and confirms it by name", async () => {
    service.addOwnAdjustmentReason.mockResolvedValue({
      ok: true,
      reason: PURCHASE,
    });

    expect(await route.action(post(ADD))).toEqual({
      ok: true,
      notice: '"Staff purchase" was added.',
    });
    expect(service.addOwnAdjustmentReason).toHaveBeenCalledWith(
      context.db,
      STAFF,
      { name: "Staff purchase", shopifyReason: "promotion" },
    );
  });

  it("says why a reason was refused and keeps what was typed", async () => {
    service.addOwnAdjustmentReason.mockResolvedValue({
      ok: false,
      error: 'You already have a reason called "Staff purchase".',
    });

    const actionData = await route.action(post(ADD));

    expect(actionData).toEqual({
      error: 'You already have a reason called "Staff purchase".',
      values: { name: "Staff purchase", shopifyReason: "promotion" },
    });
    const html = render({}, actionData);
    expect(html).toContain("You already have a reason called");
    expect(html).toContain('value="Staff purchase"');
    expect(html).toMatch(/<s-option value="promotion" selected="[^"]*">/);
  });

  it("cuts an oversized name before it reaches the service or the reply", async () => {
    service.addOwnAdjustmentReason.mockResolvedValue({
      ok: false,
      error: "A reason name can be at most 60 characters.",
    });

    const actionData = (await route.action(
      post({ ...ADD, name: "x".repeat(5000) }),
    )) as { values: { name: string } };

    expect(actionData.values.name).toHaveLength(240);
    expect(service.addOwnAdjustmentReason.mock.calls[0][2].name).toHaveLength(
      240,
    );
  });

  it("saves an edited reason by its ID", async () => {
    service.updateOwnAdjustmentReason.mockResolvedValue({
      ok: true,
      reason: PURCHASE,
    });

    expect(await route.action(post(UPDATE))).toEqual({
      ok: true,
      notice: '"Staff purchase" was saved.',
    });
    expect(service.updateOwnAdjustmentReason).toHaveBeenCalledWith(
      context.db,
      "r2",
      { name: "Staff purchase", shopifyReason: "promotion" },
    );
  });

  it("removes a reason by its ID and says past adjustments keep its name", async () => {
    service.removeOwnAdjustmentReason.mockResolvedValue({
      ok: true,
      reason: PURCHASE,
    });

    expect(await route.action(post(REMOVE))).toEqual({
      ok: true,
      notice:
        '"Staff purchase" was removed. Adjustments recorded with it keep the name.',
    });
    expect(service.removeOwnAdjustmentReason).toHaveBeenCalledWith(
      context.db,
      "r2",
    );
  });

  it("shows why an edit or a removal was refused", async () => {
    const gone = { ok: false, error: "That reason is no longer in your list." };
    service.updateOwnAdjustmentReason.mockResolvedValue(gone);
    service.removeOwnAdjustmentReason.mockResolvedValue(gone);

    expect(await route.action(post(UPDATE))).toEqual({ error: gone.error });
    expect(await route.action(post(REMOVE))).toEqual({ error: gone.error });
  });

  it.each(["", " ", "x".repeat(65)])(
    "treats the reason ID %j as no reason at all",
    async (id) => {
      for (const fields of [UPDATE, REMOVE]) {
        expect(await route.action(post({ ...fields, id }))).toEqual({
          error: "Reason not found",
        });
      }
      expectNoChange();
    },
  );
});

describe("Adjustment reasons without an active plan", () => {
  const PLAN_BANNER =
    'heading="An active ProPo plan is needed to make changes"';

  for (const snapshot of [{ subscriptionActive: false }, null]) {
    it(`refuses every change with 403 when the plan snapshot is ${JSON.stringify(snapshot)}`, async () => {
      context.db.shopSettings.findUnique.mockResolvedValue(snapshot);

      for (const fields of [ADD, UPDATE, REMOVE]) {
        const refusal = await route
          .action(post(fields))
          .catch((thrown) => thrown);
        expect(refusal, fields.intent).toBeInstanceOf(Response);
        expect((refusal as Response).status, fields.intent).toBe(403);
      }
      expectNoChange();
    });
  }

  it("still lists the reasons, says why nothing can be changed and locks every button", async () => {
    context.db.shopSettings.findUnique.mockResolvedValue(null);
    service.listOwnAdjustmentReasons.mockResolvedValue([STUDIO]);

    const data = await route.loader(get());
    expect(data).toEqual({ planActive: false, reasons: [STUDIO] });

    const html = render(data);
    expect(html).toContain(PLAN_BANNER);
    expect(html).toContain("Sent to photo studio");
    const buttons = html.match(/<s-button[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      expect(button).toContain('disabled="true"');
    }
  });

  it("does not hide a database failure behind the plan banner", async () => {
    context.db.shopSettings.findUnique.mockRejectedValue(new Error("db down"));

    await expect(route.loader(get())).rejects.toThrow("db down");
  });
});

describe("Adjustment reasons page", () => {
  it("loads the shop's reasons with an active plan", async () => {
    service.listOwnAdjustmentReasons.mockResolvedValue([STUDIO, PURCHASE]);

    expect(await route.loader(get())).toEqual({
      planActive: true,
      reasons: [STUDIO, PURCHASE],
    });
    expect(service.listOwnAdjustmentReasons).toHaveBeenCalledWith(context.db);
  });

  it("says so when there are no reasons yet, names the built-in ones and offers the form", () => {
    const html = render();

    expect(html).toContain("You have not added any reasons yet.");
    expect(html).toContain(
      "Correction, Recount, Damaged, Theft or loss, Received stock, Returned to stock, Promotion or donation, Other",
    );
    expect(html).not.toContain("<s-table>");
    expect(html).toContain('name="intent" value="add"');
    expect(html).toContain("Add reason");
    expect(html).toContain('href="/app/adjustments"');
    expect(html).not.toContain("An active ProPo plan is needed");
  });

  it("lists each reason with the Shopify reason it counts as and its edit and remove controls", () => {
    const html = render({ reasons: [STUDIO, PURCHASE] });

    expect(html).not.toContain("You have not added any reasons yet.");
    expect(html).toMatch(
      /Sent to photo studio<\/s-table-cell><s-table-cell>Other</,
    );
    expect(html).toMatch(
      /Staff purchase<\/s-table-cell><s-table-cell>Promotion or donation</,
    );
    expect(html).toContain('name="id" value="r1"');
    expect(html).toContain('name="id" value="r2"');
    expect(html.match(/name="intent" value="remove"/g)).toHaveLength(2);
    expect(html.match(/>Edit</g)).toHaveLength(2);
    expect(html).not.toContain('disabled="true"');
  });

  it("offers every Shopify reason an adjustment can carry for a new reason", () => {
    const html = render();

    for (const code of [
      "correction",
      "cycle_count_available",
      "damaged",
      "shrinkage",
      "received",
      "restock",
      "promotion",
      "other",
    ]) {
      expect(html).toContain(`<s-option value="${code}"`);
    }
  });

  it("replaces the form with an explanation once the shop has as many reasons as it can", () => {
    const reasons = Array.from(
      { length: MAX_OWN_ADJUSTMENT_REASONS },
      (_, n) => ({
        id: `r${n}`,
        name: `Reason ${n}`,
        shopifyReason: "other",
      }),
    );

    const html = render({ reasons });

    expect(html).toContain(
      "You have 50 reasons, which is the most a shop can have.",
    );
    expect(html).not.toContain('name="intent" value="add"');
    expect(html).toContain("Reason 49");
  });

  it("escapes a reason name that came from the merchant", () => {
    const html = render({
      reasons: [{ ...STUDIO, name: '<img src=x onerror="alert(1)">' }],
    });

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("confirms the last change in a banner", () => {
    expect(
      render({}, { ok: true, notice: '"Staff purchase" was added.' }),
    ).toContain("&quot;Staff purchase&quot; was added.");
  });
});
