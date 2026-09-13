/**
 * F-F03 test-local helper: sample CREATE INDEX CONCURRENTLY progress, locks,
 * and builder activity in one round trip, then burst representative DML
 * without an extra lock query between first observation and first write.
 *
 * Production index SQL is not modified. Imported only by the F-F03
 * migration test and its helper unit tests.
 */
import type { Client } from "pg";

export type Ff03ProgressSample = {
  sampledAtNs: bigint;
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

export type Ff03WriteWindow = {
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
export async function sampleConcurrentIndexProgress(
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
  return {
    sampledAtNs,
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

export function builderStillCreatingConcurrentIndex(
  sample: Ff03ProgressSample,
): boolean {
  const q = sample.builderQuery ?? "";
  return /CREATE\s+INDEX\s+CONCURRENTLY/i.test(q);
}

export function hasShareUpdateExclusiveWithoutAccessExclusive(
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
export function isActiveScanSample(
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

export async function waitForNamedIndexPhase(options: {
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
export async function waitForActiveScanTrigger(options: {
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

export function summarizeSample(
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
  };
}

/**
 * INSERT/UPDATE/DELETE back-to-back after a triggering active-scan sample.
 * No extra observer round-trip is taken before the first write. After the
 * burst, the caller re-samples to prove the scan phase was still reported.
 */
export async function burstRepresentativeSupplierDml(options: {
  writer: Client;
  trigger: Ff03ProgressSample;
  idSuffix: string;
}): Promise<Ff03WriteWindow[]> {
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
  const windows: Ff03WriteWindow[] = [];
  for (const { op, sql } of ops) {
    const startNs = process.hrtime.bigint();
    await options.writer.query(sql);
    const endNs = process.hrtime.bigint();
    const durationMs = Number(endNs - startNs) / 1e6;
    windows.push({
      op,
      startNs: startNs.toString(),
      endNs: endNs.toString(),
      durationMs,
      phaseAtWriteStart: options.trigger.phase,
      tuplesDoneAtStart: options.trigger.tuplesDone,
      tuplesTotalAtStart: options.trigger.tuplesTotal,
      blocksDoneAtStart: options.trigger.blocksDone,
      blocksTotalAtStart: options.trigger.blocksTotal,
    });
  }
  return windows;
}
