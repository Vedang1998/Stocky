/* eslint-disable @typescript-eslint/no-explicit-any -- TenantDb opaque delegates */
import { useEffect, useRef, useState, type ComponentRef } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";
import { assertInventoryWriteEnabled } from "../lib/feature-flags.server";
import { receivePartialPO, recordLeadTimeSnapshot } from "../services/landed-cost.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { db } = await requireAdminTenant({ request });

  const openPOs = await db.purchaseOrder.findMany({
    where: { status: { in: ["ORDERED", "PARTIAL"] } },
    include: { supplier: true, lineItems: true },
    orderBy: { orderedAt: "desc" },
  });

  const variantIds = openPOs.flatMap((po: any) =>
    po.lineItems.map((li: any) => li.shopifyVariantId),
  );
  const variants = await db.shopifyVariantCache.findMany({
    where: { shopifyVariantId: { in: variantIds } },
  });

  return { openPOs, variants };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { db } = await requireAdminTenant({ request });
  const form = await request.formData();
  const intent = form.get("intent") as string;

  if (intent === "scan") {
    try {
      assertInventoryWriteEnabled("receiptWrites");
    } catch (err) {
      return {
        error:
          err instanceof Error
            ? `${err.message} Warehouse receiving is gated until the receipt ledger and Shopify write path exist.`
            : "Receipt writes disabled",
      };
    }

    const poId = form.get("poId") as string;
    const barcode = (form.get("barcode") as string).trim();
    if (!barcode) return { error: "Empty scan" };

    const variant = await db.shopifyVariantCache.findFirst({
      where: { barcode },
    });
    if (!variant) {
      return { error: `No variant found for barcode ${barcode}` };
    }

    const po = await db.purchaseOrder.findFirst({
      where: { id: poId },
      include: { lineItems: true },
    });
    if (!po) return { error: "PO not found" };

    const line = po.lineItems.find(
      (li: any) =>
        li.shopifyVariantId === variant.shopifyVariantId &&
        li.receivedQty < li.orderedQty,
    );
    if (!line) {
      return {
        error: `${variant.title} is not open on this PO (fully received or not ordered)`,
      };
    }

    await receivePartialPO(db, po.id, [{ lineItemId: line.id, receivedQty: 1 }]);

    const updated = await db.purchaseOrder.findFirst({
      where: { id: po.id },
    });
    if (updated?.status === "RECEIVED") {
      await recordLeadTimeSnapshot(db, updated.supplierId, po.id);
    }

    return {
      scanned: {
        lineItemId: line.id,
        variantId: variant.shopifyVariantId,
        title: variant.title,
        barcode,
      },
    };
  }

  return { ok: false };
};

interface SessionScan {
  lineItemId: string;
  variantId: string;
  title: string;
  barcode: string;
  count: number;
}

export default function Warehouse() {
  const { openPOs, variants } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [searchParams, setSearchParams] = useSearchParams();
  const poId = searchParams.get("poId") ?? openPOs[0]?.id ?? "";
  const [sessionScans, setSessionScans] = useState<SessionScan[]>([]);
  const barcodeRef = useRef<ComponentRef<"s-text-field">>(null);

  const selectedPO = openPOs.find((po: any) => po.id === poId);
  const variantTitle = (id: string) =>
    variants.find((v: any) => v.shopifyVariantId === id)?.title ?? id;

  // Accumulate scans client-side so "Confirm Receipt" prints exactly what
  // was received in this session (the Stocky receiving/labeling loop).
  // State is adjusted during render with a guard ("storing information from
  // previous renders"), avoiding cascading effect re-renders.
  const [lastScanData, setLastScanData] = useState<typeof fetcher.data>(undefined);
  if (fetcher.data !== lastScanData) {
    setLastScanData(fetcher.data);
    const data = fetcher.data;
    if (data && "scanned" in data && data.scanned) {
      const scan = data.scanned;
      setSessionScans((prev) => {
        const existing = prev.find((s) => s.lineItemId === scan.lineItemId);
        if (existing) {
          return prev.map((s) =>
            s.lineItemId === scan.lineItemId ? { ...s, count: s.count + 1 } : s,
          );
        }
        return [...prev, { ...scan, count: 1 }];
      });
    }
  }

  // Clear the scan field once the round-trip settles so the next barcode
  // scan lands in an empty input.
  useEffect(() => {
    const data = fetcher.data;
    if (
      fetcher.state === "idle" &&
      data &&
      "scanned" in data &&
      barcodeRef.current
    ) {
      barcodeRef.current.value = "";
      barcodeRef.current.focus();
    }
  }, [fetcher.state, fetcher.data]);

  const labelParams = sessionScans
    .map((s) => `${encodeURIComponent(s.variantId)}:${s.count}`)
    .join(",");

  return (
    <s-page heading="Warehouse — Scan, Receive & Print">
      <s-section heading="Receiving station">
        <s-stack direction="block" gap="base">
          <s-select
            label="Purchase order"
            name="poSelect"
            value={poId}
            onChange={(e) => {
              setSearchParams({ poId: e.currentTarget.value });
              setSessionScans([]);
            }}
          >
            {openPOs.map((po: any) => (
              <s-option key={po.id} value={po.id}>
                {po.supplier.name} — {po.id.slice(-6).toUpperCase()} (
                {po.status})
              </s-option>
            ))}
          </s-select>

          {openPOs.length === 0 && (
            <s-banner tone="info" heading="No open purchase orders">
              <s-paragraph>
                Mark a PO as ordered first, then receive it here.
              </s-paragraph>
            </s-banner>
          )}

          {selectedPO && (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="scan" />
              <input type="hidden" name="poId" value={selectedPO.id} />
              <s-stack direction="inline" gap="base">
                <s-text-field
                  ref={barcodeRef}
                  label="Scan barcode"
                  name="barcode"
                  placeholder="Scan or type a barcode, then press Enter"
                  autocomplete="off"
                />
                <s-button
                  type="submit"
                  variant="primary"
                  {...(fetcher.state !== "idle" ? { loading: true } : {})}
                >
                  Receive +1
                </s-button>
              </s-stack>
            </fetcher.Form>
          )}

          {fetcher.data && "error" in fetcher.data && fetcher.data.error && (
            <s-banner tone="critical" heading="Scan failed">
              <s-paragraph>{fetcher.data.error}</s-paragraph>
            </s-banner>
          )}
        </s-stack>
      </s-section>

      {selectedPO && (
        <s-section heading="PO progress">
          <s-table>
            <s-table-header-row>
              <s-table-header>Variant</s-table-header>
              <s-table-header format="numeric">Ordered</s-table-header>
              <s-table-header format="numeric">Received</s-table-header>
              <s-table-header>Status</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {selectedPO.lineItems.map((li: any) => (
                <s-table-row key={li.id}>
                  <s-table-cell>{variantTitle(li.shopifyVariantId)}</s-table-cell>
                  <s-table-cell>{li.orderedQty}</s-table-cell>
                  <s-table-cell>{li.receivedQty}</s-table-cell>
                  <s-table-cell>
                    {li.receivedQty >= li.orderedQty ? (
                      <s-badge tone="success">Complete</s-badge>
                    ) : li.receivedQty > 0 ? (
                      <s-badge tone="warning">Partial</s-badge>
                    ) : (
                      <s-badge tone="neutral">Expected</s-badge>
                    )}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}

      <s-section heading="This session" slot="aside">
        {sessionScans.length === 0 ? (
          <s-paragraph>No scans yet this session.</s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            <s-unordered-list>
              {sessionScans.map((s) => (
                <s-list-item key={s.lineItemId}>
                  {s.title} × {s.count}
                </s-list-item>
              ))}
            </s-unordered-list>
            <s-button
              href={`/app/warehouse/labels?items=${labelParams}`}
              target="_blank"
              variant="primary"
            >
              Confirm receipt — print {sessionScans.reduce((a, s) => a + s.count, 0)} labels (ZPL)
            </s-button>
            <s-paragraph>
              <s-text color="subdued">
                Zebra: send the downloaded .zpl file to your printer. Dymo:
                use Dymo Connect with the barcode values shown.
              </s-text>
            </s-paragraph>
            <s-button variant="tertiary" onClick={() => setSessionScans([])}>
              Clear session
            </s-button>
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
