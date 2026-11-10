import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { LoginErrorType } from "@shopify/shopify-app-react-router/server";

import { login } from "../../shopify.server";

import styles from "../_index/styles.module.css";

// The Shopify library sends unauthenticated, non-embedded requests here.
// With a ?shop= parameter, login() redirects to Shopify's own install/grant
// screen. Without one there is nothing to authenticate: the merchant is told to
// open ProPo from their Shopify admin. The app never asks merchants to type a
// store domain (App Store requirement 2.3.1).
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const result = await login(request);

  return { invalidShop: result.shop === LoginErrorType.InvalidShop };
};

export default function Auth() {
  const { invalidShop } = useLoaderData<typeof loader>();

  return (
    <main className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Open ProPo from Shopify</h1>
        {invalidShop ? (
          <p className={styles.text} role="alert">
            That link doesn&apos;t point to a valid Shopify store.
          </p>
        ) : null}
        <p className={styles.note}>
          ProPo runs inside your Shopify admin. Go to <strong>Apps</strong> in
          your Shopify admin and select <strong>ProPo</strong>. To add ProPo to
          a store, install it from the Shopify App Store.
        </p>
      </div>
    </main>
  );
}
