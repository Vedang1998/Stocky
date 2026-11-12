/**
 * Sync control-plane unit tests (no DB required).
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalizeJson, digestCanonicalJson } from "../digest.server";
import { sanitizeWebhookPayload } from "../sanitize.server";
import {
  TARGET_API_VERSION,
  requireTargetApiVersion,
  validateReceivedApiVersion,
} from "../api-version.server";
import {
  assertTransition,
  isLegalTransition,
} from "../state-machine.server";
import { SyncControlPlaneError } from "../errors";

describe("sync digest", () => {
  it("is deterministic for key order", () => {
    const a = digestCanonicalJson({ b: 1, a: 2 });
    const b = digestCanonicalJson({ a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("matches manual sha256 of canonical JSON", () => {
    const value = { z: [1, { y: "x" }], a: null };
    const expected = createHash("sha256")
      .update(JSON.stringify(canonicalizeJson(value)))
      .digest("hex");
    expect(digestCanonicalJson(value)).toBe(expected);
  });
});

describe("sanitizeWebhookPayload", () => {
  it("strips PII from orders/create and keeps money strings", () => {
    const result = sanitizeWebhookPayload("orders/create", {
      id: 1,
      email: "customer@example.com",
      phone: "+15551212",
      customer: { first_name: "Ada", email: "a@b.c" },
      billing_address: { address1: "1 Main" },
      total_price: "12.50",
      currency: "USD",
      line_items: [{ variant_id: 9, quantity: 2, price: "6.25" }],
    });
    expect(result.schemaVersion).toBe("webhook-projection-orders-create-v1");
    expect(result.projection.total_price).toBe("12.50");
    expect(result.projection).not.toHaveProperty("email");
    expect(result.projection).not.toHaveProperty("customer");
    expect(result.projection).not.toHaveProperty("billing_address");
    const lines = result.projection.line_items as Array<Record<string, unknown>>;
    expect(lines[0].price).toBe("6.25");
  });

  it("sanitizes catalog identity topics as F3 signals", () => {
    const result = sanitizeWebhookPayload("products/create", {
      id: 1,
      admin_graphql_api_id: "gid://shopify/Product/1",
      title: "must-not-persist",
    });
    expect(result.schemaVersion).toBe("webhook-projection-products-create-v1");
    expect(result.projection.admin_graphql_api_id).toBe(
      "gid://shopify/Product/1",
    );
    expect(result.projection).not.toHaveProperty("title");
  });

  // The live app/uninstalled body is the whole Shop resource, which carries
  // the owner's contact details. Only the shop's identifiers may be stored.
  it("keeps only the shop identifiers from app/uninstalled", () => {
    const result = sanitizeWebhookPayload("app/uninstalled", {
      id: 548380009,
      name: "Example Shop",
      email: "owner@example.com",
      customer_email: "support@example.com",
      shop_owner: "Ada Example",
      phone: "+15555550100",
      address1: "1 Main Street",
      address2: "Suite 2",
      city: "Ottawa",
      zip: "K1A 0B1",
      province: "Ontario",
      country_name: "Canada",
      latitude: 45.42,
      longitude: -75.69,
      domain: "shop.example.com",
      myshopify_domain: "example-shop.myshopify.com",
      plan_name: "basic",
    });

    expect(result.schemaVersion).toBe("webhook-projection-app-uninstalled-v1");
    expect(result.projection).toEqual({
      id: 548380009,
      domain: "shop.example.com",
      myshopify_domain: "example-shop.myshopify.com",
    });
  });

  it("rejects unsupported topics", () => {
    expect(() => sanitizeWebhookPayload("customers/create", {})).toThrow(
      SyncControlPlaneError,
    );
  });
});

describe("api version", () => {
  it("accepts target version", () => {
    expect(requireTargetApiVersion(TARGET_API_VERSION)).toBe("2026-07");
    expect(validateReceivedApiVersion("2026-07").ok).toBe(true);
  });

  it("accepts migration-window adapters 2025-10 and 2026-07", () => {
    expect(validateReceivedApiVersion("2026-07").ok).toBe(true);
    expect(validateReceivedApiVersion("2025-10").ok).toBe(true);
  });

  it("rejects unsupported versions for quarantine", () => {
    expect(validateReceivedApiVersion("2024-01").ok).toBe(false);
    expect(() => requireTargetApiVersion("2024-01")).toThrow(SyncControlPlaneError);
  });
});

describe("durable job state machine", () => {
  it("allows legal transitions", () => {
    expect(isLegalTransition("PENDING", "DISPATCH_LEASED")).toBe(true);
    expect(isLegalTransition("RUNNING", "SUCCEEDED")).toBe(true);
    expect(() => assertTransition("PENDING", "DISPATCH_LEASED")).not.toThrow();
  });

  it("denies illegal transitions (negative)", () => {
    expect(isLegalTransition("SUCCEEDED", "PENDING")).toBe(false);
    expect(() => assertTransition("SUCCEEDED", "RUNNING")).toThrow(
      SyncControlPlaneError,
    );
  });

  it("denies bypass of terminal states", () => {
    expect(() => assertTransition("DEAD_LETTERED", "PENDING")).toThrow(
      SyncControlPlaneError,
    );
  });
});
