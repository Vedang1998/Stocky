import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import { createPortal } from "react-dom";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { LabelSvg } from "../components/LabelSvg";
import { issueText } from "../lib/labels/issues";
import { layoutLabel } from "../lib/labels/layout";
import { MAX_BROWSER_PRINT_LABELS } from "../lib/labels/limits";
import {
  addToQueue,
  labelContent,
  queueProblem,
  removeFromQueue,
  setQueueCount,
  totalLabels,
  type LabelQueueItem,
} from "../lib/labels/queue";
import {
  LABEL_FIELDS,
  LABEL_SIZES,
  labelSize,
  parseLabelTemplate,
  withField,
  type LabelFieldId,
  type LabelTemplate,
} from "../lib/labels/template";
import { labelRunZpl } from "../lib/labels/zpl";
import { submitOnEnter } from "../lib/submit-on-enter";
import { useDeviceCamera } from "../lib/use-device-camera";
import { useStoredString } from "../lib/use-stored-value";
import { parseLabelItems } from "../lib/warehouse-labels.server";
import {
  listLabelLocations,
  loadLabelProducts,
  type LabelProduct,
} from "../services/labels/label-products.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import type { loader as lookupLoader } from "./app.labels_.lookup";

const TEMPLATE_KEY = "propo:labels:template";
const LOCATION_KEY = "propo:labels:location";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { db } = await requireAdminTenant({ request });
  const itemsParam = new URL(request.url).searchParams.get("items");
  const locations = await listLabelLocations(db);

  let initial: LabelQueueItem[] = [];
  let missing = 0;
  let problem: string | null = null;
  if (itemsParam) {
    const parsed = parseLabelItems(itemsParam);
    if (!parsed.ok) {
      problem = parsed.message;
    } else {
      const loaded = await loadLabelProducts(
        db,
        parsed.items.map((item) => item.variantId),
      );
      const counts = new Map(parsed.items.map((item) => [item.variantId, item.count]));
      initial = loaded.products.map((product) => ({
        product,
        count: counts.get(product.variantGid) ?? 1,
      }));
      missing = loaded.missing.length;
    }
  }
  return { locations, initial, missing, problem };
};

function parseJson(text: string | null): unknown {
  try {
    return text === null ? null : JSON.parse(text);
  } catch {
    return null;
  }
}

type Notice = { tone: "info" | "warning" | "critical"; text: string };

function PrintSheet({
  template,
  rows,
}: {
  template: LabelTemplate;
  rows: Array<{ item: LabelQueueItem; layout: ReturnType<typeof layoutLabel> }>;
}) {
  const size = labelSize(template.sizeId);
  return createPortal(
    <div className="label-print-root">
      <style>{`
        @media screen { .label-print-root { display: none; } }
        @media print {
          @page { size: ${size.widthIn}in ${size.heightIn}in; margin: 0; }
          html, body { margin: 0; padding: 0; background: #fff; }
          body > *:not(.label-print-root) { display: none !important; }
          .label-print-root svg { display: block; break-after: page; }
          .label-print-root svg:last-child { break-after: auto; }
        }
      `}</style>
      {rows.flatMap(({ item, layout }) =>
        Array.from({ length: item.count }, (_, copy) => (
          <LabelSvg
            key={`${item.product.variantGid}-${copy}`}
            layout={layout}
            widthIn={size.widthIn}
            heightIn={size.heightIn}
          />
        )),
      )}
    </div>,
    document.body,
  );
}

export default function Labels() {
  const { locations, initial, missing, problem } = useLoaderData<typeof loader>();
  const lookup = useFetcher<typeof lookupLoader>();
  const hasCamera = useDeviceCamera();
  const fieldRef = useRef<ComponentRef<"s-search-field">>(null);

  const [queue, setQueue] = useState<LabelQueueItem[]>(initial);
  const [storedTemplate, storeTemplate] = useStoredString(TEMPLATE_KEY);
  const [storedLocation, storeLocation] = useStoredString(LOCATION_KEY);
  const template = useMemo(() => parseLabelTemplate(parseJson(storedTemplate)), [storedTemplate]);
  const locationGid = storedLocation ?? "";
  const [query, setQuery] = useState("");
  const [choices, setChoices] = useState<LabelProduct[] | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [previewGid, setPreviewGid] = useState<string | null>(initial[0]?.product.variantGid ?? null);
  const [printing, setPrinting] = useState(false);
  const [focusTick, setFocusTick] = useState(0);
  const [handled, setHandled] = useState<unknown>(null);

  const locationName = locations.find((l) => l.locationGid === locationGid)?.name ?? null;
  const size = labelSize(template.sizeId);

  const rows = useMemo(
    () =>
      queue.map((item) => ({
        item,
        layout: layoutLabel(template, labelContent(item.product, locationName)),
      })),
    [queue, template, locationName],
  );
  const total = totalLabels(queue);
  const preview = rows.find((row) => row.item.product.variantGid === previewGid) ?? rows[0];

  const addProduct = useCallback(
    (product: LabelProduct) => {
      const change = addToQueue(queue, product);
      if (!change.ok) {
        setNotice({ tone: "warning", text: queueProblem(change.reason) });
        return;
      }
      setQueue(change.items);
      setPreviewGid(product.variantGid);
      setChoices(null);
      setNotice(null);
      setQuery("");
      setFocusTick((tick) => tick + 1);
    },
    [queue],
  );

  // Keyboard-wedge scanners type into whatever has focus, so the field takes
  // focus back after each product is added.
  useEffect(() => {
    if (focusTick > 0) fieldRef.current?.focus();
  }, [focusTick]);

  // A lookup finished: apply its result once.
  const result = lookup.data;
  if (result && handled !== result) {
    setHandled(result);
    switch (result.kind) {
      case "match":
        addProduct(result.product);
        break;
      case "choose":
        setChoices(result.products);
        setNotice(
          result.truncated
            ? {
                tone: "info",
                text: "Showing the first matches. Type more of the name, or scan the barcode, to narrow it down.",
              }
            : null,
        );
        break;
      case "not_found":
        setChoices(null);
        setNotice({
          tone: "warning",
          text: `No product matches “${result.query}”. Check the code, or search by product name. Products added in Shopify in the last few minutes may not have synced yet.`,
        });
        break;
      case "too_long":
        setNotice({ tone: "critical", text: "That code is too long. Scan one barcode at a time." });
        break;
      case "empty":
        break;
    }
  }

  function search() {
    if (query.trim() === "") return;
    lookup.load(`/app/labels/lookup?q=${encodeURIComponent(query)}`);
  }

  async function scanWithCamera() {
    let code: string;
    try {
      ({ data: code } = await shopify.scanner.capture());
    } catch {
      shopify.toast.show("No barcode was scanned");
      return;
    }
    setQuery(code);
    lookup.load(`/app/labels/lookup?q=${encodeURIComponent(code)}`);
  }

  function changeTemplate(next: LabelTemplate) {
    storeTemplate(JSON.stringify(next));
  }

  function changeCount(variantGid: string, value: string) {
    const change = setQueueCount(queue, variantGid, value);
    if (change.ok) {
      setQueue(change.items);
      setNotice(null);
    } else {
      setNotice({ tone: "warning", text: queueProblem(change.reason) });
    }
  }

  // The print sheet must be in the document before the dialog opens.
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    const frame = window.requestAnimationFrame(() => window.print());
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);

  function downloadZpl() {
    const zpl = labelRunZpl(
      template,
      queue.map((item) => ({
        content: labelContent(item.product, locationName),
        count: item.count,
      })),
    );
    const url = URL.createObjectURL(new Blob([zpl], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `labels-${new Date().toISOString().slice(0, 10)}.zpl`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const canPrintFromBrowser = total > 0 && total <= MAX_BROWSER_PRINT_LABELS;

  return (
    <s-page heading="Labels">
      {problem ? (
        <s-banner tone="critical" heading="That link could not be used">
          <s-paragraph>{problem} Add the products below instead.</s-paragraph>
        </s-banner>
      ) : null}
      {missing > 0 ? (
        <s-banner tone="warning" heading="Some products were not found">
          <s-paragraph>
            {missing === 1 ? "One product from the link is" : `${missing} products from the link are`}{" "}
            not in your catalog. It may have been deleted in Shopify or not synced yet, so no
            labels are queued for it.
          </s-paragraph>
        </s-banner>
      ) : null}

      <s-section heading="Add products">
        <s-stack gap="base">
          <Form
            onSubmit={(event) => {
              event.preventDefault();
              search();
            }}
            onKeyDown={submitOnEnter}
          >
            <s-stack gap="base">
              <s-search-field
                ref={fieldRef}
                label="Barcode, SKU or product name"
                placeholder="Scan or type a barcode, SKU or product name"
                autocomplete="off"
                value={query}
                onInput={(event) => setQuery(event.currentTarget.value)}
              />
              <s-stack direction="inline" gap="small">
                <s-button
                  type="submit"
                  variant="primary"
                  {...(lookup.state !== "idle" ? { loading: true } : {})}
                >
                  Add to labels
                </s-button>
                {hasCamera ? <s-button onClick={scanWithCamera}>Scan with camera</s-button> : null}
              </s-stack>
            </s-stack>
          </Form>
          {notice ? (
            <s-banner tone={notice.tone}>
              <s-paragraph>{notice.text}</s-paragraph>
            </s-banner>
          ) : null}
          {choices ? (
            <s-stack gap="small-200">
              <s-text type="strong">Choose the product</s-text>
              {choices.map((choice) => (
                <s-button key={choice.variantGid} onClick={() => addProduct(choice)}>
                  {[choice.displayName, choice.sku && `SKU ${choice.sku}`, choice.barcode && `Barcode ${choice.barcode}`]
                    .filter(Boolean)
                    .join(" · ")}
                </s-button>
              ))}
            </s-stack>
          ) : null}
        </s-stack>
      </s-section>

      <s-section heading={total > 0 ? `Labels to print (${total})` : "Labels to print"}>
        {rows.length === 0 ? (
          <s-paragraph>
            Nothing queued yet. Scan or search above, or open this page from a receipt to fill it
            in for you.
          </s-paragraph>
        ) : (
          <s-stack gap="base">
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Product</s-table-header>
                <s-table-header format="numeric">Labels</s-table-header>
                <s-table-header listSlot="secondary">Notes</s-table-header>
                <s-table-header>
                  <span className="visually-hidden">Actions</span>
                </s-table-header>
              </s-table-header-row>
              <s-table-body>
                {rows.map(({ item, layout }) => (
                  <s-table-row key={item.product.variantGid}>
                    <s-table-cell>
                      <s-button
                        variant="tertiary"
                        accessibilityLabel={`Preview ${item.product.displayName}`}
                        onClick={() => setPreviewGid(item.product.variantGid)}
                      >
                        {item.product.displayName}
                      </s-button>
                    </s-table-cell>
                    <s-table-cell>
                      <s-number-field
                        label={`Labels for ${item.product.displayName}`}
                        labelAccessibilityVisibility="exclusive"
                        min={1}
                        step={1}
                        value={String(item.count)}
                        onChange={(event) =>
                          changeCount(item.product.variantGid, event.currentTarget.value)
                        }
                      />
                    </s-table-cell>
                    <s-table-cell>
                      {layout.issues.length === 0 ? (
                        <s-text color="subdued">Ready</s-text>
                      ) : (
                        <s-stack gap="small-300">
                          {layout.issues.map((issue) => (
                            <s-text key={issue.kind} color="subdued">
                              {issueText(issue)}
                            </s-text>
                          ))}
                        </s-stack>
                      )}
                    </s-table-cell>
                    <s-table-cell>
                      <s-button
                        variant="tertiary"
                        tone="critical"
                        accessibilityLabel={`Remove ${item.product.displayName}`}
                        onClick={() => setQueue(removeFromQueue(queue, item.product.variantGid))}
                      >
                        Remove
                      </s-button>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
            <s-stack direction="inline" gap="small">
              <s-button
                variant="primary"
                disabled={!canPrintFromBrowser}
                onClick={() => setPrinting(true)}
              >
                Print labels
              </s-button>
              <s-button onClick={downloadZpl}>Download for a Zebra printer (ZPL)</s-button>
              <s-button
                variant="tertiary"
                tone="critical"
                onClick={() => {
                  setQueue([]);
                  setChoices(null);
                  setNotice(null);
                }}
              >
                Clear list
              </s-button>
            </s-stack>
            {total > MAX_BROWSER_PRINT_LABELS ? (
              <s-text color="subdued">
                The browser prints up to {MAX_BROWSER_PRINT_LABELS} labels at a time. Download the
                printer file for a run this large.
              </s-text>
            ) : null}
          </s-stack>
        )}
      </s-section>

      <s-section heading="Label design">
        <s-stack gap="base">
          <s-select
            label="Label size"
            value={template.sizeId}
            onChange={(event) =>
              changeTemplate({ ...template, sizeId: event.currentTarget.value })
            }
          >
            {LABEL_SIZES.map((option) => (
              <s-option key={option.id} value={option.id}>
                {option.name}
              </s-option>
            ))}
          </s-select>
          <s-stack gap="small-200">
            <s-text type="strong">Print on the label</s-text>
            {LABEL_FIELDS.map((field) => (
              <s-checkbox
                key={field.id}
                label={field.name}
                checked={template.fields.includes(field.id)}
                onChange={(event) =>
                  changeTemplate(withField(template, field.id as LabelFieldId, event.currentTarget.checked))
                }
              />
            ))}
          </s-stack>
          {template.fields.includes("location") ? (
            <s-select
              label="Location on the label"
              value={locationGid}
              onChange={(event) => storeLocation(event.currentTarget.value)}
            >
              <s-option value="">None</s-option>
              {locations.map((location) => (
                <s-option key={location.locationGid} value={location.locationGid}>
                  {location.name}
                </s-option>
              ))}
            </s-select>
          ) : null}
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Preview">
        {preview ? (
          <s-stack gap="small">
            <div className="label-preview">
              <LabelSvg layout={preview.layout} />
            </div>
            <s-text color="subdued">
              {size.name}, {preview.item.product.displayName}
            </s-text>
          </s-stack>
        ) : (
          <s-paragraph>Add a product to see the label.</s-paragraph>
        )}
      </s-section>

      <style>{`
        .label-preview { border: 1px solid #c9cccf; border-radius: 4px; overflow: hidden; max-width: 360px; }
        .label-preview svg { display: block; width: 100%; height: auto; }
        .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
      `}</style>
      {printing ? <PrintSheet template={template} rows={rows} /> : null}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
