/** Frozen constants for the bounded Claude review runner. No secrets. */

export const REPOSITORY = "Vedang1998/Stocky";
export const OWNER_LOGIN = "Vedang1998";
export const OWNER_ID = 278831488;
export const OWNER_TYPE = "User";

export const TRIGGER_PREFIX = "@claude ";
export const TASK_MARKER = "STOCKY_REVIEW_TASK_V1";
export const STOP_MARKER = "STOCKY_REVIEW_STOP_V1";

export const PROFILE_ID = "node22-pg16-redis7";
export const NODE_VERSION = "22.19.0";
export const NPM_VERSION = "11.5.2";
export const POSTGRES_MAJOR = "16";
export const REDIS_MAJOR = "7";

export const MAX_TURNS = 40;
export const MAX_WORKFLOW_MINUTES = 60;
export const MAX_PROBES = 2;
export const MAX_SANDBOX_SECONDS = 1200;
export const MAX_COMMENT_BYTES = 64 * 1024;
export const MAX_PROBE_SOURCE_BYTES = 32 * 1024;
export const MAX_PROBE_OUTPUT_BYTES = 256 * 1024;
export const MAX_ARTIFACT_BYTES = 512 * 1024;
export const MAX_EVIDENCE_FILE_BYTES = 1024 * 1024;

export const EXPECTED_ARTIFACT_NAME = "review-report.md";
export const ROLE_INDEPENDENT_REVIEWER = "independent_reviewer";

export const ACTIVATION_VALUE = "admitted";
export const ACTIVATION_VAR = "STOCKY_CLAUDE_REVIEW_RUNNER";

export const LOCK_MARKER_PREFIX = "<!-- STOCKY_REVIEW_LOCK";
export const LOCK_MARKER_SUFFIX = "-->";

export const REVIEW_BRANCH_PREFIX = "claude-review/";
export const REVIEW_PATH_PREFIX = "stocky-plus/docs/phases/phase-1/reviews/";

export const REDIS_KEY_PREFIX = "stocky-review:";

export const FORBIDDEN_WORK_ORDER_KEYS = Object.freeze([
  "activation",
  "activate",
  "merge",
  "secret",
  "secrets",
  "token",
  "oauth",
  "anthropic_api_key",
  "claude_code_oauth_token",
  "github_token",
  "allowed_bots",
  "allowed_non_write_users",
  "model",
  "tools",
  "claude_args",
  "budget",
  "paid_fallback",
  "self_merge",
]);

export const TASK_ALLOWED_KEYS = Object.freeze([
  "task_id",
  "dispatch_key",
  "role",
  "subject",
  "profile",
  "max_probes",
  "max_sandbox_seconds",
  "expected_artifact",
  "authority_comment_id",
  "publish_review_branch",
  "continuation_of",
]);

export const SUBJECT_ALLOWED_KEYS = Object.freeze([
  "repository",
  "pr",
  "head",
  "base",
]);

export const CLAUDE_ACTION_PIN = Object.freeze({
  uses: "anthropics/claude-code-action",
  tag: "v1",
  sha: "8cf3482550831fb35a4fc3fbf7ca139cf8028b4c",
  nestedSetupBunSha: "0c5077e51419868618aeaa5fe8019c62421857d6",
});

export const CHECKOUT_PIN = Object.freeze({
  uses: "actions/checkout",
  tag: "v6",
  sha: "d23441a48e516b6c34aea4fa41551a30e30af803",
});

export const SETUP_NODE_PIN = Object.freeze({
  uses: "actions/setup-node",
  tag: "v4",
  sha: "49933ea5288caeca8642d1e84afbd3f7d6820020",
});

export const DISALLOWED_CLAUDE_TOOLS = Object.freeze([
  "Bash",
  "BashOutput",
  "KillShell",
  "Write",
  "Edit",
  "MultiEdit",
  "NotebookEdit",
  "WebFetch",
  "WebSearch",
  "SlashCommand",
]);

export const SIMPLE_ALLOWED_TOOLS = Object.freeze(["Read", "Glob", "Grep", "LS"]);

export const EXECUTABLE_ALLOWED_TOOLS = Object.freeze([
  "mcp__stocky_review__get_evidence",
  "mcp__stocky_review__read_subject",
  "mcp__stocky_review__run_probe",
  "mcp__stocky_review__checkpoint",
]);

export const SYNTHETIC_PG = Object.freeze({
  user: "stocky_review",
  password: "stocky_review_ci_only",
  database: "stocky_review_ci",
  host: "127.0.0.1",
  port: 5432,
});

export const SYNTHETIC_REDIS = Object.freeze({
  host: "127.0.0.1",
  port: 6379,
});
