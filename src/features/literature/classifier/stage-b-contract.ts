import { EVIDENCE_PROFILES, type EvidenceProfile } from './packet-contract'
import { STAGE_A_TERMINAL_STATES, type StageATerminalState } from './stage-a-contract'

/**
 * Stage-B contract: the four-way relevance classification stage that consumes Stage-A routing.
 *
 * Stage B is prepared here and deliberately not run. `insufficient_evidence` is a first-class
 * fourth outcome — an explicit decision, not an accident inherited from an older `uncertain`
 * label — and always keeps the record in human view. Detailed IP technology/disease/design
 * enrichment remains Stage C and is out of scope for this contract.
 */

export const STAGE_B_CONTRACT_VERSION = 'literature-luna-stage-b/1.0.0'

export const STAGE_B_LABELS = [
  'include_core',
  'include_adjacent',
  'exclude',
  'insufficient_evidence',
] as const

export type StageBLabel = (typeof STAGE_B_LABELS)[number]

/**
 * Why a record entered the Stage-B queue. Every source other than
 * `stage_a_advance_decision` exists because the routing contract advances everything that is
 * not a clean, low-risk, high-confidence negative.
 */
export const STAGE_B_ENTRY_SOURCES = [
  /** Stage A produced a valid non-negative decision or a below-high-confidence negative. */
  'stage_a_advance_decision',
  /** The deterministic coordinator risk layer flagged the record. */
  'coordinator_risk_flag',
  /** A physician rescued the record during review of a deprioritization candidate. */
  'physician_rescue',
  /** Stage-A output was invalid, missing, duplicated, refused, or quarantined. */
  'stage_a_output_unusable',
  /** The record was never attempted in Stage A. */
  'stage_a_not_attempted',
] as const

export type StageBEntrySource = (typeof STAGE_B_ENTRY_SOURCES)[number]

/** One Stage-B queue entry. Identified only by the opaque Stage-A record id. */
export interface StageBQueueEntry {
  readonly recordId: string
  readonly evidenceProfile: EvidenceProfile
  readonly entrySource: StageBEntrySource
  readonly stageATerminalState: StageATerminalState
  readonly coordinatorRiskFlagCount: number
}

export interface StageBQueueAggregates {
  readonly total: number
  readonly byEntrySource: Readonly<Record<StageBEntrySource, number>>
  readonly byEvidenceProfile: Readonly<Record<EvidenceProfile, number>>
}

/** Aggregate a Stage-B queue for reporting. Counts only; never identities. */
export function summarizeStageBQueue(entries: readonly StageBQueueEntry[]): StageBQueueAggregates {
  const byEntrySource = Object.fromEntries(
    STAGE_B_ENTRY_SOURCES.map((source) => [source, 0]),
  ) as Record<StageBEntrySource, number>
  const byEvidenceProfile = Object.fromEntries(
    EVIDENCE_PROFILES.map((profile) => [profile, 0]),
  ) as Record<EvidenceProfile, number>
  for (const entry of entries) {
    byEntrySource[entry.entrySource] += 1
    byEvidenceProfile[entry.evidenceProfile] += 1
  }
  return { total: entries.length, byEntrySource, byEvidenceProfile }
}

/**
 * The routing invariant Stage B relies on: every terminal state except a valid high-confidence
 * negative prediction must produce a queue entry. Exported so tests can enumerate it.
 */
export const STAGE_B_TERMINAL_STATES_ALWAYS_QUEUED: readonly StageATerminalState[] =
  STAGE_A_TERMINAL_STATES.filter((state) => state !== 'valid_prediction')
