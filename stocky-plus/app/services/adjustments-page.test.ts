/**
 * The Adjustments page and its CSV report: what the route action passes to
 * the adjustment service, what it tells the merchant afterwards, and what the
 * page and the export show. The service itself is covered against PostgreSQL
 * in scripts/tenant-enforcement/tests/adjustment-ledger.test.ts.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import type {
  AdjustmentHistoryEntry,
  AdjustmentResult,
} from "./adjustments/adjustment.server";

const LOCATION = "gid://shopify/Location/11";
const SUBMISSION = "3f2b6c1e-8a57-4d0e-9a55-0c6f6f1d2b7a";
const STAFF = { shopifyUserId: "42", displayName: null, channel: "ADMIN" };
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const { service, context, fetchLocations, isInventoryWriteEnabled, page } =
  vi.hoisted(() => ({
    service: {
      submitAdjustment: vi.fn(),
      resumeAdjustment: vi.fn(),
      reverseAdjustment: vi.fn(),
      listAdjustments: vi.fn(),
      listAdjustmentsForExport: vi.fn(),
    },
    context: {
      actor: null as unknown,
      db: { tenant: "shop-a" },
      admin: { graphql: () => undefined },
    },
    fetchLocations: vi.fn(),
    isInventoryWriteEnabled: vi.fn(),
    page: { loaderData: {} as unknown, actionData: undefined as unknown },
  }));

vi.mock("./adjustments/adjustment.server", async () => {
  const actual = await vi.importActual<
    typeof import("./adjustments/adjustment.server")
  >("./adjustments/adjustment.server");
  return { ...actual, ...service };
});

vi.mock("./inventory-writes/actor.server", async () => {
  const actual = await vi.importActual<
    typeof import("./inventory-writes/actor.server")
  >("./inventory-writes/actor.server");
  return {
    ...actual,
    requireAdminTenantWithActor: vi.fn(async () => ({
      admin: context.admin,
      db: context.db,
      actor: context.actor,
    })),
  };
});

vi.mock("../tenant/require-admin-tenant.server", () => ({
  requireAdminTenant: vi.fn(async () => ({
    admin: context.admin,
    db: context.db,
  })),
}));

vi.mock("./shopify-gql.server", () => ({ fetchLocations }));

vi.mock("../lib/feature-flags.server", () => ({ isInventoryWriteEnabled }));

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

import * as route from "../routes/app.adjustments";
import { loader as exportLoader } from "../routes/app.adjustments_.export";
import { STAFF_REQUIRED_MESSAGE } from "./inventory-writes/actor.server";

function post(fields: Record<string, string>): ActionFunctionArgs {
  return {
    request: new Request("https://app.example/app/adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields),
    }),
    params: {},
    context: {},
  } as ActionFunctionArgs;
}

function get(path: string): LoaderFunctionArgs {
  return {
    request: new Request(`https://app.example${path}`),
    params: {},
    context: {},
  } as LoaderFunctionArgs;
}

const FORM = {
  intent: "submit",
  submissionId: SUBMISSION,
  locationId: LOCATION,
  reason: "damaged",
  mode: "ADJUST",
  note: "Dropped a case",
  lines: "RED-75, -3\nWHT-75, 4",
};

const refused = (
  extra: Partial<Extract<AdjustmentResult, { ok: false }>> = {},
): AdjustmentResult => ({
  ok: false,
  error: "Some lines could not be matched. Nothing was changed.",
  details: [],
  problems: [],
  recorded: false,
  unfinishedOperationId: null,
  ...extra,
});

const entry = (
  extra: Partial<AdjustmentHistoryEntry> = {},
): AdjustmentHistoryEntry => ({
  operationId: "op-1",
  kind: "ADJUSTMENT",
  status: "APPLIED",
  reason: "damaged",
  note: "Dropped a case",
  staffId: "42",
  locationId: LOCATION,
  createdAt: new Date("2026-11-11T21:40:05.123Z"),
  completedAt: new Date("2026-11-11T21:40:06.000Z"),
  reversesOperationId: null,
  reversedByOperationId: null,
  canReverse: true,
  canResume: false,
  lines: [
    {
      title: "Red wine",
      sku: "RED-75",
      delta: -3,
      status: "APPLIED",
      quantityAfterChange: 7,
      errorMessage: null,
    },
  ],
  ...extra,
});

const LOADER_DATA = {
  submissionId: SUBMISSION,
  writesEnabled: true,
  locations: [{ id: LOCATION, name: "Shop floor" }],
  history: [] as AdjustmentHistoryEntry[],
  olderCursor: null as string | null,
  filter: { from: "", to: "" },
};

function render(
  loaderData: Partial<typeof LOADER_DATA> = {},
  actionData: unknown = undefined,
): string {
  page.loaderData = { ...LOADER_DATA, ...loaderData };
  page.actionData = actionData;
  return renderToStaticMarkup(createElement(route.default));
}

/** Runs the action, then renders the page the way it comes back to the merchant. */
async function submitAndRender(fields: Record<string, string>) {
  const actionData = await route.action(post(fields));
  return { actionData, html: render({}, actionData) };
}

beforeEach(() => {
  vi.clearAllMocks();
  context.actor = STAFF;
  fetchLocations.mockResolvedValue(LOADER_DATA.locations);
  isInventoryWriteEnabled.mockReturnValue(false);
  service.listAdjustments.mockResolvedValue([]);
});

describe("Adjustments page action", () => {
  it("refuses every stock-changing intent when no staff member is signed in", async () => {
    context.actor = null;

    for (const intent of ["submit", "resume", "reverse"]) {
      expect(
        await route.action(post({ ...FORM, intent, operationId: "op-1" })),
      ).toEqual({ error: STAFF_REQUIRED_MESSAGE });
    }
    expect(service.submitAdjustment).not.toHaveBeenCalled();
    expect(service.resumeAdjustment).not.toHaveBeenCalled();
    expect(service.reverseAdjustment).not.toHaveBeenCalled();
  });

  it("refuses an intent it does not know", async () => {
    expect(await route.action(post({ intent: "delete" }))).toEqual({
      error: "That action is not available.",
    });
    expect(await route.action(post({}))).toEqual({
      error: "That action is not available.",
    });
  });

  it("hands the form to the service with the signed-in staff member", async () => {
    service.submitAdjustment.mockResolvedValue({
      ok: true,
      operationId: "op-1",
      changedLineCount: 2,
      alreadySubmitted: false,
    });

    const { actionData, html } = await submitAndRender(FORM);

    expect(service.submitAdjustment).toHaveBeenCalledWith(
      context.db,
      context.admin,
      STAFF,
      {
        submissionId: SUBMISSION,
        locationId: LOCATION,
        reason: "damaged",
        mode: "ADJUST",
        note: "Dropped a case",
        linesText: "RED-75, -3\nWHT-75, 4",
      },
    );
    expect(actionData).toEqual({
      ok: true,
      notice: "Adjustment applied to 2 items in Shopify.",
    });
    expect(html).toContain('tone="success"');
    expect(html).toContain("Adjustment applied to 2 items in Shopify.");
  });

  it.each([
    [
      { operationId: "op-1", changedLineCount: 1, alreadySubmitted: false },
      "Adjustment applied to 1 item in Shopify.",
    ],
    [
      { operationId: null, changedLineCount: 0, alreadySubmitted: false },
      "Every quantity already matched Shopify. Nothing was changed.",
    ],
    [
      { operationId: "op-1", changedLineCount: 2, alreadySubmitted: true },
      "This adjustment was already recorded. Nothing more was sent to Shopify.",
    ],
  ])("confirms %j", async (result, notice) => {
    service.submitAdjustment.mockResolvedValue({ ok: true, ...result });

    expect(await route.action(post(FORM))).toEqual({ ok: true, notice });
  });

  it("shows which lines were wrong and keeps what was typed when nothing was recorded", async () => {
    service.submitAdjustment.mockResolvedValue(
      refused({
        details: ["Line 2: no variant has the SKU or barcode WHT-75."],
      }),
    );

    const { actionData, html } = await submitAndRender(FORM);

    expect(actionData).toMatchObject({
      error: "Some lines could not be matched. Nothing was changed.",
      values: {
        locationId: LOCATION,
        mode: "ADJUST",
        reason: "damaged",
        note: "Dropped a case",
        lines: "RED-75, -3\nWHT-75, 4",
      },
    });
    expect(html).toContain('heading="Adjustment issue"');
    expect(html).toContain("Line 2: no variant has the SKU or barcode WHT-75.");
    expect(html).toContain('value="RED-75, -3\nWHT-75, 4"');
    expect(html).toContain('value="Dropped a case"');
  });

  it("puts the selects back on what was chosen, and starts a fresh form on the first options", async () => {
    service.submitAdjustment.mockResolvedValue(refused());

    const { html } = await submitAndRender({
      ...FORM,
      reason: "shrinkage",
      mode: "SET",
    });

    expect(html).toMatch(/<s-option value="shrinkage" selected[^>]*>/);
    expect(html).toMatch(/<s-option value="SET" selected[^>]*>/);
    expect(html.match(/<s-option[^>]* selected/g)).toHaveLength(3);
    // A Polaris select starts on its first option when none is marked.
    expect(render()).not.toMatch(/<s-option[^>]* selected/);
  });

  it("does not hand the lines back once the adjustment is in the ledger", async () => {
    service.submitAdjustment.mockResolvedValue(
      refused({
        error: "Shopify did not accept 1 of 2 changes. The others are applied.",
        recorded: true,
        problems: [
          {
            shopifyVariantId: "gid://shopify/ProductVariant/2",
            title: "White wine",
            message: "The item is not stocked at the location.",
          },
        ],
      }),
    );

    const { actionData, html } = await submitAndRender(FORM);

    expect(actionData).toMatchObject({ values: undefined });
    expect(html).toContain(
      "White wine: The item is not stocked at the location.",
    );
    expect(html).not.toContain("RED-75, -3");
    expect(html).not.toContain('value="Dropped a case"');
  });

  it("treats a missing or oversized hidden field as absent rather than passing it on", async () => {
    service.submitAdjustment.mockResolvedValue(refused());

    await route.action(
      post({ intent: "submit", submissionId: "x".repeat(192), lines: "A,1" }),
    );

    expect(service.submitAdjustment.mock.calls[0][3]).toEqual({
      submissionId: null,
      locationId: null,
      reason: "",
      mode: "",
      note: "",
      linesText: "A,1",
    });
  });

  it("finishes an unfinished adjustment by its ID", async () => {
    service.resumeAdjustment.mockResolvedValue({
      ok: true,
      operationId: "op-1",
      changedLineCount: 2,
      alreadySubmitted: true,
    });

    expect(
      await route.action(post({ intent: "resume", operationId: "op-1" })),
    ).toEqual({ ok: true, notice: "Shopify has now confirmed every change." });
    expect(service.resumeAdjustment).toHaveBeenCalledWith(
      context.db,
      context.admin,
      "op-1",
    );
  });

  it("reverses an adjustment with the note and the signed-in staff member", async () => {
    service.reverseAdjustment.mockResolvedValue({
      ok: true,
      operationId: "op-2",
      changedLineCount: 1,
      alreadySubmitted: false,
    });

    expect(
      await route.action(
        post({ intent: "reverse", operationId: "op-1", note: "Wrong shelf" }),
      ),
    ).toEqual({
      ok: true,
      notice: "Adjustment reversed. Its changes are undone in Shopify.",
    });
    expect(service.reverseAdjustment).toHaveBeenCalledWith(
      context.db,
      context.admin,
      STAFF,
      { operationId: "op-1", note: "Wrong shelf" },
    );
  });

  it("says so when the adjustment was already reversed", async () => {
    service.reverseAdjustment.mockResolvedValue({
      ok: true,
      operationId: "op-2",
      changedLineCount: 1,
      alreadySubmitted: true,
    });

    expect(
      await route.action(post({ intent: "reverse", operationId: "op-1" })),
    ).toEqual({
      ok: true,
      notice:
        "This adjustment was already reversed. Nothing more was sent to Shopify.",
    });
  });

  it.each(["resume", "reverse"])(
    "refuses %s without an adjustment ID",
    async (intent) => {
      expect(await route.action(post({ intent }))).toEqual({
        error: "Adjustment not found",
      });
      expect(service.resumeAdjustment).not.toHaveBeenCalled();
      expect(service.reverseAdjustment).not.toHaveBeenCalled();
    },
  );

  it("shows why a reversal or a finish was refused", async () => {
    service.reverseAdjustment.mockResolvedValue(
      refused({ error: "Only applied inventory changes can be reversed." }),
    );

    const actionData = await route.action(
      post({ intent: "reverse", operationId: "op-1" }),
    );

    expect(actionData).toEqual({
      error: "Only applied inventory changes can be reversed.",
      details: [],
      problems: [],
    });
  });
});

describe("Adjustments page loader", () => {
  it("issues a fresh submission ID for every page load", async () => {
    const first = await route.loader(get("/app/adjustments"));
    const second = await route.loader(get("/app/adjustments"));

    expect(first.submissionId).toMatch(UUID);
    expect(second.submissionId).toMatch(UUID);
    expect(second.submissionId).not.toBe(first.submissionId);
  });

  it("reports whether adjustments are switched on", async () => {
    expect((await route.loader(get("/app/adjustments"))).writesEnabled).toBe(
      false,
    );
    isInventoryWriteEnabled.mockReturnValue(true);
    expect((await route.loader(get("/app/adjustments"))).writesEnabled).toBe(
      true,
    );
    expect(isInventoryWriteEnabled).toHaveBeenCalledWith("adjustmentWrites");
  });

  it("reads the period and the page position from the URL", async () => {
    const data = await route.loader(
      get(
        "/app/adjustments?from=2026-11-01&to=2026-11-30&after=2026-11-11T21:40:05.123Z~op-9",
      ),
    );

    expect(service.listAdjustments).toHaveBeenCalledWith(context.db, {
      from: new Date("2026-11-01T00:00:00.000Z"),
      to: new Date("2026-11-30T23:59:59.999Z"),
      after: {
        createdAt: new Date("2026-11-11T21:40:05.123Z"),
        operationId: "op-9",
      },
      take: 26,
    });
    expect(data.filter).toEqual({ from: "2026-11-01", to: "2026-11-30" });
  });

  it("offers an older page only when there is one", async () => {
    const entries = Array.from({ length: 26 }, (_, i) =>
      entry({
        operationId: `op-${i}`,
        createdAt: new Date(Date.UTC(2026, 10, 11, 12, 0, 59 - i)),
      }),
    );
    service.listAdjustments.mockResolvedValue(entries);

    const full = await route.loader(get("/app/adjustments"));

    expect(full.history).toHaveLength(25);
    expect(full.olderCursor).toBe("2026-11-11T12:00:35.000Z~op-24");

    service.listAdjustments.mockResolvedValue(entries.slice(0, 25));
    expect(
      (await route.loader(get("/app/adjustments"))).olderCursor,
    ).toBeNull();
  });
});

describe("Adjustments page", () => {
  it("warns up front when adjustments are switched off, without naming environment variables", () => {
    const off = render({ writesEnabled: false });
    expect(off).toContain('heading="Adjustments are switched off"');
    expect(off).not.toMatch(/FEATURE_/);

    expect(render({ writesEnabled: true })).not.toContain(
      "Adjustments are switched off",
    );
  });

  it("renders the form with the submission ID, every reason and both modes", () => {
    const html = render();

    expect(html).toContain(`name="submissionId" value="${SUBMISSION}"`);
    for (const label of [
      "Correction",
      "Recount",
      "Damaged",
      "Theft or loss",
      "Received stock",
      "Returned to stock",
      "Promotion or donation",
      "Other",
      "Add or remove units",
      "Set the available quantity",
      "Shop floor",
    ]) {
      expect(html).toContain(label);
    }
  });

  it("explains what to do when the shop has no locations instead of showing a form", () => {
    const html = render({ locations: [] });

    expect(html).toContain("No Shopify locations were found");
    expect(html).not.toContain('name="submissionId"');
  });

  it("says so when there is no history yet, or none in the chosen period", () => {
    expect(render()).toContain("No adjustments have been recorded yet.");
    expect(render({ filter: { from: "2026-11-01", to: "" } })).toContain(
      "No adjustments were recorded between these dates.",
    );
  });

  it("shows an applied adjustment with its reason, staff member, lines and the reverse control", () => {
    const html = render({ history: [entry()] });

    expect(html).toContain("Damaged");
    expect(html).toContain("Applied");
    expect(html).toContain("2026-11-11 21:40 UTC");
    expect(html).toContain("Shop floor");
    expect(html).toContain("Staff ID 42");
    expect(html).toContain("Dropped a case");
    expect(html).toContain("Red wine");
    expect(html).toContain("RED-75");
    expect(html).toContain("-3");
    expect(html).toContain("Reverse this adjustment");
    expect(html).not.toContain("Finish applying");
  });

  it("offers to finish an unfinished adjustment and not to reverse it", () => {
    const html = render({
      history: [
        entry({
          status: "RETRY_PENDING",
          canReverse: false,
          canResume: true,
          lines: [{ ...entry().lines[0], status: "IN_FLIGHT", delta: 4 }],
        }),
      ],
    });

    expect(html).toContain("Not finished");
    expect(html).toContain("Waiting for Shopify to confirm");
    expect(html).toContain("+4");
    expect(html).toContain("Finish applying");
    expect(html).toContain('name="operationId" value="op-1"');
    expect(html).not.toContain("Reverse this adjustment");
  });

  it("shows Shopify's reason on a refused line and marks a reversed adjustment", () => {
    const html = render({
      history: [
        entry({
          status: "PARTIALLY_APPLIED",
          canReverse: false,
          reversedByOperationId: "op-2",
          lines: [
            {
              ...entry().lines[0],
              status: "FAILED",
              quantityAfterChange: null,
              errorMessage: "The item is not stocked at the location.",
            },
          ],
        }),
        entry({ operationId: "op-2", kind: "REVERSAL", canReverse: false }),
      ],
    });

    expect(html).toContain("Partly applied");
    expect(html).toContain(
      "Refused by Shopify: The item is not stocked at the location.",
    );
    expect(html).toContain("Reversed");
    expect(html).toContain("Reversal");
  });

  it("escapes notes and titles that came from the merchant or Shopify", () => {
    const html = render({
      history: [
        entry({
          note: "<script>alert(1)</script>",
          lines: [{ ...entry().lines[0], title: "<img src=x onerror=1>" }],
        }),
      ],
    });

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
  });

  it("carries the chosen period into the report link and the older-page link", () => {
    const html = render({
      history: [entry()],
      filter: { from: "2026-11-01", to: "2026-11-30" },
      olderCursor: "2026-11-11T21:40:05.123Z~op-1",
    });

    expect(html).toContain(
      'href="/app/adjustments/export?from=2026-11-01&amp;to=2026-11-30"',
    );
    expect(html).toContain(
      'href="/app/adjustments?after=2026-11-11T21%3A40%3A05.123Z%7Eop-1&amp;from=2026-11-01&amp;to=2026-11-30"',
    );
    expect(render()).toContain('href="/app/adjustments/export"');
  });
});

describe("adjustment report export", () => {
  it("writes one row per line as a private CSV download", async () => {
    service.listAdjustmentsForExport.mockResolvedValue({
      truncated: false,
      entries: [
        entry({
          operationId: "op-2",
          kind: "REVERSAL",
          reason: "correction",
          note: null,
          staffId: "77",
          reversesOperationId: "op-1",
          lines: [{ ...entry().lines[0], delta: 3, quantityAfterChange: 10 }],
        }),
        entry({
          lines: [
            entry().lines[0],
            {
              title: "White wine",
              sku: null,
              delta: 4,
              status: "FAILED",
              quantityAfterChange: null,
              errorMessage: "The item is not stocked at the location.",
            },
          ],
        }),
      ],
    });

    const response = (await exportLoader(
      get("/app/adjustments/export?from=2026-11-01&to=2026-11-30"),
    )) as Response;

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/csv; charset=utf-8",
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="adjustments-2026-11-01-to-2026-11-30.csv"',
    );
    expect(service.listAdjustmentsForExport).toHaveBeenCalledWith(context.db, {
      from: new Date("2026-11-01T00:00:00.000Z"),
      to: new Date("2026-11-30T23:59:59.999Z"),
    });
    expect((await response.text()).split("\r\n")).toEqual([
      "Recorded at (UTC),Type,Status,Reason,Location,Staff ID,Item,SKU,Change,Available after,Line result,Shopify message,Note,Adjustment ID,Reverses adjustment ID",
      "2026-11-11T21:40:05.123Z,Reversal,Applied,Correction,Shop floor,77,Red wine,RED-75,3,10,Applied,,,op-2,op-1",
      "2026-11-11T21:40:05.123Z,Adjustment,Applied,Damaged,Shop floor,42,Red wine,RED-75,-3,7,Applied,,Dropped a case,op-1,",
      "2026-11-11T21:40:05.123Z,Adjustment,Applied,Damaged,Shop floor,42,White wine,,4,,Refused by Shopify,The item is not stocked at the location.,Dropped a case,op-1,",
      "",
    ]);
  });

  it("neutralizes text a spreadsheet would run as a formula", async () => {
    service.listAdjustmentsForExport.mockResolvedValue({
      truncated: false,
      entries: [
        entry({
          note: '=HYPERLINK("http://evil.example")',
          lines: [
            {
              ...entry().lines[0],
              title: "@SUM(A1)",
              sku: "+cmd|' /C calc'!A0",
            },
          ],
        }),
      ],
    });

    const csv = await (
      (await exportLoader(get("/app/adjustments/export"))) as Response
    ).text();

    expect(csv).toContain(",'@SUM(A1),");
    expect(csv).toContain("'+cmd|' /C calc'!A0");
    expect(csv).toContain('"\'=HYPERLINK(""http://evil.example"")"');
    // The signed change itself stays a number.
    expect(csv).toContain(",-3,7,");
  });

  it("names the file by today's date when no period is chosen and keeps unknown locations by ID", async () => {
    service.listAdjustmentsForExport.mockResolvedValue({
      truncated: false,
      entries: [entry({ locationId: "gid://shopify/Location/99" })],
    });

    const response = (await exportLoader(
      get("/app/adjustments/export"),
    )) as Response;

    expect(response.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="adjustments-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    expect(await response.text()).toContain("gid://shopify/Location/99");
  });

  it("refuses to hand over part of a period as if it were all of it", async () => {
    service.listAdjustmentsForExport.mockResolvedValue({
      truncated: true,
      entries: [entry()],
    });

    const response = (await exportLoader(
      get("/app/adjustments/export"),
    )) as Response;

    expect(response.status).toBe(422);
    expect(response.headers.get("Content-Type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.text()).toContain(
      "more than 2,000 adjustments. Choose a shorter period",
    );
  });
});
