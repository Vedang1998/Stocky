/**
 * Request-body size bounds.
 *
 * A handler that has to look at a request body before it can refuse the
 * request would otherwise hold whatever the client sends: Shopify webhook
 * verification buffers the whole body to compute the HMAC, and the tenant
 * check on signed-in requests reads form and JSON bodies for shop hints.
 * The body is read here first and reading stops once it passes the limit.
 */

/**
 * Shopify documents a 5 MB limit for HTTPS event deliveries and moves larger
 * payloads to an overflow URL, so 10 MiB leaves headroom for legitimate
 * deliveries while keeping the per-request memory cost bounded.
 */
export const WEBHOOK_MAX_BODY_BYTES = 10 * 1024 * 1024;

function payloadTooLarge(maxBytes: number): Response {
  return new Response(`Request body exceeds ${maxBytes} bytes`, {
    status: 413,
    headers: { "Content-Type": "text/plain; charset=utf-8", Connection: "close" },
  });
}

/**
 * Read the request body, or return `null` when it is larger than `maxBytes`.
 * A request without a body gives an empty array.
 *
 * The declared Content-Length is checked before any byte is read, and reading
 * stops as soon as the limit is crossed, so a client that lies about
 * Content-Length or uses chunked encoding is still bounded.
 *
 * The rest of an oversized body is left unread, not cancelled. Cancelling is
 * not safe on every adapter: the Vite dev server's request stream keeps
 * enqueueing after a cancel and takes the process down.
 */
export async function readBoundedBytes(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError(`maxBytes must be a non-negative safe integer, got ${maxBytes}`);
  }

  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const declaredBytes = Number(declared);
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      return null;
    }
  }

  if (request.body === null) {
    return new Uint8Array(0);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/**
 * Read at most `maxBytes` of the request body and return an equivalent
 * Request backed by the buffered bytes.
 *
 * Throws a 413 Response when the declared Content-Length or the streamed body
 * exceeds the limit (see `readBoundedBytes`). The 413 asks for the connection
 * to be closed, so the server drops it once it has answered and the unread
 * rest of the body with it.
 */
export async function readBoundedRequest(
  request: Request,
  maxBytes: number,
): Promise<Request> {
  const hasBody = request.body !== null;
  const body = await readBoundedBytes(request, maxBytes);
  if (body === null) {
    throw payloadTooLarge(maxBytes);
  }
  if (!hasBody) {
    return request;
  }

  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body,
    signal: request.signal,
  });
}
