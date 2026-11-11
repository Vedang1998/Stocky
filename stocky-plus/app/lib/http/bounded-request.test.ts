import { describe, expect, it } from "vitest";
import {
  readBoundedRequest,
  WEBHOOK_MAX_BODY_BYTES,
} from "./bounded-request.server";

const URL_ = "https://app.example/webhooks/orders/create";

function streamOf(chunks: Uint8Array[], onPull?: () => void): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      onPull?.();
      if (index < chunks.length) controller.enqueue(chunks[index++]);
      else controller.close();
    },
  });
}

function streamedRequest(
  chunks: Uint8Array[],
  headers: Record<string, string> = {},
  onPull?: () => void,
): Request {
  return new Request(URL_, {
    method: "POST",
    headers,
    body: streamOf(chunks, onPull),
    duplex: "half",
  } as RequestInit);
}

async function expect413(promise: Promise<unknown>): Promise<void> {
  const thrown = await promise.then(
    () => null,
    (error: unknown) => error,
  );
  expect(thrown).toBeInstanceOf(Response);
  expect((thrown as Response).status).toBe(413);
}

describe("readBoundedRequest", () => {
  it("keeps the documented webhook limit at 10 MiB", () => {
    expect(WEBHOOK_MAX_BODY_BYTES).toBe(10 * 1024 * 1024);
  });

  it("returns an equivalent request when the body is within the limit", async () => {
    const body = JSON.stringify({ id: 1, title: "Widget" });
    const original = new Request(URL_, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-shopify-hmac-sha256": "abc",
      },
      body,
    });

    const bounded = await readBoundedRequest(original, 1024);

    expect(bounded.url).toBe(URL_);
    expect(bounded.method).toBe("POST");
    expect(bounded.headers.get("x-shopify-hmac-sha256")).toBe("abc");
    expect(bounded.headers.get("content-type")).toBe("application/json");
    expect(await bounded.text()).toBe(body);
  });

  it("accepts a body of exactly the limit", async () => {
    const body = new Uint8Array(64).fill(0x61);
    const bounded = await readBoundedRequest(streamedRequest([body]), 64);
    expect((await bounded.arrayBuffer()).byteLength).toBe(64);
  });

  it("reassembles multi-chunk bodies byte for byte", async () => {
    const chunks = [
      new TextEncoder().encode('{"a":'),
      new TextEncoder().encode('"é"'),
      new TextEncoder().encode("}"),
    ];
    const bounded = await readBoundedRequest(streamedRequest(chunks), 1024);
    expect(await bounded.json()).toEqual({ a: "é" });
  });

  it("refuses a declared Content-Length above the limit without reading the body", async () => {
    let pulls = 0;
    const request = streamedRequest(
      [new Uint8Array(10)],
      { "content-length": String(WEBHOOK_MAX_BODY_BYTES + 1) },
      () => {
        pulls += 1;
      },
    );

    await expect413(readBoundedRequest(request, WEBHOOK_MAX_BODY_BYTES));
    expect(pulls).toBe(0);
  });

  it("refuses a streamed body without Content-Length once it passes the limit", async () => {
    let pulls = 0;
    const chunk = new Uint8Array(40).fill(0x62);
    const request = streamedRequest([chunk, chunk, chunk, chunk, chunk], {}, () => {
      pulls += 1;
    });

    await expect413(readBoundedRequest(request, 100));
    // Reading stops at the chunk that crosses the limit (3 x 40 > 100).
    expect(pulls).toBe(3);
  });

  it("refuses a body larger than an understated Content-Length", async () => {
    const request = streamedRequest([new Uint8Array(200)], {
      "content-length": "10",
    });
    await expect413(readBoundedRequest(request, 100));
  });

  it("passes through requests without a body", async () => {
    const request = new Request(URL_, { method: "GET" });
    expect(await readBoundedRequest(request, 0)).toBe(request);
  });

  it("rejects an invalid limit", async () => {
    await expect(
      readBoundedRequest(new Request(URL_, { method: "GET" }), -1),
    ).rejects.toThrow(RangeError);
  });
});
