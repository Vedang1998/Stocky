import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { RouteErrorPage } from "../components/RouteErrorPage";
import { APP_HOME, APP_NAV_ITEMS } from "../lib/navigation";
import { describeRouteError, isShopifyAuthFlowResponse } from "../lib/route-error";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        {/* rel="home" points the app name at this link and keeps it out of
            the menu. polaris-types does not declare the attribute. */}
        <s-link href={APP_HOME.href} {...{ rel: "home" }}>
          {APP_HOME.label}
        </s-link>
        {APP_NAV_ITEMS.map((item) => (
          <s-link key={item.href} href={item.href}>
            {item.label}
          </s-link>
        ))}
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  // Auth-flow responses (session-token bounce, exit-iframe, retry) must keep
  // reaching the Shopify library's boundary; anything else is an app error.
  if (isShopifyAuthFlowResponse(error)) {
    return boundary.error(error);
  }
  return <RouteErrorPage view={describeRouteError(error)} />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
