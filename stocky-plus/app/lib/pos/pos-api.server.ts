import {
  requirePosTenant,
  type PosTenantContext,
} from "../../tenant/require-pos-tenant.server";
import { TenantAccessError } from "../../tenant/errors";
import { isProductVariantGid } from "../shopify-gid";
import { checkPosRateLimit } from "./pos-rate-limit.server";

/** Header POS reads to know it must re-authenticate the user. */
const REAUTHORIZE_URL_HEADER = "X-Shopify-API-Request-Failure-Reauthorize-Url";

export type PosApiErrorCode =
  | "bad_request"
  | "not_found"
  | "forbidden"
  | "rate_limited"
  | "internal_error";

export class PosApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: PosApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PosApiError";
  }
}

/**
 * POS extensions call the app from Shopify's CDN origins, so every response —
 * including auth failures — needs CORS headers or the extension only sees a
 * network error. Mirrors the headers authenticate.pos adds on success.
 */
export function withPosCors(request: Request, response: Response): Response {
  const origin = request.headers.get("Origin");
  if (origin && origin !== process.env.SHOPIFY_APP_URL) {
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type",
    );
    response.headers.set(
      "Access-Control-Expose-Headers",
      REAUTHORIZE_URL_HEADER,
    );
  }
  return response;
}

export function posJson(body: unknown, init: { status?: number } = {}): Response {
  return Response.json(body, {
    status: init.status ?? 200,
    headers: { "Cache-Control": "no-store" },
  });
}

function errorResponse(status: number, code: PosApiErrorCode, message: string) {
  return posJson({ error: { code, message } }, { status });
}

/**
 * Run a POS API handler with verified tenant authority, within the shop's and
 * staff member's request allowance. Authentication failures, tenant denials,
 * rate limiting and unexpected errors all come back as JSON the extension can
 * read.
 */
export async function handlePosApiRequest(
  request: Request,
  handler: (context: PosTenantContext) => Promise<Response>,
): Promise<Response> {
  let context: PosTenantContext;
  try {
    context = await requirePosTenant({ request });
  } catch (error) {
    if (error instanceof Response) return withPosCors(request, error);
    if (error instanceof TenantAccessError) {
      console.warn("POS API request denied", {
        path: new URL(request.url).pathname,
        code: error.code,
      });
      return withPosCors(
        request,
        errorResponse(403, "forbidden", "This shop cannot use ProPo on POS right now."),
      );
    }
    console.error("POS API authentication failed unexpectedly", {
      path: new URL(request.url).pathname,
      error: error instanceof Error ? error.message : String(error),
    });
    return withPosCors(
      request,
      errorResponse(500, "internal_error", "Something went wrong. Try again."),
    );
  }

  const rateLimit = await checkPosRateLimit(context);
  if (!rateLimit.allowed) {
    if (rateLimit.firstDenial) {
      console.warn("POS API rate limit reached", {
        path: new URL(request.url).pathname,
        correlationId: context.tenant.correlationId,
        scope: rateLimit.scope,
      });
    }
    const response = errorResponse(
      429,
      "rate_limited",
      "Too many requests. Wait a moment and try again.",
    );
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return context.cors(response);
  }

  try {
    return context.cors(await handler(context));
  } catch (error) {
    if (error instanceof PosApiError) {
      return context.cors(errorResponse(error.status, error.code, error.message));
    }
    console.error("POS API request failed", {
      path: new URL(request.url).pathname,
      correlationId: context.tenant.correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return context.cors(
      errorResponse(500, "internal_error", "Something went wrong. Try again."),
    );
  }
}

const LOCATION_ID = /^\d{1,20}$/;

/** POS sessions expose the numeric location ID; facts are keyed by GID. */
export function parsePosLocation(value: string | null): string | null {
  if (value === null || value === "") return null;
  if (!LOCATION_ID.test(value)) {
    throw new PosApiError(400, "bad_request", "location must be a numeric ID");
  }
  return `gid://shopify/Location/${value}`;
}

export function parseVariantGid(value: string | null): string {
  if (!value || !isProductVariantGid(value)) {
    throw new PosApiError(400, "bad_request", "variant must be a ProductVariant GID");
  }
  return value;
}
