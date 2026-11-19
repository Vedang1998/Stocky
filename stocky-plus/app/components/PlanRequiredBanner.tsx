/**
 * Shown on a page whose records stay readable without an active plan while
 * its actions are refused on the server.
 */
export function PlanRequiredBanner({ records }: { records: string }) {
  return (
    <s-banner
      tone="warning"
      heading="An active ProPo plan is needed to make changes"
    >
      <s-paragraph>
        {records} can still be viewed and exported. Creating or changing them is
        unavailable until this shop has an active plan.{" "}
        <s-link href="/app/billing">Choose a plan</s-link>
      </s-paragraph>
    </s-banner>
  );
}
