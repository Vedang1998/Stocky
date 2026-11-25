import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { ReceivableTransfer, TransferLine, TransferSheet } from "./api-types";
import { formatQuantity } from "./format";
import { parseCount } from "./receiving";
import {
  createActionQueue,
  describeTransfer,
  failureOutcome,
  loadTransferSheet,
  loadTransfers,
  mostCountedIn,
  postTransferReceipt,
  sendTransferCount,
  sendTransferScan,
  type ActionOutcome,
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
                  {state.transfers.map((transfer) => (
                    <s-clickable key={transfer.id} onClick={() => onPick(transfer.id)}>
                      <s-box padding="small">
                        <s-stack direction="block">
                          <s-text type="strong">Transfer …{transfer.id.slice(-6)}</s-text>
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
  const scanOpenRef = useRef(false);
  // A finished transfer has nothing left to receive; its sheet is gone.
  const [finished, setFinished] = useState<string | null>(null);

  useEffect(() => {
    scanOpenRef.current =
      state.kind === "ready" && state.sheet.receivingEnabled && !state.sheet.completed && finished === null;
  }, [state, finished]);

  useEffect(() => {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    setState({ kind: "loading" });
    void loadTransferSheet(fetch, locationId, transferId, controller?.signal).then((result) => {
      if (result === null) return;
      if (!result.ok) {
        setState({ kind: "error", message: result.message });
        return;
      }
      if (result.value.completed) setFinished("This transfer is fully received.");
      setState({ kind: "ready", sheet: result.value });
    });
    return () => controller?.abort();
  }, [locationId, transferId, attempt]);

  /** Show the sheet a response carried, or reload it when it could not be read back. */
  const adopt = useCallback((sheet: TransferSheet | null) => {
    if (sheet) setState({ kind: "ready", sheet });
    else setAttempt((n) => n + 1);
  }, []);

  // One queue for scans, count edits and the receipt, so none overlaps.
  const [queue] = useState(() =>
    createActionQueue({
      onIdle: (dropped) => {
        setBusy(false);
        if (dropped > 0) {
          const more = `${dropped} later ${dropped === 1 ? "action was" : "actions were"} not sent. Check the counts shown, then try again.`;
          setNotice((current) =>
            current
              ? { ...current, detail: current.detail ? `${current.detail} ${more}` : more }
              : { tone: "critical", heading: "Not confirmed", detail: more },
          );
        }
      },
    }),
  );
  const enqueue = useCallback(
    (action: () => Promise<ActionOutcome>) => {
      setBusy(true);
      queue.push(action);
    },
    [queue],
  );

  /** Turn a failed answer into the notice and the outcome the queue acts on. */
  const failed = useCallback((heading: string, failure: { status?: number; message: string }): ActionOutcome => {
    setNotice({ tone: "critical", heading, detail: failure.message });
    return failureOutcome(failure);
  }, []);

  const runScan = useCallback(
    async (code: string): Promise<ActionOutcome> => {
      setNotice(null);
      const result = await sendTransferScan(fetch, locationId, transferId, code);
      if (!result.ok) return failed("Scan not confirmed", result);
      if (!result.value.ok) {
        if (result.value.sheet) adopt(result.value.sheet);
        setNotice({ tone: "warning", heading: `“${code}” wasn’t counted`, detail: result.value.message });
        return "refused";
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
      return "ok";
    },
    [locationId, transferId, adopt, failed],
  );

  const scan = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (!code || !scanOpenRef.current) return;
      enqueue(() => runScan(code));
    },
    [enqueue, runScan],
  );
  // The scanner callback below is set up once per screen; it calls the latest scan.
  const scanRef = useRef(scan);
  useEffect(() => {
    scanRef.current = scan;
  }, [scan]);

  useEffect(() => {
    // Subscribing replays the last scan, which may predate this screen.
    let listening = false;
    const stopScans = shopify.scanner.scannerData.current.subscribe((result) => {
      if (!listening || !result.data) return;
      if (result.source === "camera") shopify.scanner.hideCameraScanner();
      scanRef.current(result.data);
    });
    listening = true;
    const stopSources = shopify.scanner.sources.current.subscribe((sources) =>
      setCameraAvailable(sources.includes("camera")),
    );
    return () => {
      stopScans();
      stopSources();
    };
  }, []);

  const setLine = (line: TransferLine, quantity: number) => {
    if (!scanOpenRef.current) return;
    enqueue(async () => {
      setNotice(null);
      const result = await sendTransferCount(fetch, locationId, transferId, line.lineId, quantity);
      if (!result.ok) return failed("Count not saved", result);
      if (!result.value.ok) {
        if (result.value.sheet) adopt(result.value.sheet);
        setNotice({ tone: "warning", heading: "Count not saved", detail: result.value.message });
        return "refused";
      }
      adopt(result.value.sheet);
      return "ok";
    });
  };

  const post = () => {
    if (!scanOpenRef.current) return;
    enqueue(async () => {
      setNotice(null);
      const result = await postTransferReceipt(fetch, locationId, transferId);
      if (!result.ok) return failed("Receipt not confirmed", result);
      if (!result.value.ok) {
        if (result.value.sheet) adopt(result.value.sheet);
        setNotice({ tone: "critical", heading: "Receipt not posted", detail: result.value.message });
        return "refused";
      }
      const { posted } = result.value;
      if (posted?.completed) {
        setFinished(
          posted.alreadyDone
            ? "This transfer was already fully received. Nothing more was added."
            : `${posted.receivedUnits} units added to stock. This transfer is fully received.`,
        );
        return "ok";
      }
      adopt(result.value.sheet);
      setNotice({
        tone: "success",
        heading: posted?.alreadyDone
          ? "Already recorded"
          : `${posted?.receivedUnits ?? 0} units added to stock`,
        detail: "Scan the rest when it arrives.",
      });
      return "ok";
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
                    onSet={(quantity) => setLine(line, quantity)}
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
                  onClick={post}
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
              const typed = parseCount(event.currentTarget.value);
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
