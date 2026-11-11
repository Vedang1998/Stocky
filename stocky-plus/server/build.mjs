/**
 * The server build that `npm start` serves.
 *
 * It is the React Router build with one value replaced: the hosts allowed to
 * submit actions. A build cannot know the host it will be deployed on, so the
 * value comes from `SHOPIFY_APP_URL` when the server starts. This is the
 * runtime override React Router documents for `allowedActionOrigins`, written
 * as a module so the stock `react-router-serve` can load it: an export
 * declared here takes precedence over the same name in `export *`.
 */
import process from "node:process";
import { allowedActionOrigins as fromAppUrl } from "./action-origins.mjs";

export * from "../build/server/index.js";

export const allowedActionOrigins = fromAppUrl(process.env.SHOPIFY_APP_URL);
