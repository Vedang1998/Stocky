# PR7 implementation execution brief — checkpoint A

**Status:** `CHECKPOINT_A IMPLEMENTATION IN PROGRESS` (not complete-module acceptance)

**Date:** 2026-09-30

This is the durable scope record for the admitted PR7 runtime assignment. It does **not** accept checkpoint A, authorize checkpoint B, mark the module complete, merge, deploy, enable `useOnlineTokens`, or consume owner proof on merchandising/download routes.

## 1. Authority

| Field | Value |
|---|---|
| Work order | Issue [#67](https://github.com/Vedang1998/Stocky/issues/67) `PROPO_PR7_RUNTIME_EXECUTION_V1` |
| Coordinator admission | issue52 comment `5902985297` |
| Dispatch key | `propo:5900247427:PR7_RUNTIME_IMPLEMENTATION:338717b8299016b37c02e5bdd452cc64f6161bdb:cursor` |
| Tool | Cursor Cloud Agent |
| Run | `bc-dedc6c27-79fa-409b-8a95-c0a3d36efff3` |
| Reported model | `cursor-grok-4.6-xhigh` (dispatched; not inferred from a requested label) |
| Writer | this run only; no helpers |
| Starting base **M** | `338717b8299016b37c02e5bdd452cc64f6161bdb` |
| `M^{tree}` | `aeb8653755718c25daeef8399777c4a5b9a96700` |
| Live `origin/main` at admission | `338717b8299016b37c02e5bdd452cc64f6161bdb` (equals M) |
| Branch | `phase-1/pr7-audit-roles-privacy-fff3` (requested `phase-1/pr7-audit-roles-privacy` + platform suffix `-fff3`) |
| PR45 | merged / untouched |
| Competing author | none (issue 67 comments were the dispatch plus this run’s ACK; no matching implementation branch/PR) |

## 2. Checkpoint contract (this writer, this branch)

**Now (checkpoint A only):**

1. Cryptographically verify the embedded ID token with lockfile-pinned `@shopify/shopify-api` `decodeSessionToken` (jose HS256, audience, exp/nbf). No home-grown JWT cryptography. No dependency upgrade.
2. Require exact-string `sub` (`^[0-9]+$`), expected algorithm/audience/time, and canonical issuer/destination hostname agreement **before** token exchange, session bootstrap, or privileged credential use.
3. Preserve tenant-only merchandising via `requireAdminTenant`. Actor absence/unsupported representation denies **new platform powers**, does not invent `shop_owner`, and does not convert staff into a system actor.
4. Request-bound owner-proof adapter: isolated online token-exchange, validate `associated_user` binding **before** that access token is used, isolate from ordinary offline sessions and legacy online cache entries. Fail closed (`OWNER_PROOF_UNSUPPORTED` or a precise denial). No rounded-number recovery. No first-login / installer / email / `sub` / offline-token owner grant.
5. Tests drive the **installed** `authenticate.admin` with synthetic signed tokens. Mock outbound transport and isolated session storage only. Do **not** stub `authenticate.admin` into success. Observe first outbound credentials; zero side effects on identity rejection. Never log tokens/secrets.
6. Add `test:privacy` with nonzero execution and explicit zero-collection failure. Preserve existing CI; add the distinct privacy command.

**Forbidden until independent A review + coordinator CONTINUE:**

- Bootstrap owner roles, owner-only downloads, or consuming the positive owner proof in merchandising/afterAuth.
- Global `useOnlineTokens`.
- Checkpoint B schema/migrations/privacy processors/writer admission/publication protocol.
- Production, live Shopify, inventory writes, merge, PR8.

## 3. Initial inventory (exact M, before runtime edits)

| Path | Observation |
|---|---|
| `app/shopify.server.ts` | `shopifyApp` with `future.expiringOfflineAccessTokens: true`; **`useOnlineTokens` unset** (library default false); `afterAuth` bootstraps tenant + catalog enqueue |
| `app/tenant/require-admin-tenant.server.ts` | Shop authority from `authenticate.admin` + canonical Shop; does not read `sessionToken.sub` / `session.userId` / `onlineAccessInfo` |
| `app/rbac/**` | absent |
| `app/audit/**`, `app/privacy/**`, `scripts/privacy/**` | absent (checkpoint B) |
| Installed `@shopify/shopify-app-react-router` | 1.2.1 (lockfile) |
| Installed `@shopify/shopify-api` | 13.1.0 (lockfile) |
| PR49 evidence (read-only) | `44fa47f1fdb29f60d34c099ce7580807dad1c1f6` — AUTH-X-06/07/09/14/21 remain the counterexamples this checkpoint must fail closed |
| Q-008 | remains OPEN |
| D-055 | not created |

## 4. Exclusive file contract (checkpoint A)

Owned now: `app/rbac/**`; narrow `app/tenant/require-admin-tenant.server.ts` + types/tests; `vitest.privacy.config.ts`; `package.json` `test:privacy` only; `.github/workflows/ci.yml` additive privacy step; `.env.example` named nonsecret PR7 defaults; PR7 execution brief/report/test map; latest-state entries in `PROJECT_STATUS.md`, `docs/README.md`, `phases/phase-1/README.md`; one dated D-054 subitem (no D-055).

Do not edit: accepted plan/matrix appendices, immutable reviews, `AGENTS.md`/`CLAUDE.md`/`.cursor` rules, `CI_POLICY.md`, product strategy, PR49/53/54 branches, `package-lock.json`.
