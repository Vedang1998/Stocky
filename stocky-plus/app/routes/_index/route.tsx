import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect } from "react-router";

import styles from "./styles.module.css";

export const meta: MetaFunction = () => [
  { title: "ProPo — inventory planning and purchasing for Shopify" },
  {
    name: "description",
    content:
      "ProPo helps Shopify merchants plan replenishment, manage suppliers and purchase orders, receive stock, and run stocktakes and transfers.",
  },
];

// Shopify opens the app URL with ?shop=…&host=… (and embedded=1 inside the
// admin). Send those requests to the embedded app; everyone else gets a static
// page. Installation only ever starts from a Shopify-owned surface, so this
// page never asks for a store domain (App Store requirement 2.3.1).
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return null;
};

export default function Index() {
  return (
    <main className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>ProPo</h1>
        <p className={styles.text}>
          Inventory planning, purchasing and receiving for Shopify merchants.
        </p>
        <ul className={styles.list}>
          <li>
            <strong>Replenishment</strong>. Reorder suggestions from your
            Shopify sales history, with the calculation shown for every
            variant.
          </li>
          <li>
            <strong>Suppliers and purchase orders</strong>. Supplier SKUs and
            costs, purchase orders, and full or partial receiving.
          </li>
          <li>
            <strong>Stock control</strong>. Stocktakes, transfers between
            locations, and exportable inventory reports.
          </li>
        </ul>
        <p className={styles.note}>
          ProPo is installed from the Shopify App Store and runs inside your
          Shopify admin. Already installed? Open it from{" "}
          <strong>Apps</strong> in your Shopify admin.
        </p>
      </div>
    </main>
  );
}
