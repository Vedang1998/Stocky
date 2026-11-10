import { render } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { LocationStock, ResolvedVariant, VariantStock } from "./api-types";
import { formatObservedAt, formatQuantity, isStale } from "./format";
import { MESSAGES, lookupCode, lookupVariant, type LookupView } from "./lookup";

export default async () => {
  render(<StockLookup />, document.body);
};

type ChooseView = Extract<LookupView, { kind: "choose" }>;
type Load = (signal: AbortSignal | undefined) => Promise<LookupView | null>;

function StockLookup() {
  const locationId = shopify.session.currentSession.locationId ?? null;
  const [view, setView] = useState<LookupView>({ kind: "idle" });
  const [choices, setChoices] = useState<ChooseView | null>(null);
  const [cameraAvailable, setCameraAvailable] = useState(() =>
    shopify.scanner.sources.current.value.includes("camera"),
  );
  const sequenceRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const lastRequestRef = useRef<{ label: string; load: Load } | null>(null);

  const run = useCallback(async (label: string, load: Load) => {
    lastRequestRef.current = { label, load };
    sequenceRef.current += 1;
    const current = sequenceRef.current;
    controllerRef.current?.abort();
    controllerRef.current =
      typeof AbortController === "function" ? new AbortController() : null;

    setView({ kind: "loading", label });
    const next = await load(controllerRef.current?.signal);
    // A newer scan replaced this one while it was in flight.
    if (next === null || current !== sequenceRef.current) return;
    setView(next);
    if (next.kind === "choose") setChoices(next);
  }, []);

  const search = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (!code) return;
      setChoices(null);
      void run(code, (signal) => lookupCode(fetch, code, locationId, signal));
    },
    [run, locationId],
  );

  const pick = useCallback(
    (variant: ResolvedVariant) => {
      void run(variant.displayName, (signal) =>
        lookupVariant(fetch, variant.variantGid, locationId, signal),
      );
    },
    [run, locationId],
  );

  const retry = useCallback(() => {
    const last = lastRequestRef.current;
    if (last) void run(last.label, last.load);
  }, [run]);

  useEffect(() => {
    // Subscribing replays the last scan, which may predate this screen.
    let listening = false;
    const stopScans = shopify.scanner.scannerData.current.subscribe((result) => {
      if (!listening || !result.data) return;
      if (result.source === "camera") shopify.scanner.hideCameraScanner();
      search(result.data);
    });
    listening = true;
    const stopSources = shopify.scanner.sources.current.subscribe((sources) =>
      setCameraAvailable(sources.includes("camera")),
    );
    return () => {
      stopScans();
      stopSources();
      controllerRef.current?.abort();
    };
  }, [search]);

  return (
    <s-page heading="Inventory lookup">
      <s-scroll-box>
        <s-box padding="base">
          <s-stack direction="block" gap="base">
            <s-search-field
              placeholder="Scan or enter a barcode or SKU"
              onChange={(event) => search(event.currentTarget.value ?? "")}
            />
            {cameraAvailable && (
              <s-button onClick={() => shopify.scanner.showCameraScanner()}>
                Scan with camera
              </s-button>
            )}
            <LookupResult
              view={view}
              locationId={locationId}
              choices={choices}
              onPick={pick}
              onRetry={retry}
              onBackToChoices={() => choices && setView(choices)}
            />
          </s-stack>
        </s-box>
      </s-scroll-box>
    </s-page>
  );
}

function LookupResult({
  view,
  locationId,
  choices,
  onPick,
  onRetry,
  onBackToChoices,
}: {
  view: LookupView;
  locationId: number | null;
  choices: ChooseView | null;
  onPick: (variant: ResolvedVariant) => void;
  onRetry: () => void;
  onBackToChoices: () => void;
}) {
  switch (view.kind) {
    case "idle":
      return (
        <s-text color="subdued">
          Scan with the camera or a connected scanner, or type a barcode or SKU
          and press Search.
        </s-text>
      );
    case "loading":
      return (
        <s-stack direction="inline" gap="small">
          <s-spinner />
          <s-text>Looking up {view.label}…</s-text>
        </s-stack>
      );
    case "error":
      return (
        <s-banner heading="Lookup failed" tone="critical">
          <s-text>{view.message}</s-text>
          <s-button slot="primary-action" onClick={onRetry}>
            Try again
          </s-button>
        </s-banner>
      );
    case "invalid":
      return (
        <s-banner heading="Nothing to look up" tone="warning">
          <s-text>{MESSAGES.unreadable}</s-text>
        </s-banner>
      );
    case "unknown":
      return (
        <s-section heading="No match">
          <s-stack direction="block" gap="small">
            <s-text>
              No product in this store has the barcode or SKU {view.code}.
            </s-text>
            <s-text color="subdued">
              Products added in Shopify appear here after ProPo’s next catalog
              sync.
            </s-text>
          </s-stack>
        </s-section>
      );
    case "choose":
      return <CandidateList view={view} onPick={onPick} />;
    case "stock":
      return (
        <StockDetails
          variant={view.variant}
          stock={view.stock}
          loadedAt={view.loadedAt}
          locationId={locationId}
          onBack={choices ? onBackToChoices : null}
        />
      );
  }
}

function CandidateList({
  view,
  onPick,
}: {
  view: ChooseView;
  onPick: (variant: ResolvedVariant) => void;
}) {
  const field = view.matchedOn === "sku" ? "SKU" : "barcode";
  return (
    <s-section heading={`${view.candidates.length} products share this ${field}`}>
      <s-stack direction="block" gap="small">
        <s-text color="subdued">Choose the product you scanned.</s-text>
        {view.candidates.map((variant) => (
          <s-clickable key={variant.variantGid} onClick={() => onPick(variant)}>
            <s-box padding="small">
              <s-stack direction="block">
                <s-text type="strong">{variant.displayName}</s-text>
                <s-text color="subdued">{identifiers(variant)}</s-text>
              </s-stack>
            </s-box>
          </s-clickable>
        ))}
        {view.truncated && (
          <s-text color="subdued">
            More products share {view.code}. Give each product its own barcode
            in Shopify so scans find one product.
          </s-text>
        )}
      </s-stack>
    </s-section>
  );
}

function identifiers(variant: ResolvedVariant): string {
  const parts = [];
  if (variant.sku) parts.push(`SKU ${variant.sku}`);
  if (variant.barcode) parts.push(`Barcode ${variant.barcode}`);
  return parts.length ? parts.join(" · ") : "No SKU or barcode";
}

function StockDetails({
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
  const currentGid =
    locationId === null ? null : `gid://shopify/Location/${locationId}`;
  const locations = stock?.locations ?? [];
  const here = locations.find((l) => l.locationGid === currentGid) ?? null;
  const elsewhere = locations.filter((l) => l !== here);

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
            currentGid && (
              <s-text color="subdued">
                Not stocked at this location.
              </s-text>
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
  const updated = formatObservedAt(location.observedAt, now);
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
        {updated && <Freshness label={updated} stale={isStale(location.observedAt, now)} />}
      </s-stack>
    </s-section>
  );
}

function LocationRow({ location, now }: { location: LocationStock; now: number }) {
  const updated = formatObservedAt(location.observedAt, now);
  return (
    <s-stack direction="block">
      <s-text type="strong">{location.locationName}</s-text>
      <s-text>
        {formatQuantity(location.available)} available ·{" "}
        {formatQuantity(location.onHand)} on hand
      </s-text>
      {updated && <Freshness label={updated} stale={isStale(location.observedAt, now)} />}
    </s-stack>
  );
}

function Freshness({ label, stale }: { label: string; stale: boolean }) {
  return stale ? (
    <s-badge tone="warning">{label}</s-badge>
  ) : (
    <s-text color="subdued">{label}</s-text>
  );
}
