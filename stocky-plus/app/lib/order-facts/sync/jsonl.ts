/**
 * Stream Bulk A JSONL via validated scratch indexes.
 * Parent closure is indexed membership after EOF, not quantity or next-root.
 */
import {
  ORDER_FACTS_JSONL_MAX_LINE_BYTES,
  ORDER_FACTS_JSONL_MAX_LIVE_BYTES,
  ORDER_FACTS_JSONL_MAX_SCRATCH_BYTES,
} from "./constants";
import { OrderFactsJsonlError } from "./errors";
import {
  disposeOwnedScratch,
  iterateGroupedIndex,
  readJsonlObjectAt,
  stageOrderFactsJsonl,
  type JsonlIndexRow,
  type ValidatedSourceStage,
} from "./source-stage";
import type {
  JsonlAssemblyResult,
  JsonlByteSource,
  JsonlCloseEvidence,
  JsonlObject,
} from "./types";

export type { JsonlByteSource };

export type JsonlCompleteAssembly = {
  rootGid: string;
  root: JsonlObject;
  children: JsonlObject[];
  lineOrdinals: number[];
  startLineOrdinal: number;
  endLineOrdinal: number;
  closeEvidence: JsonlCloseEvidence;
};

export type StreamOrderFactsJsonlOptions = {
  maxOpenParents?: number;
  maxLineBytes?: number;
  maxLiveBytes?: number;
  maxScratchBytes?: number;
  expectedObjectCount?: string | null;
  expectedRootObjectCount?: string | null;
  shopId?: string;
  syncRunId?: string;
  scratchRoot?: string;
  onCompleteAssembly?: (assembly: JsonlCompleteAssembly) => Promise<void>;
};

function fail(
  status: Exclude<JsonlAssemblyResult["status"], "COMPLETE">,
  reason: string,
  extras: {
    objectCount: number;
    rootCount: number;
    lastPhysicalOrdinal: number;
    rootGids?: string[];
  },
): JsonlAssemblyResult {
  return {
    status,
    reason,
    rootGids: extras.rootGids ?? [],
    objectCount: extras.objectCount,
    rootCount: extras.rootCount,
    lastPhysicalOrdinal: extras.lastPhysicalOrdinal,
  };
}

async function emitValidatedAssemblies(
  stage: ValidatedSourceStage,
  options?: StreamOrderFactsJsonlOptions,
): Promise<JsonlAssemblyResult> {
  const maxLiveBytes =
    options?.maxLiveBytes ?? ORDER_FACTS_JSONL_MAX_LIVE_BYTES;
  const completedRootGids: string[] = [];
  const closeEvidence: JsonlCloseEvidence = "indexed_parent_membership";
  const groups: Array<{ groupKey: string; rows: JsonlIndexRow[] }> = [];
  for await (const group of iterateGroupedIndex(stage.groupedPath)) {
    groups.push(group);
  }
  groups.sort((left, right) => {
    const leftMin = left.rows.reduce(
      (min, row) => Math.min(min, row.ordinal),
      Number.POSITIVE_INFINITY,
    );
    const rightMin = right.rows.reduce(
      (min, row) => Math.min(min, row.ordinal),
      Number.POSITIVE_INFINITY,
    );
    return leftMin - rightMin;
  });

  for (const group of groups) {
    const rootRow = group.rows.find((row) => row.kind === "R");
    if (!rootRow) {
      return fail(
        "MIS_PARENTED",
        `JSONL children referenced missing parent ${group.groupKey}`,
        stage,
      );
    }
    const childRows = group.rows.filter((row) => row.kind === "C");
    const liveBytes = group.rows.reduce((sum, row) => sum + row.length, 0);
    if (liveBytes > maxLiveBytes) {
      return fail(
        "OPEN_PARENT_BOUND",
        `live JSONL assembly bytes exceeded ${maxLiveBytes}`,
        stage,
      );
    }
    const root = await readJsonlObjectAt(
      stage.jsonlPath,
      rootRow.offset,
      rootRow.length,
    );
    const children: JsonlObject[] = [];
    for (const child of childRows) {
      children.push(
        await readJsonlObjectAt(stage.jsonlPath, child.offset, child.length),
      );
    }
    const ordinals = group.rows
      .map((row) => row.ordinal)
      .sort((a, b) => a - b);
    const complete: JsonlCompleteAssembly = {
      rootGid: rootRow.id,
      root,
      children,
      lineOrdinals: ordinals,
      startLineOrdinal: ordinals[0] ?? stage.lastPhysicalOrdinal,
      endLineOrdinal: ordinals[ordinals.length - 1] ?? stage.lastPhysicalOrdinal,
      closeEvidence,
    };
    if (options?.onCompleteAssembly) {
      await options.onCompleteAssembly(complete);
    } else {
      completedRootGids.push(rootRow.id);
    }
  }

  return {
    status: "COMPLETE",
    rootGids: completedRootGids,
    objectCount: stage.objectCount,
    rootCount: stage.rootCount,
    lastPhysicalOrdinal: stage.lastPhysicalOrdinal,
    closeEvidence,
  };
}

/**
 * Download/spool, index, validate uniqueness and parent membership, then
 * materialize one parent at a time. `onCompleteAssembly` never runs before EOF
 * validation succeeds.
 */
export async function streamOrderFactsJsonl(
  source: JsonlByteSource,
  options?: StreamOrderFactsJsonlOptions,
): Promise<JsonlAssemblyResult> {
  void options?.maxOpenParents;
  const staged = await stageOrderFactsJsonl(source, {
    shopId: options?.shopId,
    syncRunId: options?.syncRunId,
    scratchRoot: options?.scratchRoot,
    maxLineBytes: options?.maxLineBytes ?? ORDER_FACTS_JSONL_MAX_LINE_BYTES,
    maxLiveBytes: options?.maxLiveBytes ?? ORDER_FACTS_JSONL_MAX_LIVE_BYTES,
    maxScratchBytes: options?.maxScratchBytes ?? ORDER_FACTS_JSONL_MAX_SCRATCH_BYTES,
    expectedObjectCount: options?.expectedObjectCount,
    expectedRootObjectCount: options?.expectedRootObjectCount,
  });
  if (staged.status !== "COMPLETE") {
    return staged;
  }
  try {
    return await emitValidatedAssemblies(staged, options);
  } finally {
    await disposeOwnedScratch(staged.dir, options?.scratchRoot).catch(
      () => undefined,
    );
  }
}

export async function assembleOrderFactsJsonl(
  source: JsonlByteSource,
  options?: StreamOrderFactsJsonlOptions,
): Promise<JsonlAssemblyResult> {
  return streamOrderFactsJsonl(source, options);
}

export function nominatedOrderGids(result: JsonlAssemblyResult): string[] {
  if (result.status !== "COMPLETE") {
    throw new OrderFactsJsonlError(
      "jsonl_not_complete",
      "Cannot nominate GIDs from an incomplete JSONL assembly",
    );
  }
  return result.rootGids;
}
