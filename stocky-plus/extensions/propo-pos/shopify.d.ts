import "@shopify/ui-extensions";

declare module "./src/Tile.tsx" {
  const shopify: import("@shopify/ui-extensions/pos.home.tile.render").Api;
  const globalThis: { shopify: typeof shopify };
}

declare module "./src/Modal.tsx" {
  const shopify: import("@shopify/ui-extensions/pos.home.modal.render").Api;
  const globalThis: { shopify: typeof shopify };
}

declare module "./src/ProductStockBlock.tsx" {
  const shopify: import("@shopify/ui-extensions/pos.product-details.block.render").Api;
  const globalThis: { shopify: typeof shopify };
}

declare module "./src/ProductStockModal.tsx" {
  const shopify: import("@shopify/ui-extensions/pos.product-details.action.render").Api;
  const globalThis: { shopify: typeof shopify };
}
