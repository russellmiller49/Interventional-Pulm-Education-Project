import type { EvidenceProfile } from '../../src/features/literature/classifier/packet-contract'
import {
  isNegativeOnlyReasonCode,
  routeStageARecord,
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
  readonly riskFlags: ReadonlyMap<string, readonly string[]>
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
  const routed: RoutedRecord[] = []
  for (const assignment of inputs.assignments) {
    const evidenceProfile = inputs.evidenceProfiles.get(assignment.recordId)
    if (!evidenceProfile) {
      throw new Error('A terminal assignment has no evidence profile; refusing to route.')
    }
    const riskFlags = inputs.riskFlags.get(assignment.recordId) ?? []
    const decision = routeStageARecord({
      terminalState: assignment.state,
      output: assignment.output,
      coordinatorRiskFlags: riskFlags,
    })
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
