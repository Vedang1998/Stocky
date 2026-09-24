import {
  MAX_PROBE_OUTPUT_BYTES,
  MAX_PROBE_SOURCE_BYTES,
  MAX_SANDBOX_SECONDS,
  REDIS_KEY_PREFIX,
} from "./constants.js";
import { resultErr, resultOk } from "./util.js";

const SQL_DENIED =
  /\b(copy|pg_read_file|pg_write_file|lo_import|lo_export|pg_execute_server_program|into(\s+temporary|\s+temp)?\s+outfile|information_schema|pg_sleep|dblink|file_fdw)\b/i;

export function validateProbe(probe, limits = {}) {
  if (!probe || typeof probe !== "object" || Array.isArray(probe)) {
    return resultErr("invalid_probe", "probe must be an object");
  }
  const kind = probe.kind;
  const timeout = probe.timeout_seconds ?? limits.max_sandbox_seconds ?? MAX_SANDBOX_SECONDS;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > MAX_SANDBOX_SECONDS) {
    return resultErr("invalid_probe_timeout", "timeout_seconds out of range");
  }
  if (probe.expect && !["pass", "fail", "timeout", "blocked"].includes(probe.expect.outcome)) {
    return resultErr("invalid_expect", "expect.outcome is invalid");
  }
  if (kind === "sql") {
    return validateSql(probe, timeout);
  }
  if (kind === "redis") {
    return validateRedis(probe, timeout);
  }
  if (kind === "node_script") {
    return validateNodeScript(probe, timeout);
  }
  if (kind === "zero_test_control") {
    return resultOk({
      probe: {
        kind,
        timeout_seconds: timeout,
        expect: probe.expect ?? { outcome: "fail" },
      },
    });
  }
  if (kind === "npm_install" || kind === "shell" || kind === "http") {
    return resultErr("probe_kind_denied", `probe kind ${kind} is not permitted`);
  }
  return resultErr("unknown_probe_kind", String(kind));
}

function validateSql(probe, timeout) {
  const text = probe.sql?.text;
  if (typeof text !== "string" || text.length < 6 || text.length > 4000) {
    return resultErr("invalid_sql", "sql.text missing or oversized");
  }
  if (text.includes(";") && text.trim().endsWith(";")) {
    const stripped = text.trim().slice(0, -1);
    if (stripped.includes(";")) {
      return resultErr("sql_multi_statement", "multiple SQL statements are denied");
    }
  } else if (text.includes(";")) {
    return resultErr("sql_multi_statement", "multiple SQL statements are denied");
  }
  if (text.includes("\\") || text.includes("`")) {
    return resultErr("sql_meta_denied", "psql meta / escapes denied");
  }
  if (SQL_DENIED.test(text)) {
    return resultErr("sql_denied_keyword", "SQL keyword is not allowlisted");
  }
  const verb = text.trim().split(/\s+/)[0]?.toUpperCase();
  if (!["SELECT", "INSERT", "UPDATE", "DELETE"].includes(verb)) {
    return resultErr("sql_verb_denied", `SQL verb ${verb} is not allowlisted`);
  }
  return resultOk({
    probe: {
      kind: "sql",
      timeout_seconds: timeout,
      sql: { text: text.trim() },
      expect: probe.expect ?? { outcome: "pass" },
    },
  });
}

function validateRedis(probe, timeout) {
  const op = probe.redis?.op;
  if (!["PING", "SET", "GET"].includes(op)) {
    return resultErr("redis_op_denied", "redis op must be PING, SET, or GET");
  }
  const key = probe.redis?.key ?? `${REDIS_KEY_PREFIX}default`;
  if (typeof key !== "string" || !key.startsWith(REDIS_KEY_PREFIX) || key.length > 128) {
    return resultErr("redis_key_denied", "redis key must use stocky-review: prefix");
  }
  if (op === "SET") {
    const value = probe.redis?.value;
    if (typeof value !== "string" || value.length > 256) {
      return resultErr("redis_value_denied", "SET value missing or oversized");
    }
  }
  return resultOk({
    probe: {
      kind: "redis",
      timeout_seconds: timeout,
      redis: {
        op,
        key,
        value: probe.redis?.value,
      },
      expect: probe.expect ?? { outcome: "pass" },
    },
  });
}

function validateNodeScript(probe, timeout) {
  const source = probe.node_script?.source;
  if (typeof source !== "string" || source.length < 1) {
    return resultErr("invalid_node_script", "node_script.source required");
  }
  const bytes = Buffer.byteLength(source, "utf8");
  if (bytes > MAX_PROBE_SOURCE_BYTES) {
    return resultErr("node_script_too_large", "source exceeds cap", { bytes });
  }
  return resultOk({
    probe: {
      kind: "node_script",
      timeout_seconds: timeout,
      node_script: { source },
      expect: probe.expect ?? { outcome: "pass" },
    },
  });
}

export { MAX_PROBE_OUTPUT_BYTES };
