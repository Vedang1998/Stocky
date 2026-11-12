import type { SyncHealthState } from "@prisma/client";

export type SyncStatusInput = {
  domain: string;
  state: SyncHealthState;
  detailCode: string | null;
  lastSucceededAt: string | null;
  /** A sync is queued or running and has not finished this domain. */
  syncing: boolean;
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
  /** A sync is under way, so the status will change without the merchant acting. */
  inProgress: boolean;
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

/**
 * Degraded reasons that describe the sync engine's own consistency checks.
 * The sync itself completed and its data is current. One of them
 * (absence_reconciliation_uncertain) is set after every successful sync
 * while removal of products missing from Shopify is held, so treating these
 * as a merchant problem would show a warning that syncing again cannot
 * clear. They stay visible to operators as open data issues.
 */
const INTERNAL_CHECK_CODES = new Set([
  "absence_reconciliation_uncertain",
  "catalog_reconcile_uncertain",
]);

/** The last sync's data is in, but pages built on it are still being updated. */
const FINISHING_CODE = "compatibility_projection_pending";

type MerchantState = SyncHealthState | "FINISHING";

/** The state a merchant should see, which is not always the engine's own. */
function merchantState(input: SyncStatusInput): MerchantState {
  if (input.state === "DISABLED") return "DISABLED";
  if (input.syncing) return "RUNNING";
  if (input.state !== "DEGRADED") return input.state;
  if (input.detailCode === FINISHING_CODE) return "FINISHING";
  if (
    input.detailCode !== null &&
    INTERNAL_CHECK_CODES.has(input.detailCode) &&
    input.lastSucceededAt !== null
  ) {
    return "HEALTHY";
  }
  return "DEGRADED";
}

function badgeFor(state: MerchantState): SyncStatusRow["badge"] {
  return state === "FINISHING" ? { tone: "info", text: "Finishing up" } : BADGES[state];
}

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

type MerchantStatus = { input: SyncStatusInput; state: MerchantState };

function attentionFor(statuses: MerchantStatus[]): SyncAttention | null {
  if (statuses.some(({ state }) => state === "FAILED")) {
    return {
      tone: "critical",
      heading: "The last sync did not finish",
      message:
        "Products and stock in ProPo may be out of date. Sync again; if it fails again, contact support.",
    };
  }
  const degraded = statuses.find(({ state }) => state === "DEGRADED");
  if (degraded) {
    return {
      tone: "warning",
      heading: "Some data may be out of date",
      message: degradedMessage(degraded.input.detailCode),
    };
  }
  return null;
}

/** Merchant wording for the control plane's per-domain sync health. */
export function buildSyncStatusView(inputs: SyncStatusInput[]): SyncStatusView {
  const statuses = inputs.map((input) => ({ input, state: merchantState(input) }));
  return {
    rows: statuses.map(({ input, state }) => ({
      domain: input.domain,
      label: DOMAIN_LABELS[input.domain] ?? input.domain,
      badge: badgeFor(state),
      lastSucceededAt: input.lastSucceededAt,
    })),
    attention: attentionFor(statuses),
    inProgress: statuses.some(({ state }) => state === "RUNNING"),
  };
}
