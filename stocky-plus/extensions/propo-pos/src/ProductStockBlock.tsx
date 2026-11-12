import { render } from "preact";
import type { VariantStock } from "./api-types";
import { formatLastChange, formatQuantity } from "./format";
import { MESSAGES } from "./lookup";
import { summarizeStock, variantGidFromPosId } from "./stock-summary";
import { useVariantStock } from "./use-variant-stock";

export default async () => {
  render(<ProductStockBlock />, document.body);
};

function ProductStockBlock() {
  const variantGid = variantGidFromPosId(shopify.product.variantId);
  const locationId = shopify.session.currentSession.locationId ?? null;
  return (
    <s-pos-block heading="ProPo stock">
      {variantGid ? (
        <ProductStock variantGid={variantGid} locationId={locationId} />
      ) : (
        <s-text color="subdued">{MESSAGES.noVariant}</s-text>
      )}
    </s-pos-block>
  );
}

function ProductStock({
  variantGid,
  locationId,
}: {
  variantGid: string;
  locationId: number | null;
}) {
  const { view, reload } = useVariantStock(variantGid, locationId);
  switch (view.kind) {
    case "loading":
      return <s-text color="subdued">Loading stock…</s-text>;
    case "error":
      return (
        <s-stack direction="block" gap="small">
          <s-text>{view.message}</s-text>
          <s-button onClick={reload}>Try again</s-button>
        </s-stack>
      );
    case "stock":
      return (
        <StockSummary
          stock={view.stock}
          loadedAt={view.loadedAt}
          locationId={locationId}
        />
      );
  }
}

function StockSummary({
  stock,
  loadedAt: now,
  locationId,
}: {
  stock: VariantStock | null;
  loadedAt: number;
  locationId: number | null;
}) {
  const summary = summarizeStock(stock, locationId);
  if (summary.kind === "untracked") {
    return (
      <s-text color="subdued">
        Shopify isn’t tracking inventory for this product.
      </s-text>
    );
  }
  if (summary.kind === "unstocked") {
    return (
      <s-text color="subdued">
        This product isn’t stocked at any active location yet.
      </s-text>
    );
  }

  const { here, locationKnown, locationCount, totals } = summary;
  const changed = here ? formatLastChange(here.observedAt, now) : null;
  return (
    <>
      {/* The block's slot only takes direct children of s-pos-block. */}
      <s-button
        slot="secondary-actions"
        onClick={() => shopify.action.presentModal()}
      >
        View by location
      </s-button>
      <s-stack direction="block" gap="small">
        {here ? (
          <>
            <s-text type="strong">
              {formatQuantity(here.available)} available at {here.locationName}
            </s-text>
            <s-text>
              {formatQuantity(here.onHand)} on hand ·{" "}
              {formatQuantity(here.committed)} committed ·{" "}
              {formatQuantity(here.incoming)} incoming
            </s-text>
            {changed && <s-text color="subdued">{changed}</s-text>}
          </>
        ) : (
          locationKnown && <s-text>Not stocked at this location.</s-text>
        )}
        {(locationCount > 1 || !here) && (
          <s-text color="subdued">
            {locationCount === 1 ? "1 location" : `${locationCount} locations`}:{" "}
            {formatQuantity(totals.available)} available,{" "}
            {formatQuantity(totals.onHand)} on hand
          </s-text>
        )}
      </s-stack>
    </>
  );
}
