import type { EvidenceProfile } from '../../src/features/literature/classifier/packet-contract'
import {
  isNegativeOnlyReasonCode,
  routeStageARecord,
  validateStageARiskAnalysisResult,
  type StageARiskAnalysisResult,
  type StageARoute,
  type StageATerminalState,
} from '../../src/features/literature/classifier/stage-a-contract'
import {
  summarizeStageBQueue,
  type StageBEntrySource,
  type StageBQueueAggregates,
  type StageBQueueEntry,
} from '../../src/features/literature/classifier/stage-b-contract'
import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import type { TerminalAssignment } from './results'

/**
 * Routing manifest construction: the coordinator-side merge of validated Stage-A outputs,
 * deterministic risk flags, and terminal accounting into the two routes. AI output routes
 * records between later machine stages only — it never modifies relevance state, reviewed
 * relevance, visibility, searchability, article existence, or physician truth.
 */

export const LUNA_ROUTING_MANIFEST_VERSION = 'literature-luna-routing/1.0.0'

export interface RoutedRecord {
  readonly recordId: string
  readonly route: StageARoute
  readonly routeReasons: readonly string[]
  readonly terminalState: StageATerminalState
  readonly evidenceProfile: EvidenceProfile
  readonly riskFlags: readonly string[]
  /** True when the model produced a valid high-confidence negative but risk flags barred it. */
  readonly mandatoryPhysicianReview: boolean
}

export interface RoutingManifest {
  readonly version: string
  readonly total: number
  readonly byRoute: Readonly<Record<StageARoute, number>>
  readonly byTerminalState: Readonly<Record<string, number>>
  readonly deprioritizationCandidates: number
  readonly mandatoryPhysicianReviewCount: number
  readonly riskFlaggedCount: number
  readonly stageBQueue: StageBQueueAggregates
  readonly recordsSha256: string
}

export interface RoutingInputs {
  readonly assignments: readonly TerminalAssignment[]
  readonly evidenceProfiles: ReadonlyMap<string, EvidenceProfile>
  /**
   * The independent risk-analysis results, one row per selected record, exactly as stored.
   * A list rather than a map on purpose: a map silently collapses duplicate rows, and duplicate
   * risk evidence is a disagreement between authorities, not a detail to normalize away.
   */
  readonly riskAnalysisResults: readonly unknown[]
}

export class RiskEvidenceCoverageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RiskEvidenceCoverageError'
  }
}

/**
 * Coordinator-level exact-coverage assertion: every selected record has exactly one
 * schema-valid risk-analysis result, and no result names a record outside the selection.
 * Missing, duplicated, foreign, or malformed evidence stops the routing operation — there is
 * no "no row means no risk" reading of an unscanned record anywhere in this lane.
 */
export function assertExactRiskAnalysisCoverage(
  selectedRecordIds: readonly string[],
  riskAnalysisResults: readonly unknown[],
): Map<string, StageARiskAnalysisResult> {
  const selected = new Set<string>()
  for (const recordId of selectedRecordIds) {
    if (selected.has(recordId)) {
      throw new RiskEvidenceCoverageError(
        'A record id appears twice in the selection; refusing to route.',
      )
    }
    selected.add(recordId)
  }
  const byRecordId = new Map<string, StageARiskAnalysisResult>()
  riskAnalysisResults.forEach((value, index) => {
    const validation = validateStageARiskAnalysisResult(value)
    if (!validation.ok) {
      throw new RiskEvidenceCoverageError(
        `Risk-analysis result ${index} failed validation (${validation.issues.join('; ')}); ` +
          'refusing to route.',
      )
    }
    const { result } = validation
    if (byRecordId.has(result.recordId)) {
      throw new RiskEvidenceCoverageError(
        'A record has more than one risk-analysis result; refusing to route.',
      )
    }
    if (!selected.has(result.recordId)) {
      throw new RiskEvidenceCoverageError(
        'A risk-analysis result names a record outside the selection; refusing to route.',
      )
    }
    byRecordId.set(result.recordId, result)
  })
  if (byRecordId.size !== selected.size) {
    throw new RiskEvidenceCoverageError(
      `Risk-analysis coverage is incomplete: ${byRecordId.size} results for ${selected.size} ` +
        'selected records. Independent risk analysis is mandatory evidence; refusing to route.',
    )
  }
  return byRecordId
}

function isHighConfidenceNegativeOutput(assignment: TerminalAssignment): boolean {
  return (
    assignment.state === 'valid_prediction' &&
    assignment.output !== null &&
    assignment.output.triage_decision === 'obvious_irrelevant' &&
    assignment.output.confidence_band === 'high' &&
    assignment.output.reason_codes.every((code) => isNegativeOnlyReasonCode(code))
  )
}

function stageBEntrySource(record: RoutedRecord): StageBEntrySource {
  if (record.terminalState === 'no_attempt') return 'stage_a_not_attempted'
  if (record.terminalState === 'valid_prediction' || record.terminalState === 'valid_abstention') {
    return record.mandatoryPhysicianReview ? 'coordinator_risk_flag' : 'stage_a_advance_decision'
  }
  return 'stage_a_output_unusable'
}

/** Route every selected record. Total function: no record is ever dropped or double-routed. */
export function buildRoutedRecords(inputs: RoutingInputs): RoutedRecord[] {
  const riskByRecordId = assertExactRiskAnalysisCoverage(
    inputs.assignments.map((assignment) => assignment.recordId),
    inputs.riskAnalysisResults,
  )
  const routed: RoutedRecord[] = []
  for (const assignment of inputs.assignments) {
    const evidenceProfile = inputs.evidenceProfiles.get(assignment.recordId)
    if (!evidenceProfile) {
      throw new Error('A terminal assignment has no evidence profile; refusing to route.')
    }
    // Guaranteed present by the coverage assertion above; the routing function re-validates it.
    const riskEvidence = riskByRecordId.get(assignment.recordId)
    const decision = routeStageARecord({
      recordId: assignment.recordId,
      terminalState: assignment.state,
      output: assignment.output,
      riskAnalysisResult: riskEvidence,
    })
    const riskFlags: readonly string[] = riskEvidence?.riskFlags ?? []
    routed.push({
      recordId: assignment.recordId,
      route: decision.route,
      routeReasons: decision.routeReasons,
      terminalState: assignment.state,
      evidenceProfile,
      riskFlags,
      mandatoryPhysicianReview: riskFlags.length > 0 && isHighConfidenceNegativeOutput(assignment),
    })
  }
  return routed
}

/** Aggregate manifest. Record identities live in the 0600 records file, never here. */
export function buildRoutingManifest(records: readonly RoutedRecord[]): RoutingManifest {
  const byRoute: Record<StageARoute, number> = {
    deprioritization_candidate: 0,
    advance_to_full_relevance_classification: 0,
  }
  const byTerminalState: Record<string, number> = {}
  let mandatoryPhysicianReviewCount = 0
  let riskFlaggedCount = 0
  const stageBEntries: StageBQueueEntry[] = []
  for (const record of records) {
    byRoute[record.route] += 1
    byTerminalState[record.terminalState] = (byTerminalState[record.terminalState] ?? 0) + 1
    if (record.mandatoryPhysicianReview) mandatoryPhysicianReviewCount += 1
    if (record.riskFlags.length > 0) riskFlaggedCount += 1
    if (record.route === 'advance_to_full_relevance_classification') {
      stageBEntries.push({
        recordId: record.recordId,
        evidenceProfile: record.evidenceProfile,
        entrySource: stageBEntrySource(record),
        stageATerminalState: record.terminalState,
        coordinatorRiskFlagCount: record.riskFlags.length,
      })
    }
  }
  return {
    version: LUNA_ROUTING_MANIFEST_VERSION,
    total: records.length,
    byRoute,
    byTerminalState,
    deprioritizationCandidates: byRoute.deprioritization_candidate,
    mandatoryPhysicianReviewCount,
    riskFlaggedCount,
    stageBQueue: summarizeStageBQueue(stageBEntries),
    recordsSha256: sha256(canonicalJson(records.map((record) => record.recordId).sort())),
  }
}
