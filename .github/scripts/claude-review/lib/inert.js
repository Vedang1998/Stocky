import { LOCK_MARKER_PREFIX, TRIGGER_PREFIX } from "./constants.js";
import { sanitizePublicText } from "./sanitize.js";

const ZWSP = "\u200b";

/**
 * Preserve reviewer findings as inert quoted/encoded text.
 * Parsers must still only accept a designated top-level envelope; this is
 * defense-in-depth so GitHub mention routing and naive body scanners cannot
 * treat model/probe strings as commands.
 */
export function renderInertOpinion(text, maxBytes = 8000) {
  let out = sanitizePublicText(text, maxBytes);
  out = out.replace(/<!--/g, `<!-${ZWSP}-`);
  out = out.replace(/-->/g, `-${ZWSP}->`);
  out = out.replace(/@/g, `@${ZWSP}`);
  out = out.replace(/STOCKY_REVIEW_LOCK/g, `STOCKY${ZWSP}_REVIEW_LOCK`);
  out = out.replace(/STOCKY_TASK_RESULT_V1/g, `STOCKY${ZWSP}_TASK_RESULT_V1`);
  out = out.replace(/STOCKY_REVIEW_STOP_V1/g, `STOCKY${ZWSP}_REVIEW_STOP_V1`);
  out = out.replace(/STOCKY_REVIEW_TASK_V1/g, `STOCKY${ZWSP}_REVIEW_TASK_V1`);
  const lines = out.split(/\r?\n/);
  return lines.map((line) => `| ${line}`).join("\n");
}

export function containsRawAgentTrigger(text) {
  return /(^|\s)@(claude|cursor)\b/i.test(String(text ?? ""));
}

export function looksLikeAdditionalEnvelope(text) {
  const body = String(text ?? "");
  const afterFirstLine = body.split(/\n/).slice(1).join("\n");
  return (
    afterFirstLine.includes(LOCK_MARKER_PREFIX) ||
    afterFirstLine.includes(TRIGGER_PREFIX.trim())
  );
}
