import { describe, expect, it } from "vitest";
import { PosApiError } from "./pos-api.server";
import { readPosJson } from "./pos-body.server";

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("https://app.example.com/api/pos/x", { method: "POST", body, headers });

async function refusal(promise: Promise<unknown>): Promise<PosApiError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(PosApiError);
  expect((error as PosApiError).status).toBe(400);
  return error as PosApiError;
}

describe("readPosJson", () => {
  it("parses a JSON body within the limit", async () => {
    expect(await readPosJson(post('{"a":1}'), 100)).toEqual({ a: 1 });
  });

  it("refuses a body over the limit while streaming", async () => {
    expect((await refusal(readPosJson(post("x".repeat(500)), 100))).message).toBe(
      "The request is too large.",
    );
  });

  it("refuses a declared length over the limit", async () => {
    const request = post("{}", { "Content-Length": "500" });
    expect((await refusal(readPosJson(request, 100))).message).toBe("The request is too large.");
  });

  it("refuses text that is not JSON", async () => {
    expect((await refusal(readPosJson(post("{oops"), 100))).message).toBe(
      "The request body must be JSON.",
    );
  });
});
