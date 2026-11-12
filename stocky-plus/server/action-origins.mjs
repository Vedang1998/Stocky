/**
 * Hosts whose pages may submit actions to this app's UI routes.
 *
 * React Router refuses an action whose `Origin` header is not the origin of
 * `request.url`, unless the origin's host is listed in the server build's
 * `allowedActionOrigins`. Since react-router 7.18.3 the scheme is part of
 * that comparison. Behind a TLS-terminating proxy, and behind the dev tunnel,
 * the browser's origin is `https://<app host>` while the server sees the
 * request as `http://`, so the app's own public host has to be listed or
 * every form in the embedded app is answered with 400.
 *
 * Only that host is listed. A missing or unusable app URL yields an empty
 * list, which leaves the check at its strictest.
 *
 * Plain JavaScript because the production server loads it without a build
 * step (`server/build.mjs`).
 *
 * @param {string | undefined} appUrl The app's public URL (`SHOPIFY_APP_URL`).
 * @returns {string[]}
 */
export function allowedActionOrigins(appUrl) {
  if (!appUrl) return [];

  let url;
  try {
    url = new URL(appUrl);
  } catch {
    return [];
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return [];

  return [url.host];
}
