import { Form } from "react-router";
import { formatAge } from "../lib/stock-format";
import type { SyncAttention, SyncStatusView } from "../lib/sync-status";

/** Shown at the top of Home when the last sync failed or is incomplete. */
export function SyncAttentionBanner({ attention }: { attention: SyncAttention }) {
  return (
    <s-banner tone={attention.tone} heading={attention.heading}>
      <s-paragraph>{attention.message}</s-paragraph>
    </s-banner>
  );
}

function syncedLabel(lastSucceededAt: string | null, now: number): string {
  const age = formatAge(lastSucceededAt, now);
  return age === null ? "No completed sync yet" : `Last synced ${age}`;
}

/** Per-domain sync state with the manual sync button. */
export function SyncStatus({
  status,
  now,
  submitting,
}: {
  status: SyncStatusView;
  now: number;
  /** The sync request itself is being sent. */
  submitting: boolean;
}) {
  return (
    <s-section slot="aside" heading="Shopify sync">
      <s-stack gap="base">
        {status.rows.map((row) => (
          <s-stack key={row.domain} gap="small-300">
            <s-stack direction="inline" gap="small" alignItems="center">
              <s-text type="strong">{row.label}</s-text>
              <s-badge tone={row.badge.tone}>{row.badge.text}</s-badge>
            </s-stack>
            <s-text color="subdued">
              {syncedLabel(row.lastSucceededAt, now)}
            </s-text>
          </s-stack>
        ))}
        <s-text color="subdued">
          {status.inProgress
            ? "ProPo is copying your catalog from Shopify. This updates on its own; a large catalog can take several minutes."
            : "Changes in Shopify arrive on their own. Sync again if something looks out of date."}
        </s-text>
        <Form method="post">
          <input type="hidden" name="intent" value="syncCatalog" />
          {/* The server ignores a request made during a sync, so do not offer one. */}
          <s-button
            type="submit"
            variant="primary"
            {...(submitting ? { loading: true } : {})}
            {...(status.inProgress ? { disabled: true } : {})}
          >
            {status.inProgress ? "Sync in progress" : "Sync catalog"}
          </s-button>
        </Form>
      </s-stack>
    </s-section>
  );
}
