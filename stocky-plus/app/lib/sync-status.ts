import type { SyncHealthState } from "@prisma/client";

export type SyncStatusInput = {
  domain: string;
  state: SyncHealthState;
  detailCode: string | null;
  lastSucceededAt: string | null;
};

export type SyncBadgeTone = "success" | "info" | "warning" | "critical" | "neutral";

export type SyncStatusRow = {
  domain: string;
  label: string;
  badge: { tone: SyncBadgeTone; text: string };
  lastSucceededAt: string | null;
};

export type SyncAttention = {
  tone: "warning" | "critical";
  heading: string;
  message: string;
};

export type SyncStatusView = {
  rows: SyncStatusRow[];
  /** Set when the merchant should know their data may be out of date. */
  attention: SyncAttention | null;
};

const DOMAIN_LABELS: Record<string, string> = {
  locations: "Locations",
  catalog: "Products",
  inventory_levels: "Inventory levels",
};

const BADGES: Record<SyncHealthState, SyncStatusRow["badge"]> = {
  HEALTHY: { tone: "success", text: "Up to date" },
  RUNNING: { tone: "info", text: "Syncing" },
  NEVER_STARTED: { tone: "neutral", text: "Not synced yet" },
  DEGRADED: { tone: "warning", text: "Needs attention" },
  FAILED: { tone: "critical", text: "Failed" },
  DISABLED: { tone: "neutral", text: "Paused" },
};

function degradedMessage(detailCode: string | null): string {
  switch (detailCode) {
    case "retry_wait":
      return "ProPo is retrying part of the last sync. You don't need to do anything unless this message is still here in an hour.";
    case "authoritative_quantity_unknown":
      return "Shopify has not reported a quantity for some inventory. Those quantities show as a dash until the next sync.";
    default:
      return "Part of the last sync did not complete. Sync again to refresh your data.";
  }
}

function attentionFor(inputs: SyncStatusInput[]): SyncAttention | null {
  if (inputs.some((input) => input.state === "FAILED")) {
    return {
      tone: "critical",
      heading: "The last sync did not finish",
      message:
        "Products and stock in ProPo may be out of date. Sync again; if it fails again, contact support.",
    };
  }
  const degraded = inputs.find((input) => input.state === "DEGRADED");
  if (degraded) {
    return {
      tone: "warning",
      heading: "Some data may be out of date",
      message: degradedMessage(degraded.detailCode),
    };
  }
  return null;
}

/** Merchant wording for the control plane's per-domain sync health. */
export function buildSyncStatusView(inputs: SyncStatusInput[]): SyncStatusView {
  return {
    rows: inputs.map((input) => ({
      domain: input.domain,
      label: DOMAIN_LABELS[input.domain] ?? input.domain,
      badge: BADGES[input.state],
      lastSucceededAt: input.lastSucceededAt,
    })),
    attention: attentionFor(inputs),
  };
}
