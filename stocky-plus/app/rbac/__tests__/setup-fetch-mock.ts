import { setAbstractFetchFunc } from "@shopify/shopify-api/runtime";
import { authxFetch } from "./authx-mock";

globalThis.fetch = authxFetch as typeof fetch;
setAbstractFetchFunc(authxFetch as typeof fetch);
