import { render } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { ResolvedVariant } from "./api-types";
import { MESSAGES, lookupCode, lookupVariant, type LookupView } from "./lookup";
import { LookupError, StockDetails, identifiers } from "./stock-views";

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
      return <LookupError message={view.message} onRetry={onRetry} />;
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
