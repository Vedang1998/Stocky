import { createHash } from "node:crypto";

const SECRETISH =
  /\b(sk-ant-|github_pat_|ghp_[A-Za-z0-9]{20,}|xox[baprs]-|CLAUDE_CODE_OAUTH_TOKEN|ANTHROPIC_API_KEY)\b/g;

const ANSI = /\u001b\[[0-9;]*m/g;

export function sanitizePublicText(text, maxBytes = 16_384) {
  let out = String(text ?? "");
  out = out.replace(ANSI, "");
  out = out.replace(SECRETISH, "[redacted]");
  const buf = Buffer.from(out, "utf8");
  if (buf.length > maxBytes) {
    out = buf.subarray(0, maxBytes).toString("utf8") + "\n[truncated]";
  }
  return out;
}

export function bodySha256(body) {
  return createHash("sha256").update(String(body ?? ""), "utf8").digest("hex");
}

export function looksLikeGateOverride(text) {
  const t = String(text ?? "").toLowerCase();
  return (
    t.includes("self-merge") ||
    t.includes("merge this pr") ||
    t.includes("stocky_claude_review_runner=admitted") ||
    t.includes("workflow_dispatch") && t.includes("repository_dispatch") ||
    t.includes("allow all bots")
  );
}
