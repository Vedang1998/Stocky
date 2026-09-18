/**
 * Phase 1 PR 1 — tenant compatibility index CONCURRENTLY tooling tests (R2/R3).
 * Requires DATABASE_URL / TENANT_MAINTENANCE_DATABASE_URL on disposable PostgreSQL 16.
 */
import { execFileSync } from "node:child_process";
import { cpus, loadavg } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import { applyIndexes, recoveryInstruction } from "../apply";
import { classifyIndex } from "../classify";
import { getMaintenanceClient } from "../connection";
import { inspectIndex } from "../inspect";
import { normalizeIndexDef, TENANT_COMPATIBILITY_INDEXES } from "../manifest";
import { planIndexes } from "../plan";
import { verifyIndexes } from "../verify";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, "..", "..", "..");

const DATABASE_URL =
  process.env.TENANT_MAINTENANCE_DATABASE_URL ??
  process.env.TENANT_MIGRATION_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://stocky:stocky@localhost:5432/stocky_plus_migrations";

/** Concurrent-write acceptance threshold during CONCURRENTLY index build. */
const CONCURRENT_WRITE_THRESHOLD_MS = 15_000;
/** Populated fixture — large enough that CIC remains observable under RR holders. */
const CONCURRENT_INDEX_ROW_COUNT = 100_000;
/** Larger fixture for observable active build/validation scan phases (F-F03). */
const ACTIVE_PHASE_ROW_COUNT = 400_000;

function run(cmd: string, args: string[]) {
  return execFileSync(cmd, args, {
    cwd: APP_ROOT,
    env: {
      ...process.env,
      DATABASE_URL,
      TENANT_MAINTENANCE_DATABASE_URL: DATABASE_URL,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function resetPublicSchema(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`DROP SCHEMA public CASCADE`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA public`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO stocky`);
  await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO public`);
}

async function dropAllManifestIndexes(client: Client) {
  for (const entry of [...TENANT_COMPATIBILITY_INDEXES].reverse()) {
    await client.query(`DROP INDEX IF EXISTS "${entry.name}"`);
  }
}

async function withMaintenanceClient<T>(
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  process.env.TENANT_MAINTENANCE_DATABASE_URL = DATABASE_URL;
  const client = await getMaintenanceClient({
    requireExplicitMaintenanceUrl: true,
  });
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/* F-F03 test-local overlap helpers (kept in this already-excepted file so
 * tenant-access inventory does not require a new exact-path exception). */

type Ff03ProgressSample = {
  sampledAtNs: bigint;
  sampledEndNs: bigint;
  phase: string | null;
  relid: string | null;
  schema: string | null;
  tuplesDone: number | null;
  tuplesTotal: number | null;
  blocksDone: number | null;
  blocksTotal: number | null;
  lockModes: string[];
  builderState: string | null;
  builderQuery: string | null;
};

type Ff03WriteWindow = {
  op: string;
  startNs: string;
  endNs: string;
  durationMs: number;
  phaseAtWriteStart: string | null;
  tuplesDoneAtStart: number | null;
  tuplesTotalAtStart: number | null;
  blocksDoneAtStart: number | null;
  blocksTotalAtStart: number | null;
};

function asNullableNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * One observer round-trip: builder activity + progress + granted relation locks
 * on Supplier. Used so phase, remaining-scan counters, and ShareUpdateExclusiveLock
 * are contemporaneous with the decision to write.
 */
async function sampleConcurrentIndexProgress(
  observer: Client,
  builderPid: number,
): Promise<Ff03ProgressSample> {
  const sampledAtNs = process.hrtime.bigint();
  const result = await observer.query<{
    phase: string | null;
    relid: string | null;
    schema: string | null;
    tuples_done: string | null;
    tuples_total: string | null;
    blocks_done: string | null;
    blocks_total: string | null;
    lock_modes: string[] | null;
    builder_state: string | null;
    builder_query: string | null;
  }>(
    `
    SELECT
      p.phase::text AS phase,
      p.relid::text AS relid,
      n.nspname AS schema,
      p.tuples_done::text AS tuples_done,
      p.tuples_total::text AS tuples_total,
      p.blocks_done::text AS blocks_done,
      p.blocks_total::text AS blocks_total,
      a.state::text AS builder_state,
      a.query::text AS builder_query,
      COALESCE((
        SELECT array_agg(l.mode::text ORDER BY l.mode)
        FROM pg_locks l
        JOIN pg_class c2 ON c2.oid = l.relation
        WHERE l.pid = a.pid
          AND l.locktype = 'relation'
          AND c2.relname = 'Supplier'
          AND l.granted = true
      ), ARRAY[]::text[]) AS lock_modes
    FROM pg_stat_activity a
    LEFT JOIN pg_stat_progress_create_index p ON p.pid = a.pid
    LEFT JOIN pg_class c ON c.oid = p.relid
    LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND c.relname = 'Supplier'
    WHERE a.pid = $1
    `,
    [builderPid],
  );
  const row = result.rows[0];
  const sampledEndNs = process.hrtime.bigint();
  return {
    sampledAtNs,
    sampledEndNs,
    phase: row?.phase ?? null,
    relid: row?.relid ?? null,
    schema: row?.schema ?? null,
    tuplesDone: asNullableNumber(row?.tuples_done),
    tuplesTotal: asNullableNumber(row?.tuples_total),
    blocksDone: asNullableNumber(row?.blocks_done),
    blocksTotal: asNullableNumber(row?.blocks_total),
    lockModes: row?.lock_modes ?? [],
    builderState: row?.builder_state ?? null,
    builderQuery: row?.builder_query ?? null,
  };
}

function builderStillCreatingConcurrentIndex(
  sample: Ff03ProgressSample,
): boolean {
  const q = sample.builderQuery ?? "";
  return /CREATE\s+INDEX\s+CONCURRENTLY/i.test(q);
}

function hasShareUpdateExclusiveWithoutAccessExclusive(
  sample: Ff03ProgressSample,
): boolean {
  return (
    sample.lockModes.length > 0 &&
    sample.lockModes.includes("ShareUpdateExclusiveLock") &&
    !sample.lockModes.includes("AccessExclusiveLock")
  );
}

/**
 * True when the sample is the requested scan phase, the builder still holds
 * SHARE UPDATE EXCLUSIVE (not ACCESS EXCLUSIVE), CIC is still the builder
 * query, and PostgreSQL reports remaining scan work. Phase-text-only samples
 * without remaining-work counters are rejected so we do not treat a gate
 * or a finished scan as overlap coverage.
 */
function isActiveScanSample(
  sample: Ff03ProgressSample,
  targetPhase: string,
): boolean {
  if (sample.phase !== targetPhase) {
    return false;
  }
  if (!hasShareUpdateExclusiveWithoutAccessExclusive(sample)) {
    return false;
  }
  if (!builderStillCreatingConcurrentIndex(sample)) {
    return false;
  }
  if (sample.tuplesTotal != null && sample.tuplesTotal > 0) {
    const remaining = sample.tuplesTotal - (sample.tuplesDone ?? 0);
    const floor = Math.max(1, Math.floor(sample.tuplesTotal * 0.1));
    return remaining > floor;
  }
  if (sample.blocksTotal != null && sample.blocksTotal > 0) {
    const remaining = sample.blocksTotal - (sample.blocksDone ?? 0);
    const floor = Math.max(32, Math.floor(sample.blocksTotal * 0.1));
    return remaining > floor;
  }
  return false;
}

async function waitForNamedIndexPhase(options: {
  observer: Client;
  builderPid: number;
  targetPhase: string;
  deadlineMs: number;
  iteration: number;
  phasesSeen: Set<string>;
  isBuildSettled: () => boolean;
}): Promise<Ff03ProgressSample> {
  const deadline = Date.now() + options.deadlineMs;
  for (;;) {
    if (options.isBuildSettled()) {
      throw new Error(
        `Iteration ${options.iteration}: build settled before phase "${options.targetPhase}" was observed ` +
          `(phasesSeen=${JSON.stringify([...options.phasesSeen])})`,
      );
    }
    if (Date.now() > deadline) {
      throw new Error(
        `Iteration ${options.iteration}: timed out waiting for phase "${options.targetPhase}" ` +
          `(phasesSeen=${JSON.stringify([...options.phasesSeen])})`,
      );
    }
    const sample = await sampleConcurrentIndexProgress(
      options.observer,
      options.builderPid,
    );
    if (sample.phase) {
      options.phasesSeen.add(sample.phase);
      if (sample.phase === options.targetPhase) {
        return sample;
      }
    }
  }
}

/**
 * Wait until the target *scan* phase is active with contemporaneous SHARE UPDATE
 * EXCLUSIVE locks, then return that sample immediately so callers can DML
 * without a second lock query.
 */
async function waitForActiveScanTrigger(options: {
  observer: Client;
  builderPid: number;
  targetPhase: string;
  deadlineMs: number;
  iteration: number;
  phasesSeen: Set<string>;
  isBuildSettled: () => boolean;
}): Promise<Ff03ProgressSample> {
  const deadline = Date.now() + options.deadlineMs;
  let last: Ff03ProgressSample | null = null;
  for (;;) {
    if (options.isBuildSettled()) {
      throw new Error(
        `Iteration ${options.iteration}: build settled before in-progress "${options.targetPhase}" overlap ` +
          `(phasesSeen=${JSON.stringify([...options.phasesSeen])} last=${JSON.stringify(summarizeSample(last))})`,
      );
    }
    if (Date.now() > deadline) {
      throw new Error(
        `Iteration ${options.iteration}: timed out waiting for active scan "${options.targetPhase}" ` +
          `(phasesSeen=${JSON.stringify([...options.phasesSeen])} last=${JSON.stringify(summarizeSample(last))})`,
      );
    }
    const sample = await sampleConcurrentIndexProgress(
      options.observer,
      options.builderPid,
    );
    last = sample;
    if (sample.phase) {
      options.phasesSeen.add(sample.phase);
    }
    if (isActiveScanSample(sample, options.targetPhase)) {
      return sample;
    }
    // Phase text matches but counters say the scan already finished: do not
    // treat that as active coverage; keep polling until a remaining-work
    // sample appears or the build settles.
  }
}

function summarizeSample(
  sample: Ff03ProgressSample | null,
): Record<string, unknown> | null {
  if (!sample) {
    return null;
  }
  return {
    phase: sample.phase,
    schema: sample.schema,
    relid: sample.relid,
    tuplesDone: sample.tuplesDone,
    tuplesTotal: sample.tuplesTotal,
    blocksDone: sample.blocksDone,
    blocksTotal: sample.blocksTotal,
    lockModes: sample.lockModes,
    builderState: sample.builderState,
    builderQueryPreview: (sample.builderQuery ?? "").slice(0, 80),
    sampledAtNs: sample.sampledAtNs.toString(),
    sampledEndNs: sample.sampledEndNs.toString(),
  };
}

const FF03_BUILD_SCAN_PHASE = "building index: scanning table";
const FF03_VALIDATION_SCAN_PHASE = "index validation: scanning table";
const FF03_OWNED_CLEANUP_DEADLINE_MS = 8_000;

function sampleIntersectsWindow(
  sample: Ff03ProgressSample,
  startNs: bigint,
  endNs: bigint,
): boolean {
  return sample.sampledAtNs <= endNs && sample.sampledEndNs >= startNs;
}

function inWindowSamples(
  samples: Ff03ProgressSample[],
  startNs: bigint,
  endNs: bigint,
): Ff03ProgressSample[] {
  return samples.filter((sample) => sampleIntersectsWindow(sample, startNs, endNs));
}

function scanProgressAdvanced(
  earlier: Ff03ProgressSample,
  later: Ff03ProgressSample,
): boolean {
  if (
    earlier.blocksDone != null &&
    later.blocksDone != null &&
    earlier.blocksTotal != null &&
    earlier.blocksTotal > 0 &&
    later.blocksDone > earlier.blocksDone
  ) {
    return true;
  }
  if (
    earlier.tuplesDone != null &&
    later.tuplesDone != null &&
    earlier.tuplesTotal != null &&
    earlier.tuplesTotal > 0 &&
    later.tuplesDone > earlier.tuplesDone
  ) {
    return true;
  }
  return false;
}

type Ff03OverlapEvaluation = {
  ok: boolean;
  reason: string;
  independentOverlapCount: number;
  progressEvidence: boolean;
  blockedWrite: boolean;
};

/**
 * Independent overlap proof for one required active scan phase.
 * Copied trigger labels and a later non-scan phase (for example
 * "building index: loading tuples in tree") are not substitutes for
 * in-window samples of the named scan.
 */
function evaluateActiveScanWriteOverlap(input: {
  targetPhase: string;
  trigger: Ff03ProgressSample;
  writes: Ff03WriteWindow[];
  inWindowSamples: Ff03ProgressSample[];
  after: Ff03ProgressSample | null;
  buildSettled: boolean;
}): Ff03OverlapEvaluation {
  const fail = (
    reason: string,
    extras: Partial<Ff03OverlapEvaluation> = {},
  ): Ff03OverlapEvaluation => ({
    ok: false,
    reason,
    independentOverlapCount: extras.independentOverlapCount ?? 0,
    progressEvidence: extras.progressEvidence ?? false,
    blockedWrite: extras.blockedWrite ?? false,
  });

  if (input.buildSettled) {
    return fail("builder_settled_during_overlap");
  }
  if (input.writes.length !== 3) {
    return fail("missing_representative_dml");
  }
  const ops = input.writes.map((write) => write.op).join(",");
  if (ops !== "insert,update,delete") {
    return fail("missing_representative_dml");
  }
  if (input.writes.some((write) => write.durationMs >= CONCURRENT_WRITE_THRESHOLD_MS)) {
    return fail("blocked_or_nonconcurrent_write", { blockedWrite: true });
  }
  if (input.inWindowSamples.some((sample) => sample.lockModes.includes("AccessExclusiveLock"))) {
    return fail("access_exclusive_during_write_window", { blockedWrite: true });
  }

  const independent = input.inWindowSamples.filter((sample) =>
    isActiveScanSample(sample, input.targetPhase),
  );
  if (independent.length === 0) {
    const copiedTriggerOnly =
      input.inWindowSamples.length === 0 &&
      input.writes.length > 0 &&
      input.writes.every((write) => write.phaseAtWriteStart === input.trigger.phase);
    if (copiedTriggerOnly) {
      return fail("copied_trigger_phase_is_not_independent_overlap");
    }
    if (input.inWindowSamples.length === 0) {
      return fail("no_independent_in_window_sample");
    }
    return fail("wrong_or_finished_phase");
  }

  let progressEvidence = false;
  for (const sample of independent) {
    if (scanProgressAdvanced(input.trigger, sample)) {
      progressEvidence = true;
      break;
    }
  }
  if (
    !progressEvidence &&
    input.after &&
    isActiveScanSample(input.after, input.targetPhase) &&
    scanProgressAdvanced(input.trigger, input.after)
  ) {
    progressEvidence = true;
  }
  if (!progressEvidence) {
    return fail("omitted_progress_evidence", {
      independentOverlapCount: independent.length,
    });
  }

  return {
    ok: true,
    reason: "ok",
    independentOverlapCount: independent.length,
    progressEvidence: true,
    blockedWrite: false,
  };
}

type Ff03RemainderSnapshot = {
  activity: Array<{ pid: number; state: string | null; query: string | null }>;
  progress: Array<{ pid: number; phase: string | null }>;
  locks: Array<{ pid: number; mode: string; relation: string }>;
};

function remainderBlocksSchemaReset(
  snapshot: Ff03RemainderSnapshot,
  ownedPids: number[],
): boolean {
  const owned = new Set(ownedPids);
  if (snapshot.activity.some((row) => owned.has(row.pid))) {
    return true;
  }
  if (snapshot.progress.some((row) => owned.has(row.pid))) {
    return true;
  }
  if (snapshot.locks.some((row) => owned.has(row.pid))) {
    return true;
  }
  return false;
}

function ownedConcurrentIndexRemainder(
  snapshot: Ff03RemainderSnapshot,
  builderPid: number,
): boolean {
  if (snapshot.progress.some((row) => row.pid === builderPid)) {
    return true;
  }
  if (
    snapshot.activity.some(
      (row) =>
        row.pid === builderPid &&
        /CREATE\s+INDEX\s+CONCURRENTLY/i.test(row.query ?? ""),
    )
  ) {
    return true;
  }
  if (
    snapshot.locks.some(
      (row) =>
        row.pid === builderPid && row.mode === "ShareUpdateExclusiveLock",
    )
  ) {
    return true;
  }
  return false;
}

function isExpectedBuilderCancellation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  return (
    code === "57014" ||
    /canceling statement/i.test(message) ||
    /query_canceled/i.test(message) ||
    /Connection terminated/i.test(message)
  );
}

function withDeadline<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} deadline ${ms}ms exceeded`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function connectPlainClient(): Promise<Client> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  client.on("error", () => {
    // Owned teardown may close the socket while a query is settling.
  });
  return client;
}

async function backendPid(client: Client): Promise<number> {
  const result = await client.query<{ pid: number }>(`SELECT pg_backend_pid() AS pid`);
  return result.rows[0]!.pid;
}

async function queryOwnedRemainder(
  inspect: Client,
  ownedPids: number[],
): Promise<Ff03RemainderSnapshot> {
  if (ownedPids.length === 0) {
    return { activity: [], progress: [], locks: [] };
  }
  const activity = await inspect.query<{
    pid: number;
    state: string | null;
    query: string | null;
  }>(
    `SELECT pid, state::text AS state, query::text AS query
     FROM pg_stat_activity
     WHERE pid = ANY($1::int[])
       AND pid <> pg_backend_pid()`,
    [ownedPids],
  );
  const progress = await inspect.query<{ pid: number; phase: string | null }>(
    `SELECT pid, phase::text AS phase
     FROM pg_stat_progress_create_index
     WHERE pid = ANY($1::int[])`,
    [ownedPids],
  );
  const locks = await inspect.query<{ pid: number; mode: string; relation: string }>(
    `SELECT l.pid, l.mode::text AS mode, c.relname::text AS relation
     FROM pg_locks l
     JOIN pg_class c ON c.oid = l.relation
     WHERE l.granted = true
       AND l.pid = ANY($1::int[])
       AND l.pid <> pg_backend_pid()
       AND c.relname IN ('Supplier', 'Supplier_shopId_idx')`,
    [ownedPids],
  );
  return {
    activity: activity.rows,
    progress: progress.rows,
    locks: locks.rows,
  };
}

type Ff03CleanupResult = {
  ok: boolean;
  cancelObserved: boolean;
  neededCancel: boolean;
  errors: string[];
  remainder: Ff03RemainderSnapshot;
};

class Ff03OwnedRuntime {
  builder: Client | null = null;
  writer: Client | null = null;
  observer: Client | null = null;
  sampler: Client | null = null;
  gate1: Client | null = null;
  gate2: Client | null = null;
  builderPid = 0;
  ownedPids: number[] = [];
  samples: Ff03ProgressSample[] = [];
  buildPromise: Promise<unknown> | null = null;
  buildSettled = false;
  buildError: unknown;
  buildSettledAtNs: bigint | null = null;
  buildStartedAtNs: bigint = 0n;
  private samplerStop = false;
  private samplerLoop: Promise<void> | null = null;

  async open(): Promise<void> {
    const opened: Client[] = [];
    const register = async (client: Client): Promise<number> => {
      opened.push(client);
      const pid = await backendPid(client);
      this.ownedPids.push(pid);
      return pid;
    };
    try {
      this.builder = await getMaintenanceClient({
        requireExplicitMaintenanceUrl: true,
      });
      this.builder.on("error", () => {});
      this.builderPid = await register(this.builder);
      this.writer = await connectPlainClient();
      await register(this.writer);
      this.observer = await connectPlainClient();
      await register(this.observer);
      this.sampler = await connectPlainClient();
      await register(this.sampler);
      this.gate1 = await connectPlainClient();
      await register(this.gate1);
      this.gate2 = await connectPlainClient();
      await register(this.gate2);
    } catch (error) {
      for (const client of opened.reverse()) {
        try {
          await client.end();
        } catch {
          // continue closing the rest
        }
      }
      this.ownedPids = [];
      throw error;
    }
  }

  startSampler(): void {
    if (!this.sampler) {
      throw new Error("sampler client is not open");
    }
    this.samplerStop = false;
    const sampler = this.sampler;
    this.samplerLoop = (async () => {
      while (!this.samplerStop) {
        this.samples.push(
          await sampleConcurrentIndexProgress(sampler, this.builderPid),
        );
      }
    })();
    void this.samplerLoop.catch(() => {
      // Expected when cleanup ends the sampler during an in-flight sample.
    });
  }

  async stopSampler(): Promise<void> {
    this.samplerStop = true;
    if (!this.samplerLoop) {
      return;
    }
    try {
      await withDeadline(
        this.samplerLoop,
        FF03_OWNED_CLEANUP_DEADLINE_MS,
        "ff03 sampler stop",
      );
    } catch {
      // The sampler query is aborted when the client is closed in cleanup.
    } finally {
      this.samplerLoop = null;
    }
  }

  startConcurrentIndex(): void {
    if (!this.builder) {
      throw new Error("builder client is not open");
    }
    this.buildStartedAtNs = process.hrtime.bigint();
    this.buildPromise = this.builder
      .query(
        `CREATE INDEX CONCURRENTLY "Supplier_shopId_idx" ON "Supplier" ("shopId")`,
      )
      .then(
        (result) => {
          this.buildSettledAtNs = process.hrtime.bigint();
          this.buildSettled = true;
          return result;
        },
        (error: unknown) => {
          this.buildSettledAtNs = process.hrtime.bigint();
          this.buildSettled = true;
          this.buildError = error;
          throw error;
        },
      );
    void this.buildPromise.catch(() => {
      // Prevent unhandled rejection if an assertion fires before await.
    });
  }

  async cancelOwnedBuilder(): Promise<boolean> {
    if (this.builderPid === 0) {
      return false;
    }
    const agents = [this.observer, this.writer, this.sampler].filter(
      (client): client is Client => client != null,
    );
    for (const agent of agents) {
      try {
        const result = await agent.query<{ cancelled: boolean }>(
          `SELECT pg_cancel_backend($1) AS cancelled`,
          [this.builderPid],
        );
        if (result.rows[0]?.cancelled) {
          return true;
        }
      } catch {
        // try the next owned client
      }
    }
    return false;
  }

  async cleanup(): Promise<Ff03CleanupResult> {
    const errors: string[] = [];
    const neededCancel = this.buildPromise != null && !this.buildSettled;
    let cancelObserved = false;

    try {
      await this.stopSampler();
    } catch (error) {
      errors.push(`sampler_stop: ${String(error)}`);
    }

    if (neededCancel) {
      try {
        await this.cancelOwnedBuilder();
      } catch (error) {
        errors.push(`cancel_backend: ${String(error)}`);
      }
    }

    for (const gate of [this.gate1, this.gate2]) {
      if (!gate) continue;
      try {
        await gate.query("ROLLBACK");
      } catch {
        // already committed or closed
      }
    }

    if (this.buildPromise) {
      try {
        await withDeadline(
          this.buildPromise,
          FF03_OWNED_CLEANUP_DEADLINE_MS,
          "ff03 builder settle",
        );
      } catch (error) {
        if (isExpectedBuilderCancellation(error)) {
          cancelObserved = true;
        } else if (!this.buildSettled) {
          errors.push(`builder_inflight: ${String(error)}`);
        } else if (this.buildError && isExpectedBuilderCancellation(this.buildError)) {
          cancelObserved = true;
        } else if (this.buildError) {
          // Successful-path callers await the build separately. Cleanup only
          // records unexpected in-flight failures.
        }
      }
    }
    if (this.buildError && isExpectedBuilderCancellation(this.buildError)) {
      cancelObserved = true;
    }
    if (neededCancel && !this.buildSettled && !cancelObserved) {
      errors.push("expected_cancellation_not_observed");
    }

    const clients: Array<Client | null> = [
      this.gate1,
      this.gate2,
      this.builder,
      this.writer,
      this.observer,
      this.sampler,
    ];
    for (const client of clients) {
      if (!client) continue;
      try {
        await client.end();
      } catch (error) {
        errors.push(`client_end: ${String(error)}`);
      }
    }
    this.builder = null;
    this.writer = null;
    this.observer = null;
    this.sampler = null;
    this.gate1 = null;
    this.gate2 = null;

    const inspect = await connectPlainClient();
    let remainder: Ff03RemainderSnapshot = { activity: [], progress: [], locks: [] };
    try {
      const deadline = Date.now() + FF03_OWNED_CLEANUP_DEADLINE_MS;
      remainder = await queryOwnedRemainder(inspect, this.ownedPids);
      while (
        remainderBlocksSchemaReset(remainder, this.ownedPids) &&
        Date.now() < deadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        remainder = await queryOwnedRemainder(inspect, this.ownedPids);
      }
      if (remainderBlocksSchemaReset(remainder, this.ownedPids)) {
        errors.push(
          `owned_builder_remainder_persisted:${JSON.stringify(remainder)}`,
        );
      }
    } catch (error) {
      errors.push(`remainder_inspect: ${String(error)}`);
    } finally {
      try {
        await inspect.end();
      } catch (error) {
        errors.push(`inspect_end: ${String(error)}`);
      }
    }

    return {
      ok: errors.length === 0,
      cancelObserved,
      neededCancel,
      errors,
      remainder,
    };
  }
}

function attachIndependentWriteObservations(
  writes: Array<{ op: string; startNs: bigint; endNs: bigint; durationMs: number }>,
  samples: Ff03ProgressSample[],
  targetPhase: string,
): Ff03WriteWindow[] {
  return writes.map((write) => {
    const overlapping = samples.filter(
      (sample) =>
        sampleIntersectsWindow(sample, write.startNs, write.endNs) &&
        isActiveScanSample(sample, targetPhase),
    );
    const chosen = overlapping[0] ?? null;
    return {
      op: write.op,
      startNs: write.startNs.toString(),
      endNs: write.endNs.toString(),
      durationMs: write.durationMs,
      phaseAtWriteStart: chosen?.phase ?? null,
      tuplesDoneAtStart: chosen?.tuplesDone ?? null,
      tuplesTotalAtStart: chosen?.tuplesTotal ?? null,
      blocksDoneAtStart: chosen?.blocksDone ?? null,
      blocksTotalAtStart: chosen?.blocksTotal ?? null,
    };
  });
}

/**
 * INSERT/UPDATE/DELETE back-to-back. Timing only; phase labels come from
 * independent in-window samples, not the pre-write trigger.
 */
async function burstRepresentativeSupplierDml(options: {
  writer: Client;
  idSuffix: string;
}): Promise<Array<{ op: string; startNs: bigint; endNs: bigint; durationMs: number }>> {
  const rowId = `sup-active-${options.idSuffix}`;
  const ops: Array<{ op: string; sql: string }> = [
    {
      op: "insert",
      sql: `INSERT INTO "Supplier" (id, shop, name, "createdAt", "updatedAt")
            VALUES ('${rowId}', 'active-probe.myshopify.com', 'A', NOW(), NOW())`,
    },
    {
      op: "update",
      sql: `UPDATE "Supplier" SET name = 'A2' WHERE id = '${rowId}'`,
    },
    {
      op: "delete",
      sql: `DELETE FROM "Supplier" WHERE id = '${rowId}'`,
    },
  ];
  const windows: Array<{ op: string; startNs: bigint; endNs: bigint; durationMs: number }> = [];
  for (const { op, sql } of ops) {
    const startNs = process.hrtime.bigint();
    await options.writer.query(sql);
    const endNs = process.hrtime.bigint();
    const durationMs = Number(endNs - startNs) / 1e6;
    windows.push({ op, startNs, endNs, durationMs });
  }
  return windows;
}

describe("tenant compatibility index manifest", () => {
  it("lists 44 expected indexes", () => {
    expect(TENANT_COMPATIBILITY_INDEXES).toHaveLength(44);
  });

  it("normalizeIndexDef lowercases and collapses whitespace", () => {
    expect(normalizeIndexDef("  CREATE   INDEX  foo  ")).toBe(
      "create index foo",
    );
  });
});


const FF03_HELPER_TARGET = "building index: scanning table";

function ff03HelperSample(
  overrides: Partial<Ff03ProgressSample> = {},
): Ff03ProgressSample {
  return {
    sampledAtNs: 1n,
    sampledEndNs: 2n,
    phase: FF03_HELPER_TARGET,
    relid: "1",
    schema: "public",
    tuplesDone: 0,
    tuplesTotal: 0,
    blocksDone: 10,
    blocksTotal: 100,
    lockModes: ["ShareUpdateExclusiveLock"],
    builderState: "active",
    builderQuery: `CREATE INDEX CONCURRENTLY "Supplier_shopId_idx" ON "Supplier" ("shopId")`,
    ...overrides,
  };
}

describe("F-F03 active-scan overlap helper", () => {
  it("accepts an in-progress scan with remaining blocks and SHARE UPDATE EXCLUSIVE", () => {
    expect(isActiveScanSample(ff03HelperSample(), FF03_HELPER_TARGET)).toBe(true);
    expect(hasShareUpdateExclusiveWithoutAccessExclusive(ff03HelperSample())).toBe(true);
    expect(builderStillCreatingConcurrentIndex(ff03HelperSample())).toBe(true);
  });

  it("rejects a completed scan that still carries the phase text", () => {
    expect(
      isActiveScanSample(
        ff03HelperSample({ blocksDone: 100, blocksTotal: 100 }),
        FF03_HELPER_TARGET,
      ),
    ).toBe(false);
  });

  it("rejects waiting-for-writers / old-snapshot samples as active scan coverage", () => {
    expect(
      isActiveScanSample(
        ff03HelperSample({ phase: "waiting for writers before build" }),
        FF03_HELPER_TARGET,
      ),
    ).toBe(false);
    expect(
      isActiveScanSample(
        ff03HelperSample({ phase: "waiting for old snapshots" }),
        FF03_HELPER_TARGET,
      ),
    ).toBe(false);
  });

  it("rejects empty locks and AccessExclusiveLock (R-051/R-052 bypass)", () => {
    expect(
      isActiveScanSample(ff03HelperSample({ lockModes: [] }), FF03_HELPER_TARGET),
    ).toBe(false);
    expect(
      isActiveScanSample(
        ff03HelperSample({
          lockModes: ["ShareUpdateExclusiveLock", "AccessExclusiveLock"],
        }),
        FF03_HELPER_TARGET,
      ),
    ).toBe(false);
    expect(
      hasShareUpdateExclusiveWithoutAccessExclusive(
        ff03HelperSample({ lockModes: [] }),
      ),
    ).toBe(false);
  });

  it("rejects a builder that is no longer running CREATE INDEX CONCURRENTLY", () => {
    expect(
      isActiveScanSample(
        ff03HelperSample({ builderQuery: "SELECT 1" }),
        FF03_HELPER_TARGET,
      ),
    ).toBe(false);
    expect(builderStillCreatingConcurrentIndex(ff03HelperSample({ builderQuery: "SELECT 1" }))).toBe(
      false,
    );
  });

  it("rejects a late scan sample with almost no remaining work", () => {
    expect(
      isActiveScanSample(
        ff03HelperSample({ blocksDone: 5300, blocksTotal: 5324 }),
        FF03_HELPER_TARGET,
      ),
    ).toBe(false);
  });

  it("rejects phase-text-only samples with no remaining-work counters", () => {
    expect(
      isActiveScanSample(
        ff03HelperSample({
          tuplesDone: null,
          tuplesTotal: null,
          blocksDone: null,
          blocksTotal: null,
        }),
        FF03_HELPER_TARGET,
      ),
    ).toBe(false);
    expect(
      isActiveScanSample(
        ff03HelperSample({ tuplesDone: 0, tuplesTotal: 0, blocksDone: 0, blocksTotal: 0 }),
        FF03_HELPER_TARGET,
      ),
    ).toBe(false);
  });

  it("rejects loading-tuples / validation-index as substitutes for the required scan phases", () => {
    expect(
      isActiveScanSample(
        ff03HelperSample({ phase: "building index: loading tuples in tree" }),
        FF03_BUILD_SCAN_PHASE,
      ),
    ).toBe(false);
    expect(
      isActiveScanSample(
        ff03HelperSample({ phase: "index validation: scanning index" }),
        FF03_VALIDATION_SCAN_PHASE,
      ),
    ).toBe(false);
  });

  it("fails overlap proof when the after-burst phase is later and no in-window scan was observed (CI 35336443725)", () => {
    const trigger = ff03HelperSample({
      sampledAtNs: 1n,
      sampledEndNs: 5n,
      blocksDone: 125,
      blocksTotal: 5324,
    });
    const writes: Ff03WriteWindow[] = [
      {
        op: "insert",
        startNs: "10",
        endNs: "12",
        durationMs: 1,
        phaseAtWriteStart: FF03_BUILD_SCAN_PHASE,
        tuplesDoneAtStart: 0,
        tuplesTotalAtStart: 0,
        blocksDoneAtStart: 125,
        blocksTotalAtStart: 5324,
      },
      {
        op: "update",
        startNs: "13",
        endNs: "14",
        durationMs: 1,
        phaseAtWriteStart: FF03_BUILD_SCAN_PHASE,
        tuplesDoneAtStart: 0,
        tuplesTotalAtStart: 0,
        blocksDoneAtStart: 125,
        blocksTotalAtStart: 5324,
      },
      {
        op: "delete",
        startNs: "15",
        endNs: "16",
        durationMs: 1,
        phaseAtWriteStart: FF03_BUILD_SCAN_PHASE,
        tuplesDoneAtStart: 0,
        tuplesTotalAtStart: 0,
        blocksDoneAtStart: 125,
        blocksTotalAtStart: 5324,
      },
    ];
    const after = ff03HelperSample({
      sampledAtNs: 20n,
      sampledEndNs: 21n,
      phase: "building index: loading tuples in tree",
      blocksDone: 5324,
      blocksTotal: 5324,
    });
    const copied = evaluateActiveScanWriteOverlap({
      targetPhase: FF03_BUILD_SCAN_PHASE,
      trigger,
      writes,
      inWindowSamples: [],
      after,
      buildSettled: false,
    });
    expect(copied.ok).toBe(false);
    expect(copied.reason).toBe("copied_trigger_phase_is_not_independent_overlap");

    const laterPhase = evaluateActiveScanWriteOverlap({
      targetPhase: FF03_BUILD_SCAN_PHASE,
      trigger,
      writes: writes.map((write) => ({ ...write, phaseAtWriteStart: null })),
      inWindowSamples: [after],
      after,
      buildSettled: false,
    });
    expect(laterPhase.ok).toBe(false);
    expect(laterPhase.reason).toBe("wrong_or_finished_phase");
  });

  it("accepts independent in-window scan samples even if after-burst has already left the scan", () => {
    const trigger = ff03HelperSample({
      sampledAtNs: 1n,
      sampledEndNs: 5n,
      blocksDone: 125,
      blocksTotal: 5324,
    });
    const inWindow = ff03HelperSample({
      sampledAtNs: 11n,
      sampledEndNs: 15n,
      blocksDone: 400,
      blocksTotal: 5324,
    });
    const writes: Ff03WriteWindow[] = [
      {
        op: "insert",
        startNs: "10",
        endNs: "12",
        durationMs: 1.7,
        phaseAtWriteStart: FF03_BUILD_SCAN_PHASE,
        tuplesDoneAtStart: 0,
        tuplesTotalAtStart: 0,
        blocksDoneAtStart: 400,
        blocksTotalAtStart: 5324,
      },
      {
        op: "update",
        startNs: "13",
        endNs: "14",
        durationMs: 1.2,
        phaseAtWriteStart: FF03_BUILD_SCAN_PHASE,
        tuplesDoneAtStart: 0,
        tuplesTotalAtStart: 0,
        blocksDoneAtStart: 400,
        blocksTotalAtStart: 5324,
      },
      {
        op: "delete",
        startNs: "15",
        endNs: "16",
        durationMs: 4.3,
        phaseAtWriteStart: FF03_BUILD_SCAN_PHASE,
        tuplesDoneAtStart: 0,
        tuplesTotalAtStart: 0,
        blocksDoneAtStart: 400,
        blocksTotalAtStart: 5324,
      },
    ];
    const evaluation = evaluateActiveScanWriteOverlap({
      targetPhase: FF03_BUILD_SCAN_PHASE,
      trigger,
      writes,
      inWindowSamples: [inWindow],
      after: ff03HelperSample({
        sampledAtNs: 20n,
        sampledEndNs: 21n,
        phase: "building index: loading tuples in tree",
        blocksDone: 5324,
        blocksTotal: 5324,
      }),
      buildSettled: false,
    });
    expect(evaluation.ok).toBe(true);
    expect(evaluation.independentOverlapCount).toBe(1);
    expect(evaluation.progressEvidence).toBe(true);
  });

  it("fails overlap proof for blocked writes, AccessExclusiveLock, and omitted progress", () => {
    const trigger = ff03HelperSample({
      sampledAtNs: 1n,
      sampledEndNs: 5n,
      blocksDone: 125,
      blocksTotal: 5324,
    });
    const baseWrites: Ff03WriteWindow[] = [
      {
        op: "insert",
        startNs: "10",
        endNs: "12",
        durationMs: 1,
        phaseAtWriteStart: null,
        tuplesDoneAtStart: null,
        tuplesTotalAtStart: null,
        blocksDoneAtStart: null,
        blocksTotalAtStart: null,
      },
      {
        op: "update",
        startNs: "13",
        endNs: "14",
        durationMs: 1,
        phaseAtWriteStart: null,
        tuplesDoneAtStart: null,
        tuplesTotalAtStart: null,
        blocksDoneAtStart: null,
        blocksTotalAtStart: null,
      },
      {
        op: "delete",
        startNs: "15",
        endNs: "16",
        durationMs: 1,
        phaseAtWriteStart: null,
        tuplesDoneAtStart: null,
        tuplesTotalAtStart: null,
        blocksDoneAtStart: null,
        blocksTotalAtStart: null,
      },
    ];
    const blocked = evaluateActiveScanWriteOverlap({
      targetPhase: FF03_BUILD_SCAN_PHASE,
      trigger,
      writes: baseWrites.map((write, index) =>
        index === 0 ? { ...write, durationMs: CONCURRENT_WRITE_THRESHOLD_MS } : write,
      ),
      inWindowSamples: [
        ff03HelperSample({ sampledAtNs: 11n, sampledEndNs: 15n, blocksDone: 400, blocksTotal: 5324 }),
      ],
      after: null,
      buildSettled: false,
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toBe("blocked_or_nonconcurrent_write");
    expect(blocked.blockedWrite).toBe(true);

    const exclusive = evaluateActiveScanWriteOverlap({
      targetPhase: FF03_BUILD_SCAN_PHASE,
      trigger,
      writes: baseWrites,
      inWindowSamples: [
        ff03HelperSample({
          sampledAtNs: 11n,
          sampledEndNs: 15n,
          blocksDone: 400,
          blocksTotal: 5324,
          lockModes: ["ShareUpdateExclusiveLock", "AccessExclusiveLock"],
        }),
      ],
      after: null,
      buildSettled: false,
    });
    expect(exclusive.ok).toBe(false);
    expect(exclusive.reason).toBe("access_exclusive_during_write_window");

    const omitted = evaluateActiveScanWriteOverlap({
      targetPhase: FF03_BUILD_SCAN_PHASE,
      trigger,
      writes: baseWrites,
      inWindowSamples: [
        ff03HelperSample({
          sampledAtNs: 11n,
          sampledEndNs: 15n,
          blocksDone: 125,
          blocksTotal: 5324,
        }),
      ],
      after: null,
      buildSettled: false,
    });
    expect(omitted.ok).toBe(false);
    expect(omitted.reason).toBe("omitted_progress_evidence");
  });

  it("treats leftover owned CIC activity/progress/locks as a schema-reset blocker", () => {
    expect(
      remainderBlocksSchemaReset(
        {
          activity: [
            {
              pid: 4161,
              state: "active",
              query: `CREATE INDEX CONCURRENTLY "Supplier_shopId_idx" ON "Supplier" ("shopId")`,
            },
          ],
          progress: [{ pid: 4161, phase: "building index: loading tuples in tree" }],
          locks: [{ pid: 4161, mode: "ShareUpdateExclusiveLock", relation: "Supplier" }],
        },
        [4161, 4158],
      ),
    ).toBe(true);
    expect(
      remainderBlocksSchemaReset(
        { activity: [], progress: [], locks: [] },
        [4161, 4158],
      ),
    ).toBe(false);
    expect(
      ownedConcurrentIndexRemainder(
        {
          activity: [
            {
              pid: 4161,
              state: "active",
              query: `CREATE INDEX CONCURRENTLY "Supplier_shopId_idx" ON "Supplier" ("shopId")`,
            },
          ],
          progress: [],
          locks: [],
        },
        4161,
      ),
    ).toBe(true);
    expect(
      ownedConcurrentIndexRemainder(
        { activity: [], progress: [], locks: [] },
        4161,
      ),
    ).toBe(false);
    expect(
      ownedConcurrentIndexRemainder(
        {
          activity: [{ pid: 4158, state: "idle in transaction", query: "COMMIT" }],
          progress: [],
          locks: [{ pid: 4158, mode: "RowExclusiveLock", relation: "Supplier" }],
        },
        4161,
      ),
    ).toBe(false);
  });

  it("recognizes expected builder cancellation and ignores unrelated errors", () => {
    expect(isExpectedBuilderCancellation({ code: "57014", message: "query_canceled" })).toBe(
      true,
    );
    expect(
      isExpectedBuilderCancellation(new Error("canceling statement due to user request")),
    ).toBe(true);
    expect(isExpectedBuilderCancellation(new Error("Connection terminated"))).toBe(true);
    expect(isExpectedBuilderCancellation(new Error("deadlock detected"))).toBe(false);
  });
});

describe("tenant compatibility indexes on PostgreSQL", () => {
  const prisma = new PrismaClient({
    datasources: { db: { url: DATABASE_URL } },
  });

  beforeAll(() => {
    run("npx", ["prisma", "generate"]);
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("reports all missing after migrate deploy without apply", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      const plan = await planIndexes(client);
      expect(plan.every((row) => row.status === "missing")).toBe(true);
      const verify = await verifyIndexes(client);
      expect(verify.ok).toBe(false);
    });
  }, 180_000);

  it("valid exact after apply; rerun idempotency skips all", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      const first = await applyIndexes(client, { apply: true });
      expect(first.created).toHaveLength(44);
      expect(first.skipped).toHaveLength(0);

      const plan = await planIndexes(client);
      expect(plan.every((row) => row.status === "valid_exact")).toBe(true);

      const verify = await verifyIndexes(client);
      expect(verify.ok).toBe(true);

      const second = await applyIndexes(client, { apply: true });
      expect(second.created).toHaveLength(0);
      expect(second.skipped).toHaveLength(44);
    });
  }, 300_000);

  it("classifies missing explicitly", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);
    await withMaintenanceClient(async (client) => {
      const entry = TENANT_COMPATIBILITY_INDEXES.find(
        (e) => e.name === "Supplier_shopId_idx",
      )!;
      const inspected = await inspectIndex(client, entry.name);
      expect(classifyIndex(entry, inspected)).toBe("missing");
    });
  }, 180_000);

  it("wrong-table collision: plan wrong_table; apply/verify fail-closed; no auto-drop", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      await client.query(
        `CREATE INDEX "Supplier_shopId_idx" ON "ShopSettings" ("shopId")`,
      );

      const entry = TENANT_COMPATIBILITY_INDEXES.find(
        (e) => e.name === "Supplier_shopId_idx",
      )!;
      const inspected = await inspectIndex(client, entry.name);
      expect(classifyIndex(entry, inspected)).toBe("wrong_table");

      const plan = await planIndexes(client);
      expect(
        plan.find((p) => p.entry.name === "Supplier_shopId_idx")?.status,
      ).toBe("wrong_table");

      await expect(applyIndexes(client, { apply: true })).rejects.toThrow(
        /DROP INDEX CONCURRENTLY/i,
      );

      const stillThere = await inspectIndex(client, "Supplier_shopId_idx");
      expect(stillThere.status).toBe("present");
      if (stillThere.status === "present") {
        expect(stillThere.table).toBe("ShopSettings");
      }

      const verify = await verifyIndexes(client);
      expect(verify.ok).toBe(false);
    });
  }, 180_000);

  it("wrong uniqueness classification and fail-closed apply", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      await client.query(
        `CREATE UNIQUE INDEX "Supplier_shopId_idx" ON "Supplier" ("shopId")`,
      );
      const entry = TENANT_COMPATIBILITY_INDEXES.find(
        (e) => e.name === "Supplier_shopId_idx",
      )!;
      const inspected = await inspectIndex(client, entry.name);
      expect(classifyIndex(entry, inspected)).toBe("wrong_uniqueness");
      await expect(applyIndexes(client, { apply: true })).rejects.toThrow(
        /invalid or mismatched/i,
      );
      const verify = await verifyIndexes(client);
      expect(verify.ok).toBe(false);
    });
  }, 180_000);

  it("wrong ordered columns / same name wrong definition", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      await client.query(
        `CREATE INDEX "Supplier_shopId_idx" ON "Supplier" ("name")`,
      );
      const entry = TENANT_COMPATIBILITY_INDEXES.find(
        (e) => e.name === "Supplier_shopId_idx",
      )!;
      const inspected = await inspectIndex(client, entry.name);
      expect(classifyIndex(entry, inspected)).toBe("wrong_definition");

      await expect(applyIndexes(client, { apply: true })).rejects.toThrow(
        /invalid or mismatched/i,
      );
    });
  }, 180_000);

  it("genuine failed CREATE UNIQUE INDEX CONCURRENTLY leaves invalid index; no silent repair", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      // Two rows sharing shopId so UNIQUE(shopId) cannot complete.
      await client.query(`
        INSERT INTO "Supplier" (id, shop, name, "shopId", "createdAt", "updatedAt")
        VALUES
          ('sup-dup-a', 'dup-a.myshopify.com', 'A', 'shared-shop-id', NOW(), NOW()),
          ('sup-dup-b', 'dup-b.myshopify.com', 'B', 'shared-shop-id', NOW(), NOW())
      `);

      await expect(
        client.query(
          `CREATE UNIQUE INDEX CONCURRENTLY "Supplier_shopId_idx" ON "Supplier" ("shopId")`,
        ),
      ).rejects.toThrow();

      const inspected = await inspectIndex(client, "Supplier_shopId_idx");
      expect(inspected.status).toBe("present");
      if (inspected.status !== "present") {
        throw new Error("expected invalid index remnant");
      }
      expect(inspected.indisvalid === false || inspected.indisready === false).toBe(
        true,
      );

      const entry = TENANT_COMPATIBILITY_INDEXES.find(
        (e) => e.name === "Supplier_shopId_idx",
      )!;
      expect(classifyIndex(entry, inspected)).toBe("invalid");

      const plan = await planIndexes(client);
      expect(
        plan.find((p) => p.entry.name === "Supplier_shopId_idx")?.status,
      ).toBe("invalid");

      await expect(applyIndexes(client, { apply: true })).rejects.toThrow(
        /explicitly authorized/i,
      );
      expect(recoveryInstruction("Supplier_shopId_idx")).toMatch(
        /DROP INDEX CONCURRENTLY/i,
      );

      const still = await inspectIndex(client, "Supplier_shopId_idx");
      expect(still.status).toBe("present");

      const verify = await verifyIndexes(client);
      expect(verify.ok).toBe(false);
    });
  }, 180_000);

  it("statement timeout failure leaves data intact with clear recovery path", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await clientPopulateSuppliers(prisma, 5_000);

    const client = await getMaintenanceClient({
      requireExplicitMaintenanceUrl: true,
      statementTimeoutMs: 1,
    });
    try {
      await expect(
        client.query(
          `CREATE INDEX CONCURRENTLY "Supplier_shopId_idx" ON "Supplier" ("shopId")`,
        ),
      ).rejects.toThrow(/canceling statement due to statement timeout|timeout/i);
    } finally {
      await client.end();
    }

    // Verify on a fresh session (the timed-out session keeps the 1ms bound).
    const verifyClient = await getMaintenanceClient({
      requireExplicitMaintenanceUrl: true,
    });
    try {
      const count = await verifyClient.query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM "Supplier"`,
      );
      expect(Number(count.rows[0]!.c)).toBeGreaterThanOrEqual(5_000);

      const inspected = await inspectIndex(verifyClient, "Supplier_shopId_idx");
      if (inspected.status === "present") {
        expect(recoveryInstruction("Supplier_shopId_idx")).toMatch(
          /DROP INDEX CONCURRENTLY/i,
        );
      }
    } finally {
      await verifyClient.end();
    }
  }, 300_000);

  it("deterministic REPEATABLE READ overlap: ShareUpdateExclusiveLock, no AccessExclusiveLock, 10 iterations", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      await applyIndexes(client, { apply: true });
    });

    await clientPopulateSuppliers(prisma, CONCURRENT_INDEX_ROW_COUNT);

    const allIterationEvidence: Array<Record<string, unknown>> = [];

    for (let iteration = 1; iteration <= 10; iteration += 1) {
      await withMaintenanceClient(async (client) => {
        await client.query(
          `DROP INDEX CONCURRENTLY IF EXISTS "Supplier_shopId_idx"`,
        );
      });

      const builder = await getMaintenanceClient({
        requireExplicitMaintenanceUrl: true,
      });
      const writer = new Client({ connectionString: DATABASE_URL });
      await writer.connect();
      const observer = new Client({ connectionString: DATABASE_URL });
      await observer.connect();

      // Holder: REPEATABLE READ READ ONLY with positively retained backend_xmin.
      const holder = new Client({ connectionString: DATABASE_URL });
      await holder.connect();
      await holder.query(
        "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
      );
      await holder.query(`SELECT COUNT(*) FROM "Supplier"`);
      const holderPidRes = await holder.query<{ pid: number }>(
        `SELECT pg_backend_pid() AS pid`,
      );
      const holderPid = holderPidRes.rows[0]!.pid;
      const holderStatus = await observer.query<{
        state: string | null;
        backend_xmin: string | null;
      }>(
        `SELECT state, backend_xmin::text AS backend_xmin
         FROM pg_stat_activity WHERE pid = $1`,
        [holderPid],
      );
      expect(holderStatus.rows[0]?.state).toBe("idle in transaction");
      expect(holderStatus.rows[0]?.backend_xmin).toBeTruthy();
      const holderBackendXmin = holderStatus.rows[0]!.backend_xmin;

      const evidence: Record<string, unknown> = {
        iteration,
        rowCount: CONCURRENT_INDEX_ROW_COUNT,
        writeThresholdMs: CONCURRENT_WRITE_THRESHOLD_MS,
        holderPid,
        holderBackendXmin,
        environment: {
          node: process.version,
          platform: process.platform,
          databaseUrlHost: new URL(DATABASE_URL).host,
          supersededPriorR9Head:
            "fb04345f129b8664566c5947f2ad75f57102269b",
          note: "Prior R9 READ COMMITTED holder evidence rejected and superseded",
        },
      };

      try {
        const pidResult = await builder.query<{ pid: number }>(
          `SELECT pg_backend_pid() AS pid`,
        );
        const builderPid = pidResult.rows[0]!.pid;
        evidence.builderPid = builderPid;

        let buildSettled = false;
        let buildError: unknown;
        let buildSettledAtNs: bigint | null = null;
        const buildStartedAtNs = process.hrtime.bigint();
        evidence.buildStartedAtNs = buildStartedAtNs.toString();

        const buildPromise = builder
          .query(
            `CREATE INDEX CONCURRENTLY "Supplier_shopId_idx" ON "Supplier" ("shopId")`,
          )
          .then(
            (r) => {
              buildSettledAtNs = process.hrtime.bigint();
              buildSettled = true;
              return r;
            },
            (e) => {
              buildSettledAtNs = process.hrtime.bigint();
              buildSettled = true;
              buildError = e;
              throw e;
            },
          );

        type ProgressObs = { phase: string | null };
        type LockObs = { mode: string; granted: boolean };
        let progressObs: ProgressObs[] = [];
        let lockObs: LockObs[] = [];
        let waitingForSnapshot = false;
        const deadline = Date.now() + 120_000;

        while (Date.now() < deadline) {
          if (buildSettled) {
            throw new Error(
              `Iteration ${iteration}: CREATE INDEX CONCURRENTLY settled before positive overlap observation (waitingForOlderSnapshots=${waitingForSnapshot})`,
            );
          }

          const progress = await observer.query<{
            phase: string | null;
            relid: string;
          }>(
            `SELECT p.phase::text AS phase, p.relid::text AS relid
             FROM pg_stat_progress_create_index p
             JOIN pg_class c ON c.oid = p.relid
             WHERE p.pid = $1 AND c.relname = 'Supplier'`,
            [builderPid],
          );
          const locks = await observer.query<{
            mode: string;
            granted: boolean;
          }>(
            `
            SELECT l.mode, l.granted
            FROM pg_locks l
            JOIN pg_class c ON c.oid = l.relation
            WHERE l.pid = $1
              AND l.locktype = 'relation'
              AND c.relname = 'Supplier'
              AND l.granted = true
            `,
            [builderPid],
          );

          if (progress.rows.length > 0) {
            progressObs = progress.rows.map((r) => ({ phase: r.phase }));
            waitingForSnapshot = progress.rows.some((r) =>
              /waiting for old snapshots/i.test(r.phase ?? ""),
            );
          }
          if (locks.rows.length > 0) {
            lockObs = locks.rows;
          }

          // Require target-relation progress AND granted ShareUpdateExclusiveLock
          // AND the waiting-for-older-snapshots phase (proves RR holder is active).
          if (
            waitingForSnapshot &&
            lockObs.length > 0 &&
            lockObs.some((l) => l.mode === "ShareUpdateExclusiveLock")
          ) {
            break;
          }
          await new Promise((r) => setTimeout(r, 20));
        }

        if (!waitingForSnapshot) {
          throw new Error(
            `Iteration ${iteration}: timed out without observing waiting for old snapshots ` +
              `(progress=${JSON.stringify(progressObs)} locks=${JSON.stringify(lockObs)} buildSettled=${buildSettled})`,
          );
        }

        const activeObservedAtNs = process.hrtime.bigint();
        evidence.activeObservedAtNs = activeObservedAtNs.toString();
        evidence.progressPhase = progressObs.map((p) => p.phase);
        evidence.targetTableLockModes = lockObs.map((l) => l.mode);
        evidence.waitingForOlderSnapshots = waitingForSnapshot;

        expect(buildSettled).toBe(false);
        expect(progressObs.length).toBeGreaterThan(0);
        expect(lockObs.length).toBeGreaterThan(0);
        expect(
          lockObs.some((l) => l.mode === "ShareUpdateExclusiveLock"),
        ).toBe(true);
        expect(
          lockObs.every((l) => l.mode !== "AccessExclusiveLock"),
        ).toBe(true);
        expect(
          lockObs.some((l) => l.mode === "AccessExclusiveLock"),
        ).toBe(false);

        const writeWindows: Array<{
          op: string;
          startNs: string;
          endNs: string;
          durationMs: number;
        }> = [];

        const timedWrite = async (
          op: string,
          fn: () => Promise<unknown>,
        ): Promise<void> => {
          expect(buildSettled).toBe(false);
          const startNs = process.hrtime.bigint();
          expect(startNs > activeObservedAtNs).toBe(true);
          await fn();
          const endNs = process.hrtime.bigint();
          expect(buildSettled).toBe(false);
          expect(buildSettledAtNs).toBeNull();
          const durationMs = Number(endNs - startNs) / 1e6;
          writeWindows.push({
            op,
            startNs: startNs.toString(),
            endNs: endNs.toString(),
            durationMs,
          });
          expect(durationMs).toBeLessThan(CONCURRENT_WRITE_THRESHOLD_MS);
        };

        await timedWrite("insert", () =>
          writer.query(
            `INSERT INTO "Supplier" (id, shop, name, "createdAt", "updatedAt")
             VALUES ('sup-concurrent-ins', 'write-probe.myshopify.com', 'W', NOW(), NOW())`,
          ),
        );
        await timedWrite("update", () =>
          writer.query(
            `UPDATE "Supplier" SET name = 'W2' WHERE id = 'sup-concurrent-ins'`,
          ),
        );
        await timedWrite("delete", () =>
          writer.query(
            `DELETE FROM "Supplier" WHERE id = 'sup-concurrent-ins'`,
          ),
        );

        evidence.writeWindows = writeWindows;

        // Holder must remain open through all representative writes.
        const holderStill = await observer.query<{
          state: string | null;
          backend_xmin: string | null;
        }>(
          `SELECT state, backend_xmin::text AS backend_xmin
           FROM pg_stat_activity WHERE pid = $1`,
          [holderPid],
        );
        expect(holderStill.rows[0]?.state).toBe("idle in transaction");
        expect(holderStill.rows[0]?.backend_xmin).toBeTruthy();

        await holder.query("COMMIT");
        await holder.end();

        await buildPromise;
        expect(buildSettledAtNs).not.toBeNull();
        const settledAt = buildSettledAtNs!;
        evidence.buildSettledAtNs = settledAt.toString();
        evidence.buildDurationMs = Number(settledAt - buildStartedAtNs) / 1e6;
        if (buildError) throw buildError;

        for (const w of writeWindows) {
          const start = BigInt(w.startNs);
          const end = BigInt(w.endNs);
          expect(start > activeObservedAtNs).toBe(true);
          expect(end < settledAt).toBe(true);
          expect(start < settledAt).toBe(true);
        }

        const entry = TENANT_COMPATIBILITY_INDEXES.find(
          (e) => e.name === "Supplier_shopId_idx",
        )!;
        const inspected = await inspectIndex(builder, entry.name);
        expect(classifyIndex(entry, inspected)).toBe("valid_exact");
        if (inspected.status === "present") {
          expect(inspected.indisvalid).toBe(true);
          expect(inspected.indisready).toBe(true);
        }
        evidence.indexVerification = "valid_exact";

        allIterationEvidence.push(evidence);
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify({
            event: "tenant_index_concurrent_write_evidence_v2",
            ...evidence,
          }),
        );
      } finally {
        try {
          await holder.query("ROLLBACK");
        } catch {
          // already closed
        }
        try {
          await holder.end();
        } catch {
          // ignore
        }
        await builder.end();
        await writer.end();
        await observer.end();
      }
    }

    expect(allIterationEvidence).toHaveLength(10);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        event: "tenant_index_concurrent_write_evidence_v2_summary",
        iterations: allIterationEvidence.length,
        supersededPriorR9Head:
          "fb04345f129b8664566c5947f2ad75f57102269b",
      }),
    );
  }, 900_000);

  it("DML overlaps active build-scan and validation-scan phases (F-F03), 3 iterations", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      await applyIndexes(client, { apply: true });
    });

    await clientPopulateSuppliers(prisma, ACTIVE_PHASE_ROW_COUNT);

    const iterationEvidence: Array<Record<string, unknown>> = [];

    for (let iteration = 1; iteration <= 3; iteration += 1) {
      await withMaintenanceClient(async (client) => {
        await client.query(
          `DROP INDEX CONCURRENTLY IF EXISTS "Supplier_shopId_idx"`,
        );
      });

      const runtime = new Ff03OwnedRuntime();
      await runtime.open();
      const builder = runtime.builder!;
      const writer = runtime.writer!;
      const observer = runtime.observer!;
      const gate1 = runtime.gate1!;
      const gate2 = runtime.gate2!;
      const builderPid = runtime.builderPid;

      const evidence: Record<string, unknown> = {
        iteration,
        rowCount: ACTIVE_PHASE_ROW_COUNT,
        writeThresholdMs: CONCURRENT_WRITE_THRESHOLD_MS,
        environment: {
          node: process.version,
          platform: process.platform,
          databaseUrlHost: new URL(DATABASE_URL).host,
          cpuCount: cpus().length,
          loadavg: loadavg(),
        },
      };

      let originalError: unknown;
      try {
        await builder.query(`SET max_parallel_maintenance_workers = 0`);
        await builder.query(`SET maintenance_work_mem = '1MB'`);
        const pgSettings = await builder.query<{ name: string; setting: string }>(
          `SELECT name, setting
           FROM pg_settings
           WHERE name IN (
             'max_parallel_maintenance_workers',
             'maintenance_work_mem',
             'shared_buffers',
             'work_mem',
             'max_parallel_workers'
           )
           ORDER BY name`,
        );
        evidence.postgresSettings = Object.fromEntries(
          pgSettings.rows.map((r) => [r.name, r.setting]),
        );
        evidence.builderPid = builderPid;

        await gate1.query("BEGIN");
        await gate1.query(
          `INSERT INTO "Supplier" (id, shop, name, "createdAt", "updatedAt")
           VALUES ('sup-gate1-${iteration}', 'gate.myshopify.com', 'G1', NOW(), NOW())`,
        );

        runtime.startSampler();
        runtime.startConcurrentIndex();
        evidence.buildStartedAtNs = runtime.buildStartedAtNs.toString();

        const phasesSeen = new Set<string>();
        const isBuildSettled = () => runtime.buildSettled;

        const overlapWritesWithActiveScan = async (
          targetPhase: string,
          idSuffix: string,
          deadlineMs: number,
        ) => {
          const trigger = await waitForActiveScanTrigger({
            observer,
            builderPid,
            targetPhase,
            deadlineMs,
            iteration,
            phasesSeen,
            isBuildSettled,
          });
          expect(runtime.buildSettled).toBe(false);
          expect(runtime.buildSettledAtNs).toBeNull();
          expect(trigger.phase).toBe(targetPhase);
          expect(trigger.schema).toBe("public");
          expect(trigger.relid).toBeTruthy();
          expect(trigger.lockModes.length).toBeGreaterThan(0);
          expect(trigger.lockModes).toContain("ShareUpdateExclusiveLock");
          expect(trigger.lockModes).not.toContain("AccessExclusiveLock");
          const remainingTuples =
            trigger.tuplesTotal != null &&
            trigger.tuplesTotal > 0 &&
            (trigger.tuplesDone ?? 0) < trigger.tuplesTotal;
          const remainingBlocks =
            trigger.blocksTotal != null &&
            trigger.blocksTotal > 0 &&
            (trigger.blocksDone ?? 0) < trigger.blocksTotal;
          expect(remainingTuples || remainingBlocks).toBe(true);

          const timedWrites = await burstRepresentativeSupplierDml({
            writer,
            idSuffix,
          });
          expect(timedWrites).toHaveLength(3);
          const burstStart = timedWrites[0]!.startNs;
          const burstEnd = timedWrites[2]!.endNs;
          const windowSamples = inWindowSamples(
            runtime.samples,
            burstStart,
            burstEnd,
          );
          const writeWindows = attachIndependentWriteObservations(
            timedWrites,
            windowSamples,
            targetPhase,
          );
          for (const write of writeWindows) {
            expect(write.durationMs).toBeLessThan(CONCURRENT_WRITE_THRESHOLD_MS);
            expect(BigInt(write.startNs) > trigger.sampledAtNs).toBe(true);
          }

          const after = await sampleConcurrentIndexProgress(observer, builderPid);
          if (after.phase) {
            phasesSeen.add(after.phase);
          }
          expect(runtime.buildSettled).toBe(false);
          expect(runtime.buildSettledAtNs).toBeNull();

          const evaluation = evaluateActiveScanWriteOverlap({
            targetPhase,
            trigger,
            writes: writeWindows,
            inWindowSamples: windowSamples,
            after,
            buildSettled: runtime.buildSettled,
          });
          expect(evaluation.ok).toBe(true);
          expect(evaluation.reason).toBe("ok");
          expect(evaluation.independentOverlapCount).toBeGreaterThan(0);
          expect(evaluation.progressEvidence).toBe(true);
          expect(evaluation.blockedWrite).toBe(false);

          return {
            phaseAtStart: trigger.phase!,
            relid: trigger.relid!,
            schema: trigger.schema!,
            lockModes: trigger.lockModes,
            writeWindows,
            overlap: evaluation,
            trigger: summarizeSample(trigger),
            inWindow: windowSamples.map(summarizeSample),
            afterBurst: summarizeSample(after),
          };
        };

        await waitForNamedIndexPhase({
          observer,
          builderPid,
          targetPhase: "waiting for writers before build",
          deadlineMs: 60_000,
          iteration,
          phasesSeen,
          isBuildSettled,
        });
        await gate2.query("BEGIN");
        await gate2.query(
          `INSERT INTO "Supplier" (id, shop, name, "createdAt", "updatedAt")
           VALUES ('sup-gate2-${iteration}', 'gate.myshopify.com', 'G2', NOW(), NOW())`,
        );
        await gate1.query("COMMIT");

        const buildScanWrites = await overlapWritesWithActiveScan(
          FF03_BUILD_SCAN_PHASE,
          `build-${iteration}`,
          120_000,
        );

        await waitForNamedIndexPhase({
          observer,
          builderPid,
          targetPhase: "waiting for writers before validation",
          deadlineMs: 120_000,
          iteration,
          phasesSeen,
          isBuildSettled,
        });
        await gate2.query("COMMIT");

        const validationScanWrites = await overlapWritesWithActiveScan(
          FF03_VALIDATION_SCAN_PHASE,
          `validate-${iteration}`,
          120_000,
        );

        await runtime.stopSampler();
        if (!runtime.buildPromise) {
          throw new Error(`Iteration ${iteration}: missing CREATE INDEX CONCURRENTLY promise`);
        }
        await runtime.buildPromise;
        expect(runtime.buildSettledAtNs).not.toBeNull();
        const settledAt = runtime.buildSettledAtNs!;
        evidence.buildSettledAtNs = settledAt.toString();
        evidence.buildDurationMs =
          Number(settledAt - runtime.buildStartedAtNs) / 1e6;
        if (runtime.buildError) throw runtime.buildError;

        for (const sample of runtime.samples) {
          if (sample.phase) phasesSeen.add(sample.phase);
        }
        evidence.phasesSeen = [...phasesSeen];
        evidence.buildScanWrites = buildScanWrites;
        evidence.validationScanWrites = validationScanWrites;

        expect(buildScanWrites.phaseAtStart).toBe(FF03_BUILD_SCAN_PHASE);
        expect(validationScanWrites.phaseAtStart).toBe(FF03_VALIDATION_SCAN_PHASE);

        for (const phaseWrites of [buildScanWrites, validationScanWrites]) {
          expect(phaseWrites.schema).toBe("public");
          expect(phaseWrites.lockModes).toContain("ShareUpdateExclusiveLock");
          expect(phaseWrites.lockModes).not.toContain("AccessExclusiveLock");
          expect(phaseWrites.writeWindows).toHaveLength(3);
          expect(phaseWrites.overlap.ok).toBe(true);
          expect(phaseWrites.inWindow.length).toBeGreaterThan(0);
          for (const write of phaseWrites.writeWindows) {
            expect(BigInt(write.startNs) > runtime.buildStartedAtNs).toBe(true);
            expect(BigInt(write.startNs) < settledAt).toBe(true);
            expect(BigInt(write.endNs) < settledAt).toBe(true);
            expect(write.durationMs).toBeLessThan(CONCURRENT_WRITE_THRESHOLD_MS);
          }
        }

        await writer.query(
          `DELETE FROM "Supplier" WHERE id IN ('sup-gate1-${iteration}', 'sup-gate2-${iteration}')`,
        );

        const entry = TENANT_COMPATIBILITY_INDEXES.find(
          (e) => e.name === "Supplier_shopId_idx",
        )!;
        const inspected = await inspectIndex(builder, entry.name);
        expect(classifyIndex(entry, inspected)).toBe("valid_exact");
        if (inspected.status === "present") {
          expect(inspected.indisvalid).toBe(true);
          expect(inspected.indisready).toBe(true);
        }
        evidence.indexVerification = "valid_exact";

        iterationEvidence.push(evidence);
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify({
            event: "tenant_index_active_phase_write_evidence",
            ...evidence,
          }),
        );
      } catch (error) {
        originalError = error;
      }

      const cleanup = await runtime.cleanup();
      if (!cleanup.ok) {
        const cleanupError = new Error(
          `F-F03 owned cleanup failed: ${cleanup.errors.join(" | ")}`,
        );
        if (originalError) {
          throw new Error(
            `${originalError instanceof Error ? originalError.message : String(originalError)}\n--- cleanup also failed ---\n${cleanupError.message}`,
          );
        }
        throw cleanupError;
      }
      if (originalError) {
        throw originalError;
      }
    }

    expect(iterationEvidence).toHaveLength(3);
  }, 900_000);

  it("cancels an in-flight CONCURRENTLY builder after injected assertion failure so the next schema reset can run", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    const runtime = new Ff03OwnedRuntime();
    let injected: unknown;
    let leftoverWhileActive: Ff03RemainderSnapshot | null = null;
    await runtime.open();
    try {
      await runtime.builder!.query(`SET max_parallel_maintenance_workers = 0`);
      await runtime.builder!.query(`SET maintenance_work_mem = '1MB'`);
      await runtime.gate1!.query("BEGIN");
      await runtime.gate1!.query(
        `INSERT INTO "Supplier" (id, shop, name, "createdAt", "updatedAt")
         VALUES ('sup-injected-gate', 'gate.myshopify.com', 'G1', NOW(), NOW())`,
      );
      runtime.startSampler();
      runtime.startConcurrentIndex();
      const phasesSeen = new Set<string>();
      await waitForNamedIndexPhase({
        observer: runtime.observer!,
        builderPid: runtime.builderPid,
        targetPhase: "waiting for writers before build",
        deadlineMs: 60_000,
        iteration: 0,
        phasesSeen,
        isBuildSettled: () => runtime.buildSettled,
      });
      expect(runtime.buildSettled).toBe(false);
      leftoverWhileActive = await queryOwnedRemainder(
        runtime.observer!,
        runtime.ownedPids,
      );
      expect(
        ownedConcurrentIndexRemainder(leftoverWhileActive, runtime.builderPid),
      ).toBe(true);
      throw new Error("injected early assertion failure while builder is active");
    } catch (error) {
      injected = error;
    }

    const cleanup = await runtime.cleanup();
    expect(String(injected)).toMatch(
      /injected early assertion failure while builder is active/,
    );
    expect(cleanup.neededCancel).toBe(true);
    expect(cleanup.cancelObserved).toBe(true);
    expect(cleanup.ok).toBe(true);
    expect(cleanup.errors).toEqual([]);
    expect(remainderBlocksSchemaReset(cleanup.remainder, runtime.ownedPids)).toBe(
      false,
    );
    expect(leftoverWhileActive).not.toBeNull();

    await resetPublicSchema(prisma);
  }, 180_000);

  it("verify fails when indexes were dropped after apply", async () => {
    await resetPublicSchema(prisma);
    run("npx", ["prisma", "migrate", "deploy"]);

    await withMaintenanceClient(async (client) => {
      await applyIndexes(client, { apply: true });
      await dropAllManifestIndexes(client);
      const verify = await verifyIndexes(client);
      expect(verify.ok).toBe(false);
      expect(verify.mismatches.length).toBeGreaterThan(0);
    });
  }, 300_000);
});

async function clientPopulateSuppliers(
  prisma: PrismaClient,
  count: number,
): Promise<void> {
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Supplier" (id, shop, name, "createdAt", "updatedAt")
    SELECT
      'sup-bulk-' || g,
      'bulk.myshopify.com',
      'Name-' || g,
      NOW(),
      NOW()
    FROM generate_series(1, ${count}) AS g
  `);
}
