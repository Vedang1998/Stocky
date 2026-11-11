/**
 * Request-body size bounds for unauthenticated entry points.
 *
 * Shopify webhook verification has to buffer the whole body to compute the
 * HMAC, so without a bound any unauthenticated client can make the server hold
 * arbitrarily large payloads in memory before the signature is rejected.
 * The body is read here first, refused once it passes the limit, and handed
 * back as a fresh Request so downstream verification is unchanged.
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
 * Read at most `maxBytes` of the request body and return an equivalent
 * Request backed by the buffered bytes.
 *
 * Throws a 413 Response when the declared Content-Length or the streamed body
 * exceeds the limit. The declared length is checked before any byte is read,
 * and the stream is cancelled as soon as the limit is crossed, so a client
 * that lies about Content-Length or uses chunked encoding is still bounded.
 */
export async function readBoundedRequest(
  request: Request,
  maxBytes: number,
): Promise<Request> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError(`maxBytes must be a non-negative safe integer, got ${maxBytes}`);
  }

  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const declaredBytes = Number(declared);
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      await request.body?.cancel().catch(() => undefined);
      throw payloadTooLarge(maxBytes);
    }
  }

  if (request.body === null) {
    return request;
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw payloadTooLarge(maxBytes);
    }
    chunks.push(value);
  }

  const body = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body,
    signal: request.signal,
  });
}
