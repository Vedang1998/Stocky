import { render } from "preact";

export default async () => {
  render(<InventoryTile />, document.body);
};

function InventoryTile() {
  return (
    <s-tile
      heading="ProPo"
      subheading="Stock, receiving, counts"
      onClick={() => shopify.action.presentModal()}
    />
  );
}
