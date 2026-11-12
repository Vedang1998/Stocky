/**
 * Server-rendering a route component from loader and action data the way the
 * browser receives it, for tests of what a page shows.
 */
import { createElement, type ComponentType } from "react";
import { renderToString } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
} from "react-router";

/** Paths of values the single-fetch encoder would not carry across faithfully. */
export function unsafeWirePaths(value: unknown, path = "$"): string[] {
  if (value === null || typeof value !== "object" || value instanceof Date) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      unsafeWirePaths(entry, `${path}[${index}]`),
    );
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return [path];
  return Object.entries(value).flatMap(([key, entry]) =>
    unsafeWirePaths(entry, `${path}.${key}`),
  );
}

/**
 * Render a route component from data that has crossed a serialization
 * boundary. structuredClone only carries plain data, so a class instance left
 * in the loader result fails here instead of rendering through its server-side
 * prototype. React's separators between adjacent text nodes are removed so
 * the result reads as the page's text.
 */
export async function renderRoute(
  Component: ComponentType,
  loaderData: unknown,
  actionData?: unknown,
): Promise<string> {
  const handler = createStaticHandler([
    {
      id: "route",
      path: "/",
      Component,
      loader: () => structuredClone(loaderData),
      action: () => structuredClone(actionData),
    },
  ]);
  const request =
    actionData === undefined
      ? new Request("https://app.example.test/")
      : new Request("https://app.example.test/", {
          method: "POST",
          body: new URLSearchParams(),
        });
  const context = await handler.query(request);
  if (context instanceof Response) {
    throw new Error(
      `Route responded with ${context.status} instead of rendering`,
    );
  }
  const router = createStaticRouter(handler.dataRoutes, context);
  return renderToString(
    createElement(StaticRouterProvider, { router, context, hydrate: false }),
  ).replaceAll("<!-- -->", "");
}
