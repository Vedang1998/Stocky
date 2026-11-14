import { Form } from "react-router";
import { formatMoney } from "../../lib/decimal-format";
import { submitOnEnter } from "../../lib/submit-on-enter";
import type {
  SupplierProductView,
  SupplierView,
} from "../../services/purchasing/supplier-view.server";

const UNIT_COST_DIGITS = { maximumFractionDigits: 4 };

function productCodes(product: {
  sku: string | null;
  barcode: string | null;
}): string {
  return (
    [
      product.sku ? `SKU ${product.sku}` : null,
      product.barcode ? `Barcode ${product.barcode}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "No SKU or barcode"
  );
}

function tierRange(tier: { minQty: number; maxQty: number | null }): string {
  return tier.maxQty === null
    ? `${tier.minQty} or more`
    : `${tier.minQty} to ${tier.maxQty}`;
}

function productsHref(supplierId: string, page: number, edit?: string) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (edit) params.set("edit", edit);
  const query = params.toString();
  return `/app/suppliers/${supplierId}${query ? `?${query}` : ""}`;
}

export function SupplierProducts({
  supplier,
  editable,
  editProductId,
}: {
  supplier: SupplierView;
  editable: boolean;
  editProductId: string | null;
}) {
  const { products, productPage, hasNextProductPage } = supplier;
  return (
    <s-section heading={`Products (${supplier.productCount})`}>
      <s-stack direction="block" gap="base">
        {products.length === 0 ? (
          <s-paragraph>
            {productPage > 1
              ? "No products on this page."
              : "No products yet. Add the products you buy from this supplier, with their supplier SKU, cost and order minimums."}
          </s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Product</s-table-header>
              <s-table-header>Supplier SKU</s-table-header>
              <s-table-header format="currency">Cost</s-table-header>
              <s-table-header format="numeric">Minimum</s-table-header>
              <s-table-header format="numeric">Pack</s-table-header>
              <s-table-header>Lead time</s-table-header>
              {editable && <s-table-header>Edit</s-table-header>}
            </s-table-header-row>
            <s-table-body>
              {products.map((product) => (
                <s-table-row key={product.id}>
                  <s-table-cell>
                    <s-stack direction="block" gap="small-400">
                      <s-text>{product.name}</s-text>
                      <s-text color="subdued">{productCodes(product)}</s-text>
                      <s-stack direction="inline" gap="small-200">
                        {product.isPreferred && (
                          <s-badge tone="success">Preferred supplier</s-badge>
                        )}
                        {product.priceTiers.length > 0 && (
                          <s-badge>
                            {product.priceTiers.length === 1
                              ? "1 price tier"
                              : `${product.priceTiers.length} price tiers`}
                          </s-badge>
                        )}
                        {product.missing && (
                          <s-badge tone="warning">Not in Shopify</s-badge>
                        )}
                      </s-stack>
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>{product.vendorSku ?? "—"}</s-table-cell>
                  <s-table-cell>
                    {formatMoney(
                      product.supplierCost,
                      supplier.currency,
                      UNIT_COST_DIGITS,
                    )}
                  </s-table-cell>
                  <s-table-cell>{product.moq}</s-table-cell>
                  <s-table-cell>
                    {product.packSize}
                    {product.orderUnit ? ` per ${product.orderUnit}` : ""}
                  </s-table-cell>
                  <s-table-cell>
                    {product.leadTimeDaysOverride === null
                      ? "Supplier default"
                      : `${product.leadTimeDaysOverride} days`}
                  </s-table-cell>
                  {editable && (
                    <s-table-cell>
                      {product.id === editProductId ? (
                        <s-text color="subdued">Editing</s-text>
                      ) : (
                        <s-link
                          href={productsHref(
                            supplier.id,
                            productPage,
                            product.id,
                          )}
                        >
                          Edit
                        </s-link>
                      )}
                    </s-table-cell>
                  )}
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}

        {(productPage > 1 || hasNextProductPage) && (
          <s-stack direction="inline" gap="small-200" alignItems="center">
            {productPage > 1 && (
              <s-button href={productsHref(supplier.id, productPage - 1)}>
                Previous
              </s-button>
            )}
            <s-text color="subdued">Page {productPage}</s-text>
            {hasNextProductPage && (
              <s-button href={productsHref(supplier.id, productPage + 1)}>
                Next
              </s-button>
            )}
          </s-stack>
        )}
      </s-stack>
    </s-section>
  );
}

export function SupplierProductEditor({
  supplier,
  product,
  fieldErrors,
  tierErrors,
}: {
  supplier: SupplierView;
  product: SupplierProductView;
  fieldErrors: Record<string, string>;
  tierErrors: Record<string, string>;
}) {
  const closeHref = productsHref(supplier.id, supplier.productPage);
  return (
    <s-section heading={`Edit ${product.name}`}>
      <s-stack direction="block" gap="base">
        <s-text color="subdued">{productCodes(product)}</s-text>
        <Form method="post" onKeyDown={submitOnEnter}>
          <input type="hidden" name="intent" value="saveProduct" />
          <input type="hidden" name="variantGid" value={product.variantGid} />
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="base">
              <s-text-field
                label="Supplier SKU"
                name="vendorSku"
                value={product.vendorSku ?? ""}
                maxLength={255}
                error={fieldErrors.vendorSku}
              />
              <s-number-field
                label={`Cost (${supplier.currency})`}
                name="supplierCost"
                value={product.supplierCost ?? ""}
                min={0}
                step={0.0001}
                details="Used for new purchase-order lines when no price tier applies."
                error={fieldErrors.supplierCost}
              />
            </s-stack>
            <s-stack direction="inline" gap="base">
              <s-number-field
                label="Minimum order quantity"
                name="moq"
                value={String(product.moq)}
                min={1}
                step={1}
                error={fieldErrors.moq}
              />
              <s-number-field
                label="Pack size"
                name="packSize"
                value={String(product.packSize)}
                min={1}
                step={1}
                error={fieldErrors.packSize}
              />
              <s-text-field
                label="Order unit"
                name="orderUnit"
                value={product.orderUnit ?? ""}
                maxLength={64}
                placeholder="case"
                error={fieldErrors.orderUnit}
              />
              <s-number-field
                label="Lead time (days)"
                name="leadTimeDaysOverride"
                value={
                  product.leadTimeDaysOverride === null
                    ? ""
                    : String(product.leadTimeDaysOverride)
                }
                min={0}
                max={730}
                step={1}
                details="Leave empty to use the supplier's lead time."
                error={fieldErrors.leadTimeDaysOverride}
              />
            </s-stack>
            <s-checkbox
              label="Preferred supplier for this product"
              name="isPreferred"
              details="Replenishment orders this product from its preferred supplier. Marking it here clears the mark on its other suppliers."
              {...(product.isPreferred ? { checked: true } : {})}
            />
            <s-stack direction="inline" gap="small-200">
              <s-button type="submit" variant="primary">
                Save terms
              </s-button>
              <s-button href={closeHref} variant="tertiary">
                Done
              </s-button>
            </s-stack>
          </s-stack>
        </Form>

        <s-heading>Volume pricing</s-heading>
        {product.priceTiers.length === 0 ? (
          <s-paragraph>
            No price tiers. Add one when this supplier charges less for larger
            quantities.
          </s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Quantity</s-table-header>
              <s-table-header format="currency">Unit cost</s-table-header>
              <s-table-header>Remove</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {product.priceTiers.map((tier) => (
                <s-table-row key={tier.id}>
                  <s-table-cell>{tierRange(tier)}</s-table-cell>
                  <s-table-cell>
                    {formatMoney(
                      tier.unitCost,
                      supplier.currency,
                      UNIT_COST_DIGITS,
                    )}
                  </s-table-cell>
                  <s-table-cell>
                    <Form method="post">
                      <input type="hidden" name="intent" value="removeTier" />
                      <input type="hidden" name="tierId" value={tier.id} />
                      <s-button
                        type="submit"
                        variant="tertiary"
                        tone="critical"
                      >
                        Remove
                      </s-button>
                    </Form>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
        <Form method="post" onKeyDown={submitOnEnter}>
          <input type="hidden" name="intent" value="addTier" />
          <input type="hidden" name="variantGid" value={product.variantGid} />
          <s-stack direction="inline" gap="small-200" alignItems="end">
            <s-number-field
              label="From quantity"
              name="minQty"
              min={1}
              step={1}
              required
              error={tierErrors.minQty}
            />
            <s-number-field
              label="To quantity"
              name="maxQty"
              min={1}
              step={1}
              placeholder="No limit"
              error={tierErrors.maxQty}
            />
            <s-number-field
              label={`Unit cost (${supplier.currency})`}
              name="unitCost"
              min={0}
              step={0.0001}
              required
              error={tierErrors.unitCost}
            />
            <s-button type="submit" variant="secondary">
              Add tier
            </s-button>
          </s-stack>
        </Form>

        <s-divider />
        <Form method="post">
          <input type="hidden" name="intent" value="removeProduct" />
          <input type="hidden" name="mappingId" value={product.id} />
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-button type="submit" variant="secondary" tone="critical">
              Remove from supplier
            </s-button>
            <s-text color="subdued">
              Its terms and price tiers are deleted. Existing purchase orders
              are not changed.
            </s-text>
          </s-stack>
        </Form>
      </s-stack>
    </s-section>
  );
}

export type SupplierProductSearch = {
  query: string;
  results: Array<{
    variantGid: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    linked: boolean;
  }>;
  hasMore: boolean;
};

export function AddSupplierProducts({
  supplierId,
  search,
  vendors,
  fieldErrors,
}: {
  supplierId: string;
  search: SupplierProductSearch;
  vendors: string[];
  fieldErrors: Record<string, string>;
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
              <s-table-header>Add</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {search.results.map((result) => (
                <s-table-row key={result.variantGid}>
                  <s-table-cell>
                    <s-stack direction="block" gap="small-400">
                      <s-text>{result.name}</s-text>
                      <s-text color="subdued">{productCodes(result)}</s-text>
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    {result.linked ? (
                      <s-badge>Already added</s-badge>
                    ) : (
                      <Form method="post">
                        <input type="hidden" name="intent" value="addProduct" />
                        <input
                          type="hidden"
                          name="variantGid"
                          value={result.variantGid}
                        />
                        <s-button type="submit" variant="secondary">
                          Add
                        </s-button>
                      </Form>
                    )}
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
          <s-link href={`/app/suppliers/${supplierId}`}>Clear search</s-link>
        )}

        {vendors.length > 0 && (
          <Form method="post">
            <input type="hidden" name="intent" value="addVendor" />
            <s-stack direction="inline" gap="small-200" alignItems="end">
              <s-select
                label="Add every product from a Shopify vendor"
                name="vendor"
                error={fieldErrors.vendor}
              >
                {vendors.map((vendor) => (
                  <s-option key={vendor} value={vendor}>
                    {vendor}
                  </s-option>
                ))}
              </s-select>
              <s-button type="submit" variant="secondary">
                Add vendor&apos;s products
              </s-button>
            </s-stack>
          </Form>
        )}
      </s-stack>
    </s-section>
  );
}
