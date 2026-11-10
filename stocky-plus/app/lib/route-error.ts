import { isRouteErrorResponse } from "react-router";

export type RouteErrorView = {
  status: number;
  title: string;
  message: string;
};

const MAX_DETAIL_LENGTH = 200;

/**
 * The Shopify library signals auth steps by throwing Responses meant for
 * `boundary.error`: an HTML document (session-token bounce, exit-iframe) or an
 * empty 401 carrying App Bridge retry/reauthorize headers. Everything else is
 * an application error. That includes the empty 500 the library throws when
 * token exchange or the afterAuth hook fails; rendering that through
 * `boundary.error` leaves the merchant on a blank "Handling response" screen.
 */
export function isShopifyAuthFlowResponse(error: unknown): boolean {
  if (!isRouteErrorResponse(error)) return false;
  const body = typeof error.data === "string" ? error.data.trim() : error.data;
  if (body == null || body === "") return error.status === 401;
  return typeof body === "string" && body.startsWith("<");
}

// Only short, single-line plain text thrown by our own routes is shown.
// Router-generated responses (`internal`) carry developer messages.
function safeDetail(error: { data: unknown; internal?: boolean }): string | null {
  if (error.internal || typeof error.data !== "string") return null;
  const text = error.data.trim();
  if (
    text === "" ||
    text.startsWith("<") ||
    text.includes("\n") ||
    text.length > MAX_DETAIL_LENGTH
  ) {
    return null;
  }
  return text;
}

/**
 * Map a thrown route error to merchant-facing copy. Server errors never expose
 * their message or stack; 4xx responses may show the short plain-text body the
 * route threw (for example "Supplier not found").
 */
export function describeRouteError(error: unknown): RouteErrorView {
  if (isRouteErrorResponse(error)) {
    const detail = safeDetail(error);

    if (error.status === 404) {
      return {
        status: 404,
        title: "Page not found",
        message: detail ?? "This page doesn't exist or is no longer available.",
      };
    }
    if (error.status === 401 || error.status === 403) {
      return {
        status: error.status,
        title: "Access not available",
        message:
          detail ?? "Your account or plan doesn't include access to this page.",
      };
    }
    if (error.status >= 400 && error.status < 500) {
      return {
        status: error.status,
        title: "Request couldn't be completed",
        message: detail ?? "Check the information you entered and try again.",
      };
    }
    return serverError(error.status);
  }

  return serverError(500);
}

function serverError(status: number): RouteErrorView {
  return {
    status,
    title: "Something went wrong",
    message:
      "ProPo couldn't load this page. Reload to try again. If the problem continues, contact ProPo support.",
  };
}
