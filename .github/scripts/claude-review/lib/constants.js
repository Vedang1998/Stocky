/** Frozen constants for the bounded Claude review runner. No secrets. */

export const REPOSITORY = "Vedang1998/Stocky";
export const OWNER_LOGIN = "Vedang1998";
export const OWNER_ID = 278831488;
export const OWNER_TYPE = "User";

/** github-actions[bot] — the only principal that may author lease lock envelopes. */
export const WORKFLOW_BOT_LOGIN = "github-actions[bot]";
export const WORKFLOW_BOT_ID = 41898282;
export const WORKFLOW_BOT_TYPE = "Bot";

export const COMMENT_PAGE_SIZE = 100;
export const COMMENT_HISTORY_MAX_PAGES = 10;
export const COMMENT_HISTORY_MAX_BYTES = 2 * 1024 * 1024;
export const COMMENT_HISTORY_MAX_MS = 15_000;

export const DOCKER_LOG_DRIVER = "json-file";
export const DOCKER_LOG_MAX_SIZE = "1m";
export const DOCKER_LOG_MAX_FILE = "1";
export const DOCKER_LOG_NEAR_CAP_BYTES = 900_000;
export const MAX_COLLECTOR_BUFFER_BYTES = 256 * 1024;

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
export const MAX_MODEL_RESULT_BYTES = 32 * 1024;

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

export const UPLOAD_ARTIFACT_PIN = Object.freeze({
  uses: "actions/upload-artifact",
  tag: "v4",
  sha: "ea165f8d65b6e75b540449e92b4886f43607fa02",
});

export const DOWNLOAD_ARTIFACT_PIN = Object.freeze({
  uses: "actions/download-artifact",
  tag: "v4",
  sha: "d3f86a106a0bac45b974a628896c90dbdf5c8093",
});

/**
 * Digest pins from Docker Hub tag API on 2026-09-24 (UTC).
 * `digest` is the tag's manifest-list digest (immutable pull name@digest).
 * `amd64_digest` is the linux/amd64 image digest from the same response.
 * Mutable tags are locators only and must not be used by the executor.
 */
export const IMAGE_PINS = Object.freeze({
  postgres: Object.freeze({
    locator: "postgres:16-alpine",
    digest: "sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea",
    amd64_digest: "sha256:1a66d744c1b459e13b05a8fca341da84cb63383e99ce262210efee5a319d4551",
    recorded_at: "2026-09-24",
    source: "https://hub.docker.com/v2/repositories/library/postgres/tags/16-alpine",
  }),
  redis: Object.freeze({
    locator: "redis:7-alpine",
    digest: "sha256:858f009f9709ce576febc734aa78b8f6d624b82571f9ddb6bda4377c833b3499",
    amd64_digest: "sha256:ca0acbb137c1dc3339c8b147a58fd6f42775d4599327b50e7b116c23de501af2",
    recorded_at: "2026-09-24",
    source: "https://hub.docker.com/v2/repositories/library/redis/tags/7-alpine",
  }),
  node: Object.freeze({
    locator: "node:22.19.0-bookworm-slim",
    digest: "sha256:4a4884e8a44826194dff92ba316264f392056cbe243dcc9fd3551e71cea02b90",
    amd64_digest: "sha256:cff78eb5aa1cf27dc2b6aeea9d31366415a43e9a9ea0ddec00d780b2b66fad0f",
    recorded_at: "2026-09-24",
    source: "https://hub.docker.com/v2/repositories/library/node/tags/22.19.0-bookworm-slim",
  }),
});

export function pinnedImage(pin) {
  const name = pin.locator.split(":")[0];
  return `${name}@${pin.digest}`;
}

export const SECRET_ENV_DENY = Object.freeze([
  "CLAUDE_CODE_OAUTH_TOKEN",
  "ANTHROPIC_API_KEY",
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "SSH_AUTH_SOCK",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_ACCESS_KEY_ID",
  "AWS_SESSION_TOKEN",
  "CANARY_TOKEN",
  "ACTIONS_RUNTIME_TOKEN",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
]);

export const PUBLISH_STATE_FILES = Object.freeze([
  "decision.json",
  "lease.json",
  "probes.json",
  "checkpoint.json",
  "model-result.md",
  "executor-summary.json",
]);

export const HOST_ISOLATION_MODES = Object.freeze([
  "host-unit",
  "host-enforcement-control",
]);

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
  "mcp__stocky_review__submit_result",
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
