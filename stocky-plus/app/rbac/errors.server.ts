/**
 * PR7 checkpoint A — actor / owner-proof boundary errors.
 *
 * Messages must never include ID tokens, access tokens, or secrets.
 *
 * Invalid/expired/malformed embedded credentials are converted at the HTTP
 * wrapper into the installed library refresh contract (401 + retry header for
 * Authorization-bearing requests; bounce redirect for document requests).
 * `ActorBoundaryError.toResponse()` is not that contract and is not used by
 * merchandising routes.
 */

/** Installed `@shopify/shopify-app-react-router` RETRY_INVALID_SESSION_HEADER. */
export const RETRY_INVALID_SESSION_HEADER_NAME =
  "X-Shopify-Retry-Invalid-Session-Request";

export const INVALID_EMBEDDED_SESSION_CODES = [
  "ID_TOKEN_INVALID",
  "ID_TOKEN_MALFORMED",
  "ID_TOKEN_ISS_DEST_MISMATCH",
] as const;

export type InvalidEmbeddedSessionCode =
  (typeof INVALID_EMBEDDED_SESSION_CODES)[number];

export class ActorBoundaryError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus = 401) {
    super(message);
    this.name = "ActorBoundaryError";
    this.code = code;
    this.httpStatus = httpStatus;
  }

  toResponse(): Response {
    return new Response(JSON.stringify({ code: this.code }), {
      status: this.httpStatus,
      headers: { "content-type": "application/json" },
    });
  }
}

export function throwActorBoundary(
  code: string,
  message: string,
  httpStatus = 401,
): never {
  throw new ActorBoundaryError(code, message, httpStatus);
}

export function isInvalidEmbeddedSessionError(
  error: unknown,
): error is ActorBoundaryError & { code: InvalidEmbeddedSessionCode } {
  return (
    error instanceof ActorBoundaryError &&
    (INVALID_EMBEDDED_SESSION_CODES as readonly string[]).includes(error.code)
  );
}

/**
 * Library-compatible denial for invalid embedded session credentials.
 *
 * Authorization present → 401 + `X-Shopify-Retry-Invalid-Session-Request: 1`
 * (App Bridge refresh). No Authorization → bounce to `/auth/session-token`
 * like `redirectToBouncePage`. Does not send the invalid token through
 * `authenticate.admin`.
 */
export function denyInvalidEmbeddedSession(request: Request): never {
  const hasAuthorization = Boolean(request.headers.get("authorization"));
  if (hasAuthorization) {
    throw new Response(undefined, {
      status: 401,
      statusText: "Unauthorized",
      headers: { [RETRY_INVALID_SESSION_HEADER_NAME]: "1" },
    });
  }

  const url = new URL(request.url);
  url.searchParams.delete("id_token");
  const configuredAppUrl = (process.env.SHOPIFY_APP_URL ?? "").replace(/\/$/, "");
  const appUrl =
    configuredAppUrl.length > 0
      ? configuredAppUrl
      : `${url.protocol}//${url.host}`;
  const reload = `${appUrl}${url.pathname}?${url.searchParams.toString()}`;
  url.searchParams.set("shopify-reload", reload);
  throw new Response(null, {
    status: 302,
    statusText: "Found",
    headers: {
      Location: `/auth/session-token?${url.searchParams.toString()}`,
    },
  });
}
