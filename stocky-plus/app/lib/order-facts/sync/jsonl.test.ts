import { describe, expect, it } from "vitest";
import { assembleOrderFactsJsonl, nominatedOrderGids } from "./jsonl";
import { ORDER_FACTS_JSONL_MAX_LIVE_BYTES } from "./constants";

async function* linesOf(text: string) {
  yield text;
}

async function* byteChunks(bytes: Uint8Array, size: number) {
  for (let offset = 0; offset < bytes.length; offset += size) {
    yield bytes.slice(offset, offset + size);
  }
}

function failReason(result: Awaited<ReturnType<typeof assembleOrderFactsJsonl>>): string {
  expect(result.status).not.toBe("COMPLETE");
  if (result.status === "COMPLETE") {
    throw new Error("expected JSONL failure");
  }
  return result.reason;
}

function rootLine(index: number, quantity = 0) {
  return JSON.stringify({
    id: `gid://shopify/Order/${index}`,
    currentSubtotalLineItemsQuantity: quantity,
  });
}

describe("PR6-D JSONL assembly", () => {
  it("assembles parent then child without groupObjects:false ordering", async () => {
    const child = JSON.stringify({
      id: "gid://shopify/LineItem/1",
      __parentId: "gid://shopify/Order/1",
    });
    const parent = JSON.stringify({
      id: "gid://shopify/Order/1",
      currentSubtotalLineItemsQuantity: 1,
    });
    const result = await assembleOrderFactsJsonl(
      linesOf(`${child}\n${parent}\n`),
      { expectedObjectCount: "2", expectedRootObjectCount: "1" },
    );
    expect(result.status).toBe("COMPLETE");
    expect(nominatedOrderGids(result)).toEqual(["gid://shopify/Order/1"]);
  });

  it("fails closed on truncated final line", async () => {
    const result = await assembleOrderFactsJsonl(
      linesOf('{"id":"gid://shopify/Order/1"'),
      { expectedObjectCount: "1", expectedRootObjectCount: "1" },
    );
    expect(result.status).toBe("TRUNCATED");
  });

  it("fails closed on duplicate ids", async () => {
    const line = JSON.stringify({
      id: "gid://shopify/Order/1",
      currentSubtotalLineItemsQuantity: 0,
    });
    const result = await assembleOrderFactsJsonl(linesOf(`${line}\n${line}\n`), {
      expectedObjectCount: "2",
      expectedRootObjectCount: "2",
    });
    expect(result.status).toBe("DUPLICATE");
  });

  it("fails closed on mis-parented children", async () => {
    const result = await assembleOrderFactsJsonl(
      linesOf(
        `${JSON.stringify({ id: "gid://shopify/LineItem/1", __parentId: "gid://shopify/Order/missing" })}\n`,
      ),
      { expectedObjectCount: "1", expectedRootObjectCount: "0" },
    );
    expect(result.status).toBe("MIS_PARENTED");
  });

  it("completes 33 sequential roots by releasing the active window", async () => {
    const lines = Array.from({ length: 33 }, (_, i) => rootLine(i + 1, 0)).join(
      "\n",
    );
    const result = await assembleOrderFactsJsonl(linesOf(`${lines}\n`), {
      maxOpenParents: 32,
      expectedObjectCount: "33",
      expectedRootObjectCount: "33",
    });
    expect(result.status).toBe("COMPLETE");
    expect(result.rootCount).toBe(33);
  });

  it("fails closed when 33 parents stay open without quantity evidence", async () => {
    const lines = Array.from({ length: 33 }, (_, i) =>
      JSON.stringify({
        id: `gid://shopify/LineItem/${i + 1}`,
        __parentId: `gid://shopify/Order/${i + 1}`,
      }),
    ).join("\n");
    const result = await assembleOrderFactsJsonl(linesOf(`${lines}\n`), {
      maxOpenParents: 32,
      expectedObjectCount: "33",
      expectedRootObjectCount: "0",
    });
    expect(result.status).toBe("OPEN_PARENT_BOUND");
  });

  it("completes 40, 100, and 1000 sequential roots", async () => {
    for (const count of [40, 100, 1000]) {
      const lines = Array.from({ length: count }, (_, i) =>
        rootLine(i + 1, 0),
      ).join("\n");
      const result = await assembleOrderFactsJsonl(linesOf(`${lines}\n`), {
        expectedObjectCount: String(count),
        expectedRootObjectCount: String(count),
      });
      expect(result.status, `${count} roots`).toBe("COMPLETE");
      expect(result.rootCount).toBe(count);
    }
  });

  it("releases 40 child-then-parent assemblies without retaining orphan parents", async () => {
    const lines = Array.from({ length: 40 }, (_, i) => {
      const gid = `gid://shopify/Order/${i + 1}`;
      return [
        JSON.stringify({
          id: `gid://shopify/LineItem/${i + 1}`,
          __parentId: gid,
        }),
        JSON.stringify({
          id: gid,
          currentSubtotalLineItemsQuantity: 1,
        }),
      ].join("\n");
    }).join("\n");
    const result = await assembleOrderFactsJsonl(linesOf(`${lines}\n`), {
      maxOpenParents: 32,
      expectedObjectCount: "80",
      expectedRootObjectCount: "40",
    });
    expect(result.status).toBe("COMPLETE");
    expect(result.rootCount).toBe(40);
  });

  it("round-trips multi-byte UTF-8 split on every byte boundary", async () => {
    const expectedName = "Café — 東京";
    const line = `${JSON.stringify({
      id: "gid://shopify/Order/utf8",
      name: expectedName,
      currentSubtotalLineItemsQuantity: 0,
    })}\n`;
    const bytes = Buffer.from(line, "utf8");
    for (let size = 1; size <= bytes.length; size += 1) {
      let seen = "";
      const result = await assembleOrderFactsJsonl(byteChunks(bytes, size), {
        expectedObjectCount: "1",
        expectedRootObjectCount: "1",
        onCompleteAssembly: async (assembly) => {
          seen = String(assembly.root.name ?? "");
        },
      });
      expect(result.status, `chunk ${size}`).toBe("COMPLETE");
      expect(seen, `chunk ${size}`).toBe(expectedName);
    }
  });

  it("fails closed on truncated UTF-8 at end of stream", async () => {
    const prefix = Buffer.from(
      '{"id":"gid://shopify/Order/1","name":"',
      "utf8",
    );
    const euro = Buffer.from("€", "utf8");
    const result = await assembleOrderFactsJsonl(
      (async function* () {
        yield prefix;
        yield euro.subarray(0, 1);
      })(),
      { expectedObjectCount: "1", expectedRootObjectCount: "1" },
    );
    expect(result.status).toBe("MALFORMED");
  });

  it("fails closed on malformed UTF-8 rather than inserting replacement characters", async () => {
    const result = await assembleOrderFactsJsonl(
      (async function* () {
        yield new Uint8Array([0x7b, 0x22, 0x69, 0x64, 0x22, 0x3a, 0x22]);
        yield new Uint8Array([0xff, 0xfe, 0x80]);
      })(),
      { expectedObjectCount: "1", expectedRootObjectCount: "1" },
    );
    expect(result.status).toBe("MALFORMED");
  });

  it("rejects missing count tokens instead of treating them as zero", async () => {
    const result = await assembleOrderFactsJsonl(
      linesOf(`${rootLine(1, 0)}\n`),
    );
    expect(failReason(result)).toMatch(/objectCount\/rootObjectCount/);
  });

  it("rejects expected nonzero counts with empty bytes", async () => {
    const result = await assembleOrderFactsJsonl(linesOf(""), {
      expectedObjectCount: "1",
      expectedRootObjectCount: "1",
    });
    expect(result.status).toBe("TRUNCATED");
  });

  it("accepts a proven empty export with zero counts", async () => {
    const result = await assembleOrderFactsJsonl(linesOf(""), {
      expectedObjectCount: "0",
      expectedRootObjectCount: "0",
    });
    expect(result.status).toBe("COMPLETE");
    expect(result.objectCount).toBe(0);
    expect(result.rootCount).toBe(0);
  });

  it("fails a single oversized parent that exceeds the live byte bound", async () => {
    const hugeTitle = "x".repeat(ORDER_FACTS_JSONL_MAX_LIVE_BYTES);
    const child = JSON.stringify({
      id: "gid://shopify/LineItem/1",
      __parentId: "gid://shopify/Order/1",
      title: hugeTitle,
    });
    const parent = JSON.stringify({
      id: "gid://shopify/Order/1",
      currentSubtotalLineItemsQuantity: 1,
    });
    const result = await assembleOrderFactsJsonl(
      linesOf(`${child}\n${parent}\n`),
      {
        expectedObjectCount: "2",
        expectedRootObjectCount: "1",
        maxLiveBytes: 4096,
        maxLineBytes: ORDER_FACTS_JSONL_MAX_LIVE_BYTES + 1024,
      },
    );
    expect(result.status).toBe("OPEN_PARENT_BOUND");
    expect(failReason(result)).toMatch(/bytes exceeded/);
  });

  it("does not close a parent merely because the next root arrived", async () => {
    const released: string[] = [];
    const first = JSON.stringify({ id: "gid://shopify/Order/1" });
    const second = JSON.stringify({
      id: "gid://shopify/Order/2",
      currentSubtotalLineItemsQuantity: 0,
    });
    const result = await assembleOrderFactsJsonl(
      linesOf(`${first}\n${second}\n`),
      {
        expectedObjectCount: "2",
        expectedRootObjectCount: "2",
        onCompleteAssembly: async (assembly) => {
          released.push(`${assembly.rootGid}:${assembly.closeEvidence}`);
        },
      },
    );
    expect(result.status).toBe("TRUNCATED");
    expect(released).toEqual([
      "gid://shopify/Order/2:currentSubtotalLineItemsQuantity",
    ]);
    expect(failReason(result)).toMatch(/missing currentSubtotalLineItemsQuantity/);
  });

  it("completes 32 sequential roots at the open-parent bound", async () => {
    const lines = Array.from({ length: 32 }, (_, i) => rootLine(i + 1, 0)).join(
      "\n",
    );
    const result = await assembleOrderFactsJsonl(linesOf(`${lines}\n`), {
      maxOpenParents: 32,
      expectedObjectCount: "32",
      expectedRootObjectCount: "32",
    });
    expect(result.status).toBe("COMPLETE");
    expect(result.rootCount).toBe(32);
  });

  it("fails objectCount mismatch independently of rootObjectCount", async () => {
    const result = await assembleOrderFactsJsonl(linesOf(`${rootLine(1, 0)}\n`), {
      expectedObjectCount: "2",
      expectedRootObjectCount: "1",
    });
    expect(result.status).toBe("TRUNCATED");
    expect(failReason(result)).toMatch(/objects/);
  });

  it("fails rootObjectCount mismatch independently of objectCount", async () => {
    const result = await assembleOrderFactsJsonl(linesOf(`${rootLine(1, 0)}\n`), {
      expectedObjectCount: "1",
      expectedRootObjectCount: "2",
    });
    expect(result.status).toBe("TRUNCATED");
    expect(failReason(result)).toMatch(/roots/);
  });

  it("rejects malformed and oversized count tokens", async () => {
    const malformed = await assembleOrderFactsJsonl(
      linesOf(`${rootLine(1, 0)}\n`),
      { expectedObjectCount: "1.5", expectedRootObjectCount: "1" },
    );
    expect(malformed.status).toBe("TRUNCATED");
    const large = await assembleOrderFactsJsonl(linesOf(`${rootLine(1, 0)}\n`), {
      expectedObjectCount: "1".repeat(40),
      expectedRootObjectCount: "1",
    });
    expect(large.status).toBe("TRUNCATED");
  });

  it("assembles delayed interleaved children using quantity evidence", async () => {
    const released: string[] = [];
    const lines = [
      JSON.stringify({
        id: "gid://shopify/Order/1",
        currentSubtotalLineItemsQuantity: 2,
      }),
      JSON.stringify({
        id: "gid://shopify/Order/2",
        currentSubtotalLineItemsQuantity: 1,
      }),
      JSON.stringify({
        id: "gid://shopify/LineItem/2",
        __parentId: "gid://shopify/Order/2",
      }),
      JSON.stringify({
        id: "gid://shopify/LineItem/1a",
        __parentId: "gid://shopify/Order/1",
      }),
      JSON.stringify({
        id: "gid://shopify/LineItem/1b",
        __parentId: "gid://shopify/Order/1",
      }),
    ].join("\n");
    const result = await assembleOrderFactsJsonl(linesOf(`${lines}\n`), {
      expectedObjectCount: "5",
      expectedRootObjectCount: "2",
      onCompleteAssembly: async (assembly) => {
        released.push(`${assembly.rootGid}:${assembly.closeEvidence}`);
      },
    });
    expect(result.status).toBe("COMPLETE");
    expect(released).toEqual([
      "gid://shopify/Order/2:currentSubtotalLineItemsQuantity",
      "gid://shopify/Order/1:currentSubtotalLineItemsQuantity",
    ]);
  });

  it("detects duplicate roots across processing windows", async () => {
    const first = JSON.stringify({
      id: "gid://shopify/Order/1",
      currentSubtotalLineItemsQuantity: 0,
    });
    const second = JSON.stringify({
      id: "gid://shopify/Order/2",
      currentSubtotalLineItemsQuantity: 0,
    });
    const result = await assembleOrderFactsJsonl(
      linesOf(`${first}\n${second}\n${first}\n`),
      { expectedObjectCount: "3", expectedRootObjectCount: "3" },
    );
    expect(result.status).toBe("DUPLICATE");
  });

  it("round-trips CRLF framing", async () => {
    const line = `${rootLine(1, 0)}\r\n`;
    const result = await assembleOrderFactsJsonl(linesOf(line), {
      expectedObjectCount: "1",
      expectedRootObjectCount: "1",
    });
    expect(result.status).toBe("COMPLETE");
  });

  it("detects newline-aligned truncation via expected counts", async () => {
    const result = await assembleOrderFactsJsonl(
      linesOf(`${rootLine(1, 0)}\n`),
      { expectedObjectCount: "2", expectedRootObjectCount: "2" },
    );
    expect(result.status).toBe("TRUNCATED");
  });

  it("fails closed on an oversized JSONL line", async () => {
    const line = rootLine(1, 0);
    const result = await assembleOrderFactsJsonl(linesOf(`${line}\n`), {
      expectedObjectCount: "1",
      expectedRootObjectCount: "1",
      maxLineBytes: 8,
    });
    expect(result.status).toBe("TRUNCATED");
    expect(failReason(result)).toMatch(/max line bytes/);
  });
});
