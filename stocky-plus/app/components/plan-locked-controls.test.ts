/**
 * Without an active plan the server refuses a sync started from Home
 * (SEC-18), so the Home controls that would send one are disabled.
 */
import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { buildSetupGuide } from "../lib/setup-guide";
import { buildSyncStatusView } from "../lib/sync-status";
import { SetupGuide } from "./SetupGuide";
import { SyncStatus } from "./SyncStatus";

vi.mock("react-router", async () => {
  const actual =
    await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    Form: (props: { children?: ReactNode; method?: string }) =>
      createElement("form", { method: props.method }, props.children),
  };
});

const render = (element: ReactElement): string => renderToStaticMarkup(element);

const guide = buildSetupGuide({
  catalogSynced: false,
  locationNames: [],
  supplierCount: 0,
  purchaseOrderCount: 0,
});
const status = buildSyncStatusView([]);

function syncButtons(html: string): string[] {
  return html.match(/<s-button type="submit"[^>]*>/g) ?? [];
}

describe("Home sync controls without an active plan", () => {
  it.each([
    [
      "setup guide",
      (locked: boolean) =>
        createElement(SetupGuide, { guide, syncing: false, locked }),
    ],
    [
      "Shopify sync card",
      (locked: boolean) =>
        createElement(SyncStatus, {
          status,
          now: 0,
          submitting: false,
          locked,
        }),
    ],
  ])("disables the %s sync button only when locked", (_label, make) => {
    const locked = syncButtons(render(make(true)));
    const open = syncButtons(render(make(false)));

    expect(locked.length).toBeGreaterThan(0);
    for (const button of locked) expect(button).toContain('disabled="true"');
    for (const button of open) expect(button).not.toContain("disabled");
  });

  it("tells the merchant that starting a sync needs a plan", () => {
    const html = render(
      createElement(SyncStatus, {
        status,
        now: 0,
        submitting: false,
        locked: true,
      }),
    );
    expect(html).toContain("Starting a sync from here needs an active plan.");
  });
});
