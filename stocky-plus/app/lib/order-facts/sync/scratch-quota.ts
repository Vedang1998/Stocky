/**
 * Process-shared D scratch quota. Admission uses an exclusive mkdir lock and a
 * reservation ledger so a scan-then-write race cannot admit over the namespace
 * cap. Capacity is released only after owned files are closed and removed, or
 * after explicit operator reclamation. Lease expiry does not free bytes.
 *
 * The reservation file is never truncated in place. Updates use an exclusively
 * created same-directory temporary, a complete write, file sync, rename, and
 * directory sync before allocation is acknowledged. Missing or damaged evidence
 * in an initialized namespace is indeterminate capacity, not an empty ledger.
 */
import { randomBytes } from "node:crypto";
import { open, readFile, rename, rm, mkdir, lstat } from "node:fs/promises";
import path from "node:path";
import {
  ORDER_FACTS_JSONL_MAX_SCRATCH_ATTEMPTS,
  ORDER_FACTS_JSONL_MAX_SCRATCH_BYTES,
  ORDER_FACTS_SCRATCH_ATTEMPT_PREFIX,
  ORDER_FACTS_SCRATCH_METADATA_ALLOWANCE_BYTES,
  ORDER_FACTS_SCRATCH_QUOTA_LOCK,
  ORDER_FACTS_SCRATCH_RESERVATION,
  ORDER_FACTS_SCRATCH_RESERVATION_TMP_PREFIX,
} from "./constants";
import { OrderFactsJsonlError } from "./errors";

export const ORDER_FACTS_SCRATCH_QUOTA_VERSION =
  "order-facts-d-quota-v1" as const;

export type DScratchReservation = {
  reservedBytes: number;
  createdAt: string;
  pid: number;
};

export type DScratchReservationLedger = {
  version: typeof ORDER_FACTS_SCRATCH_QUOTA_VERSION;
  reservations: Record<string, DScratchReservation>;
};

export type DScratchLedgerIntegrity =
  | "ok"
  | "uninitialized"
  | "missing"
  | "unreadable"
  | "corrupt"
  | "wrong_version"
  | "malformed_entry";

export type DScratchLedgerResolution =
  | {
      status: "ok";
      integrity: "ok" | "uninitialized";
      ledger: DScratchReservationLedger;
    }
  | {
      status: "integrity_failed";
      integrity: Exclude<DScratchLedgerIntegrity, "ok" | "uninitialized">;
    };

export type DScratchQuotaInspection = {
  attemptDirs: Array<{
    dir: string;
    bytes: number;
    hasMarker: boolean;
    symlink: boolean;
  }>;
  leftoverBytes: number;
  orphanMetadataPresent?: boolean;
};

export type DScratchOccupancySnapshot = {
  activeAttemptCount: number;
  unknownAttemptCount: number;
  observedBytes: number;
  reservedBytes: number;
  oldestAgeMs: number | null;
  operatorInterventionRequired: boolean;
  attemptCap: number;
  byteCap: number;
  staleLockPresent: boolean;
  ledgerIntegrity: DScratchLedgerIntegrity;
  orphanMetadataPresent: boolean;
};

const LOCK_RETRY_MS = 20;
const LOCK_RETRY_MAX = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function maybeCrash(stage: string): void {
  if (process.env.PR6_D_QUOTA_CRASH === stage) {
    process.kill(process.pid, "SIGKILL");
  }
}

function maybeFailSave(stage: string): void {
  if (process.env.PR6_D_QUOTA_FAIL_SAVE === stage) {
    throw new Error(`injected D scratch reservation persist failure at ${stage}`);
  }
}

export function reservationPath(root: string): string {
  return path.join(root, ORDER_FACTS_SCRATCH_RESERVATION);
}

export function quotaLockPath(root: string): string {
  return path.join(root, ORDER_FACTS_SCRATCH_QUOTA_LOCK);
}

export function isReservationTempName(name: string): boolean {
  return name.startsWith(ORDER_FACTS_SCRATCH_RESERVATION_TMP_PREFIX);
}

export function emptyDScratchLedger(): DScratchReservationLedger {
  return { version: ORDER_FACTS_SCRATCH_QUOTA_VERSION, reservations: {} };
}

export function metadataAllowanceBytes(maxScratchBytes: number, occupied: number): number {
  const headroom = maxScratchBytes - occupied;
  if (headroom > ORDER_FACTS_SCRATCH_METADATA_ALLOWANCE_BYTES) {
    return ORDER_FACTS_SCRATCH_METADATA_ALLOWANCE_BYTES;
  }
  return 0;
}

function errorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: string }).code)
    : "";
}

function isValidReservationRow(
  name: string,
  row: unknown,
): row is DScratchReservation {
  if (!isAttemptBasename(name) || name.includes("/") || name.includes("..")) {
    return false;
  }
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;
  const reservedBytes = (row as { reservedBytes?: unknown }).reservedBytes;
  const createdAt = (row as { createdAt?: unknown }).createdAt;
  const pid = (row as { pid?: unknown }).pid;
  return (
    typeof reservedBytes === "number" &&
    Number.isFinite(reservedBytes) &&
    reservedBytes >= 0 &&
    typeof createdAt === "string" &&
    createdAt.length > 0 &&
    typeof pid === "number" &&
    Number.isInteger(pid) &&
    pid >= 0
  );
}

export async function readDScratchReservationFile(root: string): Promise<
  | { kind: "ok"; ledger: DScratchReservationLedger }
  | { kind: "absent" }
  | {
      kind: "integrity_failed";
      integrity: Exclude<
        DScratchLedgerIntegrity,
        "ok" | "uninitialized" | "missing"
      >;
    }
> {
  const dest = reservationPath(root);
  let raw: string;
  try {
    const st = await lstat(dest);
    if (st.isSymbolicLink() || !st.isFile()) {
      return { kind: "integrity_failed", integrity: "unreadable" };
    }
    raw = await readFile(dest, "utf8");
  } catch (error) {
    if (errorCode(error) === "ENOENT") return { kind: "absent" };
    return { kind: "integrity_failed", integrity: "unreadable" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "integrity_failed", integrity: "corrupt" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { kind: "integrity_failed", integrity: "corrupt" };
  }
  const record = parsed as { version?: unknown; reservations?: unknown };
  if (record.version !== ORDER_FACTS_SCRATCH_QUOTA_VERSION) {
    return { kind: "integrity_failed", integrity: "wrong_version" };
  }
  if (
    !record.reservations ||
    typeof record.reservations !== "object" ||
    Array.isArray(record.reservations)
  ) {
    return { kind: "integrity_failed", integrity: "malformed_entry" };
  }
  const reservations: Record<string, DScratchReservation> = {};
  for (const [name, row] of Object.entries(
    record.reservations as Record<string, unknown>,
  )) {
    if (!isValidReservationRow(name, row)) {
      return { kind: "integrity_failed", integrity: "malformed_entry" };
    }
    reservations[name] = {
      reservedBytes: row.reservedBytes,
      createdAt: row.createdAt,
      pid: row.pid,
    };
  }
  return {
    kind: "ok",
    ledger: { version: ORDER_FACTS_SCRATCH_QUOTA_VERSION, reservations },
  };
}

export function resolveDScratchLedger(input: {
  file: Awaited<ReturnType<typeof readDScratchReservationFile>>;
  namespaceMarkerCreated: boolean;
  attemptDirCount: number;
}): DScratchLedgerResolution {
  if (input.file.kind === "ok") {
    return { status: "ok", integrity: "ok", ledger: input.file.ledger };
  }
  if (input.file.kind === "integrity_failed") {
    return { status: "integrity_failed", integrity: input.file.integrity };
  }
  const genuineFirstInit =
    input.namespaceMarkerCreated && input.attemptDirCount === 0;
  if (genuineFirstInit) {
    return {
      status: "ok",
      integrity: "uninitialized",
      ledger: emptyDScratchLedger(),
    };
  }
  return { status: "integrity_failed", integrity: "missing" };
}

export async function saveDScratchReservations(
  root: string,
  ledger: DScratchReservationLedger,
): Promise<void> {
  const dest = reservationPath(root);
  const tmp = path.join(
    root,
    `${ORDER_FACTS_SCRATCH_RESERVATION_TMP_PREFIX}${process.pid}.${randomBytes(8).toString("hex")}`,
  );
  let tmpOutstanding = false;
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(tmp, "wx", 0o600);
    tmpOutstanding = true;
    const payload = `${JSON.stringify({
      version: ORDER_FACTS_SCRATCH_QUOTA_VERSION,
      reservations: ledger.reservations,
    })}\n`;
    await handle.writeFile(payload, "utf8");
    maybeCrash("after-temp-write");
    maybeFailSave("after-temp-write");
    await handle.sync();
    maybeCrash("after-temp-sync");
    maybeFailSave("after-temp-sync");
    await handle.close();
    handle = undefined;
    maybeCrash("before-replace");
    maybeFailSave("before-replace");
    await rename(tmp, dest);
    tmpOutstanding = false;
    maybeCrash("after-replace");
    maybeFailSave("after-replace");
    const dirFd = await open(root, "r");
    try {
      await dirFd.sync();
    } finally {
      await dirFd.close();
    }
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => undefined);
    }
    if (tmpOutstanding) {
      await rm(tmp, { force: true }).catch(() => undefined);
    }
    throw error;
  }
}

export async function withDScratchQuotaLock<T>(
  root: string,
  fn: () => Promise<T>,
): Promise<T> {
  const lock = quotaLockPath(root);
  for (let attempt = 0; attempt < LOCK_RETRY_MAX; attempt += 1) {
    try {
      await mkdir(lock);
      maybeCrash("after-lock");
      try {
        return await fn();
      } finally {
        await rm(lock, { recursive: true, force: true }).catch(() => undefined);
      }
    } catch (error) {
      if (errorCode(error) !== "EEXIST") throw error;
      await sleep(LOCK_RETRY_MS);
    }
  }
  throw new OrderFactsJsonlError(
    "scratch_resource_exhausted",
    "D scratch quota lock is held; refusing admission without stealing capacity",
  );
}

export function occupiedScratchBytes(
  inspection: DScratchQuotaInspection,
  ledger: DScratchReservationLedger,
): {
  occupied: number;
  reservedSum: number;
  unreservedBytes: number;
  activeAttemptCount: number;
  unknownAttemptCount: number;
  oldestCreatedAt: string | null;
} {
  const reservedNames = new Set(Object.keys(ledger.reservations));
  let reservedMeasured = 0;
  let reservedSum = 0;
  let reservedAccounted = 0;
  let oldestCreatedAt: string | null = null;
  for (const [name, row] of Object.entries(ledger.reservations)) {
    reservedSum += row.reservedBytes;
    const att = inspection.attemptDirs.find(
      (entry) => path.basename(entry.dir) === name,
    );
    const measured = att?.bytes ?? 0;
    reservedMeasured += measured;
    reservedAccounted += Math.max(row.reservedBytes, measured);
    if (!oldestCreatedAt || row.createdAt < oldestCreatedAt) {
      oldestCreatedAt = row.createdAt;
    }
  }
  const unreservedBytes = Math.max(0, inspection.leftoverBytes - reservedMeasured);
  const occupied = reservedAccounted + unreservedBytes;
  const attemptDirNames = new Set(
    inspection.attemptDirs
      .filter((entry) => !entry.symlink)
      .map((entry) => path.basename(entry.dir)),
  );
  let activeAttemptCount = 0;
  for (const name of reservedNames) {
    if (attemptDirNames.has(name)) activeAttemptCount += 1;
  }
  let unknownAttemptCount = 0;
  for (const name of attemptDirNames) {
    if (!reservedNames.has(name)) unknownAttemptCount += 1;
  }
  for (const name of reservedNames) {
    if (!attemptDirNames.has(name)) unknownAttemptCount += 1;
  }
  return {
    occupied,
    reservedSum,
    unreservedBytes,
    activeAttemptCount,
    unknownAttemptCount,
    oldestCreatedAt,
  };
}

export function snapshotDScratchOccupancy(input: {
  inspection: DScratchQuotaInspection;
  ledger: DScratchReservationLedger;
  ledgerIntegrity?: DScratchLedgerIntegrity;
  maxScratchBytes?: number;
  maxScratchAttempts?: number;
  staleLockPresent?: boolean;
  liveAttemptBasenames?: Iterable<string>;
}): DScratchOccupancySnapshot {
  const maxScratchBytes =
    input.maxScratchBytes ?? ORDER_FACTS_JSONL_MAX_SCRATCH_BYTES;
  const maxScratchAttempts =
    input.maxScratchAttempts ?? ORDER_FACTS_JSONL_MAX_SCRATCH_ATTEMPTS;
  const ledgerIntegrity = input.ledgerIntegrity ?? "ok";
  const stats = occupiedScratchBytes(input.inspection, input.ledger);
  const oldestAgeMs =
    stats.oldestCreatedAt == null
      ? null
      : Math.max(0, Date.now() - Date.parse(stats.oldestCreatedAt));
  const live = new Set(input.liveAttemptBasenames ?? []);
  const leftoverAttemptCount = input.inspection.attemptDirs.filter(
    (row) => !row.symlink,
  ).length;
  const leftoverWithoutLiveWriter = input.inspection.attemptDirs.filter(
    (row) => !row.symlink && !live.has(path.basename(row.dir)),
  ).length;
  const orphanMetadataPresent = input.inspection.orphanMetadataPresent === true;
  const ledgerIntegrityFailed =
    ledgerIntegrity !== "ok" && ledgerIntegrity !== "uninitialized";
  const operatorInterventionRequired =
    leftoverWithoutLiveWriter > 0 ||
    stats.unknownAttemptCount > 0 ||
    input.staleLockPresent === true ||
    stats.occupied >= maxScratchBytes ||
    leftoverAttemptCount >= maxScratchAttempts ||
    ledgerIntegrityFailed ||
    orphanMetadataPresent;
  return {
    activeAttemptCount: stats.activeAttemptCount,
    unknownAttemptCount: stats.unknownAttemptCount,
    observedBytes: input.inspection.leftoverBytes,
    reservedBytes: stats.reservedSum,
    oldestAgeMs: Number.isFinite(oldestAgeMs) ? oldestAgeMs : null,
    operatorInterventionRequired,
    attemptCap: maxScratchAttempts,
    byteCap: maxScratchBytes,
    staleLockPresent: input.staleLockPresent === true,
    ledgerIntegrity,
    orphanMetadataPresent,
  };
}

export function sanitizedScratchEvidence(
  occupancy: DScratchOccupancySnapshot,
): Record<string, number | boolean | null | string> {
  return {
    activeAttemptCount: occupancy.activeAttemptCount,
    unknownAttemptCount: occupancy.unknownAttemptCount,
    observedBytes: occupancy.observedBytes,
    reservedBytes: occupancy.reservedBytes,
    oldestAgeMs: occupancy.oldestAgeMs,
    attemptCap: occupancy.attemptCap,
    byteCap: occupancy.byteCap,
    operatorInterventionRequired: occupancy.operatorInterventionRequired,
    staleLockPresent: occupancy.staleLockPresent,
    ledgerIntegrity: occupancy.ledgerIntegrity,
    orphanMetadataPresent: occupancy.orphanMetadataPresent,
  };
}

export function decideReservedBytes(input: {
  occupied: number;
  maxScratchBytes: number;
  requested?: number;
}): number {
  const remaining = input.maxScratchBytes - input.occupied;
  if (!Number.isFinite(remaining) || remaining <= 0) {
    throw new OrderFactsJsonlError(
      "scratch_resource_exhausted",
      `D scratch quota occupied ${input.occupied} leaves no capacity under ${input.maxScratchBytes}`,
    );
  }
  if (input.requested == null) {
    return remaining;
  }
  const metadata = metadataAllowanceBytes(input.maxScratchBytes, input.occupied);
  const requested = input.requested;
  if (
    !Number.isFinite(requested) ||
    requested <= 0 ||
    requested + metadata > remaining ||
    input.occupied + requested + metadata > input.maxScratchBytes
  ) {
    throw new OrderFactsJsonlError(
      "scratch_resource_exhausted",
      `D scratch quota ${input.occupied}+${requested}+${metadata} exceeds ${input.maxScratchBytes}`,
    );
  }
  return requested;
}

export async function writeAttemptReservation(input: {
  root: string;
  ledger: DScratchReservationLedger;
  attemptBasename: string;
  reservedBytes: number;
}): Promise<void> {
  input.ledger.reservations[input.attemptBasename] = {
    reservedBytes: input.reservedBytes,
    createdAt: new Date().toISOString(),
    pid: process.pid,
  };
  await saveDScratchReservations(input.root, input.ledger);
  maybeCrash("after-reservation");
}

export async function removeAttemptReservation(input: {
  root: string;
  ledger: DScratchReservationLedger;
  attemptBasename: string;
}): Promise<void> {
  if (!(input.attemptBasename in input.ledger.reservations)) return;
  delete input.ledger.reservations[input.attemptBasename];
  await saveDScratchReservations(input.root, input.ledger);
}

export function refuseIndeterminateScratchQuota(
  integrity: DScratchLedgerIntegrity,
  unknownAttemptCount: number,
  orphanMetadataPresent = false,
): void {
  if (integrity !== "ok" && integrity !== "uninitialized") {
    throw new OrderFactsJsonlError(
      "scratch_resource_exhausted",
      `D scratch reservation ledger integrity ${integrity}; refusing admission`,
    );
  }
  if (unknownAttemptCount > 0) {
    throw new OrderFactsJsonlError(
      "scratch_resource_exhausted",
      `D scratch reservation identities are unknown (${unknownAttemptCount}); refusing admission`,
    );
  }
  if (orphanMetadataPresent) {
    throw new OrderFactsJsonlError(
      "scratch_resource_exhausted",
      "D scratch reservation temp metadata is outstanding; refusing admission",
    );
  }
}

export function isAttemptBasename(name: string): boolean {
  return name.startsWith(ORDER_FACTS_SCRATCH_ATTEMPT_PREFIX);
}
