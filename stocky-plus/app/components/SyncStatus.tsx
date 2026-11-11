import { Form } from "react-router";
import { formatObservedAt } from "../../extensions/propo-pos/src/format";
import type { SyncAttention, SyncStatusView } from "../lib/sync-status";

/** Shown at the top of Home when the last sync failed or is incomplete. */
export function SyncAttentionBanner({ attention }: { attention: SyncAttention }) {
  return (
    <s-banner tone={attention.tone} heading={attention.heading}>
      <s-paragraph>{attention.message}</s-paragraph>
    </s-banner>
  );
}

/** Per-domain sync state with the manual sync button. */
export function SyncStatus({
  status,
  now,
  syncing,
}: {
  status: SyncStatusView;
  now: number;
  syncing: boolean;
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
              {formatObservedAt(row.lastSucceededAt, now) ?? "No completed sync yet"}
            </s-text>
          </s-stack>
        ))}
        <s-text color="subdued">
          Changes in Shopify arrive on their own. Sync again if something
          looks out of date.
        </s-text>
        <Form method="post">
          <input type="hidden" name="intent" value="syncCatalog" />
          <s-button
            type="submit"
            variant="primary"
            {...(syncing ? { loading: true } : {})}
          >
            Sync catalog
          </s-button>
        </Form>
      </s-stack>
    </s-section>
  );
}
