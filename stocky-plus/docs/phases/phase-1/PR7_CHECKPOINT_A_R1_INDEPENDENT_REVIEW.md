# PR7 Checkpoint A — R1 Independent Re-Review (PR68)

- Review-Key: `propo:issue67:PR68_CHECKPOINT_A_R1_REVIEW:02defc9233c4f8da66194eabad0cb77d30079e91:claude`
- Policy-Key: `propo:issue67:PR68_NATIVE_LOOP_V1` (PR68 comment 5975978529); claim PR68 comment 5976015024
- Subject H1: `02defc9233c4f8da66194eabad0cb77d30079e91`, tree `2f5a2eb731e8ebc8bf531a912581efb57ec8a116` (verified). Base M `338717b8299016b37c02e5bdd452cc64f6161bdb`.
- Session: https://claude.ai/code/session_016nuoLKMyNyzPrEsyeF7zef. Model: runtime-selected; not verifiable from inside the session.
- Prior review preserved: R `12c7a709da01f28c739a5698ec040a5faceedbcb`, blob `5ff31d304a5806e0b6640f7070ef7e595fffb106`, present unchanged in H1.

## Verdict: APPROVE PR7 CHECKPOINT A (A only; three P3 dispositions below)

No unresolved P0/P1/P2. This does not accept PR7 as a whole, does not authorize consuming owner proof, does not start checkpoint B, and does not certify any live Shopify behavior. Acceptance and CONTINUE B remain with the coordinator; merge/production with the owner.

## Executed independently (Node 22.22.0, npm 11.5.2, vitest 3.2.7, synthetic data, no live Shopify)

| Check | Result |
|---|---|
| `npm run test:privacy` | 6 files / 69 tests, exit 0 |
| zero-match name filter | 69 skipped, exit 1 (fail-closed, P3-D046-01 guard) |
| `graphql-codegen`, `npm test` | exit 0; 72 files / 716 tests |
| lint, typecheck, build | exit 0 each |
| `tenant:access:inventory:check` | `tenant_access_inventory_fresh`, exit 0 (mechanical regeneration verified against source; scanner policy unchanged) |
| `source-stage.test.ts` (full) | 50/50, exit 0; process-loss/SC-R-08/disposable subset 6 passed |
| `app/lib/order-facts` | 33 files / 343 tests, exit 0 |
| `authority.test.ts` against a disposable local PostgreSQL 16 (migrate deploy, indexes, role provision, enforcement preflight/apply as in CI) | 15/15, including installed-`authenticate.admin` success |
| Own adversarial probes (file removed; not committed) | see Evidence A |
| Reversible single-defense negatives | see Evidence B |
| F-06 independent mutation control | see Evidence C |

Reused (attributed): exact-head CI run 36954699123 attempt 1 (API-read: head_sha = H1, event pull_request, conclusion success; Heavy job 110675002524 steps incl. tenant isolation, tenant access, `PR7 privacy actor/owner-proof tests`, Unit tests, migrations, Build all success). Not independently executed: the full tenant-enforcement/migration/sync campaigns (unchanged, reused from that run).

Scope: M→H1 = 32 paths; R→H1 = 17 paths (as listed in READY 5944938892); production `source-stage.ts`, schema, lockfile, CI config beyond the additive privacy step, and `useOnlineTokens` are untouched; no pre-existing `app/rbac` files existed at M, so the `vitest.config.ts` exclusion removes no prior coverage and both `npm test` and `npm run test:privacy` run in CI Heavy.

## Evidence A — probes through the real configured boundary
Real `shopifyApp().authenticate.admin` + real `requireAdminTenant`; only outbound fetch mocked.
- Invalid Bearer (expired/aud) same-origin: wrapper status+headers identical to the library's own response.
- Invalid `id_token` document request: wrapper `Location` byte-identical to the library bounce.
- `bearer <t>` (lowercase) and `Bearer  <t>` (double space): gate/library parse differently, but both fail closed with 401 and zero token exchange.
- Wide sub `…993` vs `…992`: both concurrent gate results keep exact distinct strings.
- Handle: spread, `Object.assign`, `Proxy`, `Object.create(handle)`, JSON round-trip, `structuredClone` all rejected by `withProvenOwnerAccessToken`; `inspect(showHidden)`, JSON, own keys/symbols contain no credential; different Request object or different actor at use denied.

## Evidence B — single-defense negatives (each: original/mutated/restored hash, restored = original; failing tests are the oracle)
| Mutation (disposable, `git checkout` restore) | Failing test(s) |
|---|---|
| M1 binding comparison always true | same-Request changed inputs; conflicting concurrent calls |
| M2 remove expiry recheck at use | exact expiry boundary/after |
| M3 remove actor/shop binding at use | changed actor at use |
| M4 remove expiry check at issue | expired online token; expiry during exchange |
| M5 remove session.shop vs verified dest compare | session/dest agreement; numeric-sub path |
| M6 stop converting gate errors to library contract | 9 F-01 tests |
| M7 corroboration always "match" | wide id, mismatch, AUTH-X-06/07 |
Positive controls (valid owner, non-owner, valid use before expiry) pass on the unmutated source in the same suite. Hashes: owner-proof.server.ts `18c4c71252eb`, require-admin-tenant.server.ts `8aa255811f89` (both restored identical).

## Evidence C — F-06
On a disposable copy of `source-stage.test.ts` (orig sha256 prefix `bd0b57ca8ec828c8`, mutated `ce2890db6412a3bf`) `waitProcessLossReady` was changed to parked-only readiness and the SC-R-08 child to delayed-write mode: SC-R-08 failed with `expected 0 to be greater than 0` (no bytes at kill). File restored (`bd0b57ca8ec828c8`), SC-R-08 passes. Never-ready and child-error controls pass inside the 20 s bound. The in-repo F-06 control only asserts the premature ENOENT state; it does not itself run a mutated waiter (informational). Linux `/proc` and sampled-stable-length limits are documented in the tests and are test-readiness observations, not production drain/fsync proof.

## Findings
| ID | Sev | Location | Finding | Disposition |
|---|---|---|---|---|
| R1-01 | P3 (latent) | `app/rbac/errors.server.ts` `denyInvalidEmbeddedSession` | Library 401 for a cross-origin request (Origin ≠ appUrl) carries `Access-Control-Allow-Origin/Headers/Expose-Headers`; the wrapper 401 carries only the retry header (probe P1). No current route calls `.cors` and the extensions contain no fetch, so no reachable merchant impact today; it would break session refresh for a future cross-origin (POS/extension) caller. Add a CORS test and header parity before any such route adopts the wrapper. | Not blocking A |
| R1-02 | P3 | `owner-proof.server.ts` `freezeOwnerBinding` | Memo binding uses only `verifier.apiKey`; a second verifier with the same apiKey and a different secret receives the first call's owner result without an exchange (probe P5). Production uses one env verifier, so not reachable now; bind a verifier identity token or document the single-verifier invariant before B. | Not blocking A |
| R1-03 | P3 | `owner-proof.server.ts` `__setOwnerProofNowMsForTests` | Process-global clock seam is exported from production code and works under `NODE_ENV=production`; any in-process caller can rewind it and revive an expired credential (probe P6). Not caller input, but guard it (test-only build/NODE_ENV check) before B. | Not blocking A |

## Unexecuted / limits
Live Shopify, App Bridge tokens and real-provider revocation (forbidden; synthetic 401/403 only). Full tenant-enforcement/migration/sync campaigns reused from CI. Linux-only process-loss tests. Trusted-callback logging of the token string is outside the module's protection, as stated. Stage B items are subsequent obligations, not defects.

No subject edits, CI reruns, label/state changes or agent mentions. Probe file and disposable PostgreSQL cluster removed.
