# PR7 Checkpoint A — Independent Review

- Review-Key: `propo:issue67:PR68_CHECKPOINT_A_INDEPENDENT_REVIEW:51c4b701b79249833ec22ed6bc96415fa8d8f3a4:claude`
- Work order: PR68 comment 5937793694; claim: PR68 comment 5938532548; queue entry: issue52 comment 5937805169
- Subject C: `51c4b701b79249833ec22ed6bc96415fa8d8f3a4` (parent A0 `efc1a17c77537fcf98bcca05fa190f14a1696e24`, tree `26e64fc0909a57992c19cff886ec56d57ac37349`, verified). Base M: `338717b8299016b37c02e5bdd452cc64f6161bdb`.
- Session: https://claude.ai/code/session_01CqW41LFKixKzLgXLvh6nfm (scheduled native Claude Code routine, new session). Model: runtime-reported, not independently verified.
- Environment: Linux, Node v22.22.0, npm 11.5.2 (installed to scratch, matching the pinned engine), synthetic data only.

## Verdict: CORRECTIONS REQUIRED

Two P1 and four P2 findings are open (see below). Not every item in the work order was executed (see "Unexecuted"); this verdict is not a BLOCKED only because the findings below are independently sufficient.

## Evidence executed (unmodified C unless stated)

| Command | Exit | Result |
|---|---|---|
| `npm run test:privacy` | 0 | 5 files / 45 tests passed |
| `vitest run --config vitest.privacy.config.ts -t zzz-no-such-name` | 1 | zero-match name filter fails closed (`[ci-guard]` message) |
| `npm test` (after `npm run graphql-codegen`; before codegen 24 tests in 4 files failed on the documented missing-generated-types prerequisite) | 0 | 72 files / 715 tests |
| `vitest run app/lib/order-facts/sync/source-stage.test.ts` | 0 | 49 / 49 |
| process-loss subset ×5 | 0 each | 4 passed per run, 5/5 stable |
| `vitest run app/lib/order-facts` | 0 | 33 files / 342 tests |
| `npm run lint` | 0 | |
| `npm run typecheck` | 0 | |
| `npm run build` | 0 | |

Counts reconcile with the author's 45 / 715 / 49 / 342.

Scope: M→C is 30 paths (enumerated by `git diff --stat`, matches work order families). A0→C is exactly `source-stage-process-loss-child.ts`, `source-stage.test.ts`, `PR7_IMPLEMENTATION_REPORT.md`; production `source-stage.ts` and auth code are unchanged after A0. `vitest.config.ts` excludes `app/rbac/**` from the default suite and `ci.yml` adds a mandatory `npm run test:privacy` step before `Unit tests`; no pre-existing test file is removed (only +1 assertion in `authority.test.ts`). No `useOnlineTokens`, lockfile, Shopify config or checkpoint-B change observed.

Reused (attributed, not executed by me): exact-head CI run 36791202683 attempt 1 (Classify 110144259801, Heavy 110144293456, Gate 110161831666 all SUCCESS, head_sha = C; step list read via API, including step 141 "PR7 privacy actor/owner-proof tests", Unit tests, Build, tenant/sync/migration suites).

Disposable probes (a temporary untracked test file in my local checkout; deleted afterwards, tree clean; synthetic tokens only, no real credential): results below as P-1..P-5.

## Findings

### F-01 (P1) Identity gate turns invalid/expired ID tokens into a thrown non-Response error before `authenticate.admin`
- File: `stocky-plus/app/tenant/require-admin-tenant.server.ts` (gate call, ~line 76) → `stocky-plus/app/rbac/admin-auth-boundary.server.ts:46-51`, `app/rbac/id-token.server.ts` (`ActorBoundaryError`).
- Evidence (probe P-4): `requireAdminTenant` with an expired but correctly signed token throws `ActorBoundaryError` (code `ID_TOKEN_INVALID`, `instanceof Response === false`). The same token through the real `authenticate.admin` yields a `Response` 401 carrying `x-shopify-retry-invalid-session-request: 1`. `toResponse()` has no caller outside `app/rbac`; the only route error boundary is `boundary.error(useRouteError())`. Same applies to a non-Bearer `Authorization` header (`ID_TOKEN_MALFORMED`).
- Merchant impact: every route using `requireAdminTenant` (13+ `app.*` routes) loses the library's 401 + retry-header contract that lets the embedded app refresh a short-lived session token; an expired token becomes a 500/error-boundary page instead of a silent refresh.
- Reproduction: sign a token with `exp` in the past; call `requireAdminTenant({request: Bearer token, identityVerifier, authenticateAdmin: stub})`; observe thrown `ActorBoundaryError`, not a Response.
- Expected: invalid tokens must reach/propagate the library's 401-with-retry response (or the gate must throw an equivalent Response with that header); gate failure must not change the status contract.
- Missing test: `requireAdminTenant` + real `authenticate.admin` for expired/invalid/malformed-Authorization tokens asserting status and retry header. The existing AUTH-X-10 test exercises only the library directly.

### F-02 (P1) Wiring of the configured boundary is proven only by source-text regex
- File: `stocky-plus/app/rbac/__tests__/merchandising-compat.test.ts:50-61`.
- Evidence: the sole check that `requireAdminTenant` gates before `authenticate.admin` and does not consume owner proof reads the source file and compares `indexOf` offsets. No test executes `requireAdminTenant` with the installed authentication library (work-order item 2). F-01 is a direct consequence of that gap. Tenant tests that execute it pass a stub `authenticateAdmin` and one assertion (`actor.status === "absent"`).
- Merchant impact: regressions in the production auth path are undetected by the privacy gate; F-01 shipped green.
- Expected: executed integration test through real `shopifyApp(...).authenticate.admin` (outbound transport mocked only), covering header/query conflict (probe P-5 observed gate and library both choose the header token, so behaviour is currently consistent but unasserted), expiry, malformed header, and cross-shop `dest`.
- Missing test: as stated.

### F-03 (P2) Owner-proof memoization ignores every input after the first call on a Request
- File: `stocky-plus/app/rbac/owner-proof.server.ts` (`proveShopOwner`, `OWNER_PROOF_MEMO`).
- Evidence (probe P-1): first call with actor 548380009 and a valid token → `owner`. Second call on the same `Request` with actor `999` and `idToken: "garbage"` returns the identical promise/object: `status: owner`, `actor.shopifyUserId` 548380009, exactly one exchange. Verifier, actor, token, `now` are ignored; a past `expiresAt` is never re-evaluated.
- Impact: not reachable in checkpoint A (`PR7_OWNER_PROOF_CONSUME=false`, no caller), but the contract advertises "request-bound"; a checkpoint-B caller passing a different actor/token for the same Request silently receives another proof.
- Expected: memo key must include (or the call must verify equality with) actor, token and shop, or the proof must be a request-scoped value rather than a function-level cache.
- Missing test: same-Request/different-actor and different-token cases without `fresh: true` (all existing tests pass `fresh: true`).

### F-04 (P2) Credential is an enumerable property; documented "non-enumerable" is false and the token is trivially exposed
- File: `stocky-plus/app/rbac/owner-proof.server.ts` (`OwnerProofSuccess`, docstring of `proveShopOwner`).
- Evidence (probe P-2): `util.inspect(proof)` prints `[Symbol(pr7OwnerOnlineAccessToken)]: '<token>'`; `Object.getOwnPropertySymbols` finds it; `{...proof}` copies it and `withProvenOwnerAccessToken` accepts the copy. `JSON.stringify` and `structuredClone` drop it (the existing test only asserts `JSON.stringify`).
- Impact: `console.log(proof)`, error serialization via inspect, or a spread into another object exposes an online owner token in logs; a Symbol name is not an unforgeable capability.
- Expected: store the token in a private `#` field / module-private WeakMap, define it non-enumerable, and give the result a redacting `toJSON`/`[util.inspect.custom]`.
- Missing test: inspect/spread/clone redaction.

### F-05 (P2) Expiry and binding are not enforced at point of use
- File: `stocky-plus/app/rbac/owner-proof.server.ts` (`withProvenOwnerAccessToken`).
- Evidence (probe P-3): a proof object with `expiresAt` set to the epoch still passes `withProvenOwnerAccessToken`; only `status` is checked. When Shopify omits `session.expires`, `expiresAt` is synthesized as now+24h without basis.
- Impact: last-use expiry/revocation is not honored; a retained proof outlives its token validity. Latent until checkpoint B.
- Expected: re-check `expiresAt` (and optionally actor/shop) inside `withProvenOwnerAccessToken`; document or remove the 24h default.
- Missing test: expired-at-use and absent-`expires` cases.

### F-06 (P2) Process-loss readiness test: synthetic controls and the Linux/sample-stability limits are not stated as limits in the test contract
- File: `stocky-plus/app/lib/order-facts/sync/source-stage.test.ts`, `source-stage-process-loss-child.ts`.
- Evidence: real staging child is killed after owned `att-*` + nonempty `source.jsonl` is observed; parent does not create the real experiment's file; delayed-write / never-ready / child-error controls exist (child-side synthetic writer, labeled); 5/5 stable local runs; production `source-stage.ts` untouched. The remaining concern is documentary: "stable sampled length" is not a cross-process drain guarantee and the pid/cmdline ownership logic is Linux-specific; neither limit is recorded in the report as a limit. I did not run a destructive negative control reverting the readiness predicate (not executed; see below).
- Severity rationale: P2 only because mandatory negative-control evidence for readiness was not independently reproduced by me; the repair itself looked sound.
- Expected: report states the Linux assumption and sample-length limitation.

### F-07 (P3) Defense-in-depth and maintainability
- `AdminIdentityGate.blocksAuthentication` is always `false` (dead field); `assertIdentityDoesNotBlock` is therefore a no-op.
- `verifyEmbeddedIdToken` and `decodeIdTokenAllowingUnsupportedSub` duplicate the same decode/iss-dest logic (drift risk).
- `actor.destShop` comes from the token `dest` hostname and is never compared to `session.shop` inside `requireAdminTenant` (consistent today because both derive from the same token).
- `void input.clientAccountOwner` plumbs an untrusted input solely for tests.

## Required-item coverage

1. Privacy/zero-filter/default/source-stage/order-facts/lint/typecheck/build: executed (above). Full tenant, migration, sync suites: reused from exact-head CI only.
2. Actual `requireAdminTenant` boundary with installed auth: NOT executed by the subject's tests (F-02); I exercised the real `authenticate.admin` and `requireAdminTenant` gate in probes P-4/P-5 only.
3. Matrix of owner/non-owner, wide/absent/numeric sub, forged signature, stale cache, cross-shop, retries: reviewed from the author's 45 tests (all pass); I did not add independent cases beyond P-1..P-5. Unexecuted: invalid algorithm/audience variants, concurrent wide-ID collision, issuer/destination mismatch independent re-execution.
4. `proveShopOwner`/`withProvenOwnerAccessToken` adversarial: P-1/P-2/P-3 → F-03/F-04/F-05. Request reuse, retained/mutated proof, last-use expiry confirmed as application-level gaps (latent until B). Revocation not testable with this mock.
5. SC-R-08: executed 5×, suite 49/49; negative-control reversion not executed.
6. Reversible negative controls on auth/binding defenses: not executed beyond P-1..P-5 (non-mutating probes). Missing item recorded as unexecuted, not approved.

## Subsequent obligations (not defects)
Stage B processors/schema/grants/publication drains.

## Not done / boundaries
No CI rerun, no edit to the implementation branch, no label/state change, no live Shopify, no credentials; probe file removed, local tree clean.
