import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type {
  ReceivableOrder,
  ReceiptRequest,
  ReceivingLine,
  ReceivingSheet,
} from "./api-types";
import {
  afterSubmit,
  bumpCount,
  createSubmissionKey,
  describeOrder,
  loadOrders,
  loadSheet,
  matchLine,
  newSubmissionKey,
  overReceived,
  readCount,
  receiptRequest,
  setCount,
  submitReceipt,
  totalUnits,
  withoutSubmitted,
  type Counts,
} from "./receiving";
import { formatQuantity } from "./format";

export function Receive({ onBack }: { onBack: () => void }) {
  const locationId = shopify.session.currentSession.locationId ?? null;
  const [orderId, setOrderId] = useState<string | null>(null);

  if (orderId !== null) {
    return (
      <ReceiveOrder
        orderId={orderId}
        locationId={locationId}
        onBack={() => setOrderId(null)}
      />
    );
  }
  return <OrderList locationId={locationId} onBack={onBack} onPick={setOrderId} />;
}

type ListState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; orders: ReceivableOrder[]; enabled: boolean; hasMore: boolean };

function OrderList({
  locationId,
  onBack,
  onPick,
}: {
  locationId: number | null;
  onBack: () => void;
  onPick: (orderId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    setState({ kind: "loading" });
    void loadOrders(fetch, locationId, search, controller?.signal).then((result) => {
      if (result === null) return;
      setState(
        result.ok
          ? {
              kind: "ready",
              orders: result.value.orders,
              enabled: result.value.receivingEnabled,
              hasMore: result.value.hasMore,
            }
          : { kind: "error", message: result.message },
      );
    });
    return () => controller?.abort();
  }, [locationId, search, attempt]);

  return (
    <s-page heading="Receive a delivery">
      <s-scroll-box>
        <s-box padding="base">
          <s-stack direction="block" gap="base">
            <s-button variant="secondary" onClick={onBack}>
              Back to ProPo
            </s-button>
            <s-search-field
              placeholder="Search by PO number or supplier"
              onChange={(event) => setSearch(event.currentTarget.value ?? "")}
            />
            {state.kind === "loading" && (
              <s-stack direction="inline" gap="small">
                <s-spinner />
                <s-text>Loading purchase orders…</s-text>
              </s-stack>
            )}
            {state.kind === "error" && (
              <s-banner heading="Couldn’t load purchase orders" tone="critical">
                <s-text>{state.message}</s-text>
                <s-button slot="primary-action" onClick={() => setAttempt((n) => n + 1)}>
                  Try again
                </s-button>
              </s-banner>
            )}
            {state.kind === "ready" && (
              <OrderChoices
                orders={state.orders}
                enabled={state.enabled}
                hasMore={state.hasMore}
                searching={search.trim() !== ""}
                onPick={onPick}
              />
            )}
          </s-stack>
        </s-box>
      </s-scroll-box>
    </s-page>
  );
}

function OrderChoices({
  orders,
  enabled,
  hasMore,
  searching,
  onPick,
}: {
  orders: ReceivableOrder[];
  enabled: boolean;
  hasMore: boolean;
  searching: boolean;
  onPick: (orderId: string) => void;
}) {
  return (
    <s-stack direction="block" gap="small">
      {!enabled && (
        <s-banner heading="Receiving is turned off for this store" tone="info">
          <s-text>
            You can look at orders, but receiving stock isn’t available until it is turned on.
          </s-text>
        </s-banner>
      )}
      {orders.length === 0 ? (
        <s-section heading={searching ? "No matching orders" : "Nothing to receive here"}>
          <s-text color="subdued">
            {searching
              ? "No order on its way to this location matches that search."
              : "No purchase orders are on their way to this location. Orders must be sent or marked as ordered, and set to deliver here."}
          </s-text>
        </s-section>
      ) : (
        orders.map((order) => (
          <s-clickable key={order.id} onClick={() => onPick(order.id)}>
            <s-box padding="small">
              <s-stack direction="block">
                <s-text type="strong">{order.poNumber}</s-text>
                <s-text color="subdued">{describeOrder(order)}</s-text>
              </s-stack>
            </s-box>
          </s-clickable>
        ))
      )}
      {hasMore && (
        <s-text color="subdued">
          More orders match. Search by PO number or supplier to narrow the list.
        </s-text>
      )}
    </s-stack>
  );
}

type SheetState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; sheet: ReceivingSheet };

type Notice = { tone: "success" | "warning" | "critical"; heading: string; detail?: string };

function ReceiveOrder({
  orderId,
  locationId,
  onBack,
}: {
  orderId: string;
  locationId: number | null;
  onBack: () => void;
}) {
  const [state, setState] = useState<SheetState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [counts, setCounts] = useState<Counts>({});
  const [allowOver, setAllowOver] = useState(false);
  // The exact request of a receipt whose outcome is not settled yet. While it
  // is set the counts are frozen and Receive repeats this request unchanged.
  const [unfinished, setUnfinished] = useState<ReceiptRequest | null>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [cameraAvailable, setCameraAvailable] = useState(() =>
    shopify.scanner.sources.current.value.includes("camera"),
  );
  const submissionKey = useMemo(() => createSubmissionKey(newSubmissionKey), []);
  const linesRef = useRef<readonly ReceivingLine[]>([]);
  const scanOpenRef = useRef(false);
  const sendingRef = useRef(false);

  useEffect(() => {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    setState({ kind: "loading" });
    void loadSheet(fetch, locationId, orderId, controller?.signal).then((result) => {
      if (result === null) return;
      setState(
        result.ok
          ? { kind: "ready", sheet: result.value }
          : { kind: "error", message: result.message },
      );
    });
    return () => controller?.abort();
  }, [locationId, orderId, attempt]);

  const readyLines = state.kind === "ready" ? state.sheet.lines : null;
  const receivable =
    state.kind === "ready" && state.sheet.receivingEnabled && state.sheet.denial === null;
  useEffect(() => {
    linesRef.current = readyLines ?? [];
    // Scans only count while there is a sheet to count against and the
    // counts are not frozen behind an unfinished receipt.
    scanOpenRef.current = receivable && unfinished === null;
  }, [readyLines, receivable, unfinished]);

  const scan = useCallback((raw: string) => {
    const code = raw.trim();
    if (!code || !scanOpenRef.current) return;
    const line = matchLine(linesRef.current, code);
    if (!line) {
      setNotice({
        tone: "warning",
        heading: `“${code}” isn’t on this order`,
        detail: "Check the barcode, or count it as another item after the order is updated.",
      });
      return;
    }
    setNotice(null);
    setLineErrors({});
    setCounts((current) => bumpCount(current, line.lineItemId, 1));
  }, []);

  useEffect(() => {
    // Subscribing replays the last scan, which may predate this screen.
    let listening = false;
    const stopScans = shopify.scanner.scannerData.current.subscribe((result) => {
      if (!listening || !result.data) return;
      if (result.source === "camera") shopify.scanner.hideCameraScanner();
      scan(result.data);
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

  const receive = async () => {
    if (state.kind !== "ready" || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setNotice(null);
    setLineErrors({});
    const request = unfinished ?? receiptRequest(submissionKey.get(), counts, allowOver);
    const result = await submitReceipt(fetch, locationId, orderId, request);
    sendingRef.current = false;
    setSending(false);

    const step = afterSubmit(result);
    if (step.startOver) {
      // Start the next delivery fresh: a new key, and only the units that were
      // not part of this request (scanned while it was in flight) stay counted.
      submissionKey.reset();
      setAllowOver(false);
      setCounts((current) => withoutSubmitted(current, request));
    }
    setUnfinished(step.freeze ? request : null);
    setLineErrors(step.lineErrors);
    setNotice(step.notice);
    if (result.ok && result.value.sheet !== null) {
      setState({ kind: "ready", sheet: result.value.sheet });
    }
    if (step.reload) setAttempt((n) => n + 1);
  };

  const heading =
    state.kind === "ready" ? `Receive ${state.sheet.order.poNumber}` : "Receive a delivery";

  return (
    <s-page heading={heading}>
      <s-scroll-box>
        <s-box padding="base">
          <s-stack direction="block" gap="base">
            <s-button variant="secondary" onClick={onBack}>
              Back to purchase orders
            </s-button>
            {state.kind === "loading" && (
              <s-stack direction="inline" gap="small">
                <s-spinner />
                <s-text>Loading the order…</s-text>
              </s-stack>
            )}
            {state.kind === "error" && (
              <s-banner heading="Couldn’t load this order" tone="critical">
                <s-text>{state.message}</s-text>
                <s-button slot="primary-action" onClick={() => setAttempt((n) => n + 1)}>
                  Try again
                </s-button>
              </s-banner>
            )}
            {notice && (
              <s-banner heading={notice.heading} tone={notice.tone}>
                {notice.detail && <s-text>{notice.detail}</s-text>}
              </s-banner>
            )}
            {state.kind === "ready" && (
              <SheetBody
                sheet={state.sheet}
                counts={counts}
                lineErrors={lineErrors}
                allowOver={allowOver}
                frozen={unfinished !== null}
                sending={sending}
                cameraAvailable={cameraAvailable}
                onScan={scan}
                onCount={(lineItemId, value) => {
                  setLineErrors({});
                  setCounts((current) => setCount(current, lineItemId, value));
                }}
                onBump={(lineItemId, delta) => {
                  setLineErrors({});
                  setCounts((current) => bumpCount(current, lineItemId, delta));
                }}
                onAllowOver={setAllowOver}
                onReceive={() => void receive()}
              />
            )}
          </s-stack>
        </s-box>
      </s-scroll-box>
    </s-page>
  );
}

function SheetBody({
  sheet,
  counts,
  lineErrors,
  allowOver,
  frozen,
  sending,
  cameraAvailable,
  onScan,
  onCount,
  onBump,
  onAllowOver,
  onReceive,
}: {
  sheet: ReceivingSheet;
  counts: Counts;
  lineErrors: Record<string, string>;
  allowOver: boolean;
  /** An earlier receipt is unfinished: the counts are fixed and Receive repeats it. */
  frozen: boolean;
  sending: boolean;
  cameraAvailable: boolean;
  onScan: (code: string) => void;
  onCount: (lineItemId: string, value: number) => void;
  onBump: (lineItemId: string, delta: number) => void;
  onAllowOver: (value: boolean) => void;
  onReceive: () => void;
}) {
  const units = totalUnits(counts);
  const over = overReceived(sheet.lines, counts);
  const blocked = !sheet.receivingEnabled || sheet.denial !== null;
  const canReceive = frozen
    ? !sending
    : !blocked && !sending && units > 0 && (over.length === 0 || allowOver);
  const [fieldKey, setFieldKey] = useState(0);

  return (
    <s-stack direction="block" gap="base">
      <s-text color="subdued">From {sheet.order.supplierName}</s-text>
      {!sheet.receivingEnabled && (
        <s-banner heading="Receiving is turned off for this store" tone="info">
          <s-text>Nothing can be received until it is turned on.</s-text>
        </s-banner>
      )}
      {sheet.denial && (
        <s-banner heading="This order can’t be received" tone="warning">
          <s-text>{sheet.denial}</s-text>
        </s-banner>
      )}
      {frozen && (
        <s-banner heading="Finish the last receipt first" tone="info">
          <s-text>
            The counts are locked until it is finished. Press Receive to repeat it; it is never
            counted twice.
          </s-text>
        </s-banner>
      )}
      {!blocked && !frozen && (
        <s-stack direction="block" gap="small">
          <s-search-field
            key={fieldKey}
            placeholder="Scan or enter a barcode or SKU"
            onChange={(event) => {
              onScan(event.currentTarget.value ?? "");
              // Empty the field so the same code can be entered again.
              setFieldKey((key) => key + 1);
            }}
          />
          {cameraAvailable && (
            <s-button onClick={() => shopify.scanner.showCameraScanner()}>
              Scan with camera
            </s-button>
          )}
        </s-stack>
      )}

      {sheet.lines.map((line) => (
        <LineRow
          key={line.lineItemId}
          line={line}
          count={counts[line.lineItemId] ?? 0}
          error={lineErrors[line.lineItemId] ?? null}
          disabled={blocked || sending || frozen}
          onCount={(value) => onCount(line.lineItemId, value)}
          onBump={(delta) => onBump(line.lineItemId, delta)}
        />
      ))}

      {!frozen && over.length > 0 && (
        <s-banner heading="More than the order expects" tone="warning">
          <s-stack direction="block" gap="small">
            <s-text>
              {over.length === 1 ? "One item has" : `${over.length} items have`} more units
              counted than are still expected. Turn this on to accept the extra units.
            </s-text>
            <s-switch
              label="Accept more than ordered"
              checked={allowOver}
              onChange={(event) => onAllowOver(event.currentTarget.checked === true)}
            />
          </s-stack>
        </s-banner>
      )}

      <s-button variant="primary" disabled={!canReceive} loading={sending} onClick={onReceive}>
        {frozen
          ? "Finish the last receipt"
          : units > 0
            ? `Receive ${formatQuantity(units)} ${units === 1 ? "unit" : "units"}`
            : "Receive"}
      </s-button>
    </s-stack>
  );
}

function LineRow({
  line,
  count,
  error,
  disabled,
  onCount,
  onBump,
}: {
  line: ReceivingLine;
  count: number;
  error: string | null;
  disabled: boolean;
  onCount: (value: number) => void;
  onBump: (delta: number) => void;
}) {
  const ids = [line.sku ? `SKU ${line.sku}` : null, line.barcode ? `Barcode ${line.barcode}` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <s-section heading={line.name}>
      <s-stack direction="block" gap="small">
        <s-text color="subdued">{ids || "No SKU or barcode"}</s-text>
        <s-text>
          Received {formatQuantity(line.receivedQty)} of {formatQuantity(line.orderedQty)} ·{" "}
          {formatQuantity(line.openQty)} still expected
          {line.pendingQty > 0 ? ` · ${formatQuantity(line.pendingQty)} waiting for Shopify` : ""}
        </s-text>
        <s-stack direction="inline" gap="small">
          <s-button disabled={disabled || count === 0} onClick={() => onBump(-1)}>
            −
          </s-button>
          <s-number-field
            label="Counted now"
            value={count === 0 ? "" : String(count)}
            placeholder="0"
            inputMode="numeric"
            error={error ?? undefined}
            disabled={disabled}
            onChange={(event) => onCount(readCount(event.currentTarget.value))}
          />
          <s-button disabled={disabled} onClick={() => onBump(1)}>
            +
          </s-button>
        </s-stack>
        {error && <s-text tone="critical">{error}</s-text>}
      </s-stack>
    </s-section>
  );
}
