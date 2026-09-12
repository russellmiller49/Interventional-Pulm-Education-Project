import type { SafetyEvidenceRow } from './safety-notice-schema'

/** Editorial review interval for this reference beta, not an FDA or clinical threshold. */
export const SAFETY_REVIEW_INTERVAL_DAYS = 14
export type SafetyFreshness =
  | 'within_review_interval'
  | 'refresh_due'
  | 'incomplete'
  | 'not_checked'

export function safetyEvidenceFreshness(
  evidence: SafetyEvidenceRow | null,
  today: string,
): SafetyFreshness {
  if (!evidence || evidence.search_status === 'not_searched') return 'not_checked'
  if (evidence.search_status !== 'searched') return 'incomplete'
  const systems = new Set(evidence.source_checks.map((source) => source.system))
  if (
    systems.size !== 2 ||
    evidence.source_checks.some((source) => !source.dataset_as_of || source.has_undated_responses)
  )
    return 'incomplete'
  const day = Date.parse(`${today}T00:00:00Z`)
  if (!Number.isFinite(day)) return 'incomplete'
  const ages = evidence.source_checks.map(
    (source) => (day - Date.parse(`${source.dataset_as_of}T00:00:00Z`)) / 86_400_000,
  )
  if (ages.some((age) => !Number.isFinite(age) || age < 0)) return 'incomplete'
  return ages.some((age) => age >= SAFETY_REVIEW_INTERVAL_DAYS)
    ? 'refresh_due'
    : 'within_review_interval'
}
