import { deterministicPmidOrder } from '../../src/features/literature/ultra-screening/core'
import { LUNA_AUDIT_SAMPLE_SEED } from './constants'
import { yearBandOf } from './corpus'
import type { RoutedRecord } from './routing'

/**
 * Deterministic stratified audit sampling of low-risk high-confidence negative candidates.
 *
 * Risk-enriched negatives are mandatory-review records and never sampled — they are always
 * reviewed. This sampler covers the remaining pool so a physician can audit the automatic
 * candidates without reviewing every one before an AI routing proposal exists. Strata:
 * evidence profile × primary reason code × journal family × year band × primary publication
 * type; allocation is proportional largest-remainder; within-stratum order is the versioned
 * SHA-256 rank.
 */

export interface AuditCandidateContext {
  readonly journal: string | null
  readonly publicationYear: number | null
  readonly primaryPublicationType: string | null
}

export interface AuditSampleEntry {
  readonly recordId: string
  readonly stratum: string
}

export interface AuditSampleInputs {
  /** The routed records eligible for audit: low-risk deprioritization candidates only. */
  readonly candidates: readonly RoutedRecord[]
  readonly contexts: ReadonlyMap<string, AuditCandidateContext>
  readonly sampleSize: number
  /** Reason-code stratification uses the first reason code of the model output. */
  readonly primaryReasonCodes: ReadonlyMap<string, string>
}

export interface AuditSample {
  readonly seed: string
  readonly requestedSize: number
  readonly poolSize: number
  readonly entries: readonly AuditSampleEntry[]
  readonly strataCounts: Readonly<Record<string, { pool: number; sampled: number }>>
}

const INSIGNIFICANT_JOURNAL_TOKENS = new Set(['the', 'of', 'and', 'journal', 'a', 'an'])

/** First significant token of the journal name: a stable coarse family label. */
export function journalFamilyOf(journal: string | null): string {
  if (!journal) return '(none)'
  const tokens = journal
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length > 0 && !INSIGNIFICANT_JOURNAL_TOKENS.has(token))
  return tokens[0] ?? '(none)'
}

export function buildAuditSample(inputs: AuditSampleInputs): AuditSample {
  if (!Number.isInteger(inputs.sampleSize) || inputs.sampleSize < 0) {
    throw new Error('The audit sample size must be a non-negative integer.')
  }
  for (const candidate of inputs.candidates) {
    if (candidate.route !== 'deprioritization_candidate' || candidate.riskFlags.length > 0) {
      throw new Error(
        'Audit sampling is defined only over low-risk deprioritization candidates; ' +
          'risk-enriched negatives are mandatory-review records.',
      )
    }
  }
  const strata = new Map<string, RoutedRecord[]>()
  for (const candidate of inputs.candidates) {
    const context = inputs.contexts.get(candidate.recordId)
    if (!context) throw new Error('An audit candidate has no bibliographic context.')
    const primaryReason = inputs.primaryReasonCodes.get(candidate.recordId) ?? '(none)'
    const stratum = [
      candidate.evidenceProfile,
      primaryReason,
      journalFamilyOf(context.journal),
      yearBandOf(context.publicationYear),
      context.primaryPublicationType ?? '(none)',
    ].join('|')
    const bucket = strata.get(stratum) ?? []
    bucket.push(candidate)
    strata.set(stratum, bucket)
  }
  const orderedStrata = [...strata.keys()].sort()
  const sizes = orderedStrata.map((stratum) => strata.get(stratum)?.length ?? 0)
  const pool = sizes.reduce((sum, value) => sum + value, 0)
  const requested = Math.min(inputs.sampleSize, pool)

  const exact = sizes.map((size) => (pool === 0 ? 0 : (size * requested) / pool))
  const base = exact.map((value) => Math.floor(value))
  let remaining = requested - base.reduce((sum, value) => sum + value, 0)
  const remainderOrder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
  const allocation = [...base]
  for (const entry of remainderOrder) {
    if (remaining <= 0) break
    if (allocation[entry.index] < sizes[entry.index]) {
      allocation[entry.index] += 1
      remaining -= 1
    }
  }
  for (let index = 0; index < allocation.length && remaining > 0; index += 1) {
    const headroom = sizes[index] - allocation[index]
    const take = Math.min(headroom, remaining)
    allocation[index] += take
    remaining -= take
  }

  const entries: AuditSampleEntry[] = []
  const strataCounts: Record<string, { pool: number; sampled: number }> = {}
  orderedStrata.forEach((stratum, index) => {
    const members = strata.get(stratum) ?? []
    const byId = new Map(members.map((member) => [member.recordId, member]))
    const ordered = deterministicPmidOrder(
      members.map((member) => member.recordId),
      `${LUNA_AUDIT_SAMPLE_SEED}:${stratum}`,
    )
    const sampled = ordered.slice(0, allocation[index])
    for (const recordId of sampled) {
      const member = byId.get(recordId)
      if (member) entries.push({ recordId: member.recordId, stratum })
    }
    strataCounts[stratum] = { pool: members.length, sampled: sampled.length }
  })
  return {
    seed: LUNA_AUDIT_SAMPLE_SEED,
    requestedSize: inputs.sampleSize,
    poolSize: pool,
    entries,
    strataCounts,
  }
}
