import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COMPLIANCE_TOPICS, resolveComplianceTopic } from "./topics";

describe("compliance topics", () => {
  it("match the compliance subscription in shopify.app.toml", () => {
    const toml = readFileSync(
      fileURLToPath(new URL("../../shopify.app.toml", import.meta.url)),
      "utf8",
    );
    const subscription = toml
      .split("[[webhooks.subscriptions]]")
      .find((block) => block.includes("compliance_topics"));
    expect(subscription).toContain('uri = "/webhooks/compliance"');
    const listed = /compliance_topics\s*=\s*\[([^\]]*)\]/.exec(subscription!);
    expect(
      Array.from(listed![1].matchAll(/"([^"]+)"/g), (match) => match[1]),
    ).toEqual([...COMPLIANCE_TOPICS]);
  });

  it("resolves the subscription form and the form a verified delivery carries", () => {
    expect(resolveComplianceTopic("shop/redact")).toBe("shop/redact");
    expect(resolveComplianceTopic("SHOP_REDACT")).toBe("shop/redact");
    expect(resolveComplianceTopic("CUSTOMERS_REDACT")).toBe("customers/redact");
    expect(resolveComplianceTopic("CUSTOMERS_DATA_REQUEST")).toBe(
      "customers/data_request",
    );
  });

  it("rejects every other topic", () => {
    for (const topic of [
      "app/uninstalled",
      "APP_UNINSTALLED",
      "shop/update",
      "customers/create",
      "shop_redact",
      "",
      "constructor",
    ]) {
      expect(resolveComplianceTopic(topic)).toBeNull();
    }
  });
});
