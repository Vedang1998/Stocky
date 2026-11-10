import { describe, expect, it } from "vitest";

import { loader } from "./route";

const run = (url: string) =>
  loader({ request: new Request(url), params: {}, context: {} } as never);

describe("public index loader", () => {
  it("forwards Shopify's launch parameters to the embedded app", async () => {
    const thrown = await run(
      "https://app.example.com/?shop=test-store.myshopify.com&host=abc&embedded=1",
    ).catch((error: unknown) => error);

    expect(thrown).toBeInstanceOf(Response);
    const location = (thrown as Response).headers.get("Location");
    expect(location).toBe(
      "/app?shop=test-store.myshopify.com&host=abc&embedded=1",
    );
  });

  it("renders the static page without a shop parameter", async () => {
    await expect(run("https://app.example.com/")).resolves.toBeNull();
  });
});
