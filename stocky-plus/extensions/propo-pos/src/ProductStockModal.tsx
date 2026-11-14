import { render } from "preact";
import { MESSAGES } from "./lookup";
import { variantGidFromPosId } from "./stock-summary";
import { LookupError, StockDetails } from "./stock-views";
import { useVariantStock } from "./use-variant-stock";

export default async () => {
  render(<ProductStockModal />, document.body);
};

function ProductStockModal() {
  const variantGid = variantGidFromPosId(shopify.product.variantId);
  const locationId = shopify.session.currentSession.locationId ?? null;
  return (
    <s-page heading="Stock by location">
      <s-scroll-box>
        <s-box padding="base">
          {variantGid ? (
            <ProductStock variantGid={variantGid} locationId={locationId} />
          ) : (
            <s-text color="subdued">{MESSAGES.noVariant}</s-text>
          )}
        </s-box>
      </s-scroll-box>
    </s-page>
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
      return (
        <s-stack direction="inline" gap="small">
          <s-spinner />
          <s-text>Loading stock…</s-text>
        </s-stack>
      );
    case "error":
      return <LookupError message={view.message} onRetry={reload} />;
    case "stock":
      return (
        <StockDetails
          variant={view.variant}
          stock={view.stock}
          loadedAt={view.loadedAt}
          locationId={locationId}
          onBack={null}
        />
      );
  }
}
