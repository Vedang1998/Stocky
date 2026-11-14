import type { LocationStock, ResolvedVariant, VariantStock } from "./api-types";
import { formatLastChange, formatQuantity } from "./format";
import { splitByLocation } from "./stock-summary";

export function LookupError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <s-banner heading="Lookup failed" tone="critical">
      <s-text>{message}</s-text>
      <s-button slot="primary-action" onClick={onRetry}>
        Try again
      </s-button>
    </s-banner>
  );
}

export function identifiers(variant: ResolvedVariant): string {
  const parts = [];
  if (variant.sku) parts.push(`SKU ${variant.sku}`);
  if (variant.barcode) parts.push(`Barcode ${variant.barcode}`);
  return parts.length ? parts.join(" · ") : "No SKU or barcode";
}

export function StockDetails({
  variant,
  stock,
  loadedAt: now,
  locationId,
  onBack,
}: {
  variant: ResolvedVariant;
  stock: VariantStock | null;
  loadedAt: number;
  locationId: number | null;
  onBack: (() => void) | null;
}) {
  const locations = stock?.locations ?? [];
  const { here, elsewhere } = splitByLocation(stock, locationId);

  return (
    <s-stack direction="block" gap="base">
      <s-section heading={variant.displayName}>
        <s-stack direction="block" gap="small">
          <s-text color="subdued">{identifiers(variant)}</s-text>
          {onBack && (
            <s-button variant="secondary" onClick={onBack}>
              Back to matches
            </s-button>
          )}
        </s-stack>
      </s-section>

      {stock?.tracked === false ? (
        <s-banner heading="Inventory not tracked" tone="info">
          <s-text>Shopify isn’t tracking inventory for this product.</s-text>
        </s-banner>
      ) : locations.length === 0 ? (
        <s-banner heading="No stock records" tone="info">
          <s-text>
            This product isn’t stocked at any active location yet.
          </s-text>
        </s-banner>
      ) : (
        <>
          {here ? (
            <LocationCard title="This location" location={here} now={now} />
          ) : (
            locationId !== null && (
              <s-text color="subdued">Not stocked at this location.</s-text>
            )
          )}
          {elsewhere.length > 0 && (
            <s-section heading={here ? "Other locations" : "Locations"}>
              <s-stack direction="block" gap="small">
                {elsewhere.map((location) => (
                  <LocationRow key={location.locationGid} location={location} now={now} />
                ))}
              </s-stack>
            </s-section>
          )}
          {locations.length > 1 && stock && (
            <s-text color="subdued">
              All locations: {formatQuantity(stock.totals.available)} available,{" "}
              {formatQuantity(stock.totals.onHand)} on hand
            </s-text>
          )}
        </>
      )}
    </s-stack>
  );
}

function LocationCard({
  title,
  location,
  now,
}: {
  title: string;
  location: LocationStock;
  now: number;
}) {
  const changed = formatLastChange(location.observedAt, now);
  return (
    <s-section heading={`${title}: ${location.locationName}`}>
      <s-stack direction="block" gap="small">
        <s-text type="strong">
          {formatQuantity(location.available)} available
        </s-text>
        <s-text>
          {formatQuantity(location.onHand)} on hand ·{" "}
          {formatQuantity(location.committed)} committed ·{" "}
          {formatQuantity(location.incoming)} incoming
        </s-text>
        {changed && <s-text color="subdued">{changed}</s-text>}
      </s-stack>
    </s-section>
  );
}

function LocationRow({ location, now }: { location: LocationStock; now: number }) {
  const changed = formatLastChange(location.observedAt, now);
  return (
    <s-stack direction="block">
      <s-text type="strong">{location.locationName}</s-text>
      <s-text>
        {formatQuantity(location.available)} available ·{" "}
        {formatQuantity(location.onHand)} on hand
      </s-text>
      {changed && <s-text color="subdued">{changed}</s-text>}
    </s-stack>
  );
}
