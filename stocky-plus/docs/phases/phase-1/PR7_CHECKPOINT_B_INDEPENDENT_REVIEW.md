# PR7 Checkpoint B — Independent Review (B0)

- Review-Key: `propo:issue67:PR68_CHECKPOINT_B_REVIEW:B0:52f846224c7ad88e7058a9d5962b7ace106009c4:claude`
- Policy-Key: `propo:issue67:PR68_CHECKPOINT_B_NATIVE_LOOP_V1`
- Claim: PR68 comment 5985854561
- Subject HB0: `52f846224c7ad88e7058a9d5962b7ace106009c4` (tree `fb067e7726d85528adcdab297cc32bee14f26733`); base M `338717b8299016b37c02e5bdd452cc64f6161bdb`
- Session: https://claude.ai/code/session_01MFWdqZcDavy56ghgqJEMpH (native scheduled Claude Code; exact model not verifiable from inside the session)
- **Verdict: CORRECTIONS REQUIRED**

## Executed (isolated PostgreSQL 16 + Redis, synthetic data, CI-equivalent env)

| Command | Exit | Result |
|---|---|---|
| `npm ci` (npm 11.5.2), `prisma generate/validate/migrate deploy`, tenant index/role/enforcement apply+verify chain | 0 | clean |
| `npm run test:privacy` | 0 | 9 files, 81/81 |
| `npm run test:privacy:zero-name-filter-guard` | 0 | 81 skipped by design |
| pr7-privacy-foundation | 0 | 16/16 |
| pr7-privacy-races | 0 | 11/11 |
| `npm run lint`, `npm run typecheck` | 0 | clean |
| `npm run graphql-codegen` then `npm test` | 0 | 74 files, 722/722 (before codegen: 24 env failures, schema artifact absent — environmental) |
| `npm run build` | 0 | ok |
| `npm run test:tenant-access` (run serially) | 0 | 35 files, 338/338 |
| `npm run test:migrations` (run serially) | 0 | 74 files, 758 passed / 2 skipped |

Note: a first concurrent run of tenant-access and migrations against one database produced failures from my own interference; those runs are discarded and both were rerun serially.

Unexecuted: live Shopify/App Bridge, real token exchange, production data, the CI-only steps not named in the work order (sync-integration, db-isolation, non-superuser owner, constrained-memory), and any HTTP-level route test of the PR7 routes (none exist in the branch).

## Findings

### B0-01 — P0 — Any verified staff actor can grant `shop_owner`/`shop_admin` (privilege escalation)
- File: `stocky-plus/app/routes/app.platform.roles.tsx:15-40`; `stocky-plus/app/rbac/assignment.server.ts:35-70`; `stocky-plus/app/tenant/require-admin-tenant.server.ts:63`.
- Evidence: the action requires only `ctx.actor.status === "verified"`, which the code itself documents as "Verified actor ... Not an owner grant". It performs no `proveShopOwner`, no assignment check, and no permission check, then calls `grantShopRole` with caller-supplied `targetShopifyUserId` and `role`. `grantShopRole`/`revokeShopRole` take `grantedBy` as an unverified string. `stocky_verify_platform_assignment` treats any non-revoked `shop_owner`/`shop_admin` row as authority for `platform.replay.execute`.
- Merchant impact: any store staff member with a valid session token can make themself (or anyone) owner/admin, then run dead-letter replay, or revoke the real owner. This defeats the role model PR7 exists to introduce.
- Reproduction (source-derived, not executed): POST JSON `{"op":"grant","targetShopifyUserId":"<own id>","role":"shop_owner"}` to `/app/platform/roles` with an ordinary staff session token; then POST to `/app/platform/replay`.
- Expected: grant/revoke require fresh owner proof (or an existing authorized assignment verified under the authz lock on the same transaction), refuse removing the last owner, and be audited.
- Missing test: route-level negative test (non-owner grant denied, self-escalation denied, last-owner revoke denied); no test references `app.platform.roles` or `grantShopRole`.

### B0-02 — P0 — Data-request download is not bound to the owner's shop (cross-tenant exposure)
- File: `stocky-plus/app/routes/app.platform.privacy.download.tsx:25-31`; `stocky-plus/app/privacy/fulfillment.server.ts:14-60`.
- Evidence: `requestId` comes from the query string and is looked up with `privacyRequest.findUnique({ id })` using the control-plane client. Neither the route nor `materializeDataRequestArtifact`/`downloadDataRequestArtifact` compares `request.targetShopId`/`canonicalDomain` with the proven owner's shop (`OwnerProofSuccess` carries no shop at all, and the function signature has no shop parameter).
- Merchant impact: the owner of shop A who obtains/guesses the id of shop B's `customers/data_request` can materialize and download B's artifact (target keys, shop domain). Ids are cuids (not secret by design; they appear in logs and support threads).
- Reproduction (source-derived, not executed): create a FULFILLING request for shop B; authenticate as owner of shop A; GET `/app/platform/privacy/download?requestId=<B's id>`.
- Expected: authorization at use must bind the request's shop to the owner-proven shop, deny with an indistinguishable error, and audit.
- Missing test: cross-shop download denial.

### B0-03 — P2 — Data-request artifact is not encrypted
- File: `fulfillment.server.ts:42-56`. The "ciphertext" is `nonce || sha256(plaintext) || plaintext`; the nonce is unused and the plaintext is stored and served verbatim. Name and comments imply confidentiality that does not exist. Fix: real AEAD with a managed key, or rename and document as plaintext.

### B0-04 — P2 — Role changes and audit are not atomic and failures are not audited
- File: `assignment.server.ts:50-70, 75-110`. The role write commits in one transaction; `emitAuditEvent` runs afterwards in a separate transaction. An audit failure leaves an unaudited privilege change (and the caller sees an error although the change took effect). `revokeShopRole` records `succeeded` even when `updateMany` matched zero rows. No `failed` outcome is recorded on any denial. This contradicts the B scope item "truthful failed/succeeded outcomes" and append-only audit.

### B0-05 — P3 — Replay command idempotency ignores the request digest
- File: `app.platform.replay.tsx:46-62`. An existing `(shopId, commandId)` row is returned as reconcile success without comparing `requestDigest`; reusing a commandId with a different `deadLetterId` silently reports success for a replay that was never requested.

### B0-06 — P3 — Operator token compared with `!==`
- File: `operator-resolve.server.ts:19`. Use `timingSafeEqual`; the path is reachable over HTTP via `?operator=1` on the escalation route.

## Scope / ancestry / preservation
HB0 descends from H1 and RA (verified with `git merge-base --is-ancestor`); live PR head equals HB0; base unchanged. H1→HB0 is 86 files. Original review R and RA blobs not modified. R1-02 (verifier identity memo) and R1-03 (test clock gated by `VITEST==="true" && NODE_ENV!=="production"`) were read and look correct; R1-01 deferral is consistent with the absence of cross-origin callers of `requireAdminTenant` in B. The new routes were not reviewed for CORS because they are same-origin.

## Coverage statement
Database/privilege/race/provenance/processor suites in the branch pass as the author reported. The review found that route-level authorization, which those suites do not exercise, is where the P0 defects sit. Source inspection was targeted (rbac, audit, fulfillment, platform routes, compliance webhook); the 2,242-line helper SQL, `participating-writers.ts`, the dispatcher and sink adapters were not independently line-reviewed, so approval of those areas is not claimed.

## Cleanup
Local PostgreSQL/Redis and checkout were disposable and contained only synthetic data. No subject edits, CI reruns, labels or state changes were made.
