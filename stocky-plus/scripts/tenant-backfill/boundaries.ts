/**
 * Compatibility re-exports for subject-evidence boundaries (phase1-tenant-subject-v2).
 * Implementation lives in subject-evidence.ts — ID-only membershipChecksum is removed.
 */
export {
  assertMembershipUnchanged,
  assertSubjectEvidenceUnchanged,
  boundaryPredicate,
  loadDatasetBoundaries,
  recomputeMembershipChecksum,
  recomputeSubjectEvidence,
  streamTableSubjectEvidence,
  type DatasetBoundaries,
  type TableDatasetBoundary,
  type TableSubjectEvidence,
} from "./subject-evidence";
