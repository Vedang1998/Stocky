import { render } from "preact";

export default async () => {
  render(<InventoryTile />, document.body);
};

function InventoryTile() {
  return (
    <s-tile
      heading="Inventory lookup"
      subheading="Stock by location"
      onClick={() => shopify.action.presentModal()}
    />
  );
}
