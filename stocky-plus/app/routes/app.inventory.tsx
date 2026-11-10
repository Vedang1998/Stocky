import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type ComponentRef,
  type KeyboardEvent,
} from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData, useNavigation, useSubmit } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  formatObservedAt,
  formatQuantity,
  isStale,
} from "../../extensions/propo-pos/src/format";
import { numericIdFromGid } from "../lib/shopify-gid";
import type { ResolvedVariant } from "../services/barcode-lookup.server";
import {
  lookupInventory,
  type InventoryLookup,
} from "../services/inventory-lookup.server";
import type { LocationStock, VariantStock } from "../services/stock-lookup.server";
import { requireAdminTenant } from "../tenant/require-admin-tenant.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { db } = await requireAdminTenant({ request });
  const params = new URL(request.url).searchParams;
  const query = params.get("q");
  const variantGid = params.get("variant");
  const lookup = await lookupInventory(db, { query, variantGid });
  return {
    lookup,
    // Set when the product was picked from a list of matches for this query.
    matchesQuery: variantGid !== null ? (query?.trim() ?? "") : "",
    now: Date.now(),
  };
};

function lookupHref(query: string, variantGid?: string): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (variantGid) params.set("variant", variantGid);
  const search = params.toString();
  return search ? `/app/inventory?${search}` : "/app/inventory";
}

function VariantIdentity({ variant }: { variant: ResolvedVariant }) {
  const codes = [
    variant.sku ? `SKU ${variant.sku}` : null,
    variant.barcode ? `Barcode ${variant.barcode}` : null,
  ].filter(Boolean);
  return (
    <s-stack direction="inline" gap="base" alignItems="center">
      {variant.imageUrl ? (
        <s-thumbnail src={variant.imageUrl} alt="" size="small" />
      ) : null}
      <s-stack gap="small-300">
        <s-text type="strong">{variant.displayName}</s-text>
        <s-text color="subdued">
          {codes.length > 0 ? codes.join(" · ") : "No SKU or barcode"}
        </s-text>
      </s-stack>
    </s-stack>
  );
}

function Candidates({
  lookup,
}: {
  lookup: Extract<InventoryLookup, { kind: "choose" }>;
}) {
  const heading =
    lookup.matchedOn === "text"
      ? `Products matching “${lookup.query}”`
      : `More than one product uses this ${lookup.matchedOn === "sku" ? "SKU" : "barcode"}`;
  return (
    <s-section heading={heading}>
      <s-stack gap="small-200">
        {lookup.candidates.map((candidate) => (
          <s-clickable
            key={candidate.variantGid}
            href={lookupHref(lookup.query, candidate.variantGid)}
            padding="small"
            borderRadius="base"
          >
            <VariantIdentity variant={candidate} />
          </s-clickable>
        ))}
        {lookup.truncated ? (
          <s-text color="subdued">
            Showing the first {lookup.candidates.length} matches. Add more of
            the name, or scan the barcode, to narrow it down.
          </s-text>
        ) : null}
      </s-stack>
    </s-section>
  );
}

const QUANTITY_COLUMNS = [
  { key: "available", label: "Available" },
  { key: "onHand", label: "On hand" },
  { key: "committed", label: "Committed" },
  { key: "incoming", label: "Incoming" },
] as const;

function LocationAge({ location, now }: { location: LocationStock; now: number }) {
  const age = formatObservedAt(location.observedAt, now);
  if (!age) return <s-text color="subdued">Not reported yet</s-text>;
  return isStale(location.observedAt, now) ? (
    <s-badge tone="warning">{age}</s-badge>
  ) : (
    <s-text color="subdued">{age}</s-text>
  );
}

function StockNotice({ stock }: { stock: VariantStock }) {
  if (stock.inventoryItemGid === null) {
    return (
      <s-banner tone="info" heading="No stock information yet">
        <s-paragraph>
          Shopify has not sent inventory for this product. It appears here
          after the next catalog sync.
        </s-paragraph>
      </s-banner>
    );
  }
  if (stock.tracked === false) {
    return (
      <s-banner tone="info" heading="Inventory is not tracked">
        <s-paragraph>
          Shopify does not track quantities for this product, so there is no
          stock level to show.
        </s-paragraph>
      </s-banner>
    );
  }
  if (stock.locations.length === 0) {
    return (
      <s-banner tone="info" heading="Not stocked at any active location">
        <s-paragraph>
          This product is not assigned to an active location in Shopify.
        </s-paragraph>
      </s-banner>
    );
  }
  return null;
}

function Stock({
  lookup,
  matchesQuery,
  now,
}: {
  lookup: Extract<InventoryLookup, { kind: "stock" }>;
  matchesQuery: string;
  now: number;
}) {
  const { variant, stock } = lookup;
  const productId = numericIdFromGid(variant.productGid);
  return (
    <>
      <s-section>
        <s-stack gap="base">
          <VariantIdentity variant={variant} />
          <StockNotice stock={stock} />
          {stock.locations.length > 0 ? (
            <s-query-container>
              <s-grid
                gridTemplateColumns="@container (inline-size > 480px) 1fr 1fr 1fr 1fr, 1fr 1fr"
                gap="base"
              >
                {QUANTITY_COLUMNS.map(({ key, label }) => (
                  <s-box
                    key={key}
                    padding="base"
                    borderWidth="base"
                    borderRadius="base"
                  >
                    <s-stack gap="small-300">
                      <s-text color="subdued">{label}</s-text>
                      <s-heading>{formatQuantity(stock.totals[key])}</s-heading>
                    </s-stack>
                  </s-box>
                ))}
              </s-grid>
            </s-query-container>
          ) : null}
          <s-stack direction="inline" gap="base">
            {matchesQuery ? (
              <s-link href={lookupHref(matchesQuery)}>Back to matches</s-link>
            ) : null}
            {productId ? (
              <s-link href={`shopify://admin/products/${productId}`}>
                View product in Shopify
              </s-link>
            ) : null}
          </s-stack>
        </s-stack>
      </s-section>

      {stock.locations.length > 0 ? (
        <s-section heading="By location">
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Location</s-table-header>
              {QUANTITY_COLUMNS.map(({ key, label }) => (
                <s-table-header key={key} format="numeric">
                  {label}
                </s-table-header>
              ))}
              <s-table-header listSlot="secondary">Last update</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {stock.locations.map((location) => (
                <s-table-row key={location.locationGid}>
                  <s-table-cell>{location.locationName}</s-table-cell>
                  {QUANTITY_COLUMNS.map(({ key }) => (
                    <s-table-cell key={key}>
                      {formatQuantity(location[key])}
                    </s-table-cell>
                  ))}
                  <s-table-cell>
                    <LocationAge location={location} now={now} />
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      ) : null}
    </>
  );
}

function CatalogNotSynced() {
  return (
    <s-banner tone="warning" heading="Your catalog has not synced yet">
      <s-paragraph>
        Products appear here once ProPo has copied your catalog from Shopify.{" "}
        <s-link href="/app">Check sync status on Home</s-link>
      </s-paragraph>
    </s-banner>
  );
}

function Result({
  lookup,
  matchesQuery,
  now,
}: {
  lookup: InventoryLookup;
  matchesQuery: string;
  now: number;
}) {
  switch (lookup.kind) {
    case "idle":
      return lookup.catalogSynced ? (
        <s-section>
          <s-paragraph>
            Scan a barcode or type a barcode, SKU or product name to see stock
            at every location.
          </s-paragraph>
        </s-section>
      ) : (
        <CatalogNotSynced />
      );
    case "too_long":
      return (
        <s-banner tone="critical" heading="That code is too long">
          <s-paragraph>
            Scan one barcode at a time, or type a shorter search.
          </s-paragraph>
        </s-banner>
      );
    case "not_found":
      return lookup.catalogSynced ? (
        <s-banner tone="warning" heading={`No product matches “${lookup.query}”`}>
          <s-paragraph>
            Check the code, or search by product name. Products added in
            Shopify in the last few minutes may not have synced yet.
          </s-paragraph>
        </s-banner>
      ) : (
        <CatalogNotSynced />
      );
    case "variant_missing":
      return (
        <s-banner tone="warning" heading="That product is no longer in your catalog">
          <s-paragraph>
            It may have been deleted in Shopify. Search again to find another
            product.
          </s-paragraph>
        </s-banner>
      );
    case "choose":
      return <Candidates lookup={lookup} />;
    case "stock":
      return <Stock lookup={lookup} matchesQuery={matchesQuery} now={now} />;
  }
}

const neverChanges = () => () => {};

/**
 * Shopify Mobile and POS expose the device camera to App Bridge; desktop
 * browsers do not. Read on the client only, so the server render and the
 * first client render agree.
 */
function useDeviceCamera(): boolean {
  return useSyncExternalStore(
    neverChanges,
    () =>
      typeof shopify !== "undefined" &&
      Boolean(shopify.environment.mobile || shopify.environment.pos),
    () => false,
  );
}

export default function Inventory() {
  const { lookup, matchesQuery, now } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const fieldRef = useRef<ComponentRef<"s-search-field">>(null);
  const hasCamera = useDeviceCamera();
  const loading = navigation.state !== "idle";

  // Keyboard-wedge scanners type into whatever has focus, so on desktop the
  // field takes focus after every lookup. Phones are left alone so the
  // on-screen keyboard does not cover the result.
  useEffect(() => {
    if (!hasCamera) fieldRef.current?.focus();
  }, [now, hasCamera]);

  // Polaris fields do not submit their form on Enter, and scanners end every
  // code with Enter. Submit here, and stop the key so a future native
  // submission cannot fire a second lookup.
  function submitOnEnter(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter" || event.target !== fieldRef.current) return;
    event.preventDefault();
    event.currentTarget.requestSubmit();
  }

  async function scanWithCamera() {
    let code: string;
    try {
      // Rejects when the scan is cancelled or the camera is unavailable.
      ({ data: code } = await shopify.scanner.capture());
    } catch {
      shopify.toast.show("No barcode was scanned");
      return;
    }
    await submit({ q: code }, { method: "get", action: "/app/inventory" });
  }

  return (
    <s-page heading="Inventory">
      <s-section>
        <Form method="get" action="/app/inventory" onKeyDown={submitOnEnter}>
          <s-stack gap="base">
            {/* Remounted after each lookup so the next scan starts from an
                empty field instead of appending to the last code. */}
            <s-search-field
              ref={fieldRef}
              key={now}
              name="q"
              label="Barcode, SKU or product name"
              placeholder="Scan or type a barcode, SKU or product name"
              autocomplete="off"
            />
            <s-stack direction="inline" gap="small">
              <s-button
                type="submit"
                variant="primary"
                {...(loading ? { loading: true } : {})}
              >
                Look up
              </s-button>
              {hasCamera ? (
                <s-button onClick={scanWithCamera}>Scan with camera</s-button>
              ) : null}
            </s-stack>
          </s-stack>
        </Form>
      </s-section>

      <Result lookup={lookup} matchesQuery={matchesQuery} now={now} />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
