import { Form } from "react-router";
import { submitOnEnter } from "../../lib/submit-on-enter";

export type ProductSearchResult = {
  variantGid: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  /** Already a line on this purchase order; adding it again raises that line. */
  onOrder: boolean;
};

export type ProductSearch = {
  query: string;
  results: ProductSearchResult[];
  hasMore: boolean;
};

export function AddProducts({
  purchaseOrderId,
  version,
  currency,
  search,
}: {
  purchaseOrderId: string;
  version: number;
  currency: string;
  search: ProductSearch;
}) {
  return (
    <s-section heading="Add products">
      <s-stack direction="block" gap="base">
        <Form method="get" onKeyDown={submitOnEnter}>
          <s-stack direction="inline" gap="small-200" alignItems="end">
            <s-search-field
              label="Find a product"
              name="find"
              value={search.query}
              placeholder="Product name, SKU or barcode"
            />
            <s-button type="submit">Search</s-button>
          </s-stack>
        </Form>

        {search.query && search.results.length === 0 && (
          <s-paragraph>
            No products match “{search.query}”. Products appear here once they
            have synced from Shopify.
          </s-paragraph>
        )}

        {search.results.length > 0 && (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Product</s-table-header>
              <s-table-header>Add to order</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {search.results.map((result) => (
                <s-table-row key={result.variantGid}>
                  <s-table-cell>
                    <s-stack direction="block" gap="small-400">
                      <s-text>{result.name}</s-text>
                      <s-text color="subdued">
                        {[
                          result.sku ? `SKU ${result.sku}` : null,
                          result.barcode ? `Barcode ${result.barcode}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "No SKU or barcode"}
                      </s-text>
                      {result.onOrder && <s-badge>On this order</s-badge>}
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    <Form method="post" onKeyDown={submitOnEnter}>
                      <input type="hidden" name="intent" value="addLine" />
                      <input type="hidden" name="version" value={version} />
                      <input
                        type="hidden"
                        name="variantGid"
                        value={result.variantGid}
                      />
                      <s-stack
                        direction="inline"
                        gap="small-200"
                        alignItems="end"
                      >
                        <s-number-field
                          label="Quantity"
                          name="quantity"
                          value="1"
                          min={1}
                          step={1}
                          required
                        />
                        <s-number-field
                          label={`Unit cost (${currency})`}
                          name="unitCost"
                          placeholder="Supplier price"
                          min={0}
                          step={0.0001}
                        />
                        <s-button type="submit" variant="secondary">
                          {result.onOrder ? "Add more" : "Add"}
                        </s-button>
                      </s-stack>
                    </Form>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}

        {search.hasMore && (
          <s-text color="subdued">
            Showing the first {search.results.length} matches. Type more of the
            name or the full SKU to narrow the list.
          </s-text>
        )}
        {search.query && (
          <s-link href={`/app/purchase-orders/${purchaseOrderId}`}>
            Clear search
          </s-link>
        )}
      </s-stack>
    </s-section>
  );
}
