/**
 * F-PR2R2-09 — authority issuer alias / namespace / helper detection.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { scanRepository, type AccessFinding } from "../scan";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(HERE, "../../..");
const TMP = path.join(APP_ROOT, ".tmp-authority-issuer-scan");

afterEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

function scanSource(relPath: string, source: string): AccessFinding[] {
  const dest = path.join(TMP, relPath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, source, "utf8");
  return scanRepository({
    roots: [TMP],
    pathRoot: TMP,
    checkAllowlistPaths: false,
  }).violations;
}

describe("tenant authority-issuer scanner tests (F-PR2R2-09)", () => {
  it("catches direct import call", () => {
    const v = scanSource(
      "app/services/direct.ts",
      `
import { issueTenantAuthority } from "../tenant/authority.server";
export function bad() {
  return issueTenantAuthority({
    shopId: "x",
    myshopifyDomain: "x.myshopify.com",
    source: "verified_admin_request",
  });
}
`,
    );
    expect(v.some((f) => f.kind === "issue_authority_outside_tenant")).toBe(true);
  });

  it("catches imported alias", () => {
    const v = scanSource(
      "app/services/import-alias.ts",
      `
import { issueTenantAuthority as mint } from "../tenant/authority.server";
export function bad() {
  return mint({
    shopId: "x",
    myshopifyDomain: "x.myshopify.com",
    source: "verified_admin_request",
  });
}
`,
    );
    expect(v.some((f) => f.kind === "issue_authority_outside_tenant")).toBe(true);
  });

  it("catches local const alias", () => {
    const v = scanSource(
      "app/services/local-const.ts",
      `
import { issueTenantAuthority } from "../tenant/authority.server";
const mint = issueTenantAuthority;
export function bad() {
  return mint({
    shopId: "x",
    myshopifyDomain: "x.myshopify.com",
    source: "verified_admin_request",
  });
}
`,
    );
    expect(v.some((f) => f.kind === "issue_authority_outside_tenant")).toBe(true);
  });

  it("catches namespace import call", () => {
    const v = scanSource(
      "app/services/namespace.ts",
      `
import * as authority from "../tenant/authority.server";
export function bad() {
  return authority.issueTenantAuthority({
    shopId: "x",
    myshopifyDomain: "x.myshopify.com",
    source: "verified_admin_request",
  });
}
`,
    );
    expect(v.some((f) => f.kind === "issue_authority_outside_tenant")).toBe(true);
  });

  it("catches destructuring from namespace", () => {
    const v = scanSource(
      "app/services/destructure-ns.ts",
      `
import * as authority from "../tenant/authority.server";
const { issueTenantAuthority: mint } = authority;
export function bad() {
  return mint({
    shopId: "x",
    myshopifyDomain: "x.myshopify.com",
    source: "verified_admin_request",
  });
}
`,
    );
    expect(v.some((f) => f.kind === "issue_authority_outside_tenant")).toBe(true);
  });

  it("catches computed property access on namespace", () => {
    const v = scanSource(
      "app/services/computed-ns.ts",
      `
import * as authority from "../tenant/authority.server";
const key = "issueTenantAuthority";
export function bad() {
  return authority[key]({
    shopId: "x",
    myshopifyDomain: "x.myshopify.com",
    source: "verified_admin_request",
  });
}
`,
    );
    expect(v.some((f) => f.kind === "issue_authority_outside_tenant")).toBe(true);
  });

  it("catches alias passed through a local identity helper", () => {
    const v = scanSource(
      "app/services/identity-helper.ts",
      `
import { issueTenantAuthority } from "../tenant/authority.server";
const identity = <T>(fn: T): T => fn;
const mint = identity(issueTenantAuthority);
export function bad() {
  return mint({
    shopId: "x",
    myshopifyDomain: "x.myshopify.com",
    source: "verified_admin_request",
  });
}
`,
    );
    expect(v.some((f) => f.kind === "issue_authority_outside_tenant")).toBe(true);
  });
});
