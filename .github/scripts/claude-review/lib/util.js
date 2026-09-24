import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

export function sha256Hex(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return createHash("sha256").update(buf).digest("hex");
}

export function isFullSha(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
}

export function isPositiveInt(value, min, max) {
  if (!Number.isInteger(value)) return false;
  if (value < min || value > max) return false;
  return true;
}

export function clampString(value, maxBytes) {
  const buf = Buffer.from(String(value ?? ""), "utf8");
  if (buf.length <= maxBytes) {
    return { text: buf.toString("utf8"), truncated: false, bytes: buf.length };
  }
  return {
    text: buf.subarray(0, maxBytes).toString("utf8"),
    truncated: true,
    bytes: buf.length,
  };
}

export function nowIso() {
  return new Date().toISOString();
}

export function githubOutput(name, value) {
  const text = String(value ?? "");
  if (text.includes("\n")) {
    const delim = `STOCKY_${name.toUpperCase()}_${sha256Hex(text).slice(0, 8)}`;
    return `${name}<<${delim}\n${text}\n${delim}\n`;
  }
  return `${name}=${text}\n`;
}

export function writeGithubOutput(outputs) {
  const target = process.env.GITHUB_OUTPUT;
  if (!target) {
    return Object.entries(outputs)
      .map(([k, v]) => githubOutput(k, v).trimEnd())
      .join("\n");
  }
  const { appendFileSync } = awaitImportFs();
  const body = Object.entries(outputs)
    .map(([k, v]) => githubOutput(k, v))
    .join("");
  appendFileSync(target, body);
  return body;
}

function awaitImportFs() {
  // Sync helper for GHA output; imported statically below in callers that need fs.
  return requireFs();
}

import { appendFileSync as _appendFileSync } from "node:fs";

function requireFs() {
  return { appendFileSync: _appendFileSync };
}

export function fail(code, message, extra = {}) {
  const err = new Error(message);
  err.code = code;
  err.extra = extra;
  return err;
}

export function resultOk(value) {
  return { ok: true, ...value };
}

export function resultErr(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

export function envFlag(name) {
  const v = process.env[name];
  return v === "1" || v === "true";
}
