/**
 * Process-shared D scratch quota. Admission uses an exclusive mkdir lock and a
 * reservation ledger so a scan-then-write race cannot admit over the namespace
 * cap. Capacity is released only after owned files are closed and removed, or
 * after explicit operator reclamation. Lease expiry does not free bytes.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ORDER_FACTS_JSONL_MAX_SCRATCH_ATTEMPTS,
  ORDER_FACTS_JSONL_MAX_SCRATCH_BYTES,
  ORDER_FACTS_SCRATCH_ATTEMPT_PREFIX,
  ORDER_FACTS_SCRATCH_METADATA_ALLOWANCE_BYTES,
  ORDER_FACTS_SCRATCH_QUOTA_LOCK,
  ORDER_FACTS_SCRATCH_RESERVATION,
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

export type DScratchQuotaInspection = {
  attemptDirs: Array<{
    dir: string;
    bytes: number;
    hasMarker: boolean;
    symlink: boolean;
  }>;
  leftoverBytes: number;
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

export function reservationPath(root: string): string {
  return path.join(root, ORDER_FACTS_SCRATCH_RESERVATION);
}

export function quotaLockPath(root: string): string {
  return path.join(root, ORDER_FACTS_SCRATCH_QUOTA_LOCK);
}

export function metadataAllowanceBytes(maxScratchBytes: number, occupied: number): number {
  const headroom = maxScratchBytes - occupied;
  if (headroom > ORDER_FACTS_SCRATCH_METADATA_ALLOWANCE_BYTES) {
    return ORDER_FACTS_SCRATCH_METADATA_ALLOWANCE_BYTES;
  }
  return 0;
}

export async function loadDScratchReservations(
  root: string,
): Promise<DScratchReservationLedger> {
  try {
    const parsed: unknown = JSON.parse(
      await readFile(reservationPath(root), "utf8"),
    );
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { version: ORDER_FACTS_SCRATCH_QUOTA_VERSION, reservations: {} };
    }
    const record = parsed as {
      version?: unknown;
      reservations?: unknown;
    };
    if (record.version !== ORDER_FACTS_SCRATCH_QUOTA_VERSION) {
      return { version: ORDER_FACTS_SCRATCH_QUOTA_VERSION, reservations: {} };
    }
    const reservations: Record<string, DScratchReservation> = {};
    if (record.reservations && typeof record.reservations === "object") {
      for (const [name, row] of Object.entries(
        record.reservations as Record<string, unknown>,
      )) {
        if (!row || typeof row !== "object" || Array.isArray(row)) continue;
        const reservedBytes = (row as { reservedBytes?: unknown }).reservedBytes;
        const createdAt = (row as { createdAt?: unknown }).createdAt;
        const pid = (row as { pid?: unknown }).pid;
        if (
          typeof reservedBytes !== "number" ||
          !Number.isFinite(reservedBytes) ||
          reservedBytes < 0 ||
          typeof createdAt !== "string" ||
          typeof pid !== "number"
        ) {
          continue;
        }
        reservations[name] = { reservedBytes, createdAt, pid };
      }
    }
    return { version: ORDER_FACTS_SCRATCH_QUOTA_VERSION, reservations };
  } catch {
    return { version: ORDER_FACTS_SCRATCH_QUOTA_VERSION, reservations: {} };
  }
}

export async function saveDScratchReservations(
  root: string,
  ledger: DScratchReservationLedger,
): Promise<void> {
  await writeFile(
    reservationPath(root),
    `${JSON.stringify({
      version: ORDER_FACTS_SCRATCH_QUOTA_VERSION,
      reservations: ledger.reservations,
    })}\n`,
    { mode: 0o600 },
  );
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
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code)
          : "";
      if (code !== "EEXIST") throw error;
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
  maxScratchBytes?: number;
  maxScratchAttempts?: number;
  staleLockPresent?: boolean;
  liveAttemptBasenames?: Iterable<string>;
}): DScratchOccupancySnapshot {
  const maxScratchBytes =
    input.maxScratchBytes ?? ORDER_FACTS_JSONL_MAX_SCRATCH_BYTES;
  const maxScratchAttempts =
    input.maxScratchAttempts ?? ORDER_FACTS_JSONL_MAX_SCRATCH_ATTEMPTS;
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
  const operatorInterventionRequired =
    leftoverWithoutLiveWriter > 0 ||
    stats.unknownAttemptCount > 0 ||
    input.staleLockPresent === true ||
    stats.occupied >= maxScratchBytes ||
    leftoverAttemptCount >= maxScratchAttempts;
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
  };
}

export function sanitizedScratchEvidence(
  occupancy: DScratchOccupancySnapshot,
): Record<string, number | boolean | null> {
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
  };
}

export function decideReservedBytes(input: {
  occupied: number;
  maxScratchBytes: number;
  requested?: number;
}): number {
  // Omitted requestedBytes reserves remaining capacity (one large import).
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
  attemptBasename: string;
  reservedBytes: number;
}): Promise<void> {
  const ledger = await loadDScratchReservations(input.root);
  ledger.reservations[input.attemptBasename] = {
    reservedBytes: input.reservedBytes,
    createdAt: new Date().toISOString(),
    pid: process.pid,
  };
  await saveDScratchReservations(input.root, ledger);
  maybeCrash("after-reservation");
}

export async function removeAttemptReservation(input: {
  root: string;
  attemptBasename: string;
}): Promise<void> {
  const ledger = await loadDScratchReservations(input.root);
  if (!(input.attemptBasename in ledger.reservations)) return;
  delete ledger.reservations[input.attemptBasename];
  await saveDScratchReservations(input.root, ledger);
}

export function isAttemptBasename(name: string): boolean {
  return name.startsWith(ORDER_FACTS_SCRATCH_ATTEMPT_PREFIX);
}
