import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { ReceivableTransfer, TransferLine, TransferSheet } from "./api-types";
import { formatQuantity } from "./format";
import {
  createScanQueue,
  describeTransfer,
  loadTransferSheet,
  loadTransfers,
  mostCountedIn,
  parseCountedIn,
  postTransferReceipt,
  sendTransferCount,
  sendTransferScan,
} from "./transfers";

export function TransferReceive({ onBack }: { onBack: () => void }) {
  const locationId = shopify.session.currentSession.locationId ?? null;
  const [transferId, setTransferId] = useState<string | null>(null);

  if (transferId !== null) {
    return (
      <TransferSheetScreen
        transferId={transferId}
        locationId={locationId}
        onBack={() => setTransferId(null)}
      />
    );
  }
  return <TransferList locationId={locationId} onBack={onBack} onPick={setTransferId} />;
}

type ListState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; transfers: ReceivableTransfer[]; hasMore: boolean };

function TransferList({
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
  const [now, setNow] = useState(0);

  useEffect(() => {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    setState({ kind: "loading" });
    setNow(Date.now());
    void loadTransfers(fetch, locationId, controller?.signal).then((result) => {
      if (result === null) return;
      setState(
        result.ok
          ? { kind: "ready", transfers: result.value.transfers, hasMore: result.value.hasMore }
          : { kind: "error", message: result.message },
      );
    });
    return () => controller?.abort();
  }, [locationId, attempt]);

  return (
    <s-page heading="Receive a transfer">
      <s-scroll-box>
        <s-box padding="base">
          <s-stack direction="block" gap="base">
            <s-button variant="secondary" onClick={onBack}>
              Back to ProPo
            </s-button>
            {state.kind === "loading" && (
              <s-stack direction="inline" gap="small">
                <s-spinner />
                <s-text>Loading transfers…</s-text>
              </s-stack>
            )}
            {state.kind === "error" && (
              <s-banner heading="Couldn’t load transfers" tone="critical">
                <s-text>{state.message}</s-text>
                <s-button slot="primary-action" onClick={() => setAttempt((n) => n + 1)}>
                  Try again
                </s-button>
              </s-banner>
            )}
            {state.kind === "ready" &&
              (state.transfers.length === 0 ? (
                <s-section heading="Nothing to receive here">
                  <s-text color="subdued">
                    No transfer is on its way to this location. Once one is sent from another
                    location, it appears here.
                  </s-text>
                </s-section>
              ) : (
                <s-stack direction="block" gap="small">
                  {state.transfers.map((transfer, index) => (
                    <s-clickable key={transfer.id} onClick={() => onPick(transfer.id)}>
                      <s-box padding="small">
                        <s-stack direction="block">
                          <s-text type="strong">Transfer {index + 1}</s-text>
                          <s-text color="subdued">{describeTransfer(transfer, now)}</s-text>
                        </s-stack>
                      </s-box>
                    </s-clickable>
                  ))}
                  {state.hasMore && (
                    <s-text color="subdued">
                      More transfers are on their way. Receive some, then they appear here.
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
  | { kind: "ready"; sheet: TransferSheet };

type Notice = { tone: "success" | "warning" | "critical"; heading: string; detail?: string };

function TransferSheetScreen({
  transferId,
  locationId,
  onBack,
}: {
  transferId: string;
  locationId: number | null;
  onBack: () => void;
}) {
  const [state, setState] = useState<SheetState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldKey, setFieldKey] = useState(0);
  const [cameraAvailable, setCameraAvailable] = useState(() =>
    shopify.scanner.sources.current.value.includes("camera"),
  );
  const busyRef = useRef(false);
  const scanOpenRef = useRef(false);
  // A finished transfer has nothing left to receive; its sheet is gone.
  const [finished, setFinished] = useState<string | null>(null);

  useEffect(() => {
    scanOpenRef.current = state.kind === "ready" && state.sheet.receivingEnabled && finished === null;
  }, [state, finished]);

  useEffect(() => {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    setState({ kind: "loading" });
    void loadTransferSheet(fetch, locationId, transferId, controller?.signal).then((result) => {
      if (result === null) return;
      setState(
        result.ok
          ? { kind: "ready", sheet: result.value }
          : { kind: "error", message: result.message },
      );
    });
    return () => controller?.abort();
  }, [locationId, transferId, attempt]);

  /** Show the sheet a response carried, or reload it when it could not be read back. */
  const adopt = useCallback((sheet: TransferSheet | null) => {
    if (sheet) setState({ kind: "ready", sheet });
    else setAttempt((n) => n + 1);
  }, []);

  const runScan = useCallback(
    async (code: string): Promise<boolean> => {
      busyRef.current = true;
      setBusy(true);
      setNotice(null);
      const result = await sendTransferScan(fetch, locationId, transferId, code);
      if (!result.ok) {
        setNotice({ tone: "critical", heading: "Scan not confirmed", detail: result.message });
        return false;
      }
      if (!result.value.ok) {
        if (result.value.sheet) adopt(result.value.sheet);
        setNotice({ tone: "warning", heading: `“${code}” wasn’t counted`, detail: result.value.message });
        return true;
      }
      adopt(result.value.sheet);
      const { scanned } = result.value;
      if (scanned) {
        setNotice({
          tone: "success",
          heading: `${scanned.title}: ${scanned.countedIn} counted in`,
          detail:
            scanned.outstanding === 0
              ? "That is every unit sent."
              : `${scanned.outstanding} still to come.`,
        });
      }
      return true;
    },
    [locationId, transferId, adopt],
  );

  const runScanRef = useRef(runScan);
  useEffect(() => {
    runScanRef.current = runScan;
  }, [runScan]);
  const [queue] = useState(() =>
    createScanQueue({
      run: (code) => runScanRef.current(code),
      onIdle: (dropped) => {
        busyRef.current = false;
        setBusy(false);
        if (dropped > 0) {
          setNotice({
            tone: "critical",
            heading: "Scan not confirmed",
            detail: `${dropped} later ${dropped === 1 ? "scan was" : "scans were"} not sent. Check the counts shown, then scan again.`,
          });
        }
      },
    }),
  );

  const scan = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (!code || !scanOpenRef.current) return;
      queue.push(code);
    },
    [queue],
  );

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

  const setLine = async (line: TransferLine, quantity: number) => {
    if (busyRef.current || !scanOpenRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    const result = await sendTransferCount(fetch, locationId, transferId, line.lineId, quantity);
    busyRef.current = false;
    setBusy(false);
    if (!result.ok) {
      setNotice({ tone: "critical", heading: "Count not saved", detail: result.message });
      return;
    }
    if (!result.value.ok) {
      if (result.value.sheet) adopt(result.value.sheet);
      setNotice({ tone: "warning", heading: "Count not saved", detail: result.value.message });
      return;
    }
    adopt(result.value.sheet);
  };

  const post = async () => {
    if (busyRef.current || !scanOpenRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    const result = await postTransferReceipt(fetch, locationId, transferId);
    busyRef.current = false;
    setBusy(false);
    if (!result.ok) {
      setNotice({ tone: "critical", heading: "Receipt not confirmed", detail: result.message });
      return;
    }
    if (!result.value.ok) {
      if (result.value.sheet) adopt(result.value.sheet);
      setNotice({ tone: "critical", heading: "Receipt not posted", detail: result.value.message });
      return;
    }
    const { posted } = result.value;
    if (posted?.completed) {
      setFinished(
        posted.receivedUnits > 0
          ? `${posted.receivedUnits} units added to stock. This transfer is fully received.`
          : "This transfer is fully received.",
      );
      return;
    }
    adopt(result.value.sheet);
    setNotice({
      tone: "success",
      heading: `${posted?.receivedUnits ?? 0} units added to stock`,
      detail: "Scan the rest when it arrives.",
    });
  };

  const sheet = state.kind === "ready" ? state.sheet : null;

  return (
    <s-page heading="Receive a transfer">
      <s-scroll-box>
        <s-box padding="base">
          <s-stack direction="block" gap="base">
            <s-button variant="secondary" onClick={onBack}>
              Back to transfers
            </s-button>
            {finished !== null && (
              <s-banner heading="Transfer received" tone="success">
                <s-text>{finished}</s-text>
              </s-banner>
            )}
            {finished === null && state.kind === "loading" && (
              <s-stack direction="inline" gap="small">
                <s-spinner />
                <s-text>Loading the transfer…</s-text>
              </s-stack>
            )}
            {finished === null && state.kind === "error" && (
              <s-banner heading="Couldn’t load this transfer" tone="critical">
                <s-text>{state.message}</s-text>
                <s-button slot="primary-action" onClick={() => setAttempt((n) => n + 1)}>
                  Try again
                </s-button>
              </s-banner>
            )}
            {finished === null && sheet && (
              <s-stack direction="block" gap="base">
                <s-text color="subdued">
                  {sheet.transfer.receivedUnits} of {sheet.transfer.shippedUnits} units received ·{" "}
                  {sheet.transfer.countedInUnits} counted in, not added to stock yet
                </s-text>
                {!sheet.receivingEnabled && (
                  <s-banner heading="Receiving is switched off" tone="warning">
                    <s-text>
                      Transfers can’t be received on this device right now. Nothing is changed.
                    </s-text>
                  </s-banner>
                )}
                <s-search-field
                  key={fieldKey}
                  placeholder="Scan or enter a barcode or SKU"
                  onChange={(event) => {
                    scan(event.currentTarget.value ?? "");
                    // Empty the field so the same code can be scanned again.
                    setFieldKey((n) => n + 1);
                  }}
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
                {sheet.lines.map((line) => (
                  <TransferLineRow
                    key={line.lineId}
                    line={line}
                    disabled={busy || !sheet.receivingEnabled}
                    onSet={(quantity) => void setLine(line, quantity)}
                  />
                ))}
                {sheet.hasMoreLines && (
                  <s-text color="subdued">
                    Only the first items are listed. Scan an item to count it in.
                  </s-text>
                )}
                <s-button
                  variant="primary"
                  disabled={busy || !sheet.receivingEnabled || sheet.transfer.countedInUnits === 0}
                  onClick={() => void post()}
                >
                  Post receipt ({sheet.transfer.countedInUnits} units)
                </s-button>
              </s-stack>
            )}
          </s-stack>
        </s-box>
      </s-scroll-box>
    </s-page>
  );
}

function TransferLineRow({
  line,
  disabled,
  onSet,
}: {
  line: TransferLine;
  disabled: boolean;
  onSet: (quantity: number) => void;
}) {
  // Bumped when typed text is not saved, so the field shows the saved count again.
  const [fieldKey, setFieldKey] = useState(0);
  const most = mostCountedIn(line);
  return (
    <s-section heading={line.name}>
      <s-stack direction="block" gap="small">
        <s-text color="subdued">
          Sent {formatQuantity(line.shippedQty)} · received {formatQuantity(line.receivedQty)}
          {line.rejectedQty > 0 ? ` · rejected ${line.rejectedQty}` : ""} · still to come{" "}
          {formatQuantity(line.outstandingQty)}
        </s-text>
        <s-stack direction="inline" gap="small">
          <s-button
            disabled={disabled || line.countedInQty <= 0}
            onClick={() => onSet(line.countedInQty - 1)}
          >
            −
          </s-button>
          <s-number-field
            key={`${line.countedInQty}-${fieldKey}`}
            label="Counted in"
            value={String(line.countedInQty)}
            inputMode="numeric"
            disabled={disabled}
            onChange={(event) => {
              // Empty or invalid text never becomes a count of 0.
              const typed = parseCountedIn(event.currentTarget.value);
              if (typed === null || typed === line.countedInQty) {
                setFieldKey((n) => n + 1);
                return;
              }
              onSet(typed);
            }}
          />
          <s-button
            disabled={disabled || line.countedInQty >= most}
            onClick={() => onSet(line.countedInQty + 1)}
          >
            +
          </s-button>
        </s-stack>
      </s-stack>
    </s-section>
  );
}
