# PR6-D scratch operator runbook (operator-only)

**Authority:** D-054 / C3.7. This is not a production execution order. Do not run these
steps against production hosts, merchant data, or live Shopify stores.

Automatic reclamation is not authorized. Age, missing PID, or TTL is not
permission to delete. Unknown leftovers are not proven orphaned.

## 1. Quiescence

1. Pause every D import/worker that can write the same local namespace
   (`{tmpdir}/stocky-pr6-d` or the operator-selected scratch root).
2. Confirm no live writers remain for that namespace (process list and SyncHealth
   `RUNNING` for `order_facts`). Do not treat a stale PID as proof of death
   alone.
3. Record SyncHealth / DataIssue occupancy: leftover attempt count, unknown
   count, observed bytes, reserved bytes, oldest age, limits,
   `ledgerIntegrity`, `orphanMetadataPresent`, and
   `order_facts_scratch_resource`. A missing, corrupt, truncated, unreadable,
   or wrong-version `quota.reservation` in an initialized namespace is
   indeterminate capacity, not an empty ledger. Outstanding
   `quota.reservation.tmp.*` files are orphan metadata, not permission to
   delete. Admission refuses both states. Do not reset that namespace merely
   because the live ledger is absent.

## 2. Inspect without following symlinks

1. List only `att-*` attempt directories under the namespace root using
   `lstat` (do not follow symlinks).
2. Leave markerless files, foreign directories, and non-`att-*` names untouched.
3. Do not print or copy marker tokens, pathnames, or shop identifiers into
   merchant-visible diagnostics.

## 3. Reclaim only explicitly selected verified D resources

1. Select specific `att-*` basenames (and `quota.lock` if a crash left the mkdir
   lock). Do not issue a blanket cleanup. Do not delete markerless, foreign, or
   symlink paths. Do not sweep `/tmp`.
2. After quiescence is confirmed, call the restricted helper
   `reclaimOperatorSelectedDScratch({ scratchRoot, attemptBasenames, quiescenceConfirmed: true })`
   from an operator session. It refuses live in-process writers, symlinks,
   unverified markers, and names outside the namespace. Selected `quota.lock`
   is removed only under that quiescence confirmation (not by admission).
3. If occupancy still reports `ledgerIntegrity` other than `ok` after every
   verified attempt directory is gone, call
   `reinitializeDScratchReservationLedgerAfterQuiescence({ scratchRoot, quiescenceConfirmed: true })`.
   That writes an empty ledger through the same atomic persist path and may
   remove owned `quota.reservation.tmp.*` regular files in the namespace. It
   refuses while `att-*` directories remain. It does not steal a live lock
   and does not delete foreign files.
4. There is no HTTP deletion endpoint.

## 4. Verify and resume

1. Re-inspect occupancy. Residual unknown attempts still require intervention.
2. Resume one writer and confirm admission succeeds under the 2 GiB / 32-attempt
   caps.
3. If occupancy remains unexplained, stop and escalate. Do not delete to make
   the next import pass.
