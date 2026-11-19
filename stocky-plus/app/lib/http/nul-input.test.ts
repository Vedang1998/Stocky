import { describe, expect, it } from "vitest";
import { rejectNulInput } from "./nul-input.server";

const BASE = "https://app.example.com";

async function refusal(request: Request): Promise<Response | null> {
  return rejectNulInput(request).then(
    () => null,
    (thrown: unknown) => {
      expect(thrown).toBeInstanceOf(Response);
      return thrown as Response;
    },
  );
}

function formPost(body: string): Request {
  return new Request(`${BASE}/app/suppliers/new`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

function multipartPost(form: FormData): Request {
  return new Request(`${BASE}/app/purchase-orders/po_1`, { method: "POST", body: form });
}

describe("rejectNulInput", () => {
  it.each([
    ["a search value", "/app/suppliers?q=a%00b"],
    ["a query key", "/app/suppliers?q%00=a"],
    ["a route id", "/app/suppliers/sup_1%00"],
    ["the last of several values", "/app/reports/sales?from=2026-01-01&vendor=Acme&vendor=%00"],
  ])("answers 400 for a NUL in %s", async (_label, path) => {
    const response = await refusal(new Request(`${BASE}${path}`));
    expect(response?.status).toBe(400);
    expect(response?.headers.get("content-type")).toContain("text/plain");
  });

  it.each([
    ["no query", "/app/suppliers"],
    ["ordinary text", "/app/suppliers?q=caf%C3%A9+%26+bar"],
    ["tab, CR and LF", "/app/inventory?q=tequ%09ila%0D%0A"],
    ["a percent sign followed by 00", "/app/suppliers?q=100%2500"],
  ])("lets through %s", async (_label, path) => {
    expect(await refusal(new Request(`${BASE}${path}`))).toBeNull();
  });

  it("answers 400 for a NUL in a form field value or name", async () => {
    expect((await refusal(formPost("name=Acme%00&currency=USD")))?.status).toBe(400);
    expect((await refusal(formPost("na%00me=Acme")))?.status).toBe(400);
  });

  it("matches the form content type whatever its letter case", async () => {
    const request = new Request(`${BASE}/app/suppliers/new`, {
      method: "POST",
      headers: { "content-type": "Application/X-WWW-Form-Urlencoded; charset=UTF-8" },
      body: "name=Acme%00",
    });
    expect((await refusal(request))?.status).toBe(400);
  });

  it("answers 400 for a NUL in a multipart text field or file name", async () => {
    const text = new FormData();
    text.set("intent", "saveDetails");
    text.set("notes", "a\u0000b");
    expect((await refusal(multipartPost(text)))?.status).toBe(400);

    const named = new FormData();
    named.set("linesFile", new Blob(["sku,quantity\nA-1,2\n"]), "lines\u0000.csv");
    expect((await refusal(multipartPost(named)))?.status).toBe(400);
  });

  it("does not judge the content of an uploaded file", async () => {
    const form = new FormData();
    form.set("intent", "importLines");
    form.set("linesFile", new Blob([new Uint8Array([0x50, 0x4b, 0x00, 0x00])]), "lines.csv");
    expect(await refusal(multipartPost(form))).toBeNull();
  });

  it("leaves the form for the route to read", async () => {
    const request = formPost("name=Acme&currency=USD");
    expect(await refusal(request)).toBeNull();
    expect((await request.formData()).get("name")).toBe("Acme");
  });

  it("leaves a body it cannot parse to the route", async () => {
    const request = new Request(`${BASE}/app/purchase-orders/po_1`, {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=missing" },
      body: "not multipart",
    });
    expect(await refusal(request)).toBeNull();
  });
});
