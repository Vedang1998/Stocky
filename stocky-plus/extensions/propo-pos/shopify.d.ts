import "@shopify/ui-extensions";

declare module "./src/Tile.tsx" {
  const shopify: import("@shopify/ui-extensions/pos.home.tile.render").Api;
  const globalThis: { shopify: typeof shopify };
}

declare module "./src/Modal.tsx" {
  const shopify: import("@shopify/ui-extensions/pos.home.modal.render").Api;
  const globalThis: { shopify: typeof shopify };
}
