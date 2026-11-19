import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { CountableStocktake, CountSheet } from "./api-types";
import {
  loadCountSheet,
  loadStocktakes,
  noteCounted,
  progressText,
  removeCounted,
  sendCount,
  sendScan,
  type CountedItem,
} from "./counting";
import { formatQuantity } from "./format";
import { readCount } from "./receiving";

export function Count({ onBack }: { onBack: () => void }) {
  const locationId = shopify.session.currentSession.locationId ?? null;
  const [stocktakeId, setStocktakeId] = useState<string | null>(null);

  if (stocktakeId !== null) {
    return (
      <CountSheetScreen
        stocktakeId={stocktakeId}
        locationId={locationId}
        onBack={() => setStocktakeId(null)}
      />
    );
  }
  return <StocktakeList locationId={locationId} onBack={onBack} onPick={setStocktakeId} />;
}

type ListState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; stocktakes: CountableStocktake[]; hasMore: boolean };

function StocktakeList({
  locationId,
  onBack,
  onPick,
}: {
  locationId: number | null;
  onBack: () => void;
  onPick: (id: string) => void;
}) {
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    setState({ kind: "loading" });
    void loadStocktakes(fetch, locationId, controller?.signal).then((result) => {
      if (result === null) return;
      setState(
        result.ok
          ? { kind: "ready", stocktakes: result.value.stocktakes, hasMore: result.value.hasMore }
          : { kind: "error", message: result.message },
      );
    });
    return () => controller?.abort();
  }, [locationId, attempt]);

  return (
    <s-page heading="Count stock">
      <s-scroll-box>
        <s-box padding="base">
          <s-stack direction="block" gap="base">
            <s-button variant="secondary" onClick={onBack}>
              Back to ProPo
            </s-button>
            {state.kind === "loading" && (
              <s-stack direction="inline" gap="small">
                <s-spinner />
                <s-text>Loading stocktakes…</s-text>
              </s-stack>
            )}
            {state.kind === "error" && (
              <s-banner heading="Couldn’t load stocktakes" tone="critical">
                <s-text>{state.message}</s-text>
                <s-button slot="primary-action" onClick={() => setAttempt((n) => n + 1)}>
                  Try again
                </s-button>
              </s-banner>
            )}
            {state.kind === "ready" &&
              (state.stocktakes.length === 0 ? (
                <s-section heading="Nothing to count here">
                  <s-text color="subdued">
                    No stocktake is being counted at this location. Start one in ProPo on the
                    web, then it appears here.
                  </s-text>
                </s-section>
              ) : (
                <s-stack direction="block" gap="small">
                  {state.stocktakes.map((stocktake) => (
                    <s-clickable key={stocktake.id} onClick={() => onPick(stocktake.id)}>
                      <s-box padding="small">
                        <s-stack direction="block">
                          <s-text type="strong">{stocktake.name}</s-text>
                          <s-text color="subdued">
                            {progressText(stocktake.countedCount, stocktake.lineCount)}
                            {stocktake.blind ? " · Blind count" : ""}
                          </s-text>
                        </s-stack>
                      </s-box>
                    </s-clickable>
                  ))}
                  {state.hasMore && (
                    <s-text color="subdued">
                      More stocktakes are open. Finish or cancel some in ProPo on the web.
                    </s-text>
                  )}
                </s-stack>
              ))}
          </s-stack>
        </s-box>
      </s-scroll-box>
    </s-page>
  );
}

type SheetState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; sheet: CountSheet };

type Notice = { tone: "success" | "warning" | "critical"; heading: string; detail?: string };

function CountSheetScreen({
  stocktakeId,
  locationId,
  onBack,
}: {
  stocktakeId: string;
  locationId: number | null;
  onBack: () => void;
}) {
  const [state, setState] = useState<SheetState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [items, setItems] = useState<CountedItem[]>([]);
  const [progress, setProgress] = useState({ lineCount: 0, countedCount: 0 });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState(() =>
    shopify.scanner.sources.current.value.includes("camera"),
  );
  const busyRef = useRef(false);

  useEffect(() => {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    setState({ kind: "loading" });
    void loadCountSheet(fetch, locationId, stocktakeId, controller?.signal).then((result) => {
      if (result === null) return;
      if (!result.ok) {
        setState({ kind: "error", message: result.message });
        return;
      }
      const sheet = result.value;
      setItems(
        sheet.counted.flatMap((line) =>
          line.countedQty === null
            ? []
            : [{ lineId: line.lineId, title: line.title, countedQty: line.countedQty }],
        ),
      );
      setProgress({ lineCount: sheet.stocktake.lineCount, countedCount: sheet.stocktake.countedCount });
      setState({ kind: "ready", sheet });
    });
    return () => controller?.abort();
  }, [locationId, stocktakeId, attempt]);

  const scan = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setNotice(null);
      const result = await sendScan(fetch, locationId, stocktakeId, code);
      busyRef.current = false;
      setBusy(false);

      if (!result.ok) {
        setNotice({ tone: "critical", heading: "Scan not confirmed", detail: result.message });
        return;
      }
      setProgress(result.value.progress);
      if (!result.value.ok) {
        setNotice({ tone: "warning", heading: `“${code}” wasn’t counted`, detail: result.value.message });
        return;
      }
      const { line } = result.value;
      if (line.countedQty !== null) {
        setItems((current) =>
          noteCounted(current, { lineId: line.lineId, title: line.title, countedQty: line.countedQty! }),
        );
      }
      setNotice({
        tone: "success",
        heading: `${line.title}: ${formatQuantity(line.countedQty ?? 0)} counted`,
        detail: line.added ? "Added to this count." : undefined,
      });
    },
    [locationId, stocktakeId],
  );

  useEffect(() => {
    // Subscribing replays the last scan, which may predate this screen.
    let listening = false;
    const stopScans = shopify.scanner.scannerData.current.subscribe((result) => {
      if (!listening || !result.data) return;
      if (result.source === "camera") shopify.scanner.hideCameraScanner();
      void scan(result.data);
    });
    listening = true;
    const stopSources = shopify.scanner.sources.current.subscribe((sources) =>
      setCameraAvailable(sources.includes("camera")),
    );
    return () => {
      stopScans();
      stopSources();
    };
  }, [scan]);

  const setLine = async (item: CountedItem, value: number | null) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    const result = await sendCount(fetch, locationId, stocktakeId, item.lineId, value);
    busyRef.current = false;
    setBusy(false);
    if (!result.ok) {
      setNotice({ tone: "critical", heading: "Count not saved", detail: result.message });
      return;
    }
    setProgress(result.value.progress);
    if (!result.value.ok) {
      setNotice({ tone: "warning", heading: "Count not saved", detail: result.value.message });
      return;
    }
    setItems((current) =>
      value === null
        ? removeCounted(current, item.lineId)
        : noteCounted(current, { ...item, countedQty: value }),
    );
  };

  return (
    <s-page heading={state.kind === "ready" ? state.sheet.stocktake.name : "Count stock"}>
      <s-scroll-box>
        <s-box padding="base">
          <s-stack direction="block" gap="base">
            <s-button variant="secondary" onClick={onBack}>
              Back to stocktakes
            </s-button>
            {state.kind === "loading" && (
              <s-stack direction="inline" gap="small">
                <s-spinner />
                <s-text>Loading the count…</s-text>
              </s-stack>
            )}
            {state.kind === "error" && (
              <s-banner heading="Couldn’t load this count" tone="critical">
                <s-text>{state.message}</s-text>
                <s-button slot="primary-action" onClick={() => setAttempt((n) => n + 1)}>
                  Try again
                </s-button>
              </s-banner>
            )}
            {state.kind === "ready" && (
              <s-stack direction="block" gap="base">
                <s-text color="subdued">
                  {progressText(progress.countedCount, progress.lineCount)}
                  {state.sheet.stocktake.blind ? " · Blind count: expected quantities stay hidden" : ""}
                </s-text>
                <s-search-field
                  placeholder="Scan or enter a barcode or SKU"
                  disabled={busy}
                  onChange={(event) => void scan(event.currentTarget.value ?? "")}
                />
                {cameraAvailable && (
                  <s-button onClick={() => shopify.scanner.showCameraScanner()}>
                    Scan with camera
                  </s-button>
                )}
                {notice && (
                  <s-banner heading={notice.heading} tone={notice.tone}>
                    {notice.detail && <s-text>{notice.detail}</s-text>}
                  </s-banner>
                )}
                {items.length === 0 ? (
                  <s-text color="subdued">
                    Scan items to count them. Each scan adds one unit.
                  </s-text>
                ) : (
                  items.map((item) => (
                    <CountedRow
                      key={item.lineId}
                      item={item}
                      disabled={busy}
                      onSet={(value) => void setLine(item, value)}
                    />
                  ))
                )}
                {state.sheet.hasMoreCounted && (
                  <s-text color="subdued">
                    Only some counted items are listed. Scan an item to see its count.
                  </s-text>
                )}
              </s-stack>
            )}
          </s-stack>
        </s-box>
      </s-scroll-box>
    </s-page>
  );
}

function CountedRow({
  item,
  disabled,
  onSet,
}: {
  item: CountedItem;
  disabled: boolean;
  onSet: (value: number | null) => void;
}) {
  return (
    <s-section heading={item.title}>
      <s-stack direction="inline" gap="small">
        <s-button disabled={disabled || item.countedQty <= 0} onClick={() => onSet(item.countedQty - 1)}>
          −
        </s-button>
        <s-number-field
          label="Counted"
          value={String(item.countedQty)}
          inputMode="numeric"
          disabled={disabled}
          onChange={(event) => onSet(readCount(event.currentTarget.value))}
        />
        <s-button disabled={disabled} onClick={() => onSet(item.countedQty + 1)}>
          +
        </s-button>
        <s-button tone="critical" disabled={disabled} onClick={() => onSet(null)}>
          Clear
        </s-button>
      </s-stack>
    </s-section>
  );
}
