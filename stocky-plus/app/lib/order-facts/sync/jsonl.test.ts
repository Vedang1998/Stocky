import { describe, expect, it } from "vitest";
import { assembleOrderFactsJsonl, nominatedOrderGids } from "./jsonl";

async function* linesOf(text: string) {
  yield text;
}

describe("PR6-D JSONL assembly", () => {
  it("assembles parent then child without groupObjects:false ordering", async () => {
    const child = JSON.stringify({
      id: "gid://shopify/LineItem/1",
      __parentId: "gid://shopify/Order/1",
    });
    const parent = JSON.stringify({ id: "gid://shopify/Order/1" });
    const result = await assembleOrderFactsJsonl(
      linesOf(`${child}\n${parent}\n`),
    );
    expect(result.status).toBe("COMPLETE");
    expect(nominatedOrderGids(result)).toEqual(["gid://shopify/Order/1"]);
  });

  it("fails closed on truncated final line", async () => {
    const result = await assembleOrderFactsJsonl(
      linesOf('{"id":"gid://shopify/Order/1"'),
    );
    expect(result.status).toBe("TRUNCATED");
  });

  it("fails closed on duplicate ids", async () => {
    const line = JSON.stringify({ id: "gid://shopify/Order/1" });
    const result = await assembleOrderFactsJsonl(linesOf(`${line}\n${line}\n`));
    expect(result.status).toBe("DUPLICATE");
  });

  it("fails closed on mis-parented children", async () => {
    const result = await assembleOrderFactsJsonl(
      linesOf(
        `${JSON.stringify({ id: "gid://shopify/LineItem/1", __parentId: "gid://shopify/Order/missing" })}\n`,
      ),
    );
    expect(result.status).toBe("MIS_PARENTED");
  });

  it("fails closed when open parents exceed the memory bound", async () => {
    const lines = Array.from({ length: 33 }, (_, i) =>
      JSON.stringify({ id: `gid://shopify/Order/${i + 1}` }),
    ).join("\n");
    const result = await assembleOrderFactsJsonl(linesOf(`${lines}\n`), {
      maxOpenParents: 32,
    });
    expect(result.status).toBe("OPEN_PARENT_BOUND");
  });
});
